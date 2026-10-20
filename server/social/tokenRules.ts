// Pure rules for refreshing Instagram long-lived tokens and warning before they expire.

const DAY_MS = 86_400_000;
const REFRESH_WINDOW_MS = 20 * DAY_MS;
const MIN_TOKEN_AGE_MS = DAY_MS;
const WARN_WINDOW_MS = 7 * DAY_MS;
const WARN_REPEAT_MS = DAY_MS;

export type RefreshDecision = "skip" | "refresh" | "expired";

export function refreshDecision(
  c: { status: string; tokenExpiresAt: Date | null; tokenRefreshedAt: Date | null; createdAt: Date },
  now: Date,
): RefreshDecision {
  if (c.status === "disconnected" || !c.tokenExpiresAt) return "skip";
  const left = c.tokenExpiresAt.getTime() - now.getTime();
  if (left <= 0) return "expired";
  if (left > REFRESH_WINDOW_MS) return "skip";
  const issuedAt = (c.tokenRefreshedAt ?? c.createdAt).getTime();
  if (now.getTime() - issuedAt < MIN_TOKEN_AGE_MS) return "skip";
  return "refresh";
}

export function shouldWarnExpiry(
  c: { status: string; tokenExpiresAt: Date | null; expiryWarnedAt: Date | null },
  now: Date,
): boolean {
  if (c.status === "disconnected" || !c.tokenExpiresAt) return false;
  if (c.tokenExpiresAt.getTime() - now.getTime() > WARN_WINDOW_MS) return false;
  if (c.expiryWarnedAt && now.getTime() - c.expiryWarnedAt.getTime() < WARN_REPEAT_MS) return false;
  return true;
}
