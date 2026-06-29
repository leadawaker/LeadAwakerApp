import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { leadScoreHistory } from "@shared/schema";
import { db, pool } from "../db";
import { broadcast } from "../sse";
import { wrapAsync, getEngineUrl } from "./_helpers";
import { eq } from "drizzle-orm";

export function registerLeadsDemoScoreRoutes(app: Express): void {
  // POST /api/leads/:id/cancel-booking — client-initiated cancel; flags lead so webhook skips Cancelled status
  app.post("/api/leads/:id/cancel-booking", requireAuth, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.id);
    const lead = await storage.getLeadById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    if (req.user!.accountsId !== 1 && lead.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const resp = await fetch(`${getEngineUrl()}/api/leads/${leadId}/client-cancel-booking`, {
        method: "POST",
      });
      if (!resp.ok) {
        const err = await resp.text();
        return res.status(resp.status).json({ message: err });
      }
      res.json(await resp.json());
    } catch (err: any) {
      console.error("[leads] automation engine unreachable:", err?.message || err);
      res.status(502).json({ message: "Automation service unavailable" });
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
      console.error("[leads] score history error:", err);
      res.status(500).json({ message: "Internal server error" });
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
      aiMemory: null,
      automationStatus: "queued",
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
      aiMemory: null,
      automationStatus: "queued",
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
      console.error("[leads] automation engine unreachable:", err?.message || err);
      res.status(502).json({ message: "Automation service unavailable" });
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
      console.error("[leads] automation engine unreachable:", err?.message || err);
      res.status(502).json({ message: "Automation service unavailable" });
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
