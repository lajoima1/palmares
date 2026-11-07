import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppearance, getLook, resolveMode } from "./look.ts";

function fakeStorage(values: Record<string, string>) {
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => {
      values[key] = value;
    },
  };
}

describe("look", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("with both looks in the build", () => {
    it("gives the new look by default", () => {
      vi.stubGlobal("localStorage", fakeStorage({}));
      expect(getLook(true)).toBe("new");
    });

    it("gives the old look only for the saved value old", () => {
      vi.stubGlobal("localStorage", fakeStorage({ look: "old" }));
      expect(getLook(true)).toBe("old");
      vi.stubGlobal("localStorage", fakeStorage({ look: "something" }));
      expect(getLook(true)).toBe("new");
    });

    it("gives the new look when storage throws", () => {
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
      });
      expect(getLook(true)).toBe("new");
    });
  });

  it("always gives the old look in the GitHub Pages build", () => {
    vi.stubGlobal("localStorage", fakeStorage({ look: "new" }));
    expect(getLook(false)).toBe("old");
  });
});

describe("appearance", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives system by default and for a bad value", () => {
    vi.stubGlobal("localStorage", fakeStorage({}));
    expect(getAppearance()).toBe("system");
    vi.stubGlobal("localStorage", fakeStorage({ appearance: "true" }));
    expect(getAppearance()).toBe("system");
  });

  it("keeps light and dark", () => {
    vi.stubGlobal("localStorage", fakeStorage({ appearance: "dark" }));
    expect(getAppearance()).toBe("dark");
  });

  it("follows the device only for system", () => {
    expect(resolveMode("system", true)).toBe("dark");
    expect(resolveMode("system", false)).toBe("light");
    expect(resolveMode("light", true)).toBe("light");
    expect(resolveMode("dark", false)).toBe("dark");
  });
});
