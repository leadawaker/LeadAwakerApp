// How long a demo link lives. The Python engine keeps the same two numbers in
// src/automations/demo_token_ttl.py (a test pins both sides). Pure: no imports,
// so the client bundle and the server tests can both use it.
export const TOKEN_TTL_DAYS = 7;
export const VOICE_TOKEN_TTL_DAYS = 14;
/** Leads.Source of a demo minted by the public website: no voice age check. */
export const PUBLIC_DEMO_SOURCE = "Public Website Demo";

const DAY_MS = 86_400_000;

/** Voice links live twice as long as the chat links. */
export function ttlDaysFor(service: string): number {
  return service === "voice" ? VOICE_TOKEN_TTL_DAYS : TOKEN_TTL_DAYS;
}

export interface LinkAgeInput {
  service: string;
  /** The wa-demo row's created_at. */
  mintedAt: Date | string | null;
  /** The web-demo row's created_at (first browser open). */
  openedAt?: Date | string | null;
  revokedAt?: Date | string | null;
}

function ms(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Revoked is always expired. Voice: older than 14 days from the mint. Any other
 * service: older than 7 days from the mint AND (never opened, or the first open
 * is also older than 7 days). No mint date and no revoke marker: not expired.
 */
export function isLinkExpired(link: LinkAgeInput, now: number = Date.now()): boolean {
  if (link.revokedAt) return true;
  const minted = ms(link.mintedAt);
  if (minted === null) return false;
  const limit = ttlDaysFor(link.service) * DAY_MS;
  if (now - minted <= limit) return false;
  if (link.service === "voice") return true;
  const opened = ms(link.openedAt);
  return opened === null || now - opened > limit;
}
