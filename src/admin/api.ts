import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";

export interface SessionInfo {
  signedIn: boolean;
  setupOpen: boolean;
  tokenExpires?: string;
}

export interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: string;
  current: boolean;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onSignedOut: () => void = () => {};

// The admin page shows the sign-in screen when the session ends during the work.
export function whenSignedOut(callback: () => void): void {
  onSignedOut = callback;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "No connection. Check the network and try again.");
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && !path.startsWith("/login/")) onSignedOut();
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `The request failed (${res.status}).`);
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
};

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
