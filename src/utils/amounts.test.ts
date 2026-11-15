import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { amountProblems, readAmount } from "./amounts.ts";
import { parseRecipeText } from "./recipeText.ts";

describe("readAmount", () => {
  it("reads a number, a fraction, a decimal or a range, with the word before it", () => {
    expect(readAmount("1 1/2 tasse de farine")?.from).toBe("1 1/2");
    expect(readAmount("1 ½ cups beef broth")?.from).toBe("1 ½");
    expect(readAmount("0,5 ml (1/8 c. à thé) poivre")?.from).toBe("0,5");
    expect(readAmount("4 à 6 fleurons")).toMatchObject({ from: "4", join: " à ", to: "6" });
    expect(readAmount("Environ 900 g de bœuf")).toMatchObject({ prefix: "Environ ", from: "900" });
    expect(readAmount("1 c. à thé de sel")).toMatchObject({ from: "1", to: undefined });
    expect(readAmount("Sel et poivre")).toBeNull();
  });
});

describe("amountProblems", () => {
  it("finds an amount that is not first", () => {
    expect(amountProblems(["Bouillon de poulet 750 ml (3 tasses)", "Bacon précuit 4 tranches"])).toEqual([
      { line: "Bouillon de poulet 750 ml (3 tasses)", message: "Put the amount first." },
      { line: "Bacon précuit 4 tranches", message: "Put the amount first." },
    ]);
  });

  it("finds a container size that does not say total", () => {
    expect(amountProblems(["1 boîte (284 ml) de tomates", "1 can (≈425 g / 15 oz) diced tomatoes"])).toEqual([
      { line: "1 boîte (284 ml) de tomates", message: "Add “total” in the parentheses." },
      { line: "1 can (≈425 g / 15 oz) diced tomatoes", message: "Add “total” in the parentheses." },
    ]);
  });

  it("finds a container size anywhere in the line", () => {
    for (const line of ["1 boîte de sauce tomate (7½ oz ou 221 ml)", "1 (15 oz) can black beans", "1 bouteille de vin blanc (750 ml) ou un carton"]) {
      expect(amountProblems([line])).toEqual([{ line, message: "Add “total” in the parentheses." }]);
    }
  });

  it("passes headings, lines with no number, and lines that the scaler reads", () => {
    expect(
      amountProblems([
        "## Pour la sauce:",
        "Sel et poivre",
        "Linguinis cuits (quantité au choix ou Primo 700g)",
        "Environ 900 g de bœuf haché maigre (1 paquet format maxi)",
        "1 boîte (284 ml total) de tomates",
        "3 pounds beef chuck, cut into 1-inch pieces",
        "1 tasse de salsa (≈16 oz/450 g) (1 boîte)",
        "2 boîtes de 28 oz de tomates broyées (ou idéalement, 1 pot en verre)",
        "8 tortillas à la farine (15 à 17,5 cm de diamètre)",
        "1 et 1/2 c. à thé de sauce Worcestershire",
      ]),
    ).toEqual([]);
  });

  it("passes every recipe of the site", () => {
    const slugs: string[] = JSON.parse(fs.readFileSync("recipes/index.json", "utf8"));
    for (const slug of slugs) {
      const { ingredients } = parseRecipeText(fs.readFileSync(`recipes/${slug}/recipe.txt`, "utf8"));
      expect(amountProblems(ingredients), slug).toEqual([]);
    }
  });
});
