import { describe, expect, it } from "vitest";
import { toLines } from "./lines.ts";

describe("toLines", () => {
  it("keeps headings apart and numbers the other lines", () => {
    expect(toLines(["## Pour le gâteau:", "Farine", "Sucre", "## Pour la sauce: ", "Sirop"])).toEqual([
      { heading: true, text: "Pour le gâteau" },
      { heading: false, text: "Farine", number: 1 },
      { heading: false, text: "Sucre", number: 2 },
      { heading: true, text: "Pour la sauce" },
      { heading: false, text: "Sirop", number: 3 },
    ]);
  });

  it("leaves bold text to the inline markdown", () => {
    expect(toLines(["Cuire sur **low pendant 8 heures**"])).toEqual([
      { heading: false, text: "Cuire sur **low pendant 8 heures**", number: 1 },
    ]);
  });
});
