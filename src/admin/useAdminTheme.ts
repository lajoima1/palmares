import { useMemo } from "react";
import { colorThemes, createAppTheme, type ColorTheme } from "../theme/themes";

// The main page saves the dark mode and the colour theme. The admin page only reads them.
function readSaved<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useAdminTheme() {
  return useMemo(() => {
    const isDarkMode = readSaved<boolean>(
      "theme-mode",
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    const colorTheme = readSaved<ColorTheme>(
      "color-theme",
      colorThemes.find((t) => t.name === "Parchment") || colorThemes[0],
    );
    return { theme: createAppTheme(isDarkMode ? "dark" : "light", colorTheme), isDarkMode, colorTheme };
  }, []);
}
