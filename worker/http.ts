import type { Env } from "./env.ts";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// API answers hold private data, so no cache keeps them.
export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const res = Response.json(body, { status, headers });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

export async function readJson<T>(request: Request, maxBytes: number): Promise<T> {
  if (Number(request.headers.get("Content-Length") ?? 0) > maxBytes) {
    throw new HttpError(413, "The request is too large.");
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > maxBytes) {
    throw new HttpError(413, "The request is too large.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.");
  }
}

// SameSite=Strict already stops other sites from sending the cookie. This check also stops a
// branch preview, which is same-site but has another address.
export function checkOrigin(request: Request, env: Env): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  if (request.headers.get("Origin") !== env.ORIGIN) {
    throw new HttpError(403, "This request must come from the admin page.");
  }
}
