import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  emptyRecipe,
  hasLineBreak,
  linesToItems,
  nameToSlug,
  oneLine,
  parseRecipeText,
  serializeRecipe,
} from "./recipeText.ts";

const SAMPLE = `name: Pouding chômeur
description: Un dessert québécois
servings: 8
prep_time: 15 min
cook_time: 40 min
total_time: 55 min
difficulty: Easy
tags: dessert, québécois

ingredients:
- ## Pour la sauce:
- 2 tasses de cassonade
- 7.5 mL de sel

instructions:
1. Préchauffer le four.
2. Mélanger.

notes:
- Meilleur tiède
`;

describe("parseRecipeText", () => {
  it("reads the keys, the tags and the sections", () => {
    const r = parseRecipeText(SAMPLE);
    expect(r.name).toBe("Pouding chômeur");
    expect(r.difficulty).toBe("Easy");
    expect(r.tags).toEqual(["dessert", "québécois"]);
    expect(r.ingredients).toEqual(["## Pour la sauce:", "2 tasses de cassonade", "7.5 mL de sel"]);
    expect(r.instructions).toEqual(["Préchauffer le four.", "Mélanger."]);
    expect(r.notes).toEqual(["Meilleur tiède"]);
  });

  it("reads Windows line ends and trailing spaces", () => {
    const r = parseRecipeText("name: A  \r\ndifficulty: Easy  \r\ninstructions:\r\n1.Mix\r\n");
    expect(r.name).toBe("A");
    expect(r.difficulty).toBe("Easy");
    expect(r.instructions).toEqual(["Mix"]);
  });

  it("gives empty values for a recipe with only a name", () => {
    expect(parseRecipeText("name: Toast\n")).toEqual({ ...emptyRecipe(), name: "Toast" });
  });
});

describe("serializeRecipe", () => {
  it("writes back the same text for a full recipe", () => {
    expect(serializeRecipe(parseRecipeText(SAMPLE))).toBe(SAMPLE);
  });

  it("writes each key and no empty section", () => {
    expect(serializeRecipe({ ...emptyRecipe(), name: "Toast" })).toBe(
      "name: Toast\ndescription:\nservings:\nprep_time:\ncook_time:\ntotal_time:\ndifficulty:\ntags:\n",
    );
  });

  it("numbers the steps from 1", () => {
    const text = serializeRecipe({ ...emptyRecipe(), name: "A", instructions: ["x", "y"] });
    expect(text).toContain("instructions:\n1. x\n2. y\n");
  });
});

describe("linesToItems", () => {
  it("drops empty lines and trims", () => {
    expect(linesToItems("  a  \n\n   \nb\r\nc", "list")).toEqual(["a", "b", "c"]);
  });

  it("removes a pasted list mark, and keeps a sub-heading", () => {
    expect(linesToItems("- sel\n-\tpoivre\n- ## Pour la sauce:", "list")).toEqual([
      "sel",
      "poivre",
      "## Pour la sauce:",
    ]);
  });

  it("removes a pasted step number only if a space follows it", () => {
    expect(linesToItems("3. Mélanger\n12.  Cuire\n1.5 tasses de farine", "steps")).toEqual([
      "Mélanger",
      "Cuire",
      "1.5 tasses de farine",
    ]);
  });

  it("keeps a number in a list item", () => {
    expect(linesToItems("1. tasse de lait\n-5 °C", "list")).toEqual(["1. tasse de lait", "-5 °C"]);
  });
});

describe("one-line fields", () => {
  it("joins the lines with one space", () => {
    expect(oneLine("  Un dessert\r\n  québécois\n")).toBe("Un dessert québécois");
  });

  it("finds a line break in any one-line field or tag", () => {
    expect(hasLineBreak({ ...emptyRecipe(), name: "A" })).toBe(false);
    expect(hasLineBreak({ ...emptyRecipe(), description: "a\nname: B" })).toBe(true);
    expect(hasLineBreak({ ...emptyRecipe(), servings: "4\r" })).toBe(true);
    expect(hasLineBreak({ ...emptyRecipe(), tags: ["a\nb"] })).toBe(true);
  });
});

describe("nameToSlug", () => {
  // Runs the function from scripts/add-recipe.js. That script cannot be imported: it writes files.
  const source = readFileSync(new URL("../../scripts/add-recipe.js", import.meta.url), "utf-8");
  const body = source.match(/function nameToSlug\(name\) \{([\s\S]*?)\n\}/)?.[1];
  const scriptSlug = new Function("name", body ?? "throw new Error('nameToSlug not found')") as (
    name: string,
  ) => string;

  it.each(["Pâté chinois", "Mac & cheese!", "  Soupe   aux  pois ", "Crème brûlée -- à l'érable"])(
    "gives the same slug as add-recipe.js for %j",
    (name) => {
      expect(nameToSlug(name)).toBe(scriptSlug(name));
    },
  );

  it("gives the expected slugs", () => {
    expect(nameToSlug("Pâté chinois")).toBe("pate-chinois");
    expect(nameToSlug("Mac & cheese!")).toBe("mac-cheese");
    expect(nameToSlug("  Soupe   aux  pois ")).toBe("soupe-aux-pois");
  });
});
