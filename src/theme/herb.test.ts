import { describe, expect, it } from "vitest";
import { herbTokens, type HerbTokens } from "./herb.ts";

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Each pair that the screens use for text, as [text, background].
const textPairs: [keyof HerbTokens, keyof HerbTokens][] = [
  ["ink", "ground"],
  ["ink", "surface"],
  ["ink2", "ground"],
  ["ink2", "surface"],
  ["herb", "ground"],
  ["herb", "surface"],
  ["herb", "herbTint"],
  ["onHerb", "herb"],
  ["saffronInk", "saffronTint"],
  ["errorInk", "errorTint"],
  ["ground", "ink"],
];

describe("herb colours", () => {
  for (const mode of ["light", "dark"] as const) {
    for (const [text, background] of textPairs) {
      it(`${mode}: ${text} on ${background} reaches 4.5:1`, () => {
        const t = herbTokens[mode];
        expect(contrast(t[text], t[background])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
