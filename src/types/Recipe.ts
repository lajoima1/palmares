export interface Recipe {
  id: string;
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
  notes?: string;
  image_url: string;
}

export function parseRecipeText(
  recipeText: string
): Omit<Recipe, "id" | "image_url"> {
  const lines = recipeText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  const recipe: any = {
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
    notes: "",
  };

  let currentSection = "";

  for (const line of lines) {
    if (line.includes(":") && !line.startsWith("-") && !line.match(/^\d+\./)) {
      const colonIndex = line.indexOf(":");
      const fieldName = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (fieldName === "tags") {
        recipe.tags = value
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag);
        currentSection = "";
      } else if (
        fieldName === "ingredients" ||
        fieldName === "instructions" ||
        fieldName === "notes"
      ) {
        currentSection = fieldName;
        // If there's a value after the colon for notes, use it as a single-line note
        if (fieldName === "notes" && value) {
          recipe.notes = value;
        }
      } else if (value) {
        recipe[fieldName] = value;
        currentSection = "";
      } else {
        // Handle section headers without values (like "notes:" with no text after)
        currentSection = fieldName;
      }
    } else if (currentSection === "ingredients" && line.startsWith("-")) {
      recipe.ingredients.push(line.substring(1).trim());
    } else if (currentSection === "instructions" && line.match(/^\d+\./)) {
      recipe.instructions.push(line.replace(/^\d+\.\s*/, ""));
    } else if (currentSection === "notes" && line.startsWith("-")) {
      // Handle multi-line notes as bullet points
      const noteItem = line.substring(1).trim();
      if (recipe.notes) {
        recipe.notes += "\n• " + noteItem;
      } else {
        recipe.notes = "• " + noteItem;
      }
    }
  }

  return recipe;
}

async function loadRecipeImage(
  recipeId: string,
  basePath: string
): Promise<string> {
  // List of common image file extensions to check
  const imageExtensions = ["jpg", "jpeg", "png", "webp", "gif"];

  // Try to find an actual image file first
  for (const ext of imageExtensions) {
    const imageUrl = `${basePath}recipes/${recipeId}/image.${ext}`;
    try {
      const response = await fetch(imageUrl, { method: "HEAD" });
      if (response.ok) {
        return imageUrl;
      }
    } catch (error) {
      // Continue to next extension if this one fails
    }
  }

  return "https://images.unsplash.com/photo-1546548970-71785318a17b?w=400&h=300&fit=crop";
}

export async function loadRecipe(recipeId: string): Promise<Recipe> {
  try {
    // Always use the base URL configured in vite.config.ts
    const basePath = import.meta.env.BASE_URL || "/";
    const recipeUrl = `${basePath}recipes/${recipeId}/recipe.txt`;

    const recipeResponse = await fetch(recipeUrl);

    if (!recipeResponse.ok) {
      throw new Error(
        `Failed to fetch recipe ${recipeId}: ${recipeResponse.status} ${recipeResponse.statusText}`
      );
    }

    const recipeText = await recipeResponse.text();

    if (!recipeText || recipeText.trim().length === 0) {
      throw new Error(`Recipe ${recipeId} is empty`);
    }

    const parsed = parseRecipeText(recipeText);

    // Validate that we have essential fields
    if (!parsed.name || !parsed.description) {
      throw new Error(`Recipe ${recipeId} is missing essential fields`);
    }

    // Load the image (actual file or fallback to placeholder)
    const imageUrl = await loadRecipeImage(recipeId, basePath);

    return {
      id: recipeId,
      image_url: imageUrl,
      ...parsed,
    };
  } catch (error) {
    console.error("Error loading recipe:", error);
    throw error;
  }
}

export async function loadAllRecipes(): Promise<Recipe[]> {
  try {
    // Always use the base URL configured in vite.config.ts
    const basePath = import.meta.env.BASE_URL || "/";
    const indexUrl = `${basePath}recipes/index.json`;

    const indexResponse = await fetch(indexUrl);

    if (!indexResponse.ok) {
      throw new Error(
        `Failed to fetch recipe index: ${indexResponse.status} ${indexResponse.statusText}`
      );
    }

    const recipeIds: string[] = await indexResponse.json();

    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      console.warn("No recipe IDs found in index");
      return [];
    }

    // Load recipes one by one to avoid issues with Promise.all if one fails
    const recipes: Recipe[] = [];
    for (const id of recipeIds) {
      try {
        const recipe = await loadRecipe(id);
        recipes.push(recipe);
      } catch (error) {
        console.error(`Failed to load recipe ${id}:`, error);
        // Continue loading other recipes even if one fails
      }
    }

    return recipes;
  } catch (error) {
    console.error("Error loading recipes:", error);
    return [];
  }
}
