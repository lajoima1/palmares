import { hasLineBreak, nameToSlug, parseRecipeText, serializeRecipe, type RecipeFields } from "../src/utils/recipeText.ts";
import { commitChanges, listRecipes, readHead, readImage, type Change, type Head } from "./github.ts";
import { HttpError, json, readJson } from "./http.ts";
import type { Context } from "./router.ts";

// A photo of 1.5 MB is 2 MB in base64, plus the text. The photos in the repo are 145 KB at most.
const MAX_BODY = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const MAX_TEXT = 20_000;
// The slug comes from the name and is a folder name. Some file systems refuse more than 255 bytes.
export const MAX_NAME = 100;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DIFFICULTIES = ["", "Easy", "Medium", "Hard"];
const ONE_LINE = ["name", "description", "servings", "prep_time", "cook_time", "total_time", "difficulty"] as const;
const LISTS = ["tags", "ingredients", "instructions", "notes"] as const;

interface SaveBody {
  fields?: unknown;
  baseOid?: unknown;
  image?: unknown;
}

function checkSlug(slug: string): string {
  if (!SLUG.test(slug)) throw new HttpError(400, "This recipe address is not valid.");
  return slug;
}

export function readFields(value: unknown): RecipeFields {
  if (typeof value !== "object" || value === null) throw new HttpError(400, "The recipe fields are missing.");
  const input = value as Record<string, unknown>;
  const fields = {} as RecipeFields;
  for (const key of ONE_LINE) {
    const v = input[key] ?? "";
    if (typeof v !== "string") throw new HttpError(400, `The field ${key} must be text.`);
    fields[key] = v;
  }
  for (const key of LISTS) {
    const v = input[key] ?? [];
    if (!Array.isArray(v) || v.some((item) => typeof item !== "string")) {
      throw new HttpError(400, `The field ${key} must be a list of text.`);
    }
    // A line break in an item would start a line that parseRecipe reads as a key.
    if (v.some((item: string) => /[\r\n]/.test(item))) {
      throw new HttpError(400, `An item of ${key} holds a line break.`);
    }
    fields[key] = v.map((item: string) => item.trim()).filter(Boolean);
  }
  // Check before the trim, so a trailing line break is refused too.
  if (hasLineBreak(fields)) throw new HttpError(400, "A one-line field holds a line break.");
  for (const key of ONE_LINE) fields[key] = fields[key].trim();
  fields.tags = [...new Set(fields.tags)];

  if (!fields.name) throw new HttpError(400, "The recipe needs a name.");
  if (fields.name.length > MAX_NAME) throw new HttpError(400, `The name is longer than ${MAX_NAME} characters.`);
  if (!DIFFICULTIES.includes(fields.difficulty)) throw new HttpError(400, "The difficulty must be Easy, Medium or Hard.");
  if (fields.tags.some((t) => t.includes(","))) throw new HttpError(400, "A tag cannot hold a comma.");
  return fields;
}

// The text that the build reads must give back the values that the owner typed.
export function recipeText(fields: RecipeFields): string {
  const text = serializeRecipe(fields);
  if (text.length > MAX_TEXT) throw new HttpError(400, `The recipe is longer than ${MAX_TEXT} characters.`);
  if (JSON.stringify(parseRecipeText(text)) !== JSON.stringify(fields)) {
    throw new HttpError(400, "This recipe cannot be saved as typed. Check the fields for special lines.");
  }
  return text;
}

// "RIFF", 4 bytes of size, then "WEBP". The first 16 base64 characters hold those 12 bytes.
function readImage64(value: unknown): string {
  if (typeof value !== "string" || value.length < 16 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new HttpError(400, "The photo is not valid.");
  }
  if (value.length * 0.75 > MAX_IMAGE_BYTES) throw new HttpError(413, "The photo is too large.");
  const start = atob(value.slice(0, 16));
  if (start.slice(0, 4) !== "RIFF" || start.slice(8, 12) !== "WEBP") {
    throw new HttpError(400, "The photo must be a webp file.");
  }
  return value;
}

function indexChange(list: string[]): Change {
  return { path: "recipes/index.json", content: JSON.stringify(list, null, 2) + "\n" };
}

function recipeOid(head: Head): string | undefined {
  return head.folder?.find((f) => f.name === "recipe.txt")?.oid;
}

function needRecipe(head: Head, baseOid: unknown): void {
  if (typeof baseOid !== "string") throw new HttpError(400, "The version of the recipe is missing.");
  if (!head.folder) throw new HttpError(404, "This recipe does not exist any more.");
  if (recipeOid(head) !== baseOid) {
    throw new HttpError(409, "This recipe changed on GitHub after you opened it. Reload it, then save again.");
  }
}

// Git names a file by this hash, so a save with no change makes no commit.
async function gitBlobOid(text: string): Promise<string> {
  const content = new TextEncoder().encode(text);
  const header = new TextEncoder().encode(`blob ${content.length}\0`);
  const all = new Uint8Array(header.length + content.length);
  all.set(header);
  all.set(content, header.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", all));
  return [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listHandler({ env }: Context): Promise<Response> {
  const summaries = await listRecipes(env);
  const recipes = summaries.map((s) => {
    const fields = parseRecipeText(s.text);
    return { slug: s.slug, name: fields.name || s.slug, tags: fields.tags, hasImage: s.hasImage, notLive: s.notLive };
  });
  const tags = [...new Set(recipes.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b));
  return json({
    recipes: recipes.sort((a, b) => a.name.localeCompare(b.name)),
    tags,
  });
}

export async function getHandler({ env, params }: Context): Promise<Response> {
  const slug = checkSlug(params[0]);
  const head = await readHead(env, slug);
  if (!head.folder || head.text === null || !head.index.includes(slug)) {
    throw new HttpError(404, "This recipe does not exist.");
  }
  return json({
    slug,
    fields: parseRecipeText(head.text),
    baseOid: recipeOid(head),
    hasImage: head.folder.some((f) => f.name === "image.webp"),
  });
}

export async function imageHandler({ env, params }: Context): Promise<Response> {
  return readImage(env, checkSlug(params[0]));
}

export async function createHandler({ request, env }: Context): Promise<Response> {
  const body = await readJson<SaveBody>(request, MAX_BODY);
  const fields = readFields(body.fields);
  const text = recipeText(fields);
  const image = body.image === undefined || body.image === null ? null : readImage64(body.image);
  const slug = nameToSlug(fields.name);
  if (!slug) throw new HttpError(400, "The name needs at least one letter or digit.");

  const result = await commitChanges(env, `recipe: add ${fields.name}`, slug, (head) => {
    if (head.folder || head.index.includes(slug)) {
      throw new HttpError(409, `A recipe with this address exists: ${slug}. Choose another name.`);
    }
    return [
      { path: `recipes/${slug}/recipe.txt`, content: text },
      ...(image ? [{ path: `recipes/${slug}/image.webp`, base64: image }] : []),
      indexChange([...head.index, slug]),
    ];
  });
  return json({ slug, commit: result.commit }, 201);
}

export async function updateHandler({ request, env, params }: Context): Promise<Response> {
  // The slug never changes after the first save, so a new name keeps the old links working.
  const slug = checkSlug(params[0]);
  const body = await readJson<SaveBody>(request, MAX_BODY);
  const fields = readFields(body.fields);
  const text = recipeText(fields);
  const image = body.image === undefined || body.image === null ? body.image : readImage64(body.image);
  const textOid = await gitBlobOid(text);

  const result = await commitChanges(env, `recipe: update ${fields.name}`, slug, (head) => {
    needRecipe(head, body.baseOid);
    const changes: Change[] = [];
    if (textOid !== recipeOid(head)) changes.push({ path: `recipes/${slug}/recipe.txt`, content: text });
    if (typeof image === "string") changes.push({ path: `recipes/${slug}/image.webp`, base64: image });
    if (image === null && head.folder!.some((f) => f.name === "image.webp")) {
      changes.push({ path: `recipes/${slug}/image.webp`, delete: true });
    }
    return changes;
  });
  return json({ slug, commit: result.commit, changed: result.changed });
}

export async function deleteHandler({ request, env, params }: Context): Promise<Response> {
  const slug = checkSlug(params[0]);
  const body = await readJson<SaveBody>(request, MAX_BODY);
  const nameOf = (head: { text: string | null }) => (head.text && parseRecipeText(head.text).name) || slug;

  const result = await commitChanges(env, (head) => `recipe: delete ${nameOf(head)}`, slug, (head) => {
    needRecipe(head, body.baseOid);
    return [
      ...head.folder!.map((f): Change => ({ path: `recipes/${slug}/${f.name}`, delete: true })),
      indexChange(head.index.filter((s) => s !== slug)),
    ];
  });
  return json({ slug, commit: result.commit });
}
