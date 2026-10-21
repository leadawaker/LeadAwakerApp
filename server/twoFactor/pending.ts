/**
 * Pending-2FA session state and the shared login completion (specs/two-factor-auth).
 * The password step stops here for users with a second factor: no `req.logIn` until it passes.
 */
import type { Request } from "express";
import type { Users } from "@shared/schema";
import { storage } from "../storage";
import { evaluateEnrollment } from "./policy";
import { logSecurityEvent } from "./audit";

export type Method = "totp" | "email" | "passkey";

export const PENDING_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
const STEP_UP_MS = 5 * 60_000;

interface Pending2fa {
  userId: number;
  expiresAt: number;
  attempts: number;
  emailCode?: { hash: string; expiresAt: number };
  passkeyChallenge?: { challenge: string; expiresAt: number };
}

declare module "express-session" {
  interface SessionData {
    pending2fa?: Pending2fa;
    /** Settings enrollment (user already signed in). */
    totpSetup?: { secretEnc: string; expiresAt: number };
    emailEnroll?: { hash: string; expiresAt: number; attempts: number };
    stepUpEmail?: { hash: string; expiresAt: number; attempts: number };
    stepUp?: { until: number };
    passkeyRegChallenge?: { challenge: string; expiresAt: number };
  }
}

// ─── Methods ──────────────────────────────────────────────────────────────

export interface MethodInfo {
  methods: Method[];
  /** Unused backup codes exist (only meaningful when `methods` is not empty). */
  backup: boolean;
}

export async function getMethodInfo(user: Users): Promise<MethodInfo> {
  const methods: Method[] = [];
  if (user.totpSecretEnc && user.totpEnabledAt) methods.push("totp");
  if (user.email2faEnabledAt) methods.push("email");
  const passkeys = await storage.countPasskeys(user.id!);
  if (passkeys > 0) methods.push("passkey");
  const backup = methods.length > 0 && (await storage.countUnusedBackupCodes(user.id!)) > 0;
  return { methods, backup };
}

// ─── Safe user ────────────────────────────────────────────────────────────

/** Removes credentials/secrets that must never leave the server. */
export function stripSecrets<T extends Record<string, any>>(user: T): Omit<T, "passwordHash" | "totpSecretEnc" | "totpLastStep"> {
  const { passwordHash: _p, totpSecretEnc: _s, totpLastStep: _l, ...rest } = user;
  return rest;
}

export interface TwoFactorSummary {
  totp: boolean;
  email: boolean;
  passkeys: number;
  backupCodes: number;
  required: boolean;
  graceEndsAt: string | null;
  enrollRequired: boolean;
}

export async function twoFactorSummary(user: Users, touch = false): Promise<TwoFactorSummary> {
  const [passkeys, backupCodes] = await Promise.all([
    storage.countPasskeys(user.id!),
    storage.countUnusedBackupCodes(user.id!),
  ]);
  const totp = !!(user.totpSecretEnc && user.totpEnabledAt);
  const email = !!user.email2faEnabledAt;
  const state = await evaluateEnrollment(user, totp || email || passkeys > 0, touch);
  return {
    totp, email, passkeys, backupCodes,
    required: state.required,
    graceEndsAt: state.graceEndsAt ? state.graceEndsAt.toISOString() : null,
    enrollRequired: state.enrollRequired,
  };
}

export async function toSafeUser(user: Users, touch = false) {
  return { ...stripSecrets(user), twoFactor: await twoFactorSummary(user, touch) };
}

// ─── Pending record ───────────────────────────────────────────────────────

export function startPending(req: Request, user: Users): void {
  req.session.pending2fa = { userId: user.id!, expiresAt: Date.now() + PENDING_TTL_MS, attempts: 0 };
}

export function getPending(req: Request): Pending2fa | undefined {
  const p = req.session?.pending2fa;
  if (!p) return undefined;
  if (Date.now() > p.expiresAt) {
    delete req.session.pending2fa;
    return undefined;
  }
  return p;
}

/** Counts a wrong attempt; at the cap the pending record is dropped and the user must re-enter the password. */
export function failPending(req: Request): { locked: boolean } {
  const p = req.session.pending2fa;
  if (!p) return { locked: true };
  p.attempts += 1;
  if (p.attempts >= MAX_ATTEMPTS) {
    delete req.session.pending2fa;
    return { locked: true };
  }
  return { locked: false };
}

// ─── Login completion ─────────────────────────────────────────────────────

export type LoginVia = "password" | "second_factor" | "trusted_device";

export async function finishLogin(req: Request, user: Users, via: LoginVia) {
  await new Promise<void>((resolve, reject) => req.logIn(user, (err) => (err ? reject(err) : resolve())));
  // Record last login (server-side Date, never an ISO string). Don't block the response on it.
  storage.updateAppUser(user.id!, { lastLoginAt: new Date() } as any)
    .catch((e) => console.error("[auth] failed to record last login:", e?.message));
  logSecurityEvent(req, "login_success", { userId: user.id, actorId: user.id, accountId: user.accountsId, meta: { via } });
  return toSafeUser(user, true);
}

// ─── Step-up (recent proof of a second factor, for disabling things) ─────

export function grantStepUp(req: Request): void {
  req.session.stepUp = { until: Date.now() + STEP_UP_MS };
}

export function hasStepUp(req: Request): boolean {
  return !!req.session.stepUp && Date.now() < req.session.stepUp.until;
}

/** When the last method is gone 2FA is off: backup codes and trusted devices go with it. */
export async function cleanupIfNoMethods(userId: number): Promise<void> {
  const user = await storage.getAppUserById(userId);
  if (!user) return;
  const { methods } = await getMethodInfo(user);
  if (methods.length === 0) {
    await storage.deleteBackupCodes(userId);
    await storage.revokeAllTrustedDevices(userId);
  }
}
