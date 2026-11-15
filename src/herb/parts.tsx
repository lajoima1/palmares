import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Fragment, type MouseEvent, type ReactNode } from "react";
import { difficultyColor } from "../theme/herb";
import { parseSimpleMarkdown } from "../utils/simpleMarkdown";
import type { Part } from "./scale";
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

// An ingredient line at a factor. Each amount uses the fractions of Inter ("1 1/2" shows as 1½);
// the text stays "1 1/2" for a copy. A scaled amount is bold and in the herb colour too.
export function ScaledText({ parts }: { parts: Part[] }) {
  const t = useTheme().herb;
  return (
    <>
      {parts.map((p, i) =>
        p.amount ? (
          <Box
            key={i}
            component={p.scaled ? "b" : "span"}
            sx={{ fontFeatureSettings: "'frac' 1", ...(p.scaled && { fontWeight: 700, color: t.herb }) }}
          >
            {p.text}
          </Box>
        ) : (
          <Fragment key={i}>{parseSimpleMarkdown(p.text)}</Fragment>
        ),
      )}
    </>
  );
}
