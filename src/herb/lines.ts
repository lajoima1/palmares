// The same heading rule as parseSimpleMarkdown: a line like "## Pour la sauce:" is a heading.
const HEADING = /^(#{1,6})\s+(.+)$/;

export type Line = { heading: true; text: string } | { heading: false; text: string; number: number };

// Splits a list of ingredients or steps into headings and numbered items. A heading gets no number,
// so the steps after it go on from the last number.
export function toLines(items: string[]): Line[] {
  let number = 0;
  return items.map((item) => {
    const heading = item.trim().match(HEADING);
    if (heading) return { heading: true, text: heading[2].trim().replace(/:\s*$/, "") };
    number += 1;
    return { heading: false, text: item, number };
  });
}
