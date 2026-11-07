import { createTheme, type PaletteMode } from "@mui/material";

// The colours of the new look ("Herb & ink"). Each pair used for text must keep a contrast of
// 4.5:1 or more; herb.test.ts checks it.
export const herbTokens = {
  light: {
    ground: "#F4F5F2",
    surface: "#FFFFFF",
    ink: "#16201B",
    ink2: "#4A5650",
    line: "#E1E5E0",
    herb: "#2E6A4C",
    onHerb: "#FFFFFF",
    herbTint: "#E3EFE7",
    saffron: "#E7A33E",
    saffronTint: "#FBF0DC",
    saffronInk: "#6B4508",
    error: "#B5452A",
    errorTint: "#F8E4DE",
    errorInk: "#7A2E1B",
    skeleton: "#E4E8E3",
    easy: "#2E6A4C",
    medium: "#C98A1E",
    hard: "#B5452A",
  },
  dark: {
    ground: "#0F1412",
    surface: "#18201C",
    ink: "#E8EEEA",
    ink2: "#A7B4AD",
    line: "#2A3530",
    herb: "#7CC9A0",
    onHerb: "#0F1412",
    herbTint: "#1F3329",
    saffron: "#F0B65A",
    saffronTint: "#2E2615",
    saffronInk: "#F3D9A8",
    error: "#F08A6A",
    errorTint: "#3A221B",
    errorInk: "#F7C8B8",
    skeleton: "#222B27",
    easy: "#7CC9A0",
    medium: "#F0B65A",
    hard: "#F08A6A",
  },
};

export type HerbTokens = (typeof herbTokens)["light"];

export const headingFont = '"Bricolage Grotesque", "Inter", system-ui, sans-serif';
// src/main.tsx and admin/index.html load these fonts, only for the new look.
export const textFont = '"Inter", system-ui, sans-serif';

export function difficultyColor(t: HerbTokens, difficulty: string): string {
  if (difficulty === "Easy") return t.easy;
  if (difficulty === "Medium") return t.medium;
  if (difficulty === "Hard") return t.hard;
  return "transparent";
}

declare module "@mui/material/styles" {
  interface Theme {
    herb: HerbTokens;
  }
  interface ThemeOptions {
    herb?: HerbTokens;
  }
}

export function createHerbTheme(mode: PaletteMode) {
  const t = herbTokens[mode];
  return createTheme({
    herb: t,
    palette: {
      mode,
      primary: { main: t.herb, contrastText: t.onHerb },
      secondary: { main: t.saffron, contrastText: t.ink },
      error: { main: t.error },
      background: { default: t.ground, paper: t.surface },
      text: { primary: t.ink, secondary: t.ink2 },
      divider: t.line,
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: textFont,
      h1: { fontFamily: headingFont, fontWeight: 800, letterSpacing: "-0.02em" },
      h2: { fontFamily: headingFont, fontWeight: 800, letterSpacing: "-0.02em" },
      h3: { fontFamily: headingFont, fontWeight: 800, letterSpacing: "-0.02em" },
      h4: { fontFamily: headingFont, fontWeight: 800, letterSpacing: "-0.02em" },
      h5: { fontFamily: headingFont, fontWeight: 700 },
      h6: { fontFamily: headingFont, fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { backgroundColor: t.ground, color: t.ink } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 999, minHeight: 44, paddingInline: 18 } },
      },
      MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 500 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiCard: {
        styleOverrides: { root: { borderRadius: 20, border: `1px solid ${t.line}`, boxShadow: "none" } },
      },
      MuiDrawer: {
        styleOverrides: { paperAnchorBottom: { borderRadius: "28px 28px 0 0" } },
      },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 28 } } },
      MuiOutlinedInput: {
        styleOverrides: { root: { borderRadius: 14, backgroundColor: t.surface } },
      },
      MuiAlert: { styleOverrides: { root: { borderRadius: 14 } } },
      MuiSnackbarContent: {
        styleOverrides: { root: { borderRadius: 18, backgroundColor: t.ink, color: t.ground } },
      },
      MuiMenu: { styleOverrides: { paper: { borderRadius: 18, border: `1px solid ${t.line}` } } },
    },
  });
}
