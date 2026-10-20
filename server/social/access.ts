// Who may act on an account's Instagram connection, and where the OAuth flow may send the browser back to.
// Pure functions, so the rules are unit tested without Express or the database.

/** Frontends the Instagram callback may return to (spec "Connect flow"). */
export const SOCIAL_RETURN_ORIGINS = ["https://leadawaker.com", "https://www.leadawaker.com", "https://app.leadawaker.com"] as const;

export type SocialUser = { role: string | null; accountsId: number | null } | undefined;

const AGENCY_ACCOUNT_ID = 1;

/** Mirrors requireAgency in server/auth.ts: anyone on the agency account, or role Owner/Admin. */
export function isAgency(user: SocialUser): boolean {
  if (!user) return false;
  return user.accountsId === AGENCY_ACCOUNT_ID || user.role === "Owner" || user.role === "Admin";
}

/** Connect, disconnect, approve, reject: agency on any account, or a Manager of that account. Viewers never. */
export function canManageSocial(user: SocialUser, accountId: number): boolean {
  if (!user) return false;
  if (isAgency(user)) return true;
  return user.role === "Manager" && user.accountsId === accountId;
}

/** The candidate origin when it is exactly one of SOCIAL_RETURN_ORIGINS (a trailing slash is ignored), else the fallback. */
export function resolveReturnOrigin(candidate: string | undefined | null, fallback: string): string {
  if (typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim().replace(/\/+$/, "");
  return (SOCIAL_RETURN_ORIGINS as readonly string[]).includes(trimmed) ? trimmed : fallback;
}
