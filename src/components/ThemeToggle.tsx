import { useState } from "react";
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Box,
  Typography,
  Divider,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import Brightness4 from "@mui/icons-material/Brightness4";
import Brightness7 from "@mui/icons-material/Brightness7";
import Palette from "@mui/icons-material/Palette";
import Check from "@mui/icons-material/Check";
import { colorThemes, type ColorTheme } from "../theme/themes";

interface ThemeToggleProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  currentColorTheme: ColorTheme;
  onColorThemeChange: (theme: ColorTheme) => void;
}

export function ThemeToggle({
  isDarkMode,
  onToggleDarkMode,
  currentColorTheme,
  onColorThemeChange,
}: ThemeToggleProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleColorThemeSelect = (theme: ColorTheme) => {
    onColorThemeChange(theme);
    handleMenuClose();
  };

  return (
    <Box display="flex" alignItems="center">
      <Tooltip title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}>
        <IconButton onClick={onToggleDarkMode} color="inherit" size="medium">
          {isDarkMode ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Change color theme">
        <IconButton onClick={handleMenuOpen} color="inherit" size="medium">
          <Palette />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 200,
            maxHeight: 400,
            overflow: "auto",
          },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Color Themes
          </Typography>
        </Box>
        <Divider />

        {colorThemes.map((theme) => (
          <MenuItem
            key={theme.name}
            onClick={() => handleColorThemeSelect(theme)}
            sx={{
              py: 1.5,
              px: 2,
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: theme.primary,
                  border:
                    theme.name === currentColorTheme.name
                      ? `2px solid ${theme.primary}`
                      : "1px solid #ccc",
                  boxShadow:
                    theme.name === currentColorTheme.name
                      ? `0 0 0 2px rgba(0,0,0,0.1)`
                      : "none",
                }}
              />
            </ListItemIcon>
            <ListItemText>
              <Typography variant="body2">{theme.name}</Typography>
            </ListItemText>
            {theme.name === currentColorTheme.name && (
              <Check sx={{ fontSize: 16, color: "primary.main" }} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
