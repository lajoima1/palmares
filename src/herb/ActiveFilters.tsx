import { Box, ButtonBase } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { noFilters, tagLabel, type Filters } from "./filters";
import { CloseIcon } from "./icons";

// The filters in use, each with a remove button, and "Clear" for all of them.
export function ActiveFilters({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const t = useTheme().herb;
  const items = [
    ...filters.tags.map((tag) => ({
      label: tagLabel(tag),
      remove: () => onChange({ ...filters, tags: filters.tags.filter((x) => x !== tag) }),
    })),
    ...(filters.difficulty
      ? [{ label: filters.difficulty, remove: () => onChange({ ...filters, difficulty: "" }) }]
      : []),
    ...(filters.query.trim()
      ? [{ label: `“${filters.query.trim()}”`, remove: () => onChange({ ...filters, query: "" }) }]
      : []),
  ];
  if (items.length === 0) return null;
  return (
    <Box
      sx={{ px: 1.5, py: 1.25, borderRadius: "16px", bgcolor: t.herbTint, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
    >
      <Box component="span" sx={{ fontSize: 14, fontWeight: 600, color: t.herb }}>
        Active
      </Box>
      {items.map((item) => (
        <ButtonBase
          key={item.label}
          onClick={item.remove}
          aria-label={`Remove filter ${item.label}`}
          sx={{ height: 32, pl: 1.5, pr: 1, borderRadius: 999, bgcolor: t.surface, color: t.ink, fontSize: 13, gap: 0.5 }}
        >
          {item.label}
          <CloseIcon size={16} color={t.ink2} strokeWidth={2.2} />
        </ButtonBase>
      ))}
      <ButtonBase
        onClick={() => onChange(noFilters)}
        sx={{ ml: "auto", fontSize: 14, fontWeight: 600, color: t.herb, px: 0.5, minHeight: 32 }}
      >
        Clear
      </ButtonBase>
    </Box>
  );
}
