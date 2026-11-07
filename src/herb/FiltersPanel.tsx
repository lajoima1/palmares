import { Box, Button, ButtonBase, Drawer } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { headingFont } from "../theme/herb";
import { noFilters, tagLabel, toggleTag, type Filters } from "./filters";
import { tapArea } from "./tapArea";

const LEVELS = ["Any", "Easy", "Medium", "Hard"];

interface FilterControlsProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  tags: { tag: string; count: number }[];
}

function SectionLabel({ children }: { children: string }) {
  const t = useTheme().herb;
  return (
    <Box component="span" sx={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: t.ink2 }}>
      {children}
    </Box>
  );
}

// Any, Easy, Medium, Hard as one segmented control.
function DifficultyChoice({ filters, onChange }: Omit<FilterControlsProps, "tags">) {
  const t = useTheme().herb;
  return (
    <Box role="radiogroup" aria-label="Difficulty" sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.5, bgcolor: t.ground, p: 0.5, borderRadius: "16px" }}>
      {LEVELS.map((label) => {
        const value = label === "Any" ? "" : label;
        const on = filters.difficulty === value;
        return (
          <ButtonBase
            key={label}
            role="radio"
            aria-checked={on}
            onClick={() => onChange({ ...filters, difficulty: value })}
            sx={{
              height: 44,
              borderRadius: "12px",
              fontSize: 15,
              fontWeight: 600,
              bgcolor: on ? t.surface : "transparent",
              color: on ? t.ink : t.ink2,
              boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

function TagChoice({ filters, onChange, tags }: FilterControlsProps) {
  const t = useTheme().herb;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {tags.map(({ tag, count }) => {
        const on = filters.tags.includes(tag);
        return (
          <ButtonBase
            key={tag}
            aria-pressed={on}
            onClick={() => onChange(toggleTag(filters, tag))}
            sx={{
              ...tapArea(40),
              height: 40,
              px: 1.75,
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 500,
              gap: 0.75,
              border: `1px solid ${on ? t.ink : t.line}`,
              bgcolor: on ? t.ink : t.surface,
              color: on ? t.ground : t.ink,
            }}
          >
            {tagLabel(tag)}
            <Box component="span" sx={{ fontSize: 12, opacity: 0.75 }}>
              {count}
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

// The filters on a phone: a sheet from the bottom.
export function FiltersSheet({ open, onClose, filters, onChange, tags, resultCount }: FilterControlsProps & { open: boolean; onClose: () => void; resultCount: number }) {
  const t = useTheme().herb;
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} slotProps={{ paper: { sx: { bgcolor: t.surface, maxHeight: "88vh" } } }}>
      {/* The tags scroll; the button to show the recipes stays at the bottom of the sheet. */}
      <Box component="section" aria-label="Filters" sx={{ p: "12px 20px 24px", display: "flex", flexDirection: "column", gap: 2.5, maxHeight: "88vh", boxSizing: "border-box" }}>
        <Box sx={{ width: 40, height: 5, borderRadius: 3, bgcolor: t.line, alignSelf: "center" }} aria-hidden="true" />
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box component="h2" sx={{ m: 0, fontFamily: headingFont, fontWeight: 700, fontSize: 24 }}>
            Filters
          </Box>
          <ButtonBase onClick={() => onChange({ ...noFilters, query: filters.query })} sx={{ fontSize: 15, fontWeight: 600, color: t.herb, minHeight: 44, px: 0.5 }}>
            Clear all
          </ButtonBase>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
          <SectionLabel>Difficulty</SectionLabel>
          <DifficultyChoice filters={filters} onChange={onChange} />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, overflowY: "auto", minHeight: 0, flex: "1 1 auto" }}>
          <SectionLabel>Tags</SectionLabel>
          <TagChoice filters={filters} onChange={onChange} tags={tags} />
        </Box>
        <Button variant="contained" size="large" onClick={onClose} sx={{ minHeight: 56, fontSize: 16, flexShrink: 0 }}>
          {resultCount === 1 ? "Show 1 recipe" : `Show ${resultCount} recipes`}
        </Button>
      </Box>
    </Drawer>
  );
}

// The filters on a desktop: a column at the left of the grid.
export function FiltersColumn({ filters, onChange, tags, total }: FilterControlsProps & { total: number }) {
  const t = useTheme().herb;
  const row = (label: string, count: number, on: boolean, onClick: () => void) => (
    <ButtonBase
      key={label}
      aria-pressed={on}
      onClick={onClick}
      sx={{
        ...tapArea(40),
        height: 40,
        px: 1.5,
        borderRadius: "12px",
        fontSize: 15,
        justifyContent: "space-between",
        bgcolor: on ? t.herbTint : "transparent",
        color: on ? t.herb : t.ink,
        fontWeight: on ? 600 : 400,
      }}
    >
      <span>{label}</span>
      <Box component="span" sx={{ fontSize: 13, color: t.ink2 }}>
        {count}
      </Box>
    </ButtonBase>
  );
  return (
    <Box component="aside" aria-label="Filters" sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        <SectionLabel>Difficulty</SectionLabel>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {LEVELS.map((label) => {
            const value = label === "Any" ? "" : label;
            const on = filters.difficulty === value;
            return (
              <ButtonBase
                key={label}
                aria-pressed={on}
                onClick={() => onChange({ ...filters, difficulty: value })}
                sx={{
                  ...tapArea(36),
                  height: 36,
                  px: 1.75,
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                  border: `1px solid ${on ? t.ink : t.line}`,
                  bgcolor: on ? t.ink : t.surface,
                  color: on ? t.ground : t.ink,
                }}
              >
                {label}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Box sx={{ mb: 0.75 }}>
          <SectionLabel>Tags</SectionLabel>
        </Box>
        {row("All", total, filters.tags.length === 0, () => onChange({ ...filters, tags: [] }))}
        {tags.map(({ tag, count }) => row(tagLabel(tag), count, filters.tags.includes(tag), () => onChange(toggleTag(filters, tag))))}
      </Box>
    </Box>
  );
}
