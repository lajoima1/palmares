import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODEL, type RunModel } from "./model.ts";
import { cleanAnswer, pageText, readPage } from "./read.ts";
import { handleApi } from "./router.ts";
import { createSession } from "./session.ts";
import { apiRequest, cookieHeader, ORIGIN, testEnv } from "./testEnv.ts";

afterEach(() => vi.unstubAllGlobals());

const TAGS = ["soup", "main", "made by mom"];

const answer = (over: Record<string, unknown> = {}) => ({
  found: true,
  name: "Potage aux carottes",
  description: "Un potage doux.",
  servings: "6 portions",
  prep_time: "15 minutes",
  cook_time: "35 minutes",
  total_time: "50 minutes",
  difficulty: "Easy",
  tags: ["soup"],
  ingredients: ["1 oignon", "900 g de carottes"],
  instructions: ["Cuire l’oignon.", "Ajouter les carottes."],
  notes: [],
  ...over,
});

function page(body: BodyInit, init: ResponseInit = {}) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, init)));
}

describe("cleanAnswer", () => {
  it("keeps a full answer", () => {
    expect(cleanAnswer(answer(), TAGS)).toEqual({
      name: "Potage aux carottes",
      description: "Un potage doux.",
      servings: "6 portions",
      prep_time: "15 minutes",
      cook_time: "35 minutes",
      total_time: "50 minutes",
      difficulty: "Easy",
      tags: ["soup"],
      ingredients: ["1 oignon", "900 g de carottes"],
      instructions: ["Cuire l’oignon.", "Ajouter les carottes."],
      notes: [],
    });
  });

  it("gives null with no recipe or no name", () => {
    expect(cleanAnswer(answer({ found: false }), TAGS)).toBeNull();
    expect(cleanAnswer(answer({ name: "  " }), TAGS)).toBeNull();
    expect(cleanAnswer("text", TAGS)).toBeNull();
    expect(cleanAnswer(null, TAGS)).toBeNull();
  });

  it("drops an unknown tag and takes the spelling of the list", () => {
    expect(cleanAnswer(answer({ tags: ["Soup", "vegetable", "MADE BY MOM", 3] }), TAGS)?.tags).toEqual([
      "soup",
      "made by mom",
    ]);
  });

  it("gives no tags with an empty tag list", () => {
    expect(cleanAnswer(answer(), [])?.tags).toEqual([]);
  });

  it("drops an unknown difficulty and fixes the case of a known one", () => {
    expect(cleanAnswer(answer({ difficulty: "Facile" }), TAGS)?.difficulty).toBe("");
    expect(cleanAnswer(answer({ difficulty: "medium" }), TAGS)?.difficulty).toBe("Medium");
  });

  it("removes line breaks, list marks and step numbers", () => {
    const fields = cleanAnswer(
      answer({
        name: "Potage\naux carottes",
        ingredients: ["- 1 oignon\n- 2 carottes", "## Pour la crème:", 7],
        instructions: ["1. Cuire.", "2. Servir."],
        notes: ["- Se congèle."],
      }),
      TAGS,
    );
    expect(fields?.name).toBe("Potage aux carottes");
    expect(fields?.ingredients).toEqual(["1 oignon", "2 carottes", "## Pour la crème:"]);
    expect(fields?.instructions).toEqual(["Cuire.", "Servir."]);
    expect(fields?.notes).toEqual(["Se congèle."]);
  });

  it("cuts a long name", () => {
    expect(cleanAnswer(answer({ name: "a".repeat(150) }), TAGS)?.name).toHaveLength(100);
  });
});

describe("pageText", () => {
  const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

  it("takes the recipe data from @graph, with no photo", () => {
    const html = `<html><head>${ld({ "@graph": [{ "@type": "WebPage" }, { "@type": ["Recipe"], name: "Macaroni", recipeIngredient: ["1 lb"], image: "https://x/y.jpg", author: "A" }] })}</head><body>Menu</body></html>`;
    expect(JSON.parse(pageText(html))).toEqual({ name: "Macaroni", recipeIngredient: ["1 lb"] });
  });

  it("finds a recipe under mainEntity, or with a full type name", () => {
    expect(JSON.parse(pageText(ld({ "@type": "WebPage", mainEntity: { "@type": "schema:Recipe", name: "Tarte" } })))).toEqual({
      name: "Tarte",
    });
    expect(JSON.parse(pageText(ld({ "@type": "https://schema.org/Recipe", name: "Pain" })))).toEqual({ name: "Pain" });
  });

  it("keeps the text of <header> and <form>", () => {
    expect(pageText(`<form id="page"><article><header><h1>Pâté chinois</h1></header><p>3 patates</p></article></form>`)).toBe(
      "Pâté chinois\n3 patates",
    );
  });

  it("skips a broken block", () => {
    const html = `<script type="application/ld+json">{broken</script>${ld([{ "@type": "Recipe", name: "Soupe" }])}`;
    expect(JSON.parse(pageText(html))).toEqual({ name: "Soupe" });
  });

  it("takes the visible text if the page has no recipe data", () => {
    const html = `<html><head><style>p{}</style><script>var a = 1;</script></head><body><nav>Accueil</nav>
      <h1>Soupe &amp; pain</h1><p>2&nbsp;tasses d&#8217;eau</p><!-- note --><footer>©</footer></body></html>`;
    expect(pageText(html)).toBe("Soupe & pain\n2 tasses d’eau");
  });

  it("cuts the text at 24,000 characters", () => {
    expect(pageText(`<p>${"a".repeat(30_000)}</p>`)).toHaveLength(24_000);
  });
});

describe("readPage", () => {
  it("refuses a link that is not http or https", async () => {
    await expect(readPage("ftp://example.com/x")).rejects.toMatchObject({ status: 400 });
    await expect(readPage("not a link")).rejects.toMatchObject({ status: 400 });
  });

  it("gives the screenshot message if the site refuses", async () => {
    page("no", { status: 403 });
    await expect(readPage("https://example.com/r")).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/screenshot/) });
    page("challenge", { status: 200, headers: { "cf-mitigated": "challenge" } });
    await expect(readPage("https://example.com/r")).rejects.toMatchObject({ status: 422 });
  });

  it("gives a clear message if the link does not open", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(readPage("https://nowhere.example/r")).rejects.toMatchObject({ status: 422 });
    page("gone", { status: 404 });
    await expect(readPage("https://example.com/r")).rejects.toMatchObject({ status: 422 });
  });

  it("stops at 1 MB", async () => {
    page("a".repeat(2 * 1024 * 1024));
    expect((await readPage("https://www.example.com/r")).html).toHaveLength(1024 * 1024);
  });

  it("takes the charset of a <meta> tag if the header has none", async () => {
    page(new Uint8Array([...new TextEncoder().encode('<meta charset="iso-8859-1">'), 0xe9]), {
      headers: { "Content-Type": "text/html" },
    });
    expect((await readPage("https://example.com/r")).html).toBe('<meta charset="iso-8859-1">é');
  });

  it("decodes with the charset of the page and gives the host", async () => {
    page(new Uint8Array([0x63, 0x72, 0xe8, 0x6d, 0x65]), { headers: { "Content-Type": "text/html; charset=ISO-8859-1" } });
    expect(await readPage("https://www.ricardocuisine.com/r")).toEqual({ html: "crème", host: "ricardocuisine.com" });
  });
});

describe("POST /api/recipes/read", () => {
  // The start of a JPEG file in base64.
  const PHOTO = "/9j/4AAQSkZJRgABAQ==";
  let env: ReturnType<typeof testEnv>;
  let cookie: string;
  let run: ReturnType<typeof vi.fn<RunModel>>;

  beforeEach(async () => {
    env = testEnv();
    run = vi.fn<RunModel>(async () => ({ response: JSON.stringify(answer()) }));
    env.AI.run = run;
    await env.AUTH.put("passkey:pk1", JSON.stringify({ id: "pk1", userId: "u1" }));
    cookie = cookieHeader(await createSession(env, { userId: "u1", passkeyId: "pk1" }));
  });

  function call(body: unknown, headers: Record<string, string> = { Origin: ORIGIN }, withCookie = true) {
    return handleApi(
      apiRequest("/api/recipes/read", {
        method: "POST",
        cookie: withCookie ? cookie : undefined,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
    );
  }

  it("reads a photo and answers the fields only", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await call({ image: PHOTO, tags: TAGS });
    expect(res.status).toBe(200);
    const body = await res.json<Record<string, unknown>>();
    expect(Object.keys(body).sort()).toEqual(["fields", "source"]);
    expect(body.source).toBe("photo");
    expect((body.fields as { name: string }).name).toBe("Potage aux carottes");
    expect(run).toHaveBeenCalledWith(MODEL, expect.objectContaining({ messages: expect.any(Array) }));
    expect(JSON.stringify(run.mock.calls[0][1])).toContain(`data:image/jpeg;base64,${PHOTO}`);
    // No GitHub call: nothing is saved.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads a link and gives its host", async () => {
    page(`<script type="application/ld+json">{"@type":"Recipe","name":"Macaroni","image":"https://x/p.jpg"}</script>`);
    const res = await call({ url: "https://www.example.com/r", tags: TAGS });
    expect(res.status).toBe(200);
    expect((await res.json<{ source: string }>()).source).toBe("example.com");
    const sent = JSON.stringify(run.mock.calls[0][1]);
    expect(sent).toContain("Macaroni");
    expect(sent).not.toContain("p.jpg");
  });

  it("refuses a body that is not an object", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(null)).status).toBe(400);
    expect((await call([1])).status).toBe(400);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("needs one photo or one link", async () => {
    expect((await call({ image: PHOTO, url: "https://example.com" })).status).toBe(400);
    expect((await call({ tags: TAGS })).status).toBe(400);
  });

  it("refuses a photo that is not a JPEG, or too large", async () => {
    expect((await call({ image: "UklGRhAAAABXRUJQ" })).status).toBe(400);
    expect((await call({ image: "/9j/" + "A".repeat(2.1 * 1024 * 1024) })).status).toBe(413);
  });

  it("refuses a bad tag list", async () => {
    expect((await call({ image: PHOTO, tags: "soup" })).status).toBe(400);
    expect((await call({ image: PHOTO, tags: [1] })).status).toBe(400);
    expect((await call({ image: PHOTO, tags: Array(301).fill("a") })).status).toBe(400);
  });

  it("needs a session and the admin origin", async () => {
    expect((await call({ image: PHOTO }, { Origin: ORIGIN }, false)).status).toBe(401);
    expect((await call({ image: PHOTO }, { Origin: "https://evil.example" })).status).toBe(403);
  });

  it("says when no recipe was found", async () => {
    run.mockResolvedValue({ response: JSON.stringify(answer({ found: false })) });
    const res = await call({ image: PHOTO });
    expect(res.status).toBe(422);
    expect((await res.json<{ error: string }>()).error).toMatch(/No recipe/);
  });

  it("maps the errors of the service and logs nothing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    run.mockRejectedValueOnce(new Error("3036: You have used up your daily free allocation of 10,000 neurons."));
    let res = await call({ image: PHOTO });
    expect(res.status).toBe(429);
    expect((await res.json<{ error: string }>()).error).toMatch(/tomorrow/);

    run.mockRejectedValueOnce(new Error("3040: Capacity temporarily exceeded, please try again."));
    res = await call({ image: PHOTO });
    expect(res.status).toBe(429);
    expect((await res.json<{ error: string }>()).error).toMatch(/busy/);

    run.mockRejectedValueOnce(new Error("AiError: You have used up your daily free allocation of 10,000 neurons."));
    expect((await call({ image: PHOTO })).status).toBe(429);

    run.mockRejectedValueOnce(new Error("3007: Request timeout"));
    expect((await call({ image: PHOTO })).status).toBe(502);

    run.mockResolvedValueOnce({ response: "Sorry, { not json" });
    expect((await call({ image: PHOTO })).status).toBe(502);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
