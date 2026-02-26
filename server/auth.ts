import crypto from "crypto";
import { promisify } from "util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import type { Express, Request, Response, NextFunction } from "express";
import type { Users } from "@shared/schema";

const scrypt = promisify(crypto.scrypt);

// Extend Express.User to match our AppUser type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends Users {}
  }
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, stored] = parts;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(stored, "hex");
  const derivedHex = derived.toString("hex");
  // Ensure same length before timingSafeEqual
  if (storedBuf.length !== derivedHex.length / 2) return false;
  return crypto.timingSafeEqual(Buffer.from(derivedHex, "hex"), storedBuf);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export function setupAuth(app: Express) {
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
        // Store sessions in the public schema (separate from NocoDB data)
        tableName: "session",
      }),
      secret: process.env.SESSION_SECRET || "leadawaker-dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getAppUserByEmail(email);
          if (!user || !user.passwordHash) {
            return done(null, false, { message: "Invalid email or password" });
          }
          const valid = await verifyPassword(password, user.passwordHash);
          if (!valid) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Short-lived in-process cache so deserializeUser doesn't hit the DB on
  // every authenticated request (passport calls this once per API call).
  const userCache = new Map<number, { user: Users; expiresAt: number }>();
  const USER_CACHE_TTL_MS = 60_000;

  passport.deserializeUser(async (id: unknown, done) => {
    const numId = Number(id);
    const cached = userCache.get(numId);
    if (cached && cached.expiresAt > Date.now()) {
      return done(null, cached.user);
    }
    try {
      const user = await storage.getAppUserById(numId);
      if (user) userCache.set(numId, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
      done(null, user ?? false);
    } catch (err) {
      done(err);
    }
  });
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
}

/** Only the agency account (accountsId === 1) can access this route. */
export function requireAgency(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  if (req.user!.accountsId !== 1) {
    return res.status(403).json({ message: "Agency access required" });
  }
  next();
}

/** Restricts data to the caller's account unless they are the agency (account 1). */
export function scopeToAccount(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  const user = req.user!;
  // Agency can pass ?accountId= freely; subaccounts are locked to their own
  if (user.accountsId !== 1) {
    (req as any).forcedAccountId = user.accountsId;
  }
  next();
}

// ─── In-memory rate limiter for accept-invite (no extra dependencies needed) ─

const acceptInviteAttempts = new Map<string, number[]>();
function checkAcceptInviteRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const attempts = (acceptInviteAttempts.get(ip) || []).filter(t => now - t < window);
  if (attempts.length >= 10) return false;
  attempts.push(now);
  acceptInviteAttempts.set(ip, attempts);
  return true;
}

// ─── Auth Route Handlers (mounted by registerRoutes) ────────────────────────

export function registerAuthRoutes(app: Express) {
  /** POST /api/auth/login — email + password */
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate(
      "local",
      (err: Error | null, user: Users | false, info: { message: string } | undefined) => {
        if (err) return next(err);
        if (!user) {
          return res.status(401).json({ message: info?.message || "Invalid credentials" });
        }
        req.logIn(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          // Return safe user object (exclude passwordHash)
          const { passwordHash: _, ...safeUser } = user;
          res.json({ user: safeUser });
        });
      },
    )(req, res, next);
  });

  /** POST /api/auth/logout */
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
      });
    });
  });

  /** GET /api/auth/me — returns session user or 401 */
  app.get("/api/auth/me", requireAuth, (req, res) => {
    const { passwordHash: _, ...safeUser } = req.user!;
    res.json({ user: safeUser });
  });

  /** POST /api/auth/change-password — change password with current password verification */
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      // Validate required fields
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "All fields are required." });
      }

      // Validate new password length
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters." });
      }

      // Validate new password matches confirmation
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "New password and confirmation do not match." });
      }

      // Fetch the full user record (including passwordHash) from DB
      const userId = (req.user as any).id;
      const userRecord = await storage.getAppUserById(userId);
      if (!userRecord || !userRecord.passwordHash) {
        return res.status(400).json({ message: "Cannot change password for this account." });
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, userRecord.passwordHash);
      if (!isValid) {
        return res.status(400).json({ message: "Current password is incorrect." });
      }

      // Hash the new password and update the user record
      const newHash = await hashPassword(newPassword);
      const updated = await storage.updateAppUser(userId, { passwordHash: newHash } as any);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update password." });
      }

      res.json({ message: "Password changed successfully." });
    } catch (err: any) {
      console.error("Error changing password:", err);
      res.status(500).json({ message: "Failed to change password", error: err.message });
    }
  });

  /** POST /api/auth/accept-invite — validate invite token and activate a new user account */
  app.post("/api/auth/accept-invite", async (req, res) => {
    try {
      const { token, email, password, confirmPassword, fullName } = req.body;

      // 1. Validate all fields are present
      if (!token || !email || !password || !confirmPassword || !fullName) {
        return res.status(400).json({ message: "All fields are required." });
      }

      // 2. Password length check
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters." });
      }

      // 3. Password confirmation check
      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match." });
      }

      // 4. Rate limit: 10 attempts per IP per 15 minutes
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkAcceptInviteRateLimit(ip)) {
        return res.status(429).json({ message: "Too many attempts. Please try again later." });
      }

      // 5. Look up user by email
      const user = await storage.getAppUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired invite link." });
      }

      // 6. Ensure the invite has not already been accepted or revoked
      if (user.status !== "Invited") {
        return res.status(400).json({ message: "This invite has already been accepted or revoked." });
      }

      // 7. Parse preferences to extract invite_token and invite_sent_at
      let prefs: Record<string, any> = {};
      try {
        prefs = typeof user.preferences === "string"
          ? JSON.parse(user.preferences)
          : (user.preferences ?? {});
      } catch {
        return res.status(400).json({ message: "Invalid or expired invite link." });
      }

      const storedToken: string | undefined = prefs.invite_token;
      const inviteSentAt: string | undefined = prefs.invite_sent_at;

      if (!storedToken || !inviteSentAt) {
        return res.status(400).json({ message: "Invalid or expired invite link." });
      }

      // 8. Constant-time token comparison
      try {
        const providedBuf = Buffer.from(token, "hex");
        const storedBuf = Buffer.from(storedToken, "hex");
        // Both must be exactly 32 bytes (64 hex chars)
        if (providedBuf.length !== 32 || storedBuf.length !== 32) {
          return res.status(400).json({ message: "Invalid or expired invite link." });
        }
        if (!crypto.timingSafeEqual(providedBuf, storedBuf)) {
          return res.status(400).json({ message: "Invalid or expired invite link." });
        }
      } catch {
        return res.status(400).json({ message: "Invalid or expired invite link." });
      }

      // 9. Expiration check: token valid for 72 hours
      if (Date.now() - new Date(inviteSentAt).getTime() > 72 * 60 * 60 * 1000) {
        return res.status(400).json({
          message: "This invite link has expired. Please ask your administrator to resend the invite.",
        });
      }

      // 10. Hash the new password
      const newHash = await hashPassword(password);

      // 11. Strip invite_token from preferences, record acceptance timestamp
      const { invite_token: _removed, ...restPrefs } = prefs;
      const newPrefs = { ...restPrefs, invite_accepted_at: new Date().toISOString() };
      const newPrefsJson = JSON.stringify(newPrefs);

      // 12. Persist updates
      if (user.id === null) {
        return res.status(500).json({ message: "Failed to activate account." });
      }
      await storage.updateAppUser(user.id, {
        passwordHash: newHash,
        status: "Active",
        fullName1: fullName,
        preferences: newPrefsJson,
      } as any);

      // 13. Success
      return res.status(200).json({ message: "Account activated successfully. You can now sign in." });
    } catch (err: any) {
      console.error("Error accepting invite:", err);
      return res.status(500).json({ message: "Failed to activate account." });
    }
  });
}
