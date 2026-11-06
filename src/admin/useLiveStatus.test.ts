import { describe, expect, it } from "vitest";
import { liveState } from "./useLiveStatus.ts";

const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);

describe("liveState", () => {
  it("waits while the site serves the commit from before the save", () => {
    expect(liveState(A, B, A)).toBe("building");
  });

  it("is live when the site serves the saved commit", () => {
    expect(liveState(B, B, A)).toBe("live");
  });

  it("is live when the site serves a newer commit", () => {
    expect(liveState(C, B, A)).toBe("live");
  });

  it("only says saved when the site gives no commit SHA", () => {
    expect(liveState(undefined, B, A)).toBe("saved");
    expect(liveState("main", B, A)).toBe("saved");
    expect(liveState(A, B, undefined)).toBe("saved");
  });
});
