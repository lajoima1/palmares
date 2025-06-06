import { createTheme } from "@mui/material";
import type { PaletteMode } from "@mui/material";

// Helper function to convert hex color to rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface ColorTheme {
  name: string;
  primary: string;
  secondary: string;
}

export const colorThemes: ColorTheme[] = [
  {
    name: "Classic Red",
    primary: "#d32f2f",
    secondary: "#ff9800",
  },
  {
    name: "Ocean Blue",
    primary: "#1976d2",
    secondary: "#ff9800",
  },
  {
    name: "Forest Green",
    primary: "#388e3c",
    secondary: "#ff7043",
  },
  {
    name: "Royal Purple",
    primary: "#7b1fa2",
    secondary: "#ffc107",
  },
  {
    name: "Sunset Orange",
    primary: "#f57c00",
    secondary: "#e91e63",
  },
];

export function createAppTheme(mode: PaletteMode, colorTheme: ColorTheme) {
  const isLight = mode === "light";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: colorTheme.primary,
      },
      secondary: {
        main: colorTheme.secondary,
      },
      // Use standard Material-UI backgrounds for light/dark mode
      background: {
        default: isLight ? "#fafafa" : "#121212",
        paper: isLight ? "#ffffff" : "#1d1d1d",
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 700,
      },
      h6: {
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: isLight ? "#f1f1f1" : "#2b2b2b",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: colorTheme.primary,
              borderRadius: "4px",
              "&:hover": {
                backgroundColor: isLight ? "#555" : "#888",
              },
            },
          },
          // Fix text selection colors for better contrast
          "::selection": {
            backgroundColor: isLight 
              ? hexToRgba(colorTheme.primary, 0.2) // Light theme: primary color with 20% opacity
              : hexToRgba(colorTheme.primary, 0.6), // Dark theme: primary color with 60% opacity
            color: isLight ? "#000000" : "#ffffff",
          },
          "::-moz-selection": {
            backgroundColor: isLight 
              ? hexToRgba(colorTheme.primary, 0.2) 
              : hexToRgba(colorTheme.primary, 0.6),
            color: isLight ? "#000000" : "#ffffff",
          },
        },
      },
    },
  });
}
