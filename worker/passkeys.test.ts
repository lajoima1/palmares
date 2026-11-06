import { describe, expect, it } from "vitest";
import { handleApi } from "./router.ts";
import { createSession, setChallenge } from "./session.ts";
import { apiRequest, cookieHeader, ORIGIN, testEnv } from "./testEnv.ts";

type TestEnv = ReturnType<typeof testEnv>;

function post(env: TestEnv, path: string, body: unknown, cookie?: string) {
  return handleApi(
    apiRequest(path, {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cookie,
    }),
    env,
  );
}

async function addPasskey(env: TestEnv, id: string, userId: string) {
  const createdAt = new Date().toISOString();
  await env.AUTH.put(`passkey:${id}`, JSON.stringify({ id, userId, name: id, publicKey: "", counter: 0, createdAt }), {
    metadata: { userId, name: id, createdAt },
  });
}

async function signedIn(passkeys = ["pk1"]) {
  const env = testEnv();
  await env.AUTH.put("setup:done", "1");
  for (const id of passkeys) await addPasskey(env, id, "u1");
  const cookie = cookieHeader(await createSession(env, { userId: "u1", passkeyId: passkeys[0] }));
  return { env, cookie };
}

describe("first setup", () => {
  it("refuses a wrong or missing setup code", async () => {
    const env = testEnv();
    expect((await post(env, "/api/setup/options", { code: "wrong" })).status).toBe(403);
    expect((await post(env, "/api/setup/options", {})).status).toBe(403);
  });

  it("gives options that need a discoverable passkey and user verification", async () => {
    const env = testEnv();
    const res = await post(env, "/api/setup/options", { code: env.SETUP_CODE });
    expect(res.status).toBe(200);
    const options = await res.json<Record<string, unknown>>();
    expect(options.rp).toEqual({ name: "Palmarès", id: env.RP_ID });
    expect(options.authenticatorSelection).toMatchObject({ residentKey: "required", userVerification: "required" });
    expect(options.attestation).toBe("none");
    expect(res.headers.getSetCookie()[0]).toMatch(/^__Host-challenge=.+; HttpOnly; Secure; SameSite=Strict; Path=\//);
  });

  it("is closed when a passkey exists", async () => {
    const env = testEnv();
    await env.AUTH.put("setup:done", "1");
    expect((await post(env, "/api/setup/options", { code: env.SETUP_CODE })).status).toBe(409);
    const cookie = cookieHeader([await setChallenge(env, "abc", "setup", "u9")]);
    expect((await post(env, "/api/setup/verify", { response: {} }, cookie)).status).toBe(409);
  });

  it("refuses a challenge from the public sign-in options", async () => {
    const env = testEnv();
    const login = await post(env, "/api/login/options", {});
    const cookie = cookieHeader(login.headers.getSetCookie());
    const res = await post(env, "/api/setup/verify", { response: { id: "x" } }, cookie);
    expect(res.status).toBe(400);
    expect(await env.AUTH.get("setup:done")).toBeNull();
  });
});

describe("sign-in", () => {
  it("gives options with no credential list and user verification", async () => {
    const res = await post(testEnv(), "/api/login/options", {});
    const options = await res.json<Record<string, unknown>>();
    expect(options.userVerification).toBe("required");
    expect(options.allowCredentials ?? []).toEqual([]);
  });

  it("refuses an unknown passkey", async () => {
    const env = testEnv();
    const cookie = cookieHeader((await post(env, "/api/login/options", {})).headers.getSetCookie());
    expect((await post(env, "/api/login/verify", { id: "nope" }, cookie)).status).toBe(401);
  });

  it("refuses an answer without a challenge", async () => {
    expect((await post(testEnv(), "/api/login/verify", { id: "pk1" })).status).toBe(400);
  });
});

describe("passkey list", () => {
  it("needs a session", async () => {
    const env = testEnv();
    expect((await handleApi(apiRequest("/api/passkeys"), env)).status).toBe(401);
    expect((await post(env, "/api/passkeys/options", {})).status).toBe(401);
  });

  it("lists only the passkeys of the user, and marks the current one", async () => {
    const { env, cookie } = await signedIn(["pk1", "pk2"]);
    await addPasskey(env, "other", "u2");
    const res = await handleApi(apiRequest("/api/passkeys", { cookie }), env);
    const list = await res.json<{ id: string; current: boolean }[]>();
    expect(list.map((p) => [p.id, p.current])).toEqual([
      ["pk1", true],
      ["pk2", false],
    ]);
  });

  it("refuses to remove the last passkey", async () => {
    const { env, cookie } = await signedIn(["pk1"]);
    const res = await handleApi(apiRequest("/api/passkeys/pk1", { method: "DELETE", headers: { Origin: ORIGIN }, cookie }), env);
    expect(res.status).toBe(409);
  });

  it("removes another passkey, and its session ends", async () => {
    const { env, cookie } = await signedIn(["pk1", "pk2"]);
    const pk2Cookie = cookieHeader(await createSession(env, { userId: "u1", passkeyId: "pk2" }));
    const res = await handleApi(apiRequest("/api/passkeys/pk2", { method: "DELETE", headers: { Origin: ORIGIN }, cookie }), env);
    expect(res.status).toBe(200);
    expect((await handleApi(apiRequest("/api/passkeys", { cookie: pk2Cookie }), env)).status).toBe(401);
  });

  it("does not remove a passkey of another user", async () => {
    const { env, cookie } = await signedIn(["pk1", "pk2"]);
    await addPasskey(env, "other", "u2");
    const res = await handleApi(apiRequest("/api/passkeys/other", { method: "DELETE", headers: { Origin: ORIGIN }, cookie }), env);
    expect(res.status).toBe(404);
    expect(await env.AUTH.get("passkey:other")).not.toBeNull();
  });

  it("refuses an add challenge made for another user", async () => {
    const { env, cookie } = await signedIn();
    const challenge = cookieHeader([await setChallenge(env, "abc", "add", "u2")]);
    const res = await post(env, "/api/passkeys/verify", { response: {} }, `${cookie}; ${challenge}`);
    expect(res.status).toBe(400);
  });
});
