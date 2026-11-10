export interface Env {
  // The commit that Workers Builds deployed. Empty in a local `wrangler dev`.
  COMMIT?: string;
  // Passkeys and users. See worker/passkeys.ts for the keys.
  AUTH: KVNamespace;
  // Workers AI, which reads a recipe from a photo or a page. The type of the binding (Ai) lists
  // the inputs of each model; worker/model.ts builds its input itself. `wrangler dev --env local`
  // has no binding, so the Cloudflare models are not on its list.
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> };

  // Secrets: Worker secrets in Cloudflare, `.dev.vars` in a local run.
  GITHUB_TOKEN: string;
  SESSION_SECRET: string;
  SETUP_CODE: string;
  // A Gemini API key of a Google project with no billing account. Empty: no Google model.
  GEMINI_API_KEY?: string;

  // The only origin that can write, like "https://palmares.lajoie.workers.dev".
  ORIGIN: string;
  // The passkey scope. A passkey made for one RP_ID does not work on another host.
  RP_ID: string;
  // "owner/name" of the repo that holds recipes/.
  GITHUB_REPO: string;
  // The branch that saves commit to. `.dev.vars` sets "admin-test", so a local run never deploys.
  GITHUB_BRANCH: string;
  // End date of the GitHub token, "YYYY-MM-DD". GitHub does not send it for this token.
  TOKEN_EXPIRES?: string;
}
