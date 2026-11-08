import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanAnswer, pageText, readPage } from "./read.ts";

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

  it("stops at 3 MB", async () => {
    page("a".repeat(4 * 1024 * 1024));
    expect((await readPage("https://www.example.com/r")).html).toHaveLength(3 * 1024 * 1024);
  });

  it("decodes with the charset of the page and gives the host", async () => {
    page(new Uint8Array([0x63, 0x72, 0xe8, 0x6d, 0x65]), { headers: { "Content-Type": "text/html; charset=ISO-8859-1" } });
    expect(await readPage("https://www.ricardocuisine.com/r")).toEqual({ html: "crème", host: "ricardocuisine.com" });
  });
});
