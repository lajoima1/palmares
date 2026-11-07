import { Box, Button } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { headingFont } from "../theme/herb";
import { OfflineIcon, SearchMinusIcon } from "./icons";

// Grey tiles in the place of the recipes while recipes.db loads.
export function LoadingGrid({ desktop }: { desktop: boolean }) {
  const t = useTheme().herb;
  const count = desktop ? 8 : 4;
  return (
    <Box
      role="status"
      aria-label="Loading recipes"
      sx={{
        display: "grid",
        gridTemplateColumns: desktop ? "repeat(auto-fill, minmax(250px, 1fr))" : "repeat(2, minmax(0, 1fr))",
        gap: desktop ? "32px 20px" : "16px 12px",
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Box key={i} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ width: "100%", aspectRatio: desktop ? "4 / 3" : "4 / 5", borderRadius: "18px", bgcolor: t.skeleton }} />
          <Box sx={{ height: 14, width: "80%", borderRadius: 1, bgcolor: t.skeleton }} />
          <Box sx={{ height: 12, width: "50%", borderRadius: 1, bgcolor: t.skeleton }} />
        </Box>
      ))}
    </Box>
  );
}

function Panel({ icon, iconBg, title, children, action }: { icon: ReactNode; iconBg: string; title: string; children: ReactNode; action: ReactNode }) {
  const t = useTheme().herb;
  return (
    <Box
      sx={{
        p: { xs: "32px 24px", md: "48px 32px" },
        borderRadius: "24px",
        bgcolor: t.surface,
        border: `1px solid ${t.line}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        textAlign: "center",
        maxWidth: 560,
        mx: "auto",
      }}
    >
      <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </Box>
      <Box component="h2" sx={{ m: 0, fontFamily: headingFont, fontWeight: 700, fontSize: 22 }}>
        {title}
      </Box>
      <Box component="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.5, color: t.ink2 }}>
        {children}
      </Box>
      <Box sx={{ mt: 1 }}>{action}</Box>
    </Box>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTheme().herb;
  return (
    <Panel
      icon={<OfflineIcon size={30} color={t.error} />}
      iconBg={t.errorTint}
      title="The recipes did not load"
      action={
        <Button variant="contained" onClick={onRetry} sx={{ bgcolor: t.ink, color: t.ground, "&:hover": { bgcolor: t.ink } }}>
          Try again
        </Button>
      }
    >
      Check the connection, then try again.
    </Panel>
  );
}

export function NothingMatches({ summary, onClear }: { summary: string; onClear: () => void }) {
  const t = useTheme().herb;
  return (
    <Panel
      icon={<SearchMinusIcon size={30} color={t.herb} />}
      iconBg={t.herbTint}
      title="No recipe matches"
      action={
        <Button variant="contained" onClick={onClear}>
          Clear search and filters
        </Button>
      }
    >
      {summary} Try another word, or clear the filters.
    </Panel>
  );
}
