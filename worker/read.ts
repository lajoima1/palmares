import { linesToItems, type ListKind, type RecipeFields } from "../src/utils/recipeText.ts";
import { HttpError } from "./http.ts";
import { MAX_NAME, readFields, recipeText } from "./recipes.ts";

// The recipe data is near the top of a page. The text code takes about 4 ms of CPU for 1 MB, and
// the free plan gives a request 10 ms.
const MAX_PAGE = 1024 * 1024;
// About 6,000 tokens, or 150 neurons with Llama 4 Scout. A longer text uses more of the day.
const MAX_TEXT = 24_000;
// Some recipe sites refuse a request with no browser name.
const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const REFUSED = "This site refused the request. Take a screenshot and use the photo instead.";
const NOT_OPENED = "This link could not be opened. Check the link, or use a screenshot.";
const RECIPE_KEYS = [
  "name",
  "description",
  "recipeYield",
  "prepTime",
  "cookTime",
  "totalTime",
  "recipeIngredient",
  "recipeInstructions",
  "recipeCategory",
  "keywords",
];

export interface Page {
  html: string;
  host: string;
}

async function readCapped(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_PAGE) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value.subarray(0, MAX_PAGE - size));
    size += Math.min(value.length, MAX_PAGE - size);
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.length;
  }
  return all;
}

function decode(bytes: Uint8Array, contentType: string | null): string {
  const charset = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  try {
    return new TextDecoder(charset ?? "utf-8").decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

export async function readPage(link: string): Promise<Page> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new HttpError(400, "This link is not valid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, "The link must start with http or https.");
  }
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": BROWSER, Accept: "text/html,application/xhtml+xml", "Accept-Language": "fr, en" },
    });
  } catch {
    throw new HttpError(422, NOT_OPENED);
  }
  if ([401, 403, 429, 503].includes(res.status) || res.headers.get("cf-mitigated") === "challenge") {
    throw new HttpError(422, REFUSED);
  }
  if (!res.ok || !res.body) throw new HttpError(422, NOT_OPENED);
  const html = decode(await readCapped(res.body), res.headers.get("Content-Type"));
  return { html, host: url.hostname.replace(/^www\./, "") };
}

function isRecipe(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

function searchRecipe(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 5 || typeof node !== "object" || node === null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = searchRecipe(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  if (isRecipe(record)) return record;
  return searchRecipe(record["@graph"], depth + 1);
}

function recipeData(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = searchRecipe(JSON.parse(match[1].trim()));
      if (found) return found;
    } catch {
      // A broken block on the page. The next block can still hold the recipe.
    }
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  laquo: "«",
  raquo: "»",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  ocirc: "ô",
  icirc: "î",
  ucirc: "û",
  ugrave: "ù",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z\d]+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|nav|header|footer|aside|form)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n[\s]*/g, "\n")
    .trim();
}

// The recipe data of the page if it has some, else its visible text. Never its photo.
export function pageText(html: string): string {
  const recipe = recipeData(html);
  const text = recipe
    ? JSON.stringify(Object.fromEntries(RECIPE_KEYS.filter((k) => k in recipe).map((k) => [k, recipe[k]])))
    : visibleText(html);
  return text.slice(0, MAX_TEXT);
}

function oneLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s*[\r\n]+\s*/g, " ").trim() : "";
}

function items(value: unknown, kind: ListKind): string[] {
  if (!Array.isArray(value)) return [];
  return linesToItems(value.filter((v): v is string => typeof v === "string").join("\n"), kind);
}

// The model's answer, made safe for the form. A value that a save would refuse is dropped. null:
// no recipe, or an answer that still fails the checks of a save.
export function cleanAnswer(raw: unknown, tags: string[]): RecipeFields | null {
  if (typeof raw !== "object" || raw === null) return null;
  const answer = raw as Record<string, unknown>;
  if (answer.found !== true) return null;
  const known = new Map(tags.map((t) => [t.toLowerCase(), t]));
  const difficulty = oneLine(answer.difficulty).toLowerCase();
  const fields: RecipeFields = {
    name: oneLine(answer.name).slice(0, MAX_NAME).trim(),
    description: oneLine(answer.description),
    servings: oneLine(answer.servings),
    prep_time: oneLine(answer.prep_time),
    cook_time: oneLine(answer.cook_time),
    total_time: oneLine(answer.total_time),
    difficulty: ["Easy", "Medium", "Hard"].find((d) => d.toLowerCase() === difficulty) ?? "",
    tags: [
      ...new Set(
        (Array.isArray(answer.tags) ? answer.tags : [])
          .map((t) => (typeof t === "string" ? known.get(t.trim().toLowerCase()) : undefined))
          .filter((t): t is string => t !== undefined),
      ),
    ],
    ingredients: items(answer.ingredients, "list"),
    instructions: items(answer.instructions, "steps"),
    notes: items(answer.notes, "list"),
  };
  if (!fields.name) return null;
  try {
    const checked = readFields(fields);
    recipeText(checked);
    return checked;
  } catch {
    return null;
  }
}
