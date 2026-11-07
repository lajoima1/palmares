import { useRef } from "react";
import { Box, ButtonBase } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { LIST_SEARCH_ID, noFilters, tagLabel, type Filters } from "./filters";
import { CloseIcon } from "./icons";
import { tapArea } from "./tapArea";

// The filters in use, each with a remove button, and "Clear" for all of them.
export function ActiveFilters({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const t = useTheme().herb;
  const box = useRef<HTMLDivElement>(null);
  // After a remove by keyboard (a click with detail 0), the focus goes to the chip now in the same
  // place, else to the search field. A tap does not move the focus, so no phone keyboard opens.
  const refocus = (index: number) =>
    requestAnimationFrame(() => {
      const chips = box.current?.querySelectorAll<HTMLButtonElement>("[data-filter-chip]");
      if (chips && chips.length > 0) chips[Math.min(index, chips.length - 1)].focus();
      else document.getElementById(LIST_SEARCH_ID)?.focus();
    });
  const items = [
    ...filters.tags.map((tag) => ({
      key: `tag:${tag}`,
      label: tagLabel(tag),
      remove: () => onChange({ ...filters, tags: filters.tags.filter((x) => x !== tag) }),
    })),
    ...(filters.difficulty
      ? [{ key: "difficulty", label: filters.difficulty, remove: () => onChange({ ...filters, difficulty: "" }) }]
      : []),
    ...(filters.query.trim()
      ? [{ key: "query", label: `“${filters.query.trim()}”`, remove: () => onChange({ ...filters, query: "" }) }]
      : []),
  ];
  if (items.length === 0) return null;
  return (
    <Box
      ref={box}
      sx={{ px: 1.5, py: 1.25, borderRadius: "16px", bgcolor: t.herbTint, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
    >
      <Box component="span" sx={{ fontSize: 14, fontWeight: 600, color: t.herb }}>
        Active
      </Box>
      {items.map((item, index) => (
        <ButtonBase
          key={item.key}
          data-filter-chip=""
          onClick={(e) => {
            item.remove();
            if (e.detail === 0) refocus(index);
          }}
          aria-label={`Remove filter ${item.label}`}
          sx={{ ...tapArea(32), height: 32, pl: 1.5, pr: 1, borderRadius: 999, bgcolor: t.surface, color: t.ink, fontSize: 13, gap: 0.5 }}
        >
          {item.label}
          <CloseIcon size={16} color={t.ink2} strokeWidth={2.2} />
        </ButtonBase>
      ))}
      <ButtonBase
        onClick={(e) => {
          onChange(noFilters);
          if (e.detail === 0) refocus(0);
        }}
        sx={{ ...tapArea(32), ml: "auto", fontSize: 14, fontWeight: 600, color: t.herb, px: 0.5, minHeight: 32 }}
      >
        Clear
      </ButtonBase>
    </Box>
  );
}
