import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CssBaseline, ThemeProvider, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Recipe } from "../types/Recipe";
import { loadAllRecipesFromDb } from "../utils/recipeDatabase";
import { setLook, useAppearanceMode } from "../look";
import { createHerbTheme } from "../theme/herb";
import { filterRecipes, noFilters, tagCounts, type Filters } from "./filters";
import { FiltersSheet } from "./FiltersPanel";
import { ListPage, type LoadStatus } from "./ListPage";

export default function HerbApp() {
  const { mode } = useAppearanceMode();
  const theme = useMemo(() => createHerbTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Shell />
    </ThemeProvider>
  );
}

function Shell() {
  const desktop = useMediaQuery(useTheme().breakpoints.up("md"));
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const started = useRef(false);

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

  const tags = useMemo(() => tagCounts(recipes), [recipes]);
  const shown = useMemo(() => filterRecipes(recipes, filters), [recipes, filters]);

  return (
    <>
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
        onOpenSettings={() => setLook("old")}
      />
      {!desktop && (
        <FiltersSheet
          open={filtersOpen}
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
