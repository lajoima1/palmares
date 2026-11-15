import { NUMBER, RANGE_JOIN, readAmount, toNumber } from "../utils/amounts";

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
  clove: "cloves",
  gousse: "gousses",
  œuf: "œufs",
  oeuf: "oeufs",
  egg: "eggs",
  boîte: "boîtes",
  boite: "boites",
  paquet: "paquets",
  pot: "pots",
  tranche: "tranches",
  croûte: "croûtes",
};
const NUMBER_ANYWHERE = new RegExp(`${NUMBER}(?![\\d/])`, "g");
const AMOUNT_ANYWHERE = new RegExp(`${NUMBER}(?:${RANGE_JOIN}${NUMBER})?`, "g");
// A parenthesis whose amounts scale: "(1 tasse)", "(≈225 g / 1/2 lb)", "(about 2 1/2 pounds)".
const SCALED_PARENTHESIS = /\(\s*(?:≈|\d|[½¼¾⅓⅔⅛⅜]|environ\b|about\b)[^)]*\)/gi;

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

// Scales each number of a text, like the inside of "(≈225 g / 1/2 lb)".
function scaleNumbers(text: string, factor: number): Part[] {
  const parts: Part[] = [];
  let at = 0;
  let pending = "";
  for (const m of text.matchAll(NUMBER_ANYWHERE)) {
    const value = toNumber(m[0]) * factor;
    parts.push({ text: pending + text.slice(at, m.index), scaled: false });
    parts.push({ text: formatAmount(value, m[0]), scaled: true });
    at = m.index + m[0].length;
    const next = text.slice(at).match(/^\s*[^\s.,;:)/]*/)?.[0] ?? "";
    pending = agree(next, value);
    at += next.length;
  }
  parts.push({ text: pending + text.slice(at), scaled: false });
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

// One ingredient line at `factor`. Only the amount at the start and the amounts in parentheses
// change. A line with no amount at the start stays as it is.
export function scaleLine(text: string, factor: number): Part[] {
  const amount = factor === 1 ? null : readAmount(text);
  if (!amount) return [{ text, scaled: false }];
  const from = toNumber(amount.from) * factor;
  const to = amount.to ? toNumber(amount.to) * factor : undefined;
  const parts: Part[] = [
    { text: amount.prefix, scaled: false },
    {
      text: formatAmount(from, amount.from) + (amount.to ? `${amount.join}${formatAmount(to!, amount.to)}` : ""),
      scaled: true,
    },
  ];
  const rest = agree(text.slice(amount.length), to ?? from);
  let at = 0;
  for (const m of rest.matchAll(SCALED_PARENTHESIS)) {
    parts.push({ text: rest.slice(at, m.index), scaled: false });
    parts.push(...scaleNumbers(m[0], factor));
    at = m.index + m[0].length;
  }
  parts.push({ text: rest.slice(at), scaled: false });
  return merge(parts);
}

export function lineText(parts: Part[]): string {
  return parts.map((p) => p.text).join("");
}

// The servings at `factor`, if the text has one number or range outside parentheses. Else null.
export function scaleServings(text: string, factor: number): string | null {
  if (factor === 1) return text;
  const outside = text.replace(/\([^)]*\)/g, (p) => " ".repeat(p.length));
  const amounts = [...outside.matchAll(AMOUNT_ANYWHERE)];
  if (amounts.length !== 1) return null;
  const m = amounts[0];
  const range = m[0].match(new RegExp(`^(${NUMBER})(?:(${RANGE_JOIN})(${NUMBER}))?$`));
  if (!range) return null;
  const from = toNumber(range[1]) * factor;
  const to = range[3] ? toNumber(range[3]) * factor : undefined;
  const scaled = formatAmount(from, range[1]) + (range[3] ? `${range[2]}${formatAmount(to!, range[3])}` : "");
  return text.slice(0, m.index) + scaled + agree(text.slice(m.index + m[0].length), to ?? from);
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
