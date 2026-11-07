import { Box, ButtonBase } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Recipe } from "../types/Recipe";
import { PhotoTile } from "./PhotoTile";
import { tagLabel } from "./filters";
import { DifficultyDot, RecipeLink } from "./parts";
import { shortTime } from "./time";

// A recipe in the desktop grid: the photo, the name, two lines of description, the time, the
// servings, the difficulty, and up to three tags that add a filter.
export function RecipeCard({ recipe, onTag }: { recipe: Recipe; onTag: (tag: string) => void }) {
  const t = useTheme().herb;
  const time = shortTime(recipe.total_time);
  const difficulty = recipe.difficulty.trim();
  const meta = [time, recipe.servings.trim()].filter(Boolean);
  return (
    <Box component="article" sx={{ display: "flex", flexDirection: "column", gap: 1.25, minWidth: 0 }}>
      <RecipeLink slug={recipe.id} sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        <PhotoTile src={recipe.image_url} name={recipe.name} aspectRatio="4 / 3" radius="18px" letterSize={64} />
        <Box sx={{ fontWeight: 600, fontSize: 17, lineHeight: 1.3 }}>{recipe.name}</Box>
        {recipe.description && (
          <Box
            sx={{
              fontSize: 14,
              lineHeight: 1.45,
              color: t.ink2,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {recipe.description}
          </Box>
        )}
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.75, fontSize: 14, color: t.ink2 }}>
          {meta.map((m, i) => (
            <Box component="span" key={i} sx={{ display: "flex", gap: 0.75 }}>
              {i > 0 && <span aria-hidden="true">·</span>}
              <span>{m}</span>
            </Box>
          ))}
          {difficulty && meta.length > 0 && <span aria-hidden="true">·</span>}
          {difficulty && <DifficultyDot difficulty={difficulty} />}
          {difficulty && <span>{difficulty}</span>}
        </Box>
      </RecipeLink>
      {recipe.tags.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
          {recipe.tags.slice(0, 3).map((tag) => (
            <ButtonBase
              key={tag}
              onClick={() => onTag(tag)}
              sx={{ height: 28, px: 1.25, borderRadius: 999, fontSize: 12, fontWeight: 600, color: t.herb, bgcolor: t.herbTint }}
            >
              {tagLabel(tag)}
            </ButtonBase>
          ))}
          {recipe.tags.length > 3 && (
            <Box component="span" sx={{ fontSize: 12, color: t.ink2 }}>
              +{recipe.tags.length - 3} more
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
