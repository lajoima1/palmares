// "45 minutes" → "45 min"; "1 heure 5 minutes" → "1 h 05"; "1 hour" → "1 h"; "2 h 30" → "2 h 30".
// A range ("30 to 35 minutes", "10 à 15 minutes") or any other text stays as written.
const MINUTES = /^(\d+)\s*(?:minutes?|min)$/i;
const HOURS = /^(\d+)\s*(?:h|hours?|heures?)(?:\s+(\d+)(?:\s*(?:minutes?|min))?)?$/i;

export function shortTime(text: string): string {
  const value = text.trim();
  const minutes = value.match(MINUTES);
  if (minutes) return `${Number(minutes[1])} min`;
  const hours = value.match(HOURS);
  if (hours) {
    const h = Number(hours[1]);
    return hours[2] === undefined ? `${h} h` : `${h} h ${hours[2].padStart(2, "0")}`;
  }
  return value;
}
