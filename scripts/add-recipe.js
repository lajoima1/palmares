import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RECIPES_DIR = path.join(__dirname, "..", "recipes");
const INDEX_PATH = path.join(RECIPES_DIR, "index.json");

// Get recipe name from command line arguments
const recipeName = process.argv.slice(2).join(" ");

if (!recipeName) {
  console.error("❌ Error: Please provide a recipe name");
  console.log("\nUsage: npm run add-recipe <recipe-name>");
  console.log('Example: npm run add-recipe "Chocolate Chip Cookies"');
  process.exit(1);
}

// Convert recipe name to slug (lowercase, spaces to dashes, remove special chars)
function nameToSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD") // Normalize unicode characters
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-") // Replace multiple dashes with single dash
    .replace(/^-|-$/g, ""); // Remove leading/trailing dashes
}

const slug = nameToSlug(recipeName);

if (!slug) {
  console.error("❌ Error: Could not generate valid slug from recipe name");
  process.exit(1);
}

console.log(`\n📝 Adding new recipe: "${recipeName}"`);
console.log(`🔗 Slug: "${slug}"\n`);

// Check if recipe already exists
const recipeDir = path.join(RECIPES_DIR, slug);
if (fs.existsSync(recipeDir)) {
  console.error(`❌ Error: Recipe folder already exists: ${slug}`);
  process.exit(1);
}

// Read current index
let recipeIndex = [];
try {
  const indexContent = fs.readFileSync(INDEX_PATH, "utf-8");
  recipeIndex = JSON.parse(indexContent);
} catch (error) {
  console.error(`❌ Error reading index.json: ${error.message}`);
  process.exit(1);
}

// Check if slug already in index
if (recipeIndex.includes(slug)) {
  console.error(`❌ Error: Recipe already exists in index: ${slug}`);
  process.exit(1);
}

// Add slug to index
recipeIndex.push(slug);

// Write updated index
try {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(recipeIndex, null, 2) + "\n");
  console.log(`✓ Added "${slug}" to index.json`);
} catch (error) {
  console.error(`❌ Error writing index.json: ${error.message}`);
  process.exit(1);
}

// Create recipe directory
try {
  fs.mkdirSync(recipeDir, { recursive: true });
  console.log(`✓ Created folder: recipes/${slug}/`);
} catch (error) {
  console.error(`❌ Error creating directory: ${error.message}`);
  process.exit(1);
}

// Create template recipe.txt
const recipeTemplate = `name: ${recipeName}
description: 
servings: 
prep_time: 
cook_time: 
total_time: 
difficulty: Easy
tags: 

ingredients:
- 

instructions:
1. 

notes:
- 
`;

const recipePath = path.join(recipeDir, "recipe.txt");
try {
  fs.writeFileSync(recipePath, recipeTemplate);
  console.log(`✓ Created template: recipes/${slug}/recipe.txt`);
} catch (error) {
  console.error(`❌ Error creating recipe.txt: ${error.message}`);
  process.exit(1);
}

console.log("\n✅ Recipe created successfully!");
console.log(`\n📂 Location: recipes/${slug}/recipe.txt`);
console.log("📝 Next steps:");
console.log("   1. Edit the recipe.txt file with recipe details");
console.log("   2. Add an image.webp file to the recipe folder (optional)");
console.log("   3. Run 'npm run build:recipes' to update the database");
console.log("");
