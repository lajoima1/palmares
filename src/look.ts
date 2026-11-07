import { useEffect, useState } from "react";

export type Look = "new" | "old";
export type Appearance = "system" | "light" | "dark";

const LOOK_KEY = "look";
const APPEARANCE_KEY = "appearance";

// localStorage throws in some private windows. A setting that cannot be read gives its default.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The choice then lasts only until the page reloads.
  }
}

// The GitHub Pages build has only the old look (__LOOKS__ is false there).
export function getLook(looks: boolean = __LOOKS__): Look {
  if (!looks) return "old";
  return read(LOOK_KEY) === "old" ? "old" : "new";
}

export function setLook(look: Look): void {
  write(LOOK_KEY, look);
  window.location.reload();
}

export function getAppearance(): Appearance {
  const saved = read(APPEARANCE_KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
}

export function setAppearance(appearance: Appearance): void {
  write(APPEARANCE_KEY, appearance);
  window.dispatchEvent(new Event("appearancechange"));
}

const darkQuery = "(prefers-color-scheme: dark)";

export function resolveMode(appearance: Appearance, systemDark: boolean): "light" | "dark" {
  if (appearance === "system") return systemDark ? "dark" : "light";
  return appearance;
}

// The light or dark mode to draw now. It follows the device while the setting is "system".
export function useAppearanceMode(): { appearance: Appearance; mode: "light" | "dark" } {
  const [appearance, setLocal] = useState(getAppearance);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(darkQuery).matches);

  useEffect(() => {
    const media = window.matchMedia(darkQuery);
    const onMedia = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    const onChange = () => setLocal(getAppearance());
    media.addEventListener("change", onMedia);
    window.addEventListener("appearancechange", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("appearancechange", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return { appearance, mode: resolveMode(appearance, systemDark) };
}
