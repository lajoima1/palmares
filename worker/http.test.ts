import { describe, expect, it } from "vitest";
import worker from "./index.ts";
import { MODELS } from "./model.ts";
import { handleApi } from "./router.ts";
import { checkOrigin, HttpError, readJson } from "./http.ts";
import { createSession } from "./session.ts";
import { apiRequest, cookieHeader, ORIGIN, testEnv } from "./testEnv.ts";

describe("checkOrigin", () => {
  const env = testEnv();

  it("lets GET and HEAD through with any Origin", () => {
    expect(() => checkOrigin(apiRequest("/api/x"), env)).not.toThrow();
    expect(() => checkOrigin(apiRequest("/api/x", { method: "HEAD" }), env)).not.toThrow();
  });

  it("needs the site Origin for each write", () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      expect(() => checkOrigin(apiRequest("/api/x", { method, headers: { Origin: ORIGIN } }), env)).not.toThrow();
      for (const origin of [undefined, "https://evil.example", `${ORIGIN}.evil.example`, "null"]) {
        const headers: Record<string, string> = origin ? { Origin: origin } : {};
        expect(() => checkOrigin(apiRequest("/api/x", { method, headers }), env)).toThrow(HttpError);
      }
    }
  });
});

describe("readJson", () => {
  it("gives 413 above the limit and 400 for bad JSON", async () => {
    const big = apiRequest("/api/x", { method: "POST", body: "x".repeat(11) });
    await expect(readJson(big, 10)).rejects.toMatchObject({ status: 413 });
    const bad = apiRequest("/api/x", { method: "POST", body: "{nope" });
    await expect(readJson(bad, 100)).rejects.toMatchObject({ status: 400 });
    const ok = apiRequest("/api/x", { method: "POST", body: '{"a":1}' });
    expect(await readJson(ok, 100)).toEqual({ a: 1 });
  });
});

describe("router", () => {
  it("answers the health check, and 404 for other paths", async () => {
    const env = testEnv({ COMMIT: "abc" });
    const health = await worker.fetch(apiRequest("/api/health"), env);
    expect(await health.json()).toEqual({ status: "ok", commit: "abc" });
    expect((await handleApi(apiRequest("/api/nope"), env)).status).toBe(404);
    expect((await worker.fetch(apiRequest("/nope"), env)).status).toBe(404);
  });

  it("gives 405 for a known path with the wrong method", async () => {
    expect((await handleApi(apiRequest("/api/session", { method: "DELETE" }), testEnv())).status).toBe(405);
  });

  it("gives 403 to a write from another Origin", async () => {
    const res = await handleApi(
      apiRequest("/api/logout", { method: "POST", headers: { Origin: "https://evil.example" } }),
      testEnv(),
    );
    expect(res.status).toBe(403);
  });

  it("tells if the setup is open and if the owner is signed in", async () => {
    const env = testEnv({ TOKEN_EXPIRES: "2027-11-06" });
    let res = await handleApi(apiRequest("/api/session"), env);
    expect(await res.json()).toEqual({ signedIn: false, setupOpen: true });
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    await env.AUTH.put("setup:done", "1");
    await env.AUTH.put("passkey:pk1", JSON.stringify({ id: "pk1", userId: "u1" }));
    const cookie = cookieHeader(await createSession(env, { userId: "u1", passkeyId: "pk1" }));
    res = await handleApi(apiRequest("/api/session", { cookie }), env);
    expect(await res.json()).toEqual({
      signedIn: true,
      setupOpen: false,
      tokenExpires: "2027-11-06",
      models: [{ id: MODELS[0].id, name: "Mistral Small", company: "Cloudflare" }],
    });
  });

  it("lists the Google model only with its key, and no model with no service", async () => {
    async function models(overrides: Parameters<typeof testEnv>[0]) {
      const env = testEnv(overrides);
      await env.AUTH.put("passkey:pk1", JSON.stringify({ id: "pk1", userId: "u1" }));
      const cookie = cookieHeader(await createSession(env, { userId: "u1", passkeyId: "pk1" }));
      const res = await handleApi(apiRequest("/api/session", { cookie }), env);
      return (await res.json<{ models: { company: string }[] }>()).models.map((m) => m.company);
    }
    expect(await models({ GEMINI_API_KEY: "AQ.test-key" })).toEqual(["Cloudflare", "Google"]);
    expect(await models({ AI: undefined, GEMINI_API_KEY: "AQ.test-key" })).toEqual(["Google"]);
    expect(await models({ AI: undefined })).toEqual([]);
  });

  it("clears both cookies on sign-out", async () => {
    const res = await handleApi(apiRequest("/api/logout", { method: "POST", headers: { Origin: ORIGIN } }), testEnv());
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });
});
