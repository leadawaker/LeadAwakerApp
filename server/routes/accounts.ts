import type { Express } from "express";
import { storage, paginatedQuery } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import {
  accounts,
  prospects,
  interactions,
  outreachTemplates,
  insertAccountsSchema,
  insertProspectsSchema,
  insertOutreachTemplatesSchema,
  users,
  insertUsersSchema,
} from "@shared/schema";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "../dbKeys";
import { pool } from "../db";
import { handleZodError, wrapAsync, getPagination, getEngineUrl, frontendBaseUrl, setFrontendUrlWarned } from "./_helpers";
import { storage as storageImport } from "../storage";
import { sendInviteEmail } from "../email";
import { broadcast } from "../sse";
import { sendWhatsAppCloudImage } from "../channel-sender";
import crypto from "crypto";
import { buildOutreachPrompt } from "../outreachStyles";

/**
 * Normalize a phone number to E.164 digits-only format.
 * Strips all non-digits, validates minimum length (7) and maximum (15).
 * Returns null if the number is invalid.
 */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

export function registerAccountsRoutes(app: Express): void {
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

  app.get("/api/accounts/:id", requireAuth, wrapAsync(async (req, res) => {
    const requestedId = Number(req.params.id);
    const user = req.user!;
    // Sub-account users can only fetch their own account
    if (user.role !== "Agency" && user.accountsId !== requestedId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const account = await storage.getAccountById(requestedId);
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

  app.post("/api/accounts/:id/clone-voice", requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    const { audioDataUrl, language, fileName } = req.body;
    if (!audioDataUrl || !language || !["en", "pt", "nl"].includes(language)) {
      return res.status(400).json({ message: "audioDataUrl, language (en|pt|nl), and fileName required" });
    }
    const account = await storage.getAccountById(accountId);
    if (!account) return res.status(404).json({ message: "Account not found" });

    const engineUrl = getEngineUrl();
    const engineRes = await fetch(`${engineUrl}/api/voice/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_data_url: audioDataUrl,
        filename: fileName,
        language,
        account_id: accountId,
        account_name: (account as any).name ?? `Account ${accountId}`,
        account_photo_url: (account as any).logoUrl ?? (account as any).logo_url ?? null,
      }),
    });
    if (!engineRes.ok) {
      const errText = await engineRes.text();
      return res.status(502).json({ message: "Voice cloning failed", error: errText });
    }
    const result = await engineRes.json() as { success: boolean; model_id?: string; error?: string };
    if (!result.success) {
      return res.status(400).json({ message: result.error || "Voice cloning failed" });
    }
    const fieldMap = { en: "ttsVoiceIdEn", pt: "ttsVoiceIdPt", nl: "ttsVoiceIdNl" } as const;
    const field = fieldMap[language as "en" | "pt" | "nl"];
    await storage.updateAccount(accountId, { [field]: result.model_id } as any);
    res.json({ success: true, model_id: result.model_id, language });
  }));

  app.post("/api/accounts/:id/test-voice", requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    const { text, language } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "text is required" });
    }
    if (!language || !["en", "pt", "nl"].includes(language)) {
      return res.status(400).json({ message: "language must be en, pt, or nl" });
    }
    const account = await storage.getAccountById(accountId);
    if (!account) return res.status(404).json({ message: "Account not found" });

    const voiceFieldMap = { en: "ttsVoiceIdEn", pt: "ttsVoiceIdPt", nl: "ttsVoiceIdNl" } as const;
    const voiceField = voiceFieldMap[language as "en" | "pt" | "nl"];
    const voiceId = (account as any)[voiceField];
    if (!voiceId) {
      return res.status(400).json({ message: `No cloned voice for language: ${language}` });
    }

    const engineUrl = getEngineUrl();
    const engineRes = await fetch(`${engineUrl}/api/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_id: voiceId, text }),
    });
    if (!engineRes.ok) {
      const errText = await engineRes.text();
      return res.status(502).json({ message: "Voice synthesis failed", error: errText });
    }
    const result = await engineRes.json() as { success: boolean; audio_url?: string; error?: string };
    if (!result.success) {
      return res.status(400).json({ message: result.error || "Voice synthesis failed" });
    }
    res.json({ success: true, audio_url: result.audio_url });
  }));

  app.post("/api/accounts/:id/sync-instagram", requireAgency, wrapAsync(async (req, res) => {
    const account = await storage.getAccountById(Number(req.params.id));
    if (!account) return res.status(404).json({ message: "Account not found" });
    const engineUrl = getEngineUrl();
    try {
      const engineRes = await fetch(`${engineUrl}/api/accounts/${req.params.id}/sync-instagram-contacts`, { method: "POST" });
      const data = await engineRes.json();
      res.status(engineRes.status).json(data);
    } catch {
      res.status(502).json({ message: "Could not reach automation engine" });
    }
  }));

  // ─── Knowledge Base ────────────────────────────────────────────────

  const KB_TABLE = 'p2mxx34fvbf3ll6."Account_Knowledge_Base"';

  app.get("/api/accounts/:id/knowledge", requireAuth, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT id, account_id AS "accountId", category, title, content, campaign_ids AS "campaignIds", min_inbound_messages AS "minInboundMessages", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM ${KB_TABLE} WHERE account_id = $1 ORDER BY category, id`, [accountId]
    );
    res.json(rows);
  }));

  app.post("/api/accounts/:id/knowledge", requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    const { category, title, content, campaignIds, minInboundMessages } = req.body;
    if (!category || !title || !content) return res.status(400).json({ message: "category, title, and content are required" });
    const { rows } = await pool.query(
      `INSERT INTO ${KB_TABLE} (account_id, category, title, content, campaign_ids, min_inbound_messages, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id, account_id AS "accountId", category, title, content, campaign_ids AS "campaignIds", min_inbound_messages AS "minInboundMessages"`,
      [accountId, category, title, content, campaignIds !== undefined ? campaignIds : null, minInboundMessages ?? null]
    );
    res.status(201).json(rows[0]);
  }));

  app.patch("/api/accounts/:id/knowledge/:kbId", requireAgency, wrapAsync(async (req, res) => {
    const kbId = Number(req.params.kbId);
    const { category, title, content } = req.body;
    const hasCampaignIds = 'campaignIds' in req.body;
    const campaignIdsValue = req.body.campaignIds ?? null;
    const hasMinInbound = 'minInboundMessages' in req.body;
    const minInboundValue = req.body.minInboundMessages ?? null;
    const { rows } = await pool.query(
      hasCampaignIds && hasMinInbound
        ? `UPDATE ${KB_TABLE} SET category = COALESCE($1, category), title = COALESCE($2, title),
           content = COALESCE($3, content), campaign_ids = $4, min_inbound_messages = $5, updated_at = NOW()
           WHERE id = $6 RETURNING id, account_id AS "accountId", category, title, content, campaign_ids AS "campaignIds", min_inbound_messages AS "minInboundMessages"`
        : hasCampaignIds
        ? `UPDATE ${KB_TABLE} SET category = COALESCE($1, category), title = COALESCE($2, title),
           content = COALESCE($3, content), campaign_ids = $4, updated_at = NOW()
           WHERE id = $5 RETURNING id, account_id AS "accountId", category, title, content, campaign_ids AS "campaignIds", min_inbound_messages AS "minInboundMessages"`
        : hasMinInbound
        ? `UPDATE ${KB_TABLE} SET category = COALESCE($1, category), title = COALESCE($2, title),
           content = COALESCE($3, content), min_inbound_messages = $4, updated_at = NOW()
           WHERE id = $5 RETURNING id, account_id AS "accountId", category, title, content, campaign_ids AS "campaignIds", min_inbound_messages AS "minInboundMessages"`
        : `UPDATE ${KB_TABLE} SET category = COALESCE($1, category), title = COALESCE($2, title),
           content = COALESCE($3, content), updated_at = NOW()
           WHERE id = $4 RETURNING id, account_id AS "accountId", category, title, content, campaign_ids AS "campaignIds", min_inbound_messages AS "minInboundMessages"`,
      hasCampaignIds && hasMinInbound ? [category, title, content, campaignIdsValue, minInboundValue, kbId]
        : hasCampaignIds ? [category, title, content, campaignIdsValue, kbId]
        : hasMinInbound ? [category, title, content, minInboundValue, kbId]
        : [category, title, content, kbId]
    );
    if (!rows.length) return res.status(404).json({ message: "KB entry not found" });
    res.json(rows[0]);
  }));

  app.delete("/api/accounts/:id/knowledge/:kbId", requireAgency, wrapAsync(async (req, res) => {
    const kbId = Number(req.params.kbId);
    await pool.query(`DELETE FROM ${KB_TABLE} WHERE id = $1`, [kbId]);
    res.json({ ok: true });
  }));

  // ─── Prospects ───────────────────────────────────────────────────────

  app.get("/api/prospects", requireAgency, wrapAsync(async (req, res) => {
    const pagination = getPagination(req);
    if (pagination) {
      const result = await paginatedQuery(prospects, pagination);
      return res.json({ ...result, data: toDbKeysArray(result.data as any, prospects) });
    }
    const data = await storage.getProspects();
    res.json(toDbKeysArray(data as any, prospects));
  }));

  // Prospect conversations (must be before :id route)
  app.get("/api/prospects/conversations", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const result = await storage.getProspectConversations();
    res.json(result);
  }));

  app.get("/api/prospects/:id/messages", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const result = await storage.getProspectMessages(prospectId, limit, offset);
    res.json(result);
  }));

  app.get("/api/prospects/:id", requireAgency, wrapAsync(async (req, res) => {
    const prospect = await storage.getProspectById(Number(req.params.id));
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });
    res.json(toDbKeys(prospect as any, prospects));
  }));

  app.post("/api/prospects", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertProspectsSchema.safeParse(fromDbKeys(req.body, prospects));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const prospect = await storage.createProspect(parsed.data);
    res.status(201).json(toDbKeys(prospect as any, prospects));
  }));

  app.patch("/api/prospects/:id", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertProspectsSchema.partial().safeParse(fromDbKeys(req.body, prospects));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const prospect = await storage.updateProspect(Number(req.params.id), parsed.data);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    // Auto-set contacted timestamps when moving to "contacted" for the first time
    const incomingStatus = req.body.outreach_status ?? req.body.outreachStatus;
    if (incomingStatus === "contacted" && !prospect.firstContactedAt) {
      const now = new Date();
      const followUp = new Date();
      followUp.setDate(followUp.getDate() + 3);
      await storage.updateProspect(Number(req.params.id), {
        firstContactedAt: now,
        lastContactedAt: now,
        followUpCount: 1,
        nextFollowUpDate: followUp,
      });
    }

    // Auto-create task when outreach_status changes
    if (incomingStatus) {
      const statusTaskMap: Record<string, { title: string; dueDays: number }> = {
        contacted:     { title: `Follow up with ${prospect.company || prospect.name || 'prospect'}`, dueDays: 3 },
        call_booked:   { title: `Call with ${prospect.company || prospect.name || 'prospect'}`, dueDays: 3 },
        demo_given:    { title: `Send proposal to ${prospect.company || prospect.name || 'prospect'}`, dueDays: 2 },
        proposal_sent: { title: `Follow up on proposal: ${prospect.company || prospect.name || 'prospect'}`, dueDays: 5 },
        deal_closed:   { title: `Onboard ${prospect.company || prospect.name || 'prospect'} — set up campaign`, dueDays: 3 },
      };
      const taskDef = statusTaskMap[incomingStatus];
      if (taskDef) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + taskDef.dueDays);
        const niche = prospect.niche || "General";
        try {
          await storage.createTask({
            title: taskDef.title,
            status: "todo",
            priority: prospect.priority || "medium",
            tags: JSON.stringify(["Outreach", niche]),
            accountsId: 1,
            parentTaskId: 176,
            dueDate,
            taskType: "follow_up",
          });
        } catch (err) {
          console.error("[Auto-Task] Failed to create task for prospect status change:", err);
        }
      }
    }

    res.json(toDbKeys(prospect as any, prospects));
  }));

  app.post("/api/prospects/:id/convert-to-account", requireAgency, wrapAsync(async (req, res) => {
    const prospect = await storage.getProspectById(Number(req.params.id));
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });
    if (prospect.accountsId) return res.status(400).json({ message: "Prospect already linked to an account" });

    // Check if an account with the same name already exists
    const accountName = prospect.company || prospect.name || "Unnamed Account";
    const existingAccounts = await storage.getAccounts();
    const duplicate = existingAccounts.find((a: any) => (a.name || "").toLowerCase().trim() === accountName.toLowerCase().trim());
    if (duplicate) {
      // Link to existing account instead of creating a new one
      const updatedProspect = await storage.updateProspect(Number(req.params.id), {
        accountsId: duplicate.id,
        status: "Converted",
      });
      return res.json({
        account: toDbKeys(duplicate as any, accounts),
        prospect: toDbKeys(updatedProspect as any, prospects),
        linked_existing: true,
      });
    }

    // Create account from prospect data
    const account = await storage.createAccount({
      name: prospect.company || prospect.name || "Unnamed Account",
      phone: prospect.phone || prospect.contactPhone || null,
      website: prospect.website || null,
      ownerEmail: prospect.contactEmail || prospect.email || null,
      status: "trial",
      businessNiche: prospect.niche || null,
    });

    // Link prospect to the new account and set status to Converted
    const updatedProspect = await storage.updateProspect(Number(req.params.id), {
      accountsId: account.id,
      status: "Converted",
    });

    res.json({
      account: toDbKeys(account as any, accounts),
      prospect: toDbKeys(updatedProspect as any, prospects),
    });
  }));

  // ─── Prospect Enrichment ────────────────────────────────────────
  app.post("/api/prospects/:id/enrich", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { type, contactSlot } = req.body as { type?: "website" | "linkedin" | "both"; contactSlot?: 1 | 2 };
    if (!type || !["website", "linkedin", "both"].includes(type)) {
      return res.status(400).json({ message: "type must be 'website', 'linkedin', or 'both'" });
    }

    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const results: { website?: string; linkedin?: any } = {};
    const slot = contactSlot ?? 1;

    const spawnWebsiteEnricher = async () => {
      const { spawn } = await import("child_process");
      const args = ["-m", "tools.prospect_enricher", "--prospect-id", String(prospectId), "--force"];
      if (slot === 2) args.push("--contact-slot", "2");
      const child = spawn("/home/gabriel/automations/.venv/bin/python3", args, {
        cwd: "/home/gabriel/automations", detached: true, stdio: "ignore",
      });
      child.unref();
      results.website = "started";
    };

    if (type === "both") {
      // Run LinkedIn first so Python enricher can read the data from DB
      try {
        const { enrichLinkedIn } = await import("../linkedinEnricher");
        results.linkedin = await enrichLinkedIn(prospectId, slot);
      } catch (err: any) {
        console.error("[Enrich] LinkedIn error:", err.message);
        results.linkedin = { error: err.message };
      }
      // Then spawn website enricher (reads LinkedIn data from DB)
      await spawnWebsiteEnricher();
    } else if (type === "website") {
      await spawnWebsiteEnricher();
    } else if (type === "linkedin") {
      try {
        const { enrichLinkedIn } = await import("../linkedinEnricher");
        results.linkedin = await enrichLinkedIn(prospectId, slot);
      } catch (err: any) {
        console.error("[Enrich] LinkedIn error:", err.message);
        results.linkedin = { error: err.message };
      }
    }

    res.json({ ok: true, results });
  }));

  // ─── Outreach Message Generation ─────────────────────────────────
  app.post("/api/prospects/:id/generate-messages", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { style, format, language = "en", offer, contact, customInstructions } = req.body;

    if (!style || !format) {
      return res.status(400).json({ message: "style and format are required" });
    }

    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });
    // Enrichment is optional: generate messages even without aiSummary (less context)

    const { interactions } = await storage.getInteractionsByProspectId(prospectId, 10);

    const prompt = buildOutreachPrompt(prospect, style, format, language, interactions.map(i => ({
      content: i.content || "",
      direction: i.direction || "outbound",
      sentAt: i.sentAt,
    })), { selectedOffer: offer, selectedContact: contact, customInstructions });

    const { execFile } = await import("child_process");
    const CLAUDE_BIN = "/home/gabriel/.npm-global/bin/claude";

    const result = await new Promise<string>((resolve, reject) => {
      execFile(CLAUDE_BIN, ["-p", prompt, "--model", "sonnet", "--max-turns", "1"],
        { timeout: 120000, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        }
      );
    });

    // Strip markdown fences if present (claude sometimes wraps JSON)
    let cleaned = result.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const newMessages: Array<{ title: string; text: string }> = JSON.parse(cleaned);

    // Merge with existing saved messages: keep favorites, replace non-favorites
    let existing: Array<{ title: string; text: string; saved?: boolean }> = [];
    try {
      if (prospect.generatedMessages) existing = JSON.parse(prospect.generatedMessages);
    } catch { /* ignore */ }

    const favorites = existing.filter(m => m.saved);
    const merged = [...favorites, ...newMessages.map(m => ({ ...m, saved: false }))];
    await storage.updateProspect(prospectId, { generatedMessages: JSON.stringify(merged) });

    res.json({ messages: merged });
  }));

  // ─── Append Offer Idea (AI-generated) ────────────────────────────
  app.post("/api/prospects/:id/append-offer", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { count } = req.body as { count?: number };
    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    // Parse existing offers (handles both string[] and {text,checked}[] formats)
    let existingOffers: Array<{ text: string; checked?: boolean }> = [];
    try {
      if (prospect.offerIdeas) {
        const parsed = JSON.parse(prospect.offerIdeas);
        if (Array.isArray(parsed)) {
          existingOffers = parsed.map((item: any) =>
            typeof item === "string" ? { text: item } : { text: item.text, checked: item.checked }
          );
        }
      }
    } catch {
      existingOffers = [];
    }

    const existingTexts = existingOffers.map(o => o.text);
    const companyName = prospect.company || prospect.name || "this company";
    const niche = prospect.niche ? ` in the ${prospect.niche} industry` : "";
    const summary = prospect.aiSummary ? `\nCompany summary: ${prospect.aiSummary}` : "";
    const pageSummaries = prospect.pageSummaries ? `\nWebsite research: ${String(prospect.pageSummaries).slice(0, 1500)}` : "";
    const numToGenerate = count ?? (existingOffers.length === 0 ? 5 : 1);
    const existingBlock = existingTexts.length > 0
      ? `\nExisting offers (do NOT repeat these): ${existingTexts.join("; ")}`
      : "";

    const prompt = `You are generating offer ideas for Lead Awaker, an AI lead reactivation agency. Lead Awaker uses AI to reactivate dead/old leads via WhatsApp conversations, automate intake/booking, and handle after-hours inquiries.

Company: ${companyName}${niche}${summary}${pageSummaries}${existingBlock}

Generate exactly ${numToGenerate} unique offer idea${numToGenerate > 1 ? "s" : ""} for how Lead Awaker could help ${companyName}. Each offer should reference something specific about their business.
Format: one offer per line, each as "Title: description". No numbering, no quotes, no extra text.
Return ONLY the offer lines, nothing else.`;

    const { execFile } = await import("child_process");
    const CLAUDE_BIN = "/home/gabriel/.npm-global/bin/claude";

    const result = await new Promise<string>((resolve, reject) => {
      execFile(CLAUDE_BIN, ["-p", prompt, "--model", "haiku", "--max-turns", "1"],
        { timeout: 60000, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        }
      );
    });

    const newOfferTexts = result.trim().split("\n").map(l => l.replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean);
    const newOffers = newOfferTexts.map(text => ({ text, checked: false }));

    const updatedOffers = [...existingOffers, ...newOffers];
    await storage.updateProspect(prospectId, { offerIdeas: JSON.stringify(updatedOffers) });

    res.json({ offers: newOfferTexts });
  }));

  app.post("/api/prospects/:id/whatsapp/send", (req, res, next) => {
    console.log(`[WA-Send-PRE] prospect=${req.params.id} auth=${req.isAuthenticated()} user=${(req.user as any)?.id} role=${(req.user as any)?.role} acctId=${(req.user as any)?.accountsId}`);
    next();
  }, requireAgency, wrapAsync(async (req, res) => {
    console.log(`[WA-Send] prospect=${req.params.id} body=`, JSON.stringify(req.body).slice(0, 200));
    const prospectId = Number(req.params.id);
    const { message } = req.body as { message?: string };

    if (!message?.trim()) {
      return res.status(400).json({ message: "message is required" });
    }

    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const phone = normalizePhone((prospect as any).phone || (prospect as any).contactPhone);
    if (!phone) {
      return res.status(400).json({ message: "Prospect has no valid phone number", code: "invalid_phone" });
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    let sendStatus: string = "queued";

    if (token && phoneNumberId) {
      const waRes = await fetch(
        `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body: message.trim() },
          }),
        }
      );
      if (!waRes.ok) {
        const err = await waRes.json().catch(() => ({}));
        // Meta error 131047 = message outside 24-hour customer service window
        const errorCode = err?.error?.code;
        if (errorCode === 131047) {
          return res.status(422).json({ message: "WhatsApp 24-hour window expired", code: "window_expired", detail: err });
        }
        return res.status(502).json({ message: "WhatsApp API error", detail: err });
      }
      sendStatus = "sent";
    }

    const interaction = await storage.createInteraction({
      prospectId,
      accountsId: 1,
      content: message.trim(),
      type: "whatsapp",
      direction: "outbound",
      status: sendStatus,
      sentAt: new Date(),
    });

    const responseBody = toDbKeys(interaction as any, interactions);
    broadcast(1, "new_interaction", responseBody);

    res.status(201).json({ interaction: responseBody });
  }));

  // Typing indicator — best-effort, always returns 200
  app.post("/api/prospects/:id/whatsapp/typing", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const phone = normalizePhone((prospect as any).phone || (prospect as any).contactPhone);
    if (!phone) return res.status(400).json({ message: "Prospect has no phone number" });

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (token && phoneNumberId) {
      // Fire-and-forget — typing indicators are best-effort
      fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "typing",
          typing: { duration: 25000 },
        }),
      }).catch(() => {});
    }
    res.status(200).json({ ok: true });
  }));

  app.post("/api/prospects/:id/whatsapp/send-image", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { imageData, mimeType, caption } = req.body as { imageData?: string; mimeType?: string; caption?: string };

    if (!imageData || !mimeType) {
      return res.status(400).json({ message: "imageData and mimeType are required" });
    }

    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const phone = normalizePhone((prospect as any).phone || (prospect as any).contactPhone);
    if (!phone) {
      return res.status(400).json({ message: "Prospect has no valid phone number", code: "invalid_phone" });
    }

    const result = await sendWhatsAppCloudImage(phone, imageData, mimeType, caption);
    if (!result.success) {
      const errMsg = result.error ?? "Failed to send image";
      if (errMsg.includes("131047")) {
        return res.status(422).json({ message: "WhatsApp 24-hour window expired", code: "window_expired" });
      }
      return res.status(502).json({ message: errMsg });
    }

    const interaction = await storage.createInteraction({
      prospectId,
      accountsId: 1,
      content: caption || "[Image]",
      type: "whatsapp",
      direction: "outbound",
      status: "sent",
      sentAt: new Date(),
      attachment: imageData,
    });

    const responseBody = toDbKeys(interaction as any, interactions);
    broadcast(1, "new_interaction", responseBody);

    res.status(201).json({ interaction: responseBody });
  }));

  // ─── WhatsApp Message Templates (Meta) ───────────────────────────

  app.get("/api/whatsapp/templates", requireAgency, wrapAsync(async (req, res) => {
    const token = process.env.WHATSAPP_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    if (!token || !wabaId) {
      return res.status(500).json({ message: "WhatsApp Business Account not configured" });
    }
    const metaRes = await fetch(
      `https://graph.facebook.com/v22.0/${wabaId}/message_templates?limit=50&status=APPROVED`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      return res.status(502).json({ message: "Failed to fetch templates", detail: err });
    }
    const { data } = await metaRes.json() as { data: any[] };
    const templates = data.map((t: any) => ({
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      components: t.components,
    }));
    res.json(templates);
  }));

  app.post("/api/prospects/:id/whatsapp/send-template", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { templateName, languageCode, variables } = req.body as {
      templateName?: string;
      languageCode?: string;
      variables?: { body?: string[]; header?: string[]; button?: string[] };
    };

    if (!templateName || !languageCode) {
      return res.status(400).json({ message: "templateName and languageCode are required" });
    }

    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const phone = normalizePhone((prospect as any).phone || (prospect as any).contactPhone);
    if (!phone) {
      return res.status(400).json({ message: "Prospect has no valid phone number", code: "invalid_phone" });
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      return res.status(500).json({ message: "WhatsApp not configured" });
    }

    // Build components array from variables
    const components: any[] = [];
    if (variables?.header?.length) {
      components.push({
        type: "header",
        parameters: variables.header.map((v) => ({ type: "text", text: v })),
      });
    }
    if (variables?.body?.length) {
      components.push({
        type: "body",
        parameters: variables.body.map((v) => ({ type: "text", text: v })),
      });
    }
    if (variables?.button?.length) {
      components.push({
        type: "button",
        sub_type: "url",
        index: 0,
        parameters: variables.button.map((v) => ({ type: "text", text: v })),
      });
    }

    const waRes = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            ...(components.length > 0 ? { components } : {}),
          },
        }),
      }
    );

    if (!waRes.ok) {
      const err = await waRes.json().catch(() => ({}));
      return res.status(502).json({ message: "WhatsApp API error", detail: err });
    }

    // Build a human-readable content string for the interaction log
    const bodyVars = variables?.body?.join(", ") || "";
    const content = `[Template: ${templateName} (${languageCode})]${bodyVars ? ` Variables: ${bodyVars}` : ""}`;

    const interaction = await storage.createInteraction({
      prospectId,
      accountsId: 1,
      content,
      type: "whatsapp",
      direction: "outbound",
      status: "sent",
      sentAt: new Date(),
    });

    const responseBody = toDbKeys(interaction as any, interactions);
    broadcast(1, "new_interaction", responseBody);

    res.status(201).json({ interaction: responseBody });
  }));

  app.delete("/api/prospects/:id", requireAgency, wrapAsync(async (req, res) => {
    const ok = await storage.deleteProspect(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Prospect not found" });
    res.status(204).end();
  }));

  // ─── Outreach Templates ──────────────────────────────────────────

  app.get("/api/outreach-templates", requireAgency, wrapAsync(async (req, res) => {
    const data = await storage.getOutreachTemplates();
    res.json(toDbKeysArray(data as any, outreachTemplates));
  }));

  app.get("/api/outreach-templates/:id", requireAgency, wrapAsync(async (req, res) => {
    const tpl = await storage.getOutreachTemplateById(Number(req.params.id));
    if (!tpl) return res.status(404).json({ message: "Template not found" });
    res.json(toDbKeys(tpl as any, outreachTemplates));
  }));

  app.post("/api/outreach-templates", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertOutreachTemplatesSchema.safeParse(fromDbKeys(req.body, outreachTemplates));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const tpl = await storage.createOutreachTemplate(parsed.data);
    res.status(201).json(toDbKeys(tpl as any, outreachTemplates));
  }));

  app.patch("/api/outreach-templates/:id", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertOutreachTemplatesSchema.partial().safeParse(fromDbKeys(req.body, outreachTemplates));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const tpl = await storage.updateOutreachTemplate(Number(req.params.id), parsed.data);
    if (!tpl) return res.status(404).json({ message: "Template not found" });
    res.json(toDbKeys(tpl as any, outreachTemplates));
  }));

  app.delete("/api/outreach-templates/:id", requireAgency, wrapAsync(async (req, res) => {
    const ok = await storage.deleteOutreachTemplate(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Template not found" });
    res.status(204).end();
  }));

  // ─── Users ────────────────────────────────────────────────────────
  // (users routes relate to account management and invites)

  app.get("/api/users", requireAuth, wrapAsync(async (req, res) => {
    const sessionUser = req.user!;
    const allUsers = await storage.getAppUsers();
    // Agency users (Admin/Operator on account 1) see all users;
    // sub-account users only see users from their own account.
    const isAgency = sessionUser.accountsId === 1 || sessionUser.role === "Admin";
    const data = isAgency
      ? allUsers
      : allUsers.filter((u: any) => u.accountsId === sessionUser.accountsId);
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
      const sessionUser = req.user!;
      const targetId = Number(req.params.id);
      if (sessionUser.role !== "Admin" && sessionUser.id !== targetId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const rawBody = { ...req.body };
      if (sessionUser.role !== "Admin") {
        delete rawBody.role;
        delete rawBody.status;
        delete rawBody.accountsId;
        delete rawBody.Accounts_id;
      }
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
      res.status(500).json({ message: "Failed to revoke invite", error: err.message });
    }
  });
}
