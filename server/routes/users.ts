import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency, invalidateUserCache } from "../auth";
import { canManageUser, isOwner } from "../permissions";
import {
  users,
  insertUsersSchema,
} from "@shared/schema";
import { fromDbKeys } from "../dbKeys";
import { handleZodError, wrapAsync, frontendBaseUrl } from "./_helpers";
import { sendInviteEmail } from "../email";
import crypto from "crypto";
import { stripSecrets } from "../twoFactor/pending";

/** Send an invite email and report whether it actually went out, so the route
 *  can tell the UI instead of claiming success. The invite link still works
 *  either way (the admin can copy it from the invite dialog). */
async function trySendInvite(params: Parameters<typeof sendInviteEmail>[0]): Promise<boolean> {
  try {
    return (await sendInviteEmail(params)) !== null;
  } catch (err) {
    console.error(`[email] Failed to send invite email to ${params.to}:`, err);
    return false;
  }
}

/** Owner and Admin reach every account (requireAgency), so they only live on the agency account. */
const AGENCY_ROLE_ON_CLIENT = "Owner and Admin users belong to the agency account";
const isAgencyRole = (role: unknown) => role === "Owner" || role === "Admin";

/**
 * A user as the read routes return it: no credentials, and a pending invite's
 * token swapped for `invite_pending` (the token is the invite link, so anyone
 * who reads it can accept the invite). Only the invite and resend routes hand
 * a token out, to whoever made the invite.
 */
function publicUser<T extends Record<string, any>>(user: T) {
  const safe: Record<string, any> = { ...stripSecrets(user) };
  delete safe.encryptedClaudeApiKey;
  if (typeof safe.preferences === "string" && safe.preferences.includes("invite_token")) {
    try {
      const { invite_token, ...rest } = JSON.parse(safe.preferences);
      safe.preferences = JSON.stringify({ ...rest, invite_pending: !!invite_token });
    } catch {
      safe.preferences = null;
    }
  }
  return safe;
}

export function registerUsersRoutes(app: Express): void {
  // ─── Users ────────────────────────────────────────────────────────
  // (users routes relate to account management and invites)

  app.get("/api/users", requireAuth, wrapAsync(async (req, res) => {
    const sessionUser = req.user!;
    const allUsers = await storage.getAppUsers();
    // Agency users (Owner/Admin on account 1) see all users;
    // sub-account users only see users from their own account.
    const isAgency =
      sessionUser.accountsId === 1 ||
      sessionUser.role === "Owner" ||
      sessionUser.role === "Admin";
    let data = isAgency
      ? allUsers
      : allUsers.filter((u: any) => u.accountsId === sessionUser.accountsId);
    // Admins must not see Owner-role users — keeps Finn from being able to act on Gabriel.
    if (!isOwner(sessionUser)) {
      data = data.filter((u: any) => u.role !== "Owner");
    }
    // Never expose credentials; `twoFactorEnabled` lets the Owner reset UI show its button.
    const withTwoFactor = await storage.userIdsWithTwoFactor();
    res.json(data.map((u: any) => ({ ...publicUser(u), twoFactorEnabled: withTwoFactor.has(u.id) })));
  }));

  app.get("/api/users/:id", requireAuth, wrapAsync(async (req, res) => {
    const sessionUser = req.user!;
    const user = await storage.getAppUserById(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    // Hide Owner-role users from non-Owners.
    if (user.role === "Owner" && !isOwner(sessionUser)) {
      return res.status(404).json({ message: "User not found" });
    }
    // Same reach as GET /api/users: the agency sees everyone, a client only its own account.
    const isAgency = sessionUser.accountsId === 1 || sessionUser.role === "Owner" || sessionUser.role === "Admin";
    if (!isAgency && user.accountsId !== sessionUser.accountsId) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(publicUser(user));
  }));

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const sessionUser = req.user!;
      const targetId = Number(req.params.id);
      const target = await storage.getAppUserById(targetId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const isAdminRole =
        sessionUser.role === "Owner" ||
        sessionUser.role === "Admin";

      // Self-edit OR admin-grade actor managing a non-Owner target.
      const selfEdit = sessionUser.id === targetId;
      if (!selfEdit && !canManageUser(sessionUser, target)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const rawBody = { ...req.body };
      if (!isAdminRole) {
        delete rawBody.role;
        delete rawBody.status;
        delete rawBody.accountsId;
        delete rawBody.Accounts_id;
      }
      // Only Owners can promote a user to Owner.
      if (rawBody.role === "Owner" && !isOwner(sessionUser)) {
        return res.status(403).json({ message: "Only an Owner can grant Owner role" });
      }
      // `preferencesPatch`: partial preferences object merged into the DB value
      // inside a single UPDATE statement (see storage.mergeAppUserPreferences),
      // so concurrent saves of different keys never overwrite each other.
      const prefsPatch = rawBody.preferencesPatch;
      delete rawBody.preferencesPatch;
      if (prefsPatch !== undefined) {
        if (!prefsPatch || typeof prefsPatch !== "object" || Array.isArray(prefsPatch)) {
          return res.status(400).json({ message: "preferencesPatch must be an object" });
        }
      }
      const parsed = insertUsersSchema.partial().safeParse(fromDbKeys(rawBody, users));
      if (!parsed.success) return handleZodError(res, parsed.error);
      if (parsed.data.role !== undefined || parsed.data.accountsId !== undefined) {
        const nextRole = parsed.data.role ?? target.role;
        const nextAccount = parsed.data.accountsId !== undefined ? parsed.data.accountsId : target.accountsId;
        if (isAgencyRole(nextRole)) {
          if (nextAccount == null) parsed.data.accountsId = 1;
          else if (nextAccount !== 1) return res.status(400).json({ message: AGENCY_ROLE_ON_CLIENT });
        }
      }
      const hasFields = Object.keys(parsed.data).length > 0;
      let updated = hasFields || prefsPatch === undefined
        ? await storage.updateAppUser(targetId, parsed.data as any)
        : target;
      if (updated && prefsPatch !== undefined) {
        updated = await storage.mergeAppUserPreferences(targetId, prefsPatch);
      }
      invalidateUserCache(targetId);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const safeUser = stripSecrets(updated);
      res.json(safeUser);
    } catch (err: any) {
      console.error("Error updating user:", err);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // POST /api/users/invite — generate invite token and create pending user record
  app.post("/api/users/invite", requireAgency, async (req, res) => {
    try {
      const { email, role, accountsId, lang = "en", sendEmail = true } = req.body;
      const shouldEmail = sendEmail !== false;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "email is required" });
      }
      if (!role || typeof role !== "string") {
        return res.status(400).json({ message: "role is required" });
      }
      // Same rule as PATCH /api/users/:id.
      if (role === "Owner" && !isOwner(req.user)) {
        return res.status(403).json({ message: "Only an Owner can grant Owner role" });
      }
      let inviteAccountId: number | null = accountsId ? Number(accountsId) || null : null;
      if (isAgencyRole(role)) {
        if (inviteAccountId == null) inviteAccountId = 1;
        else if (inviteAccountId !== 1) return res.status(400).json({ message: AGENCY_ROLE_ON_CLIENT });
      }

      const existing = await storage.getAppUserByEmail(email);
      if (existing) {
        if (existing.status === "Active") {
          return res.status(409).json({ message: "A user with this email is already active" });
        }
        if (existing.status === "Invited") {
          return res.status(409).json({ message: "A pending invite already exists for this email — use Resend instead" });
        }
        // status === "Inactive" — allow re-invite: update the existing record
        const inviteToken = crypto.randomBytes(32).toString("hex");
        const newPreferences = JSON.stringify({
          invite_token: inviteToken,
          invite_sent_at: new Date().toISOString(),
          invited_by: req.user?.email || "admin",
          lang,
        });
        const updated = await storage.updateAppUser(existing.id!, {
          status: "Invited",
          preferences: newPreferences,
        });
        if (!updated) return res.status(500).json({ message: "Failed to re-invite user" });
        invalidateUserCache(existing.id!);

        const safeUser = stripSecrets(updated);

        const baseUrl = frontendBaseUrl(req);
        const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}&email=${encodeURIComponent(email)}&lang=${encodeURIComponent(String(lang))}`;
        console.log(`\nRE-INVITE EMAIL (dev mode)\nTo: ${email}\nRole: ${role}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

        const emailSent = shouldEmail && await trySendInvite({
          to: email,
          inviteLink,
          role,
          invitedBy: req.user?.email || "admin",
          lang,
        });

        return res.status(200).json({
          user: safeUser,
          invite_token: inviteToken,
          email_sent: emailSent,
          message: !shouldEmail ? `Invite created for ${email} (no email sent)` : emailSent ? `Invite resent to ${email}` : `Invite created for ${email}, but the email failed to send`,
        });
      }

      const inviteToken = crypto.randomBytes(32).toString("hex");

      const preferences = JSON.stringify({
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString(),
        invited_by: req.user?.email || "admin",
        lang,
      });

      const newUser = await storage.createAppUser({
        email,
        role: role as any,
        status: "Invited",
        accountsId: inviteAccountId,
        preferences,
        notificationEmail: false, // email notifications are opt-in
        notificationSms: false,
        createdAt: new Date(), // stamp Member Since at invite time (Date object, never ISO string)
      } as any);

      const safeUser = stripSecrets(newUser);

      const baseUrl = frontendBaseUrl(req);
      const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}&email=${encodeURIComponent(email)}&lang=${encodeURIComponent(String(lang))}`;
      console.log(`\nINVITE EMAIL (dev mode)\nTo: ${email}\nRole: ${role}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

      const emailSent = shouldEmail && await trySendInvite({
        to: email,
        inviteLink,
        role,
        invitedBy: req.user?.email || "admin",
        lang,
      });

      res.status(201).json({
        user: safeUser,
        invite_token: inviteToken,
        email_sent: emailSent,
        message: !shouldEmail ? `Invite created for ${email} (no email sent)` : emailSent ? `Invite sent to ${email}` : `Invite created for ${email}, but the email failed to send`,
      });
    } catch (err: any) {
      console.error("Error creating invite:", err);
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  // POST /api/users/:id/resend-invite — regenerate and resend invite token
  app.post("/api/users/:id/resend-invite", requireAgency, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user ID" });

      const user = await storage.getAppUserById(targetId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.status !== "Invited") {
        return res.status(400).json({ message: "User has already accepted their invite" });
      }

      const inviteToken = crypto.randomBytes(32).toString("hex");

      let existingPrefs: Record<string, any> = {};
      if (user.preferences) {
        try {
          existingPrefs = typeof user.preferences === "string"
            ? JSON.parse(user.preferences)
            : user.preferences as any;
        } catch {}
      }

      const lang = (existingPrefs.lang || "en") as any;

      const newPreferences = JSON.stringify({
        ...existingPrefs,
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString(),
        invited_by: req.user?.email || "admin",
        lang,
      });

      const updated = await storage.updateAppUser(targetId, { preferences: newPreferences });
      invalidateUserCache(targetId);
      if (!updated) return res.status(404).json({ message: "Failed to update user" });

      const safeUser = stripSecrets(updated);

      const baseUrl = frontendBaseUrl(req);
      const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}&email=${encodeURIComponent(user.email || "")}&lang=${encodeURIComponent(String(lang))}`;
      console.log(`\nRESENT INVITE (dev mode)\nTo: ${user.email}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

      const emailSent = await trySendInvite({
        to: user.email || "",
        inviteLink,
        role: user.role || "Viewer",
        invitedBy: req.user?.email || "admin",
        lang,
      });

      res.json({
        user: safeUser,
        invite_token: inviteToken,
        email_sent: emailSent,
        message: emailSent ? `Invite resent to ${user.email}` : `Invite created for ${user.email}, but the email failed to send`,
      });
    } catch (err: any) {
      console.error("Error resending invite:", err);
      res.status(500).json({ message: "Failed to resend invite" });
    }
  });

  // POST /api/users/:id/revoke-invite — clear invite token (revoke pending invite)
  app.post("/api/users/:id/revoke-invite", requireAgency, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user ID" });

      const user = await storage.getAppUserById(targetId);
      if (!user) return res.status(404).json({ message: "User not found" });

      let existingPrefs: Record<string, any> = {};
      if (user.preferences) {
        try {
          existingPrefs = typeof user.preferences === "string"
            ? JSON.parse(user.preferences)
            : user.preferences as any;
        } catch {}
      }

      const { invite_token, invite_sent_at, ...remainingPrefs } = existingPrefs;
      const newPreferences = JSON.stringify({
        ...remainingPrefs,
        invite_revoked_at: new Date().toISOString(),
      });

      const updated = await storage.updateAppUser(targetId, {
        preferences: newPreferences,
        status: "Inactive",
      });
      if (!updated) return res.status(404).json({ message: "Failed to update user" });
      invalidateUserCache(targetId);

      const safeUser = stripSecrets(updated);

      res.json({
        user: safeUser,
        message: `Invite revoked for ${user.email}`,
      });
    } catch (err: any) {
      console.error("Error revoking invite:", err);
      res.status(500).json({ message: "Failed to revoke invite" });
    }
  });
}
