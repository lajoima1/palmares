import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRecipeText } from "../utils/recipeText.ts";
import { formatAmount, lineText, noteText, scaleLine, scaleServings, servingsLabel } from "./scale.ts";

const at = (line: string, factor: number) => lineText(scaleLine(line, factor));

describe("scaleLine", () => {
  it("keeps the line at ×1, and a line with no amount", () => {
    expect(scaleLine("1 1/2 tasse de farine", 1)).toEqual([{ text: "1 1/2 tasse de farine", scaled: false }]);
    expect(at("Sel et poivre", 2)).toBe("Sel et poivre");
    expect(at("Linguinis cuits (quantité au choix ou Primo 700g)", 2)).toBe("Linguinis cuits (quantité au choix ou Primo 700g)");
  });

  it("marks the scaled amount", () => {
    expect(scaleLine("1 1/2 tasse de farine tamisée", 2)).toEqual([
      { text: "3", scaled: true },
      { text: " tasses de farine tamisée", scaled: false },
    ]);
  });

  it("scales fractions, mixed numbers and Unicode fractions in the style of the source", () => {
    expect(at("1/4 tasse de beurre", 3)).toBe("3/4 tasse de beurre");
    expect(at("2/3 tasse de sucre", 2)).toBe("1 1/3 tasses de sucre");
    expect(at("1 ½ cups beef broth", 3)).toBe("4 ½ cups beef broth");
    expect(at("¼ tsp freshly cracked black pepper", 2)).toBe("½ tsp freshly cracked black pepper");
    expect(at("1/8 c. à thé de sel", 3)).toBe("3/8 c. à thé de sel");
  });

  it("scales decimals with their separator, and makes 10 or more a whole number", () => {
    expect(at("0,5 ml (1/8 c. à thé) poivre", 3)).toBe("1,5 ml (3/8 c. à thé) poivre");
    expect(at("7.5 mL (1/2 c. soupe) de sel", 2)).toBe("15 mL (1 c. soupe) de sel");
    expect(at("500g de pâtes", 3)).toBe("1500g de pâtes");
  });

  it("scales both ends of a range", () => {
    expect(at("4 à 6 fleurons", 2)).toBe("8 à 12 fleurons");
    expect(at("1-2 poivron", 3)).toBe("3-6 poivron");
    expect(at("1/2 à 1 tasse de sauce soya, selon le goût", 2)).toBe("1 à 2 tasses de sauce soya, selon le goût");
  });

  it("keeps a word before the amount", () => {
    expect(at("Environ 900 g de bœuf haché maigre (1 paquet format maxi)", 2)).toBe(
      "Environ 1800 g de bœuf haché maigre (2 paquets format maxi)",
    );
  });

  it("scales the amounts in parentheses, and the words that agree", () => {
    expect(at("250 ml (1 tasse) sucre", 2)).toBe("500 ml (2 tasses) sucre");
    expect(at("½ lb (≈225 g) ground beef", 2)).toBe("1 lb (≈450 g) ground beef");
    expect(at("2 tasses de macaroni (≈225 g / 1/2 lb)", 2)).toBe("4 tasses de macaroni (≈450 g / 1 lb)");
    expect(at("1 boîte (284 ml total) crème de champignons condensée", 2)).toBe(
      "2 boîtes (568 ml total) crème de champignons condensée",
    );
    expect(at("1 boîte (15 oz/425 g total) de haricots noirs, égouttés", 2)).toBe(
      "2 boîtes (30 oz/850 g total) de haricots noirs, égouttés",
    );
    expect(at("1 can (≈411 g / 14.5 oz total) diced tomatoes (with juices)", 2)).toBe(
      "2 cans (≈822 g / 29 oz total) diced tomatoes (with juices)",
    );
  });

  it("leaves parentheses that hold no amount", () => {
    expect(at("1/2 tasse de vin rouge (ou bouillon de bœuf)", 2)).toBe("1 tasse de vin rouge (ou bouillon de bœuf)");
    expect(at("3 pounds beef chuck, cut into 1-inch pieces (about 2 1/2 pounds after trimming)", 2)).toBe(
      "6 pounds beef chuck, cut into 1-inch pieces (about 5 pounds after trimming)",
    );
  });

  it("makes the words of the list agree", () => {
    expect(at("1 œuf", 3)).toBe("3 œufs");
    expect(at("1 garlic clove", 2)).toBe("2 garlic clove");
    expect(at("1 gousse d'ail", 2)).toBe("2 gousses d'ail");
    expect(at("4 tranches de bacon précuit", 2)).toBe("8 tranches de bacon précuit");
  });
});

describe("formatAmount", () => {
  it("takes the nearest fraction that a cook can measure", () => {
    expect(formatAmount(0.3, "1/3")).toBe("1/3");
    expect(formatAmount(1.6, "1/2")).toBe("1 2/3");
    expect(formatAmount(0.95, "1/2")).toBe("1");
    expect(formatAmount(12.4, "1/2")).toBe("12");
  });
});

describe("servings", () => {
  it("scales one number or range outside parentheses", () => {
    expect(scaleServings("9-12 portions", 2)).toBe("18-24 portions");
    expect(scaleServings("6 à 8 portions", 3)).toBe("18 à 24 portions");
    expect(scaleServings("6 servings (≈1 ⅓ cups each)", 2)).toBe("12 servings (≈1 ⅓ cups each)");
    expect(scaleServings("1 croûte de tarte", 2)).toBe("2 croûtes de tarte");
  });

  it("gives null with no number, or more than one", () => {
    expect(scaleServings("Une grande marmite", 2)).toBeNull();
    expect(scaleServings("2 biscuits géants ou 48 petits biscuits", 2)).toBeNull();
    expect(scaleServings("4 sacs de 12 petits pains", 2)).toBeNull();
  });

  it("labels the Serves tile", () => {
    expect(servingsLabel("4 portions", 1)).toBe("4 portions");
    expect(servingsLabel("4 portions", 4)).toBe("16 portions");
    expect(servingsLabel("Une grande marmite", 2)).toBe("Une grande marmite ×2");
    expect(servingsLabel("N/A", 2)).toBe("N/A");
  });

  it("writes the note line", () => {
    expect(noteText("9-12 portions", 2)).toBe("Amounts for 18-24 portions. Check the pan size and the cook time.");
    expect(noteText("Une grande marmite", 3)).toBe("Amounts ×3. Check the pan size and the cook time.");
    expect(noteText("", 2)).toBe("Amounts ×2. Check the pan size and the cook time.");
  });

  it("scales or keeps each servings text of the recipes", () => {
    const slugs: string[] = JSON.parse(fs.readFileSync("recipes/index.json", "utf8"));
    for (const slug of slugs) {
      const { servings } = parseRecipeText(fs.readFileSync(`recipes/${slug}/recipe.txt`, "utf8"));
      const label = servingsLabel(servings, 2);
      const scaled = scaleServings(servings.trim(), 2);
      expect(label, slug).toBe(scaled ?? (/^n\/?a$/i.test(servings.trim()) ? servings.trim() : `${servings.trim()} ×2`));
      expect(label, slug).not.toMatch(/NaN|undefined/);
    }
  });
});
