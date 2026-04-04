import type { Express } from "express";
import { storage, paginatedQuery } from "../storage";
import { requireAuth, requireAgency, scopeToAccount } from "../auth";
import {
  campaigns,
  interactions,
  insertCampaignsSchema,
  insertPrompt_LibrarySchema,
  insertCampaignMetricsHistorySchema,
  insertPromptVersionsSchema,
} from "@shared/schema";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "../dbKeys";
import { db, pool } from "../db";
import { handleZodError, wrapAsync, getPagination, getEngineUrl } from "./_helpers";
import { eq, count, and, gte } from "drizzle-orm";

// SYNC: keep in sync with tools/ai_service.py DEFAULT_CONVERSATION_PROMPT
const DEFAULT_CONVERSATION_PROMPT = `You are {agent_name}, from the commercial team at {company_name}. Your job is to qualify leads via WhatsApp who showed interest in {service_name} but never followed through, and book a consultation call. If a lead drifts off topic, use your SPIN training to keep them engaged. Always stay on topic.

###

Output

Tone & Identity:
- Casual, smooth, professional — multitasking vibe
- Language: always respond in {language}
- Do not repeatedly use the customer's first name. Once per conversation max to maintain professionalism and avoid sounding robotic or scripted.
- Today's date: {today_date}

Formatting:
- Keep responses short, concise, mobile-friendly
- Strictly evaluate ongoing context before adding any acknowledgements or transitional phrases.
- Each sentence on a new line with a space between lines
- Avoid non-sequitur interjections like "Hey, thanks for keeping the convo going."
- If the last 2 AI messages in the chat history were similar, stop and vary your approach.
- Never use EM or EN DASHES — –
- No emojis
- No quotation marks around messages
- Always stay on topic and do not use conciliatory phrases ("Ah, I see," "I hear you," etc.) when the user expresses disinterest.

###

Your training: SPIN Selling, The Challenger Sale, {niche}

###

Qualified Prospect Script
Important notes:
- ALWAYS read the chat history for the context of the conversation, you are replying to the most recent message. You will always be mindful of what you said last and the full conversation so far.

You are {agent_name}, from the commercial team at {company_name}. Practical, friendly but no-nonsense. You care enough to be honest, but never pushy. You know the common frustrations in {niche} and how {company_name} solves them for real. Always busy, so you are direct but human.

###

0.0 - The lead is responding to the first automated message. You will typically receive one of 3 responses:
  0.1 - They confirm it's them, and the CRM sends Message 2 automatically.
        Wait for their reply to Message 2 before continuing to step 1.0.
  0.2 - They say they are not that person. Apologize and ask if they need {service_name}.
  0.3 - They are hostile ("stop", "don't want", "leave me alone"):
        "Sorry to bother you, take care!" and output [END].
        Do not respond anymore.

1.0 - "Lucky timing! My manager asked me to call you, but I didn't want to be intrusive. Are you still looking for help with {niche_question}"

  1.1 - Happy with current situation: go to 2.5.2 (educative reframe).
  1.2 - Does not need the service: soft close + [END].
  1.3 - Hot lead (wants to buy): SKIP qualification, send {calendar_link} directly and go to 6.0.

2.0 - "Are you still without {service_name}, or do you already have something in place?"

  2.1 - Without: hot lead, go to 3.0.
  2.2 - Has something: go to 2.5.

2.5 - "Is it working well, or is there something that bothers you?"

  2.5.1 - Mentions specific pain (it breaks, too slow, bad support, too expensive):
          Pain captured, SKIP 3.0 and go directly to 4.0.

  2.5.2 - Vague pain ("not great", "could be better"):
          Go to 3.0 to get specific.

  2.5.3 - Satisfied: educative reframe — help them see a gap they may not have noticed.

3.0 - ONLY if pain was vague in 2.5:
      "What bothers you most — reliability, results, support, or price?"
      Capture and go to 4.0.

4.0 - "And when that happens, what gets impacted most — work, goals, revenue, something important?"

  4.1 - Mentions work/business/revenue:
        "Is this for personal use or do you have a business?"
        Capture and go to 5.0.
  4.2 - Personal use: go directly to 5.0.

5.0 - Explain HOW {company_name} solves the lead's specific problem,
      using ONE Challenger insight, in 2-3 sentences. Talk about RESULTS, not specs.
      Reference: {usp}
      Connect the pain to what makes {company_name} different.

      ONLY AFTER showing value, offer the consultant:
      "Does it make sense to talk with a specialist to see what works for you?"

  5.1 - Yes: send {calendar_link} + go to 6.0.
  5.2 - Hesitates / has doubts: answer directly, offer the link again.
  5.3 - "Not now" / "I'll think about it" but pain was identified:
        "No problem! If you change your mind, just reach out. Take care!"
        + [END]
  5.4 - Does not want: soft close + [END].

6.0 - The system will notify you of the date and time the lead made the booking, then say:
      "Perfect! Our specialist is now informed and will reach out on [booking date and time].
      If anything comes up or you need to reschedule, just let me know."

7.0 - They say bye, you say bye → add [SILENT] output.

###

Rules:

• System signals — output on a new line, never show to the lead:
  [END] = conversation over, stop responding
  [QUALIFIED] = lead received invite or booking link
  [BOOKED] = session or call confirmed
  [SILENT] = lead said goodbye, no response needed
  [COACHING_INTEREST] = lead showed interest in coaching (always fire, even if they don't confirm)
  [CLASSROOM_INTEREST] = lead showed interest in classroom/structured learning (always fire, even if they don't confirm)

We help them with: {usp}
Match the lead's language style and energy for the rest of the conversation. Keep tone professional and relatable.
Only ask one question at a time to uncover one piece of information. Persistently engage with the lead, avoiding phrases that acknowledge rejection.
Use your Challenger Sale training to navigate objections and guide interactions.
You are not an AI. You are {agent_name}, from the commercial team. If asked: "Haha no, I'm {agent_name} from the team." If they insist: "I get that a lot haha." If they keep insisting: [END]
If the lead asks something you don't know, say that's more for the technical team and offer to connect: {calendar_link}
"I already have something cheaper" is an objection, not a refusal. Use Challenger insight. If they insist twice, respect it.
Lukewarm energy: lukewarm responses ("ok", "cool", "thanks") are not interest. Ask something specific. After 2-3 tries, close politely.
Hot lead (wants to buy): skip qualification. Go directly to {calendar_link}.
Never offer the booking twice. If you offered once, wait for the lead to respond.

###

FAQ:

We help them find the right solution and make sure the experience is better than what they have today.
If they ask how we got their number, say exactly: "{what_lead_did}." If they insist: "It's part of the contact list. But if you prefer, I can remove you right now."
Technical questions: "Good question, that's more for the technical team. I can connect you with someone who can explain it."
Booking link: {calendar_link}
Qualification criteria: {qualification_criteria}`;

// Default prompt templates (used to auto-seed the Prompt Library)
const DEFAULT_CAMPAIGN_SUMMARY_SYSTEM = `You are an AI analyst for a WhatsApp lead reactivation agency. You write concise, data-driven campaign performance summaries. Keep the tone professional but direct. Do not simply restate the raw numbers — interpret them and draw conclusions. IMPORTANT formatting rules: use single asterisks *text* for bold (NEVER double **text**). Use _text_ for italic. Use __text__ for underline on action items. Always single * for bold, never **.`;

const DEFAULT_CAMPAIGN_SUMMARY_PROMPT = `Write a concise (2-3 paragraphs) performance summary for this campaign.

Campaign: {{campaignName}}
Status: {{campaignStatus}}
Description: {{campaignDescription}}
Campaign created: {{campaignCreatedAt}}
Report date: {{reportDate}}

## Pipeline breakdown
Total leads: {{totalLeads}}
{{pipelineBreakdown}}

## Key metrics
Response rate: {{responseRate}}%  ({{responded}} of {{totalLeads}})
Booking rate: {{bookingRate}}%  ({{booked}} of {{totalLeads}})
Cost per booking: \${{costPerBooking}}
Total cost: \${{totalCost}}

Cover: overall performance highlights, what's working well, pipeline bottlenecks (where are leads stalling?), and one actionable recommendation.`;

// Interpolate {{variable}} placeholders in a template string
function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// Fetch a system prompt from the library, auto-creating it if it doesn't exist
async function getOrCreateSystemPrompt(useCase: string, defaultName: string, defaultTemplate: string, defaultSystemMsg?: string) {
  let entry = await storage.getPromptByUseCase(useCase);
  if (!entry) {
    entry = await storage.createPrompt({
      name: defaultName,
      useCase,
      promptText: defaultTemplate,
      ...(defaultSystemMsg ? { systemMessage: defaultSystemMsg } : {}),
      model: "llama-3.1-8b-instant",
      temperature: "0.7",
      maxTokens: BigInt(600),
      status: "active",
      notes: "System prompt — auto-created. Edit freely. Use {{variable}} placeholders for dynamic data.",
    } as any);
    console.log(`[prompt-library] Auto-created system prompt: "${defaultName}" (useCase=${useCase})`);
  }
  return entry;
}

export function registerCampaignsRoutes(app: Express): void {
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

    // Auto-create default conversation prompt for the new campaign
    try {
      await storage.createPrompt({
        name: `Default — ${campaign.name}`,
        campaignsId: campaign.id,
        accountsId: campaign.accountsId!,
        promptText: DEFAULT_CONVERSATION_PROMPT,
        useCase: "conversation",
        model: "llama-3.3-70b-versatile",
        temperature: "0.7",
        maxTokens: 250,
        status: "Active",
      });
    } catch (err) {
      console.error("Failed to auto-create default prompt for campaign", campaign.id, err);
    }

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

    // When a campaign is activated, immediately kick the campaign launcher
    const becomingActive = parsed.data.status === "Active" && existing.status !== "Active";
    if (becomingActive) {
      const engineUrl = getEngineUrl();
      fetch(`${engineUrl}/api/campaigns/${req.params.id}/trigger`, { method: "POST" }).catch(() => {});
    }
  }));

  app.delete("/api/campaigns/:id", requireAuth, wrapAsync(async (req, res) => {
    const existing = await storage.getCampaignById(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Campaign not found" });
    // Subaccount users can only delete their own campaigns
    if (req.user!.accountsId !== 1 && existing.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    // Auto-delete associated prompts before removing the campaign
    try {
      await storage.deletePromptsByCampaignId(Number(req.params.id));
    } catch (err) {
      console.error("Failed to delete prompts for campaign", req.params.id, err);
    }

    const ok = await storage.deleteCampaign(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Campaign not found" });
    res.status(204).end();
  }));

  // GET /api/campaigns/:id/daily-stats — outbound messages sent today + daily limit
  app.get("/api/campaigns/:id/daily-stats", requireAuth, wrapAsync(async (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = await storage.getCampaignById(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (req.user!.accountsId !== 1 && campaign.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [{ value }] = await db
      .select({ value: count() })
      .from(interactions)
      .where(and(
        eq(interactions.campaignsId, campaignId),
        eq(interactions.direction, "outbound"),
        gte(interactions.createdAt, startOfDay),
      ));
    res.json({
      sentToday: Number(value),
      dailyLimit: campaign.dailyLeadLimit ?? 1000,
      channel: campaign.channel ?? "sms",
    });
  }));

  // GET /api/campaigns/:id/ai-costs — AI token usage + cost for financials widget
  app.get("/api/campaigns/:id/ai-costs", requireAuth, wrapAsync(async (req, res) => {
    const campaignId = Number(req.params.id);
    const campaign = await storage.getCampaignById(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (req.user!.accountsId !== 1 && campaign.accountsId !== req.user!.accountsId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(ai_prompt_tokens + ai_completion_tokens), 0)::bigint AS ai_tokens,
         COALESCE(SUM(ai_cost::numeric), 0)::numeric AS ai_cost_usd
       FROM p2mxx34fvbf3ll6."Interactions"
       WHERE campaign_id = $1 AND ai_generated = true`,
      [campaignId]
    );
    const row = result.rows[0];
    res.json({
      aiTokens: Number(row.ai_tokens),
      aiCostUsd: parseFloat(row.ai_cost_usd) || 0,
    });
  }));

  // GET /api/campaigns/:id/ab-stats — A/B test variant performance
  app.get("/api/campaigns/:id/ab-stats", requireAuth, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);

      // Get campaign AB settings
      const campResult = await pool.query(
        'SELECT ab_enabled, ab_split_ratio FROM p2mxx34fvbf3ll6."Campaigns" WHERE id = $1',
        [campaignId]
      );

      if (!campResult.rows[0]) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const { ab_enabled, ab_split_ratio } = campResult.rows[0];

      // Get variant stats
      const stats = await pool.query(`
        SELECT
          l.ab_variant,
          COUNT(DISTINCT l.id) as leads,
          COUNT(DISTINCT CASE WHEN l."Conversion_Status" IN ('Contacted','Responded','Multiple Responses','Qualified','Booked') THEN l.id END) as contacted,
          COUNT(DISTINCT CASE WHEN l."Conversion_Status" IN ('Responded','Multiple Responses','Qualified','Booked') THEN l.id END) as responded,
          COUNT(DISTINCT CASE WHEN l."Conversion_Status" IN ('Qualified','Booked') THEN l.id END) as qualified,
          COUNT(DISTINCT CASE WHEN l."Conversion_Status" IN ('Booked') THEN l.id END) as booked,
          COUNT(DISTINCT CASE WHEN l.opted_out = true OR l.dnc_reason IS NOT NULL THEN l.id END) as opted_out
        FROM p2mxx34fvbf3ll6."Leads" l
        WHERE l."Campaigns_id" = $1
          AND l.ab_variant IS NOT NULL
        GROUP BY l.ab_variant
      `, [campaignId]);

      // Get avg messages to booking per variant
      const avgMsgs = await pool.query(`
        SELECT
          l.ab_variant,
          AVG(l.message_count_sent + l.message_count_received) as avg_messages,
          AVG(EXTRACT(EPOCH FROM (l.last_message_received_at - l.first_message_sent_at)) / 60) as avg_response_time_min
        FROM p2mxx34fvbf3ll6."Leads" l
        WHERE l."Campaigns_id" = $1
          AND l.ab_variant IS NOT NULL
          AND l.message_count_received > 0
        GROUP BY l.ab_variant
      `, [campaignId]);

      const avgMsgsMap: Record<string, { avg_messages: number; avg_response_time_min: number }> = {};
      for (const row of avgMsgs.rows) {
        avgMsgsMap[row.ab_variant] = {
          avg_messages: parseFloat(row.avg_messages) || 0,
          avg_response_time_min: parseFloat(row.avg_response_time_min) || 0,
        };
      }

      // Get prompt names for each variant
      const prompts = await pool.query(`
        SELECT ab_variant, name
        FROM p2mxx34fvbf3ll6."Prompt_Library"
        WHERE "Campaigns_id" = $1 AND LOWER(status) = 'active' AND ab_variant IS NOT NULL
      `, [campaignId]);

      const promptNames: Record<string, string> = {};
      for (const p of prompts.rows) {
        promptNames[p.ab_variant] = p.name;
      }

      // Build variants object
      const variants: Record<string, any> = {};
      for (const row of stats.rows) {
        const total = parseInt(row.leads);
        const responded = parseInt(row.responded);
        const qualified = parseInt(row.qualified);
        const booked = parseInt(row.booked);
        const optedOut = parseInt(row.opted_out);
        const avg = avgMsgsMap[row.ab_variant];
        variants[row.ab_variant] = {
          label: promptNames[row.ab_variant] || `Variant ${row.ab_variant}`,
          leads: total,
          contacted: parseInt(row.contacted),
          responded,
          response_rate: total > 0 ? responded / total : 0,
          qualified,
          qualification_rate: total > 0 ? qualified / total : 0,
          booked,
          booking_rate: total > 0 ? booked / total : 0,
          opted_out: optedOut,
          optout_rate: total > 0 ? optedOut / total : 0,
          avg_messages: avg?.avg_messages ? Math.round(avg.avg_messages * 10) / 10 : null,
          avg_response_time_min: avg?.avg_response_time_min ? Math.round(avg.avg_response_time_min) : null,
        };
      }

      // Calculate confidence (two-proportion z-test)
      let winner = null;
      let confidence = 0;
      let leads_needed = 0;

      if (variants.A && variants.B) {
        const aTotal = variants.A.leads;
        const bTotal = variants.B.leads;
        const aSuccess = variants.A.booked;
        const bSuccess = variants.B.booked;

        if (aTotal > 0 && bTotal > 0) {
          const pA = aSuccess / aTotal;
          const pB = bSuccess / bTotal;
          const pPool = (aSuccess + bSuccess) / (aTotal + bTotal);
          const se = Math.sqrt(pPool * (1 - pPool) * (1/aTotal + 1/bTotal));

          if (se > 0) {
            const z = Math.abs(pA - pB) / se;
            confidence = Math.min(0.99, 1 - Math.exp(-0.5 * z * z));
            winner = pA > pB ? "A" : pB > pA ? "B" : null;
          }

          // Estimate leads needed for 95% confidence
          if (confidence < 0.95 && se > 0) {
            const diff = Math.abs(pA - pB) || 0.05;
            const needed = Math.ceil(2 * (1.96 * 1.96 * pPool * (1 - pPool)) / (diff * diff));
            leads_needed = Math.max(0, needed - (aTotal + bTotal));
          }
        }
      }

      res.json({
        ab_enabled: ab_enabled ?? false,
        split_ratio: ab_split_ratio ?? 50,
        variants,
        winner,
        confidence: Math.round(confidence * 100) / 100,
        leads_needed_for_95pct: leads_needed,
      });
    } catch (err: any) {
      console.error("ab-stats error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/:id/generate-summary — Groq AI summary
  app.post("/api/campaigns/:id/generate-summary", requireAuth, wrapAsync(async (req, res) => {
    const campaignId = Number(req.params.id);
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(200).json({ error: "NO_GROQ_API_KEY" });

    const campaign = await storage.getCampaignById(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    // Resolve language from account (source of truth), with fallback
    let language: string = (req.body?.language as string) || "en";
    const accountId = (campaign as any).accountsId;
    if (accountId) {
      const account = await storage.getAccountById(accountId);
      if (account?.language) {
        const accountLangMap: Record<string, string> = {
          "Portuguese": "pt", "Dutch": "nl", "English": "en",
        };
        language = accountLangMap[account.language] || language;
      }
    }
    const languageInstructionMap: Record<string, string> = {
      pt: "Respond in Brazilian Portuguese.",
      nl: "Respond in Dutch.",
      en: "",
    };
    const languageInstruction = languageInstructionMap[language] ?? "";

    // Fetch leads for this campaign to build context
    const leadList = await storage.getLeadsByCampaignId(campaignId);
    const total = leadList.length;
    const booked = leadList.filter((l: any) => l.conversion_status === "Booked" || l.Conversion_Status === "Booked").length;
    const responded = leadList.filter((l: any) => {
      const s = l.conversion_status || l.Conversion_Status || "";
      return ["Responded", "Multiple Responses", "Qualified", "Booked", "Closed"].includes(s);
    }).length;
    const lost = leadList.filter((l: any) => ["Lost", "DND"].includes(l.conversion_status || l.Conversion_Status || "")).length;
    const qualified = leadList.filter((l: any) => ["Qualified", "Booked"].includes(l.conversion_status || l.Conversion_Status || "")).length;

    const responseRate = total > 0 ? ((responded / total) * 100).toFixed(1) : "0";
    const bookingRate = total > 0 ? ((booked / total) * 100).toFixed(1) : "0";
    const totalCostNum = Number(campaign.totalCost || 0);
    const costPerBooking = booked > 0 ? (totalCostNum / booked).toFixed(2) : "N/A";

    // Pipeline breakdown: count leads per conversion status
    const statusCounts = new Map<string, number>();
    for (const l of leadList) {
      const s = ((l as any).conversion_status || (l as any).Conversion_Status || "Unknown").trim();
      statusCounts.set(s, (statusCounts.get(s) || 0) + 1);
    }
    const pipelineBreakdown = Array.from(statusCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => `  ${status}: ${count}`)
      .join("\n");

    const vars = {
      campaignName: campaign.name || "Unknown",
      campaignStatus: campaign.status || "Unknown",
      campaignDescription: (campaign as any).description || "",
      campaignCreatedAt: campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "Unknown",
      reportDate: new Date().toLocaleDateString(),
      totalLeads: String(total),
      pipelineBreakdown,
      responseRate,
      bookingRate,
      responded: String(responded),
      booked: String(booked),
      totalCost: totalCostNum.toFixed(2),
      costPerBooking,
    };

    const promptTemplate = await getOrCreateSystemPrompt(
      "campaign-summary",
      "Campaign Summary Generator",
      DEFAULT_CAMPAIGN_SUMMARY_PROMPT,
      DEFAULT_CAMPAIGN_SUMMARY_SYSTEM,
    );

    const systemMsg = (promptTemplate as any).systemMessage || DEFAULT_CAMPAIGN_SUMMARY_SYSTEM;
    const userMsg = interpolateTemplate(
      (promptTemplate as any).promptText || DEFAULT_CAMPAIGN_SUMMARY_PROMPT,
      vars,
    );

    const finalSystemMsg = languageInstruction
      ? `${systemMsg}\n\n${languageInstruction}`
      : systemMsg;

    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: finalSystemMsg },
            { role: "user", content: userMsg },
          ],
          temperature: 0.7,
          max_tokens: 600,
        }),
      });

      if (!groqRes.ok) {
        const errBody = await groqRes.text();
        console.error("[generate-summary] Groq error:", errBody);
        return res.status(500).json({ error: "Groq API error", detail: errBody });
      }

      const result = await groqRes.json() as any;
      const summary = result.choices?.[0]?.message?.content || "";
      res.json({ summary });
    } catch (e: any) {
      console.error("[generate-summary] error:", e);
      res.status(500).json({ error: e.message });
    }
  }));

  // ─── Prompt Library ───────────────────────────────────────────────

  app.get("/api/prompts", requireAgency, wrapAsync(async (req, res) => {
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const data = accountId
      ? await storage.getPromptsByAccountId(accountId)
      : await storage.getPrompts();

    // Enrich with campaign's ai_model (source of truth for model)
    const campaignIds = [...new Set(data.filter((p: any) => p.campaignsId).map((p: any) => p.campaignsId!))];
    if (campaignIds.length > 0) {
      const campaignModels = await pool.query(
        `SELECT id, ai_model FROM p2mxx34fvbf3ll6."Campaigns" WHERE id = ANY($1)`,
        [campaignIds]
      );
      const modelMap: Record<number, string> = {};
      for (const row of campaignModels.rows) {
        modelMap[row.id] = row.ai_model;
      }
      for (const prompt of data) {
        if ((prompt as any).campaignsId && modelMap[(prompt as any).campaignsId]) {
          (prompt as any).model = modelMap[(prompt as any).campaignsId];
        }
      }
    }

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

  // ─── Prompt Versions ──────────────────────────────────────────────

  app.get("/api/prompts/:id/versions", requireAgency, wrapAsync(async (req, res) => {
    const promptId = Number(req.params.id);
    const versions = await storage.getPromptVersions(promptId);
    res.json(versions);
  }));

  app.post("/api/prompts/:id/versions", requireAgency, wrapAsync(async (req, res) => {
    const promptId = Number(req.params.id);
    const bumpType = req.body.bumpType as "minor" | "major";

    const latest = await storage.getLatestPromptVersion(promptId);
    let nextVersion = "1.0";
    if (latest?.versionNumber) {
      const [major, minor] = latest.versionNumber.split(".").map(Number);
      nextVersion = bumpType === "major" ? `${major + 1}.0` : `${major}.${minor + 1}`;
    }

    const payload = {
      promptsId: promptId,
      versionNumber: nextVersion,
      promptText: req.body.promptText ?? null,
      systemMessage: req.body.systemMessage ?? null,
      notes: req.body.notes ?? null,
      savedAt: new Date(),
      savedBy: (req as any).user?.email ?? null,
      label: req.body.label ?? null,
    };

    const parsed = insertPromptVersionsSchema.partial().safeParse(payload);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const version = await storage.createPromptVersion(parsed.data as any);

    await storage.updatePrompt(promptId, { version: nextVersion });

    res.status(201).json(version);
  }));

  app.delete("/api/prompts/:id/versions/:versionId", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.versionId);
    const deleted = await storage.deletePromptVersion(id);
    if (!deleted) return res.status(404).json({ error: "Version not found" });
    res.json({ success: true });
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
  app.get("/api/dashboard-trends", requireAuth, async (req, res) => {
    try {
      const days = Math.min(Number(req.query.days) || 30, 90);
      const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;

      const allMetrics = await storage.getCampaignMetricsHistory();

      let filteredMetrics = allMetrics;
      if (accountId && accountId !== 1) {
        const accountCampaigns = await storage.getCampaigns();
        const campaignIds = accountCampaigns
          .filter((c: any) => (c.accountsId || c.accounts_id) === accountId)
          .map((c: any) => c.id);
        filteredMetrics = allMetrics.filter((m: any) =>
          campaignIds.includes(m.campaignsId || m.campaigns_id)
        );
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];

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
}
