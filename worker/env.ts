export interface Env {
  // The commit that Workers Builds deployed. Empty in a local `wrangler dev`.
  COMMIT?: string;
  // Passkeys and users. See worker/passkeys.ts for the keys.
  AUTH: KVNamespace;

  // Secrets: Worker secrets in Cloudflare, `.dev.vars` in a local run.
  GITHUB_TOKEN: string;
  SESSION_SECRET: string;
  SETUP_CODE: string;

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
