import React from "react";
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Chip,
  Box,
  Stack,
} from "@mui/material";
import AccessTime from "@mui/icons-material/AccessTime";
import Restaurant from "@mui/icons-material/Restaurant";
import LocalOffer from "@mui/icons-material/LocalOffer";
import { type Recipe } from "../types/Recipe";

interface RecipeCardProps {
  recipe: Recipe;
  onViewRecipe: (recipe: Recipe) => void;
  onTagClick?: (tag: string) => void;
  selectedTags?: string[];
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onViewRecipe,
  onTagClick,
  selectedTags = [],
}) => {
  const handleCardClick = () => {
    onViewRecipe(recipe);
  };

  const handleTagClick = (event: React.MouseEvent, tag: string) => {
    event.stopPropagation(); // Prevent card click when tag is clicked
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "all 0.2s ease-in-out",
        border: (theme) =>
          theme.palette.mode === "dark" ? "1px solid transparent" : "none",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: (theme) =>
            theme.palette.mode === "light"
              ? theme.shadows[8]
              : theme.shadows[4],
          borderColor: (theme) =>
            theme.palette.mode === "dark"
              ? theme.palette.primary.main
              : undefined,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.02)"
              : theme.palette.background.paper,
        },
      }}
      onClick={handleCardClick}
    >
      <CardMedia
        component="img"
        height="200"
        image={recipe.image_url}
        alt={recipe.name}
        sx={{
          objectFit: "cover",
          display: "block",
          borderRadius: "4px 4px 0 0",
        }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography gutterBottom variant="h6" component="h2">
          {recipe.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {recipe.description}
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <AccessTime fontSize="small" color="action" />
            <Typography variant="caption">{recipe.total_time}</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <Restaurant fontSize="small" color="action" />
            <Typography variant="caption">{recipe.servings}</Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Chip
            label={recipe.difficulty}
            size="small"
            color={
              recipe.difficulty === "Easy"
                ? "success"
                : recipe.difficulty === "Medium"
                ? "warning"
                : "error"
            }
          />
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
          {recipe.tags.slice(0, 3).map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant={isSelected ? "filled" : "outlined"}
                color={isSelected ? "primary" : "default"}
                icon={<LocalOffer fontSize="small" />}
                sx={{
                  fontSize: "0.7rem",
                  cursor: onTagClick ? "pointer" : "default",
                  "&:hover": onTagClick
                    ? {
                        backgroundColor: isSelected
                          ? "primary.dark"
                          : "action.hover",
                        color: isSelected
                          ? "primary.contrastText"
                          : "primary.main",
                        borderColor: "primary.main",
                      }
                    : {},
                }}
                onClick={(e) => handleTagClick(e, tag)}
              />
            );
          })}
          {recipe.tags.length > 3 && (
            <Typography variant="caption" color="text.secondary">
              +{recipe.tags.length - 3} more
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
