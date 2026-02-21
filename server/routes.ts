import type { Express, Request } from "express";
import { type Server } from "http";
import { storage, paginatedQuery } from "./storage";
import {
  requireAuth,
  requireAgency,
  scopeToAccount,
  registerAuthRoutes,
} from "./auth";
import {
  accounts,
  campaigns,
  leads,
  interactions,
  tags,
  leadsTags,
  automationLogs,
  users,
  promptLibrary,
  leadScoreHistory,
  campaignMetricsHistory,
  insertAccountsSchema,
  insertCampaignsSchema,
  insertLeadsSchema,
  insertInteractionsSchema,
  insertTagsSchema,
  insertLeads_TagsSchema,
  insertPrompt_LibrarySchema,
} from "@shared/schema";
import crypto from "crypto";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "./dbKeys";
import { db } from "./db";
import { eq, count, inArray, and, type SQL } from "drizzle-orm";
import { ZodError } from "zod";

/** Return a 422 with Zod validation errors in a readable format. */
function handleZodError(res: import("express").Response, err: ZodError) {
  return res.status(422).json({
    message: "Validation error",
    errors: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
  });
}

/**
 * Coerce ISO date strings to Date objects for Drizzle timestamp fields.
 * JSON payloads send dates as strings, but Drizzle/Zod expects Date objects.
 */
function coerceDates(body: Record<string, unknown>, dateFields: string[]): Record<string, unknown> {
  const result = { ...body };
  for (const field of dateFields) {
    if (typeof result[field] === "string" && result[field]) {
      const d = new Date(result[field] as string);
      if (!isNaN(d.getTime())) result[field] = d;
    }
  }
  return result;
}

/**
 * Extract pagination params from query string.
 * Returns null if pagination is not requested (no `page` param).
 */
function getPagination(req: Request) {
  const page = req.query.page ? Number(req.query.page) : null;
  if (page === null || isNaN(page) || page < 1) return null;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const sort = req.query.sort as string | undefined;
  const order = (req.query.order as string) === "asc" ? "asc" as const : "desc" as const;
  return { page, limit, sort, order };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // ─── Auth Routes (public) ──────────────────────────────────────────
  registerAuthRoutes(app);

  // ─── Health / Schema Check (public for monitoring) ────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      // Quick connectivity check — count from each of the 11 tables
      const tables = [
        { name: "Accounts", query: () => db.select({ total: count() }).from(accounts) },
        { name: "Leads", query: () => db.select({ total: count() }).from(leads) },
        { name: "Campaigns", query: () => db.select({ total: count() }).from(campaigns) },
        { name: "Interactions", query: () => db.select({ total: count() }).from(interactions) },
        { name: "Users", query: () => db.select({ total: count() }).from(users) },
        { name: "Tags", query: () => db.select({ total: count() }).from(tags) },
        { name: "Leads_Tags", query: () => db.select({ total: count() }).from(leadsTags) },
        { name: "Automation_Logs", query: () => db.select({ total: count() }).from(automationLogs) },
        { name: "Prompt_Library", query: () => db.select({ total: count() }).from(promptLibrary) },
        { name: "Lead_Score_History", query: () => db.select({ total: count() }).from(leadScoreHistory) },
        { name: "Campaign_Metrics_History", query: () => db.select({ total: count() }).from(campaignMetricsHistory) },
      ];

      const results: Record<string, { accessible: boolean; rowCount: number; error?: string }> = {};
      let allAccessible = true;

      for (const t of tables) {
        try {
          const [row] = await t.query();
          results[t.name] = { accessible: true, rowCount: row.total };
        } catch (err: any) {
          results[t.name] = { accessible: false, rowCount: 0, error: err.message };
          allAccessible = false;
        }
      }

      res.json({
        status: allAccessible ? "healthy" : "degraded",
        database: "connected",
        tables: results,
        totalTables: tables.length,
        accessibleTables: Object.values(results).filter((r) => r.accessible).length,
      });
    } catch (err: any) {
      res.status(500).json({ status: "error", database: "disconnected", error: err.message });
    }
  });

  // ─── Accounts ─────────────────────────────────────────────────────
  // Only the agency can manage accounts

  app.get("/api/accounts", requireAgency, async (req, res) => {
    const pagination = getPagination(req);
    if (pagination) {
      const result = await paginatedQuery(accounts, pagination);
      return res.json({ ...result, data: toDbKeysArray(result.data as any, accounts) });
    }
    const data = await storage.getAccounts();
    res.json(toDbKeysArray(data as any, accounts));
  });

  app.get("/api/accounts/:id", requireAgency, async (req, res) => {
    const account = await storage.getAccountById(Number(req.params.id));
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.json(toDbKeys(account as any, accounts));
  });

  app.post("/api/accounts", requireAgency, async (req, res) => {
    const parsed = insertAccountsSchema.safeParse(fromDbKeys(req.body, accounts));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const account = await storage.createAccount(parsed.data);
    res.status(201).json(toDbKeys(account as any, accounts));
  });

  app.patch("/api/accounts/:id", requireAgency, async (req, res) => {
    const parsed = insertAccountsSchema.partial().safeParse(fromDbKeys(req.body, accounts));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const account = await storage.updateAccount(Number(req.params.id), parsed.data);
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.json(toDbKeys(account as any, accounts));
  });

  app.delete("/api/accounts/:id", requireAgency, async (req, res) => {
    const ok = await storage.deleteAccount(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Account not found" });
    res.status(204).end();
  });

  // ─── Campaigns ────────────────────────────────────────────────────

  app.get("/api/campaigns", requireAuth, scopeToAccount, async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);

    const pagination = getPagination(req);
    if (pagination) {
      const where = accountId ? eq(campaigns.accountsId, accountId) : undefined;
      const result = await paginatedQuery(campaigns, pagination, where);
      return res.json({ ...result, data: toDbKeysArray(result.data as any, campaigns) });
    }

    const data = accountId
      ? await storage.getCampaignsByAccountId(accountId)
      : await storage.getCampaigns();
    res.json(toDbKeysArray(data as any, campaigns));
  });

  app.get("/api/campaigns/:id", requireAuth, async (req, res) => {
    const campaign = await storage.getCampaignById(Number(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json(toDbKeys(campaign as any, campaigns));
  });

  app.post("/api/campaigns", requireAuth, async (req, res) => {
    const parsed = insertCampaignsSchema.safeParse(fromDbKeys(req.body, campaigns));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const campaign = await storage.createCampaign(parsed.data);
    res.status(201).json(toDbKeys(campaign as any, campaigns));
  });

  app.patch("/api/campaigns/:id", requireAuth, async (req, res) => {
    const parsed = insertCampaignsSchema.partial().safeParse(fromDbKeys(req.body, campaigns));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const campaign = await storage.updateCampaign(Number(req.params.id), parsed.data);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json(toDbKeys(campaign as any, campaigns));
  });

  app.delete("/api/campaigns/:id", requireAuth, async (req, res) => {
    const ok = await storage.deleteCampaign(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Campaign not found" });
    res.status(204).end();
  });

  // ─── Leads ────────────────────────────────────────────────────────

  app.get("/api/leads", requireAuth, scopeToAccount, async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const { accountId: qAccountId, campaignId } = req.query;
    const accountId = forcedId ?? (qAccountId ? Number(qAccountId) : undefined);

    const pagination = getPagination(req);
    if (pagination) {
      let where: SQL | undefined;
      if (campaignId) {
        where = eq(leads.campaignsId, Number(campaignId));
      } else if (accountId) {
        where = eq(leads.accountsId, accountId);
      }
      const result = await paginatedQuery(leads, pagination, where);
      return res.json({ ...result, data: toDbKeysArray(result.data as any, leads) });
    }

    let data;
    if (campaignId) {
      data = await storage.getLeadsByCampaignId(Number(campaignId));
    } else if (accountId) {
      data = await storage.getLeadsByAccountId(accountId);
    } else {
      data = await storage.getLeads();
    }
    res.json(toDbKeysArray(data as any, leads));
  });

  app.get("/api/leads/:id", requireAuth, async (req, res) => {
    const lead = await storage.getLeadById(Number(req.params.id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(toDbKeys(lead as any, leads));
  });

  app.post("/api/leads", requireAuth, async (req, res) => {
    const parsed = insertLeadsSchema.safeParse(fromDbKeys(req.body, leads));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const lead = await storage.createLead(parsed.data);
    res.status(201).json(toDbKeys(lead as any, leads));
  });

  app.patch("/api/leads/:id", requireAuth, async (req, res) => {
    const LEAD_DATE_FIELDS = [
      "bookedCallDate", "lastMessageSentAt", "lastMessageReceivedAt",
      "bump1SentAt", "bump2SentAt", "bump3SentAt", "firstMessageSentAt",
      "nextActionAt", "bookingConfirmedAt", "createdAt", "updatedAt",
    ];
    const body = coerceDates(fromDbKeys(req.body, leads) as Record<string, unknown>, LEAD_DATE_FIELDS);
    const parsed = insertLeadsSchema.partial().safeParse(body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const lead = await storage.updateLead(Number(req.params.id), parsed.data);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(toDbKeys(lead as any, leads));
  });

  app.delete("/api/leads/:id", requireAuth, async (req, res) => {
    const ok = await storage.deleteLead(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Lead not found" });
    res.status(204).end();
  });

  // ─── Bulk Lead Operations ──────────────────────────────────────────

  // Bulk update leads (move stage, assign campaign)
  app.post("/api/leads/bulk-update", requireAuth, async (req, res) => {
    try {
      const { ids, data } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "ids must be a non-empty array" });
      }
      if (!data || typeof data !== "object") {
        return res.status(400).json({ message: "data must be an object with fields to update" });
      }

      // Convert from DB column names to JS camelCase for Drizzle
      const parsed = insertLeadsSchema.partial().safeParse(fromDbKeys(data, leads));
      if (!parsed.success) return handleZodError(res, parsed.error);

      const updated = await storage.bulkUpdateLeads(
        ids.map(Number),
        parsed.data,
      );

      res.json({
        updated: updated.length,
        leads: toDbKeysArray(updated as any, leads),
      });
    } catch (err: any) {
      console.error("Bulk update error:", err);
      res.status(500).json({ message: err.message || "Bulk update failed" });
    }
  });

  // Bulk add tags to leads
  app.post("/api/leads/bulk-tag", requireAuth, async (req, res) => {
    try {
      const { leadIds, tagIds } = req.body;
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ message: "leadIds must be a non-empty array" });
      }
      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return res.status(400).json({ message: "tagIds must be a non-empty array" });
      }

      const created: any[] = [];
      for (const leadId of leadIds) {
        // Check existing tags for this lead to avoid duplicates
        const existingTags = await storage.getTagsByLeadId(Number(leadId));
        const existingTagIds = new Set(existingTags.map((t: any) => t.tagsId));

        for (const tagId of tagIds) {
          if (existingTagIds.has(Number(tagId))) continue; // Skip duplicates
          const row = await storage.createLeadTag({
            leadsId: Number(leadId),
            tagsId: Number(tagId),
          });
          created.push(row);
        }
      }

      res.json({
        created: created.length,
        message: `Applied ${tagIds.length} tag(s) to ${leadIds.length} lead(s)`,
      });
    } catch (err: any) {
      console.error("Bulk tag error:", err);
      res.status(500).json({ message: err.message || "Bulk tag failed" });
    }
  });

  // ─── Interactions ─────────────────────────────────────────────────

  app.get("/api/interactions", requireAuth, scopeToAccount, async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);

    const pagination = getPagination(req);
    if (pagination) {
      let where: SQL | undefined;
      if (leadId) {
        where = eq(interactions.leadsId, leadId);
      } else if (accountId) {
        where = eq(interactions.accountsId, accountId);
      }
      const result = await paginatedQuery(interactions, pagination, where);
      return res.json({ ...result, data: toDbKeysArray(result.data as any, interactions) });
    }

    let data;
    if (leadId) {
      data = await storage.getInteractionsByLeadId(leadId);
    } else if (accountId) {
      data = await storage.getInteractionsByAccountId(accountId);
    } else {
      data = await storage.getInteractions();
    }
    res.json(toDbKeysArray(data as any, interactions));
  });

  app.post("/api/interactions", requireAuth, async (req, res) => {
    const parsed = insertInteractionsSchema.safeParse(fromDbKeys(req.body, interactions));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const interaction = await storage.createInteraction(parsed.data);
    res.status(201).json(toDbKeys(interaction as any, interactions));
  });

  // ─── Tags ─────────────────────────────────────────────────────────

  app.get("/api/tags", requireAuth, scopeToAccount, async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);
    const data = accountId
      ? await storage.getTagsByAccountId(accountId)
      : await storage.getTags();
    res.json(toDbKeysArray(data as any, tags));
  });

  app.post("/api/tags", requireAuth, async (req, res) => {
    const parsed = insertTagsSchema.safeParse(fromDbKeys(req.body, tags));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const tag = await storage.createTag(parsed.data);
    res.status(201).json(toDbKeys(tag as any, tags));
  });

  app.patch("/api/tags/:id", requireAuth, async (req, res) => {
    const parsed = insertTagsSchema.partial().safeParse(fromDbKeys(req.body, tags));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const tag = await storage.updateTag(Number(req.params.id), parsed.data);
    if (!tag) return res.status(404).json({ message: "Tag not found" });
    res.json(toDbKeys(tag as any, tags));
  });

  app.delete("/api/tags/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteTag(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Tag not found" });
    res.json({ success: true });
  });

  // ─── Lead Tags ────────────────────────────────────────────────────

  app.get("/api/leads/:id/tags", requireAuth, async (req, res) => {
    const data = await storage.getTagsByLeadId(Number(req.params.id));
    res.json(data);
  });

  // ─── Automation Logs ──────────────────────────────────────────────
  // Agency-only

  app.get("/api/automation-logs", requireAgency, async (req, res) => {
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const data = accountId
      ? await storage.getAutomationLogsByAccountId(accountId)
      : await storage.getAutomationLogs();
    res.json(data);
  });

  // ─── Users ────────────────────────────────────────────────────────

  app.get("/api/users", requireAgency, async (_req, res) => {
    const data = await storage.getAppUsers();
    res.json(data);
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const user = await storage.getAppUserById(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    // Never expose password hash
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      // Only admin can edit other users; non-admin can only edit their own profile
      const sessionUser = (req as any).user;
      const targetId = Number(req.params.id);
      if (sessionUser && sessionUser.role !== "Admin" && sessionUser.id !== targetId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      // Strip out fields non-admins shouldn't change (role/status)
      const allowed = { ...req.body };
      if (sessionUser && sessionUser.role !== "Admin") {
        delete allowed.role;
        delete allowed.status;
        delete allowed.accountsId;
      }
      const updated = await storage.updateAppUser(targetId, allowed);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err: any) {
      console.error("Error updating user:", err);
      res.status(500).json({ message: "Failed to update user", error: err.message });
    }
  });

  // POST /api/users/invite — generate invite token and create pending user record
  app.post("/api/users/invite", requireAgency, async (req, res) => {
    try {
      const { email, role, accountsId } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "email is required" });
      }
      if (!role || typeof role !== "string") {
        return res.status(400).json({ message: "role is required" });
      }

      // Check if user with this email already exists
      const existing = await storage.getAppUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }

      // Generate a secure random invite token
      const inviteToken = crypto.randomBytes(32).toString("hex");

      // Store invite token in preferences JSON field
      const preferences = JSON.stringify({
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString(),
        invited_by: (req as any).user?.email || "admin",
      });

      // Create the user record with Invited status
      const newUser = await storage.createAppUser({
        email,
        role: role as any,
        status: "Invited",
        accountsId: accountsId ? Number(accountsId) : null,
        preferences,
        notificationEmail: true,
        notificationSms: false,
      } as any);

      const { passwordHash: _, ...safeUser } = newUser;

      // Log invite link to console (dev mode email simulation)
      const inviteLink = `http://localhost:5173/accept-invite?token=${inviteToken}&email=${encodeURIComponent(email)}`;
      console.log(`\n📧 INVITE EMAIL (dev mode)\nTo: ${email}\nRole: ${role}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

      res.status(201).json({
        user: safeUser,
        invite_token: inviteToken,
        message: `Invite sent to ${email}`,
      });
    } catch (err: any) {
      console.error("Error creating invite:", err);
      res.status(500).json({ message: "Failed to create invite", error: err.message });
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

      // Generate a new invite token
      const inviteToken = crypto.randomBytes(32).toString("hex");

      // Parse existing preferences or start fresh
      let existingPrefs: Record<string, any> = {};
      if (user.preferences) {
        try {
          existingPrefs = typeof user.preferences === "string"
            ? JSON.parse(user.preferences)
            : user.preferences as any;
        } catch {}
      }

      const newPreferences = JSON.stringify({
        ...existingPrefs,
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString(),
        invited_by: (req as any).user?.email || "admin",
      });

      const updated = await storage.updateAppUser(targetId, { preferences: newPreferences });
      if (!updated) return res.status(404).json({ message: "Failed to update user" });

      const { passwordHash: _, ...safeUser } = updated;

      // Log new invite link to console (dev mode)
      const inviteLink = `http://localhost:5173/accept-invite?token=${inviteToken}&email=${encodeURIComponent(user.email || "")}`;
      console.log(`\n📧 RESENT INVITE (dev mode)\nTo: ${user.email}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

      res.json({
        user: safeUser,
        invite_token: inviteToken,
        message: `Invite resent to ${user.email}`,
      });
    } catch (err: any) {
      console.error("Error resending invite:", err);
      res.status(500).json({ message: "Failed to resend invite", error: err.message });
    }
  });

  // POST /api/users/:id/revoke-invite — clear invite token (revoke pending invite)
  app.post("/api/users/:id/revoke-invite", requireAgency, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      if (isNaN(targetId)) return res.status(400).json({ message: "Invalid user ID" });

      const user = await storage.getAppUserById(targetId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Parse existing preferences and remove invite_token
      let existingPrefs: Record<string, any> = {};
      if (user.preferences) {
        try {
          existingPrefs = typeof user.preferences === "string"
            ? JSON.parse(user.preferences)
            : user.preferences as any;
        } catch {}
      }

      // Remove invite-related fields
      const { invite_token, invite_sent_at, ...remainingPrefs } = existingPrefs;
      const newPreferences = JSON.stringify({
        ...remainingPrefs,
        invite_revoked_at: new Date().toISOString(),
      });

      const updated = await storage.updateAppUser(targetId, {
        preferences: newPreferences,
        status: "Inactive", // Revoked invites become inactive
      });
      if (!updated) return res.status(404).json({ message: "Failed to update user" });

      const { passwordHash: _, ...safeUser } = updated;

      res.json({
        user: safeUser,
        message: `Invite revoked for ${user.email}`,
      });
    } catch (err: any) {
      console.error("Error revoking invite:", err);
      res.status(500).json({ message: "Failed to revoke invite", error: err.message });
    }
  });

  // ─── Prompt Library ───────────────────────────────────────────────

  app.get("/api/prompts", requireAgency, async (req, res) => {
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const data = accountId
      ? await storage.getPromptsByAccountId(accountId)
      : await storage.getPrompts();
    res.json(data);
  });

  app.post("/api/prompts", requireAgency, async (req, res) => {
    const parsed = insertPrompt_LibrarySchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const prompt = await storage.createPrompt(parsed.data);
    res.status(201).json(prompt);
  });

  // ─── Lead Score History ────────────────────────────────────────────
  // Agency-only (historical scoring data)

  app.get("/api/lead-score-history", requireAuth, async (req, res) => {
    const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;
    const data = leadId
      ? await storage.getLeadScoreHistoryByLeadId(leadId)
      : await storage.getLeadScoreHistory();
    res.json(data);
  });

  // ─── Campaign Metrics History ──────────────────────────────────────
  // Agency-only (historical metrics data)

  app.get("/api/campaign-metrics-history", requireAuth, async (req, res) => {
    const campaignId = req.query.campaignId ? Number(req.query.campaignId) : undefined;
    const data = campaignId
      ? await storage.getCampaignMetricsHistoryByCampaignId(campaignId)
      : await storage.getCampaignMetricsHistory();
    res.json(data);
  });

  app.post("/api/campaign-metrics-history", requireAuth, async (req, res) => {
    const row = await storage.createCampaignMetricsHistory(req.body);
    res.status(201).json(row);
  });

  // ─── Dashboard KPI Trends ──────────────────────────────────────────
  // Aggregates campaign metrics history into daily KPI totals for sparklines
  app.get("/api/dashboard-trends", requireAuth, async (req, res) => {
    try {
      const days = Math.min(Number(req.query.days) || 30, 90);
      const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;

      // Fetch all campaign metrics history
      const allMetrics = await storage.getCampaignMetricsHistory();

      // If accountId is specified, filter to campaigns belonging to that account
      let filteredMetrics = allMetrics;
      if (accountId && accountId !== 1) {
        // Get campaigns for this account
        const accountCampaigns = await storage.getCampaigns();
        const campaignIds = accountCampaigns
          .filter((c: any) => (c.accountsId || c.accounts_id) === accountId)
          .map((c: any) => c.id);
        filteredMetrics = allMetrics.filter((m: any) =>
          campaignIds.includes(m.campaignsId || m.campaigns_id)
        );
      }

      // Calculate the cutoff date
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      // Aggregate by date
      const byDate: Record<string, {
        bookings: number;
        messagesSent: number;
        responses: number;
        leadsTargeted: number;
        responseRateSum: number;
        count: number;
      }> = {};

      filteredMetrics.forEach((m: any) => {
        const date = m.metricDate || m.metric_date || "";
        if (!date || date < cutoffStr) return;
        if (!byDate[date]) {
          byDate[date] = { bookings: 0, messagesSent: 0, responses: 0, leadsTargeted: 0, responseRateSum: 0, count: 0 };
        }
        byDate[date].bookings += Number(m.bookingsGenerated || m.bookings_generated || 0);
        byDate[date].messagesSent += Number(m.totalMessagesSent || m.total_messages_sent || 0);
        byDate[date].responses += Number(m.totalResponsesReceived || m.total_responses_received || 0);
        byDate[date].leadsTargeted += Number(m.totalLeadsTargeted || m.total_leads_targeted || 0);
        byDate[date].responseRateSum += Number(m.responseRatePercent || m.response_rate_percent || 0);
        byDate[date].count += 1;
      });

      // Sort by date and return as array
      const trends = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({
          date,
          bookings: d.bookings,
          messagesSent: d.messagesSent,
          responses: d.responses,
          leadsTargeted: d.leadsTargeted,
          responseRate: d.count > 0 ? Math.round(d.responseRateSum / d.count) : 0,
        }));

      res.json(trends);
    } catch (err: any) {
      console.error("Error fetching dashboard trends:", err);
      res.status(500).json({ message: "Failed to fetch dashboard trends", error: err.message });
    }
  });

  return httpServer;
}
