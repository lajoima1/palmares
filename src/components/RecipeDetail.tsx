import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Close from "@mui/icons-material/Close";
import AccessTime from "@mui/icons-material/AccessTime";
import Restaurant from "@mui/icons-material/Restaurant";
import LocalOffer from "@mui/icons-material/LocalOffer";
import MenuBook from "@mui/icons-material/MenuBook";
import { type Recipe } from "../types/Recipe";

interface RecipeDetailProps {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
  onTagClick?: (tag: string) => void;
  selectedTags?: string[];
}

export const RecipeDetail: React.FC<RecipeDetailProps> = ({
  recipe,
  open,
  onClose,
  onTagClick,
  selectedTags = [],
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Wake Lock functionality
  React.useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator && open && isMobile) {
          wakeLock = await navigator.wakeLock.request("screen");
          console.log("Wake lock activated");
        }
      } catch (err) {
        console.log("Wake lock request failed:", err);
      }
    };

    const releaseWakeLock = () => {
      if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
        console.log("Wake lock released");
      }
    };

    if (open && isMobile) {
      requestWakeLock();
    }

    // Clean up wake lock when dialog closes or component unmounts
    return () => {
      releaseWakeLock();
    };
  }, [open, isMobile]);

  if (!recipe) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      scroll="paper"
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h5" component="h1">
          {recipe.name}
        </Typography>
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ mb: 3 }}>
          <img
            src={recipe.image_url}
            alt={recipe.name}
            style={{
              width: "100%",
              height: "300px",
              objectFit: "cover",
              borderRadius: "8px",
            }}
          />
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {recipe.description}
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(4, 1fr)",
            },
            gap: 3,
            mb: 3,
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <AccessTime color="primary" />
            <Box>
              <Typography
                variant="caption"
                display="block"
                color="text.secondary"
              >
                Prep Time
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {recipe.prep_time}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <AccessTime color="primary" />
            <Box>
              <Typography
                variant="caption"
                display="block"
                color="text.secondary"
              >
                Cook Time
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {recipe.cook_time}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Restaurant color="primary" />
            <Box>
              <Typography
                variant="caption"
                display="block"
                color="text.secondary"
              >
                Servings
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {recipe.servings}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <MenuBook color="primary" />
            <Box>
              <Typography
                variant="caption"
                display="block"
                color="text.secondary"
              >
                Difficulty
              </Typography>
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
            </Box>
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Tags
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
            {recipe.tags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  variant={isSelected ? "filled" : "outlined"}
                  color={isSelected ? "primary" : "default"}
                  icon={<LocalOffer fontSize="small" />}
                  onClick={onTagClick ? () => onTagClick(tag) : undefined}
                  sx={{
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
                />
              );
            })}
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 4,
          }}
        >
          <Box>
            <Typography variant="h6" gutterBottom>
              Ingredients
            </Typography>
            <List dense>
              {recipe.ingredients.map((ingredient, index) => (
                <ListItem key={index} sx={{ pl: 0 }}>
                  <ListItemText
                    primary={ingredient}
                    primaryTypographyProps={{ variant: "body2" }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          <Box>
            <Typography variant="h6" gutterBottom>
              Instructions
            </Typography>
            <List>
              {recipe.instructions.map((instruction, index) => (
                <ListItem key={index} sx={{ pl: 0, alignItems: "flex-start" }}>
                  <Box
                    sx={{
                      minWidth: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      backgroundColor: "primary.main",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mr: 2,
                      mt: 0.5,
                      fontSize: "0.875rem",
                      fontWeight: "bold",
                    }}
                  >
                    {index + 1}
                  </Box>
                  <ListItemText
                    primary={instruction}
                    primaryTypographyProps={{ variant: "body2" }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>

        {recipe.notes && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" gutterBottom>
              Notes
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: "pre-line" }}
            >
              {recipe.notes}
            </Typography>
          </>
        )}
      </DialogContent>

      {!isMobile && (
        <DialogActions>
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
