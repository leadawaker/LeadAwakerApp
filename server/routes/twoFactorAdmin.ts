/** Owner-only 2FA administration (specs/two-factor-auth Phases 6 to 8): policy, reset, audit log. */
import type { Express } from "express";
import { storage } from "../storage";
import { requireOwner, invalidateUserCache } from "../auth";
import { invalidatePolicyCache } from "../twoFactor/policy";
import { logSecurityEvent, SECURITY_EVENT_NAMES, type SecurityEventName } from "../twoFactor/audit";
import { sendTwoFactorResetEmail } from "../twoFactor/emails";
import type { RequireMode } from "../storage/twoFactor";

const MODES: RequireMode[] = ["off", "admins", "everyone"];

export function registerTwoFactorAdminRoutes(app: Express) {
  app.get("/api/admin/security-policy", requireOwner, async (_req, res) => {
    const accounts = await storage.getAccounts();
    res.json({
      ...(await storage.getSecurityPolicy()),
      accounts: accounts
        .filter((a) => a.id != null)
        .map((a) => ({ id: a.id, name: a.name, requireTwoFactor: (a as any).require2fa ?? null })),
    });
  });

  app.put("/api/admin/security-policy", requireOwner, async (req, res) => {
    const { requireTwoFactor, graceDays } = req.body ?? {};
    const days = Number(graceDays);
    if (!MODES.includes(requireTwoFactor) || !Number.isInteger(days) || days < 0 || days > 90) {
      return res.status(400).json({ message: "Invalid policy." });
    }
    const before = await storage.getSecurityPolicy();
    await storage.setSecurityPolicy({ requireTwoFactor, graceDays: days }, req.user!.id!, new Date());
    invalidatePolicyCache();
    logSecurityEvent(req, "policy_changed", {
      meta: { scope: "global", from: before.requireTwoFactor, to: requireTwoFactor, graceFrom: before.graceDays, graceTo: days },
    });
    res.json({ requireTwoFactor, graceDays: days });
  });

  app.patch("/api/admin/accounts/:id/require-2fa", requireOwner, async (req, res) => {
    const accountId = Number(req.params.id);
    const mode = req.body?.requireTwoFactor ?? null;
    if (!Number.isInteger(accountId) || (mode !== null && !MODES.includes(mode))) {
      return res.status(400).json({ message: "Invalid value." });
    }
    const before = await storage.getAccountRequire2fa(accountId);
    if (!(await storage.setAccountRequire2fa(accountId, mode))) return res.status(404).json({ message: "Account not found" });
    invalidatePolicyCache();
    logSecurityEvent(req, "policy_changed", { accountId, meta: { scope: "account", from: before, to: mode } });
    res.json({ requireTwoFactor: mode });
  });

  /** Owner reset: removes every method, ends the user's sessions, tells the user. */
  app.post("/api/admin/users/:id/2fa/reset", requireOwner, async (req, res) => {
    if (req.session.impersonation) return res.status(403).json({ message: "Not available while impersonating." });
    const targetId = Number(req.params.id);
    const target = await storage.getAppUserById(targetId);
    if (!target) return res.status(404).json({ message: "User not found" });
    await storage.resetTwoFactor(targetId);
    await storage.deleteUserSessions(targetId);
    invalidateUserCache(targetId);
    logSecurityEvent(req, "admin_reset", { userId: targetId, accountId: target.accountsId });
    sendTwoFactorResetEmail(target).catch((e) => console.error("[2fa] reset email failed:", e?.message));
    res.json({ ok: true });
  });

  app.get("/api/admin/security-events", requireOwner, async (req, res) => {
    const q = req.query;
    const num = (v: unknown) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
    const date = (v: unknown) => {
      const d = typeof v === "string" && v ? new Date(v) : undefined;
      return d && !isNaN(d.getTime()) ? d : undefined;
    };
    const event = typeof q.event === "string" && SECURITY_EVENT_NAMES.includes(q.event as SecurityEventName) ? q.event : undefined;
    const limit = Math.min(Math.max(num(q.limit) ?? 50, 1), 100);
    const rows = await storage.listSecurityEvents({
      userId: num(q.userId), event, from: date(q.from), to: date(q.to), before: num(q.before), limit,
    });
    const ids = new Set<number>();
    for (const r of rows) { if (r.usersId) ids.add(r.usersId); if (r.actorUsersId) ids.add(r.actorUsersId); }
    const everyone = ids.size ? await storage.getAppUsers() : [];
    const users: Record<number, { name: string; email: string }> = {};
    for (const u of everyone) {
      if (u.id != null && ids.has(u.id)) users[u.id] = { name: u.fullName1 || "", email: u.email || "" };
    }
    res.json({ events: rows, users, nextBefore: rows.length === limit ? rows[rows.length - 1].id : null });
  });
}
