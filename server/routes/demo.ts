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
  type DemoScenario,
} from "../demo-session";
import { getWebDemoConfig, updateWebDemoConfig, listDemoSessions } from "../demo-admin";
// The Clients library. Deliberately NOT wired into /create-session: that form
// is anonymous public traffic, and one row per curious visitor would bury the
// personas Gabriel actually minted for a prospect (decided 2026-08-11).
import {
  saveDemoClient,
  listDemoClients,
  getDemoClient,
  clientLanguages,
  demoClientToContext,
  demoClientToEditable,
  updateDemoClient,
  deleteDemoClient,
  duplicateDemoClient,
  type DemoLang,
} from "../demo-clients";

/**
 * Can this Client be demoed in this language?
 *
 * A Client stores its opener (and the phrases substituted into it) per
 * language, and only the languages someone actually generated or typed. Running
 * one in a language it lacks used to fall back across languages and splice, for
 * example, a Portuguese noun phrase into an English opener. See clientLanguages().
 *
 * Every caller here does something different with a "no" — the admin mint says
 * so, the VIP command regenerates, the public page uses its own template — so
 * this returns the answer rather than a response.
 */
function clientSupportsLanguage(
  row: Parameters<typeof clientLanguages>[0],
  language: DemoLang,
): boolean {
  const langs = clientLanguages(row);
  // Empty means unrestricted: the curated niche packs have word lists but no
  // opener in any language, so there is nothing to splice.
  return langs.length === 0 || langs.includes(language);
}

/**
 * Is this request Gabriel (or anyone else who runs the agency)?
 *
 * Read-only rather than gating middleware, because both callers must stay open
 * to logged-out visitors: the state route serves prospects, and answers this
 * only to decide whether to hand the page its presenter panel.
 *
 * Extracted so the route that SHOWS the panel and the routes that OBEY it can
 * never drift apart. Two copies of this predicate, one of them stale, is a
 * panel that renders for someone whose writes then 403, or worse the reverse.
 */
function isDemoAdmin(req: Request): boolean {
  const user = req.isAuthenticated() ? (req.user as any) : undefined;
  return !!user && (user.accountsId === 1 || user.role === "Owner" || user.role === "Admin");
}

/** Tokens are 16 hex chars; this is the shape every demo route validates. */
const DEMO_TOKEN_RE = /^[A-Za-z0-9]{4,64}$/;

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
  // Scenario toggle. Becomes the persona's what_lead_did, which the engine
  // collapses to a lead_stage (derive_lead_stage in tools/ai_service.py) and
  // then to a conversation_mode. Optional; defaults to "inquired".
  //
  // NOT prompt 98, which this used to say: that row ("Universal Prompt", scoped
  // to campaign 60) is archived. Campaign 60 has no campaign-scoped conversation
  // prompt, so get_prompt_for_campaign misses and it resolves up to account 1's
  // — prompt 93, the Discovery Prompt, which is what the demo really talks with.
  scenario: z.enum(["inquired", "deciding"]).optional().default("inquired"),
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

/** Country → market for the English demo. Everything English that is not the US
 *  or Canada is pointed at the UK: it is the closest of the three markets we
 *  actually have, and any English market beats the Netherlands, which is what a
 *  visitor used to get. Adding au/ca/ie properly is a content job (each market
 *  needs its own DEADLINE_CASES entry and MARKET_NAMES list in config.jsx), so
 *  it waits until someone asks for it. */
const MARKET_BY_COUNTRY: Record<string, "uk" | "us" | "nl"> = {
  US: "us", CA: "us",
  GB: "uk", IE: "uk", AU: "uk", NZ: "uk", ZA: "uk",
  NL: "nl", BE: "nl",
};

/** Fallback market for a visitor who never picked one, read from the browser's
 *  own locale.
 *
 *  Why the locale and not the IP: Vercel strips x-vercel-ip-country on the
 *  /api/* rewrite to the Pi, and the cf-ipcountry that does arrive describes
 *  Vercel's edge node (FRA → "DE" for everyone), so it would label every visitor
 *  German. The real client IP is in x-vercel-forwarded-for, but turning that
 *  into a country means either a MaxMind database to maintain or shipping
 *  visitor IPs to a third-party lookup. accept-language survives the rewrite
 *  intact, costs nothing, and for "which market does this business sell into" a
 *  browser locale is arguably the better signal anyway: a Dutch owner reading
 *  from a hotel in Spain still has nl-NL and still quotes in euros.
 *
 *  Returns undefined when the locale says nothing useful, which leaves the
 *  existing default alone. Only consulted for the English demo: nl and pt
 *  resolve their own market inside generateNicheContext(). */
function marketFromLocale(req: Request): "uk" | "us" | "nl" | undefined {
  const header = req.headers["accept-language"];
  if (typeof header !== "string") return undefined;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]!.trim();
    if (!tag || tag === "*") continue;
    const [lang, region] = tag.split("-");
    const byRegion = region ? MARKET_BY_COUNTRY[region.toUpperCase()] : undefined;
    if (byRegion) return byRegion;
    // A bare language tag still narrows it: "nl" is the Netherlands, and bare
    // "en" means English-speaking-somewhere, which is any of our markets except
    // the Dutch one.
    if (lang?.toLowerCase() === "nl") return "nl";
    if (lang?.toLowerCase() === "en") return "uk";
  }
  return undefined;
}

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

        const { firstName, niche, language, scenario, preset, companyName } = parsed.data;
        // The picker wins when the page sent one. It only does on the landing
        // page (07-demo.jsx forwards window.MARKET); the standalone demo at
        // /demo/:token sends nothing, and middleware.ts only injects __MARKET__
        // on /, /pt and /nl anyway, so most visitors arrive with no market at
        // all and used to be handed a Dutch company in an English conversation.
        const market = parsed.data.market ?? marketFromLocale(req);

        let nicheCtx;
        if (preset === "solar") {
          // Prefer the saved Client for this visitor's market, so /uk quotes in
          // pounds against UK facts and / and /nl quote in euros. Falls back to
          // the hardcoded context when the market has no Client or the row has
          // no persona yet, which keeps the public page working even if someone
          // renames or deletes a row from the Clients tab.
          const clientKey = SOLAR_CLIENT_BY_MARKET[market ?? "nl"];
          const row = clientKey ? await getDemoClient(clientKey) : undefined;
          // ...or when the row has no opener in the visitor's language. The
          // hardcoded context is written per language, so it is a better answer
          // than a saved Client speaking the wrong one. Reachable today only by
          // an odd market/language pairing (the UK and US rows are English-only
          // while their markets are picked by an English-language path), but it
          // costs one condition to keep it impossible rather than unlikely.
          const usable = row && clientSupportsLanguage(row, language);
          nicheCtx =
            (usable && demoClientToContext(row!, language, scenario)) ||
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
    scenario: z.enum(["inquired", "deciding"]).optional().default("inquired"),
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
        // Before the context is built, because a mismatch is not a broken
        // Client, it is the wrong pairing: the Client is fine in the languages
        // it has, and this link just asked for one it does not. Naming those
        // languages makes the fix obvious (add the missing opener on the
        // Clients tab, or mint the link in a language it already speaks).
        if (!clientSupportsLanguage(row, language)) {
          const have = clientLanguages(row).map((l) => l.toUpperCase()).join(", ");
          return res.status(409).json({
            message: `"${clientNiche}" has no ${language.toUpperCase()} version — it only exists in ${have}. Add the ${language.toUpperCase()} opener fields on the Clients tab, or mint this link in ${have}.`,
          });
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
        // Which Client this link was minted from, so the presenter panel's
        // picker can show it as the current selection rather than opening on
        // "Campaign default". Inert to the engine, which overlays an explicit
        // key list and ignores anything not on it.
        (ctx as Record<string, unknown>).client_niche = row.niche;
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
    scenario: z.enum(["inquired", "deciding"]).optional().default("inquired"),
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
        // A Client that does not speak `language` is treated exactly like a
        // Client with no persona: fall through and generate. Unlike /create-link
        // there is nobody here to read an error — this is a VIP typing
        // `/generate <client>` into WhatsApp mid-conversation — so a working
        // demo in the right language beats a refusal.
        const usable = row && clientSupportsLanguage(row, language);
        const ctx = usable ? demoClientToContext(row!, language, scenario) : null;
        if (ctx) return res.json({ generated: true, reused: row!.niche, context: ctx });
        // Fall through to generation when the Client is missing, has no
        // persona, or has none in this language: the engine's caller wants a
        // working demo, and the result gets saved under this key anyway.
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
  //
  // One exception: a request carrying an authenticated AGENCY session skips
  // both caps, so Gabriel can re-run a link forever while testing instead of
  // minting a new one every fifth restart.
  //
  // The gate is the session, not the hostname. Whether the cookie reaches this
  // route depends on where the CRM login was performed (the session cookie is
  // Secure, and COOKIE_DOMAIN is unset, so it is scoped to the host that set
  // it); in practice that is app.leadawaker.com, the host the CRM is served
  // from. What matters for safety is the other direction, and it holds
  // unconditionally: a prospect has no CRM session at all, so a minted link
  // always enforces the normal caps for them no matter which host they open.
  //
  // Same test requireAgency uses, applied read-only here rather than as gating
  // middleware, since this route must stay open to logged-out visitors.
  const ENGINE_BASE = process.env.ENGINE_URL || "http://localhost:8100";
  // Only these suffixes are reachable. Without the allowlist this becomes an
  // open proxy into every engine route (webhooks, booking, voice) for anyone
  // who can guess a path.
  // "bump" is the presenter's on-demand follow-up. The engine gates it to
  // invited links on its own side; this list only decides which engine routes
  // are reachable at all, and leaving it out here 404s the button before the
  // request ever gets there.
  //
  // "voice" carries a composer recording as base64 inside JSON, and "audio"
  // reads one back for playback after a reload. Base64-in-JSON rather than
  // multipart is deliberate: this proxy re-serialises every POST as JSON, and
  // that plus the allowlist above is what stops the route being an open proxy
  // into every engine endpoint. Rewriting it to stream multipart would be more
  // surgery on a security-sensitive file than a voice memo is worth.
  const WEB_DEMO_SUFFIXES = new Set(["", "message", "restart", "recap", "bump", "voice", "audio"]);

  // A 30-second Opus memo is 30 to 60KB of audio, so 40 to 80KB of base64. This
  // is a wide margin around that. express.json() is mounted globally at 20mb
  // (server/index.ts), which is right for the CRM's own uploads and far too
  // generous for this route, so the ceiling is applied here: without it a
  // crafted request could push 20mb of base64 into the engine. The engine
  // restates the same limit on the decoded bytes, where port 8100 cannot be
  // reached around it.
  const MAX_DEMO_VOICE_BYTES = 1_500_000;

  // ── Presenter panel: read and edit a running browser demo ──
  //
  // The ⋯ menu on /demo/<token>. Both routes edit the BROWSER lead
  // (`web-demo:<token>`) and never the WhatsApp one (`wa-demo:<token>`), which
  // is what makes the panel structurally incapable of disturbing a WhatsApp
  // demo or the VIP `/` commands that drive it.
  //
  // requireAuth AND isDemoAdmin: requireAuth alone would let any logged-in
  // client of the CRM re-theme a demo link that is not theirs.

  // ── The Demos page's index ──
  // Every demo link, newest first, one row per token with both surfaces folded
  // in. Owner-only for the same reason the config routes are: it lists every
  // prospect Gabriel has demoed to.
  app.get(
    "/api/demo/sessions",
    requireAuth,
    wrapAsync(async (req, res) => {
      if (!isDemoAdmin(req)) return res.status(403).json({ message: "Not allowed." });
      const raw = Number(req.query.limit);
      const limit = Number.isSafeInteger(raw) && raw > 0 ? Math.min(raw, 500) : 200;
      res.json({ sessions: await listDemoSessions(limit) });
    }),
  );

  app.get(
    "/api/demo/:token/config",
    requireAuth,
    wrapAsync(async (req, res) => {
      if (!isDemoAdmin(req)) return res.status(403).json({ message: "Not allowed." });
      const token = String(req.params.token || "");
      if (!DEMO_TOKEN_RE.test(token)) return res.status(400).json({ message: "Bad token." });

      const config = await getWebDemoConfig(token);
      // The engine creates the browser lead on first open, so "no row" means
      // the page has never been opened rather than a bad link. Either way there
      // is nothing to configure yet.
      if (!config) return res.status(404).json({ message: "This demo has not been opened yet." });
      res.json(config);
    }),
  );

  const configPatchSchema = z
    .object({
      firstName: z.string().trim().min(1).max(80).optional(),
      language: z.enum(["en", "nl", "pt"]).optional(),
      companyName: z.string().trim().max(120).optional(),
      // "" is a real value here, not "omitted": it is what the presenter
      // panel's "Campaign default" option sends to clear a per-session
      // override back to the campaign's own ai_disclosure column. An omitted
      // field can't be told apart from "leave the current override alone".
      aiDisclosure: z.union([z.enum(["off", "opener", "second_message"]), z.literal("")]).optional(),
      // A saved Client key. Replaces the persona wholesale, which is why the
      // page confirms and restarts around it.
      clientNiche: z.string().trim().min(1).max(300).optional(),
      // No default: an omitted scenario means "leave it as it is", resolved
      // against `current.scenario` below. Defaulting it here would silently
      // reset a "deciding" demo to "inquired" on any PATCH that didn't happen
      // to also name the scenario (e.g. a Client switch or a language change).
      scenario: z.enum(["inquired", "deciding"]).optional(),
    })
    // An empty body would report success while doing nothing, which reads on
    // the page as the panel silently failing.
    .refine(
      (v) =>
        v.firstName !== undefined ||
        v.language !== undefined ||
        v.companyName !== undefined ||
        v.aiDisclosure !== undefined ||
        v.clientNiche !== undefined,
      { message: "Nothing to change." },
    );

  app.patch(
    "/api/demo/:token/config",
    requireAuth,
    wrapAsync(async (req, res) => {
      if (!isDemoAdmin(req)) return res.status(403).json({ message: "Not allowed." });
      const token = String(req.params.token || "");
      if (!DEMO_TOKEN_RE.test(token)) return res.status(400).json({ message: "Bad token." });

      const parsed = configPatchSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const { firstName, language, companyName, aiDisclosure, clientNiche, scenario: scenarioInput } = parsed.data;

      const current = await getWebDemoConfig(token);
      if (!current) return res.status(404).json({ message: "This demo has not been opened yet." });

      // An omitted scenario keeps whatever the demo is already on, exactly
      // like the `language` fallback just below — never the zod default,
      // which would silently discard a "deciding" demo back to "inquired" on
      // any patch (a Client switch, a language change) that didn't happen to
      // repeat the scenario.
      const scenario = (scenarioInput ?? current.scenario) as DemoScenario;

      let replaceNiche: Record<string, unknown> | undefined;
      // Which saved Client to (re)build the persona from: an explicit switch,
      // or — when only the language changes — the Client this demo is already
      // running, so opener_phrase/quote_subject/company_name etc. get
      // re-picked in the new language instead of staying frozen in the old
      // one. Only possible when the running persona actually came from the
      // library (current.clientNiche set); a freeform/generated persona has
      // no per-language slots to re-pick from, so its language field changes
      // but the persona text does not.
      const languageChanged = language !== undefined && language !== current.language;
      const targetClientNiche = clientNiche || (languageChanged ? current.clientNiche : "");
      if (targetClientNiche) {
        // The language the persona is built in is the one being switched TO
        // when both change in the same call, not the one already on the lead.
        const lang = (language || current.language || "en") as DemoLang;
        const row = await getDemoClient(targetClientNiche);
        if (!row) {
          // Only a hard failure for an explicit switch; a stale or renamed
          // current.clientNiche on a language-only patch must not block a
          // language change the admin never asked to combine with a Client swap.
          if (clientNiche) return res.status(404).json({ message: `No saved Client named "${clientNiche}".` });
        } else if (!clientSupportsLanguage(row, lang)) {
          if (clientNiche) {
            // Same two checks the mint path runs (see /api/demo/create-link).
            // Their messages name the fix, so they are surfaced verbatim
            // rather than flattened into a generic failure.
            const have = clientLanguages(row).map((l) => l.toUpperCase()).join(", ");
            return res.status(409).json({
              message: `"${clientNiche}" has no ${lang.toUpperCase()} version — it only exists in ${have}. Add the ${lang.toUpperCase()} opener fields on the Clients tab, or switch this demo to ${have}.`,
            });
          }
          // Language-only patch and the Client just doesn't have this
          // language: let the language field change and leave the persona
          // text as-is rather than blocking a change nobody asked to fail.
        } else {
          const ctx = demoClientToContext(row, lang, scenario);
          if (ctx) {
            // Remembered so the picker reopens showing this Client as current
            // instead of falling back to "Campaign default". Inert to the
            // engine: _overlay_demo_niche_onto_campaign copies an explicit key
            // list onto the campaign dict, so a key it does not name is
            // simply ignored.
            (ctx as Record<string, unknown>).client_niche = row.niche;
            // A language-only repick is not a Client switch: it is the same
            // business, re-picked in a different language, so a company-name
            // override typed into the panel earlier survives it. An explicit
            // clientNiche switch intentionally does NOT carry this over — a
            // different Client is a different business.
            if (!clientNiche && current.companyName) ctx.company_name = current.companyName;
            replaceNiche = ctx as Record<string, unknown>;
          } else if (clientNiche) {
            return res.status(409).json({
              message: `"${clientNiche}" has no saved persona yet. Generate one for this niche instead.`,
            });
          }
        }
      }

      const ok = await updateWebDemoConfig(token, {
        firstName,
        language,
        companyName,
        aiDisclosure,
        replaceNiche,
      });
      if (!ok) return res.status(404).json({ message: "This demo has not been opened yet." });

      // The updated config, so the panel re-syncs immediately instead of
      // waiting on the next poll to discover what it just wrote.
      res.json(await getWebDemoConfig(token));
    }),
  );

  // Express 4 optional param, not the Express 5 `{/*splat}` form: this repo is
  // on express ^4.21. Every suffix is a single segment, so one route covers all.
  app.all("/api/web-demo/:token/:suffix?", wrapAsync(async (req, res) => {
    const token = String(req.params.token || "");
    if (!DEMO_TOKEN_RE.test(token)) {
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

    const body = req.method === "POST" ? JSON.stringify(req.body ?? {}) : undefined;
    if (segment === "voice" && Buffer.byteLength(body ?? "") > MAX_DEMO_VOICE_BYTES) {
      return res.status(413).json({ code: "audio_too_large", message: "That recording is too long." });
    }

    // The only route here that takes a query string, and it is rebuilt from a
    // validated integer rather than forwarded: passing req.query through
    // wholesale would hand a caller a channel into the engine that the suffix
    // allowlist above does not cover.
    let query = "";
    if (segment === "audio") {
      const id = Number(req.query.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ code: "bad_id", message: "Unknown message." });
      }
      query = `?id=${id}`;
    }

    const unlimited = isDemoAdmin(req);

    try {
      const upstream = await fetch(`${ENGINE_BASE}/web-demo/${token}${suffix}${query}`, {
        method: req.method,
        headers: {
          "content-type": "application/json",
          ...(unlimited ? { "x-demo-unlimited": "1" } : {}),
        },
        body,
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
          // Whether to render the presenter panel at all. A prospect never
          // receives the markup, rather than receiving it hidden: there is no
          // query parameter, PIN or localStorage flag to leak in a screen
          // recording. The flag decides rendering only; every write route
          // re-runs isDemoAdmin server-side, so a forged `admin: true` in a
          // devtools console buys nothing.
          body.admin = unlimited;
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
