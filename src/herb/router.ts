import { useEffect, useState } from "react";

export type Route = { page: "list" } | { page: "recipe"; slug: string } | { page: "notfound" };

// The page that an address shows. `forward` is set for an old link (#/<slug>): the address to
// put in its place.
export function parseLocation(
  pathname: string,
  hash: string,
  base: string = import.meta.env.BASE_URL,
): { route: Route; forward?: string } {
  const path = pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname;
  if (path === "/" || path === "") {
    const old = hash.match(/^#\/(.+)$/);
    if (old) return { route: { page: "recipe", slug: old[1] }, forward: recipePath(old[1], base) };
    return { route: { page: "list" } };
  }
  const recipe = path.match(/^\/recipe\/([^/]+)\/?$/);
  if (recipe) {
    try {
      return { route: { page: "recipe", slug: decodeURIComponent(recipe[1]) } };
    } catch {
      return { route: { page: "notfound" } };
    }
  }
  return { route: { page: "notfound" } };
}

export function recipePath(slug: string, base: string = import.meta.env.BASE_URL): string {
  return `${base}recipe/${encodeURIComponent(slug)}`;
}

export type HistoryLike = Pick<History, "state" | "pushState" | "replaceState" | "back">;

const CHANGE = "routechange";

function notify() {
  window.dispatchEvent(new Event(CHANGE));
}

// A recipe opened from the list marks its entry, so the page's back button can go back instead of
// adding the list as a new entry (then the phone's Back would open the recipe again).
export function openRecipe(slug: string, history: HistoryLike = window.history, done = notify): void {
  history.pushState({ fromList: true }, "", recipePath(slug));
  done();
}

export function openList(history: HistoryLike = window.history, done = notify): void {
  if (history.state?.fromList) {
    history.back();
    return;
  }
  history.replaceState(null, "", import.meta.env.BASE_URL);
  done();
}

function current(): Route {
  const { route, forward } = parseLocation(window.location.pathname, window.location.hash);
  if (forward) window.history.replaceState(null, "", forward);
  return route;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const update = () => setRoute(current());
    window.addEventListener("popstate", update);
    window.addEventListener(CHANGE, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(CHANGE, update);
    };
  }, []);
  return route;
}
