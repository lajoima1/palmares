import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Recipe } from "../types/Recipe";
import { PhotoTile } from "./PhotoTile";
import { DifficultyDot, RecipeLink } from "./parts";
import { shortTime } from "./time";

// A recipe in the 2-column grid of a phone: the photo, the name in two lines at most, the time and
// the difficulty.
export function RecipeTile({ recipe }: { recipe: Recipe }) {
  const t = useTheme().herb;
  const time = shortTime(recipe.total_time);
  const difficulty = recipe.difficulty.trim();
  return (
    <RecipeLink slug={recipe.id} sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <PhotoTile src={recipe.image_url} name={recipe.name} aspectRatio="4 / 5" radius="18px" letterSize={56} />
      <Box
        sx={{
          fontWeight: 600,
          fontSize: 15,
          lineHeight: 1.3,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {recipe.name}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: 13, color: t.ink2 }}>
        {time && <span>{time}</span>}
        {time && difficulty && <span aria-hidden="true">·</span>}
        {difficulty && <DifficultyDot difficulty={difficulty} />}
        {difficulty && <span>{difficulty}</span>}
      </Box>
    </RecipeLink>
  );
}
