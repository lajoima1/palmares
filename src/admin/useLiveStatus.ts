import { useCallback, useEffect, useRef, useState } from "react";

export type LiveStatus = "idle" | "building" | "live" | "slow" | "saved";

// Workers Builds sets the commit SHA. A local run and a manual build give none, so the page
// cannot tell when the site serves the change.
const SHA = /^[0-9a-f]{40}$/;
const POLL_MS = 10_000;
// A build takes about 2 minutes. After 10, the page stops asking and says it is slow.
const GIVE_UP_MS = 10 * 60_000;

// "live" if the site serves the saved commit, or a newer one: a SHA other than the one before
// the save comes from a later push. An earlier save of this page is older, so it still waits.
export function liveState(
  served: string | undefined,
  saved: string,
  before: string | undefined,
  earlier: readonly string[] = [],
): LiveStatus {
  if (!served || !SHA.test(served) || !before || !SHA.test(before)) return "saved";
  if (served === saved) return "live";
  if (served === before || earlier.includes(served)) return "building";
  return "live";
}

export async function servedCommit(): Promise<string | undefined> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    return ((await res.json()) as { commit?: string }).commit;
  } catch {
    return undefined;
  }
}

export function useLiveStatus() {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const run = useRef(0);

  // A poll that is still waiting stops when the page closes.
  useEffect(() => {
    const current = run;
    return () => {
      current.current++;
    };
  }, []);

  // Follows only the last save. A new save stops the poll of the one before.
  const follow = useCallback(async (saved: string, before: string | undefined, earlier: readonly string[]) => {
    const id = ++run.current;
    const start = Date.now();
    let state = liveState(await servedCommit(), saved, before, earlier);
    while (state === "building" && Date.now() - start < GIVE_UP_MS) {
      if (id !== run.current) return;
      setStatus("building");
      await new Promise((r) => setTimeout(r, POLL_MS));
      state = liveState(await servedCommit(), saved, before, earlier);
    }
    if (id === run.current) setStatus(state === "building" ? "slow" : state);
  }, []);

  const reset = useCallback(() => {
    run.current++;
    setStatus("idle");
  }, []);

  return { status, follow, reset };
}
