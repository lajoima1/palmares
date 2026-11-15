import { readAmount, toNumber } from "../utils/amounts";

const HOURS = "(?:heures?|hours?|hrs?)";
const MINUTES = "(?:minutes?|mins?)";
const JOIN = "\\s*(?:-|–|à|to)\\s*";
const NUM = "(\\d+ \\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?|½)";
const TIME = new RegExp(
  [
    // "2 h 30", "1 h 1/2". The minutes have one or two digits, so "1 h 350 °F" is only 1 h.
    `(\\d+)\\s*h\\s*(\\d{1,2}|1\\/2)(?![\\d/°])`,
    // "1 heure 15 minutes", "1 heure 30", "2 heures et 1/2", "1 hr 15".
    `(\\d+)\\s*${HOURS}\\s*(?:et\\s*)?(\\d{1,2}|1\\/2)(?![\\d/°])(?:\\s*${MINUTES}\\b)?`,
    // "1 heure", "1/2 heure", "7-8 hours", "4 h", "1 heure et demie".
    `${NUM}(?:${JOIN}\\d+(?:[.,]\\d+)?)?\\s*(?:${HOURS}|h)\\b(\\s*(?:et|and)\\s*(?:demie?|a half))?`,
    // "5 à 7 minutes", "25 to 30 minutes", "1 1/2 minute".
    `${NUM}(?:${JOIN}\\d+)?\\s*${MINUTES}\\b`,
  ].join("|"),
  "gi",
);
// A time right after another one, like the end of "2 heures à 2 heures 30", is the end of a range.
const RANGE_GAP = /^\s*(?:-|–|à|to)\s*$/i;
// "remuer toutes les 5 minutes" is how often, not how long.
const EVERY = /(?:toutes les|tous les|every)\s*$/i;

// The times of a step in seconds, at most two. A range gives its first number. Seconds and word
// amounts ("quelques minutes") give no time.
export function stepTimes(text: string): number[] {
  const times: number[] = [];
  let lastEnd = -1;
  for (const m of text.matchAll(TIME)) {
    const gap = lastEnd < 0 ? "" : text.slice(lastEnd, m.index);
    lastEnd = m.index + m[0].length;
    if ((gap && RANGE_GAP.test(gap)) || EVERY.test(text.slice(0, m.index))) continue;
    let seconds: number;
    if (m[1]) seconds = Number(m[1]) * 3600 + (m[2] === "1/2" ? 1800 : Number(m[2]) * 60);
    else if (m[3]) seconds = Number(m[3]) * 3600 + (m[4] === "1/2" ? 1800 : Number(m[4]) * 60);
    else if (m[5]) seconds = Math.round(toNumber(m[5]) * 3600) + (m[6] ? 1800 : 0);
    else seconds = Math.round(toNumber(m[7]) * 60);
    if (seconds > 0 && !times.includes(seconds)) times.push(seconds);
    if (times.length === 2) break;
  }
  return times;
}

export function timeLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

// "4:05" or "1:02:05".
export function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// "45 min", "1 h 30", "8 h".
export function timeLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

// Words that never link an ingredient to a step: units, small words, containers and cuts.
const SKIP = new Set(
  (
    "de du des la le les l d un une et ou en au aux a of the an and or with for to pour avec sans " +
    "tasse cup c cuillere cuilleree the soupe tsp tbsp teaspoon tablespoon ml l litre g kg lb pound oz once ounce " +
    "pincee pinch boite can paquet package pot sachet sac bag conserve bouteille carton tranche slice " +
    "feuille fleuron poitrine demi branche concentre genereuse gros grosse petit petite large small medium " +
    "gousse clove tete head botte bunch bouquet brin sprig trait dash morceau piece " +
    "facultatif optional gout taste environ about total extrait extract very"
  )
    .split(" ")
    .map(stem),
);

// Words that many lines share, like "sauce" in "sauce tomate" and "Verser la sauce", and the
// preparation words. They never are the main word of a line, but they tell two lines apart:
// "tomato sauce" and "diced tomatoes".
const SECONDARY = new Set(
  (
    "sauce pate melange water mixture endes " +
    "hache hachee coupe coupee rape rapee fondu fondue frais fraiche moulu moulue emince emincee " +
    "egoutte egouttee cuit cuite seche fraichement chopped diced minced shredded grated " +
    "fresh freshly cracked ground cooked dried dry yellow white red green black sweet boneless skinless " +
    "frozen canned lean extra virgin ripe"
  )
    .split(" ")
    .map(stem),
);

// "émincées", "émincés" and "émincé" give one word; "tomates" and "tomate" too.
function stem(word: string): string {
  const w = word.length > 3 ? word.replace(/[sx]$/, "") : word;
  return w.length > 4 ? w.replace(/e$/, "") : w;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // "en dés" is a cut, not the article "des".
    .replace(/\ben des\b/g, "endes")
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map(stem);
}

// The words of an ingredient that link it to a step: its main word (the first word after the
// amount, the unit and the preparation words), then its other words of 3 letters or more.
function keyWords(line: string): { main: string | undefined; others: string[] } {
  const amount = readAmount(line);
  const text = (amount ? line.slice(amount.length) : line).replace(/\([^)]*\)/g, " ");
  const kept = words(text).filter((w) => !SKIP.has(w));
  const main = kept.find((w) => !SECONDARY.has(w));
  const others = kept.filter((w) => w !== main && w.length >= 3);
  return { main, others: [...new Set(others)] };
}

// The ingredient lines of a step: the main word is in the step, or two words are. One other word
// alone is too weak: "poulet" in "crème de poulet" is not the chicken. If two lines share a main
// word, the step keeps the one with more words in the step. Two equal lines count once.
export function stepIngredients(step: string, ingredients: string[]): string[] {
  const inStep = new Set(words(step));
  const found: { line: string; main: string | undefined; score: number }[] = [];
  for (const line of ingredients) {
    if (/^#{1,6}\s/.test(line.trim()) || found.some((f) => f.line === line)) continue;
    const { main, others } = keyWords(line);
    const mainHit = main !== undefined && inStep.has(main);
    const hits = others.filter((w) => inStep.has(w)).length + (mainHit ? 1 : 0);
    if (mainHit || hits >= 2) found.push({ line, main, score: hits });
  }
  const best = new Map<string | undefined, number>();
  for (const f of found) best.set(f.main, Math.max(best.get(f.main) ?? 0, f.score));
  return found.filter((f) => f.score === best.get(f.main)).map((f) => f.line);
}
