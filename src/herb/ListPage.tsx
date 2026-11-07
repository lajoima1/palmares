import { useEffect, useRef } from "react";
import { Box, ButtonBase, IconButton, InputBase } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Recipe } from "../types/Recipe";
import { headingFont } from "../theme/herb";
import { ActiveFilters } from "./ActiveFilters";
import { FiltersColumn } from "./FiltersPanel";
import { LIST_SEARCH_ID, filterCount, isFiltered, noFilters, tagLabel, toggleTag, withTag, type Filters } from "./filters";
import { FilterIcon, GearIcon, Mark, SearchIcon } from "./icons";
import { LoadError, LoadingGrid, NothingMatches } from "./ListStates";
import { RecipeCard } from "./RecipeCard";
import { RecipeTile } from "./RecipeTile";
import { tapArea } from "./tapArea";

export type LoadStatus = "loading" | "error" | "ready";

interface ListPageProps {
  desktop: boolean;
  status: LoadStatus;
  recipes: Recipe[];
  shown: Recipe[];
  tags: { tag: string; count: number }[];
  filters: Filters;
  onFilters: (f: Filters) => void;
  onRetry: () => void;
  onOpenFilters: () => void;
  onOpenSettings: (anchor: HTMLElement) => void;
  // True after a search on a recipe page moves to the list: the list search takes the focus once
  // the list shows, then calls onSearchFocused.
  focusSearch: boolean;
  onSearchFocused: () => void;
  visible: boolean;
}

function SettingsButton({ onOpen }: { onOpen: (anchor: HTMLElement) => void }) {
  const t = useTheme().herb;
  return (
    <IconButton
      aria-label="Settings"
      onClick={(e) => onOpen(e.currentTarget)}
      sx={{ width: 44, height: 44, border: `1px solid ${t.line}`, bgcolor: t.surface, flexShrink: 0, "&:hover": { bgcolor: t.surface } }}
    >
      <GearIcon color={t.ink} />
    </IconButton>
  );
}

interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  height: number;
  id?: string;
  focus?: boolean;
  onFocused?: () => void;
}

function SearchField({ value, onChange, placeholder, height, id, focus = false, onFocused }: SearchFieldProps) {
  const t = useTheme().herb;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = input.current;
    if (!el || !focus) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    onFocused?.();
  }, [focus, onFocused]);
  return (
    <Box
      component="label"
      sx={{
        flexGrow: 1,
        height,
        borderRadius: 999,
        bgcolor: t.surface,
        border: `1px solid ${t.line}`,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 2.25,
        boxSizing: "border-box",
        "&:focus-within": { borderColor: t.herb, boxShadow: `0 0 0 3px ${t.herbTint}` },
      }}
    >
      <SearchIcon color={t.ink2} />
      <InputBase
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputRef={input}
        inputProps={{ "aria-label": "Search recipes", id }}
        sx={{ flexGrow: 1, fontSize: 16, color: t.ink }}
      />
    </Box>
  );
}

export function ListPage(props: ListPageProps) {
  return props.desktop ? <DesktopList {...props} /> : <PhoneList {...props} />;
}

function Results({ desktop, status, recipes, shown, filters, onFilters, onRetry }: ListPageProps) {
  if (status === "loading") return <LoadingGrid desktop={desktop} />;
  if (status === "error") return <LoadError onRetry={onRetry} />;
  if (recipes.length > 0 && shown.length === 0) {
    const parts = [filters.query.trim() && `“${filters.query.trim()}”`, ...filters.tags.map(tagLabel), filters.difficulty].filter(Boolean);
    return <NothingMatches summary={`Nothing matches ${parts.join(", ")}.`} onClear={() => onFilters(noFilters)} />;
  }
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: desktop ? "repeat(auto-fill, minmax(250px, 1fr))" : "repeat(2, minmax(0, 1fr))",
        gap: desktop ? "32px 20px" : "16px 12px",
      }}
    >
      {shown.map((r) =>
        desktop ? <RecipeCard key={r.id} recipe={r} onTag={(tag) => onFilters(withTag(filters, tag))} /> : <RecipeTile key={r.id} recipe={r} />,
      )}
    </Box>
  );
}

function Heading(props: ListPageProps) {
  const t = useTheme().herb;
  const { status, recipes, shown, filters, desktop } = props;
  if (status !== "ready" || (recipes.length > 0 && shown.length === 0)) return null;
  const filtered = isFiltered(filters);
  const count = filtered ? `${shown.length} ${shown.length === 1 ? "recipe" : "recipes"}` : `${recipes.length}`;
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <Box component="h2" sx={{ m: 0, fontFamily: headingFont, fontWeight: 700, fontSize: desktop ? 24 : 22, letterSpacing: "-0.01em" }}>
        {filtered ? "Results" : "All recipes"}
      </Box>
      <Box component="span" sx={{ fontSize: desktop ? 15 : 14, color: t.ink2 }}>
        {desktop && !filtered ? `${count} recipes` : count}
      </Box>
    </Box>
  );
}

function PhoneList(props: ListPageProps) {
  const t = useTheme().herb;
  const { recipes, tags, filters, onFilters, onOpenFilters, onOpenSettings } = props;
  const badge = filterCount(filters);
  return (
    <Box sx={{ pb: 4 }}>
      <Box component="header" sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2.5, pt: 2.5, pb: 0.5 }}>
        <Mark />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box component="h1" sx={{ m: 0, fontFamily: headingFont, fontWeight: 800, fontSize: 26, lineHeight: 1, letterSpacing: "-0.02em" }}>
            Palmarès
          </Box>
          <Box sx={{ fontSize: 13, color: t.ink2, mt: 0.5 }}>Les recettes de la famille</Box>
        </Box>
        <SettingsButton onOpen={onOpenSettings} />
      </Box>

      <Box sx={{ px: 2.5, pt: 2, display: "flex", gap: 1.25 }}>
        <SearchField
          value={filters.query}
          onChange={(query) => onFilters({ ...filters, query })}
          placeholder={recipes.length ? `Search ${recipes.length} recipes` : "Search recipes"}
          height={52}
          id={LIST_SEARCH_ID}
        />
        <IconButton
          aria-label={badge ? `Filters, ${badge} on` : "Filters"}
          onClick={onOpenFilters}
          sx={{ width: 52, height: 52, bgcolor: t.ink, flexShrink: 0, position: "relative", "&:hover": { bgcolor: t.ink } }}
        >
          <FilterIcon color={t.ground} />
          {badge > 0 && (
            <Box
              component="span"
              sx={{
                position: "absolute",
                top: -2,
                right: -2,
                minWidth: 20,
                height: 20,
                borderRadius: 999,
                bgcolor: t.saffron,
                color: t.onSaffron,
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${t.ground}`,
              }}
            >
              {badge}
            </Box>
          )}
        </IconButton>
      </Box>

      {/* The row scrolls sideways; pb leaves room for the 44 px tap area of the chips (tapArea). */}
      <Box sx={{ display: "flex", gap: 1, px: 2.5, pt: 2, pb: 0.75, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
        {[{ tag: "", count: recipes.length }, ...tags].map(({ tag }) => {
          const on = tag === "" ? filters.tags.length === 0 : filters.tags.includes(tag);
          return (
            <ButtonBase
              key={tag === "" ? "all-tags" : `tag:${tag}`}
              aria-pressed={on}
              onClick={() => onFilters(tag === "" ? { ...filters, tags: [] } : toggleTag(filters, tag))}
              sx={{
                ...tapArea(36),
                flexShrink: 0,
                height: 36,
                px: 2,
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 500,
                border: `1px solid ${on ? t.ink : t.line}`,
                bgcolor: on ? t.ink : t.surface,
                color: on ? t.ground : t.ink,
              }}
            >
              {tag === "" ? "All" : tagLabel(tag)}
            </ButtonBase>
          );
        })}
      </Box>

      <Box sx={{ px: 2.5, pt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <ActiveFilters filters={filters} onChange={onFilters} />
        <Heading {...props} />
        <Results {...props} />
      </Box>
    </Box>
  );
}

// The top bar of a desktop page: the mark, the search and the settings button. On a recipe page,
// the mark and a search go back to the list.
interface DesktopHeaderProps {
  query: string;
  onQuery: (q: string) => void;
  onOpenSettings: (anchor: HTMLElement) => void;
  onHome?: () => void;
  searchId?: string;
  focusSearch?: boolean;
  onSearchFocused?: () => void;
}

export function DesktopHeader({ query, onQuery, onOpenSettings, onHome, searchId, focusSearch, onSearchFocused }: DesktopHeaderProps) {
  const t = useTheme().herb;
  const brand = (
    <>
      <Mark />
      <Box component="span" sx={{ fontFamily: headingFont, fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em" }}>
        Palmarès
      </Box>
    </>
  );
  return (
    <Box component="header" sx={{ borderBottom: `1px solid ${t.line}`, bgcolor: t.surface }}>
      <Box sx={{ maxWidth: 1240, mx: "auto", px: 4, py: 2, display: "flex", alignItems: "center", gap: 3 }}>
        {onHome ? (
          <ButtonBase onClick={onHome} aria-label="Palmarès, all recipes" sx={{ gap: 1.5, borderRadius: "12px" }}>
            {brand}
          </ButtonBase>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>{brand}</Box>
        )}
        <Box sx={{ flex: "1 1 320px", maxWidth: 560, mx: "auto", display: "flex" }}>
          <SearchField
            value={query}
            onChange={onQuery}
            placeholder="Search by name, ingredient or description"
            height={48}
            id={searchId}
            focus={focusSearch}
            onFocused={onSearchFocused}
          />
        </Box>
        <SettingsButton onOpen={onOpenSettings} />
      </Box>
    </Box>
  );
}

function DesktopList(props: ListPageProps) {
  const t = useTheme().herb;
  const { recipes, tags, filters, onFilters, onOpenSettings, status } = props;
  return (
    <Box sx={{ pb: 8 }}>
      <DesktopHeader
        query={filters.query}
        onQuery={(query) => onFilters({ ...filters, query })}
        onOpenSettings={onOpenSettings}
        searchId={LIST_SEARCH_ID}
        focusSearch={props.focusSearch && props.visible}
        onSearchFocused={props.onSearchFocused}
      />

      <Box sx={{ maxWidth: 1240, mx: "auto", px: 4, pt: 5, pb: 3 }}>
        <Box component="h1" sx={{ m: 0, fontFamily: headingFont, fontWeight: 800, fontSize: 48, lineHeight: 1.05, letterSpacing: "-0.025em" }}>
          Les recettes de la famille
        </Box>
        <Box component="p" sx={{ m: "12px 0 0", fontSize: 17, color: t.ink2, maxWidth: 620, lineHeight: 1.5 }}>
          Une collection de recettes accumulées au fil des générations et testées dans notre cuisine familiale.
        </Box>
      </Box>

      <Box sx={{ maxWidth: 1240, mx: "auto", px: 4, display: "flex", gap: 4, alignItems: "flex-start" }}>
        <Box sx={{ flex: "0 0 240px" }}>
          {status === "ready" && <FiltersColumn filters={filters} onChange={onFilters} tags={tags} total={recipes.length} />}
        </Box>
        <Box component="main" sx={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <ActiveFilters filters={filters} onChange={onFilters} />
          <Heading {...props} />
          <Results {...props} />
        </Box>
      </Box>
    </Box>
  );
}
