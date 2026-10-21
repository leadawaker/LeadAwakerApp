/**
 * Two-factor authentication routes (specs/two-factor-auth): login challenge, TOTP,
 * email code, backup codes, trusted devices and step-up. Passkeys live in twoFactorPasskeys.ts.
 */
import type { Express, Request, Response } from "express";
import QRCode from "qrcode";
import type { Users } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, invalidateUserCache, verifyPassword } from "../auth";
import { encryptSecret, decryptSecret } from "../encryption";
import { generateTotpSecret, totpKeyUri, verifyTotp } from "../twoFactor/totp";
import { generateBackupCodes, hashBackupCode } from "../twoFactor/backupCodes";
import { checkTotp, checkBackupCode, checkEmailCode } from "../twoFactor/factors";
import { generateEmailCode, hashEmailCode, maskEmail, sendSignInCodeEmail, sendBackupCodeUsedEmail } from "../twoFactor/emails";
import {
  getPending, failPending, finishLogin, twoFactorSummary, cleanupIfNoMethods,
  grantStepUp, hasStepUp, getMethodInfo, MAX_ATTEMPTS,
} from "../twoFactor/pending";
import { trustThisDevice, currentDeviceHash } from "../twoFactor/trustedDevice";
import { logSecurityEvent } from "../twoFactor/audit";
import { makeLimiter } from "../twoFactor/rateLimit";
import { verifyPasskeyLogin, registerTwoFactorPasskeyRoutes } from "./twoFactorPasskeys";

const verifyLimit = makeLimiter(30, 60_000); // per IP
const enrollLimit = makeLimiter(10, 10 * 60_000); // per user: wrong codes while enrolling / stepping up
const emailSendLimit = makeLimiter(3, 15 * 60_000); // per user
const emailGapLimit = makeLimiter(1, 60_000); // per user: one send per minute
const CODE_TTL_MS = 10 * 60_000;

const ip = (req: Request) => req.ip || req.socket.remoteAddress || "unknown";

function blockImpersonation(req: Request, res: Response): boolean {
  if (req.session.impersonation) {
    res.status(403).json({ message: "Not available while impersonating." });
    return true;
  }
  return false;
}

async function passwordOk(req: Request, res: Response): Promise<Users | null> {
  const user = req.user!;
  const password = req.body?.password;
  if (typeof password !== "string" || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    res.status(400).json({ message: "Password is incorrect." });
    return null;
  }
  return user;
}

/** Emails a fresh code, enforcing 1/min and 3 per 15 min per user. Returns false after replying. */
async function sendCode(req: Request, res: Response, user: Users, store: (hash: string) => void): Promise<boolean> {
  const key = String(user.id);
  if (!emailGapLimit(key) || !emailSendLimit(key)) {
    res.status(429).json({ message: "Too many codes requested. Try again in a few minutes." });
    return false;
  }
  const code = generateEmailCode();
  store(hashEmailCode(user.id!, code));
  if (process.env.NODE_ENV !== "production") console.log(`[2fa] dev email code for user ${user.id}: ${code}`);
  try {
    await sendSignInCodeEmail(user, code);
  } catch (err: any) {
    console.error("[2fa] sign-in code email failed:", err?.message);
    res.status(502).json({ message: "Could not send the email." });
    return false;
  }
  logSecurityEvent(req, "email_code_sent", { userId: user.id, actorId: user.id, accountId: user.accountsId });
  return true;
}

export function registerTwoFactorRoutes(app: Express) {
  registerTwoFactorPasskeyRoutes(app);

  // ─── Login challenge (public, needs the pending record) ────────────────

  app.post("/api/auth/2fa/verify", async (req, res) => {
    if (!verifyLimit(ip(req))) return res.status(429).json({ message: "Too many attempts. Try again in a minute." });
    const pending = getPending(req);
    const user = pending ? await storage.getAppUserById(pending.userId) : undefined;
    if (!pending || !user) return res.status(401).json({ message: "Session expired, sign in again.", restart: true });

    const { method, code, response, trustDevice } = req.body ?? {};
    let ok = false;
    if (method === "totp") ok = await checkTotp(user, code);
    else if (method === "email") {
      ok = checkEmailCode(pending.emailCode, user.id!, code);
      if (ok) delete pending.emailCode;
    } else if (method === "backup") ok = await checkBackupCode(user, code);
    else if (method === "passkey") ok = await verifyPasskeyLogin(req, user, response);
    else return res.status(400).json({ message: "Unknown method." });

    if (!ok) {
      const { locked } = failPending(req);
      logSecurityEvent(req, locked ? "challenge_locked" : "challenge_failed", { userId: user.id, actorId: user.id, accountId: user.accountsId, meta: { method } });
      return res.status(401).json({
        message: locked ? "Too many wrong codes. Sign in again." : "Invalid code.",
        restart: locked,
        attemptsLeft: locked ? 0 : MAX_ATTEMPTS - (req.session.pending2fa?.attempts ?? 0),
      });
    }

    logSecurityEvent(req, "challenge_success", { userId: user.id, actorId: user.id, accountId: user.accountsId, meta: { method } });
    if (method === "backup") {
      logSecurityEvent(req, "backup_code_used", { userId: user.id, actorId: user.id, accountId: user.accountsId });
      sendBackupCodeUsedEmail(user).catch((e) => console.error("[2fa] backup-used email failed:", e?.message));
    }
    if (trustDevice === true) await trustThisDevice(req, res, user.id!);
    const safeUser = await finishLogin(req, user, "second_factor");
    res.json({ user: safeUser });
  });

  /** Email me a code (the recovery path, offered to every user with a method). */
  app.post("/api/auth/2fa/email/send", async (req, res) => {
    if (!verifyLimit(ip(req))) return res.status(429).json({ message: "Too many attempts. Try again in a minute." });
    const pending = getPending(req);
    const user = pending ? await storage.getAppUserById(pending.userId) : undefined;
    if (!pending || !user || !user.email) return res.status(401).json({ message: "Session expired, sign in again.", restart: true });
    const sent = await sendCode(req, res, user, (hash) => {
      pending.emailCode = { hash, expiresAt: Date.now() + CODE_TTL_MS };
    });
    if (sent) res.json({ sentTo: maskEmail(user.email) });
  });

  // ─── Status (Settings card) ────────────────────────────────────────────

  app.get("/api/auth/2fa/status", requireAuth, async (req, res) => {
    const user = req.user!;
    const [summary, passkeys, devices] = await Promise.all([
      twoFactorSummary(user),
      storage.listPasskeys(user.id!),
      storage.listTrustedDevices(user.id!, new Date()),
    ]);
    const mine = currentDeviceHash(req);
    res.json({
      ...summary,
      stepUp: hasStepUp(req),
      passkeyList: passkeys.map((p) => ({ id: p.id, label: p.deviceLabel, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt })),
      devices: devices.map((d) => ({ id: d.id, userAgent: d.userAgent, createdAt: d.createdAt, lastUsedAt: d.lastUsedAt, expiresAt: d.expiresAt, current: !!mine && d.tokenHash === mine })),
    });
  });

  // ─── Step-up: prove a second factor before removing something ──────────

  app.post("/api/auth/2fa/step-up/email", requireAuth, async (req, res) => {
    const user = req.user!;
    if (!user.email) return res.status(400).json({ message: "No email on file." });
    const sent = await sendCode(req, res, user, (hash) => {
      req.session.stepUpEmail = { hash, expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 };
    });
    if (sent) res.json({ sentTo: maskEmail(user.email) });
  });

  app.post("/api/auth/2fa/step-up", requireAuth, async (req, res) => {
    if (blockImpersonation(req, res)) return;
    const user = await passwordOk(req, res);
    if (!user) return;
    if (!enrollLimit(`stepup:${user.id}`)) return res.status(429).json({ message: "Too many attempts. Try again later." });
    const { method, code } = req.body ?? {};
    let ok = false;
    if (method === "totp") ok = await checkTotp(user, code);
    else if (method === "backup") ok = await checkBackupCode(user, code);
    else if (method === "email") {
      ok = checkEmailCode(req.session.stepUpEmail, user.id!, code);
      if (ok) delete req.session.stepUpEmail;
    } else return res.status(400).json({ message: "Unknown method." });
    if (!ok) return res.status(401).json({ message: "Invalid code." });
    grantStepUp(req);
    res.json({ ok: true });
  });

  // ─── TOTP ──────────────────────────────────────────────────────────────

  app.post("/api/auth/2fa/totp/setup", requireAuth, async (req, res) => {
    if (blockImpersonation(req, res)) return;
    const user = await passwordOk(req, res);
    if (!user) return;
    if (user.totpEnabledAt) return res.status(409).json({ message: "Authenticator app is already enabled." });
    const secret = generateTotpSecret();
    req.session.totpSetup = { secretEnc: encryptSecret(secret), expiresAt: Date.now() + CODE_TTL_MS };
    const otpauthUri = totpKeyUri(user.email || String(user.id), secret);
    res.json({ otpauthUri, qrDataUrl: await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 }), secret });
  });

  app.post("/api/auth/2fa/totp/enable", requireAuth, async (req, res) => {
    if (blockImpersonation(req, res)) return;
    const user = req.user!;
    const setup = req.session.totpSetup;
    if (!setup || Date.now() > setup.expiresAt) return res.status(400).json({ message: "Setup expired, start again." });
    if (!enrollLimit(`enroll:${user.id}`)) return res.status(429).json({ message: "Too many attempts. Try again later." });
    const step = verifyTotp(decryptSecret(setup.secretEnc), String(req.body?.code ?? ""));
    if (step === null) return res.status(401).json({ message: "Invalid code." });
    await storage.setTotpSecret(user.id!, setup.secretEnc, new Date());
    await storage.claimTotpStep(user.id!, step); // the confirming code cannot be replayed at login
    delete req.session.totpSetup;
    invalidateUserCache(user.id!);
    logSecurityEvent(req, "method_enabled", { userId: user.id, meta: { method: "totp" } });
    res.json({ ok: true });
  });

  app.post("/api/auth/2fa/totp/disable", requireAuth, async (req, res) => {
    if (!hasStepUp(req)) return res.status(403).json({ message: "Confirm with a code first.", code: "STEP_UP_REQUIRED" });
    const user = req.user!;
    await storage.clearTotp(user.id!);
    await cleanupIfNoMethods(user.id!);
    invalidateUserCache(user.id!);
    logSecurityEvent(req, "method_disabled", { userId: user.id, meta: { method: "totp" } });
    res.json({ ok: true });
  });

  // ─── Email as a method ────────────────────────────────────────────────

  app.post("/api/auth/2fa/email/enable", requireAuth, async (req, res) => {
    if (blockImpersonation(req, res)) return;
    const user = await passwordOk(req, res);
    if (!user) return;
    if (!user.email) return res.status(400).json({ message: "No email on file." });
    const sent = await sendCode(req, res, user, (hash) => {
      req.session.emailEnroll = { hash, expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 };
    });
    if (sent) res.json({ sentTo: maskEmail(user.email) });
  });

  app.post("/api/auth/2fa/email/confirm", requireAuth, async (req, res) => {
    if (blockImpersonation(req, res)) return;
    const user = req.user!;
    if (!enrollLimit(`enroll:${user.id}`)) return res.status(429).json({ message: "Too many attempts. Try again later." });
    if (!checkEmailCode(req.session.emailEnroll, user.id!, req.body?.code)) {
      return res.status(401).json({ message: "Invalid code." });
    }
    delete req.session.emailEnroll;
    await storage.setEmail2fa(user.id!, new Date());
    invalidateUserCache(user.id!);
    logSecurityEvent(req, "method_enabled", { userId: user.id, meta: { method: "email" } });
    res.json({ ok: true });
  });

  app.post("/api/auth/2fa/email/disable", requireAuth, async (req, res) => {
    if (!hasStepUp(req)) return res.status(403).json({ message: "Confirm with a code first.", code: "STEP_UP_REQUIRED" });
    const user = req.user!;
    await storage.setEmail2fa(user.id!, null);
    await cleanupIfNoMethods(user.id!);
    invalidateUserCache(user.id!);
    logSecurityEvent(req, "method_disabled", { userId: user.id, meta: { method: "email" } });
    res.json({ ok: true });
  });

  // ─── Backup codes ──────────────────────────────────────────────────────

  app.post("/api/auth/2fa/backup-codes/generate", requireAuth, async (req, res) => {
    if (blockImpersonation(req, res)) return;
    const user = await passwordOk(req, res);
    if (!user) return;
    const { methods } = await getMethodInfo(user);
    if (methods.length === 0) return res.status(400).json({ message: "Turn on a method first." });
    const codes = generateBackupCodes();
    await storage.replaceBackupCodes(user.id!, codes.map((c) => hashBackupCode(user.id!, c)));
    logSecurityEvent(req, "backup_codes_generated", { userId: user.id });
    res.json({ codes });
  });

  // ─── Trusted devices ──────────────────────────────────────────────────

  app.delete("/api/auth/2fa/devices/:id", requireAuth, async (req, res) => {
    const user = req.user!;
    const ok = await storage.removeTrustedDevice(user.id!, Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Not found" });
    logSecurityEvent(req, "trusted_device_revoked", { userId: user.id });
    res.json({ ok: true });
  });

  app.delete("/api/auth/2fa/devices", requireAuth, async (req, res) => {
    const user = req.user!;
    const n = await storage.revokeAllTrustedDevices(user.id!);
    if (n > 0) logSecurityEvent(req, "trusted_device_revoked", { userId: user.id, meta: { all: true, count: n } });
    res.json({ ok: true });
  });
}
