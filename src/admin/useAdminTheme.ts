import { useMemo } from "react";
import { useAppearanceMode } from "../look";
import { createHerbTheme } from "../theme/herb";

// The admin page has the new look and follows the appearance set on the main page.
export function useAdminTheme() {
  const { mode } = useAppearanceMode();
  return useMemo(() => createHerbTheme(mode), [mode]);
}
