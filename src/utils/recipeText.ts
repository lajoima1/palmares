// Reads and writes the recipe.txt format. The admin page and the Worker both import this file,
// so it must use no DOM and no Node API.

export interface RecipeFields {
  name: string;
  description: string;
  servings: string;
  prep_time: string;
  cook_time: string;
  total_time: string;
  difficulty: string;
  tags: string[];
  ingredients: string[];
  instructions: string[];
  notes: string[];
}

export type ListKind = "list" | "steps";

type Section = "ingredients" | "instructions" | "notes";

const ONE_LINE_KEYS = [
  "name",
  "description",
  "servings",
  "prep_time",
  "cook_time",
  "total_time",
  "difficulty",
] as const;

export function emptyRecipe(): RecipeFields {
  return {
    name: "",
    description: "",
    servings: "",
    prep_time: "",
    cook_time: "",
    total_time: "",
    difficulty: "",
    tags: [],
    ingredients: [],
    instructions: [],
    notes: [],
  };
}

// Follows parseRecipe in scripts/build-recipes-db.js line for line. If the two differ, a saved
// recipe shows other values on the site than in the form.
export function parseRecipeText(text: string): RecipeFields {
  const recipe = emptyRecipe();
  let tags = "";
  let section: Section | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const key = ONE_LINE_KEYS.find((k) => line.startsWith(`${k}:`));
    if (key) {
      recipe[key] = line.substring(key.length + 1).trim();
    } else if (line.startsWith("tags:")) {
      tags = line.substring(5).trim();
    } else if (line === "ingredients:" || line === "instructions:" || line === "notes:") {
      section = line.slice(0, -1) as Section;
    } else if (section === "ingredients" && line.startsWith("-")) {
      recipe.ingredients.push(line.substring(1).trim());
    } else if (section === "instructions" && /^\d+\./.test(line)) {
      recipe.instructions.push(line.replace(/^\d+\.\s*/, "").trim());
    } else if (section === "notes" && line.startsWith("-")) {
      recipe.notes.push(line.substring(1).trim());
    }
  }

  recipe.tags = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return recipe;
}

// The layout of the template in scripts/add-recipe.js, without the empty sections.
export function serializeRecipe(fields: RecipeFields): string {
  const lines = ONE_LINE_KEYS.map((k) => `${k}: ${fields[k]}`.trimEnd());
  lines.push(`tags: ${fields.tags.join(", ")}`.trimEnd());

  if (fields.ingredients.length) {
    lines.push("", "ingredients:", ...fields.ingredients.map((i) => `- ${i}`));
  }
  if (fields.instructions.length) {
    lines.push("", "instructions:", ...fields.instructions.map((s, n) => `${n + 1}. ${s}`));
  }
  if (fields.notes.length) {
    lines.push("", "notes:", ...fields.notes.map((n) => `- ${n}`));
  }
  return lines.join("\n") + "\n";
}

// A line break in a one-line field would start a new line that parseRecipe reads as another key.
export function oneLine(value: string): string {
  return value.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

export function hasLineBreak(fields: RecipeFields): boolean {
  return [...ONE_LINE_KEYS.map((k) => fields[k]), ...fields.tags].some((v) => /[\r\n]/.test(v));
}

// The mark needs a space after it, so the step "1.5 tasses de farine" keeps its "1.".
const MARKS: Record<ListKind, RegExp> = {
  list: /^-[ \t]+/,
  steps: /^\d+\.\s+/,
};

export function linesToItems(text: string, kind: ListKind): string[] {
  return text
    .split(/\r?\n|\r/)
    .map((line) => line.trim().replace(MARKS[kind], "").trim())
    .filter(Boolean);
}

// A copy of nameToSlug in scripts/add-recipe.js. A test checks that both give the same slugs.
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
