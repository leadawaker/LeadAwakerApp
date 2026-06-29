import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { canManageUser, isOwner } from "../permissions";
import {
  users,
  insertUsersSchema,
} from "@shared/schema";
import { fromDbKeys } from "../dbKeys";
import { handleZodError, wrapAsync, frontendBaseUrl } from "./_helpers";
import { sendInviteEmail } from "../email";
import crypto from "crypto";

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
    res.json(data);
  }));

  app.get("/api/users/:id", requireAuth, wrapAsync(async (req, res) => {
    const sessionUser = req.user!;
    const user = await storage.getAppUserById(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    // Hide Owner-role users from non-Owners.
    if (user.role === "Owner" && !isOwner(sessionUser)) {
      return res.status(404).json({ message: "User not found" });
    }
    // Never expose password hash
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
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
      const parsed = insertUsersSchema.partial().safeParse(fromDbKeys(rawBody, users));
      if (!parsed.success) return handleZodError(res, parsed.error);
      const updated = await storage.updateAppUser(targetId, parsed.data as any);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err: any) {
      console.error("Error updating user:", err);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // POST /api/users/invite — generate invite token and create pending user record
  app.post("/api/users/invite", requireAgency, async (req, res) => {
    try {
      const { email, role, accountsId, lang = "en" } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "email is required" });
      }
      if (!role || typeof role !== "string") {
        return res.status(400).json({ message: "role is required" });
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

        const { passwordHash: _, ...safeUser } = updated;

        const baseUrl = frontendBaseUrl(req);
        const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}&email=${encodeURIComponent(email)}`;
        console.log(`\nRE-INVITE EMAIL (dev mode)\nTo: ${email}\nRole: ${role}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

        sendInviteEmail({
          to: email,
          inviteLink,
          role,
          invitedBy: req.user?.email || "admin",
          lang,
        }).catch((err) => console.error("[email] Failed to send re-invite email:", err));

        return res.status(200).json({
          user: safeUser,
          invite_token: inviteToken,
          message: `Invite resent to ${email}`,
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
        accountsId: accountsId ? Number(accountsId) : null,
        preferences,
        notificationEmail: true,
        notificationSms: false,
        createdAt: new Date(), // stamp Member Since at invite time (Date object, never ISO string)
      } as any);

      const { passwordHash: _, ...safeUser } = newUser;

      const baseUrl = frontendBaseUrl(req);
      const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}&email=${encodeURIComponent(email)}`;
      console.log(`\nINVITE EMAIL (dev mode)\nTo: ${email}\nRole: ${role}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

      sendInviteEmail({
        to: email,
        inviteLink,
        role,
        invitedBy: req.user?.email || "admin",
        lang,
      }).catch((err) => console.error("[email] Failed to send invite email:", err));

      res.status(201).json({
        user: safeUser,
        invite_token: inviteToken,
        message: `Invite sent to ${email}`,
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
      if (!updated) return res.status(404).json({ message: "Failed to update user" });

      const { passwordHash: _, ...safeUser } = updated;

      const baseUrl = frontendBaseUrl(req);
      const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}&email=${encodeURIComponent(user.email || "")}`;
      console.log(`\nRESENT INVITE (dev mode)\nTo: ${user.email}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

      sendInviteEmail({
        to: user.email || "",
        inviteLink,
        role: user.role || "Viewer",
        invitedBy: req.user?.email || "admin",
        lang,
      }).catch((err) => console.error("[email] Failed to resend invite email:", err));

      res.json({
        user: safeUser,
        invite_token: inviteToken,
        message: `Invite resent to ${user.email}`,
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

      const { passwordHash: _, ...safeUser } = updated;

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
