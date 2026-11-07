import type { Recipe } from "../types/Recipe";

export interface Filters {
  query: string;
  tags: string[];
  difficulty: string;
}

export const noFilters: Filters = { query: "", tags: [], difficulty: "" };

// The rules of the old look: the text matches the name, the description or an ingredient; each
// chosen tag must be on the recipe; one difficulty or all.
export function filterRecipes(recipes: Recipe[], { query, tags, difficulty }: Filters): Recipe[] {
  const q = query.trim().toLowerCase();
  return recipes.filter(
    (r) =>
      (q === "" ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.toLowerCase().includes(q))) &&
      tags.every((t) => r.tags.includes(t)) &&
      (difficulty === "" || r.difficulty === difficulty),
  );
}

export function isFiltered({ query, tags, difficulty }: Filters): boolean {
  return query.trim() !== "" || tags.length > 0 || difficulty !== "";
}

// The number of active filters on the filters button: each tag and the difficulty.
export function filterCount({ tags, difficulty }: Filters): number {
  return tags.length + (difficulty ? 1 : 0);
}

// Tags by use, most used first, then by name.
export function tagCounts(recipes: Recipe[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of recipes) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function difficultyCounts(recipes: Recipe[]): Record<string, number> {
  const counts: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 };
  for (const r of recipes) if (r.difficulty in counts) counts[r.difficulty] += 1;
  return counts;
}

export function toggleTag(filters: Filters, tag: string): Filters {
  const tags = filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag];
  return { ...filters, tags };
}

export function withTag(filters: Filters, tag: string): Filters {
  return filters.tags.includes(tag) ? filters : { ...filters, tags: [...filters.tags, tag] };
}

// Tags are stored in lower case ("made by mom"); the new look shows the first letter in capitals.
export function tagLabel(tag: string): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}
