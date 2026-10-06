/**
 * Who may see which voice calls. Pure on purpose: this is the rule that keeps
 * demo calls and other accounts' calls away from clients, so it is tested
 * without Express or a database.
 */
export interface VoiceAccess {
  /** Owner role and NOT impersonating: the only one who may query scope=demo. */
  isOwner: boolean;
  /** Account 1 or Owner/Admin role, and NOT impersonating: may pick any account. */
  isAgency: boolean;
  /** Set for clients and for impersonation: every query is pinned to this account. */
  lockedAccountId: number | null;
}

/** A client row with no account must match nothing, never everything. */
const NO_ACCOUNT = -1;

export function resolveVoiceAccess(input: {
  role: string;
  accountsId: number | null;
  impersonatedAccountId: number | null;
  /** View-as role (Admin, Manager, Viewer). "Admin" has no account: agency view, minus Owner powers. */
  impersonatedRole?: string | null;
}): VoiceAccess {
  if (input.impersonatedAccountId) {
    return { isOwner: false, isAgency: false, lockedAccountId: input.impersonatedAccountId };
  }
  if (input.impersonatedRole) {
    return { isOwner: false, isAgency: true, lockedAccountId: null };
  }
  if (input.role === "Owner") return { isOwner: true, isAgency: true, lockedAccountId: null };
  if (input.role === "Admin" || input.accountsId === 1) {
    return { isOwner: false, isAgency: true, lockedAccountId: null };
  }
  return { isOwner: false, isAgency: false, lockedAccountId: input.accountsId ?? NO_ACCOUNT };
}

export type ScopeDecision =
  | { ok: true; scope: "live" | "demo"; accountId: number | null }
  | { ok: false; status: 403 };

function positiveInt(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function decideScope(access: VoiceAccess, q: { scope?: unknown; accountId?: unknown }): ScopeDecision {
  const scope = q.scope === "demo" ? "demo" : "live";
  if (scope === "demo" && !access.isOwner) return { ok: false, status: 403 };
  const accountId = access.isAgency ? positiveInt(q.accountId) : access.lockedAccountId;
  return { ok: true, scope, accountId };
}
