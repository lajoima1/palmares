interface Env {
  // The commit that Workers Builds deployed. Empty in a local `wrangler dev`.
  COMMIT?: string;
}

// Cloudflare serves the files in dist/ first. Only a path with no file reaches this handler.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return Response.json(env.COMMIT ? { status: "ok", commit: env.COMMIT } : { status: "ok" });
    }
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
