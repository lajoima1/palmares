import { createTheme } from "@mui/material";
import type { PaletteMode } from "@mui/material";

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
        },
      },
    },
  });
}
