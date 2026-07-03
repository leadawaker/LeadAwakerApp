import type { Express } from "express";
import { storage, paginatedQuery } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import {
  accounts,
  accountCommunicationProfile,
  insertAccountsSchema,
  insertAccountCommunicationProfileSchema,
  NICHE_WORD_GROUPS,
  EMPTY_NICHE_GROUPS,
  type NicheWordGroup,
  type NicheWordGroups,
} from "@shared/schema";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "../dbKeys";
import { pool } from "../db";
import { provisionCaldiyForAccount, resyncCaldiySchedule } from "../calendar/caldiy";
import { handleZodError, wrapAsync, getPagination, getEngineUrl } from "./_helpers";
import { registerProspectsRoutes } from "./prospects";
import { registerProspectsWhatsappRoutes } from "./prospectsWhatsapp";
import { registerUsersRoutes } from "./users";

export function registerAccountsRoutes(app: Express): void {
  // ─── Accounts ─────────────────────────────────────────────────────
  // Only the agency can manage accounts

  // PUBLIC (no auth): serves an account's logo as a real image so it renders in
  // emails. Account logos are stored as base64 data URIs, which most email
  // clients (Gmail/Outlook) block; this decodes them and returns proper bytes.
  // Used by Cal.diy booking emails (LA_BRAND_LOGO_URL). Falls back to the
  // LeadAwaker logo when the account has none.
  app.get("/public/account-logo/:id", wrapAsync(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const account = Number.isFinite(id) ? await storage.getAccountById(id) : null;
    const raw = (account as any)?.logoUrl as string | undefined;
    if (raw) {
      const m = /^data:(image\/[a-z0-9+.-]+);base64,(.+)$/si.exec(raw.replace(/\n/g, ""));
      if (m) {
        res.setHeader("Content-Type", m[1]);
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.send(Buffer.from(m[2], "base64"));
      }
      if (/^https?:\/\//i.test(raw)) return res.redirect(302, raw);
    }
    // No usable account logo → fall back to the LeadAwaker default logo.
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.redirect(302, "https://app.leadawaker.com/premium/logo-icon.png");
  }));

  app.get("/api/accounts", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const isAgency = user.role === "Owner" || user.role === "Admin" || user.accountsId === 1;
    if (!isAgency) {
      // Client users see only their own account
      const account = await storage.getAccountById(user.accountsId!);
      return res.json(account ? toDbKeysArray([account] as any, accounts) : []);
    }
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
    // Sub-account users can only fetch their own account (agency = accountsId 1 or Admin role)
    const isAgency = user.accountsId === 1 || user.role === "Owner" || user.role === "Admin";
    if (!isAgency && user.accountsId !== requestedId) {
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
    provisionCaldiyForAccount(account.id!);
    res.status(201).json(toDbKeys(account as any, accounts));
  }));

  app.patch("/api/accounts/:id", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertAccountsSchema.partial().safeParse(fromDbKeys(req.body, accounts));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const account = await storage.updateAccount(Number(req.params.id), parsed.data);
    if (!account) return res.status(404).json({ message: "Account not found" });
    // If working hours changed, re-sync the Cal.diy booking schedule (best-effort).
    if ("businessHoursStart" in parsed.data || "businessHoursEnd" in parsed.data) {
      void resyncCaldiySchedule(account.id!);
    }
    // If meeting type or calling number changed, re-provision so Cal.diy EventType.locations updates.
    if ("meetingType" in parsed.data || "callingNumber" in parsed.data) {
      void provisionCaldiyForAccount(account.id!);
    }
    res.json(toDbKeys(account as any, accounts));
  }));

  app.delete("/api/accounts/:id", requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    await storage.deleteCalendarConnection(accountId, "caldiy");
    const ok = await storage.deleteAccount(accountId);
    if (!ok) return res.status(404).json({ message: "Account not found" });
    res.status(204).end();
  }));

  app.post("/api/accounts/:id/test-voice", requireAgency, wrapAsync(async (req, res) => {
    const { text, language, voiceName, style } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "text is required" });
    }
    if (!language || !["en", "nl"].includes(language)) {
      return res.status(400).json({ message: "language must be en or nl" });
    }
    if (!voiceName || typeof voiceName !== "string") {
      return res.status(400).json({ message: "voiceName is required" });
    }

    const engineUrl = getEngineUrl();
    const engineRes = await fetch(`${engineUrl}/api/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_id: voiceName, text, style: style || null }),
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

  // ─── Communication Profile (onboarding wizard) ─────────────────────────

  app.get("/api/accounts/:id/communication-profile", requireAuth, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    const profile = await storage.getCommunicationProfile(accountId);
    res.json(profile ? toDbKeys(profile as any, accountCommunicationProfile) : null);
  }));

  app.put("/api/accounts/:id/communication-profile", requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    const parsed = insertAccountCommunicationProfileSchema.partial().safeParse(
      fromDbKeys(req.body, accountCommunicationProfile),
    );
    if (!parsed.success) return handleZodError(res, parsed.error);
    const profile = await storage.upsertCommunicationProfile(accountId, parsed.data);
    res.json(toDbKeys(profile as any, accountCommunicationProfile));
  }));

  // ─── Niche Vocabulary ──────────────────────────────────────────────────────

  const isValidGroup = (g: unknown): g is NicheWordGroup =>
    typeof g === "string" && (NICHE_WORD_GROUPS as readonly string[]).includes(g);

  // All saved niche rows — powers the vocabulary management table.
  app.get("/api/niche-vocabulary", requireAgency, wrapAsync(async (_req, res) => {
    res.json(await storage.listNicheVocabularies());
  }));

  // Niche names only, for the campaign settings niche picker. requireAuth
  // (not requireAgency) since non-agency client users edit campaigns too.
  app.get("/api/niches", requireAuth, wrapAsync(async (_req, res) => {
    res.json(await storage.listNicheNames());
  }));

  // Resolve a niche's terms for one language (?lang=en|nl, default nl). English
  // falls back to Dutch per-group when empty. Used by the prompt preview.
  app.get("/api/niche-vocabulary/:niche", requireAuth, wrapAsync(async (req, res) => {
    const niche = req.params.niche;
    const lang = req.query.lang === "en" ? "en" : "nl";
    const groups = await storage.getNicheVocabulary(niche, lang);
    res.json(groups);
  }));

  // Return only the three business-profile templates for a niche (requireAuth
  // so non-agency campaign users can also pre-fill on niche selection).
  app.get("/api/niche-vocabulary/:niche/template", requireAuth, wrapAsync(async (req, res) => {
    const niche = req.params.niche.trim();
    const rows = await storage.listNicheVocabularies();
    const row = rows.find((r) => r.niche === niche);
    const empty = { nl: "", en: "" };
    if (!row) return res.json({
      companyNameTemplate: empty, descriptionTemplate: empty, kbTemplate: empty,
      questionBank: empty, badExamples: empty, objectionExamples: empty, scenarioExamples: empty,
    });
    res.json({
      companyNameTemplate: row.companyNameTemplate ?? empty,
      descriptionTemplate: row.descriptionTemplate ?? empty,
      kbTemplate: row.kbTemplate ?? empty,
      questionBank: row.questionBank ?? empty,
      badExamples: row.badExamples ?? empty,
      objectionExamples: row.objectionExamples ?? empty,
      scenarioExamples: row.scenarioExamples ?? empty,
    });
  }));

  // Coerce an arbitrary object into a clean NicheWordGroups.
  const coerceGroups = (src: any): NicheWordGroups => {
    const g: NicheWordGroups = { ...EMPTY_NICHE_GROUPS };
    for (const grp of NICHE_WORD_GROUPS) {
      const arr = src?.[grp];
      g[grp] = Array.isArray(arr) ? arr.filter((w: unknown): w is string => typeof w === "string") : [];
    }
    return g;
  };

  // Replace BOTH languages for a niche (management save / new-niche seed).
  // Body: { nl: NicheWordGroups, en: NicheWordGroups }.
  app.put("/api/niche-vocabulary/:niche", requireAgency, wrapAsync(async (req, res) => {
    const niche = req.params.niche.trim();
    if (!niche) return res.status(400).json({ error: "niche is required" });
    const body = req.body ?? {};
    const both = { nl: coerceGroups(body.nl), en: coerceGroups(body.en) };
    res.json(await storage.setNicheVocabulary(niche, both));
  }));

  app.delete("/api/niche-vocabulary/:niche", requireAgency, wrapAsync(async (req, res) => {
    const ok = await storage.deleteNicheVocabulary(req.params.niche);
    if (!ok) return res.status(400).json({ error: "cannot delete this niche" });
    res.json({ ok: true });
  }));

  const isValidLang = (l: unknown): l is "en" | "nl" => l === "en" || l === "nl";

  // Add/remove a single word in one language. Returns { nl, en } for both langs.
  app.post("/api/niche-vocabulary/:niche/words", requireAgency, wrapAsync(async (req, res) => {
    const niche = req.params.niche;
    const { group, word, lang } = req.body;
    if (!isValidGroup(group) || !word || typeof word !== "string") {
      return res.status(400).json({ error: "valid group and word are required" });
    }
    const l = isValidLang(lang) ? lang : "nl";
    res.json(await storage.addNicheWord(niche, l, group, word.trim()));
  }));

  app.delete("/api/niche-vocabulary/:niche/words", requireAgency, wrapAsync(async (req, res) => {
    const niche = req.params.niche;
    const { group, word, lang } = req.body;
    if (!isValidGroup(group) || !word || typeof word !== "string") {
      return res.status(400).json({ error: "valid group and word are required" });
    }
    const l = isValidLang(lang) ? lang : "nl";
    res.json(await storage.deleteNicheWord(niche, l, group, word));
  }));

  // Patch the business-profile templates + example packs for a niche. Called
  // when a campaign saves its company_name / description / kb fields (so the
  // niche template stays in sync for future campaigns) or when the Niche
  // Words editor saves prompt 93's example packs.
  // Body: { companyNameTemplate?, descriptionTemplate?, kbTemplate?, questionBank?,
  //   badExamples?, objectionExamples?, scenarioExamples? } each { nl, en }.
  app.patch("/api/niche-vocabulary/:niche/template", requireAgency, wrapAsync(async (req, res) => {
    const niche = req.params.niche.trim();
    if (!niche) return res.status(400).json({ error: "niche is required" });
    const clean = (v: unknown) => {
      if (!v || typeof v !== "object") return undefined;
      const o = v as Record<string, unknown>;
      return { nl: String(o.nl ?? ""), en: String(o.en ?? "") };
    };
    await storage.setNicheTemplate(niche, {
      companyNameTemplate: clean(req.body?.companyNameTemplate),
      descriptionTemplate: clean(req.body?.descriptionTemplate),
      kbTemplate: clean(req.body?.kbTemplate),
      questionBank: clean(req.body?.questionBank),
      badExamples: clean(req.body?.badExamples),
      objectionExamples: clean(req.body?.objectionExamples),
      scenarioExamples: clean(req.body?.scenarioExamples),
    });
    res.json({ ok: true });
  }));

  registerProspectsRoutes(app);
  registerProspectsWhatsappRoutes(app);
  registerUsersRoutes(app);
}

