import type { Env } from "./env.ts";
import type { RunModel } from "./model.ts";

// A Map-based stand-in for Workers KV, with the calls that the Worker makes.
export class FakeKV {
  readonly data = new Map<string, string>();
  readonly metadata = new Map<string, unknown>();

  async get(key: string, type?: "text" | "json"): Promise<unknown> {
    const value = this.data.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key: string, value: string, options: { metadata?: unknown } = {}): Promise<void> {
    this.data.set(key, value);
    this.metadata.set(key, options.metadata);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
    this.metadata.delete(key);
  }

  async list({ prefix = "" }: { prefix?: string } = {}) {
    const keys = [...this.data.keys()]
      .filter((k) => k.startsWith(prefix))
      .sort()
      .map((name) => ({ name, metadata: this.metadata.get(name) }));
    return { keys, list_complete: true, cacheStatus: null };
  }
}

export const ORIGIN = "https://palmares.example";

// A test sets AI.run to answer as the model would.
export function testEnv(overrides: Partial<Env> = {}): Env & { AUTH: FakeKV; AI: { run: RunModel } } {
  return {
    AUTH: new FakeKV(),
    AI: { run: async () => ({ response: "{}" }) },
    GITHUB_TOKEN: "test-token",
    SESSION_SECRET: "test-secret-that-is-long-enough-1234567890",
    SETUP_CODE: "open-sesame-setup-code",
    ORIGIN,
    RP_ID: "palmares.example",
    GITHUB_REPO: "owner/repo",
    GITHUB_BRANCH: "admin-test",
    ...overrides,
  } as unknown as Env & { AUTH: FakeKV; AI: { run: RunModel } };
}

// Turns the Set-Cookie values of a response into a Cookie header for the next request.
export function cookieHeader(setCookies: string[]): string {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

// The Workers type of a request also holds `cf` data. The tests do not use it.
export function apiRequest(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Request<unknown, IncomingRequestCfProperties> {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("Cookie", init.cookie);
  return new Request(`${ORIGIN}${path}`, { ...init, headers }) as Request<unknown, IncomingRequestCfProperties>;
}
