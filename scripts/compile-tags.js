import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RECIPES_DIR = path.join(__dirname, "..", "recipes");
const INDEX_PATH = path.join(RECIPES_DIR, "index.json");

// Read all recipe slugs from index
const recipeSlugs = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));

// Set to store unique tags
const tagsSet = new Set();
const tagCounts = {};

// Process each recipe
for (const slug of recipeSlugs) {
  const recipePath = path.join(RECIPES_DIR, slug, "recipe.txt");

  if (!fs.existsSync(recipePath)) {
    console.warn(`Warning: Recipe file not found for ${slug}`);
    continue;
  }

  const content = fs.readFileSync(recipePath, "utf-8");
  const lines = content.split("\n");

  // Find the tags line
  for (const line of lines) {
    if (line.trim().startsWith("tags:")) {
      const tagsString = line.substring(line.indexOf(":") + 1).trim();

      // Split by comma and clean up each tag
      const tags = tagsString
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      // Add to set and count occurrences
      tags.forEach((tag) => {
        tagsSet.add(tag);
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      break; // Found tags line, move to next recipe
    }
  }
}

// Convert to sorted array
const allTags = Array.from(tagsSet).sort();

// Sort tags by count (most used first)
const tagsByCount = Object.entries(tagCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([tag, count]) => ({ tag, count }));

// Output results
console.log("=".repeat(60));
console.log("ALL TAGS IN USE (Alphabetically)");
console.log("=".repeat(60));
console.log(`Total unique tags: ${allTags.length}\n`);

allTags.forEach((tag, index) => {
  const count = tagCounts[tag];
  console.log(
    `${(index + 1).toString().padStart(2)}. ${tag.padEnd(20)} (used in ${count} recipe${count > 1 ? "s" : ""})`,
  );
});

console.log("\n" + "=".repeat(60));
console.log("TAGS BY USAGE FREQUENCY");
console.log("=".repeat(60));

tagsByCount.forEach((item, index) => {
  console.log(
    `${(index + 1).toString().padStart(2)}. ${item.tag.padEnd(20)} (${item.count} recipe${item.count > 1 ? "s" : ""})`,
  );
});

console.log("\n" + "=".repeat(60));
console.log("TAG CATEGORIES");
console.log("=".repeat(60));

// Categorize tags (manual categorization based on analysis)
const categories = {
  Protein: allTags.filter((t) =>
    ["beef", "chicken", "fish", "pork", "veal", "sausage"].includes(t),
  ),
  "Dish Type": allTags.filter((t) =>
    [
      "main",
      "dessert",
      "soup",
      "snack",
      "appetizer",
      "cookies",
      "pasta",
    ].includes(t),
  ),
  Occasion: allTags.filter((t) =>
    ["weeknight", "hosting", "christmas", "breakfast"].includes(t),
  ),
  Dietary: allTags.filter((t) => ["keto", "gd-friendly"].includes(t)),
  Equipment: allTags.filter((t) => ["slowcooker", "air fryer"].includes(t)),
  Other: allTags.filter((t) =>
    [
      "large portion",
      "made by mom",
      "meal prep",
      "campbell",
      "chocolate chip",
      "potato",
      "rice",
      "sweet potato",
    ].includes(t),
  ),
};

for (const [category, tags] of Object.entries(categories)) {
  if (tags.length > 0) {
    console.log(`\n${category}:`);
    tags.forEach((tag) => {
      console.log(`  - ${tag} (${tagCounts[tag]})`);
    });
  }
}

console.log("\n" + "=".repeat(60));
