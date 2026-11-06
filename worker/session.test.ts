import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSession,
  createSession,
  MAX_AGE,
  readSession,
  setChallenge,
  takeChallenge,
} from "./session.ts";
import { apiRequest, cookieHeader, testEnv } from "./testEnv.ts";

async function signedIn() {
  const env = testEnv();
  await env.AUTH.put("passkey:pk1", JSON.stringify({ id: "pk1", userId: "u1" }));
  const setCookies = await createSession(env, { userId: "u1", passkeyId: "pk1" });
  return { env, setCookies, cookie: cookieHeader(setCookies) };
}

afterEach(() => vi.useRealTimers());

describe("session cookie", () => {
  it("sets the session and the marker cookie with the right attributes", async () => {
    const { setCookies } = await signedIn();
    expect(setCookies[0]).toMatch(
      new RegExp(`^__Host-session=[^;]+; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}$`),
    );
    expect(setCookies[1]).toBe(`palmares_editor=1; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`);
  });

  it("reads a valid session", async () => {
    const { env, cookie } = await signedIn();
    expect(await readSession(apiRequest("/api/x", { cookie }), env)).toEqual({ userId: "u1", passkeyId: "pk1" });
  });

  it("refuses a changed payload or signature", async () => {
    const { env, cookie } = await signedIn();
    const [name, value] = cookie.split("; ")[0].split("=");
    const [body, mac] = value.split(".");
    const forged = btoa(JSON.stringify({ u: "u2", p: "pk1", exp: 9999999999 })).replace(/=+$/, "");
    for (const bad of [`${forged}.${mac}`, `${body}.${mac.slice(0, -2)}AA`, body, `${body}.${mac}.x`]) {
      expect(await readSession(apiRequest("/api/x", { cookie: `${name}=${bad}` }), env)).toBeNull();
    }
  });

  it("refuses a cookie signed with another secret", async () => {
    const { cookie } = await signedIn();
    const other = testEnv({ SESSION_SECRET: "another-secret" });
    await other.AUTH.put("passkey:pk1", JSON.stringify({ id: "pk1", userId: "u1" }));
    expect(await readSession(apiRequest("/api/x", { cookie }), other)).toBeNull();
  });

  it("refuses an expired session", async () => {
    const { env, cookie } = await signedIn();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (MAX_AGE + 1) * 1000);
    expect(await readSession(apiRequest("/api/x", { cookie }), env)).toBeNull();
  });

  it("ends the session when its passkey is removed", async () => {
    const { env, cookie } = await signedIn();
    await env.AUTH.delete("passkey:pk1");
    expect(await readSession(apiRequest("/api/x", { cookie }), env)).toBeNull();
  });

  it("clears both cookies", () => {
    expect(clearSession().every((c) => c.includes("=;") && c.endsWith("Max-Age=0"))).toBe(true);
  });
});

describe("challenge cookie", () => {
  it("gives the challenge back for the same purpose", async () => {
    const env = testEnv();
    const cookie = cookieHeader([await setChallenge(env, "abc", "setup")]);
    expect(await takeChallenge(apiRequest("/api/x", { cookie }), env, "setup")).toBe("abc");
  });

  it("refuses a challenge made for another purpose", async () => {
    const env = testEnv();
    const cookie = cookieHeader([await setChallenge(env, "abc", "login")]);
    expect(await takeChallenge(apiRequest("/api/x", { cookie }), env, "setup")).toBeNull();
  });

  it("refuses an add challenge of another user", async () => {
    const env = testEnv();
    const cookie = cookieHeader([await setChallenge(env, "abc", "add", "u1")]);
    expect(await takeChallenge(apiRequest("/api/x", { cookie }), env, "add", "u2")).toBeNull();
    expect(await takeChallenge(apiRequest("/api/x", { cookie }), env, "add", "u1")).toBe("abc");
  });

  it("refuses a challenge after 5 minutes", async () => {
    const env = testEnv();
    const cookie = cookieHeader([await setChallenge(env, "abc", "login")]);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 301_000);
    expect(await takeChallenge(apiRequest("/api/x", { cookie }), env, "login")).toBeNull();
  });
});
