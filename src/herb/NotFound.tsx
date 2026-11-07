import { Box, Button, ButtonBase } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { headingFont } from "../theme/herb";
import { BookIcon, Mark } from "./icons";

// An address with no recipe: a renamed or removed recipe, or a mistyped link.
export function NotFound({ onList }: { onList: () => void }) {
  const t = useTheme().herb;
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Box component="header" sx={{ p: 2.5, maxWidth: 1240, width: "100%", mx: "auto", boxSizing: "border-box" }}>
        <ButtonBase onClick={onList} aria-label="Palmarès, all recipes" sx={{ gap: 1.5, borderRadius: "12px" }}>
          <Mark />
          <Box component="span" sx={{ fontFamily: headingFont, fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em" }}>
            Palmarès
          </Box>
        </ButtonBase>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, px: 4, pb: 15, textAlign: "center" }}>
        <Box sx={{ width: 96, height: 96, borderRadius: "50%", bgcolor: t.saffronTint, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BookIcon size={44} color={t.saffronInk} strokeWidth={1.8} />
        </Box>
        <Box component="h1" sx={{ m: 0, fontFamily: headingFont, fontWeight: 800, fontSize: 30, lineHeight: 1.1 }}>
          This recipe is not here
        </Box>
        <Box component="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.55, color: t.ink2, maxWidth: 360 }}>
          The link points to a recipe that was renamed or removed.
        </Box>
        <Button variant="contained" size="large" onClick={onList} sx={{ mt: 1, minHeight: 52, px: 3.5 }}>
          See all recipes
        </Button>
      </Box>
    </Box>
  );
}
