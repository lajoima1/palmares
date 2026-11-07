import { describe, expect, it, vi } from "vitest";
import { openList, openRecipe, parseLocation, recipePath, type HistoryLike } from "./router.ts";

describe("parseLocation", () => {
  it("reads the list and a recipe page", () => {
    expect(parseLocation("/", "", "/")).toEqual({ route: { page: "list" } });
    expect(parseLocation("/recipe/pate-chinois", "", "/")).toEqual({
      route: { page: "recipe", slug: "pate-chinois" },
    });
    expect(parseLocation("/recipe/pate-chinois/", "", "/")).toEqual({
      route: { page: "recipe", slug: "pate-chinois" },
    });
  });

  it("forwards an old #/<slug> link to the recipe page", () => {
    expect(parseLocation("/", "#/pate-chinois", "/")).toEqual({
      route: { page: "recipe", slug: "pate-chinois" },
      forward: "/recipe/pate-chinois",
    });
  });

  it("decodes an encoded slug", () => {
    expect(parseLocation("/recipe/p%C3%A2t%C3%A9", "", "/").route).toEqual({ page: "recipe", slug: "pâté" });
    expect(recipePath("pâté", "/")).toBe("/recipe/p%C3%A2t%C3%A9");
  });

  it("gives not found for any other address", () => {
    expect(parseLocation("/menu", "", "/").route).toEqual({ page: "notfound" });
    expect(parseLocation("/recipe/a/b", "", "/").route).toEqual({ page: "notfound" });
    expect(parseLocation("/recipe/%E0%A4%A", "", "/").route).toEqual({ page: "notfound" });
  });

  it("strips the base path", () => {
    expect(parseLocation("/palmares/recipe/x", "", "/palmares/").route).toEqual({ page: "recipe", slug: "x" });
    expect(parseLocation("/palmares/", "#/x", "/palmares/").forward).toBe("/palmares/recipe/x");
  });
});

function fakeHistory(): HistoryLike & { entries: string[] } {
  const entries = ["/"];
  let index = 0;
  const states: unknown[] = [null];
  return {
    entries,
    get state() {
      return states[index];
    },
    pushState(state: unknown, _unused: string, url?: string | URL | null) {
      entries.splice(index + 1);
      states.splice(index + 1);
      entries.push(String(url));
      states.push(state);
      index += 1;
    },
    replaceState(state: unknown, _unused: string, url?: string | URL | null) {
      entries[index] = String(url);
      states[index] = state;
    },
    back() {
      index -= 1;
      entries.splice(index + 1);
    },
  } as HistoryLike & { entries: string[] };
}

describe("the back button of a recipe page", () => {
  it("goes back to the list it came from, with no new entry", () => {
    const history = fakeHistory();
    const done = vi.fn();
    openRecipe("pate-chinois", history, done);
    expect(history.entries).toEqual(["/", "/recipe/pate-chinois"]);
    openList(history, done);
    expect(history.entries).toEqual(["/"]);
  });

  it("replaces the entry after a shared link", () => {
    const history = fakeHistory();
    history.replaceState(null, "", "/recipe/pate-chinois");
    const done = vi.fn();
    openList(history, done);
    expect(history.entries).toEqual([import.meta.env.BASE_URL]);
    expect(done).toHaveBeenCalled();
  });
});
