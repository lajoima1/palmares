// Reads the amounts of ingredient lines, for the scaler of the recipe page and for the check that
// the build and the admin save run on each recipe.

export const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 1 / 2,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
};
const FRACTION = "[½¼¾⅓⅔⅛⅜]";
// "1 1/2", "1 et 1/2", "1/4", "1 ½", "½", "0,5", "7.5", "500" (also in "500g").
export const NUMBER = `(?:\\d+ (?:et |and )?\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?(?: ?${FRACTION})?|${FRACTION})`;
// "2-3", "4 à 6", "25 to 30".
export const RANGE_JOIN = "\\s*(?:-|–|à|to)\\s*";
const PREFIX = "(?:(?:environ|about)\\s+|≈\\s?)?";
const LEAD = new RegExp(`^(${PREFIX})(${NUMBER})(?:(${RANGE_JOIN})(${NUMBER}))?`, "i");
const HEADING = /^#{1,6}\s/;
const HAS_NUMBER = new RegExp(`\\d|${FRACTION}`);
// A container whose size in parentheses must say "total", so that it scales with the count.
const CONTAINER = /\b(?:boîtes?|boites?|cans?|pots?|paquets?|sachets?|jars?|packages?|bouteilles?|bottles?|conserves?|cartons?|sacs?|bags?)\b/i;
// A size in parentheses: "(284 ml)", "(≈425 g / 15 oz)", "(~450 g)".
const SIZE = /\(\s*(?:≈|~|\d|environ\b|about\b)[^)]*\)/gi;
// A length in parentheses, like the width of a tortilla, never scales.
export const LENGTH = /\d\s*(?:cm|mm|po|pouces?|inch(?:es)?|in)\b|\d\s*"/i;

export interface Amount {
  // "Environ ", "About " or "≈", as written.
  prefix: string;
  from: string;
  // The join and the end of a range, like " à " and "6".
  join?: string;
  to?: string;
  // The length of the amount in the line, prefix included.
  length: number;
}

// The amount at the start of a line, or null.
export function readAmount(line: string): Amount | null {
  const m = line.match(LEAD);
  if (!m) return null;
  return { prefix: m[1], from: m[2], join: m[3], to: m[4], length: m[0].length };
}

export function toNumber(text: string): number {
  const s = text.trim();
  let m = s.match(/^(\d+) (\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(\d+) (?:et|and) (\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  m = s.match(new RegExp(`^(\\d+(?:[.,]\\d+)?) ?(${FRACTION})$`));
  if (m) return Number(m[1].replace(",", ".")) + UNICODE_FRACTIONS[m[2]];
  if (s in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[s];
  return Number(s.replace(",", "."));
}

export interface AmountProblem {
  line: string;
  message: string;
}

// The ingredient lines that the scaler cannot read. A heading or a line with no number passes.
export function amountProblems(ingredients: string[]): AmountProblem[] {
  const problems: AmountProblem[] = [];
  for (const line of ingredients) {
    if (HEADING.test(line.trim())) continue;
    const amount = readAmount(line);
    if (!amount) {
      if (HAS_NUMBER.test(line.replace(/\([^)]*\)/g, ""))) problems.push({ line, message: "Put the amount first." });
      continue;
    }
    const outside = line.replace(/\([^)]*\)/g, " ");
    const sizes = [...line.matchAll(SIZE)].map((m) => m[0]).filter((p) => !LENGTH.test(p));
    if (CONTAINER.test(outside) && sizes.some((p) => !/\btotal\b/i.test(p))) {
      problems.push({ line, message: "Add “total” in the parentheses." });
    }
  }
  return problems;
}
