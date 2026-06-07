// Centralized permission helpers for the LeadAwaker CRM.
//
// Role model (May 2026 onward):
//   Owner   — Gabriel + future co-owners. Full power, no guardrails.
//   Admin   — Trusted teammate (e.g. Finn). Can manage day-to-day but cannot
//             hard-delete, see expenses, edit system-default AI keys, or
//             manage Owner-role users.
//   Manager — Client-side manager. Read+write on own account.
//   Viewer  — Read-only.
//
// All checks take the actor user (typically req.user) and return a boolean.
// Internal API key callers bypass these helpers at the route layer.

export type RoleLike = string | null | undefined;

export interface ActorLike {
  role?: RoleLike;
  accountsId?: number | null;
  id?: number | null;
}

const OWNER = "Owner";
const ADMIN_ROLES = new Set(["Admin"]);
const AGENCY_ROLES = new Set(["Owner", "Admin"]);

export function isOwner(user: ActorLike | null | undefined): boolean {
  return !!user && user.role === OWNER;
}

export function isAdmin(user: ActorLike | null | undefined): boolean {
  return !!user && ADMIN_ROLES.has(user.role ?? "");
}

/** Owner or Admin. Used for agency-scope routes. */
export function isAgencyUser(user: ActorLike | null | undefined): boolean {
  return !!user && AGENCY_ROLES.has(user.role ?? "");
}

// ── Action helpers ──────────────────────────────────────────────────────────

/** Hard-delete a row (campaigns, leads, prospects, accounts). Owner only. */
export function canDeleteHard(user: ActorLike | null | undefined): boolean {
  return isOwner(user);
}

/**
 * Modify, invite, or remove a user record. Admins cannot manage Owner-role
 * users (so Finn cannot lock Gabriel out). Owners can manage anyone.
 */
export function canManageUser(
  actor: ActorLike | null | undefined,
  target: ActorLike | null | undefined,
): boolean {
  if (!actor || !target) return false;
  if (isOwner(actor)) return true;
  if (isAdmin(actor)) return target.role !== OWNER;
  return false;
}

/** See the expenses page / hit expense routes. Owner only. */
export function canSeeExpenses(user: ActorLike | null | undefined): boolean {
  return isOwner(user);
}

/** See billing (invoices + contracts). Owner + Admin. */
export function canSeeBilling(user: ActorLike | null | undefined): boolean {
  return isOwner(user) || isAdmin(user);
}

/**
 * Edit the system-default AI API keys (the ones Lead Awaker falls back to
 * when a client hasn't supplied their own). Owner only.
 */
export function canEditSystemAiKeys(user: ActorLike | null | undefined): boolean {
  return isOwner(user);
}

/** View-as / impersonation. Owner only. Wiring lands in a later task. */
export function canImpersonate(user: ActorLike | null | undefined): boolean {
  return isOwner(user);
}

/**
 * Lead Awaker AI button. Owner gets full DB read+write tools. Admin gets
 * DB read-only mode (and must supply own Claude key). Manager/Viewer hidden.
 */
export function canUseLeadAwakerAi(user: ActorLike | null | undefined): boolean {
  return isOwner(user) || isAdmin(user);
}

/** Demo VIP slash commands (Telegram demo flows). Owner + Admin. */
export function canUseDemoVipCommands(user: ActorLike | null | undefined): boolean {
  return isOwner(user) || isAdmin(user);
}
