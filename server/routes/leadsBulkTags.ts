import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency, scopeToAccount } from "../auth";
import {
  leads,
  tags,
  leadsTags,
  insertLeadsSchema,
  insertTagsSchema,
} from "@shared/schema";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "../dbKeys";
import { db } from "../db";
import { handleZodError, wrapAsync, coerceDates, ownsAccount, canWriteLead } from "./_helpers";
import { disallowedClientLeadFields, leadWriteLevelForRequest } from "./leadWriteAccess";
import { eq, and, isNotNull, inArray } from "drizzle-orm";

/**
 * The ids the caller may write, by the PATCH /api/leads/:id rule (effective
 * role, so view-as gets the client's answer). Sends the 403 itself and
 * returns null when none are left, or when a Viewer asks.
 */
async function writableLeadIds(req: Request, res: Response, ids: number[]): Promise<number[] | null> {
  // With no lead account only the agency gets "agency", so this asks "is the caller agency?"
  if (leadWriteLevelForRequest(req as any, null) === "agency") return ids;
  const valid = ids.filter((id) => Number.isInteger(id));
  const rows = valid.length ? await db.select({ id: leads.id, accountsId: leads.accountsId }).from(leads).where(inArray(leads.id, valid)) : [];
  const writable: number[] = [];
  for (const row of rows) {
    const level = leadWriteLevelForRequest(req as any, row.accountsId ?? null);
    if (level === "readonly") {
      res.status(403).json({ message: "Read-only access" });
      return null;
    }
    if (level === "client" && row.id != null) writable.push(row.id);
  }
  if (writable.length === 0) {
    res.status(403).json({ message: "None of the specified leads belong to your account" });
    return null;
  }
  return writable;
}

export function registerLeadsBulkTagsRoutes(app: Express): void {
  // ─── Bulk Lead Operations ──────────────────────────────────────────

  // CSV Import — bulk create leads from a mapped array
  app.post("/api/leads/import-csv", requireAuth, async (req, res) => {
    try {
      // No session user = the internal key (agency-level).
      const forcedAccountId = req.user && req.user.accountsId !== 1 ? req.user.accountsId : undefined;
      if (req.user && req.user.accountsId !== 1) {
        if (!req.user.accountsId) {
          return res.status(403).json({ message: "Account scoping required" });
        }
        if (!canWriteLead(req, res, req.user.accountsId)) return;
      }

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
        "nextActionAt", "bookingConfirmedAt", "serviceCompletedAt",
      ];

      const created: any[] = [];
      const errors: { row: number; message: string }[] = [];

      // A row's campaign must be one the caller reaches.
      const campaignAllowed = new Map<number, boolean>();

      for (let i = 0; i < leadRows.length; i++) {
        try {
          const rawRow = leadRows[i];
          const mapped = coerceDates(
            fromDbKeys(rawRow, leads) as Record<string, unknown>,
            LEAD_DATE_FIELDS,
          );
          if (forcedAccountId) {
            mapped.accountsId = forcedAccountId;
          }
          const parsed = insertLeadsSchema.safeParse(mapped);
          if (!parsed.success) {
            errors.push({
              row: i + 1,
              message: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
            });
            continue;
          }
          const campaignId = parsed.data.campaignsId;
          if (campaignId) {
            if (!campaignAllowed.has(campaignId)) {
              const campaign = await storage.getCampaignById(campaignId);
              campaignAllowed.set(campaignId, !!campaign && ownsAccount(req, campaign.accountsId));
            }
            if (!campaignAllowed.get(campaignId)) {
              errors.push({ row: i + 1, message: `Campaigns_id: campaign ${campaignId} not found` });
              continue;
            }
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
        errorDetails: errors.slice(0, 50),
        leads: created,
      });
    } catch (err: any) {
      console.error("[leads] CSV import error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bulk update leads (move stage, assign campaign)
  app.post("/api/leads/bulk-update", requireAuth, async (req, res) => {
    try {
      if (req.user && req.user.accountsId !== 1) {
        if (!req.user.accountsId) {
          return res.status(403).json({ message: "Account scoping required" });
        }
      }

      const { ids, data } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "ids must be a non-empty array" });
      }
      if (!data || typeof data !== "object") {
        return res.status(400).json({ message: "data must be an object with fields to update" });
      }

      const parsed = insertLeadsSchema.partial().safeParse(fromDbKeys(data, leads));
      if (!parsed.success) return handleZodError(res, parsed.error);

      const leadIds = await writableLeadIds(req, res, ids.map(Number));
      if (!leadIds) return;
      if (leadWriteLevelForRequest(req as any, null) !== "agency") {
        // A client: the fields its UI sends, plus a move to a campaign of its own account.
        const { accountsId, campaignsId, ...fields } = parsed.data;
        const disallowed = disallowedClientLeadFields(fields);
        if (disallowed.length) return res.status(403).json({ message: "Field not editable", fields: disallowed });
        if (accountsId !== undefined && leadWriteLevelForRequest(req as any, accountsId ?? null) !== "client") {
          return res.status(403).json({ message: "Forbidden" });
        }
        if (campaignsId) {
          const campaign = await storage.getCampaignById(campaignsId);
          if (!campaign || leadWriteLevelForRequest(req as any, campaign.accountsId ?? null) !== "client") {
            return res.status(403).json({ message: "Forbidden" });
          }
        }
      }

      const updated = await storage.bulkUpdateLeads(leadIds, parsed.data);

      res.json({
        updated: updated.length,
        leads: toDbKeysArray(updated as any, leads),
      });
    } catch (err: any) {
      console.error("[leads] bulk update error:", err);
      res.status(500).json({ message: "Internal server error" });
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
      const allowedIds = await writableLeadIds(req, res, leadIds.map(Number));
      if (!allowedIds) return;

      const existingRows = await storage.getTagsByLeadIds(allowedIds);
      const existingSet = new Set(existingRows.map((r: any) => `${r.leadsId}:${r.tagsId}`));

      const toInsert: { leadsId: number; tagsId: number }[] = [];
      for (const leadId of allowedIds) {
        for (const tagId of tagIds) {
          if (!existingSet.has(`${Number(leadId)}:${Number(tagId)}`)) {
            toInsert.push({ leadsId: Number(leadId), tagsId: Number(tagId) });
          }
        }
      }

      const created = await storage.bulkCreateLeadTags(toInsert);

      res.json({
        created: created.length,
        message: `Applied ${tagIds.length} tag(s) to ${allowedIds.length} lead(s)`,
      });
    } catch (err: any) {
      console.error("[leads] bulk tag error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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

  // GET /api/leads/tags/all?ids=1,2,3 — bulk fetch all lead-tag rows in one query
  app.get("/api/leads/tags/all", requireAuth, wrapAsync(async (req, res) => {
    const idsParam = req.query.ids as string | undefined;
    if (!idsParam) return res.json([]);
    let ids = idsParam.split(",").map(Number).filter((n) => Number.isInteger(n));
    if (req.user && req.user.accountsId !== 1 && ids.length > 0) {
      const own = await db.select({ id: leads.id }).from(leads)
        .where(and(inArray(leads.id, ids), eq(leads.accountsId, req.user.accountsId ?? -1)));
      ids = own.map((l) => l.id).filter((id): id is number => id != null);
    }
    const data = ids.length > 0 ? await storage.getTagsByLeadIds(ids) : [];
    res.json(data);
  }));

  app.get("/api/leads/:id/tags", requireAuth, wrapAsync(async (req, res) => {
    const lead = await storage.getLeadById(Number(req.params.id));
    if (lead && !ownsAccount(req, lead.accountsId)) return res.status(403).json({ message: "Forbidden" });
    const data = await storage.getTagsByLeadId(Number(req.params.id));
    res.json(data);
  }));

  // GET /api/leads/:id/tag-events — tag events with timestamps for chat timeline
  app.get("/api/leads/:id/tag-events", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const lead = await storage.getLeadById(leadId);
    if (lead && !ownsAccount(req, lead.accountsId)) return res.status(403).json({ message: "Forbidden" });
    const activeRows = await storage.getTagsByLeadId(leadId);
    const removedRows = await db.select().from(leadsTags).where(
      and(eq(leadsTags.leadsId, leadId), isNotNull(leadsTags.removedAt))
    );
    const allRows = [...activeRows, ...removedRows];
    const tagIds = Array.from(new Set(allRows.map((r: any) => r.tagsId).filter(Boolean)));
    let tagMap: Record<number, { name: string; color: string }> = {};
    if (tagIds.length > 0) {
      const allTags = await storage.getTags();
      for (const t of allTags) {
        tagMap[t.id!] = { name: t.name ?? "", color: t.color ?? "gray" };
      }
    }
    const activeEvents = activeRows
      .map((r: any) => ({
        id: r.id,
        tag_name: tagMap[r.tagsId!]?.name ?? r.tagName ?? "Unknown",
        tag_color: tagMap[r.tagsId!]?.color ?? "gray",
        workflow: r.workflow,
        workflow_step: r.workflowStep,
        created_at: r.createdAt ?? null,
        applied_by: r.appliedBy,
        event_type: "added",
      }));
    const removedEvents = removedRows
      .filter((r: any) => r.removedAt)
      .map((r: any) => ({
        id: `removed-${r.id}`,
        tag_name: tagMap[r.tagsId!]?.name ?? r.tagName ?? "Unknown",
        tag_color: tagMap[r.tagsId!]?.color ?? "gray",
        workflow: r.workflow,
        workflow_step: r.workflowStep,
        created_at: r.removedAt,
        applied_by: r.removedBy,
        event_type: "removed",
      }));
    const events = [...activeEvents, ...removedEvents]
      .sort((a: any, b: any) => {
        if (!a.created_at && !b.created_at) return 0;
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    res.json(events);
  }));

  // POST /api/leads/:id/tags — add a single tag to a lead
  app.post("/api/leads/:id/tags", requireAuth, async (req, res) => {
    try {
      const leadId = Number(req.params.id);
      const { tagId } = req.body;
      if (!tagId) return res.status(400).json({ message: "tagId is required" });
      const lead = await storage.getLeadById(leadId);
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      if (!canWriteLead(req, res, lead.accountsId)) return;

      const existingTags = await storage.getTagsByLeadId(leadId);
      const exists = existingTags.some((t: any) => t.tagsId === Number(tagId));
      if (exists) return res.status(409).json({ message: "Tag already assigned to this lead" });

      const row = await storage.createLeadTag({ leadsId: leadId, tagsId: Number(tagId) });
      res.status(201).json(row);
    } catch (err: any) {
      console.error("[leads] add tag error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DELETE /api/leads/:id/tags/:tagId — remove a tag from a lead
  app.delete("/api/leads/:id/tags/:tagId", requireAuth, async (req, res) => {
    try {
      const leadId = Number(req.params.id);
      const tagId = Number(req.params.tagId);
      const lead = await storage.getLeadById(leadId);
      if (!lead) return res.status(404).json({ message: "Lead not found" });
      if (!canWriteLead(req, res, lead.accountsId)) return;
      const deleted = await storage.deleteLeadTag(leadId, tagId);
      if (!deleted) return res.status(404).json({ message: "Tag not found on this lead" });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[leads] remove tag error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
