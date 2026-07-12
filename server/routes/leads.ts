import type { Express } from "express";
import { storage, paginatedQuery } from "../storage";
import { requireAuth, requireOwner, scopeToAccount } from "../auth";
import { canDeleteHard } from "../permissions";
import {
  leads,
  insertLeadsSchema,
} from "@shared/schema";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "../dbKeys";
import { db, pool } from "../db";
import { createAndDispatchNotification } from "../notification-dispatcher";
import { pushBookingEvent } from "../calendar";
import { handleZodError, wrapAsync, getPagination, getEngineUrl, coerceDates } from "./_helpers";
import { eq, and, gte, lte, ne, type SQL } from "drizzle-orm";
import { registerLeadsBulkTagsRoutes } from "./leadsBulkTags";
import { registerLeadsDemoScoreRoutes } from "./leadsDemoScore";

// Fetch the latest interaction (content + direction) and unread inbound count
// for a set of lead IDs in a single query (no N+1). Uses a LEFT JOIN LATERAL
// against the Interactions table to grab the most recent interaction per lead,
// plus a correlated subquery counting unread inbound interactions.
async function getLeadMessagePeek(
  leadIds: number[],
): Promise<Map<number, { last_message: string | null; last_message_direction: string | null; unread_count: number }>> {
  const map = new Map<number, { last_message: string | null; last_message_direction: string | null; unread_count: number }>();
  if (leadIds.length === 0) return map;
  try {
    const result = await pool.query(
      `SELECT
         l.id AS lead_id,
         LEFT(lm."Content", 140) AS last_message,
         lm.direction          AS last_message_direction,
         COALESCE(uc.unread_count, 0) AS unread_count
       FROM p2mxx34fvbf3ll6."Leads" l
       LEFT JOIN LATERAL (
         SELECT i."Content", i.direction
         FROM p2mxx34fvbf3ll6."Interactions" i
         WHERE i."Leads_id" = l.id
         ORDER BY i.created_at DESC NULLS LAST
         LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS unread_count
         FROM p2mxx34fvbf3ll6."Interactions" i2
         WHERE i2."Leads_id" = l.id
           AND i2.direction = 'inbound'
           AND COALESCE(i2.is_read, true) = false
       ) uc ON true
       WHERE l.id = ANY($1::int[])`,
      [leadIds],
    );
    for (const row of result.rows as Array<{ lead_id: number; last_message: string | null; last_message_direction: string | null; unread_count: number }>) {
      map.set(row.lead_id, {
        last_message: row.last_message ?? null,
        last_message_direction: row.last_message_direction ?? null,
        unread_count: Number(row.unread_count) || 0,
      });
    }
  } catch (err) {
    console.error("[getLeadMessagePeek] failed:", err);
  }
  return map;
}

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
      const pagePeekMap = pageIds.length > 0 ? await getLeadMessagePeek(pageIds) : new Map();
      const enrichedPage = pageData.map((l: any) => {
        const peek = pagePeekMap.get(l.id);
        return {
          ...l,
          tag_ids: pageTagMap.get(l.id) ?? [],
          last_message: peek?.last_message ?? null,
          last_message_direction: peek?.last_message_direction ?? null,
          unread_count: peek?.unread_count ?? 0,
        };
      });
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
    const peekMap = leadIds.length > 0 ? await getLeadMessagePeek(leadIds) : new Map();
    const enrichedData = data.map((l: any) => {
      const peek = peekMap.get(l.id);
      return {
        ...l,
        tag_ids: tagIdsByLead.get(l.id) ?? [],
        last_message: peek?.last_message ?? null,
        last_message_direction: peek?.last_message_direction ?? null,
        unread_count: peek?.unread_count ?? 0,
      };
    });
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
      "serviceCompletedAt", "reviewRequestSentAt",
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
            link: "/platform/calendar",
            leadId: lead.id,
          });
        }
      } catch (notifErr) {
        console.error("[notifications] Failed to dispatch booking_confirmed:", notifErr);
      }

      // Push the booked call to the account's connected calendar(s) (Google/Outlook).
      // Best-effort: never block the lead update on calendar failures.
      if (lead.bookedCallDate && lead.accountsId) {
        try {
          const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Lead";
          const campaign = lead.campaignsId ? await storage.getCampaignById(lead.campaignsId) : null;
          const durationMin = lead.callDurationMinutes || campaign?.defaultCallDurationMinutes || 30;
          const start = new Date(lead.bookedCallDate);
          const end = new Date(start.getTime() + durationMin * 60000);
          await pushBookingEvent(lead.accountsId, {
            title: `Call: ${leadName}`,
            description: lead.phone ? `WhatsApp: ${lead.phone}` : undefined,
            start: start.toISOString(),
            end: end.toISOString(),
            attendees: lead.email ? [lead.email] : undefined,
          });
          // Persist duration so the calendar UI renders the correct block height.
          if (!lead.callDurationMinutes) {
            await storage.updateLead(lead.id!, { callDurationMinutes: durationMin }).catch(() => {});
          }
        } catch (calErr) {
          console.error("[calendar] Failed to push booked call:", calErr);
        }
      }
    }

    res.json(toDbKeys(lead as any, leads));
  }));

  app.delete("/api/leads/:id", requireAuth, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getLeadById(id);
    if (!existing) return res.status(404).json({ message: "Lead not found" });
    if (req.user!.accountsId !== 1 && existing.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const internalKey = req.headers["x-internal-key"] as string | undefined;
    const wantsHardDelete = !!internalKey || canDeleteHard(req.user);

    if (!wantsHardDelete) {
      const updated = await storage.updateLead(id, { status: "Archived" } as any);
      if (!updated) return res.status(404).json({ message: "Lead not found" });
      return res.status(204).end();
    }

    const ok = await storage.deleteLead(id);
    if (!ok) return res.status(404).json({ message: "Lead not found" });
    res.status(204).end();
  }));

  app.post("/api/leads/:id/purge", requireOwner, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const ok = await storage.deleteLead(id);
    if (!ok) return res.status(404).json({ message: "Lead not found" });
    res.status(204).end();
  }));

  // POST /api/leads/:id/mark-served — reputation entry trigger. Sets
  // service_completed_at to NOW server-side. Critical: the timestamp is built
  // here with new Date(), never sent from the client (Drizzle-Zod z.date()
  // rejects ISO strings silently, reverting the update with no error).
  app.post("/api/leads/:id/mark-served", requireAuth, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getLeadById(id);
    if (!existing) return res.status(404).json({ message: "Lead not found" });
    if (req.user!.accountsId !== 1 && existing.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const lead = await storage.updateLead(id, { serviceCompletedAt: new Date() } as any);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(toDbKeys(lead as any, leads));
  }));

  // POST /api/leads/:id/transcribe-voice — Groq Whisper; if use_fallback=true, OpenAI Whisper
  app.post("/api/leads/:id/transcribe-voice", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);

    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (req.user!.accountsId !== 1 && (lead as any).accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { audio_data, mime_type, use_fallback } = req.body;
    if (!audio_data) return res.status(400).json({ message: "No audio data provided" });

    const base64Clean = (audio_data as string).replace(/^data:[^,]+,/, "");
    const audioBuffer = Buffer.from(base64Clean, "base64");
    console.log("[transcribe-voice] mime_type:", mime_type, "| buffer size:", audioBuffer.length, "bytes | fallback:", !!use_fallback);

    const rawMime = (mime_type || "audio/webm") as string;
    const mimeBase = rawMime.split(";")[0].trim();
    const ext = mimeBase.includes("webm") ? "webm" : mimeBase.includes("ogg") ? "ogg" : mimeBase.includes("mp4") ? "mp4" : mimeBase.includes("wav") ? "wav" : "webm";

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!groqKey) return res.status(200).json({ error: "NO_GROQ_API_KEY" });

    async function callWhisper(url: string, apiKey: string, model: string): Promise<string | null> {
      const f = new File([audioBuffer], `recording.${ext}`, { type: mimeBase });
      const fd = new FormData();
      fd.append("file", f);
      fd.append("model", model);
      fd.append("response_format", "json");
      fd.append("temperature", "0");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}` },
          body: fd,
          signal: controller.signal,
        });
        if (!response.ok) {
          console.error(`[transcribe-voice] ${url} error ${response.status}:`, await response.text());
          return null;
        }
        const json = await response.json() as any;
        return json.text?.trim() ?? "";
      } catch (err) {
        console.error(`[transcribe-voice] ${url} threw:`, err);
        return null;
      } finally {
        clearTimeout(timeout);
      }
    }

    // First attempt: Groq once.
    // Retry (use_fallback): Groq ×3, then OpenAI.
    const groqUrl = "https://api.groq.com/openai/v1/audio/transcriptions";
    const groqAttempts = use_fallback ? 3 : 1;

    for (let i = 0; i < groqAttempts; i++) {
      console.log(`[transcribe-voice] Groq attempt ${i + 1}/${groqAttempts}`);
      const text = await callWhisper(groqUrl, groqKey, "whisper-large-v3-turbo");
      if (text !== null) return res.json({ transcription: text });
    }

    if (use_fallback && openaiKey) {
      console.log("[transcribe-voice] Groq exhausted, trying OpenAI");
      const text = await callWhisper("https://api.openai.com/v1/audio/transcriptions", openaiKey, "whisper-1");
      if (text !== null) return res.json({ transcription: text });
    }

    console.error("[transcribe-voice] all attempts failed");
    return res.status(500).json({ error: "Transcription failed" });
  }));

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
      console.error("[leads] automation engine unreachable:", err?.message || err);
      res.status(502).json({ message: "Automation service unavailable" });
    }
  }));

  // POST /api/leads/:id/reschedule-reengage — trigger AI re-engagement after a reschedule
  app.post("/api/leads/:id/reschedule-reengage", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    if (req.user!.accountsId !== 1 && lead.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const reason = (req.body?.reason as string) || "client_requested";
    try {
      const resp = await fetch(`${getEngineUrl()}/api/leads/${leadId}/reschedule-reengage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({ message: err });
      }
      const data = await resp.json();
      res.json(data);
    } catch (err: any) {
      console.error("[leads] automation engine unreachable:", err?.message || err);
      res.status(502).json({ message: "Automation service unavailable" });
    }
  }));

  // POST /api/leads/:id/no-show — client reports the lead didn't show up for the
  // booked call (48h claim window). Persists the claim + audit fields, then
  // fire-and-forgets the engine's reason-mapped follow-up automation.
  app.post("/api/leads/:id/no-show", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    if (req.user!.accountsId !== 1 && lead.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const reason = req.body?.reason as string;
    if (!["not_interested", "wants_other_time", "no_reason"].includes(reason)) {
      return res.status(400).json({ message: "Invalid reason" });
    }
    if (lead.conversionStatus !== "Booked") {
      return res.status(409).json({ code: "not_booked", message: "Lead has no booked call" });
    }
    if (lead.noShow) {
      return res.status(409).json({ code: "already_reported", message: "No-show already reported" });
    }
    const callDate = lead.bookedCallDate ? new Date(lead.bookedCallDate) : null;
    const now = new Date();
    if (!callDate || callDate > now) {
      return res.status(409).json({ code: "call_not_past", message: "Call has not taken place yet" });
    }
    if (now.getTime() - callDate.getTime() > 48 * 3600 * 1000) {
      return res.status(409).json({ code: "window_expired", message: "48h claim window has expired" });
    }

    await storage.updateLead(leadId, {
      noShow: true,
      noShowReason: reason,
      noShowReportedAt: now,
      noShowReportedBy: req.user!.id,
    });

    // Fire-and-forget: follow-up automation must not block or fail the claim.
    fetch(`${getEngineUrl()}/api/leads/${leadId}/no-show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch((err) =>
      console.error("[leads] no-show engine dispatch failed:", err?.message || err),
    );

    res.json({ status: "reported", leadId, reason });
  }));

  registerLeadsBulkTagsRoutes(app);
  registerLeadsDemoScoreRoutes(app);
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
            link: "/platform/calendar",
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
