// Reads recipes with the real service, as the admin page does, and prints the answer, the time and
// the cost. Usage: npm run try:read -- [--model <id>] [--json <mode>] [--agree] <photo or link>…
// It needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (see README, "Recipe auto-fill").
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { parseRecipeText } from "../src/utils/recipeText.ts";
import { askModel, MODEL, ModelError, type JsonMode, type RunModel } from "../worker/model.ts";

// Neurons per million input and output tokens, from the Workers AI pricing page (2026-11-07).
// The free plan gives 10,000 neurons a day.
const NEURONS: Record<string, [number, number]> = {
  "@cf/meta/llama-4-scout-17b-16e-instruct": [24545, 77273],
  "@cf/mistralai/mistral-small-3.1-24b-instruct": [31876, 50488],
  "@cf/google/gemma-3-12b-it": [31371, 50560],
  "@cf/meta/llama-3.2-11b-vision-instruct": [4410, 61493],
};

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) {
  console.error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN first. See README, "Recipe auto-fill".');
  process.exit(1);
}

const args = process.argv.slice(2);
let model = MODEL;
let json: JsonMode | undefined;
let agree = false;
const sources: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--model") model = args[++i];
  else if (args[i] === "--json") json = args[++i] as JsonMode;
  else if (args[i] === "--agree") agree = true;
  else sources.push(args[i]);
}

let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

const run: RunModel = async (name, input) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => null)) as {
    success?: boolean;
    errors?: { code: number; message: string }[];
    result?: { usage?: typeof usage };
  } | null;
  if (!data?.success) {
    const error = data?.errors?.[0];
    // The same "<code>: <message>" form as the errors of the AI binding.
    throw new Error(`${error?.code ?? res.status}: ${error?.message ?? res.statusText}`);
  }
  usage = data.result?.usage;
  return data.result;
};

function tagList(): string[] {
  const tags = readdirSync("recipes", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      try {
        return parseRecipeText(readFileSync(`recipes/${d.name}/recipe.txt`, "utf8")).tags;
      } catch {
        return [];
      }
    });
  return [...new Set(tags)].sort((a, b) => a.localeCompare(b));
}

// The same image as readingPhoto in src/admin/photo.ts: upright, 1600 px at most, JPEG.
function photo(path: string): string {
  return execFileSync("magick", [path, "-auto-orient", "-resize", "1600x1600>", "-quality", "85", "jpg:-"]).toString(
    "base64",
  );
}

function neurons(): string {
  const price = NEURONS[model];
  if (!price || !usage) return "unknown";
  const value = ((usage.prompt_tokens ?? 0) * price[0] + (usage.completion_tokens ?? 0) * price[1]) / 1e6;
  return `${Math.round(value)} (${usage.prompt_tokens} in, ${usage.completion_tokens} out)`;
}

if (agree) {
  try {
    await run(model, { prompt: "agree" });
  } catch (e) {
    console.log("agree:", e instanceof Error ? e.message : e);
  }
}

const tags = tagList();
for (const source of sources) {
  console.log(`\n=== ${source} (${model})`);
  usage = undefined;
  const start = Date.now();
  try {
    if (/^https?:/.test(source)) throw new Error("Links come with the page code of worker/read.ts.");
    const answer = await askModel(run, { image: photo(source) }, tags, { model, json });
    console.log(JSON.stringify(answer, null, 2));
  } catch (e) {
    console.log("error:", e instanceof ModelError ? `${e.kind} (${e.cause instanceof Error ? e.cause.message : ""})` : e instanceof Error ? e.message : e);
  }
  console.log(`time: ${((Date.now() - start) / 1000).toFixed(1)} s, neurons: ${neurons()}`);
}
