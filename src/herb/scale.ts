import { LENGTH, NUMBER, RANGE_JOIN, readAmount, toNumber } from "../utils/amounts";

// A piece of a scaled line. The page draws a scaled piece in bold.
export interface Part {
  text: string;
  scaled: boolean;
}

// Fractions that a cook can measure with the usual cups and spoons.
const FRACTIONS: [number, string, string][] = [
  [0, "", ""],
  [1 / 8, "1/8", "⅛"],
  [1 / 4, "1/4", "¼"],
  [1 / 3, "1/3", "⅓"],
  [3 / 8, "3/8", "⅜"],
  [1 / 2, "1/2", "½"],
  [2 / 3, "2/3", "⅔"],
  [3 / 4, "3/4", "¾"],
  [1, "", ""],
];
// The word after an amount that must agree with it. Other words stay as written.
const PLURAL: Record<string, string> = {
  tasse: "tasses",
  cup: "cups",
  can: "cans",
  canne: "cannes",
  clove: "cloves",
  gousse: "gousses",
  œuf: "œufs",
  oeuf: "oeufs",
  egg: "eggs",
  boîte: "boîtes",
  boite: "boites",
  paquet: "paquets",
  pot: "pots",
  sachet: "sachets",
  sac: "sacs",
  bag: "bags",
  bouteille: "bouteilles",
  conserve: "conserves",
  tranche: "tranches",
  croûte: "croûtes",
  oignon: "oignons",
  onion: "onions",
  carotte: "carottes",
  poivron: "poivrons",
  poitrine: "poitrines",
  cuisse: "cuisses",
  filet: "filets",
  feuille: "feuilles",
  branche: "branches",
  tortilla: "tortillas",
  tablespoon: "tablespoons",
  teaspoon: "teaspoons",
  pound: "pounds",
};
const AMOUNT = `(${NUMBER})(?:(${RANGE_JOIN})(${NUMBER}))?`;
const AMOUNT_ANYWHERE = new RegExp(`${AMOUNT}(?![\\d/])`, "g");
// The second choice of a line: "2 gousses d'ail ou 1 c. à thé d'ail haché".
const OR_AMOUNT = new RegExp(`\\b(?:ou|or) ${AMOUNT}(?![\\d/])`, "gi");
// A parenthesis whose amounts scale: "(1 tasse)", "(≈225 g / 1/2 lb)", "(~450 g)",
// "(about 2 1/2 pounds)", "(ou 1 pot …)". A length, like "(15 cm)", stays.
const SCALED_PARENTHESIS = /\(\s*(?:≈|~|\d|[½¼¾⅓⅔⅛⅜]|environ\b|about\b|ou\b|or\b)[^)]*\)/gi;

// Writes a scaled number in the style of the source: "1 1/2", "1 ½" or "1,5".
export function formatAmount(value: number, source: string): string {
  if (value >= 10) return String(Math.round(value));
  const decimal = source.match(/^\d+([.,])\d+$/);
  if (decimal) return String(Math.round(value * 10) / 10).replace(".", decimal[1]);
  const unicode = /[½¼¾⅓⅔⅛⅜]/.test(source);
  let whole = Math.floor(value);
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(value - whole - f[0]) < Math.abs(value - whole - best[0])) best = f;
  if (best[0] === 1) {
    whole += 1;
    best = FRACTIONS[0];
  }
  const fraction = unicode ? best[2] : best[1];
  if (!whole) return fraction || (unicode ? "⅛" : "1/8");
  return fraction ? `${whole} ${fraction}` : String(whole);
}

// The plural of the first word of `text` if `value` is more than one, like " tasse de" → " tasses de".
function agree(text: string, value: number): string {
  if (value <= 1) return text;
  return text.replace(/^(\s*)([^\s.,;:)]+)/, (all, space: string, word: string) => {
    const plural = PLURAL[word.toLowerCase()];
    return plural ? space + plural : all;
  });
}

// An amount or a range at `factor`, and the larger value for the word after it.
function scaleAmount(from: string, join: string | undefined, to: string | undefined, factor: number) {
  const a = toNumber(from) * factor;
  const b = to ? toNumber(to) * factor : undefined;
  return { text: formatAmount(a, from) + (to ? `${join}${formatAmount(b!, to)}` : ""), value: b ?? a };
}

// Scales the amounts that `pattern` finds in `text`. The amount is the last part of each match.
function scaleMatches(text: string, factor: number, pattern: RegExp): Part[] {
  const parts: Part[] = [];
  let at = 0;
  for (const m of text.matchAll(pattern)) {
    const amountText = m[1] + (m[3] ? m[2] + m[3] : "");
    const start = m.index + m[0].length - amountText.length;
    const scaled = scaleAmount(m[1], m[2], m[3], factor);
    parts.push({ text: text.slice(at, start), scaled: false });
    parts.push({ text: scaled.text, scaled: true });
    at = m.index + m[0].length;
    const next = text.slice(at).match(/^\s*[^\s.,;:)/\-–]*/)?.[0] ?? "";
    parts.push({ text: agree(next, scaled.value), scaled: false });
    at += next.length;
  }
  parts.push({ text: text.slice(at), scaled: false });
  return parts;
}

function merge(parts: Part[]): Part[] {
  const out: Part[] = [];
  for (const p of parts) {
    if (!p.text) continue;
    const last = out[out.length - 1];
    if (last && last.scaled === p.scaled) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

// One ingredient line at `factor`: the amount at the start, a second choice after "ou", and the
// amounts in parentheses. A line with no amount at the start stays as it is.
export function scaleLine(text: string, factor: number): Part[] {
  const amount = factor === 1 ? null : readAmount(text);
  if (!amount) return [{ text, scaled: false }];
  const lead = scaleAmount(amount.from, amount.join, amount.to, factor);
  const parts: Part[] = [
    { text: amount.prefix, scaled: false },
    { text: lead.text, scaled: true },
  ];
  const rest = agree(text.slice(amount.length), lead.value);
  let at = 0;
  for (const m of rest.matchAll(/\([^)]*\)/g)) {
    parts.push(...scaleMatches(rest.slice(at, m.index), factor, OR_AMOUNT));
    const scales = new RegExp(SCALED_PARENTHESIS.source, "i").test(m[0]) && !LENGTH.test(m[0]);
    parts.push(...(scales ? scaleMatches(m[0], factor, AMOUNT_ANYWHERE) : [{ text: m[0], scaled: false }]));
    at = m.index + m[0].length;
  }
  parts.push(...scaleMatches(rest.slice(at), factor, OR_AMOUNT));
  return merge(parts);
}

export function lineText(parts: Part[]): string {
  return parts.map((p) => p.text).join("");
}

// True if at least one line has an amount that the scaler changes.
export function hasAmounts(ingredients: string[]): boolean {
  return ingredients.some((line) => !/^#{1,6}\s/.test(line.trim()) && readAmount(line) !== null);
}

// The servings at `factor`, if the text has one number or range outside parentheses. Else null.
export function scaleServings(text: string, factor: number): string | null {
  if (factor === 1) return text;
  const outside = text.replace(/\([^)]*\)/g, (p) => " ".repeat(p.length));
  const amounts = [...outside.matchAll(AMOUNT_ANYWHERE)];
  if (amounts.length !== 1) return null;
  const m = amounts[0];
  const scaled = scaleAmount(m[1], m[2], m[3], factor);
  return text.slice(0, m.index) + scaled.text + agree(text.slice(m.index + m[0].length), scaled.value);
}

// The Serves tile: the scaled servings, else the text with "×2" after it.
export function servingsLabel(text: string, factor: number): string {
  const t = text.trim();
  if (factor === 1 || !t || /^n\/?a$/i.test(t)) return t;
  return scaleServings(t, factor) ?? `${t} ×${factor}`;
}

export function noteText(servings: string, factor: number): string {
  const scaled = servings.trim() ? scaleServings(servings.trim(), factor) : null;
  const start = scaled ? `Amounts for ${scaled}.` : `Amounts ×${factor}.`;
  return `${start} Check the pan size and the cook time.`;
}
