import { describe, expect, it } from "vitest";
import type { Recipe } from "../types/Recipe";
import {
  filterCount,
  filterRecipes,
  isFiltered,
  noFilters,
  tagCounts,
  toggleTag,
  withTag,
} from "./filters.ts";

function recipe(id: string, fields: Partial<Recipe>): Recipe {
  return {
    id,
    name: id,
    description: "",
    servings: "",
    prep_time: "",
    cook_time: "",
    total_time: "",
    difficulty: "Easy",
    tags: [],
    ingredients: [],
    instructions: [],
    image_url: "",
    ...fields,
  };
}

const recipes = [
  recipe("pate", { name: "Pâté chinois", tags: ["beef", "weeknight"], ingredients: ["Maïs en crème"] }),
  recipe("pouding", { name: "Pouding chômeur", description: "Sauce à l’érable", tags: ["dessert"] }),
  recipe("lasagne", { name: "Lasagne", difficulty: "Medium", tags: ["beef", "pasta"] }),
];

describe("filterRecipes", () => {
  const ids = (f = noFilters) => filterRecipes(recipes, f).map((r) => r.id);

  it("finds the text in the name, the description or an ingredient", () => {
    expect(ids({ ...noFilters, query: "PÂTÉ" })).toEqual(["pate"]);
    expect(ids({ ...noFilters, query: "érable" })).toEqual(["pouding"]);
    expect(ids({ ...noFilters, query: "maïs" })).toEqual(["pate"]);
  });

  it("needs each chosen tag", () => {
    expect(ids({ ...noFilters, tags: ["beef"] })).toEqual(["pate", "lasagne"]);
    expect(ids({ ...noFilters, tags: ["beef", "pasta"] })).toEqual(["lasagne"]);
  });

  it("keeps one difficulty", () => {
    expect(ids({ ...noFilters, difficulty: "Medium" })).toEqual(["lasagne"]);
  });

  it("keeps everything with no filter", () => {
    expect(ids()).toEqual(["pate", "pouding", "lasagne"]);
    expect(isFiltered(noFilters)).toBe(false);
    expect(isFiltered({ ...noFilters, query: "  " })).toBe(false);
  });
});

describe("counts and tag changes", () => {
  it("counts tags by use, then by name", () => {
    expect(tagCounts(recipes)).toEqual([
      { tag: "beef", count: 2 },
      { tag: "dessert", count: 1 },
      { tag: "pasta", count: 1 },
      { tag: "weeknight", count: 1 },
    ]);
  });

  it("counts the active filters of the filters button", () => {
    expect(filterCount({ query: "x", tags: ["a", "b"], difficulty: "Easy" })).toBe(3);
  });

  it("toggles a tag, and adds one only once", () => {
    const one = toggleTag(noFilters, "beef");
    expect(one.tags).toEqual(["beef"]);
    expect(toggleTag(one, "beef").tags).toEqual([]);
    expect(withTag(one, "beef").tags).toEqual(["beef"]);
    expect(withTag(one, "pasta").tags).toEqual(["beef", "pasta"]);
  });
});
