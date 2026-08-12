import type { Express, Request } from "express";
import { z } from "zod";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAuth, requireAgency } from "../auth";
import {
  DEMO_CAMPAIGNS,
  UNIVERSAL_DEMO_CAMPAIGN_ID,
  isValidDemoCampaignId,
  isDemoCampaign,
  checkRateLimit,
  generateToken,
  createPendingDemoLead,
  buildWhatsAppLink,
  buildDemoPageLink,
  generateNicheContext,
  buildFallbackNicheContext,
  buildSolarNicheContext,
} from "../demo-session";
// The Clients library. Deliberately NOT wired into /create-session: that form
// is anonymous public traffic, and one row per curious visitor would bury the
// personas Gabriel actually minted for a prospect (decided 2026-08-11).
import {
  saveDemoClient,
  listDemoClients,
  getDemoClient,
  demoClientToContext,
  demoClientToEditable,
  updateDemoClient,
  deleteDemoClient,
  duplicateDemoClient,
} from "../demo-clients";

const createSessionSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  // Language picked on the form IS the lead's language. Lets one campaign
  // (e.g. English "Solar") serve prospects in NL/PT without duplicating the
  // campaign. The AI + First_Message render in this language at runtime.
  language: z.enum(["en", "nl", "pt"]),
  campaignId: z.number().int(),
});

// Universal (website) flow: free-text niche instead of fixed campaignId
const universalSessionSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  niche: z.string().trim().min(3).max(300),
  language: z.enum(["en", "nl", "pt"]),
  // Scenario toggle → Prompt 98 lead_stage. Optional; defaults to "inquired".
  scenario: z.enum(["inquired", "deciding", "declined"]).optional().default("inquired"),
  // Solar landing page: skip the LLM and use the curated context instead.
  preset: z.enum(["solar"]).optional(),
  // The visitor's own firm, so the demo AI opens in their name.
  companyName: z.string().trim().max(120).optional(),
  // The market the landing page already resolved for this visitor (window.MARKET
  // in client/public/premium/config.jsx: the /uk and /us paths win, then ?m=,
  // then the geo value middleware.ts injects). The page has priced everything on
  // screen in that market's currency by the time this form is submitted, so
  // sending it keeps the demo from quoting in a different one.
  market: z.enum(["uk", "us", "nl"]).optional(),
});

/** Saved Client backing the solar landing page, per market. Data rather than a
 *  hardcoded context, so the persona is editable from the Clients tab without a
 *  deploy, and so it stays consistent with the currency work.
 *
 *  A market with no entry (or a row that has been deleted) falls through to
 *  buildSolarNicheContext(), which quotes no money and is safe anywhere. */
const SOLAR_CLIENT_BY_MARKET: Partial<Record<"uk" | "us" | "nl", string>> = {
  nl: "solar energy installer",
  uk: "solar energy installer uk",
  us: "solar energy installer us",
};

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function registerDemoRoutes(app: Express): void {
  app.get("/api/demo/campaigns", (_req, res) => {
    res.json({ campaigns: DEMO_CAMPAIGNS });
  });

  // ── The Clients library ──────────────────────────────────────────────────
  // Saved demo personas, for the Clients tab and the Share dialog's picker.
  // requireAgency, not requireAuth: Niche_Vocabulary is a GLOBAL table with no
  // accountsId, and it holds the curated niche packs that real campaigns merge
  // in. Under requireAuth any logged-in client user could read every prospect
  // persona and edit shared vocabulary. This matches the client-side gate,
  // where the tab itself is behind isAgencyUser.
  app.get(
    "/api/demo/clients",
    requireAgency,
    wrapAsync(async (_req, res) => {
      res.json({ clients: await listDemoClients() });
    }),
  );

  // One Client, in editable shape: raw slots with no language fallback applied,
  // so the editor shows what is stored rather than what a reader resolves to.
  app.get(
    "/api/demo/clients/:niche",
    requireAgency,
    wrapAsync(async (req, res) => {
      const row = await getDemoClient(String(req.params.niche));
      if (!row) return res.status(404).json({ message: "No such Client." });
      res.json({ client: demoClientToEditable(row) });
    }),
  );

  const clientPatchSchema = z.object({
    text: z.record(z.record(z.string())).optional(),
    terms: z.record(z.record(z.array(z.string()))).optional(),
    bookingModeCall: z.boolean().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    emoji: z.string().trim().max(8).nullable().optional(),
  });

  app.patch(
    "/api/demo/clients/:niche",
    requireAgency,
    wrapAsync(async (req, res) => {
      const parsed = clientPatchSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const ok = await updateDemoClient(String(req.params.niche), parsed.data as never);
      if (!ok) return res.status(404).json({ message: "No such Client." });
      const row = await getDemoClient(String(req.params.niche));
      res.json({ client: row ? demoClientToEditable(row) : null });
    }),
  );

  app.delete(
    "/api/demo/clients/:niche",
    requireAgency,
    wrapAsync(async (req, res) => {
      const result = await deleteDemoClient(String(req.params.niche));
      if (result === "missing") return res.status(404).json({ message: "No such Client." });
      if (result === "curated") {
        return res.status(409).json({
          message:
            "That niche is shared vocabulary, not a saved Client. Real campaigns read its word lists, so it cannot be deleted here.",
        });
      }
      res.json({ ok: true });
    }),
  );

  const duplicateSchema = z.object({
    newNiche: z.string().trim().min(1).max(300),
  });

  app.post(
    "/api/demo/clients/:niche/duplicate",
    requireAgency,
    wrapAsync(async (req, res) => {
      const parsed = duplicateSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const result = await duplicateDemoClient(String(req.params.niche), parsed.data.newNiche);
      if (!result.ok) {
        if (result.reason === "missing") return res.status(404).json({ message: "No such Client." });
        return res.status(409).json({
          message: `A Client named "${parsed.data.newNiche.trim()}" already exists.`,
        });
      }
      res.json({ client: demoClientToEditable(result.row) });
    }),
  );

  app.post(
    "/api/demo/create-session",
    wrapAsync(async (req, res) => {
      const ip = clientIp(req);
      const gate = checkRateLimit(ip);
      if (!gate.ok) {
        const msg =
          gate.reason === "global"
            ? "Demo is at capacity right now. Try again in an hour."
            : "Too many demo sessions from this IP. Try again later.";
        return res.status(429).json({ message: msg });
      }

      // Universal flow: body has `niche` (website landing page form)
      if (typeof req.body?.niche === "string") {
        const parsed = universalSessionSchema.safeParse(req.body);
        if (!parsed.success) return handleZodError(res, parsed.error);

        const { firstName, niche, language, scenario, preset, companyName, market } = parsed.data;

        let nicheCtx;
        if (preset === "solar") {
          // Prefer the saved Client for this visitor's market, so /uk quotes in
          // pounds against UK facts and / and /nl quote in euros. Falls back to
          // the hardcoded context when the market has no Client or the row has
          // no persona yet, which keeps the public page working even if someone
          // renames or deletes a row from the Clients tab.
          const clientKey = SOLAR_CLIENT_BY_MARKET[market ?? "nl"];
          const row = clientKey ? await getDemoClient(clientKey) : undefined;
          nicheCtx =
            (row && demoClientToContext(row, language, scenario)) ||
            buildSolarNicheContext(language, scenario, companyName);
          // The visitor's own firm always wins over the Client's default name,
          // exactly as it does on the admin create-link path.
          if (companyName) nicheCtx.company_name = companyName;
        } else {
          nicheCtx =
            (await generateNicheContext(niche, language, scenario, market)) ??
            buildFallbackNicheContext(niche, language, scenario);
        }
        const { token } = generateToken();

        await createPendingDemoLead({
          token,
          firstName,
          language,
          campaignId: UNIVERSAL_DEMO_CAMPAIGN_ID,
          demoNiche: JSON.stringify(nicheCtx),
        });

        return res.json({
          demoUrl: buildDemoPageLink({ token }),
          whatsappUrl: buildWhatsAppLink({ token }),
        });
      }

      // Legacy flow: body has `campaignId` (admin direct links + old /try form)
      const parsed = createSessionSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);

      const { firstName, language, campaignId } = parsed.data;
      if (!isValidDemoCampaignId(campaignId)) {
        return res.status(400).json({ message: "Invalid campaign." });
      }

      const { token } = generateToken();
      await createPendingDemoLead({ token, firstName, language, campaignId });

      // Intentionally do NOT return the token or leadId separately —
      // the client only needs the wa.me link.
      res.json({ whatsappUrl: buildWhatsAppLink({ token }) });
    }),
  );

  // ── Admin: generate a WhatsApp demo link for ANY is_demo campaign ──
  // Used by the "Copy WhatsApp Demo Link" button on the campaigns page.
  // Bypasses the public rate limiter (auth-gated) and accepts campaigns
  // that aren't in the public /try list (e.g. custom per-prospect demos).
  const adminSchema = z.object({
    firstName: z.string().trim().min(1).max(80),
    // Email kept optional on the admin endpoint so it stays backward-compatible
    // with any existing CRM button that still sends it. Ignored server-side.
    email: z.string().trim().email().max(200).optional(),
    language: z.enum(["en", "nl", "pt"]),
    campaignId: z.number().int(),
    // Per-prospect generation. When `niche` is present the link is themed for
    // that prospect: the same generator the public homepage runs produces the
    // company, vocabulary, scoping ladder and opener, and it rides on the demo
    // lead's demo_niche rather than being written to the campaign. That is what
    // lets one demo campaign serve every prospect at once, and it is why this
    // never mutates the shared campaign row.
    niche: z.string().trim().min(3).max(300).optional(),
    // Re-pick: the key of a saved Client. Mutually exclusive with `niche` in
    // practice (this one wins), and it skips generation entirely, which is the
    // difference between a demo link that takes 20 seconds to mint and one
    // that takes a model round-trip and might come back generic.
    clientNiche: z.string().trim().min(1).max(300).optional(),
    // The prospect's own firm, so the AI introduces itself in their name. This
    // is the difference between "a clever chatbot" and "their receptionist".
    companyName: z.string().trim().max(120).optional(),
    scenario: z.enum(["inquired", "deciding", "declined"]).optional().default("inquired"),
    // Jurisdiction, not preference: UK none, EU in the opener, Brazil in the
    // first reply. Omitted means the campaign's own setting applies.
    aiDisclosure: z.enum(["off", "opener", "second_message"]).optional(),
    // Which market the prospect sells into, which is NOT the language they read
    // in: a Dutch firm demoed to in English still quotes in euros. Only sent
    // when the language is English; nl and pt resolve their own market inside
    // generateNicheContext().
    market: z.enum(["uk", "us", "nl"]).optional(),
  });

  app.post(
    "/api/demo/create-link",
    requireAuth,
    wrapAsync(async (req, res) => {
      const parsed = adminSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);

      const { firstName, language, campaignId, niche, clientNiche, companyName, scenario, aiDisclosure, market } = parsed.data;

      if (!(await isDemoCampaign(campaignId))) {
        return res.status(400).json({
          message: "That campaign is not marked as a demo. Flag is_demo=true first.",
        });
      }

      // Same generate-then-fall-back pair the public universal flow uses, so a
      // link minted here and a homepage submission can never diverge. `generated`
      // is reported back rather than swallowed: the fallback context is safe but
      // carries none of the niche detail the link was created FOR, and sending a
      // prospect a generic demo believing it is theirs is the worst outcome here.
      let demoNiche: string | undefined;
      let generated: boolean | undefined;
      // Re-pick beats generate. A saved Client is a persona that has already
      // been read and approved, so re-running the model over the same niche
      // would only introduce drift.
      let reused: string | undefined;
      if (clientNiche) {
        const row = await getDemoClient(clientNiche);
        if (!row) {
          return res.status(404).json({ message: `No saved Client named "${clientNiche}".` });
        }
        const ctx = demoClientToContext(row, language, scenario);
        if (!ctx) {
          // Vocabulary-only rows (the pre-existing curated niches) have word
          // lists but no persona. Say so instead of minting a hollow demo:
          // the caller can generate one and it will be saved under this key.
          return res.status(409).json({
            message: `"${clientNiche}" has no saved persona yet. Generate one for this niche instead.`,
          });
        }
        if (companyName) ctx.company_name = companyName;
        if (aiDisclosure) ctx.ai_disclosure = aiDisclosure;
        demoNiche = JSON.stringify(ctx);
        reused = row.niche;
      } else if (niche) {
        // null means the model did not run (timeout, HTTP error, unparseable
        // JSON). Checked on the return value, not on a field of the context,
        // because the fallback is a fully-populated object and every field-based
        // test for "did this really generate" has a false positive in it.
        const model = await generateNicheContext(niche, language, scenario, market);
        generated = model !== null;
        const ctx = model ?? buildFallbackNicheContext(niche, language, scenario);

        // Save to the Clients library BEFORE the per-prospect overrides below,
        // so the row keeps the model's own company name as its DEFAULT and this
        // one prospect's override stays with this one lead. That separation is
        // the whole point: pick "Ferragens" again next month, override the
        // company to the next firm, and the saved Client is untouched.
        //
        // Only when the model actually ran. The fallback context is safe to
        // demo with but carries none of the niche detail, so saving it would
        // put a Client in the library that is generic in everything but name.
        if (model) await saveDemoClient(niche, language, model);

        if (companyName) ctx.company_name = companyName;
        if (aiDisclosure) ctx.ai_disclosure = aiDisclosure;
        demoNiche = JSON.stringify(ctx);
      } else if (aiDisclosure || companyName) {
        // Neither a fresh niche nor a re-pick: "send the campaign as it is."
        // Without this branch a disclosure/company override typed here would
        // be silently dropped, because demoNiche stays undefined and nothing
        // ever gets written to the lead — the campaign's own ai_disclosure
        // column would govern instead of the explicit choice made on this
        // link. A sparse override is exactly what the engine's overlay
        // already supports (_overlay_demo_niche_onto_campaign only sets keys
        // present in the blob, same as a saved Client's own sparse rows).
        demoNiche = JSON.stringify({
          ...(aiDisclosure ? { ai_disclosure: aiDisclosure } : {}),
          ...(companyName ? { company_name: companyName } : {}),
        });
      }

      const { token } = generateToken();
      // The ONLY invited mint path: this endpoint is requireAgency, so a lead
      // that comes through here is a link Gabriel sent a named prospect. The two
      // public paths above (homepage form, legacy /try) leave the flag false.
      await createPendingDemoLead({ token, firstName, language, campaignId, demoNiche, invited: true });
      res.json({
        // Browser first: it is the link that works for a prospect reading email
        // on a desktop, and the page carries its own WhatsApp handoff.
        demoUrl: buildDemoPageLink({ token }),
        whatsappUrl: buildWhatsAppLink({ token }),
        ...(generated === undefined ? {} : { generated }),
        ...(reused === undefined ? {} : { reused }),
      });
    }),
  );

  // ── Internal: generate a niche context WITHOUT creating a lead ──
  // Used by the automations engine's `/generate <free text>` VIP WhatsApp
  // command (src/webhooks/demo_commands.py), which re-themes the sender's OWN
  // demo lead mid-conversation by overwriting leads.demo_niche.
  //
  // It deliberately reuses generateNicheContext + buildFallbackNicheContext, the
  // exact pair the public /api/demo/create-session universal flow above runs, so
  // a phone-driven regeneration and a homepage submission can never diverge.
  // Splitting generation from lead creation is the whole point: the engine
  // already has a lead, and minting a throwaway one just to harvest its
  // demo_niche would burn a rate-limit slot and leave orphan rows behind.
  //
  // requireAuth, not the public rate limiter: this is reached with the engine's
  // X-Internal-Key (same as /api/demo/create-link), never from a browser.
  const nicheContextSchema = z.object({
    niche: z.string().trim().min(3).max(300),
    language: z.enum(["en", "nl", "pt"]),
    scenario: z.enum(["inquired", "deciding", "declined"]).optional().default("inquired"),
    // `/generate <name of a saved Client>` re-themes the sender's demo from the
    // library instead of burning a model call. The engine sends this when the
    // VIP's free text exactly matches a saved Client.
    clientNiche: z.string().trim().min(1).max(300).optional(),
  });

  app.post(
    "/api/demo/niche-context",
    requireAuth,
    wrapAsync(async (req, res) => {
      const parsed = nicheContextSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);

      const { niche, language, scenario, clientNiche } = parsed.data;

      // Re-pick, same precedence as /create-link.
      if (clientNiche) {
        const row = await getDemoClient(clientNiche);
        const ctx = row ? demoClientToContext(row, language, scenario) : null;
        if (ctx) return res.json({ generated: true, reused: row!.niche, context: ctx });
        // Fall through to generation when the Client is missing or has no
        // persona: the engine's caller wants a working demo, and the result
        // gets saved under this key anyway.
      }

      const generated = await generateNicheContext(niche, language, scenario);
      // Same library write as /create-link, and for the same reason: a persona
      // Gabriel generated from his own phone is one he generated for a real
      // prospect. Fallback contexts are not saved (see the note there).
      if (generated) await saveDemoClient(niche, language, generated);
      // `generated` tells the caller whether the model actually ran. The fallback
      // context is valid and safe to use, but it carries none of the niche detail
      // the demo is being regenerated FOR, so the engine reports it back to the
      // VIP rather than pretending the regeneration succeeded.
      res.json({
        generated: generated !== null,
        context: generated ?? buildFallbackNicheContext(niche, language, scenario),
      });
    }),
  );

  // ── Browser demo proxy ───────────────────────────────────────────────────
  // The /demo/<token> page (client/public/premium/demo.html) talks to the
  // Python engine, which owns the conversation pipeline. It is proxied through
  // Express rather than called directly for two reasons: the engine's port 8100
  // is not publicly exposed, and Vercel already rewrites /api/* to this host,
  // so the page can use a same-origin path and never learn which host it is on.
  //
  // Deliberately UNAUTHENTICATED: the token IS the credential. It is minted by
  // an authenticated CRM user, is unguessable, expires in 7 days, and the engine
  // caps both turns per session and lifetime restarts. Requiring a login here
  // would defeat the entire point of a link you send to a prospect.
  const ENGINE_BASE = process.env.ENGINE_URL || "http://localhost:8100";
  // Only these suffixes are reachable. Without the allowlist this becomes an
  // open proxy into every engine route (webhooks, booking, voice) for anyone
  // who can guess a path.
  const WEB_DEMO_SUFFIXES = new Set(["", "message", "restart", "recap"]);

  // Express 4 optional param, not the Express 5 `{/*splat}` form: this repo is
  // on express ^4.21. Every suffix is a single segment, so one route covers all.
  app.all("/api/web-demo/:token/:suffix?", wrapAsync(async (req, res) => {
    const token = String(req.params.token || "");
    if (!/^[A-Za-z0-9]{4,64}$/.test(token)) {
      return res.status(400).json({ code: "bad_token", message: "Invalid demo link." });
    }
    const segment = String(req.params.suffix || "");
    if (!WEB_DEMO_SUFFIXES.has(segment)) {
      return res.status(404).json({ code: "not_found", message: "Unknown demo endpoint." });
    }
    const suffix = segment ? `/${segment}` : "";
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ code: "method_not_allowed", message: "Method not allowed." });
    }

    try {
      const upstream = await fetch(`${ENGINE_BASE}/web-demo/${token}${suffix}`, {
        method: req.method,
        headers: { "content-type": "application/json" },
        body: req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
        // The recap runs two model calls, and a scoping reply can be slow.
        signal: AbortSignal.timeout(120_000),
      });
      const text = await upstream.text();

      // Inject the WhatsApp handoff link into the state response. The demo
      // number lives in server/demo-session.ts (DEMO_WHATSAPP_NUMBER) and the
      // engine has no copy of it, deliberately: two copies of a phone number
      // drift, and the failure mode is a prospect tapping through to a dead
      // number. Same builder the minting endpoint uses, so the page's handoff
      // and the link you paste are always the same session on the same number.
      if (req.method === "GET" && suffix === "" && upstream.ok) {
        try {
          const body = JSON.parse(text);
          body.waLink = buildWhatsAppLink({ token });
          return res.status(upstream.status).json(body);
        } catch {
          // Fall through to the raw passthrough below: a state response we
          // cannot parse is still better delivered than swallowed.
        }
      }

      res.status(upstream.status).type("application/json").send(text);
    } catch {
      // The page retries quietly on 5xx, so a restarting engine looks like a
      // pause rather than a broken demo.
      res.status(502).json({ code: "engine_unreachable", message: "The demo service is starting up. Try again in a moment." });
    }
  }));
}
