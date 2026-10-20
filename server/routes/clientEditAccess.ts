/**
 * Who may change an account's settings. Pure on purpose, so the rule is tested
 * without Express. "client" = a Manager on their own account: opening hours and
 * alerts only. Everything else stays with the agency ("Request a change").
 */
export type EditLevel = "agency" | "client" | "none";

export function accountEditLevel(
  input: { role: string; accountsId: number | null; impersonatedRole?: string | null; impersonatedAccountId?: number | null },
  targetAccountId: number,
): EditLevel {
  const impersonating = !!input.impersonatedRole;
  const role = input.impersonatedRole ?? input.role;
  if (role === "Owner" || role === "Admin") return "agency";
  if (!impersonating && input.accountsId === 1) return "agency";
  const ownAccount = impersonating ? input.impersonatedAccountId ?? null : input.accountsId;
  if (role === "Manager" && ownAccount != null && ownAccount === targetAccountId) return "client";
  return "none";
}

export const CLIENT_ACCOUNT_FIELDS = ["businessHoursStart", "businessHoursEnd", "openDays"] as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function validClientValue(key: string, v: unknown): boolean {
  if (key === "openDays") {
    return Array.isArray(v) && v.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) && new Set(v).size === v.length;
  }
  return typeof v === "string" && HHMM.test(v);
}

export function pickClientAccountPatch(
  body: Record<string, unknown>,
): { ok: true; patch: Record<string, unknown> } | { ok: false; disallowed: string[]; invalid?: string[] } {
  const allowed = new Set<string>(CLIENT_ACCOUNT_FIELDS);
  const keys = Object.keys(body);
  const disallowed = keys.filter((k) => !allowed.has(k));
  if (disallowed.length || !keys.length) return { ok: false, disallowed };
  const invalid = keys.filter((k) => !validClientValue(k, body[k]));
  if (invalid.length) return { ok: false, disallowed: [], invalid };
  return { ok: true, patch: { ...body } };
}

/** Request-level wrapper: no session user means the internal key was let in (agency). */
export function editLevelForRequest(
  req: { user?: { role?: string | null; accountsId?: number | null } | null; session?: { impersonation?: { role?: string; accountId?: number } | null } },
  targetAccountId: number,
): EditLevel {
  const u = req.user;
  if (!u) return "agency";
  const imp = req.session?.impersonation;
  return accountEditLevel(
    { role: u.role ?? "", accountsId: u.accountsId ?? null, impersonatedRole: imp?.role ?? null, impersonatedAccountId: imp?.accountId ?? null },
    targetAccountId,
  );
}
