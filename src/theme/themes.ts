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
    name: "Parchment",
    primary: "#8B4513",
    secondary: "#D2691E",
  },
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
  const isParchment = colorTheme.name === "Parchment";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: colorTheme.primary,
      },
      secondary: {
        main: colorTheme.secondary,
      },
      background: {
        default: isParchment
          ? isLight
            ? "#F4E8D0"
            : "#2C2416"
          : isLight
            ? "#fafafa"
            : "#121212",
        paper: isParchment
          ? isLight
            ? "#FBF6ED"
            : "#3A3023"
          : isLight
            ? "#ffffff"
            : "#1d1d1d",
      },
      ...(isParchment && {
        text: {
          primary: isLight ? "#3E2723" : "#E8D5B7",
          secondary: isLight ? "#5D4037" : "#C4A882",
        },
      }),
    },
    typography: {
      fontFamily: isParchment
        ? '"Merriweather", "Georgia", "Times New Roman", serif'
        : '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 700,
      },
      h6: {
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: isParchment ? 4 : 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: "thin",
            ...(isParchment &&
              isLight && {
                backgroundImage: `
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 2px,
                  rgba(139, 69, 19, 0.02) 2px,
                  rgba(139, 69, 19, 0.02) 4px
                ),
                repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 2px,
                  rgba(139, 69, 19, 0.02) 2px,
                  rgba(139, 69, 19, 0.02) 4px
                )
              `,
                backgroundColor: "#F4E8D0",
              }),
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: isParchment
                ? isLight
                  ? "#E8D5B7"
                  : "#2b2416"
                : isLight
                  ? "#f1f1f1"
                  : "#2b2b2b",
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
              ? hexToRgba(colorTheme.primary, 0.2)
              : hexToRgba(colorTheme.primary, 0.6),
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
      ...(isParchment && {
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: isLight
                ? `linear-gradient(to bottom, rgba(251, 246, 237, 0.9), rgba(248, 241, 225, 0.9))`
                : "none",
            },
          },
        },
      }),
    },
  });
}
