import type { Express } from "express";
import { pool } from "../db";
import { storage } from "../storage";
import { hashPassword, invalidateUserCache, resolveLoginEmail } from "../auth";
import { logSecurityEvent } from "../twoFactor/audit";
import { createRateLimiter } from "../social/rateLimit";
import {
  RESET_PREF_KEY, RESET_MIN_PASSWORD, RESET_MAX_PASSWORD,
  createResetToken, verifyResetToken, pickResetLang, buildResetUrl, normalizeEmail,
} from "../passwordReset";
import { sendPasswordResetEmail } from "../passwordResetEmail";

const HOUR = 60 * 60 * 1000;
// Per email: 3 mails an hour. Per IP: 10 requests an hour (covers many typed addresses).
const emailLimiter = createRateLimiter({ max: 3, windowMs: HOUR });
const requestIpLimiter = createRateLimiter({ max: 10, windowMs: HOUR });
// Guessing a 256-bit token is hopeless, but the endpoint still burns a scrypt per try.
const resetIpLimiter = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

const GENERIC_REQUEST_MESSAGE = "If an account exists for that email, we sent a password reset link.";
const INVALID_LINK_MESSAGE = "Invalid or expired link";

/** The mail for one request. Runs after the response is sent so timing never tells whether the account exists. */
async function sendResetFor(typedEmail: string, langParam: unknown): Promise<void> {
  if (!emailLimiter.take(typedEmail)) return; // silent: a 429 here would confirm the address
  const user = await storage.getAppUserByEmail(resolveLoginEmail(typedEmail));
  if (!user || user.id == null || user.status !== "Active" || !user.email) return;

  const { token, record } = createResetToken();
  await storage.mergeAppUserPreferences(user.id, { [RESET_PREF_KEY]: record });
  const lang = pickResetLang(user.preferences, langParam);
  await sendPasswordResetEmail(user.email, lang, buildResetUrl(token, user.email, lang));
}

export function registerPasswordResetRoutes(app: Express): void {
  /** POST /api/auth/request-reset: always the same 200 reply, whether or not the account exists. */
  app.post("/api/auth/request-reset", (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!requestIpLimiter.take(ip)) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    res.status(200).json({ message: GENERIC_REQUEST_MESSAGE });

    const email = normalizeEmail(req.body?.email);
    if (!email) return;
    sendResetFor(email, req.body?.lang).catch((err) => {
      // Message only: the error text from the mail providers never contains the link.
      console.error("[password-reset] request failed:", err?.message ?? err);
    });
  });

  /** POST /api/auth/reset-password: swap the emailed token for a new password. */
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, email, password, confirmPassword } = req.body ?? {};
      if (typeof password !== "string" || password.length < RESET_MIN_PASSWORD) {
        return res.status(400).json({ message: `Password must be at least ${RESET_MIN_PASSWORD} characters.` });
      }
      if (password.length > RESET_MAX_PASSWORD) {
        return res.status(400).json({ message: "Password is too long." });
      }
      if (confirmPassword !== undefined && confirmPassword !== password) {
        return res.status(400).json({ message: "Passwords do not match." });
      }

      const ip = req.ip || req.socket.remoteAddress || "unknown";
      if (!resetIpLimiter.take(ip)) {
        return res.status(429).json({ message: "Too many attempts. Please try again later." });
      }

      const typed = normalizeEmail(email);
      const user = typed ? await storage.getAppUserByEmail(resolveLoginEmail(typed)) : undefined;
      if (!user || user.id == null || user.status !== "Active" || !verifyResetToken(user.preferences, token)) {
        return res.status(400).json({ message: INVALID_LINK_MESSAGE });
      }

      const passwordHash = await hashPassword(password);
      const updated = await storage.updateAppUser(user.id, { passwordHash } as any);
      if (!updated) return res.status(500).json({ message: "Failed to reset password." });
      // Single use: the hash is gone before anything else can fail.
      await storage.mergeAppUserPreferences(user.id, { [RESET_PREF_KEY]: null });
      invalidateUserCache(user.id);
      // Whoever knew the old password (or held a stolen session) is signed out everywhere.
      await pool.query(`DELETE FROM session WHERE sess::jsonb -> 'passport' ->> 'user' = $1`, [String(user.id)]);
      await storage.revokeAllTrustedDevices(user.id);
      logSecurityEvent(req, "password_changed", { userId: user.id, actorId: user.id, accountId: user.accountsId, meta: { via: "reset_link" } });

      res.json({ message: "Password updated." });
    } catch (err: any) {
      console.error("[password-reset] reset failed:", err?.message ?? err);
      res.status(500).json({ message: "Failed to reset password." });
    }
  });
}
