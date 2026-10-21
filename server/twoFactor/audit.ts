/**
 * Security audit log (specs/two-factor-auth Phase 8). Fire-and-forget: a logging
 * failure must never block or fail a login. Never put codes, secrets, tokens or
 * passwords in `meta`.
 */
import type { Request } from "express";
import { storage } from "../storage";

export type SecurityEventName =
  | "login_success" | "login_failed" | "login_rate_limited"
  | "challenge_started" | "challenge_success" | "challenge_failed" | "challenge_locked"
  | "method_enabled" | "method_disabled" | "email_code_sent"
  | "backup_codes_generated" | "backup_code_used"
  | "trusted_device_added" | "trusted_device_used" | "trusted_device_revoked"
  | "passkey_added" | "passkey_removed"
  | "password_changed" | "admin_reset" | "policy_changed" | "enrollment_forced";

export const SECURITY_EVENT_NAMES: SecurityEventName[] = [
  "login_success", "login_failed", "login_rate_limited",
  "challenge_started", "challenge_success", "challenge_failed", "challenge_locked",
  "method_enabled", "method_disabled", "email_code_sent",
  "backup_codes_generated", "backup_code_used",
  "trusted_device_added", "trusted_device_used", "trusted_device_revoked",
  "passkey_added", "passkey_removed",
  "password_changed", "admin_reset", "policy_changed", "enrollment_forced",
];

export function logSecurityEvent(
  req: Request | null,
  event: SecurityEventName,
  opts: { userId?: number | null; actorId?: number | null; accountId?: number | null; meta?: Record<string, unknown> } = {},
): void {
  const actor = opts.actorId ?? ((req?.user as any)?.id as number | undefined) ?? null;
  storage
    .insertSecurityEvent({
      usersId: opts.userId ?? actor,
      actorUsersId: actor,
      accountsId: opts.accountId ?? ((req?.user as any)?.accountsId as number | undefined) ?? null,
      event,
      ip: req ? (req.ip || req.socket?.remoteAddress || null) : null,
      userAgent: req ? String(req.headers["user-agent"] ?? "").slice(0, 300) || null : null,
      meta: opts.meta ?? null,
    })
    .catch((err) => console.error("[security-log] write failed:", err?.message));
}

const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
let pruner: NodeJS.Timeout | undefined;

/** Deletes rows older than 180 days, once at boot and then daily. */
export function startSecurityEventPruner(): void {
  if (pruner) return;
  const run = () => {
    const now = new Date();
    storage.pruneSecurityEvents(new Date(now.getTime() - RETENTION_MS)).catch((e) => console.error("[security-log] prune failed:", e?.message));
    storage.pruneTrustedDevices(now).catch((e) => console.error("[security-log] device prune failed:", e?.message));
  };
  run();
  pruner = setInterval(run, 24 * 60 * 60 * 1000);
  pruner.unref();
}
