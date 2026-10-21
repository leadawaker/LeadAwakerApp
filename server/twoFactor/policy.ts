/**
 * Require-2FA policy (specs/two-factor-auth Phase 6): global default with a per-account
 * override, a grace period, and the middleware that restricts a session to enrollment
 * once the grace period is over.
 */
import type { Request, Response, NextFunction } from "express";
import type { Users } from "@shared/schema";
import { storage } from "../storage";
import type { RequireMode } from "../storage/twoFactor";

const TTL_MS = 30_000;
let policyCache: { at: number; value: { requireTwoFactor: RequireMode; graceDays: number } } | null = null;
const accountCache = new Map<number, { at: number; value: RequireMode | null }>();

export function invalidatePolicyCache(): void {
  policyCache = null;
  accountCache.clear();
}

export async function getPolicy() {
  if (policyCache && Date.now() - policyCache.at < TTL_MS) return policyCache.value;
  const value = await storage.getSecurityPolicy();
  policyCache = { at: Date.now(), value };
  return value;
}

async function accountOverride(accountId: number): Promise<RequireMode | null> {
  const hit = accountCache.get(accountId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await storage.getAccountRequire2fa(accountId);
  accountCache.set(accountId, { at: Date.now(), value });
  return value;
}

/** Whether the effective requirement (account override, else global) applies to this user. */
export async function requirementApplies(user: Users): Promise<boolean> {
  const policy = await getPolicy();
  const override = user.accountsId ? await accountOverride(user.accountsId) : null;
  const mode = override ?? policy.requireTwoFactor;
  if (mode === "everyone") return true;
  if (mode === "admins") return user.role === "Owner" || user.role === "Admin";
  return false;
}

export interface EnrollmentState {
  required: boolean;
  graceEndsAt: Date | null;
  enrollRequired: boolean;
}

/**
 * `touch` starts or clears the grace clock (login and /me); the middleware passes false.
 */
export async function evaluateEnrollment(user: Users, hasMethod: boolean, touch: boolean): Promise<EnrollmentState> {
  const required = await requirementApplies(user);
  if (!required || hasMethod) {
    if (touch && user.twoFactorRequiredSince) {
      await storage.setTwoFactorRequiredSince(user.id!, null);
      (user as any).twoFactorRequiredSince = null;
    }
    return { required: required && !hasMethod, graceEndsAt: null, enrollRequired: false };
  }
  const { graceDays } = await getPolicy();
  let since = user.twoFactorRequiredSince ? new Date(user.twoFactorRequiredSince) : null;
  if (!since) {
    since = new Date();
    if (touch) {
      await storage.setTwoFactorRequiredSince(user.id!, since);
      (user as any).twoFactorRequiredSince = since;
    }
  }
  const graceEndsAt = new Date(since.getTime() + graceDays * 24 * 60 * 60 * 1000);
  return { required: true, graceEndsAt, enrollRequired: Date.now() >= graceEndsAt.getTime() };
}

/**
 * After the grace period a user under the requirement who has no method can only reach
 * /api/auth/*. Impersonation and the internal API key are not affected (the key is not a session).
 */
export async function enforceTwoFactorEnrollment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.isAuthenticated() || req.session?.impersonation) return next();
    const url = req.originalUrl;
    if (url.startsWith("/api/auth/") || url.startsWith("/api/health")) return next();
    const user = req.user!;
    // Settings needs the user's own profile to render the enrollment card.
    if (req.method === "GET" && url.split("?")[0] === `/api/users/${user.id}`) return next();
    if (user.totpEnabledAt || user.email2faEnabledAt) return next();
    if (!(await requirementApplies(user))) return next();
    if ((await storage.countPasskeys(user.id!)) > 0) return next();
    const state = await evaluateEnrollment(user, false, false);
    if (!state.enrollRequired) return next();
    return res.status(403).json({ code: "2FA_ENROLL_REQUIRED", message: "Set up two-factor authentication to continue." });
  } catch (err) {
    // Fail open on an internal error: a policy lookup problem must not lock everyone out.
    console.error("[2fa] enrollment check failed:", err);
    next();
  }
}
