import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import type { RecipeFields } from "../utils/recipeText";

// A model that can read a recipe. The Worker lists only the models whose service is set up.
export interface ModelChoice {
  id: string;
  name: string;
  company: string;
}

export interface SessionInfo {
  signedIn: boolean;
  setupOpen: boolean;
  tokenExpires?: string;
  models?: ModelChoice[];
}

export interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: string;
  current: boolean;
}

export interface RecipeListItem {
  slug: string;
  name: string;
  tags: string[];
  hasImage: boolean;
  notLive: boolean;
}

export interface RecipeList {
  recipes: RecipeListItem[];
  tags: string[];
}

export interface RecipeDetail {
  slug: string;
  fields: RecipeFields;
  baseOid: string;
  hasImage: boolean;
}

export interface SaveResult {
  slug: string;
  commit: string;
  changed?: boolean;
}

// What the model read, and the id of the model.
export interface ReadResult {
  fields: RecipeFields;
  model: string;
}

export type ReadSource = { image: string } | { url: string } | { text: string };

function isRecipeFields(value: unknown): value is RecipeFields {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const text = ["name", "description", "servings", "prep_time", "cook_time", "total_time", "difficulty"];
  const lists = ["tags", "ingredients", "instructions", "notes"];
  return (
    text.every((k) => typeof v[k] === "string") &&
    lists.every((k) => Array.isArray(v[k]) && (v[k] as unknown[]).every((item) => typeof item === "string"))
  );
}

// A base64 webp to save, null to remove the photo, undefined to keep it.
export type PhotoChange = string | null | undefined;

export class ApiError extends Error {
  readonly status: number;
  // Set only for a model error ("daily", "busy", "failed", "unreadable"): another model can try.
  readonly kind?: string;

  constructor(status: number, message: string, kind?: string) {
    super(message);
    this.status = status;
    this.kind = kind;
  }
}

let onSignedOut: () => void = () => {};

// The admin page shows the sign-in screen when the session ends during the work.
export function whenSignedOut(callback: () => void): void {
  onSignedOut = callback;
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    // A cancel is not a network error. The caller ignores it.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "No connection. Check the network and try again.");
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && !path.startsWith("/login/")) onSignedOut();
  if (!res.ok) {
    const kind = typeof data?.kind === "string" ? data.kind : undefined;
    throw new ApiError(res.status, data?.error ?? `The request failed (${res.status}). Try again.`, kind);
  }
  return data as T;
}

export const api = {
  session: () => request<SessionInfo>("GET", "/session"),
  logout: () => request<unknown>("POST", "/logout", {}),
  setupOptions: (code: string) =>
    request<PublicKeyCredentialCreationOptionsJSON>("POST", "/setup/options", { code }),
  setupVerify: (response: RegistrationResponseJSON, name: string) =>
    request<unknown>("POST", "/setup/verify", { response, name }),
  loginOptions: () => request<PublicKeyCredentialRequestOptionsJSON>("POST", "/login/options", {}),
  loginVerify: (response: AuthenticationResponseJSON) => request<unknown>("POST", "/login/verify", response),
  passkeys: () => request<PasskeyInfo[]>("GET", "/passkeys"),
  addPasskeyOptions: () => request<PublicKeyCredentialCreationOptionsJSON>("POST", "/passkeys/options", {}),
  addPasskeyVerify: (response: RegistrationResponseJSON, name: string) =>
    request<unknown>("POST", "/passkeys/verify", { response, name }),
  removePasskey: (id: string) => request<unknown>("DELETE", `/passkeys/${encodeURIComponent(id)}`, {}),
  recipes: () => request<RecipeList>("GET", "/recipes"),
  recipe: (slug: string) => request<RecipeDetail>("GET", `/recipes/${slug}`),
  createRecipe: (fields: RecipeFields, image: PhotoChange) =>
    request<SaveResult>("POST", "/recipes", { fields, image: image ?? undefined }),
  updateRecipe: (slug: string, fields: RecipeFields, baseOid: string, image: PhotoChange) =>
    request<SaveResult>("PUT", `/recipes/${slug}`, { fields, baseOid, image }),
  deleteRecipe: (slug: string, baseOid: string) => request<SaveResult>("DELETE", `/recipes/${slug}`, { baseOid }),
  readRecipe: async (source: ReadSource, tags: string[], model: string, signal: AbortSignal): Promise<ReadResult> => {
    const result = await request<Partial<ReadResult> | null>("POST", "/recipes/read", { ...source, tags, model }, signal);
    // A broken answer must not reach the form: a missing list would stop the page.
    if (!isRecipeFields(result?.fields) || typeof result.model !== "string") {
      throw new ApiError(502, "The service failed. Try again.", "unreadable");
    }
    return { fields: result.fields, model: result.model };
  },
};

// The site serves this photo once the recipe is live. Before that, only the Worker has it.
export function photoUrl(recipe: { slug: string; notLive?: boolean }): string {
  return recipe.notLive ? `/api/recipes/${recipe.slug}/image` : `${import.meta.env.BASE_URL}recipes/${recipe.slug}.webp`;
}

// A name the owner recognises in the passkey list, like "iPhone".
export function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  return "This device";
}

// WebAuthn errors are hard to read. These are the cases the owner can act on.
export function passkeyErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  const name = e instanceof Error ? e.name : "";
  const code = (e as { code?: string })?.code;
  if (name === "NotAllowedError" || code === "ERROR_CEREMONY_ABORTED") {
    return "The passkey prompt was cancelled or timed out.";
  }
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") return "This device already has a passkey here.";
  if (name === "SecurityError") return "Passkeys do not work on this address.";
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}
