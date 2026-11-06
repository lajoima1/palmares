import type { Env } from "./env.ts";
import { handleApi, health } from "./router.ts";

// Cloudflare serves the files in dist/ first. Only a path with no file reaches this handler.
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/health") return health(request, env);
    if (pathname.startsWith("/api/")) return handleApi(request, env);
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
