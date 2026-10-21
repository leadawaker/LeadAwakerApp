/** Passkey (WebAuthn) routes and login verification (specs/two-factor-auth Phase 3). */
import type { Express, Request, Response } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { Users } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, invalidateUserCache, verifyPassword } from "../auth";
import { webauthnConfig, toBase64Url, fromBase64Url } from "../twoFactor/webauthn";
import { getPending, hasStepUp, cleanupIfNoMethods } from "../twoFactor/pending";
import { logSecurityEvent } from "../twoFactor/audit";

const CHALLENGE_TTL_MS = 5 * 60_000;

const transportsOf = (json: string | null): any[] => {
  try { return JSON.parse(json || "[]"); } catch { return []; }
};

/** Verifies the browser's assertion for the pending login. True on success. */
export async function verifyPasskeyLogin(req: Request, user: Users, response: any): Promise<boolean> {
  const pending = getPending(req);
  const challenge = pending?.passkeyChallenge;
  if (!pending || !challenge || Date.now() > challenge.expiresAt) return false;
  delete pending.passkeyChallenge; // one challenge per attempt
  if (!response || typeof response.id !== "string") return false;
  const stored = await storage.getPasskeyByCredentialId(response.id);
  if (!stored || stored.usersId !== user.id) return false;
  try {
    const cfg = webauthnConfig();
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: cfg.origins,
      expectedRPID: cfg.rpID,
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: fromBase64Url(stored.publicKey),
        counter: stored.counter,
        transports: transportsOf(stored.transports),
      },
    });
    if (!result.verified) return false;
    await storage.touchPasskey(stored.id, result.authenticationInfo.newCounter, new Date());
    return true;
  } catch (err: any) {
    console.error("[2fa] passkey verification failed:", err?.message);
    return false;
  }
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

export function registerTwoFactorPasskeyRoutes(app: Express) {
  /** Login: options for navigator.credentials.get (needs the pending record). */
  app.post("/api/auth/2fa/passkey/auth/options", async (req, res) => {
    const pending = getPending(req);
    if (!pending) return res.status(401).json({ message: "Session expired, sign in again", restart: true });
    const passkeys = await storage.listPasskeys(pending.userId);
    if (passkeys.length === 0) return res.status(400).json({ message: "No passkey registered." });
    const cfg = webauthnConfig();
    const options = await generateAuthenticationOptions({
      rpID: cfg.rpID,
      userVerification: "required",
      allowCredentials: passkeys.map((p) => ({ id: p.credentialId, transports: transportsOf(p.transports) })),
    });
    pending.passkeyChallenge = { challenge: options.challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS };
    res.json(options);
  });

  /** Settings: options for navigator.credentials.create. Needs the password. */
  app.post("/api/auth/2fa/passkey/register/options", requireAuth, async (req, res) => {
    if (req.session.impersonation) return res.status(403).json({ message: "Not available while impersonating." });
    const user = await passwordOk(req, res);
    if (!user) return;
    const cfg = webauthnConfig();
    const existing = await storage.listPasskeys(user.id!);
    const options = await generateRegistrationOptions({
      rpName: cfg.rpName,
      rpID: cfg.rpID,
      userName: user.email || String(user.id),
      userDisplayName: user.fullName1 || user.email || undefined,
      userID: new TextEncoder().encode(String(user.id)),
      attestationType: "none",
      excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: transportsOf(p.transports) })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    });
    req.session.passkeyRegChallenge = { challenge: options.challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS };
    res.json(options);
  });

  app.post("/api/auth/2fa/passkey/register/verify", requireAuth, async (req, res) => {
    if (req.session.impersonation) return res.status(403).json({ message: "Not available while impersonating." });
    const user = req.user!;
    const pending = req.session.passkeyRegChallenge;
    delete req.session.passkeyRegChallenge;
    if (!pending || Date.now() > pending.expiresAt) return res.status(400).json({ message: "Registration expired, try again." });
    try {
      const cfg = webauthnConfig();
      const result = await verifyRegistrationResponse({
        response: req.body?.response,
        expectedChallenge: pending.challenge,
        expectedOrigin: cfg.origins,
        expectedRPID: cfg.rpID,
        requireUserVerification: true,
      });
      if (!result.verified) return res.status(400).json({ message: "Passkey could not be verified." });
      const cred = result.registrationInfo.credential;
      const label = String(req.body?.deviceLabel ?? "").trim().slice(0, 60) || null;
      await storage.addPasskey({
        userId: user.id!,
        credentialId: cred.id,
        publicKey: toBase64Url(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports as string[] | undefined,
        deviceLabel: label,
      });
      invalidateUserCache(user.id!);
      logSecurityEvent(req, "passkey_added", { userId: user.id });
      logSecurityEvent(req, "method_enabled", { userId: user.id, meta: { method: "passkey" } });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[2fa] passkey registration failed:", err?.message);
      res.status(400).json({ message: "Passkey could not be verified." });
    }
  });

  app.patch("/api/auth/2fa/passkey/:id", requireAuth, async (req, res) => {
    const label = String(req.body?.label ?? "").trim().slice(0, 60);
    if (!label) return res.status(400).json({ message: "Name is required." });
    const ok = await storage.renamePasskey(req.user!.id!, Number(req.params.id), label);
    res.status(ok ? 200 : 404).json(ok ? { ok: true } : { message: "Not found" });
  });

  /** Removing a passkey needs a recent second-factor proof (step-up). */
  app.delete("/api/auth/2fa/passkey/:id", requireAuth, async (req, res) => {
    if (!hasStepUp(req)) return res.status(403).json({ message: "Confirm with a code first.", code: "STEP_UP_REQUIRED" });
    const user = req.user!;
    const ok = await storage.removePasskey(user.id!, Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Not found" });
    await cleanupIfNoMethods(user.id!);
    invalidateUserCache(user.id!);
    logSecurityEvent(req, "passkey_removed", { userId: user.id });
    logSecurityEvent(req, "method_disabled", { userId: user.id, meta: { method: "passkey" } });
    res.json({ ok: true });
  });
}
