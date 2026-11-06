import type { FolderEntry } from "./github.ts";

interface Recipe {
  text: string;
  files: FolderEntry[];
}

// Answers the GitHub calls that the Worker makes, from a small in-memory repo. Each request is
// kept in `calls`, so a test can check what the Worker sent.
export class FakeGitHub {
  head = "c0";
  index: string[] = [];
  recipes: Record<string, Recipe> = {};
  // Answers for the next moves of the branch. Empty means 200.
  patchStatus: number[] = [];
  // Runs before each read of the head, with the read number (1, 2, …).
  onHeadRead: (n: number) => void = () => {};
  calls: { method: string; path: string; body: unknown }[] = [];
  private headReads = 0;
  private counter = 0;

  addRecipe(slug: string, text: string, withImage = false): void {
    const files = [{ name: "recipe.txt", oid: `oid-${slug}-${++this.counter}` }];
    if (withImage) files.push({ name: "image.webp", oid: `img-${slug}` });
    this.recipes[slug] = { text, files };
    if (!this.index.includes(slug)) this.index.push(slug);
  }

  calledPaths(): string[] {
    return this.calls.map((c) => `${c.method} ${c.path}`);
  }

  readonly fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const path = url.pathname.replace(/^\/repos\/owner\/repo/, "");
    this.calls.push({ method, path, body });

    if (path === "/graphql") return this.graphql(body);
    if (method === "POST" && path === "/git/blobs") return Response.json({ sha: `blob-${++this.counter}` });
    if (method === "POST" && path === "/git/trees") return Response.json({ sha: `tree-${++this.counter}` });
    if (method === "POST" && path === "/git/commits") return Response.json({ sha: `commit-${++this.counter}` });
    if (method === "PATCH" && path.startsWith("/git/refs/heads/")) {
      const status = this.patchStatus.shift() ?? 200;
      if (status !== 200) return Response.json({ message: "Update is not a fast forward" }, { status });
      this.head = body.sha;
      return Response.json({ object: { sha: body.sha } });
    }
    const image = path.match(/^\/contents\/recipes\/([^/]+)\/image\.webp$/);
    if (image) {
      const has = this.recipes[image[1]]?.files.some((f) => f.name === "image.webp");
      return has ? new Response(new Uint8Array([82, 73, 70, 70])) : new Response("{}", { status: 404 });
    }
    return Response.json({ message: "Not Found" }, { status: 404 });
  };

  private graphql({ query, variables }: { query: string; variables: Record<string, string> }): Response {
    if (query.includes("ref(qualifiedName")) {
      this.onHeadRead(++this.headReads);
      const slug = variables.folder.split("/").pop()!;
      const recipe = this.recipes[slug];
      return Response.json({
        data: {
          repository: {
            ref: { target: { oid: this.head, tree: { oid: `tree-of-${this.head}` } } },
            folder: recipe ? { entries: recipe.files } : null,
            index: { text: JSON.stringify(this.index) },
            recipe: recipe ? { text: recipe.text } : null,
          },
        },
      });
    }
    return Response.json({
      data: {
        repository: {
          recipes: {
            entries: Object.entries(this.recipes).map(([slug, r]) => ({
              name: slug,
              oid: `folder-${r.files.map((f) => f.oid).join("+")}`,
              object: { entries: r.files.map((f) => ({ ...f, object: f.name === "recipe.txt" ? { text: r.text } : {} })) },
            })),
          },
          index: { text: JSON.stringify(this.index) },
          ...(variables.hasDeployed ? { deployed: { entries: this.deployed } } : {}),
        },
      },
    });
  }

  // The folder oids of the deployed commit, for the "Not live yet" mark.
  deployed: FolderEntry[] = [];
  snapshotDeployed(): void {
    this.deployed = Object.entries(this.recipes).map(([slug, r]) => ({
      name: slug,
      oid: `folder-${r.files.map((f) => f.oid).join("+")}`,
    }));
  }
}
