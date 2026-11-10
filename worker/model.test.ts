import { afterEach, describe, expect, it, vi } from "vitest";
import { askModel, buildInput, geminiBody, ModelError, MODELS, modelsFor, SCHEMA, TIME_LIMIT, type ModelInfo } from "./model.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const KEY = "AQ.test-key";
const PHOTO = "/9j/4AAQSkZJRgABAQ==";
const TAGS = ["soup"];
const RECIPE = { found: true, name: "Potage" };
const gemini = MODELS.find((m) => m.service === "gemini")!;
const mistral = MODELS[0];

function geminiReply(over: Record<string, unknown> = {}) {
  return {
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: "Let me read it.", thought: true }, { text: JSON.stringify(RECIPE) }] },
      },
    ],
    ...over,
  };
}

function stubFetch(status: number, body: unknown) {
  const spy = vi.fn<typeof fetch>(
    async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

async function kindOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
    return "no error";
  } catch (e) {
    return e instanceof ModelError ? e.kind : `other: ${e}`;
  }
}

describe("MODELS", () => {
  it("starts with Mistral Small, and each id appears once", () => {
    expect(mistral.name).toBe("Mistral Small");
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(MODELS.length);
  });
});

describe("modelsFor", () => {
  const ids = (list: ModelInfo[]) => list.map((m) => m.service);

  it("lists a service only if it is set up", () => {
    expect(ids(modelsFor({ AI: {} }))).not.toContain("gemini");
    expect(ids(modelsFor({ GEMINI_API_KEY: KEY }))).not.toContain("workers-ai");
    expect(modelsFor({ AI: {}, GEMINI_API_KEY: KEY })).toEqual(MODELS);
    expect(modelsFor({ GEMINI_API_KEY: "" })).toEqual([]);
  });
});

describe("geminiBody", () => {
  it("sends the same rules and schema as Workers AI, and the photo inline", () => {
    const body = geminiBody({ image: PHOTO }, TAGS, gemini) as {
      systemInstruction: { parts: { text: string }[] };
      contents: { parts: Record<string, unknown>[] }[];
      generationConfig: Record<string, unknown>;
    };
    const input = buildInput({ image: PHOTO }, TAGS, mistral) as { messages: { content: unknown }[] };
    expect(body.systemInstruction.parts[0].text).toBe(input.messages[0].content);
    expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: "image/jpeg", data: PHOTO } });
    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: SCHEMA,
      maxOutputTokens: gemini.maxTokens,
      thinkingConfig: { thinkingLevel: gemini.thinkingLevel },
    });
  });

  it("sends a text as one part", () => {
    const body = geminiBody({ text: "Soupe" }, TAGS, gemini) as { contents: { parts: unknown[] }[] };
    expect(body.contents[0].parts).toEqual([{ text: "Read the recipe in this text:\n\nSoupe" }]);
  });
});

describe("askModel with Gemini", () => {
  const ask = () => askModel(gemini, { geminiKey: KEY }, { image: PHOTO }, TAGS);

  it("puts the key in a header, never in the URL, and skips the thought parts", async () => {
    const spy = stubFetch(200, geminiReply());
    expect(await ask()).toEqual(RECIPE);
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${gemini.id}:generateContent`);
    expect(String(url)).not.toContain(KEY);
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
  });

  it("maps each error to a kind", async () => {
    const daily = { error: { code: 429, details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] } };
    const minute = { error: { code: 429, details: [{ violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }] }] } };
    const cases: [number, unknown, string][] = [
      [429, daily, "daily"],
      [429, minute, "busy"],
      [503, { error: { status: "UNAVAILABLE" } }, "busy"],
      [403, { error: { status: "PERMISSION_DENIED" } }, "failed"],
      [400, { error: { message: "User location is not supported for the API use." } }, "failed"],
      [404, { error: { status: "NOT_FOUND" } }, "failed"],
      [500, "", "failed"],
      [200, "not json", "unreadable"],
      [200, geminiReply({ promptFeedback: { blockReason: "SAFETY" } }), "unreadable"],
      [200, { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "{" }] } }] }, "unreadable"],
      [200, { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "x", thought: true }] } }] }, "unreadable"],
    ];
    for (const [status, body, kind] of cases) {
      stubFetch(status, body);
      expect([status, await kindOf(ask())]).toEqual([status, kind]);
    }
  });

  it("gives failed on a network error, or with no key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(await kindOf(ask())).toBe("failed");
    expect(await kindOf(askModel(gemini, {}, { text: "Soupe" }, TAGS))).toBe("failed");
  });
});

describe("askModel with Workers AI", () => {
  it("reads the answer and sends the cap and the JSON mode of the model", async () => {
    const run = vi.fn(async () => ({ response: JSON.stringify(RECIPE) }));
    expect(await askModel(mistral, { ai: run }, { text: "Soupe" }, TAGS)).toEqual(RECIPE);
    expect(run).toHaveBeenCalledWith(
      mistral.id,
      expect.objectContaining({ max_tokens: mistral.maxTokens, response_format: expect.any(Object) }),
    );
  });

  it("gives failed for an ended model, or with no binding", async () => {
    const run = vi.fn(async () => Promise.reject(new Error("5028: This model is no longer available (410)")));
    expect(await kindOf(askModel(mistral, { ai: run }, { text: "Soupe" }, TAGS))).toBe("failed");
    expect(await kindOf(askModel(mistral, {}, { text: "Soupe" }, TAGS))).toBe("failed");
  });

  it("stops waiting after the time limit", async () => {
    vi.useFakeTimers();
    const run = vi.fn(() => new Promise<unknown>(() => {}));
    const kind = kindOf(askModel(mistral, { ai: run }, { text: "Soupe" }, TAGS));
    await vi.advanceTimersByTimeAsync(TIME_LIMIT);
    expect(await kind).toBe("failed");
  });
});
