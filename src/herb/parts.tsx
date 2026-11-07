import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { MouseEvent, ReactNode } from "react";
import { difficultyColor } from "../theme/herb";
import { openRecipe, recipePath } from "./router";

export function DifficultyDot({ difficulty, size = 7 }: { difficulty: string; size?: number }) {
  const t = useTheme().herb;
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{ width: size, height: size, borderRadius: "50%", bgcolor: difficultyColor(t, difficulty), flexShrink: 0 }}
    />
  );
}

// A real link, so a long press or a middle click works; a plain click stays in the app.
export function RecipeLink({ slug, children, sx }: { slug: string; children: ReactNode; sx?: object }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openRecipe(slug);
  };
  return (
    <Box component="a" href={recipePath(slug)} onClick={onClick} sx={{ color: "inherit", textDecoration: "none", ...sx }}>
      {children}
    </Box>
  );
}
