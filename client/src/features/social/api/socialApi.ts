// Instagram connection and scheduled posts (server/routes/social.ts, server/social/postRoutes.ts).
import { apiFetch, API_BASE } from "@/lib/apiUtils";

export interface SocialConnectionView {
  status: "connected" | "needs_attention" | "disconnected";
  username: string | null;
  profilePictureUrl: string | null;
  accountType: string | null;
  tokenExpiresAt: string | null;
  lastError: string | null;
  scopes: string[];
}

export interface SocialStatus { enabled: boolean; connection: SocialConnectionView | null }

/** A refused request: `reason` is the server's code (translated by the caller), `status` the HTTP status. */
export class SocialApiError extends Error {
  constructor(public reason: string, public status: number) {
    super(reason);
    this.name = "SocialApiError";
  }
}

export async function throwUnlessOk(res: Response): Promise<Response> {
  if (res.ok) return res;
  let reason = "failed";
  try {
    const body = await res.json();
    reason = typeof body?.reason === "string" ? body.reason : reason;
  } catch {
    // not JSON
  }
  throw new SocialApiError(reason, res.status);
}

export function jsonInit(method: string, body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export const socialStatusKey = (accountId: number) => ["social-status", accountId] as const;

export async function fetchSocialStatus(accountId: number): Promise<SocialStatus> {
  const res = await throwUnlessOk(await apiFetch(`/api/social/accounts/${accountId}/status`));
  return res.json();
}

/** Full-page redirect to Instagram; the callback comes back to this same frontend. */
export function startInstagramConnect(accountId: number): void {
  window.location.href = `${API_BASE}/api/social/accounts/${accountId}/instagram/authorize?origin=${encodeURIComponent(window.location.origin)}`;
}

export async function disconnectInstagram(accountId: number): Promise<void> {
  await throwUnlessOk(await apiFetch(`/api/social/accounts/${accountId}/connection`, jsonInit("DELETE")));
}

export async function setSocialEnabled(accountId: number, enabled: boolean): Promise<void> {
  await throwUnlessOk(await apiFetch(`/api/social/accounts/${accountId}/enabled`, jsonInit("PUT", { enabled })));
}
