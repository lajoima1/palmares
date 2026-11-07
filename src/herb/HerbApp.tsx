import { useMemo } from "react";
import { Box, CssBaseline, IconButton, ThemeProvider, Typography } from "@mui/material";
import { setLook, useAppearanceMode } from "../look";
import { createHerbTheme } from "../theme/herb";
import { Mark } from "./icons";

export default function HerbApp() {
  const { mode } = useAppearanceMode();
  const theme = useMemo(() => createHerbTheme(mode), [mode]);
  const t = theme.herb;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box component="header" sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2.5, pt: 2.5 }}>
        <Mark />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h4" component="div" sx={{ fontSize: 26, lineHeight: 1 }}>
            Palmarès
          </Typography>
          <Typography sx={{ fontSize: 13, color: t.ink2, mt: 0.5 }}>Les recettes de la famille</Typography>
        </Box>
        <IconButton aria-label="Old look" onClick={() => setLook("old")} sx={{ border: `1px solid ${t.line}` }}>
          <Typography sx={{ fontSize: 12 }}>Old</Typography>
        </IconButton>
      </Box>
    </ThemeProvider>
  );
}
