import type { Env } from "./env.ts";
import { checkOrigin, error, HttpError, json } from "./http.ts";
import {
  addPasskeyOptions,
  addPasskeyVerify,
  listPasskeys,
  loginOptions,
  loginVerify,
  removePasskey,
  SETUP_DONE_KEY,
  setupOptions,
  setupVerify,
} from "./passkeys.ts";
import { readHandler } from "./read.ts";
import { createHandler, deleteHandler, getHandler, imageHandler, listHandler, updateHandler } from "./recipes.ts";
import { clearSession, readSession, type Session } from "./session.ts";

export interface Context {
  request: Request;
  env: Env;
  params: string[];
  session: Session | null;
}

interface Route {
  method: string;
  path: RegExp;
  // true: a request with no valid session gets 401 before the handler runs.
  session: boolean;
  handle: (ctx: Context) => Response | Promise<Response>;
}

const routes: Route[] = [
  {
    method: "GET",
    path: /^\/api\/session$/,
    session: false,
    handle: async ({ env, session }) =>
      json({
        signedIn: session !== null,
        setupOpen: (await env.AUTH.get(SETUP_DONE_KEY)) === null,
        ...(session && env.TOKEN_EXPIRES ? { tokenExpires: env.TOKEN_EXPIRES } : {}),
      }),
  },
  {
    method: "POST",
    path: /^\/api\/logout$/,
    session: false,
    handle: () => {
      const res = json({ signedIn: false });
      for (const c of clearSession()) res.headers.append("Set-Cookie", c);
      return res;
    },
  },
  { method: "POST", path: /^\/api\/setup\/options$/, session: false, handle: setupOptions },
  { method: "POST", path: /^\/api\/setup\/verify$/, session: false, handle: setupVerify },
  { method: "POST", path: /^\/api\/login\/options$/, session: false, handle: loginOptions },
  { method: "POST", path: /^\/api\/login\/verify$/, session: false, handle: loginVerify },
  { method: "GET", path: /^\/api\/passkeys$/, session: true, handle: listPasskeys },
  { method: "POST", path: /^\/api\/passkeys\/options$/, session: true, handle: addPasskeyOptions },
  { method: "POST", path: /^\/api\/passkeys\/verify$/, session: true, handle: addPasskeyVerify },
  { method: "DELETE", path: /^\/api\/passkeys\/([^/]+)$/, session: true, handle: removePasskey },
  { method: "GET", path: /^\/api\/recipes$/, session: true, handle: listHandler },
  { method: "POST", path: /^\/api\/recipes$/, session: true, handle: createHandler },
  { method: "POST", path: /^\/api\/recipes\/read$/, session: true, handle: readHandler },
  { method: "GET", path: /^\/api\/recipes\/([^/]+)$/, session: true, handle: getHandler },
  { method: "PUT", path: /^\/api\/recipes\/([^/]+)$/, session: true, handle: updateHandler },
  { method: "DELETE", path: /^\/api\/recipes\/([^/]+)$/, session: true, handle: deleteHandler },
  { method: "GET", path: /^\/api\/recipes\/([^/]+)\/image$/, session: true, handle: imageHandler },
];

export function health(request: Request, env: Env): Response {
  // Uptime monitors often probe with HEAD. The runtime drops the body for HEAD.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  return Response.json(env.COMMIT ? { status: "ok", commit: env.COMMIT } : { status: "ok" });
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  const matches = routes.filter((r) => r.path.test(pathname));
  if (matches.length === 0) return error(404, "Not found.");
  const route = matches.find((r) => r.method === request.method);
  if (!route) return error(405, "Method not allowed.");

  try {
    checkOrigin(request, env);
    const session = await readSession(request, env);
    if (route.session && !session) return error(401, "Sign in first.");
    const params = pathname.match(route.path)!.slice(1).map(decodeURIComponent);
    return await route.handle({ request, env, params, session });
  } catch (e) {
    if (e instanceof HttpError) return error(e.status, e.message);
    if (e instanceof URIError) return error(400, "The address is not valid.");
    console.error(e);
    return error(500, "Something went wrong. Try again.");
  }
}
