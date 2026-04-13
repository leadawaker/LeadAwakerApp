import type { Express } from "express";
import { storage, paginatedQuery } from "../storage";
import { requireAuth, requireAgency, scopeToAccount } from "../auth";
import {
  leads,
  interactions,
  tags,
  leadsTags,
  automationLogs,
  leadScoreHistory,
  insertLeadsSchema,
  insertInteractionsSchema,
  insertTagsSchema,
} from "@shared/schema";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "../dbKeys";
import { db, pool } from "../db";
import { createAndDispatchNotification } from "../notification-dispatcher";
import { broadcast } from "../sse";
import { addClient, removeClient } from "../sse";
import { handleZodError, wrapAsync, getPagination, getEngineUrl, coerceDates } from "./_helpers";
import { eq, count, and, gte, lte, ne, isNotNull, type SQL, desc } from "drizzle-orm";
import type { Request, Response } from "express";

export function registerLeadsRoutes(app: Express): void {
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
      const pageData = result.data as any[];
      const pageIds = pageData.map((l: any) => l.id).filter((id: any): id is number => typeof id === "number");
      const pageTagRows = pageIds.length > 0 ? await storage.getTagsByLeadIds(pageIds) : [];
      const pageTagMap = new Map<number, number[]>();
      pageTagRows.forEach((row: any) => {
        if (row.leadsId == null || row.tagsId == null) return;
        const arr = pageTagMap.get(row.leadsId) ?? [];
        arr.push(row.tagsId);
        pageTagMap.set(row.leadsId, arr);
      });
      const enrichedPage = pageData.map((l: any) => ({ ...l, tag_ids: pageTagMap.get(l.id) ?? [] }));
      return res.json({ ...result, data: toDbKeysArray(enrichedPage as any, leads) });
    }

    let data;
    if (campaignId) {
      data = await storage.getLeadsByCampaignId(Number(campaignId));
    } else if (accountId) {
      data = await storage.getLeadsByAccountId(accountId);
    } else {
      data = await storage.getLeads();
    }
    const leadIds = data.map((l: any) => l.id).filter((id: any): id is number => typeof id === "number");
    const tagRows = leadIds.length > 0 ? await storage.getTagsByLeadIds(leadIds) : [];
    const tagIdsByLead = new Map<number, number[]>();
    tagRows.forEach((row: any) => {
      if (row.leadsId == null || row.tagsId == null) return;
      const arr = tagIdsByLead.get(row.leadsId) ?? [];
      arr.push(row.tagsId);
      tagIdsByLead.set(row.leadsId, arr);
    });
    const enrichedData = data.map((l: any) => ({ ...l, tag_ids: tagIdsByLead.get(l.id) ?? [] }));
    res.json(toDbKeysArray(enrichedData as any, leads));
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
    const data = parsed.data;
    // Auto-inherit account from campaign if accountsId not provided
    if (data.campaignsId && !data.accountsId) {
      const campaign = await storage.getCampaignById(data.campaignsId);
      if (campaign?.accountsId) data.accountsId = campaign.accountsId;
    }
    const lead = await storage.createLead(data);
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
    const data = parsed.data;
    // Auto-inherit account from campaign when campaign is being assigned/changed
    if (data.campaignsId && !data.accountsId && !existing.accountsId) {
      const campaign = await storage.getCampaignById(data.campaignsId);
      if (campaign?.accountsId) data.accountsId = campaign.accountsId;
    }
    const lead = await storage.updateLead(Number(req.params.id), data);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    // Fire close summary when conversion status changes to a closed status
    const CLOSE_STATUSES = ["Closed", "Booked"];
    const newStatus = data.conversionStatus;
    const oldStatus = existing.conversionStatus;
    if (newStatus && CLOSE_STATUSES.includes(newStatus) && newStatus !== oldStatus) {
      fetch(`${getEngineUrl()}/api/leads/${req.params.id}/close-summary`, { method: "POST" }).catch(() => {});
    }

    // Notification: booking_confirmed — when lead status changes to Booked
    if (newStatus === "Booked" && oldStatus !== "Booked") {
      try {
        const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Lead";
        const agencyUsers = (await storage.getAppUsers()).filter((u: any) => u.accountsId === 1);
        for (const admin of agencyUsers) {
          await createAndDispatchNotification({
            type: "booking_confirmed",
            title: `Call booked: ${leadName}`,
            body: lead.bookedCallDate
              ? `Scheduled for ${new Date(lead.bookedCallDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
              : null,
            userId: admin.id!,
            accountId: lead.accountsId ?? null,
            read: false,
            link: "/calendar",
            leadId: lead.id,
          });
        }
      } catch (notifErr) {
        console.error("[notifications] Failed to dispatch booking_confirmed:", notifErr);
      }
    }

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

  // POST /api/leads/:id/transcribe-voice — Groq Whisper transcription
  app.post("/api/leads/:id/transcribe-voice", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(200).json({ error: "NO_GROQ_API_KEY" });

    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (req.user!.accountsId !== 1 && (lead as any).accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { audio_data, mime_type } = req.body;
    if (!audio_data) return res.status(400).json({ message: "No audio data provided" });

    try {
      const base64Clean = (audio_data as string).replace(/^data:[^,]+,/, "");
      const audioBuffer = Buffer.from(base64Clean, "base64");
      console.log("[transcribe-voice] mime_type:", mime_type, "| audio_data length:", (audio_data as string).length, "| buffer size:", audioBuffer.length, "bytes");

      const rawMime = (mime_type || "audio/webm") as string;
      const mimeBase = rawMime.split(";")[0].trim();
      const ext = mimeBase.includes("webm") ? "webm" : mimeBase.includes("ogg") ? "ogg" : mimeBase.includes("mp4") ? "mp4" : mimeBase.includes("wav") ? "wav" : "webm";

      const file = new File([audioBuffer], `recording.${ext}`, { type: mimeBase });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("response_format", "json");
      formData.append("temperature", "0");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error("[transcribe-voice] Groq error:", errBody);
        return res.status(500).json({ error: "Transcription failed", detail: errBody });
      }

      const json = await response.json() as any;
      const text = json.text?.trim() ?? "";

      return res.json({ transcription: text });
    } catch (err) {
      console.error("[transcribe-voice] Error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  }));

  // ─── Bulk Lead Operations ──────────────────────────────────────────

  // CSV Import — bulk create leads from a mapped array
  app.post("/api/leads/import-csv", requireAuth, async (req, res) => {
    try {
      if (req.user!.accountsId !== 1) {
        if (!req.user!.accountsId) {
          return res.status(403).json({ message: "Account scoping required" });
        }
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
        "nextActionAt", "bookingConfirmedAt",
      ];

      const created: any[] = [];
      const errors: { row: number; message: string }[] = [];

      const forcedAccountId = req.user!.accountsId !== 1 ? req.user!.accountsId : undefined;

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
      console.error("CSV import error:", err);
      res.status(500).json({ message: err.message || "CSV import failed" });
    }
  });

  // Bulk update leads (move stage, assign campaign)
  app.post("/api/leads/bulk-update", requireAuth, async (req, res) => {
    try {
      if (req.user!.accountsId !== 1) {
        if (!req.user!.accountsId) {
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

      let leadIds = ids.map(Number);
      if (req.user!.accountsId !== 1) {
        const userAccountId = req.user!.accountsId;
        const ownedLeads: number[] = [];
        for (const lid of leadIds) {
          const allLeads = await storage.getLeads();
          const lead = allLeads.find((l: any) => l.id === lid || l.Id === lid);
          if (lead && lead.accountsId === userAccountId) {
            ownedLeads.push(lid);
          }
        }
        leadIds = ownedLeads;
        if (leadIds.length === 0) {
          return res.status(403).json({ message: "None of the specified leads belong to your account" });
        }
      }

      const updated = await storage.bulkUpdateLeads(leadIds, parsed.data);

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

      const existingRows = await storage.getTagsByLeadIds(leadIds.map(Number));
      const existingSet = new Set(existingRows.map((r: any) => `${r.leadsId}:${r.tagsId}`));

      const toInsert: { leadsId: number; tagsId: number }[] = [];
      for (const leadId of leadIds) {
        for (const tagId of tagIds) {
          if (!existingSet.has(`${Number(leadId)}:${Number(tagId)}`)) {
            toInsert.push({ leadsId: Number(leadId), tagsId: Number(tagId) });
          }
        }
      }

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
    const ids = idsParam.split(",").map(Number).filter((n) => !isNaN(n));
    const data = ids.length > 0 ? await storage.getTagsByLeadIds(ids) : [];
    res.json(data);
  }));

  app.get("/api/leads/:id/tags", requireAuth, wrapAsync(async (req, res) => {
    const data = await storage.getTagsByLeadId(Number(req.params.id));
    res.json(data);
  }));

  // GET /api/leads/:id/tag-events — tag events with timestamps for chat timeline
  app.get("/api/leads/:id/tag-events", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
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

  // POST /api/leads/:id/trigger-bump
  app.post("/api/leads/:id/trigger-bump", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    const accountId = lead.accountsId;
    try {
      const resp = await fetch(`${getEngineUrl()}/api/trigger-bump`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, account_id: accountId }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({ message: err });
      }
      const data = await resp.json();
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ message: "Automation service unavailable: " + (err.message || "") });
    }
  }));

  // GET /api/leads/:id/score-breakdown — tier, sub-scores, signals, trend
  app.get("/api/leads/:id/score-breakdown", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    if (req.user!.accountsId !== 1 && lead.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const history = await storage.getLeadScoreHistoryByLeadId(leadId);
    const latestHistory = history[0];

    const WEIGHT_FUNNEL = 0.50;
    const WEIGHT_ENGAGEMENT = 0.30;
    const WEIGHT_ACTIVITY = 0.20;

    const FUNNEL_WEIGHTS: Record<string, number> = {
      New: 0, Queued: 0, Contacted: 0, Responded: 30, "Multiple Responses": 50,
      Qualified: 70, Booked: 90, Closed: 90, DND: 0, Lost: 0,
    };

    const conversionStatus = lead.conversionStatus ?? "";

    const FUNNEL_MAX = 50;
    const ENGAGEMENT_MAX = 30;
    const ACTIVITY_MAX = 20;
    const rawEngagement = latestHistory?.engagementScore ?? lead.engagementScore ?? 0;
    const rawActivity = latestHistory?.activityScore ?? lead.activityScore ?? 0;
    const funnelWeight = Math.min(FUNNEL_MAX, Math.round(WEIGHT_FUNNEL * (FUNNEL_WEIGHTS[conversionStatus] ?? 0)));
    const engagementScore = Math.min(ENGAGEMENT_MAX, Math.round((rawEngagement / 100) * ENGAGEMENT_MAX));
    const activityScore = Math.min(ACTIVITY_MAX, Math.round((rawActivity / 100) * ACTIVITY_MAX));

    let leadScore: number;
    if (lead.optedOut || conversionStatus === "DND" || conversionStatus === "Lost") {
      leadScore = 0;
    } else {
      leadScore = funnelWeight + engagementScore + activityScore;
    }

    let tier: string;
    if (lead.optedOut || conversionStatus === "DND" || conversionStatus === "Lost") tier = "Lost";
    else if (leadScore >= 80) tier = "Hot";
    else if (leadScore >= 60) tier = "Awake";
    else if (leadScore >= 40) tier = "Lukewarm";
    else if (leadScore >= 20) tier = "Cold";
    else tier = "Sleeping";

    let trend: "up" | "down" | "stable" = "stable";
    if (history.length >= 2) {
      const newest = history[0].leadScore ?? 0;
      const oldest = history[history.length - 1].leadScore ?? 0;
      if (newest - oldest >= 5) trend = "up";
      else if (oldest - newest >= 5) trend = "down";
    }

    const sentiment: "positive" | "negative" | "neutral" | null =
      lead.aiSentiment === "positive" ? "positive"
      : lead.aiSentiment === "negative" ? "negative"
      : lead.aiSentiment === "neutral" ? "neutral"
      : null;

    const signals: string[] = [];
    if (sentiment === "positive") signals.push("Positive sentiment");
    else if (sentiment === "negative") signals.push("Negative sentiment");
    if (lead.manualTakeover) signals.push("Manual takeover active");
    if (lead.optedOut) signals.push("Opted out");
    if (conversionStatus === "Booked") signals.push("Booked");

    res.json({
      lead_score: leadScore,
      engagement_score: engagementScore,
      activity_score: activityScore,
      funnel_weight: funnelWeight,
      engagement_max: ENGAGEMENT_MAX,
      activity_max: ACTIVITY_MAX,
      funnel_max: FUNNEL_MAX,
      tier,
      signals: signals.slice(0, 4),
      trend,
      sentiment,
      last_updated: new Date().toISOString(),
    });
  }));

  // GET /api/leads/:id/score-history — historical lead score over time
  app.get("/api/leads/:id/score-history", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    if (req.user!.accountsId !== 1 && lead.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const days = Number(req.query.days) || 14;

    try {
      const result = await pool.query(
        `SELECT created_at, lead_score
         FROM p2mxx34fvbf3ll6."Lead_Score_History"
         WHERE leads_id = $1
           AND created_at >= NOW() - ($2 || ' days')::INTERVAL
         ORDER BY created_at ASC`,
        [leadId, days]
      );

      const history = result.rows.map((row: { created_at: Date | string; lead_score: number }) => ({
        date: typeof row.created_at === "string"
          ? row.created_at
          : row.created_at.toISOString(),
        score: Number(row.lead_score),
      }));

      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch score history", error: err.message });
    }
  }));

  // ─── Demo / Testing Endpoints ─────────────────────────────────────

  app.post("/api/leads/:id/reset-demo", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    await Promise.all([
      storage.deleteInteractionsByLeadId(leadId),
      storage.deleteAllLeadTags(leadId),
      db.delete(leadScoreHistory).where(eq(leadScoreHistory.leadsId, leadId)),
    ]);
    if (lead.accountsId !== null) {
      broadcast(lead.accountsId, "lead_reset", { leads_id: leadId, accounts_id: lead.accountsId });
    }
    await storage.updateLead(leadId, {
      currentBumpStage: 0,
      messageCountSent: 0,
      messageCountReceived: 0,
      conversionStatus: "New",
      manualTakeover: false,
      optedOut: false,
      dncReason: null,
      aiSentiment: null,
      leadScore: 0,
      engagementScore: 0,
      activityScore: 0,
      firstMessageSentAt: null,
      lastMessageSentAt: null,
      lastMessageReceivedAt: null,
      bump1SentAt: null,
      bump2SentAt: null,
      bump3SentAt: null,
      bookedCallDate: null,
      bookingConfirmedAt: null,
      nextActionAt: null,
    });
    res.json({ ok: true });
  }));

  app.post("/api/leads/:id/demo-reset-and-send", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    const accountId = lead.accountsId;

    await Promise.all([
      storage.deleteInteractionsByLeadId(leadId),
      storage.deleteAllLeadTags(leadId),
      db.delete(leadScoreHistory).where(eq(leadScoreHistory.leadsId, leadId)),
    ]);

    await storage.updateLead(leadId, {
      currentBumpStage: 0,
      messageCountSent: 0,
      messageCountReceived: 0,
      conversionStatus: "New",
      manualTakeover: false,
      optedOut: false,
      dncReason: null,
      aiSentiment: null,
      leadScore: 0,
      engagementScore: 0,
      activityScore: 0,
      firstMessageSentAt: null,
      lastMessageSentAt: null,
      lastMessageReceivedAt: null,
      bump1SentAt: null,
      bump2SentAt: null,
      bump3SentAt: null,
      bookedCallDate: null,
      bookingConfirmedAt: null,
      nextActionAt: null,
    });

    try {
      const resp = await fetch(`${getEngineUrl()}/api/leads/${leadId}/trigger-first-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({ message: err });
      }
      res.json(await resp.json());
    } catch (err: any) {
      res.status(502).json({ message: "Automation service unavailable: " + (err.message || "") });
    }
  }));

  app.post("/api/leads/:id/ai-send", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    const accountId = lead.accountsId;
    try {
      const hasFirstMessage = lead.firstMessageSentAt != null;
      let fetchResp: globalThis.Response;
      if (!hasFirstMessage) {
        fetchResp = await fetch(`${getEngineUrl()}/api/leads/${leadId}/trigger-first-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_id: accountId }),
        });
      } else {
        fetchResp = await fetch(`${getEngineUrl()}/api/trigger-bump`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId, account_id: accountId }),
        });
      }
      if (!fetchResp.ok) {
        const err = await fetchResp.text();
        return res.status(fetchResp.status).json({ message: err });
      }
      res.json(await fetchResp.json());
    } catch (err: any) {
      res.status(502).json({ message: "Automation service unavailable: " + (err.message || "") });
    }
  }));

  // ─── Lead Score History ────────────────────────────────────────────

  app.get("/api/lead-score-history", requireAuth, wrapAsync(async (req, res) => {
    const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;
    const data = leadId
      ? await storage.getLeadScoreHistoryByLeadId(leadId)
      : await storage.getLeadScoreHistory();
    res.json(data);
  }));

  // ─── Automation Logs ──────────────────────────────────────────────

  app.get("/api/automation-logs/summary", requireAgency, wrapAsync(async (req, res) => {
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const data = await storage.getAutomationLogsSummary(accountId);
    res.json(data);
  }));

  app.get("/api/automation-logs", requireAgency, wrapAsync(async (req, res) => {
    const { page = '0', limit = '50', accountId, status, workflowName, dateFrom, dateTo } = req.query;
    const data = await storage.getAutomationLogsPaginated({
      page: Number(page),
      limit: Number(limit),
      accountId: accountId ? Number(accountId) : undefined,
      status: status as string | undefined,
      workflowName: workflowName as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    });
    res.json(data);
  }));
}

// ── Background booking reminder notifier — called once at startup ──────────

export function startBookingReminders(): void {
  // Track which lead IDs have already been reminded (prevents duplicate reminders)
  const bookingRemindedLeads = new Set<number>();

  async function checkUpcomingBookings() {
    try {
      const now = new Date();
      const in1h = new Date(now.getTime() + 60 * 60 * 1000);

      // Find all leads with a booked call in the next hour that haven't been reminded yet
      const upcomingBookings = await db
        .select()
        .from(leads)
        .where(
          and(
            gte(leads.bookedCallDate, now),
            lte(leads.bookedCallDate, in1h),
            eq(leads.conversionStatus, "Booked"),
            ne(leads.noShow, true),
          ),
        );

      for (const lead of upcomingBookings) {
        if (bookingRemindedLeads.has(lead.id!)) continue;
        bookingRemindedLeads.add(lead.id!);

        const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Lead";
        const callDate = new Date(lead.bookedCallDate!);
        const minutesUntil = Math.round((callDate.getTime() - now.getTime()) / 60000);

        // Notify all agency users
        const agencyUsers = (await storage.getAppUsers()).filter((u: any) => u.accountsId === 1);
        for (const admin of agencyUsers) {
          await createAndDispatchNotification({
            type: "booking_reminder",
            title: `Upcoming call: ${leadName}`,
            body: `Starts in ${minutesUntil} min (${callDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})`,
            userId: admin.id!,
            accountId: lead.accountsId ?? null,
            read: false,
            link: "/calendar",
            leadId: lead.id,
          });
        }
      }

      // Clean up old entries (calls that have passed) to prevent memory growth
      for (const id of bookingRemindedLeads) {
        const lead = upcomingBookings.find((l) => l.id === id);
        if (!lead) {
          // Lead no longer in upcoming window, safe to remove from set
          bookingRemindedLeads.delete(id);
        }
      }
    } catch (err) {
      console.error("[BookingReminderNotifier]", err);
    }
  }

  // Run immediately on startup, then every 10 minutes
  checkUpcomingBookings();
  setInterval(checkUpcomingBookings, 10 * 60 * 1000);
}
