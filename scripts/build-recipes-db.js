import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import initSqlJs from "sql.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RECIPES_DIR = path.join(__dirname, "..", "recipes");
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PUBLIC_RECIPES_DIR = path.join(PUBLIC_DIR, "recipes");
const DB_PATH = path.join(PUBLIC_DIR, "recipes.db");
const INDEX_PATH = path.join(RECIPES_DIR, "index.json");

// Initialize sql.js
const SQL = await initSqlJs();

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Delete existing recipes folder and database to fully regenerate
if (fs.existsSync(PUBLIC_RECIPES_DIR)) {
  fs.rmSync(PUBLIC_RECIPES_DIR, { recursive: true, force: true });
}
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

// Create fresh recipes directory
fs.mkdirSync(PUBLIC_RECIPES_DIR, { recursive: true });

// Create database
const db = new SQL.Database();

// Create tables
db.run(`
  CREATE TABLE recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    servings TEXT,
    prep_time TEXT,
    cook_time TEXT,
    total_time TEXT,
    difficulty TEXT,
    tags TEXT
  );

  CREATE TABLE ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    ingredient TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id)
  );

  CREATE TABLE instructions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id)
  );

  CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id)
  );

  CREATE INDEX idx_recipe_slug ON recipes(slug);
  CREATE INDEX idx_recipe_tags ON recipes(tags);
`);

// Parse recipe.txt file
function parseRecipe(content) {
  const lines = content.split("\n");
  const recipe = {
    ingredients: [],
    instructions: [],
    notes: [],
  };

  let currentSection = null;

  for (let line of lines) {
    line = line.trim();

    if (!line) continue;

    // Parse metadata
    if (line.startsWith("name:")) {
      recipe.name = line.substring(5).trim();
    } else if (line.startsWith("description:")) {
      recipe.description = line.substring(12).trim();
    } else if (line.startsWith("servings:")) {
      recipe.servings = line.substring(9).trim();
    } else if (line.startsWith("prep_time:")) {
      recipe.prep_time = line.substring(10).trim();
    } else if (line.startsWith("cook_time:")) {
      recipe.cook_time = line.substring(10).trim();
    } else if (line.startsWith("total_time:")) {
      recipe.total_time = line.substring(11).trim();
    } else if (line.startsWith("difficulty:")) {
      recipe.difficulty = line.substring(11).trim();
    } else if (line.startsWith("tags:")) {
      recipe.tags = line.substring(5).trim();
    }
    // Detect sections
    else if (line === "ingredients:") {
      currentSection = "ingredients";
    } else if (line === "instructions:") {
      currentSection = "instructions";
    } else if (line === "notes:") {
      currentSection = "notes";
    }
    // Add to current section
    else if (currentSection === "ingredients" && line.startsWith("-")) {
      recipe.ingredients.push(line.substring(1).trim());
    } else if (currentSection === "instructions" && /^\d+\./.test(line)) {
      recipe.instructions.push(line.replace(/^\d+\.\s*/, "").trim());
    } else if (currentSection === "notes" && line.startsWith("-")) {
      recipe.notes.push(line.substring(1).trim());
    }
  }

  return recipe;
}

// Read recipe slugs from index.json
const recipeSlugs = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));

// Process all recipes
for (const slug of recipeSlugs) {
  const recipeDir = path.join(RECIPES_DIR, slug);
  const recipePath = path.join(recipeDir, "recipe.txt");
  const imagePath = path.join(recipeDir, "image.webp");

  if (!fs.existsSync(recipePath)) {
    console.warn(`Warning: recipe.txt not found for ${slug}`);
    continue;
  }

  // Parse recipe
  const content = fs.readFileSync(recipePath, "utf-8");
  const recipe = parseRecipe(content);

  // Copy and rename image to public/recipes/ folder
  const newImageName = `${slug}.webp`;
  const newImagePath = path.join(PUBLIC_RECIPES_DIR, newImageName);

  if (fs.existsSync(imagePath)) {
    fs.copyFileSync(imagePath, newImagePath);
    console.log(`✓ Copied image: ${newImageName}`);
  } else {
    console.warn(`Warning: image.webp not found for ${slug}`);
  }

  // Insert recipe
  db.run(
    `INSERT INTO recipes (slug, name, description, servings, prep_time, cook_time, total_time, difficulty, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      recipe.name || slug,
      recipe.description || null,
      recipe.servings || null,
      recipe.prep_time || null,
      recipe.cook_time || null,
      recipe.total_time || null,
      recipe.difficulty || null,
      recipe.tags || null,
    ]
  );

  // Get the last inserted recipe ID
  const recipeId = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];

  // Insert ingredients
  for (const ingredient of recipe.ingredients) {
    db.run(`INSERT INTO ingredients (recipe_id, ingredient) VALUES (?, ?)`, [
      recipeId,
      ingredient,
    ]);
  }

  // Insert instructions
  for (let i = 0; i < recipe.instructions.length; i++) {
    db.run(
      `INSERT INTO instructions (recipe_id, step_number, instruction) VALUES (?, ?, ?)`,
      [recipeId, i + 1, recipe.instructions[i]]
    );
  }

  // Insert notes
  for (const note of recipe.notes) {
    db.run(`INSERT INTO notes (recipe_id, note) VALUES (?, ?)`, [recipeId, note]);
  }

  console.log(`✓ Processed recipe: ${recipe.name || slug}`);
}

// Export database to file
const data = db.export();
fs.writeFileSync(DB_PATH, data);

db.close();

console.log("\n✅ Database created successfully at:", DB_PATH);
console.log(`📊 Processed ${recipeSlugs.length} recipes`);
console.log("🖼️  Images copied to public folder");
