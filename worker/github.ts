import type { Env } from "./env.ts";
import { HttpError } from "./http.ts";

const API = "https://api.github.com";

export interface FolderEntry {
  name: string;
  oid: string;
}

export interface Head {
  oid: string;
  treeOid: string;
  // The files of recipes/<slug>/, or null if the folder does not exist.
  folder: FolderEntry[] | null;
  index: string[];
}

// The head, plus the text of recipes/<slug>/recipe.txt (null if it does not exist).
export type HeadWithText = Head & { text: string | null };

export type Change =
  | { path: string; content: string }
  | { path: string; base64: string }
  | { path: string; delete: true };

export interface RecipeSummary {
  slug: string;
  text: string;
  hasImage: boolean;
  notLive: boolean;
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    console.error("GitHub request failed", e);
    throw new HttpError(502, "Cannot reach GitHub. Try again in a minute.");
  }
}

function headers(env: Env): Record<string, string> {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "palmares-worker",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function failure(res: Response): Promise<HttpError> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  if (res.status === 401) return new HttpError(502, "GitHub refused the token. It may have ended. Make a new one.");
  return new HttpError(502, `GitHub answered ${res.status}: ${body?.message ?? "no message"}.`);
}

async function rest<T>(env: Env, method: string, path: string, body?: unknown): Promise<T> {
  const res = await send(`${API}/repos/${env.GITHUB_REPO}${path}`, {
    method,
    headers: { ...headers(env), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

async function graphql<T>(env: Env, query: string, variables: Record<string, unknown>): Promise<T> {
  const [owner, name] = env.GITHUB_REPO.split("/");
  const res = await send(`${API}/graphql`, {
    method: "POST",
    headers: { ...headers(env), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { owner, name, ...variables } }),
  });
  if (!res.ok) throw await failure(res);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length || !body.data) {
    throw new HttpError(502, `GitHub answered: ${body.errors?.[0]?.message ?? "no data"}.`);
  }
  return body.data;
}

// A commit SHA of Workers Builds. A manual build sets "main", and a local run sets nothing.
function deployedCommit(env: Env): string | null {
  return env.COMMIT && /^[0-9a-f]{40}$/.test(env.COMMIT) ? env.COMMIT : null;
}

interface TreeData {
  entries: { name: string; oid: string; object?: { entries?: { name: string; oid: string; object?: { text?: string | null } }[] } }[];
}

const LIST_QUERY = `
query ($owner: String!, $name: String!, $recipes: String!, $index: String!, $deployed: String!, $hasDeployed: Boolean!) {
  repository(owner: $owner, name: $name) {
    recipes: object(expression: $recipes) {
      ... on Tree { entries { name oid object { ... on Tree { entries { name oid object { ... on Blob { text } } } } } } }
    }
    index: object(expression: $index) { ... on Blob { text } }
    deployed: object(expression: $deployed) @include(if: $hasDeployed) {
      ... on Tree { entries { name oid } }
    }
  }
}`;

// One request reads all recipes, so the number of recipes does not change the number of requests.
export async function listRecipes(env: Env): Promise<RecipeSummary[]> {
  const deployed = deployedCommit(env);
  const data = await graphql<{
    repository: { recipes: TreeData | null; index: { text: string } | null; deployed?: { entries: FolderEntry[] } | null };
  }>(env, LIST_QUERY, {
    recipes: `${env.GITHUB_BRANCH}:recipes`,
    index: `${env.GITHUB_BRANCH}:recipes/index.json`,
    deployed: `${deployed ?? ""}:recipes`,
    hasDeployed: deployed !== null,
  });
  const { recipes, index } = data.repository;
  if (!recipes || !index) throw new HttpError(502, `The branch ${env.GITHUB_BRANCH} has no recipes folder.`);

  const live = new Map((data.repository.deployed?.entries ?? []).map((e) => [e.name, e.oid]));
  const folders = new Map(recipes.entries.map((e) => [e.name, e]));
  const slugs = JSON.parse(index.text) as string[];
  return slugs.flatMap((slug) => {
    const folder = folders.get(slug);
    const files = folder?.object?.entries ?? [];
    const text = files.find((f) => f.name === "recipe.txt")?.object?.text;
    if (!folder || typeof text !== "string") return [];
    return [
      {
        slug,
        text,
        hasImage: files.some((f) => f.name === "image.webp"),
        notLive: deployed !== null && live.get(slug) !== folder.oid,
      },
    ];
  });
}

const HEAD_QUERY = `
query ($owner: String!, $name: String!, $ref: String!, $folder: String!, $index: String!, $recipe: String!) {
  repository(owner: $owner, name: $name) {
    ref(qualifiedName: $ref) { target { oid ... on Commit { tree { oid } } } }
    folder: object(expression: $folder) { ... on Tree { entries { name oid } } }
    index: object(expression: $index) { ... on Blob { text } }
    recipe: object(expression: $recipe) { ... on Blob { text } }
  }
}`;

export async function readHead(env: Env, slug: string): Promise<HeadWithText> {
  const data = await graphql<{
    repository: {
      ref: { target: { oid: string; tree: { oid: string } } } | null;
      folder: { entries: FolderEntry[] } | null;
      index: { text: string } | null;
      recipe: { text: string } | null;
    };
  }>(env, HEAD_QUERY, {
    ref: `refs/heads/${env.GITHUB_BRANCH}`,
    folder: `${env.GITHUB_BRANCH}:recipes/${slug}`,
    index: `${env.GITHUB_BRANCH}:recipes/index.json`,
    recipe: `${env.GITHUB_BRANCH}:recipes/${slug}/recipe.txt`,
  });
  const { ref, folder, index, recipe } = data.repository;
  if (!ref || !index) throw new HttpError(502, `The branch ${env.GITHUB_BRANCH} was not found.`);
  return {
    oid: ref.target.oid,
    treeOid: ref.target.tree.oid,
    folder: folder?.entries ?? null,
    index: JSON.parse(index.text) as string[],
    text: recipe?.text ?? null,
  };
}

// The body is a stream, so the photo passes through and the Worker spends no CPU on it.
export async function readImage(env: Env, slug: string): Promise<Response> {
  const res = await send(
    `${API}/repos/${env.GITHUB_REPO}/contents/recipes/${slug}/image.webp?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`,
    { headers: { ...headers(env), Accept: "application/vnd.github.raw" } },
  );
  if (res.status === 404) throw new HttpError(404, "This recipe has no photo.");
  if (!res.ok) throw await failure(res);
  return new Response(res.body, {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=60" },
  });
}

function checkPath(path: string): void {
  const parts = path.split("/");
  if (parts[0] !== "recipes" || parts.length < 2 || parts.some((p) => p === "" || p === "." || p === "..")) {
    throw new Error(`Refused a write outside recipes/: ${path}`);
  }
}

// After a 422 on the move of the branch, the commit starts again from the new head. Two retries
// cover two saves at the same time. More means something else is wrong.
const MAX_TRIES = 3;

// One save is one commit. `build` runs on each try with the newest head, so a change that came
// in between (like a push from the IDE) stays in the commit.
export async function commitChanges(
  env: Env,
  message: string | ((head: HeadWithText) => string),
  slug: string,
  build: (head: HeadWithText) => Change[] | Promise<Change[]>,
): Promise<{ commit: string; changed: boolean }> {
  // .dev.vars holds the real token. A local run (an http:// origin, like localhost or 127.0.0.1)
  // that targets main would deploy both sites.
  if (!env.ORIGIN.startsWith("https://") && env.GITHUB_BRANCH === "main") {
    throw new Error("A local run must not write to main. Set GITHUB_BRANCH in .dev.vars.");
  }

  for (let attempt = 1; ; attempt++) {
    const head = await readHead(env, slug);
    const changes = await build(head);
    changes.forEach((c) => checkPath(c.path));
    if (changes.length === 0) return { commit: head.oid, changed: false };

    const tree = [];
    for (const change of changes) {
      if ("delete" in change) {
        tree.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      } else if ("base64" in change) {
        const blob = await rest<{ sha: string }>(env, "POST", "/git/blobs", { content: change.base64, encoding: "base64" });
        tree.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
      } else {
        tree.push({ path: change.path, mode: "100644", type: "blob", content: change.content });
      }
    }
    const newTree = await rest<{ sha: string }>(env, "POST", "/git/trees", { base_tree: head.treeOid, tree });
    const commit = await rest<{ sha: string }>(env, "POST", "/git/commits", {
      message: typeof message === "function" ? message(head) : message,
      tree: newTree.sha,
      parents: [head.oid],
    });

    const res = await send(`${API}/repos/${env.GITHUB_REPO}/git/refs/heads/${env.GITHUB_BRANCH}`, {
      method: "PATCH",
      headers: { ...headers(env), "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    if (res.ok) return { commit: commit.sha, changed: true };
    if (res.status !== 422 || attempt >= MAX_TRIES) throw await failure(res);
  }
}
