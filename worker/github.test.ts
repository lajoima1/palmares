import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commitChanges, listRecipes } from "./github.ts";
import { FakeGitHub } from "./fakeGitHub.ts";
import { testEnv } from "./testEnv.ts";

let gh: FakeGitHub;

beforeEach(() => {
  gh = new FakeGitHub();
  gh.addRecipe("lasagne", "name: Lasagne\n");
  vi.stubGlobal("fetch", gh.fetch);
});

afterEach(() => vi.unstubAllGlobals());

const add = (slug: string) => (head: { index: string[] }) => [
  { path: `recipes/${slug}/recipe.txt`, content: "name: X\n" },
  { path: "recipes/index.json", content: JSON.stringify([...head.index, slug]) },
];

describe("commitChanges", () => {
  it("makes one commit with 5 requests at most", async () => {
    const result = await commitChanges(testEnv(), "recipe: add X", "x", add("x"));
    expect(result.changed).toBe(true);
    expect(gh.head).toBe(result.commit);
    expect(gh.calledPaths()).toEqual([
      "POST /graphql",
      "POST /git/trees",
      "POST /git/commits",
      "PATCH /git/refs/heads/admin-test",
    ]);
    const commit = gh.calls[2].body as { parents: string[]; message: string };
    expect(commit).toMatchObject({ parents: ["c0"], message: "recipe: add X" });
    expect(gh.calls[3].body).toEqual({ sha: result.commit, force: false });
  });

  it("sends a photo as a blob, and a delete as a null sha", async () => {
    await commitChanges(testEnv(), "m", "lasagne", () => [
      { path: "recipes/lasagne/image.webp", base64: "UklGRg==" },
      { path: "recipes/lasagne/old.txt", delete: true },
    ]);
    expect(gh.calls[1]).toMatchObject({ path: "/git/blobs", body: { content: "UklGRg==", encoding: "base64" } });
    const tree = gh.calls[2].body as { base_tree: string; tree: unknown[] };
    expect(tree.base_tree).toBe("tree-of-c0");
    expect(tree.tree).toEqual([
      { path: "recipes/lasagne/image.webp", mode: "100644", type: "blob", sha: "blob-2" },
      { path: "recipes/lasagne/old.txt", mode: "100644", type: "blob", sha: null },
    ]);
  });

  it("starts again on the new head when the branch moved, and keeps the change made in between", async () => {
    gh.patchStatus = [422];
    gh.onHeadRead = (n) => {
      if (n === 2) {
        gh.head = "c1";
        gh.addRecipe("from-ide", "name: From IDE\n");
      }
    };
    const result = await commitChanges(testEnv(), "recipe: add X", "x", add("x"));
    expect(gh.head).toBe(result.commit);
    const lastTree = gh.calls.filter((c) => c.path === "/git/trees").pop()!.body as {
      base_tree: string;
      tree: { path: string; content?: string }[];
    };
    expect(lastTree.base_tree).toBe("tree-of-c1");
    expect(JSON.parse(lastTree.tree.find((t) => t.path === "recipes/index.json")!.content!)).toEqual([
      "lasagne",
      "from-ide",
      "x",
    ]);
    const lastCommit = gh.calls.filter((c) => c.path === "/git/commits").pop()!.body as { parents: string[] };
    expect(lastCommit.parents).toEqual(["c1"]);
  });

  it("stops after 3 tries", async () => {
    gh.patchStatus = [422, 422, 422];
    await expect(commitChanges(testEnv(), "m", "x", add("x"))).rejects.toMatchObject({ status: 502 });
    expect(gh.calledPaths().filter((p) => p.startsWith("PATCH"))).toHaveLength(3);
  });

  it("does not retry another error", async () => {
    gh.patchStatus = [500];
    await expect(commitChanges(testEnv(), "m", "x", add("x"))).rejects.toMatchObject({ status: 502 });
    expect(gh.calledPaths().filter((p) => p.startsWith("PATCH"))).toHaveLength(1);
  });

  it("refuses a path outside recipes/ before any write", async () => {
    for (const path of ["package.json", ".github/workflows/x.yml", "recipes/../package.json", "recipes", "recipes//x"]) {
      gh.calls = [];
      await expect(commitChanges(testEnv(), "m", "x", () => [{ path, content: "x" }])).rejects.toThrow(/outside recipes/);
      expect(gh.calledPaths()).toEqual(["POST /graphql"]);
    }
  });

  it("refuses a local run that targets main", async () => {
    const env = testEnv({ ORIGIN: "http://localhost:8787", GITHUB_BRANCH: "main" });
    await expect(commitChanges(env, "m", "x", add("x"))).rejects.toThrow(/must not write to main/);
    expect(gh.calls).toEqual([]);
  });

  it("makes no commit when nothing changed", async () => {
    const result = await commitChanges(testEnv(), "m", "lasagne", () => []);
    expect(result).toEqual({ commit: "c0", changed: false });
    expect(gh.calledPaths()).toEqual(["POST /graphql"]);
  });
});

describe("listRecipes", () => {
  it("reads all recipes in one request, in the order of index.json", async () => {
    gh.addRecipe("tarte", "name: Tarte\n", true);
    const list = await listRecipes(testEnv());
    expect(gh.calls).toHaveLength(1);
    expect(list.map((r) => [r.slug, r.hasImage, r.notLive])).toEqual([
      ["lasagne", false, false],
      ["tarte", true, false],
    ]);
  });

  it("marks a recipe that differs from the deployed commit", async () => {
    gh.snapshotDeployed();
    gh.addRecipe("tarte", "name: Tarte\n");
    gh.addRecipe("lasagne", "name: Lasagne 2\n");
    const env = testEnv({ COMMIT: "a".repeat(40) });
    const list = await listRecipes(env);
    expect(list.map((r) => [r.slug, r.notLive])).toEqual([
      ["lasagne", true],
      ["tarte", true],
    ]);
  });

  it("marks nothing without a deployed commit SHA", async () => {
    gh.addRecipe("tarte", "name: Tarte\n");
    for (const COMMIT of [undefined, "", "main"]) {
      gh.calls = [];
      const list = await listRecipes(testEnv({ COMMIT }));
      expect(list.every((r) => !r.notLive)).toBe(true);
      expect((gh.calls[0].body as { variables: { hasDeployed: boolean } }).variables.hasDeployed).toBe(false);
    }
  });
});
