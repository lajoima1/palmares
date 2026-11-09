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
    onSaffron: "#16201B",
    saffronTint: "#FBF0DC",
    saffronInk: "#6B4508",
    error: "#B5452A",
    errorTint: "#F8E4DE",
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
    onSaffron: "#16201B",
    saffronTint: "#2E2615",
    saffronInk: "#F3D9A8",
    error: "#F08A6A",
    errorTint: "#3A221B",
    skeleton: "#222B27",
    easy: "#7CC9A0",
    medium: "#F0B65A",
    hard: "#F08A6A",
  },
};

export type HerbTokens = (typeof herbTokens)["light"];

export const headingFont = '"Bricolage Grotesque", "Inter", system-ui, sans-serif';
// index.html and admin/index.html load these fonts, only for the new look.
const textFont = '"Inter", system-ui, sans-serif';

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
      secondary: { main: t.saffron, contrastText: t.onSaffron },
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
      h5: { fontFamily: headingFont, fontWeight: 800, fontSize: "1.75rem", letterSpacing: "-0.01em" },
      h6: { fontFamily: headingFont, fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: t.ground, color: t.ink },
          // A clear ring for keyboard focus only, in the herb colour (MUI marks it Mui-focusVisible).
          ".MuiButtonBase-root.Mui-focusVisible, a:focus-visible": { outline: `3px solid ${t.herb}`, outlineOffset: 2 },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 999, minHeight: 44, paddingInline: 18 } },
      },
      MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
      // The switch clips its own focus ring, so the ring goes around the whole switch.
      MuiSwitch: {
        styleOverrides: {
          root: { borderRadius: 999, "&:has(.Mui-focusVisible)": { outline: `3px solid ${t.herb}`, outlineOffset: 0 } },
          switchBase: { "&.Mui-focusVisible": { outline: "none" } },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 500 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiCard: {
        styleOverrides: { root: { borderRadius: 20, border: `1px solid ${t.line}`, boxShadow: "none" } },
      },
      MuiDrawer: {
        styleOverrides: { paperAnchorBottom: { borderRadius: "28px 28px 0 0" } },
      },
      // A full-screen dialog (the recipe form on a phone) fills the screen with square corners.
      MuiDialog: { styleOverrides: { paper: { borderRadius: 28 }, paperFullScreen: { borderRadius: 0 } } },
      // The default placeholder is the text colour at 42 %, under 3:1; ink2 reaches 4.5:1.
      MuiInputBase: { styleOverrides: { input: { "&::placeholder": { color: t.ink2, opacity: 1 } } } },
      MuiOutlinedInput: {
        styleOverrides: { root: { borderRadius: 14, backgroundColor: t.surface } },
      },
      // The 44 px tap area puts an alert's close or retry button 8 px below the first line of text.
      // The negative margins centre it on that line and keep the alert at its normal height.
      // nowrap keeps "Try again" on one line at 375 px.
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 14 },
          action: { paddingTop: 0, marginBlock: -4, "& .MuiButton-root": { whiteSpace: "nowrap" } },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: { root: { borderRadius: 18, backgroundColor: t.ink, color: t.ground } },
      },
      MuiMenu: { styleOverrides: { paper: { borderRadius: 18, border: `1px solid ${t.line}` } } },
    },
  });
}
