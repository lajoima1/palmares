import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { Env } from "./env.ts";
import { HttpError, json, readJson } from "./http.ts";
import type { Context } from "./router.ts";
import {
  clearChallenge,
  createSession,
  fromBase64Url,
  setChallenge,
  takeChallenge,
  toBase64Url,
} from "./session.ts";

// KV keys:
//   user:<userId>           { id, name }
//   passkey:<credentialId>  StoredPasskey, with { userId, name, createdAt } as list metadata
//   setup:done              set by the first registration. Delete all keys to open the setup again.
export const SETUP_DONE_KEY = "setup:done";

// A passkey answer is a few KB. 64 KB leaves room and refuses a large body early.
const MAX_BODY = 64 * 1024;
const RP_NAME = "Palmarès";

interface StoredPasskey {
  id: string;
  userId: string;
  name: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  createdAt: string;
}

interface PasskeyMeta {
  userId: string;
  name: string;
  createdAt: string;
}

interface RegisterBody {
  response: RegistrationResponseJSON;
  name?: string;
}

const encoder = new TextEncoder();

// Hashing first gives two values of the same length, so the compare takes the same time for
// each wrong code.
async function sameSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all(
    [a, b].map(async (v) => new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(v)))),
  );
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function passkeyName(name: unknown): string {
  const text = typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, 50) : "";
  return text || "Passkey";
}

function withCookies(res: Response, cookies: string[]): Response {
  for (const c of cookies) res.headers.append("Set-Cookie", c);
  return res;
}

async function userPasskeys(env: Env, userId: string) {
  const { keys } = await env.AUTH.list<PasskeyMeta>({ prefix: "passkey:" });
  return keys
    .filter((k) => k.metadata?.userId === userId)
    .map((k) => ({ id: k.name.slice("passkey:".length), ...k.metadata! }));
}

function registrationOptions(env: Env, userId: string, exclude: string[]) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: env.RP_ID,
    userName: "owner",
    userDisplayName: "Palmarès owner",
    userID: fromBase64Url(userId),
    attestationType: "none",
    excludeCredentials: exclude.map((id) => ({ id })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
}

async function verifyRegistration(env: Env, body: RegisterBody, challenge: string) {
  try {
    const result = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
    });
    if (result.verified) return result.registrationInfo.credential;
  } catch (e) {
    console.error("registration check failed", e);
  }
  throw new HttpError(400, "The passkey check failed. Try again.");
}

async function storePasskey(
  env: Env,
  userId: string,
  name: string,
  credential: { id: string; publicKey: Uint8Array; counter: number; transports?: string[] },
): Promise<void> {
  const passkey: StoredPasskey = {
    id: credential.id,
    userId,
    name,
    publicKey: toBase64Url(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports,
    createdAt: new Date().toISOString(),
  };
  const metadata: PasskeyMeta = { userId, name, createdAt: passkey.createdAt };
  await env.AUTH.put(`passkey:${passkey.id}`, JSON.stringify(passkey), { metadata });
}

const EXPIRED = "The passkey prompt expired. Try again.";

export async function setupOptions({ request, env }: Context): Promise<Response> {
  const { code } = await readJson<{ code?: unknown }>(request, MAX_BODY);
  if (typeof code !== "string" || !(await sameSecret(code, env.SETUP_CODE))) {
    throw new HttpError(403, "The setup code is wrong.");
  }
  if ((await env.AUTH.get(SETUP_DONE_KEY)) !== null) {
    throw new HttpError(409, "A passkey exists. Sign in with it.");
  }
  const userId = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const options = await registrationOptions(env, userId, []);
  return withCookies(json(options), [await setChallenge(env, options.challenge, "setup", userId)]);
}

export async function setupVerify({ request, env }: Context): Promise<Response> {
  const challenge = await takeChallenge(request, env, "setup");
  if (!challenge?.userId) throw new HttpError(400, EXPIRED);
  if ((await env.AUTH.get(SETUP_DONE_KEY)) !== null) {
    throw new HttpError(409, "A passkey exists. Sign in with it.");
  }
  const body = await readJson<RegisterBody>(request, MAX_BODY);
  const credential = await verifyRegistration(env, body, challenge.challenge);
  const userId = challenge.userId;

  await env.AUTH.put(`user:${userId}`, JSON.stringify({ id: userId, name: "owner" }));
  await storePasskey(env, userId, passkeyName(body.name), credential);
  await env.AUTH.put(SETUP_DONE_KEY, new Date().toISOString());
  const session = await createSession(env, { userId, passkeyId: credential.id });
  return withCookies(json({ signedIn: true }), [...session, clearChallenge()]);
}

export async function loginOptions({ env }: Context): Promise<Response> {
  // No allowCredentials: the device offers its own passkey for this site.
  const options = await generateAuthenticationOptions({ rpID: env.RP_ID, userVerification: "required" });
  return withCookies(json(options), [await setChallenge(env, options.challenge, "login")]);
}

export async function loginVerify({ request, env }: Context): Promise<Response> {
  const challenge = await takeChallenge(request, env, "login");
  if (!challenge) throw new HttpError(400, EXPIRED);
  const response = await readJson<AuthenticationResponseJSON>(request, MAX_BODY);
  const stored =
    typeof response?.id === "string" ? await env.AUTH.get<StoredPasskey>(`passkey:${response.id}`, "json") : null;
  if (!stored) throw new HttpError(401, "This passkey is not registered for this site.");

  let newCounter: number;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
      credential: {
        id: stored.id,
        publicKey: fromBase64Url(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports,
      },
    });
    if (!result.verified) throw new Error("not verified");
    newCounter = result.authenticationInfo.newCounter;
  } catch (e) {
    console.error("sign-in check failed", e);
    throw new HttpError(401, "The passkey check failed. Try again.");
  }

  // Synced passkeys always send 0. Write only when the counter moves, to save KV writes.
  if (newCounter > stored.counter) {
    const metadata: PasskeyMeta = { userId: stored.userId, name: stored.name, createdAt: stored.createdAt };
    await env.AUTH.put(`passkey:${stored.id}`, JSON.stringify({ ...stored, counter: newCounter }), { metadata });
  }
  const session = await createSession(env, { userId: stored.userId, passkeyId: stored.id });
  return withCookies(json({ signedIn: true }), [...session, clearChallenge()]);
}

export async function listPasskeys({ env, session }: Context): Promise<Response> {
  const passkeys = await userPasskeys(env, session!.userId);
  return json(
    passkeys
      .map((p) => ({ ...p, current: p.id === session!.passkeyId }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

export async function addPasskeyOptions({ env, session }: Context): Promise<Response> {
  const existing = await userPasskeys(env, session!.userId);
  const options = await registrationOptions(env, session!.userId, existing.map((p) => p.id));
  return withCookies(json(options), [await setChallenge(env, options.challenge, "add", session!.userId)]);
}

export async function addPasskeyVerify({ request, env, session }: Context): Promise<Response> {
  const challenge = await takeChallenge(request, env, "add", session!.userId);
  if (!challenge) throw new HttpError(400, EXPIRED);
  const body = await readJson<RegisterBody>(request, MAX_BODY);
  const credential = await verifyRegistration(env, body, challenge.challenge);
  await storePasskey(env, session!.userId, passkeyName(body.name), credential);
  return withCookies(json({ added: true }), [clearChallenge()]);
}

export async function removePasskey({ env, session, params }: Context): Promise<Response> {
  const [id] = params;
  const stored = await env.AUTH.get<StoredPasskey>(`passkey:${id}`, "json");
  if (!stored || stored.userId !== session!.userId) throw new HttpError(404, "This passkey does not exist.");
  const passkeys = await userPasskeys(env, session!.userId);
  if (passkeys.filter((p) => p.id !== id).length === 0) {
    throw new HttpError(409, "You cannot remove your last passkey. Add another device first.");
  }
  await env.AUTH.delete(`passkey:${id}`);
  return json({ removed: true });
}
