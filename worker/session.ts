import type { Env } from "./env.ts";

// 30 days in seconds. After that the owner signs in again with the passkey.
export const MAX_AGE = 30 * 24 * 60 * 60;
// 5 minutes in seconds: the time to answer one passkey prompt.
export const CHALLENGE_MAX_AGE = 5 * 60;

const SESSION_COOKIE = "__Host-session";
const CHALLENGE_COOKIE = "__Host-challenge";
// Not secret and readable by the main page, which shows the admin link if it is set.
const EDITOR_COOKIE = "palmares_editor";

export interface Session {
  userId: string;
  passkeyId: string;
}

export type ChallengePurpose = "setup" | "login" | "add";

export interface Challenge {
  challenge: string;
  purpose: ChallengePurpose;
  userId?: string;
}

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const text = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}

function hmacKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(env: Env, payload: object, maxAge: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const body = toBase64Url(encoder.encode(JSON.stringify({ ...payload, exp })));
  const mac = await crypto.subtle.sign("HMAC", await hmacKey(env), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(mac))}`;
}

// Returns null for a missing, changed or expired value. crypto.subtle.verify compares in
// constant time.
async function unsign<T>(env: Env, value: string | undefined): Promise<T | null> {
  const [body, mac, extra] = value?.split(".") ?? [];
  if (!body || !mac || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), fromBase64Url(mac), encoder.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (typeof payload.exp !== "number" || payload.exp <= Date.now() / 1000) return null;
    return payload as T;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

function cookie(name: string, value: string, maxAge: number, httpOnly = true): string {
  return `${name}=${value}; ${httpOnly ? "HttpOnly; " : ""}Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export async function createSession(env: Env, session: Session): Promise<string[]> {
  const value = await sign(env, { u: session.userId, p: session.passkeyId }, MAX_AGE);
  return [cookie(SESSION_COOKIE, value, MAX_AGE), cookie(EDITOR_COOKIE, "1", MAX_AGE, false)];
}

export function clearSession(): string[] {
  return [cookie(SESSION_COOKIE, "", 0), cookie(EDITOR_COOKIE, "", 0, false)];
}

// The session ends at once if its passkey was removed, even before the cookie expires.
export async function readSession(request: Request, env: Env): Promise<Session | null> {
  const payload = await unsign<{ u: string; p: string }>(env, readCookie(request, SESSION_COOKIE));
  if (!payload) return null;
  const passkey = await env.AUTH.get<{ userId: string }>(`passkey:${payload.p}`, "json");
  if (!passkey || passkey.userId !== payload.u) return null;
  return { userId: payload.u, passkeyId: payload.p };
}

export async function setChallenge(
  env: Env,
  challenge: string,
  purpose: ChallengePurpose,
  userId?: string,
): Promise<string> {
  const value = await sign(env, { challenge, purpose, userId }, CHALLENGE_MAX_AGE);
  return cookie(CHALLENGE_COOKIE, value, CHALLENGE_MAX_AGE);
}

// A challenge works only for the step that made it. Else the public sign-in options could
// open the first setup, which needs the setup code. With `userId`, the challenge must be for
// that user.
export async function takeChallenge(
  request: Request,
  env: Env,
  purpose: ChallengePurpose,
  userId?: string,
): Promise<Challenge | null> {
  const payload = await unsign<Challenge>(env, readCookie(request, CHALLENGE_COOKIE));
  if (!payload || payload.purpose !== purpose) return null;
  if (userId !== undefined && payload.userId !== userId) return null;
  return payload;
}

export function clearChallenge(): string {
  return cookie(CHALLENGE_COOKIE, "", 0);
}
