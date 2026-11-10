// The only file that knows the services that read a recipe: Workers AI through the AI binding,
// and the Gemini API through fetch. A new model or service changes this file only.
import type { RecipeFields } from "../src/utils/recipeText.ts";

// Production passes the AI binding, scripts/try-recipe-read.ts the REST API, the tests a fake.
export type RunModel = (model: string, input: Record<string, unknown>) => Promise<unknown>;

// How a Workers AI model is asked for JSON. Workers AI does not guarantee the schema with an image.
export type JsonMode = "response_format" | "guided_json" | "none";

export interface ModelInfo {
  id: string;
  // The name on the admin page, like "Mistral Small".
  name: string;
  // The page switches to a model of another company, because the Cloudflare models share one
  // daily allowance.
  company: "Cloudflare" | "Google";
  service: "workers-ai" | "gemini";
  // The cap on the answer. A whole recipe is about 1,000 tokens; thinking counts too.
  maxTokens: number;
  json?: JsonMode;
  // The lowest level that the model accepts: Flash-Lite takes "minimal", Gemini 3.8 Flash only
  // "low". A higher level makes a read slower and uses more of the answer cap.
  thinkingLevel?: "minimal" | "low";
}

// The order of the menu on the admin page. The first model is the default.
export const MODELS: ModelInfo[] = [
  {
    id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    name: "Mistral Small",
    company: "Cloudflare",
    service: "workers-ai",
    // The default of 256 tokens cuts a recipe in the middle.
    maxTokens: 2048,
    json: "response_format",
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini Flash-Lite",
    company: "Google",
    service: "gemini",
    maxTokens: 4096,
    thinkingLevel: "minimal",
  },
];

export interface Services {
  ai?: RunModel;
  geminiKey?: string;
}

// A model is on the list only if its service is set up.
export function modelsFor(env: { AI?: unknown; GEMINI_API_KEY?: string }): ModelInfo[] {
  return MODELS.filter((m) => (m.service === "workers-ai" ? Boolean(env.AI) : Boolean(env.GEMINI_API_KEY)));
}

// A model that gives no answer in this time counts as failed, so the page can switch.
export const TIME_LIMIT = 60_000;

export type Source = { image: string } | { text: string };

export type ModelErrorKind = "daily" | "busy" | "failed" | "unreadable";

export class ModelError extends Error {
  readonly kind: ModelErrorKind;

  constructor(kind: ModelErrorKind, cause?: unknown) {
    super(`The model call failed: ${kind}`, { cause });
    this.kind = kind;
  }
}

// Shortened copies of recipes/pudding-chomeur and recipes/unstuffed-bell-peppers. The model copies
// their form: times, servings, headings, tags.
const EXAMPLES: RecipeFields[] = [
  {
    name: "Pouding chômeur",
    description:
      "Dessert composé d’un gâteau moelleux nappé d’une sauce à l’érable et à la cassonade qui s’infiltre pendant la cuisson.",
    servings: "9-12 portions",
    prep_time: "15 minutes",
    cook_time: "45 minutes",
    total_time: "1 heure",
    difficulty: "Easy",
    tags: ["dessert", "made by mom", "hosting"],
    ingredients: [
      "## Pour le gâteau:",
      "1 1/2 tasse de farine tamisée",
      "1 c. à thé de poudre à pâte",
      "1/4 tasse de beurre",
      "## Pour la sauce:",
      "1 tasse de sirop d’érable",
      "1 tasse d’eau bouillante",
    ],
    instructions: [
      "Préchauffer le four à 325°F.",
      "Mélanger la farine et la poudre à pâte dans un bol. Réserver.",
      "Verser uniformément la sauce chaude sur la pâte.",
      "Cuire au four pendant 45 minutes.",
    ],
    notes: ["Se congèle bien.", "Servir chaud, idéalement avec crème ou glace à la vanille."],
  },
  {
    name: "Unstuffed Bell Peppers",
    description: "All the ingredients and flavor of stuffed bell peppers cooked in one skillet for an easy bowl meal.",
    servings: "6 servings",
    prep_time: "15 minutes",
    cook_time: "45 minutes",
    total_time: "1 hour",
    difficulty: "Easy",
    tags: ["beef", "rice", "main", "weeknight"],
    ingredients: ["1 garlic clove", "1 yellow onion", "1 Tbsp olive oil", "½ lb (≈225 g) ground beef"],
    instructions: [
      "Mince the garlic; dice the onion and bell peppers.",
      "Add the olive oil and ground beef to a large deep skillet over medium heat and brown completely.",
    ],
    notes: ["Freezes well; store in individual portions up to 3 months."],
  },
];

const text = { type: "string" };
const list = { type: "array", items: { type: "string" } };

export const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    name: text,
    description: text,
    servings: text,
    prep_time: text,
    cook_time: text,
    total_time: text,
    difficulty: { type: "string", enum: ["Easy", "Medium", "Hard", ""] },
    tags: list,
    ingredients: list,
    instructions: list,
    notes: list,
  },
  required: [
    "found",
    "name",
    "description",
    "servings",
    "prep_time",
    "cook_time",
    "total_time",
    "difficulty",
    "tags",
    "ingredients",
    "instructions",
    "notes",
  ],
};

function rules(tags: string[]): string {
  return [
    "You read one recipe from a photo or from a text. You return it as JSON for a family recipe site.",
    "Rules:",
    "- Keep the language of the source. Never translate. A French recipe stays in French. An English recipe stays in English.",
    "- Copy the ingredients and the steps as the source writes them. Never invent an ingredient or a step. Fix only clear reading errors.",
    "- One ingredient per item. One step per item. Do not number the steps. Do not start an item with a dash.",
    '- A group of ingredients starts with a heading item, like "## Pour la sauce:" in French or "## For the sauce:" in English.',
    '- Times are like "15 minutes" or "1 heure 15 minutes" in French, and "15 minutes" or "1 hour 15 minutes" in English. In a French recipe, write "heure", never "hour".',
    '- Servings are like "6 portions" in French and "6 servings" in English.',
    "- If the source gives no prep time, cook time or total time, estimate it. The total time is the prep time plus the cook time.",
    '- difficulty is "Easy", "Medium" or "Hard". Estimate it if the source does not give it.',
    tags.length
      ? `- tags: choose 2 to 5 tags, only from this list: ${JSON.stringify(tags)}. Never make a new tag.`
      : "- tags: return an empty list.",
    "- description: one short sentence in the language of the source. Use the description of the source if it has one.",
    "- notes: the tips, variants, storage advice and side recipes that the source gives, one per item. Never write a note that the source does not have. An empty list if there are none.",
    "- found is false if the source holds no recipe. Then all the other fields are empty.",
    "Return only the JSON object, with no other text.",
    "Two recipes of the site, to show the form of each field:",
    JSON.stringify(EXAMPLES),
  ].join("\n");
}

const PHOTO_PROMPT = "Read the recipe in this photo.";
const textPrompt = (text: string) => `Read the recipe in this text:\n\n${text}`;

export function buildInput(source: Source, tags: string[], model: ModelInfo): Record<string, unknown> {
  const user =
    "image" in source
      ? [
          { type: "text", text: PHOTO_PROMPT },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${source.image}` } },
        ]
      : textPrompt(source.text);
  const input: Record<string, unknown> = {
    messages: [
      { role: "system", content: rules(tags) },
      { role: "user", content: user },
    ],
    max_tokens: model.maxTokens,
    temperature: 0.1,
  };
  if (model.json === "response_format") input.response_format = { type: "json_schema", json_schema: SCHEMA };
  if (model.json === "guided_json") input.guided_json = SCHEMA;
  return input;
}

export function geminiBody(source: Source, tags: string[], model: ModelInfo): Record<string, unknown> {
  const parts =
    "image" in source
      ? [{ text: PHOTO_PROMPT }, { inlineData: { mimeType: "image/jpeg", data: source.image } }]
      : [{ text: textPrompt(source.text) }];
  return {
    systemInstruction: { parts: [{ text: rules(tags) }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: model.maxTokens,
      responseMimeType: "application/json",
      responseJsonSchema: SCHEMA,
      ...(model.thinkingLevel ? { thinkingConfig: { thinkingLevel: model.thinkingLevel } } : {}),
    },
  };
}

// The model can wrap the JSON in text or in a code fence.
function parseAnswer(response: unknown): unknown {
  if (typeof response === "object" && response !== null) return response;
  if (typeof response !== "string") throw new ModelError("unreadable");
  const start = response.indexOf("{");
  const end = response.lastIndexOf("}");
  if (start < 0 || end < start) throw new ModelError("unreadable");
  try {
    return JSON.parse(response.slice(start, end + 1));
  } catch {
    throw new ModelError("unreadable");
  }
}

// The REST API gives the code ("3036: You have used up your daily free allocation of 10,000
// neurons."). The docs do not give the message of the binding, so the text also counts.
function errorKind(e: unknown): ModelErrorKind {
  const message = e instanceof Error ? e.message : String(e);
  if (/\b3036\b|daily free allocation/i.test(message)) return "daily";
  if (/\b3040\b|capacity temporarily exceeded/i.test(message)) return "busy";
  return "failed";
}

async function askWorkersAi(run: RunModel, model: ModelInfo, source: Source, tags: string[]): Promise<unknown> {
  let result: unknown;
  try {
    result = await run(model.id, buildInput(source, tags, model));
  } catch (e) {
    throw new ModelError(errorKind(e), e);
  }
  return parseAnswer((result as { response?: unknown } | null)?.response);
}

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

// The error docs give no body for a daily limit. A daily quota id has "PerDay" in it.
export function geminiErrorKind(status: number, body: string): ModelErrorKind {
  if (status === 429) return /PerDay|per day|daily/i.test(body) ? "daily" : "busy";
  if (status === 503) return "busy";
  return "failed";
}

interface GeminiAnswer {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: unknown; thought?: boolean }[] } }[];
}

function geminiText(data: GeminiAnswer): string {
  const candidate = data.candidates?.[0];
  // A blocked prompt, an answer cut at maxOutputTokens, or a safety stop.
  if (data.promptFeedback?.blockReason || candidate?.finishReason !== "STOP") throw new ModelError("unreadable");
  const text = (candidate.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  if (!text) throw new ModelError("unreadable");
  return text;
}

async function askGemini(key: string, model: ModelInfo, source: Source, tags: string[]): Promise<unknown> {
  let res: Response;
  let body: string;
  try {
    // The key goes in a header, so it is never in a URL that a log can show.
    res = await fetch(`${GEMINI_URL}${model.id}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody(source, tags, model)),
      signal: AbortSignal.timeout(TIME_LIMIT),
    });
    body = await res.text();
  } catch (e) {
    throw new ModelError("failed", e);
  }
  if (!res.ok) throw new ModelError(geminiErrorKind(res.status, body), new Error(`${res.status}: ${body.slice(0, 500)}`));
  let data: GeminiAnswer;
  try {
    data = JSON.parse(body) as GeminiAnswer;
  } catch {
    throw new ModelError("unreadable");
  }
  return parseAnswer(geminiText(data));
}

function withTimeLimit<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ModelError("failed")), TIME_LIMIT);
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

export function askModel(model: ModelInfo, services: Services, source: Source, tags: string[]): Promise<unknown> {
  if (model.service === "gemini") {
    if (!services.geminiKey) return Promise.reject(new ModelError("failed"));
    return withTimeLimit(askGemini(services.geminiKey, model, source, tags));
  }
  if (!services.ai) return Promise.reject(new ModelError("failed"));
  return withTimeLimit(askWorkersAi(services.ai, model, source, tags));
}
