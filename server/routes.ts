import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage, paginatedQuery } from "./storage";
import { sendInviteEmail, verifySmtp } from "./email";
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
  invoices,
  contracts,
  insertAccountsSchema,
  insertCampaignsSchema,
  insertLeadsSchema,
  insertInteractionsSchema,
  insertTagsSchema,
  insertPrompt_LibrarySchema,
  insertCampaignMetricsHistorySchema,
  insertUsersSchema,
  insertInvoicesSchema,
  insertContractsSchema,
  insertExpensesSchema,
  notifications,
  insertNotificationsSchema,
} from "@shared/schema";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "./dbKeys";
import { saveInvoiceArtifacts } from "./invoiceArtifacts";
import { db, pool } from "./db";
import { eq, count, type SQL } from "drizzle-orm";
import { ZodError } from "zod";

/** Module-level flag to emit the FRONTEND_URL warning only once per process. */
let frontendUrlWarned = false;

/**
 * Build the frontend base URL for invite links.
 * Prefers the origin sent by the browser (window.location.origin) — this is
 * the only reliable source when the API sits behind a Vite proxy that rewrites
 * the Host header. Falls back to FRONTEND_URL or the request host.
 */
function frontendBaseUrl(req: Request): string {
  // Browser-supplied origin is the most reliable source
  if (req.body?.frontendOrigin && typeof req.body.frontendOrigin === "string") {
    return req.body.frontendOrigin.replace(/\/$/, "");
  }
  if (process.env.STANDALONE_API) {
    let port = "5000";
    if (process.env.FRONTEND_URL) {
      try { port = new URL(process.env.FRONTEND_URL).port || "80"; } catch { /* ignore */ }
    }
    return `${req.protocol}://${req.hostname}:${port}`;
  }
  return process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
}

/** Return a 422 with Zod validation errors in a readable format. */
function handleZodError(res: Response, err: ZodError) {
  return res.status(422).json({
    message: "Validation error",
    errors: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
  });
}

/** Wrap an async route handler to forward thrown errors to Express error middleware. */
function wrapAsync(
  fn: (req: Request, res: Response) => Promise<unknown>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
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
  // ─── Security Headers ────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ─── Auth Routes (public) ──────────────────────────────────────────
  registerAuthRoutes(app);

  // ─── Email Test (agency only) ──────────────────────────────────────
  app.post("/api/admin/test-email", requireAgency, async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: "to is required" });
    try {
      const ok = await verifySmtp().then(() => true).catch(() => false);
      if (!ok) return res.status(500).json({ message: "SMTP connection failed — check server logs for details" });
      await sendInviteEmail({
        to,
        inviteLink: "https://example.com/accept-invite?token=test&email=test%40example.com",
        role: "Test",
        invitedBy: req.user?.email || "admin",
      });
      res.json({ message: `Test email sent to ${to}` });
    } catch (err: any) {
      res.status(500).json({ message: `Email failed: ${err.message}` });
    }
  });

  // ─── Health Check (public for monitoring) ─────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "healthy", database: "connected" });
    } catch (err: any) {
      res.status(500).json({ status: "error", database: "disconnected", error: err.message });
    }
  });

  // ─── Accounts ─────────────────────────────────────────────────────
  // Only the agency can manage accounts

  app.get("/api/accounts", requireAgency, wrapAsync(async (req, res) => {
    const pagination = getPagination(req);
    if (pagination) {
      const result = await paginatedQuery(accounts, pagination);
      return res.json({ ...result, data: toDbKeysArray(result.data as any, accounts) });
    }
    const data = await storage.getAccounts();
    res.json(toDbKeysArray(data as any, accounts));
  }));

  app.get("/api/accounts/:id", requireAgency, wrapAsync(async (req, res) => {
    const account = await storage.getAccountById(Number(req.params.id));
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.json(toDbKeys(account as any, accounts));
  }));

  app.post("/api/accounts", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertAccountsSchema.safeParse(fromDbKeys(req.body, accounts));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const account = await storage.createAccount(parsed.data);
    res.status(201).json(toDbKeys(account as any, accounts));
  }));

  app.patch("/api/accounts/:id", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertAccountsSchema.partial().safeParse(fromDbKeys(req.body, accounts));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const account = await storage.updateAccount(Number(req.params.id), parsed.data);
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.json(toDbKeys(account as any, accounts));
  }));

  app.delete("/api/accounts/:id", requireAgency, wrapAsync(async (req, res) => {
    const ok = await storage.deleteAccount(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Account not found" });
    res.status(204).end();
  }));

  // ─── Campaigns ────────────────────────────────────────────────────

  app.get("/api/campaigns", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
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
  }));

  app.get("/api/campaigns/:id", requireAuth, wrapAsync(async (req, res) => {
    const campaign = await storage.getCampaignById(Number(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    // Subaccount users can only access their own campaigns
    if (req.user!.accountsId !== 1 && campaign.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(toDbKeys(campaign as any, campaigns));
  }));

  app.post("/api/campaigns", requireAuth, wrapAsync(async (req, res) => {
    const parsed = insertCampaignsSchema.safeParse(fromDbKeys(req.body, campaigns));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const campaign = await storage.createCampaign(parsed.data);
    res.status(201).json(toDbKeys(campaign as any, campaigns));
  }));

  app.patch("/api/campaigns/:id", requireAuth, wrapAsync(async (req, res) => {
    const existing = await storage.getCampaignById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Campaign not found" });
    // Subaccount users can only modify their own campaigns
    if (req.user!.accountsId !== 1 && existing.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const parsed = insertCampaignsSchema.partial().safeParse(fromDbKeys(req.body, campaigns));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const campaign = await storage.updateCampaign(Number(req.params.id), parsed.data);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json(toDbKeys(campaign as any, campaigns));
  }));

  app.delete("/api/campaigns/:id", requireAuth, wrapAsync(async (req, res) => {
    const existing = await storage.getCampaignById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Campaign not found" });
    // Subaccount users can only delete their own campaigns
    if (req.user!.accountsId !== 1 && existing.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const ok = await storage.deleteCampaign(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Campaign not found" });
    res.status(204).end();
  }));

  // ─── Leads ────────────────────────────────────────────────────────

  app.get("/api/leads", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
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
  }));

  app.get("/api/leads/:id", requireAuth, wrapAsync(async (req, res) => {
    const lead = await storage.getLeadById(Number(req.params.id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    // Subaccount users can only access their own leads
    if (req.user!.accountsId !== 1 && lead.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(toDbKeys(lead as any, leads));
  }));

  app.post("/api/leads", requireAuth, wrapAsync(async (req, res) => {
    const parsed = insertLeadsSchema.safeParse(fromDbKeys(req.body, leads));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const lead = await storage.createLead(parsed.data);
    res.status(201).json(toDbKeys(lead as any, leads));
  }));

  app.patch("/api/leads/:id", requireAuth, wrapAsync(async (req, res) => {
    const existing = await storage.getLeadById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Lead not found" });
    // Subaccount users can only modify their own leads
    if (req.user!.accountsId !== 1 && existing.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
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
  }));

  app.delete("/api/leads/:id", requireAuth, wrapAsync(async (req, res) => {
    const existing = await storage.getLeadById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Lead not found" });
    // Subaccount users can only delete their own leads
    if (req.user!.accountsId !== 1 && existing.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const ok = await storage.deleteLead(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Lead not found" });
    res.status(204).end();
  }));

  // ─── Bulk Lead Operations ──────────────────────────────────────────

  // CSV Import — bulk create leads from a mapped array
  app.post("/api/leads/import-csv", requireAuth, async (req, res) => {
    try {
      const { leads: leadRows } = req.body;
      if (!Array.isArray(leadRows) || leadRows.length === 0) {
        return res.status(400).json({ message: "leads must be a non-empty array" });
      }
      if (leadRows.length > 5000) {
        return res.status(400).json({ message: "Maximum 5,000 leads per import" });
      }

      const LEAD_DATE_FIELDS = [
        "bookedCallDate", "lastMessageSentAt", "lastMessageReceivedAt",
        "bump1SentAt", "bump2SentAt", "bump3SentAt", "firstMessageSentAt",
        "nextActionAt", "bookingConfirmedAt",
      ];

      const created: any[] = [];
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < leadRows.length; i++) {
        try {
          const rawRow = leadRows[i];
          // Convert from DB key format (e.g., first_name) to camelCase for Drizzle
          const mapped = coerceDates(
            fromDbKeys(rawRow, leads) as Record<string, unknown>,
            LEAD_DATE_FIELDS,
          );
          const parsed = insertLeadsSchema.safeParse(mapped);
          if (!parsed.success) {
            errors.push({
              row: i + 1,
              message: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
            });
            continue;
          }
          const lead = await storage.createLead(parsed.data);
          created.push(toDbKeys(lead as any, leads));
        } catch (rowErr: any) {
          errors.push({ row: i + 1, message: rowErr.message || "Unknown error" });
        }
      }

      res.status(201).json({
        created: created.length,
        errors: errors.length,
        errorDetails: errors.slice(0, 50), // cap to avoid huge responses
        leads: created,
      });
    } catch (err: any) {
      console.error("CSV import error:", err);
      res.status(500).json({ message: err.message || "CSV import failed" });
    }
  });

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

      // 1 SELECT to fetch all existing associations for all leads at once
      const existingRows = await storage.getTagsByLeadIds(leadIds.map(Number));
      const existingSet = new Set(existingRows.map((r: any) => `${r.leadsId}:${r.tagsId}`));

      // Compute pairs to insert in JS — skip existing ones
      const toInsert: { leadsId: number; tagsId: number }[] = [];
      for (const leadId of leadIds) {
        for (const tagId of tagIds) {
          if (!existingSet.has(`${Number(leadId)}:${Number(tagId)}`)) {
            toInsert.push({ leadsId: Number(leadId), tagsId: Number(tagId) });
          }
        }
      }

      // 1 bulk INSERT for all pairs
      const created = await storage.bulkCreateLeadTags(toInsert);

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

  app.get("/api/interactions", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
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
  }));

  app.post("/api/interactions", requireAuth, wrapAsync(async (req, res) => {
    const parsed = insertInteractionsSchema.safeParse(fromDbKeys(req.body, interactions));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const interaction = await storage.createInteraction(parsed.data);
    res.status(201).json(toDbKeys(interaction as any, interactions));
  }));

  // ─── Tags ─────────────────────────────────────────────────────────

  app.get("/api/tags", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);
    const data = accountId
      ? await storage.getTagsByAccountId(accountId)
      : await storage.getTags();
    res.json(toDbKeysArray(data as any, tags));
  }));

  app.post("/api/tags", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertTagsSchema.safeParse(fromDbKeys(req.body, tags));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const tag = await storage.createTag(parsed.data);
    res.status(201).json(toDbKeys(tag as any, tags));
  }));

  app.patch("/api/tags/:id", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertTagsSchema.partial().safeParse(fromDbKeys(req.body, tags));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const tag = await storage.updateTag(Number(req.params.id), parsed.data);
    if (!tag) return res.status(404).json({ message: "Tag not found" });
    res.json(toDbKeys(tag as any, tags));
  }));

  app.delete("/api/tags/:id", requireAgency, wrapAsync(async (req, res) => {
    const deleted = await storage.deleteTag(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Tag not found" });
    res.json({ success: true });
  }));

  // ─── Lead Tags ────────────────────────────────────────────────────

  app.get("/api/leads/:id/tags", requireAuth, wrapAsync(async (req, res) => {
    const data = await storage.getTagsByLeadId(Number(req.params.id));
    res.json(data);
  }));

  // POST /api/leads/:id/tags — add a single tag to a lead
  app.post("/api/leads/:id/tags", requireAuth, async (req, res) => {
    try {
      const leadId = Number(req.params.id);
      const { tagId } = req.body;
      if (!tagId) return res.status(400).json({ message: "tagId is required" });

      // Avoid duplicate
      const existingTags = await storage.getTagsByLeadId(leadId);
      const exists = existingTags.some((t: any) => t.tagsId === Number(tagId));
      if (exists) return res.status(409).json({ message: "Tag already assigned to this lead" });

      const row = await storage.createLeadTag({ leadsId: leadId, tagsId: Number(tagId) });
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to add tag" });
    }
  });

  // DELETE /api/leads/:id/tags/:tagId — remove a tag from a lead
  app.delete("/api/leads/:id/tags/:tagId", requireAuth, async (req, res) => {
    try {
      const leadId = Number(req.params.id);
      const tagId = Number(req.params.tagId);
      const deleted = await storage.deleteLeadTag(leadId, tagId);
      if (!deleted) return res.status(404).json({ message: "Tag not found on this lead" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to remove tag" });
    }
  });

  // ─── Automation Logs ──────────────────────────────────────────────
  // Agency-only

  app.get("/api/automation-logs", requireAgency, wrapAsync(async (req, res) => {
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const data = accountId
      ? await storage.getAutomationLogsByAccountId(accountId)
      : await storage.getAutomationLogs();
    res.json(data);
  }));

  // ─── Notifications ─────────────────────────────────────────

  // Legacy endpoint kept for backwards compat (old Topbar uses it)
  app.get("/api/notifications/legacy", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const data = await storage.getRecentNotifications(forcedId);
    res.json(data);
  }));

  // GET /api/notifications — list notifications for the current user
  app.get("/api/notifications", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread === "true";
    const items = await storage.getNotificationsByUserId(user.id!, { limit, offset, unreadOnly });
    const unreadCount = await storage.getUnreadNotificationCount(user.id!);
    const totalCount = await storage.getTotalNotificationCount(user.id!);
    res.json({ items, unreadCount, totalCount });
  }));

  // GET /api/notifications/count — lightweight badge poll
  app.get("/api/notifications/count", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const unreadCount = await storage.getUnreadNotificationCount(user.id!);
    res.json({ unreadCount });
  }));

  // PATCH /api/notifications/:id — mark single notification as read
  app.patch("/api/notifications/:id", requireAuth, wrapAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid notification ID" });
    const notif = await storage.getNotificationById(id);
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    // Ensure the notification belongs to the current user
    if (notif.userId !== req.user!.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.updateNotification(id, { read: true });
    res.json({ success: true });
  }));

  // POST /api/notifications/mark-all-read — mark all as read for current user
  app.post("/api/notifications/mark-all-read", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const count = await storage.markAllNotificationsRead(user.id!);
    res.json({ success: true, updated: count });
  }));

  // POST /api/notifications — create a notification (admin only, for testing/integrations)
  app.post("/api/notifications", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    // Only agency (admin) users can create notifications via API
    if (user.accountsId !== 1) {
      return res.status(403).json({ message: "Agency access required" });
    }
    const parsed = insertNotificationsSchema.parse(req.body);
    const created = await storage.createNotification(parsed);
    res.status(201).json(created);
  }));

  // ─── Activity Feed ───────────────────────────────────────────────

  app.get("/api/activity-feed", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    // NocoDB schema name
    const schema = "p2mxx34fvbf3ll6";

    // Build the account filter clause for each sub-query
    const acctFilter = accountId ? `AND t."Accounts_id" = $1` : "";
    const acctFilterLeads = accountId ? `AND l."Accounts_id" = $1` : "";
    const params: unknown[] = accountId ? [accountId] : [];

    // Sub-query 1: Recent interactions (messages) — last 7 days
    const interactionsQ = `
      SELECT
        CASE
          WHEN i."direction" = 'inbound' THEN 'message_received'
          WHEN i."direction" = 'outbound' AND i."ai_generated" = true THEN 'message_sent'
          ELSE 'message_sent'
        END AS type,
        CASE
          WHEN i."direction" = 'inbound' THEN COALESCE(i."lead_name", 'Lead') || ' responded'
          WHEN i."ai_generated" = true THEN 'AI sent message to ' || COALESCE(i."lead_name", 'lead')
          ELSE 'Message sent to ' || COALESCE(i."lead_name", 'lead')
        END AS title,
        LEFT(i."Content", 120) AS description,
        COALESCE(i."Leads_id", i."lead_id"::int) AS lead_id,
        COALESCE(i."lead_name", '') AS lead_name,
        i."created_at" AS timestamp,
        CASE
          WHEN i."direction" = 'inbound' THEN 'message'
          WHEN i."ai_generated" = true THEN 'bot'
          ELSE 'user'
        END AS icon
      FROM "${schema}"."Interactions" i
      WHERE i."created_at" > NOW() - INTERVAL '7 days'
        ${acctFilter.replace('t.', 'i.')}
    `;

    // Sub-query 2: Lead status changes (Booked / Qualified / Lost) — last 7 days
    const statusQ = `
      SELECT
        CASE
          WHEN l."Conversion_Status" = 'Booked' THEN 'call_booked'
          ELSE 'status_change'
        END AS type,
        CASE
          WHEN l."Conversion_Status" = 'Booked' THEN 'Call booked: ' || COALESCE(CONCAT_WS(' ', l."first_name", l."last_name"), 'Lead')
          ELSE COALESCE(CONCAT_WS(' ', l."first_name", l."last_name"), 'Lead') || ' moved to ' || l."Conversion_Status"
        END AS title,
        CASE
          WHEN l."Conversion_Status" = 'Booked' AND l."booked_call_date" IS NOT NULL
            THEN TO_CHAR(l."booked_call_date", 'Mon DD at HH12:MI AM')
          ELSE 'Status: ' || l."Conversion_Status"
        END AS description,
        l."id" AS lead_id,
        COALESCE(CONCAT_WS(' ', l."first_name", l."last_name"), '') AS lead_name,
        l."updated_at" AS timestamp,
        CASE
          WHEN l."Conversion_Status" = 'Booked' THEN 'phone'
          ELSE 'arrow'
        END AS icon
      FROM "${schema}"."Leads" l
      WHERE l."updated_at" > NOW() - INTERVAL '7 days'
        AND l."Conversion_Status" IN ('Booked', 'Qualified', 'Lost')
        ${acctFilterLeads}
    `;

    // Sub-query 3: Automation events — last 7 days
    const automationQ = `
      SELECT
        'automation' AS type,
        COALESCE(a."workflow_name", 'Workflow') || ' — ' || COALESCE(a."status", 'ran') AS title,
        CASE
          WHEN a."lead_name" IS NOT NULL THEN 'Lead: ' || a."lead_name"
          ELSE COALESCE(a."step_name", '')
        END AS description,
        COALESCE(a."Leads_id", a."lead_id"::int) AS lead_id,
        COALESCE(a."lead_name", '') AS lead_name,
        a."created_at" AS timestamp,
        'bot' AS icon
      FROM "${schema}"."Automation_Logs" a
      WHERE a."created_at" > NOW() - INTERVAL '7 days'
        ${acctFilter.replace('t.', 'a.')}
    `;

    // Sub-query 4: Manual takeover events — last 7 days
    const takeoverQ = `
      SELECT
        'takeover' AS type,
        'Manual takeover: ' || COALESCE(CONCAT_WS(' ', l."first_name", l."last_name"), 'Lead') AS title,
        'Agent took over the conversation' AS description,
        l."id" AS lead_id,
        COALESCE(CONCAT_WS(' ', l."first_name", l."last_name"), '') AS lead_name,
        l."updated_at" AS timestamp,
        'user' AS icon
      FROM "${schema}"."Leads" l
      WHERE l."manual_takeover" = true
        AND l."updated_at" > NOW() - INTERVAL '7 days'
        ${acctFilterLeads}
    `;

    // Count query (for total)
    const countQuery = `
      SELECT COUNT(*) AS total FROM (
        ${interactionsQ}
        UNION ALL
        ${statusQ}
        UNION ALL
        ${automationQ}
        UNION ALL
        ${takeoverQ}
      ) sub
    `;

    // Data query with sorting and pagination
    const dataQuery = `
      SELECT * FROM (
        ${interactionsQ}
        UNION ALL
        ${statusQ}
        UNION ALL
        ${automationQ}
        UNION ALL
        ${takeoverQ}
      ) combined
      ORDER BY timestamp DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        pool.query(countQuery, params),
        pool.query(dataQuery, params),
      ]);

      const total = Number(countResult.rows[0]?.total ?? 0);
      const items = dataResult.rows.map((row: any) => ({
        type: row.type,
        title: row.title,
        description: row.description || "",
        leadId: row.lead_id ?? null,
        leadName: row.lead_name || "",
        timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : null,
        icon: row.icon,
      }));

      res.json({
        items,
        total,
        hasMore: offset + items.length < total,
      });
    } catch (err: any) {
      console.error("[activity-feed] query error:", err);
      res.status(500).json({ message: "Failed to fetch activity feed", error: err.message });
    }
  }));

  // ─── Users ────────────────────────────────────────────────────────

  app.get("/api/users", requireAgency, wrapAsync(async (_req, res) => {
    const data = await storage.getAppUsers();
    res.json(data);
  }));

  app.get("/api/users/:id", requireAuth, wrapAsync(async (req, res) => {
    const user = await storage.getAppUserById(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    // Never expose password hash
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  }));

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      // Only admin can edit other users; non-admin can only edit their own profile
      const sessionUser = req.user!;
      const targetId = Number(req.params.id);
      if (sessionUser.role !== "Admin" && sessionUser.id !== targetId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      // Strip out fields non-admins shouldn't change (role/status/account)
      const rawBody = { ...req.body };
      if (sessionUser.role !== "Admin") {
        delete rawBody.role;
        delete rawBody.status;
        delete rawBody.accountsId;
        delete rawBody.Accounts_id;
      }
      // Validate allowed fields against schema
      const parsed = insertUsersSchema.partial().safeParse(fromDbKeys(rawBody, users));
      if (!parsed.success) return handleZodError(res, parsed.error);
      const updated = await storage.updateAppUser(targetId, parsed.data as any);
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
      const { email, role, accountsId, lang = "en" } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "email is required" });
      }
      if (!role || typeof role !== "string") {
        return res.status(400).json({ message: "role is required" });
      }

      // Warn once if STANDALONE_API is set but FRONTEND_URL is missing
      if (process.env.STANDALONE_API && !process.env.FRONTEND_URL && !frontendUrlWarned) {
        frontendUrlWarned = true;
        console.warn("[invite] ⚠️  STANDALONE_API is set but FRONTEND_URL is not — invite links will use localhost:5000. Set FRONTEND_URL in .env to fix.");
      }

      // Check if user with this email already exists
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
        const updated = await storage.updateAppUser(existing.id, {
          status: "Invited",
          preferences: newPreferences,
        });
        if (!updated) return res.status(500).json({ message: "Failed to re-invite user" });

        const { passwordHash: _, ...safeUser } = updated;

        const baseUrl = frontendBaseUrl(req);
        const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}&email=${encodeURIComponent(email)}`;
        console.log(`\n📧 RE-INVITE EMAIL (dev mode)\nTo: ${email}\nRole: ${role}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

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

      // Generate a secure random invite token
      const inviteToken = crypto.randomBytes(32).toString("hex");

      // Store invite token in preferences JSON field
      const preferences = JSON.stringify({
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString(),
        invited_by: req.user?.email || "admin",
        lang,
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

      // Build invite URL from request host (so link works on any LAN machine)
      const baseUrl = frontendBaseUrl(req);
      const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}&email=${encodeURIComponent(email)}`;
      console.log(`\n📧 INVITE EMAIL (dev mode)\nTo: ${email}\nRole: ${role}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

      // Send invite email (fire-and-forget — invite creation succeeds even if email fails)
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

      const lang: string = existingPrefs.lang || "en";

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

      // Build invite URL from request host (so link works on any LAN machine)
      const baseUrl = frontendBaseUrl(req);
      const inviteLink = `${baseUrl}/accept-invite?token=${inviteToken}&email=${encodeURIComponent(user.email || "")}`;
      console.log(`\n📧 RESENT INVITE (dev mode)\nTo: ${user.email}\nInvite link: ${inviteLink}\nToken: ${inviteToken}\n`);

      // Resend invite email (fire-and-forget)
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

  app.get("/api/prompts", requireAgency, wrapAsync(async (req, res) => {
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const data = accountId
      ? await storage.getPromptsByAccountId(accountId)
      : await storage.getPrompts();
    res.json(data);
  }));

  app.post("/api/prompts", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertPrompt_LibrarySchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const prompt = await storage.createPrompt(parsed.data);
    res.status(201).json(prompt);
  }));

  app.put("/api/prompts/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = insertPrompt_LibrarySchema.partial().safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const updated = await storage.updatePrompt(id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Prompt not found" });
    res.json(updated);
  }));

  app.delete("/api/prompts/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await storage.deletePrompt(id);
    if (!deleted) return res.status(404).json({ error: "Prompt not found" });
    res.json({ success: true });
  }));

  // ─── Lead Score History ────────────────────────────────────────────

  app.get("/api/lead-score-history", requireAuth, wrapAsync(async (req, res) => {
    const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;
    const data = leadId
      ? await storage.getLeadScoreHistoryByLeadId(leadId)
      : await storage.getLeadScoreHistory();
    res.json(data);
  }));

  // ─── Campaign Metrics History ──────────────────────────────────────

  app.get("/api/campaign-metrics-history", requireAuth, wrapAsync(async (req, res) => {
    const campaignId = req.query.campaignId ? Number(req.query.campaignId) : undefined;
    const data = campaignId
      ? await storage.getCampaignMetricsHistoryByCampaignId(campaignId)
      : await storage.getCampaignMetricsHistory();
    res.json(data);
  }));

  app.post("/api/campaign-metrics-history", requireAuth, wrapAsync(async (req, res) => {
    const parsed = insertCampaignMetricsHistorySchema.partial().safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const row = await storage.createCampaignMetricsHistory(parsed.data);
    res.status(201).json(row);
  }));

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

  // ─── Invoices ────────────────────────────────────────────────────────

  app.get("/api/invoices", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);
    const data = accountId
      ? await storage.getInvoicesByAccountId(accountId)
      : await storage.getInvoices();
    res.json(toDbKeysArray(data as any, invoices));
  }));

  app.get("/api/invoices/view/:token", wrapAsync(async (req, res) => {
    const invoice = await storage.getInvoiceByViewToken(req.params.token);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    // Increment view count, set viewed_at on first view, auto-update status
    const update: any = {
      viewedCount: (invoice.viewedCount ?? 0) + 1,
    };
    if (!invoice.viewedAt) update.viewedAt = new Date();
    if (invoice.status === "Sent") update.status = "Viewed";
    await storage.updateInvoice(invoice.id!, update);
    res.json(toDbKeys({ ...invoice, ...update } as any, invoices));
  }));

  app.get("/api/invoices/:id", requireAuth, wrapAsync(async (req, res) => {
    const invoice = await storage.getInvoiceById(Number(req.params.id));
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (req.user!.accountsId !== 1 && invoice.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(toDbKeys(invoice as any, invoices));
  }));

  app.post("/api/invoices", requireAgency, wrapAsync(async (req, res) => {
    const body = fromDbKeys(req.body, invoices) as Record<string, unknown>;
    const INVOICE_DATE_FIELDS = ["sentAt", "paidAt", "viewedAt"];
    const coerced = coerceDates(body, INVOICE_DATE_FIELDS);
    const parsed = insertInvoicesSchema.safeParse(coerced);
    if (!parsed.success) return handleZodError(res, parsed.error);

    // Auto-generate invoice number: INV-{SLUG}-{SEQ}
    let invoiceNumber = parsed.data.invoiceNumber;
    if (!invoiceNumber && parsed.data.accountsId) {
      const account = await storage.getAccountById(parsed.data.accountsId);
      const slug = (account?.slug || account?.name || "GEN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      const invoiceCount = await storage.getInvoiceCountByAccountId(parsed.data.accountsId);
      invoiceNumber = `INV-${slug}-${String(invoiceCount + 1).padStart(3, "0")}`;
    }

    const data = {
      ...parsed.data,
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      viewToken: crypto.randomUUID(),
      status: parsed.data.status || "Draft",
    };
    const invoice = await storage.createInvoice(data);
    res.status(201).json(toDbKeys(invoice as any, invoices));
  }));

  app.patch("/api/invoices/:id", requireAgency, wrapAsync(async (req, res) => {
    const existing = await storage.getInvoiceById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Invoice not found" });
    const body = fromDbKeys(req.body, invoices) as Record<string, unknown>;
    const INVOICE_DATE_FIELDS = ["sentAt", "paidAt", "viewedAt"];
    const coerced = coerceDates(body, INVOICE_DATE_FIELDS);
    const parsed = insertInvoicesSchema.partial().safeParse(coerced);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const invoice = await storage.updateInvoice(Number(req.params.id), parsed.data);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(toDbKeys(invoice as any, invoices));
  }));

  app.patch("/api/invoices/:id/mark-sent", requireAgency, wrapAsync(async (req, res) => {
    const invoice = await storage.updateInvoice(Number(req.params.id), {
      status: "Sent",
      sentAt: new Date(),
    } as any);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(toDbKeys(invoice as any, invoices));
  }));

  app.patch("/api/invoices/:id/mark-paid", requireAgency, wrapAsync(async (req, res) => {
    const invoice = await storage.updateInvoice(Number(req.params.id), {
      status: "Paid",
      paidAt: new Date(),
    } as any);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // Fire-and-forget: save PDF + append revenue.csv row
    saveInvoiceArtifacts(invoice).catch(err =>
      console.error("[invoice-artifacts] Failed:", err)
    );

    res.json(toDbKeys(invoice as any, invoices));
  }));

  app.delete("/api/invoices/:id", requireAgency, wrapAsync(async (req, res) => {
    const ok = await storage.deleteInvoice(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Invoice not found" });
    res.status(204).end();
  }));

  // ─── Contracts ──────────────────────────────────────────────────────

  app.get("/api/contracts", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);
    const data = accountId
      ? await storage.getContractsByAccountId(accountId)
      : await storage.getContracts();
    res.json(toDbKeysArray(data as any, contracts));
  }));

  app.get("/api/contracts/view/:token", wrapAsync(async (req, res) => {
    const contract = await storage.getContractByViewToken(req.params.token);
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    const update: any = {
      viewedCount: (contract.viewedCount ?? 0) + 1,
    };
    if (!contract.viewedAt) update.viewedAt = new Date();
    if (contract.status === "Sent") update.status = "Viewed";
    await storage.updateContract(contract.id!, update);
    res.json(toDbKeys({ ...contract, ...update } as any, contracts));
  }));

  app.get("/api/contracts/:id", requireAuth, wrapAsync(async (req, res) => {
    const contract = await storage.getContractById(Number(req.params.id));
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    if (req.user!.accountsId !== 1 && contract.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(toDbKeys(contract as any, contracts));
  }));

  app.post("/api/contracts", requireAgency, wrapAsync(async (req, res) => {
    const body = fromDbKeys(req.body, contracts) as Record<string, unknown>;
    const CONTRACT_DATE_FIELDS = ["signedAt", "sentAt", "viewedAt"];
    const coerced = coerceDates(body, CONTRACT_DATE_FIELDS);
    const parsed = insertContractsSchema.safeParse(coerced);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const data = {
      ...parsed.data,
      viewToken: crypto.randomUUID(),
      status: parsed.data.status || "Draft",
    };
    const contract = await storage.createContract(data);
    res.status(201).json(toDbKeys(contract as any, contracts));
  }));

  app.patch("/api/contracts/:id", requireAgency, wrapAsync(async (req, res) => {
    const existing = await storage.getContractById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Contract not found" });
    const body = fromDbKeys(req.body, contracts) as Record<string, unknown>;
    const CONTRACT_DATE_FIELDS = ["signedAt", "sentAt", "viewedAt"];
    const coerced = coerceDates(body, CONTRACT_DATE_FIELDS);
    const parsed = insertContractsSchema.partial().safeParse(coerced);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const contract = await storage.updateContract(Number(req.params.id), parsed.data);
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    res.json(toDbKeys(contract as any, contracts));
  }));

  app.patch("/api/contracts/:id/mark-signed", requireAgency, wrapAsync(async (req, res) => {
    const contract = await storage.updateContract(Number(req.params.id), {
      status: "Signed",
      signedAt: new Date(),
    } as any);
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    res.json(toDbKeys(contract as any, contracts));
  }));

  // ── SignWell: send contract for e-signature ───────────────────────────────────
  app.post("/api/contracts/:id/send-for-signature", requireAgency, wrapAsync(async (req, res) => {
    const contractId = Number(req.params.id);
    const { signerEmail, signerName, testMode = true } = req.body as {
      signerEmail?: string;
      signerName?: string;
      testMode?: boolean;
    };

    if (!signerEmail) return res.status(400).json({ error: "signerEmail is required" });

    const existing = await storage.getContractById(contractId);
    if (!existing) return res.status(404).json({ message: "Contract not found" });

    const contractText = (existing as any).contractText || existing.title || "Service Agreement";
    const contractTitle = existing.title || "Service Agreement";
    const signerDisplayName = signerName || (existing as any).signerName || signerEmail;

    // Wrap plain text in a minimal HTML document (SignWell accepts HTML)
    const escapedText = String(contractText)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const htmlDoc = [
      "<!DOCTYPE html>",
      "<html><head><meta charset=\"utf-8\"><style>",
      "  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; margin: 40px; color: #111; }",
      "  pre  { white-space: pre-wrap; font-family: inherit; margin: 0; }",
      "</style></head><body>",
      `<pre>${escapedText}</pre>`,
      "</body></html>",
    ].join("\n");

    const base64Content = Buffer.from(htmlDoc).toString("base64");

    // API key — set SIGNWELL_API_KEY in env for production
    const SIGNWELL_API_KEY = process.env.SIGNWELL_API_KEY || "ae5a778f3a71902abe20c24c9926d1b7";

    const swRes = await fetch("https://www.signwell.com/api/v1/documents/", {
      method: "POST",
      headers: {
        "X-Api-Key": SIGNWELL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        test_mode:  testMode,
        name:       contractTitle,
        files: [{
          name:        "contract.html",
          file_base64: base64Content,
        }],
        recipients: [{
          id:    "1",
          name:  signerDisplayName,
          email: signerEmail,
        }],
        fields: [[{
          type:         "signature",
          required:     true,
          x:            30,
          y:            85,
          page:         1,
          recipient_id: "1",
        }]],
        subject: `Please sign: ${contractTitle}`,
        message: "Please review and sign the attached service agreement with Lead Awaker.",
      }),
    });

    const swData = await swRes.json() as any;

    if (!swRes.ok) {
      console.error("[SignWell] API error:", JSON.stringify(swData));
      return res.status(502).json({ error: "SignWell API error", details: swData });
    }

    // Mark contract as Sent
    await storage.updateContract(contractId, {
      status:  "Sent",
      sentAt:  new Date(),
    } as any);

    const signingUrl = swData.recipients?.[0]?.signing_url
      || swData.recipients?.[0]?.embedded_signing_url;

    res.json({
      ok:         true,
      signingUrl,
      documentId: swData.id,
      testMode,
    });
  }));

  app.delete("/api/contracts/:id", requireAgency, wrapAsync(async (req, res) => {
    const ok = await storage.deleteContract(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Contract not found" });
    res.status(204).end();
  }));

  // ── Expenses ──────────────────────────────────────────────────────────────────

  app.get("/api/expenses", requireAgency, wrapAsync(async (req, res) => {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const quarter = req.query.quarter as string | undefined;
    const rows = await storage.getExpenses(year, quarter);
    res.json(rows);
  }));

  app.post("/api/expenses/parse-pdf", requireAgency, wrapAsync(async (req, res) => {
    const apiKey = process.env.OPEN_AI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ error: "NO_API_KEY" });
    }
    const { pdf_data } = req.body;
    if (!pdf_data) return res.status(400).json({ error: "pdf_data required" });

    // Ensure we have a proper data URL for the OpenAI Responses API
    const fileData = (pdf_data as string).startsWith("data:")
      ? pdf_data as string
      : `data:application/pdf;base64,${pdf_data}`;

    const prompt = `You are a Dutch business expense parser for Lead Awaker (owner: Gabriel Barbosa Fronza, NL VAT NL002488258B44, BTW registration start: 17 December 2025).

Extract these fields from the invoice PDF and return ONLY valid JSON (no markdown, no explanation):
{
  "date": "YYYY-MM-DD",
  "supplier": "supplier name",
  "country": "XX",
  "invoice_number": "...",
  "description": "brief item/service description (max 100 chars)",
  "currency": "EUR",
  "amount_excl_vat": 0.00,
  "vat_rate_pct": 0,
  "vat_amount": 0.00,
  "total_amount": 0.00,
  "nl_btw_deductible": false,
  "notes": "..."
}

Rules:
- country: 2-letter ISO code (NL, US, LU, DE, etc.)
- currency: EUR or USD (or actual currency on invoice)
- vat_rate_pct: 0, 9, or 21 (Dutch rates) or actual rate shown
- nl_btw_deductible: true ONLY if the invoice charges Dutch/EU VAT (BTW) that can be reclaimed as voorbelasting on the NL BTW return. US companies and non-EU companies not charging EU VAT = false.
- notes: helpful tax notes, e.g. "US company — no EU VAT charged" or "Pre-start expense — claim in Q1 2026 BTW return" or "NL supplier, 21% BTW reclaimable"
- If a field cannot be determined, use null`;

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: [{
            role: "user",
            content: [
              {
                type: "input_file",
                filename: "invoice.pdf",
                file_data: fileData,
              },
              {
                type: "input_text",
                text: prompt,
              },
            ],
          }],
        }),
      });
      if (!response.ok) {
        const errBody = await response.text();
        console.error("[parse-pdf] OpenAI error:", errBody);
        return res.status(500).json({ error: "OpenAI API error", detail: errBody });
      }
      const result = await response.json() as any;
      const text = result?.output?.[0]?.content?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ error: "Could not parse AI response", raw: text });
      const extracted = JSON.parse(jsonMatch[0]);
      res.json(extracted);
    } catch (e: any) {
      console.error("[parse-pdf] error:", e);
      res.status(500).json({ error: e.message });
    }
  }));

  app.post("/api/expenses", requireAgency, wrapAsync(async (req, res) => {
    const body = req.body;
    let pdfPath: string | undefined;
    if (body.pdf_data && body.date) {
      try {
        const dateStr = body.date as string;
        const d = new Date(dateStr);
        const yr = d.getFullYear();
        const mo = d.getMonth();
        const q = mo <= 2 ? "Q1" : mo <= 5 ? "Q2" : mo <= 8 ? "Q3" : "Q4";
        const dir = `/home/gabriel/Images/Expenses/${yr}/${q}`;
        fs.mkdirSync(dir, { recursive: true });
        const supplier = (body.supplier || "Unknown").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
        const invNum = (body.invoice_number || "").replace(/[^a-zA-Z0-9\-]/g, "_").slice(0, 30);
        const cur = (body.currency || "EUR").toUpperCase();
        const amt = parseFloat(body.total_amount || "0").toFixed(2);
        const filename = `${dateStr}_${supplier}_${invNum}_${cur}${amt}.pdf`;
        const fullPath = `${dir}/${filename}`;
        const base64 = (body.pdf_data as string).replace(/^data:[^;]+;base64,/, "");
        fs.writeFileSync(fullPath, Buffer.from(base64, "base64"));
        pdfPath = fullPath;
      } catch (e) {
        console.error("[expenses] PDF save error:", e);
      }
    }
    const { pdf_data: _pdf, ...rest } = body;
    const expense = await storage.createExpense({
      date: rest.date || null,
      year: rest.year ? parseInt(rest.year) : (rest.date ? new Date(rest.date).getFullYear() : null),
      quarter: rest.quarter || null,
      supplier: rest.supplier || null,
      country: rest.country || null,
      invoiceNumber: rest.invoice_number || null,
      description: rest.description || null,
      currency: rest.currency || null,
      amountExclVat: rest.amount_excl_vat?.toString() || null,
      vatRatePct: rest.vat_rate_pct?.toString() || null,
      vatAmount: rest.vat_amount?.toString() || null,
      totalAmount: rest.total_amount?.toString() || null,
      nlBtwDeductible: rest.nl_btw_deductible === true || rest.nl_btw_deductible === "true" || false,
      notes: rest.notes || null,
      pdfPath: pdfPath || null,
    });
    res.status(201).json(expense);
  }));

  app.patch("/api/expenses/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const body = req.body;
    const updated = await storage.updateExpense(id, {
      date: body.date,
      year: body.year ? parseInt(body.year) : undefined,
      quarter: body.quarter,
      supplier: body.supplier,
      country: body.country,
      invoiceNumber: body.invoice_number,
      description: body.description,
      currency: body.currency,
      amountExclVat: body.amount_excl_vat?.toString(),
      vatRatePct: body.vat_rate_pct?.toString(),
      vatAmount: body.vat_amount?.toString(),
      totalAmount: body.total_amount?.toString(),
      nlBtwDeductible: body.nl_btw_deductible,
      notes: body.notes,
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  }));

  app.delete("/api/expenses/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const ok = await storage.deleteExpense(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  }));

  app.get("/api/expenses/:id/pdf", requireAgency, wrapAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const rows = await storage.getExpenses();
    const expense = rows.find((r) => r.id === id);
    if (!expense || !expense.pdfPath) {
      return res.status(404).json({ error: "No PDF attached to this expense" });
    }
    if (!fs.existsSync(expense.pdfPath)) {
      return res.status(404).json({ error: "PDF file not found on disk" });
    }
    const filename = path.basename(expense.pdfPath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    fs.createReadStream(expense.pdfPath).pipe(res);
  }));

  return httpServer;
}
