// Proves that a recipe saved from the admin page gives the same database rows as the original.
// It runs two copies of the unchanged build script: one on the original recipes, one on the
// recipes after the same steps as the form (parse, one item per line, write).
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import initSqlJs from "sql.js";
import { linesToItems, parseRecipeText, serializeRecipe } from "../src/utils/recipeText.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECIPES_DIR = path.join(ROOT, "recipes");
const WORK_DIR = path.join(ROOT, "node_modules", ".tmp", "roundtrip");
const TABLES = {
  recipes: "SELECT slug, name, description, servings, prep_time, cook_time, total_time, difficulty, tags FROM recipes ORDER BY slug",
  ingredients: "SELECT r.slug, i.ingredient FROM ingredients i JOIN recipes r ON r.id = i.recipe_id ORDER BY r.slug, i.id",
  instructions: "SELECT r.slug, s.step_number, s.instruction FROM instructions s JOIN recipes r ON r.id = s.recipe_id ORDER BY r.slug, s.step_number",
  notes: "SELECT r.slug, n.note FROM notes n JOIN recipes r ON r.id = n.recipe_id ORDER BY r.slug, n.id",
};

function asTheFormSavesIt(text) {
  const fields = parseRecipeText(text);
  fields.ingredients = linesToItems(fields.ingredients.join("\n"), "list");
  fields.instructions = linesToItems(fields.instructions.join("\n"), "steps");
  fields.notes = linesToItems(fields.notes.join("\n"), "list");
  return serializeRecipe(fields);
}

// The build script finds its files through __dirname/.., so each copy sits in its own scripts/.
function buildCopy(name, slugs, rewrite) {
  const dir = path.join(WORK_DIR, name);
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "scripts", "build-recipes-db.js"), path.join(dir, "scripts", "build-recipes-db.js"));
  fs.copyFileSync(path.join(RECIPES_DIR, "index.json"), path.join(dir, "recipes", "index.json"));
  for (const slug of slugs) {
    const text = fs.readFileSync(path.join(RECIPES_DIR, slug, "recipe.txt"), "utf-8");
    fs.mkdirSync(path.join(dir, "recipes", slug), { recursive: true });
    fs.writeFileSync(path.join(dir, "recipes", slug, "recipe.txt"), rewrite ? asTheFormSavesIt(text) : text);
  }
  execFileSync(process.execPath, [path.join(dir, "scripts", "build-recipes-db.js")], { stdio: "ignore" });
  return path.join(dir, "public", "recipes.db");
}

fs.rmSync(WORK_DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(WORK_DIR, "a", "recipes"), { recursive: true });
fs.mkdirSync(path.join(WORK_DIR, "b", "recipes"), { recursive: true });

const slugs = JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, "index.json"), "utf-8"));
const SQL = await initSqlJs();
const [original, saved] = [buildCopy("a", slugs, false), buildCopy("b", slugs, true)].map(
  (file) => new SQL.Database(fs.readFileSync(file)),
);

for (const [table, query] of Object.entries(TABLES)) {
  const a = original.exec(query)[0]?.values ?? [];
  const b = saved.exec(query)[0]?.values ?? [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      console.error(`round-trip FAILED in ${table}, row ${i + 1}:`);
      console.error(`  original: ${JSON.stringify(a[i])}`);
      console.error(`  saved:    ${JSON.stringify(b[i])}`);
      process.exit(1);
    }
  }
}

console.log(`round-trip OK: ${slugs.length} recipes`);
