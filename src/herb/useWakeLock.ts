import { useEffect, useState } from "react";

// Keeps the screen on while `active` (a recipe page on a phone), as the old recipe dialog does.
// Returns true while the browser holds the lock.
export function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || !navigator.wakeLock) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    const request = () => {
      navigator.wakeLock
        ?.request("screen")
        .then((sentinel) => {
          if (stopped) {
            sentinel.release();
            return;
          }
          lock = sentinel;
          setHeld(true);
        })
        .catch(() => setHeld(false));
    };
    // The browser drops the lock when the tab is hidden; ask again when it comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };

    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release();
      setHeld(false);
    };
  }, [active]);

  return held;
}
