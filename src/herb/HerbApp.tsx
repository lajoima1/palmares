import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, CssBaseline, ThemeProvider, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Recipe } from "../types/Recipe";
import { loadAllRecipesFromDb } from "../utils/recipeDatabase";
import { useAppearanceMode, type Appearance } from "../look";
import { createHerbTheme } from "../theme/herb";
import { filterRecipes, noFilters, tagCounts, withTag, type Filters } from "./filters";
import { FiltersSheet } from "./FiltersPanel";
import { DesktopHeader, ListPage, type LoadStatus } from "./ListPage";
import { LoadError } from "./ListStates";
import { NotFound } from "./NotFound";
import { RecipeBackBar, RecipePage, RecipeSkeleton } from "./RecipePage";
import { Settings } from "./Settings";
import { openList, useRoute } from "./router";

export default function HerbApp() {
  const { appearance, mode } = useAppearanceMode();
  const theme = useMemo(() => createHerbTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <Shell appearance={appearance} />
    </ThemeProvider>
  );
}

function Shell({ appearance }: { appearance: Appearance }) {
  const desktop = useMediaQuery(useTheme().breakpoints.up("md"));
  const route = useRoute();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const started = useRef(false);
  const listScroll = useRef(0);
  // A search on a desktop recipe page moves to the list once; the list search then takes the focus.
  const leaving = useRef(false);
  const [searchFocus, setSearchFocus] = useState(false);

  const load = useCallback(() => {
    setStatus("loading");
    loadAllRecipesFromDb()
      .then((loaded) => {
        setRecipes(loaded as Recipe[]);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Error loading recipes:", err);
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    // StrictMode runs effects twice in development; load recipes.db once.
    if (started.current) return;
    started.current = true;
    load();
  }, [load]);

  // The app restores the scroll of the list itself; the browser would restore it too early.
  useEffect(() => {
    history.scrollRestoration = "manual";
  }, []);

  // Remember the scroll of the list while it shows, so Back returns to the same place.
  useEffect(() => {
    if (route.page !== "list") return;
    const save = () => {
      listScroll.current = window.scrollY;
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [route.page]);

  useLayoutEffect(() => {
    window.scrollTo(0, route.page === "list" ? listScroll.current : 0);
    if (route.page === "list") leaving.current = false;
  }, [route]);

  const tags = useMemo(() => tagCounts(recipes), [recipes]);
  const shown = useMemo(() => filterRecipes(recipes, filters), [recipes, filters]);
  const recipe = route.page === "recipe" ? recipes.find((r) => r.id === route.slug) : undefined;

  useEffect(() => {
    document.title = recipe ? `${recipe.name} · Palmarès` : "Palmarès";
  }, [recipe]);

  const openSettings = (anchor: HTMLElement) => setSettingsAnchor(anchor);
  // A tag on a recipe page opens the list with that tag added.
  const showTag = (tag: string) => {
    setFilters((f) => withTag(f, tag));
    listScroll.current = 0;
    openList();
  };
  const clearSearchFocus = useCallback(() => setSearchFocus(false), []);
  // Only the desktop list takes the search focus; a phone layout drops the request.
  useEffect(() => {
    if (!desktop) setSearchFocus(false);
  }, [desktop]);
  const searchFromRecipe = (query: string) => {
    setFilters((f) => ({ ...f, query }));
    if (leaving.current) return;
    leaving.current = true;
    listScroll.current = 0;
    setSearchFocus(true);
    openList();
  };

  let page = null;
  if (route.page === "notfound" || (route.page === "recipe" && status === "ready" && !recipe)) {
    page = <NotFound onList={() => openList()} />;
  } else if (route.page === "recipe") {
    const header = desktop ? (
      <DesktopHeader query={filters.query} onQuery={searchFromRecipe} onOpenSettings={openSettings} onHome={() => openList()} />
    ) : undefined;
    if (recipe) {
      page = <RecipePage recipe={recipe} desktop={desktop} onBack={() => openList()} onTag={showTag} header={header} />;
    } else if (status === "error") {
      page = (
        <>
          {header}
          <RecipeBackBar desktop={desktop} onBack={() => openList()} />
          <Box sx={{ p: 2.5, pt: 4 }}>
            <LoadError onRetry={load} />
          </Box>
        </>
      );
    } else {
      page = (
        <>
          {header}
          <RecipeSkeleton desktop={desktop} onBack={() => openList()} />
        </>
      );
    }
  }

  return (
    <>
      {/* The list stays mounted under a recipe page, so its search, filters and photos stay. */}
      <Box sx={{ display: page ? "none" : "block" }}>
        <ListPage
          desktop={desktop}
          status={status}
          recipes={recipes}
          shown={shown}
          tags={tags}
          filters={filters}
          onFilters={setFilters}
          onRetry={load}
          onOpenFilters={() => setFiltersOpen(true)}
          onOpenSettings={openSettings}
          focusSearch={searchFocus}
          onSearchFocused={clearSearchFocus}
          visible={!page}
        />
      </Box>
      {page}
      <Settings desktop={desktop} anchor={settingsAnchor} appearance={appearance} onClose={() => setSettingsAnchor(null)} />
      {!desktop && (
        <FiltersSheet
          open={filtersOpen && !page}
          onClose={() => setFiltersOpen(false)}
          filters={filters}
          onChange={setFilters}
          tags={tags}
          resultCount={shown.length}
        />
      )}
    </>
  );
}
