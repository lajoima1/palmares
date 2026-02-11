/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Recipe Database Loader for Browser
 *
 * This module provides functions to load and query the SQLite recipes database
 * in the browser using sql.js.
 *
 * Installation required:
 * npm install sql.js
 *
 * Usage example:
 *
 * ```typescript
 * import { loadRecipeDatabase, getAllRecipes, getRecipeBySlug } from './utils/recipeDatabase';
 *
 * // Load database once at app startup
 * const db = await loadRecipeDatabase();
 *
 * // Query all recipes
 * const recipes = getAllRecipes(db);
 *
 * // Query specific recipe
 * const recipe = getRecipeBySlug(db, 'coconut-brownies');
 * ```
 */

import initSqlJs, { type Database } from "sql.js";

let sqlJs: any = null;

/**
 * Initialize sql.js library (call once)
 */
async function initSql() {
  if (!sqlJs) {
    sqlJs = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
    });
  }
  return sqlJs;
}

/**
 * Load the recipes database from public folder
 */
export async function loadRecipeDatabase(): Promise<Database> {
  const SQL = await initSql();

  // Use import.meta.env.BASE_URL to handle Vite base path
  const basePath = import.meta.env.BASE_URL || "/";
  const dbPath = `${basePath}recipes.db`.replace("//", "/");

  const response = await fetch(dbPath);
  const buffer = await response.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buffer));

  return db;
}

/**
 * Get all recipes with basic info
 */
export function getAllRecipes(db: Database) {
  const stmt = db.prepare(`
    SELECT id, slug, name, description, servings, prep_time, cook_time, 
           total_time, difficulty, tags
    FROM recipes
    ORDER BY name
  `);

  const recipes = [];
  while (stmt.step()) {
    recipes.push(stmt.getAsObject());
  }
  stmt.free();

  return recipes;
}

/**
 * Get recipe by slug with all details
 */
export function getRecipeBySlug(db: Database, slug: string) {
  // Get recipe metadata
  const recipeStmt = db.prepare(`
    SELECT id, slug, name, description, servings, prep_time, cook_time,
           total_time, difficulty, tags
    FROM recipes
    WHERE slug = ?
  `);
  recipeStmt.bind([slug]);

  if (!recipeStmt.step()) {
    recipeStmt.free();
    return null;
  }

  const recipe: any = recipeStmt.getAsObject();
  recipeStmt.free();

  // Get ingredients
  const ingredientsStmt = db.prepare(`
    SELECT ingredient
    FROM ingredients
    WHERE recipe_id = ?
    ORDER BY id
  `);
  ingredientsStmt.bind([recipe.id]);

  recipe.ingredients = [];
  while (ingredientsStmt.step()) {
    const row = ingredientsStmt.getAsObject();
    recipe.ingredients.push(row.ingredient);
  }
  ingredientsStmt.free();

  // Get instructions
  const instructionsStmt = db.prepare(`
    SELECT instruction
    FROM instructions
    WHERE recipe_id = ?
    ORDER BY step_number
  `);
  instructionsStmt.bind([recipe.id]);

  recipe.instructions = [];
  while (instructionsStmt.step()) {
    const row = instructionsStmt.getAsObject();
    recipe.instructions.push(row.instruction);
  }
  instructionsStmt.free();

  // Get notes
  const notesStmt = db.prepare(`
    SELECT note
    FROM notes
    WHERE recipe_id = ?
    ORDER BY id
  `);
  notesStmt.bind([recipe.id]);

  recipe.notes = [];
  while (notesStmt.step()) {
    const row = notesStmt.getAsObject();
    recipe.notes.push(row.note);
  }
  notesStmt.free();

  return recipe;
}

/**
 * Search recipes by name or tags
 */
export function searchRecipes(db: Database, query: string) {
  const stmt = db.prepare(`
    SELECT id, slug, name, description, servings, prep_time, cook_time,
           total_time, difficulty, tags
    FROM recipes
    WHERE name LIKE ? OR tags LIKE ? OR description LIKE ?
    ORDER BY name
  `);

  const searchTerm = `%${query}%`;
  stmt.bind([searchTerm, searchTerm, searchTerm]);

  const recipes = [];
  while (stmt.step()) {
    recipes.push(stmt.getAsObject());
  }
  stmt.free();

  return recipes;
}

/**
 * Get recipes by tag
 */
export function getRecipesByTag(db: Database, tag: string) {
  const stmt = db.prepare(`
    SELECT id, slug, name, description, servings, prep_time, cook_time,
           total_time, difficulty, tags
    FROM recipes
    WHERE tags LIKE ?
    ORDER BY name
  `);

  stmt.bind([`%${tag}%`]);

  const recipes = [];
  while (stmt.step()) {
    recipes.push(stmt.getAsObject());
  }
  stmt.free();

  return recipes;
}

/**
 * Get all unique tags
 */
export function getAllTags(db: Database): string[] {
  const stmt = db.prepare(`
    SELECT DISTINCT tags
    FROM recipes
    WHERE tags IS NOT NULL AND tags != ''
  `);

  const tagsSet = new Set<string>();
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const tags = (row.tags as string).split(",").map((t) => t.trim());
    tags.forEach((tag) => tagsSet.add(tag));
  }
  stmt.free();

  return Array.from(tagsSet).sort();
}

/**
 * Helper to construct full image URL from slug
 */
function getImageUrl(slug: string): string {
  const basePath = import.meta.env.BASE_URL || "/";
  return `${basePath}recipes/${slug}.webp`.replace("//", "/");
}

/**
 * Transform database result to Recipe interface
 * Maps DB schema to match existing Recipe type used throughout the app
 */
function transformDbRecipe(dbRecipe: any): any {
  return {
    id: dbRecipe.slug, // Use slug as id for compatibility
    slug: dbRecipe.slug,
    name: dbRecipe.name,
    description: dbRecipe.description || "",
    servings: dbRecipe.servings || "",
    prep_time: dbRecipe.prep_time || "",
    cook_time: dbRecipe.cook_time || "",
    total_time: dbRecipe.total_time || "",
    difficulty: dbRecipe.difficulty || "Medium",
    tags: dbRecipe.tags
      ? dbRecipe.tags.split(",").map((t: string) => t.trim())
      : [],
    ingredients: dbRecipe.ingredients || [],
    instructions: dbRecipe.instructions || [],
    notes:
      dbRecipe.notes && dbRecipe.notes.length > 0 ? dbRecipe.notes : undefined,
    image_url: getImageUrl(dbRecipe.slug),
  };
}

/**
 * Load all recipes from database with full details
 * Optimized for performance: loads DB, extracts all data, closes DB
 * Returns in-memory Recipe array ready for use
 */
export async function loadAllRecipesFromDb(): Promise<any[]> {
  const db = await loadRecipeDatabase();

  try {
    // Get all recipes with basic info
    const recipesStmt = db.prepare(`
      SELECT id, slug, name, description, servings, prep_time, cook_time,
             total_time, difficulty, tags
      FROM recipes
      ORDER BY name
    `);

    const recipes = [];

    while (recipesStmt.step()) {
      const recipeRow = recipesStmt.getAsObject();
      const recipeId = recipeRow.id;

      // Get ingredients for this recipe
      const ingredientsStmt = db.prepare(`
        SELECT ingredient
        FROM ingredients
        WHERE recipe_id = ?
        ORDER BY id
      `);
      ingredientsStmt.bind([recipeId]);

      const ingredients = [];
      while (ingredientsStmt.step()) {
        const row = ingredientsStmt.getAsObject();
        ingredients.push(row.ingredient as string);
      }
      ingredientsStmt.free();

      // Get instructions for this recipe
      const instructionsStmt = db.prepare(`
        SELECT instruction
        FROM instructions
        WHERE recipe_id = ?
        ORDER BY step_number
      `);
      instructionsStmt.bind([recipeId]);

      const instructions = [];
      while (instructionsStmt.step()) {
        const row = instructionsStmt.getAsObject();
        instructions.push(row.instruction as string);
      }
      instructionsStmt.free();

      // Get notes for this recipe
      const notesStmt = db.prepare(`
        SELECT note
        FROM notes
        WHERE recipe_id = ?
        ORDER BY id
      `);
      notesStmt.bind([recipeId]);

      const notes = [];
      while (notesStmt.step()) {
        const row = notesStmt.getAsObject();
        notes.push(row.note as string);
      }
      notesStmt.free();

      // Build complete recipe object
      const completeRecipe = {
        ...recipeRow,
        ingredients,
        instructions,
        notes,
      };

      // Transform to match Recipe interface
      recipes.push(transformDbRecipe(completeRecipe));
    }

    recipesStmt.free();

    // Close database - we have all data in memory now
    db.close();

    return recipes;
  } catch (error) {
    // Make sure to close DB even on error
    try {
      db.close();
    } catch {
      // Ignore close errors
    }
    throw error;
  }
}
