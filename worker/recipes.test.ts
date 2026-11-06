import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyRecipe, serializeRecipe, type RecipeFields } from "../src/utils/recipeText.ts";
import { FakeGitHub } from "./fakeGitHub.ts";
import { handleApi } from "./router.ts";
import { createSession } from "./session.ts";
import { apiRequest, cookieHeader, ORIGIN, testEnv } from "./testEnv.ts";

// "RIFF", size, "WEBP", then a few bytes: the start of a webp file.
const WEBP = btoa("RIFF\x10\x00\x00\x00WEBPVP8 ");
const JPEG = btoa("\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01");

let gh: FakeGitHub;
let env: ReturnType<typeof testEnv>;
let cookie: string;

beforeEach(async () => {
  gh = new FakeGitHub();
  gh.addRecipe("lasagne", "name: Lasagne\ndifficulty: Easy\ntags: pasta, main\n", true);
  vi.stubGlobal("fetch", gh.fetch);
  env = testEnv();
  await env.AUTH.put("passkey:pk1", JSON.stringify({ id: "pk1", userId: "u1" }));
  cookie = cookieHeader(await createSession(env, { userId: "u1", passkeyId: "pk1" }));
});

afterEach(() => vi.unstubAllGlobals());

function call(method: string, path: string, body?: unknown) {
  return handleApi(
    apiRequest(path, {
      method,
      cookie,
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
}

const fields = (over: Partial<RecipeFields>): RecipeFields => ({ ...emptyRecipe(), ...over });

function treeOfLastCommit() {
  return (gh.calls.filter((c) => c.path === "/git/trees").pop()?.body as {
    tree: { path: string; content?: string; sha?: string | null }[];
  }).tree;
}

describe("reading", () => {
  it("lists the recipes with their tags", async () => {
    const res = await call("GET", "/api/recipes");
    expect(await res.json()).toEqual({
      recipes: [{ slug: "lasagne", name: "Lasagne", tags: ["pasta", "main"], hasImage: true, notLive: false }],
      tags: ["main", "pasta"],
    });
  });

  it("reads one recipe with its version", async () => {
    const res = await call("GET", "/api/recipes/lasagne");
    const body = await res.json<{ fields: RecipeFields; baseOid: string; hasImage: boolean }>();
    expect(body.fields.name).toBe("Lasagne");
    expect(body.baseOid).toBe(gh.recipes.lasagne.files[0].oid);
    expect(body.hasImage).toBe(true);
  });

  it("gives 400 for a bad slug and 404 for an unknown one", async () => {
    expect((await call("GET", "/api/recipes/..%2Fpackage.json")).status).toBe(400);
    expect((await call("GET", "/api/recipes/Lasagne")).status).toBe(400);
    expect((await call("GET", "/api/recipes/nope")).status).toBe(404);
  });

  it("passes the photo through", async () => {
    const res = await call("GET", "/api/recipes/lasagne/image");
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([82, 73, 70, 70]));
  });

  it("needs a session", async () => {
    cookie = "";
    for (const [method, path] of [
      ["GET", "/api/recipes"],
      ["GET", "/api/recipes/lasagne"],
      ["GET", "/api/recipes/lasagne/image"],
      ["POST", "/api/recipes"],
      ["PUT", "/api/recipes/lasagne"],
      ["DELETE", "/api/recipes/lasagne"],
    ]) {
      expect((await call(method, path, method === "GET" ? undefined : {})).status).toBe(401);
    }
    expect(gh.calls).toEqual([]);
  });
});

describe("adding", () => {
  it("commits the recipe, the photo and index.json in one commit", async () => {
    const res = await call("POST", "/api/recipes", {
      fields: fields({ name: "Pâté chinois", ingredients: ["boeuf", "maïs"], instructions: ["Cuire"] }),
      image: WEBP,
    });
    expect(res.status).toBe(201);
    const body = await res.json<{ slug: string; commit: string }>();
    expect(body.slug).toBe("pate-chinois");
    expect(gh.head).toBe(body.commit);
    const tree = treeOfLastCommit();
    expect(tree.map((t) => t.path)).toEqual([
      "recipes/pate-chinois/recipe.txt",
      "recipes/pate-chinois/image.webp",
      "recipes/index.json",
    ]);
    expect(tree[0].content).toContain("name: Pâté chinois\n");
    expect(tree[0].content).toContain("instructions:\n1. Cuire\n");
    expect(tree[2].content).toBe('[\n  "lasagne",\n  "pate-chinois"\n]\n');
    expect((gh.calls.find((c) => c.path === "/git/commits")!.body as { message: string }).message).toBe(
      "recipe: add Pâté chinois",
    );
  });

  it("saves a recipe with only a name", async () => {
    expect((await call("POST", "/api/recipes", { fields: { name: "Toast" } })).status).toBe(201);
  });

  it("gives 409 if the slug exists", async () => {
    const res = await call("POST", "/api/recipes", { fields: fields({ name: "LASAGNE!" }) });
    expect(res.status).toBe(409);
    expect((await res.json<{ error: string }>()).error).toContain("lasagne");
  });

  it("refuses bad fields", async () => {
    const cases: unknown[] = [
      { name: "" },
      { name: "   " },
      { name: "!!!" },
      { name: "A", description: "a\nname: B" },
      { name: "A", servings: "4\r" },
      { name: "A", tags: ["a\nb"] },
      { name: "A", tags: ["a,b"] },
      { name: "A", ingredients: ["sel\ningredients:"] },
      { name: "A", difficulty: "Extreme" },
      { name: "A", notes: "one note" },
      { name: 5 },
      { name: "A", description: "x".repeat(20_001) },
    ];
    for (const f of cases) {
      const res = await call("POST", "/api/recipes", { fields: f });
      expect([400, f]).toEqual([res.status, f]);
    }
    expect(gh.calledPaths().filter((p) => p !== "POST /graphql")).toEqual([]);
  });

  it("refuses a photo that is not webp", async () => {
    expect((await call("POST", "/api/recipes", { fields: { name: "A" }, image: JPEG })).status).toBe(400);
    expect((await call("POST", "/api/recipes", { fields: { name: "A" }, image: "not base64!" })).status).toBe(400);
  });

  it("gives 413 for a body over 3 MB", async () => {
    const res = await call("POST", "/api/recipes", { fields: { name: "A" }, image: "A".repeat(3 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });
});

describe("changing", () => {
  const baseOid = () => gh.recipes.lasagne.files[0].oid;

  it("keeps the slug when the name changes", async () => {
    const res = await call("PUT", "/api/recipes/lasagne", { fields: fields({ name: "Lasagne de maman" }), baseOid: baseOid() });
    expect(res.status).toBe(200);
    const tree = treeOfLastCommit();
    expect(tree).toHaveLength(1);
    expect(tree[0].path).toBe("recipes/lasagne/recipe.txt");
    expect(tree[0].content).toContain("name: Lasagne de maman\n");
  });

  it("ignores a slug in the body", async () => {
    await call("PUT", "/api/recipes/lasagne", { slug: "other", fields: fields({ name: "X" }), baseOid: baseOid() });
    expect(treeOfLastCommit().every((t) => t.path.startsWith("recipes/lasagne/"))).toBe(true);
  });

  it("gives 409 if the recipe changed after it was opened", async () => {
    const res = await call("PUT", "/api/recipes/lasagne", { fields: fields({ name: "X" }), baseOid: "old-oid" });
    expect(res.status).toBe(409);
    expect(gh.calledPaths()).toEqual(["POST /graphql"]);
  });

  it("gives 400 without a version", async () => {
    expect((await call("PUT", "/api/recipes/lasagne", { fields: fields({ name: "X" }) })).status).toBe(400);
  });

  it("replaces, keeps or removes the photo", async () => {
    await call("PUT", "/api/recipes/lasagne", { fields: fields({ name: "Lasagne" }), baseOid: baseOid(), image: WEBP });
    expect(treeOfLastCommit().map((t) => t.path)).toContain("recipes/lasagne/image.webp");

    gh.calls = [];
    await call("PUT", "/api/recipes/lasagne", { fields: fields({ name: "Lasagne", description: "Bon" }), baseOid: baseOid() });
    expect(treeOfLastCommit().map((t) => t.path)).toEqual(["recipes/lasagne/recipe.txt"]);

    gh.calls = [];
    await call("PUT", "/api/recipes/lasagne", { fields: fields({ name: "Lasagne", description: "Bon" }), baseOid: baseOid(), image: null });
    expect(treeOfLastCommit()).toContainEqual({ path: "recipes/lasagne/image.webp", mode: "100644", type: "blob", sha: null });
  });

  it("makes no commit when nothing changed", async () => {
    // The fake oid is not a git hash, so give the recipe the hash of the text that the form sends.
    const sent = fields({ name: "Lasagne", difficulty: "Easy", tags: ["pasta", "main"] });
    const bytes = new TextEncoder().encode(serializeRecipe(sent));
    const all = new Uint8Array([...new TextEncoder().encode(`blob ${bytes.length}\0`), ...bytes]);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-1", all))].map((b) => b.toString(16).padStart(2, "0")).join("");
    gh.recipes.lasagne.files[0].oid = hash;

    const res = await call("PUT", "/api/recipes/lasagne", { fields: sent, baseOid: hash });
    expect(await res.json()).toMatchObject({ changed: false, commit: "c0" });
    expect(gh.calledPaths()).toEqual(["POST /graphql"]);
  });
});

describe("deleting", () => {
  it("removes the folder and the index entry in one commit", async () => {
    const res = await call("DELETE", "/api/recipes/lasagne", { baseOid: gh.recipes.lasagne.files[0].oid });
    expect(res.status).toBe(200);
    expect(treeOfLastCommit()).toEqual([
      { path: "recipes/lasagne/recipe.txt", mode: "100644", type: "blob", sha: null },
      { path: "recipes/lasagne/image.webp", mode: "100644", type: "blob", sha: null },
      { path: "recipes/index.json", mode: "100644", type: "blob", content: "[]\n" },
    ]);
    expect((gh.calls.find((c) => c.path === "/git/commits")!.body as { message: string }).message).toBe(
      "recipe: delete Lasagne",
    );
  });

  it("gives 409 for an old version and 404 for an unknown recipe", async () => {
    expect((await call("DELETE", "/api/recipes/lasagne", { baseOid: "old" })).status).toBe(409);
    expect((await call("DELETE", "/api/recipes/nope", { baseOid: "x" })).status).toBe(404);
  });
});
