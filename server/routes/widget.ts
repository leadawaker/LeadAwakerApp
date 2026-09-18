// Website chat widget — public surface. Spec: specs/website-widget/.
//
// Three kinds of route live here, with very different trust levels:
//   1. GET /widget/v1.js and /widget/frame — public, unauthenticated, served to
//      a visitor on SOMEONE ELSE'S website.
//   2. ALL /api/widget/:key/:suffix? — public, unauthenticated, proxied to the
//      engine. Hardened the same way /api/web-demo is (suffix allowlist, method
//      allowlist, rebuilt query strings, size caps) plus domain + cap checks.
//   3. /api/widget-configs/* — agency-only CRUD for the setup card.
//
// The widget key is PUBLIC: it ships in the page source of every visitor to the
// client's site. It is an identifier, never a secret. What actually protects the
// account is the domain allowlist plus the per-visitor and per-day caps.
import express, { type Express, type Request, type Response } from "express";
import { randomBytes } from "crypto";
import path from "path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db";
import { widgetConfigs, campaigns as campaignsTable, accounts, nicheVocabulary, type WidgetConfig } from "@shared/schema";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAuth, requireAgency } from "../auth";
import { captureSiteShot, shotExists, shotFileName, isPublicHttpUrl, SHOT_DIR } from "../siteShot";
import { renderFrameHtml, renderDemoPageHtml, LOADER_JS, teaserMeta, type FrameConfig } from "../widgetPages";
import { widgetDemoAvatarUrl, widgetColorFor, DEFAULT_WIDGET_AVATAR } from "./demoSettings";

const ENGINE_BASE = process.env.ENGINE_URL || "http://localhost:8100";

// The Leads table is schema-qualified; raw SQL here rather than Drizzle because
// demo_niche is the only column needed and the schema prefix is the whole trick.
const LEADS_TABLE = '"p2mxx34fvbf3ll6"."Leads"';

// Same shape as the demo proxy's allowlist. Without it this is an open proxy
// into every engine route for anyone who can guess a path.
const WIDGET_SUFFIXES = new Set(["", "message", "voice", "audio"]);

// express.json() is mounted globally at 20mb, which is right for CRM uploads and
// far too generous for a public endpoint. Same ceiling the demo voice route uses.
const MAX_VOICE_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 2000;

const KEY_RE = /^wk_[A-Za-z0-9]{24}$/;
// Generated in the browser, so it is untrusted input and gets a strict shape.
const VISITOR_RE = /^[A-Za-z0-9]{8,40}$/;

/** Mint a public widget key. Prefixed so it is recognisable in a page source. */
function generateWidgetKey(): string {
  return `wk_${randomBytes(18).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 24)}`;
}

// ── Domain allowlist ─────────────────────────────────────────────────────────
// Stored as bare hostnames ("example.com"). A leading "*." allows subdomains.
// Matching is host-only: scheme and port are ignored, because a client moving
// from http to https or running a staging port should not silently break.

function normalizeDomain(raw: string): string {
  let d = String(raw || "").trim().toLowerCase();
  if (!d) return "";
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  return d;
}

function hostFromOrigin(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return normalizeDomain(value);
  }
}

export function domainAllowed(host: string, allowed: string[] | null | undefined): boolean {
  if (!host) return false;
  const list = (allowed || []).map(normalizeDomain).filter(Boolean);
  // An empty allowlist means "nowhere", not "everywhere". A freshly minted key
  // that has not been pointed at a domain yet must not answer the whole internet.
  if (!list.length) return false;
  return list.some((entry) => {
    if (entry.startsWith("*.")) {
      const base = entry.slice(2);
      return host === base || host.endsWith(`.${base}`);
    }
    return host === entry;
  });
}

/** The host a framed/fetching request actually came from. */
function requestHost(req: Request): string {
  return hostFromOrigin(req.get("origin")) || hostFromOrigin(req.get("referer"));
}

// ── Key lookup ───────────────────────────────────────────────────────────────

async function loadKey(key: string): Promise<WidgetConfig | null> {
  if (!KEY_RE.test(key)) return null;
  const [row] = await db.select().from(widgetConfigs).where(eq(widgetConfigs.publicKey, key)).limit(1);
  return row || null;
}

// ── Caps ─────────────────────────────────────────────────────────────────────
// Per-IP throttle on first contact only (the expensive part is the AI turn, and
// every turn belongs to a visitor id we already rate-limit per key per day).
const ipHits = new Map<string, { count: number; resetAt: number }>();
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX = 60;

function checkIpRate(ip: string): boolean {
  const now = Date.now();
  const hit = ipHits.get(ip);
  if (!hit || now > hit.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return true;
  }
  if (hit.count >= IP_MAX) return false;
  hit.count += 1;
  return true;
}

// Keep the map from growing without bound on a long-lived process.
setInterval(() => {
  const now = Date.now();
  for (const [ip, hit] of ipHits) if (now > hit.resetAt) ipHits.delete(ip);
}, IP_WINDOW_MS).unref?.();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Count one billable message against the key's daily cap.
 * Returns false when the cap is already spent. The counter resets by date stamp
 * rather than by a timer, so a restart never hands out a fresh allowance.
 */
async function consumeDailyMessage(cfg: WidgetConfig): Promise<boolean> {
  const day = today();
  const cap = cfg.maxMessagesPerDay ?? 500;
  const used = cfg.messagesDay === day ? (cfg.messagesToday ?? 0) : 0;
  if (used >= cap) return false;
  await db
    .update(widgetConfigs)
    .set({ messagesToday: used + 1, messagesDay: day, updatedAt: new Date() })
    .where(eq(widgetConfigs.id, cfg.id));
  return true;
}

// ── Public config handed to the frame ────────────────────────────────────────
// Only presentational fields. Never the account id, campaign id or caps.
// The company is the account's name: the same business the campaign's prompt
// speaks for, shown beside the agent so a visitor knows whose assistant it is.
async function publicConfig(cfg: WidgetConfig): Promise<FrameConfig> {
  const [acct] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, cfg.accountsId)).limit(1);
  return {
    key: cfg.publicKey,
    greeting: cfg.greeting || "",
    agentName: cfg.agentName || "",
    companyName: acct?.name || "",
    avatar: cfg.avatarUrl || DEFAULT_WIDGET_AVATAR,
    language: cfg.language || "en",
    maxTurns: cfg.maxTurnsPerVisitor ?? 30,
  };
}

// The persona a demo token was minted with. Read straight off the lead row
// because demo_niche is the only column needed and the schema prefix is the
// whole trick (see LEADS_TABLE).
async function loadDemoPersona(token: string): Promise<{ persona: Record<string, unknown>; language: string }> {
  const { rows } = await pool.query(
    `SELECT demo_niche, language FROM ${LEADS_TABLE}
      WHERE channel_identifier IN ($1, $2)
        AND demo_niche IS NOT NULL
      ORDER BY created_at DESC NULLS LAST LIMIT 1`,
    [`web-demo:${token}`, `wa-demo:${token}`]
  );
  let persona: Record<string, unknown> = {};
  try { persona = JSON.parse(String(rows[0]?.demo_niche || "{}")) || {}; } catch { /* no persona */ }
  return { persona, language: String(rows[0]?.language || "en") };
}

export function registerWidgetRoutes(app: Express) {
  // The frame's own JS/CSS. Everything else under /widget is a route below, so
  // this is mounted first and only ever serves those two static assets.
  //
  // no-cache (not no-store): still cacheable, but Cloudflare and the browser
  // must revalidate with the origin every time via ETag rather than trusting a
  // stale copy. Cloudflare's default is to cache static extensions like .js at
  // the edge for hours regardless of what Express would send with no explicit
  // header, which meant an edit here could take up to 4 hours to reach a
  // visitor. This widget is still under active development; the cost of an
  // extra conditional GET per session is trivial next to that.
  app.use("/widget", express.static(path.resolve("client/public/widget"), {
    setHeaders: (res) => res.set("cache-control", "no-cache"),
  }));

  // ── 1. The loader ──────────────────────────────────────────────────────────
  // Served from the API origin so the client's page needs no CORS and the frame
  // below is same-origin with the API it calls.
  app.get("/widget/v1.js", wrapAsync(async (_req: Request, res: Response) => {
    res.set("content-type", "application/javascript; charset=utf-8");
    res.set("cache-control", "public, max-age=300");
    res.send(LOADER_JS);
  }));

  // ── 2. The chat document ───────────────────────────────────────────────────
  // The only route that sets frame-ancestors per key. The app-wide default is
  // `frame-ancestors 'self'` (server/index.ts), which would block every client
  // site, so this response overrides it with exactly the key's allowlist.
  app.get("/widget/frame", wrapAsync(async (req: Request, res: Response) => {
    const key = String(req.query.key || "");
    const token = String(req.query.token || "");

    // Demo mode: the widget shell wrapped around an existing demo session. Same
    // UI, same caps, no widget key needed, so a prospect demo costs no config.
    if (!key && token) {
      if (!/^[A-Za-z0-9]{4,64}$/.test(token)) return res.status(400).send("Invalid demo link.");
      res.set("content-type", "text/html; charset=utf-8");
      // Demo frames are ours, embedded on our own demo page only.
      res.set("content-security-policy", "frame-ancestors 'self'");
      res.removeHeader("X-Frame-Options");
      const { persona, language } = await loadDemoPersona(token);
      return res.send(renderFrameHtml({
        mode: "demo",
        demo: {
          token,
          avatar: await widgetDemoAvatarUrl(),
          agentName: String(persona.agent_name || ""),
          companyName: String(persona.company_name || ""),
          language,
        },
      }));
    }

    const cfg = await loadKey(key);
    if (!cfg || !cfg.enabled) {
      res.status(403).set("content-type", "text/html; charset=utf-8");
      return res.send("<!doctype html><meta charset=utf-8><title>Chat unavailable</title>");
    }
    const host = requestHost(req);
    // Two exemptions from the allowlist, both for OUR surfaces rather than the
    // client's: a request with no Origin/Referer at all (a direct visit), and
    // one from the CRM itself, which is how the setup card renders its live
    // preview. Without the second, filling in the client's domain immediately
    // blocks the preview on the very page where you just typed it.
    // Embedding anywhere else is still refused by frame-ancestors below.
    if (host && host !== req.hostname && !domainAllowed(host, cfg.allowedDomains)) {
      res.status(403).set("content-type", "text/html; charset=utf-8");
      return res.send("<!doctype html><meta charset=utf-8><title>Chat not enabled for this domain</title>");
    }

    // X-Frame-Options: DENY is set app-wide (server/routes/auth.ts). Browsers
    // let CSP frame-ancestors win when both are present, but only the ones that
    // implement that precedence rule; dropping the header here removes the
    // ambiguity for the one response that is meant to be framed.
    res.removeHeader("X-Frame-Options");
    const ancestors = (cfg.allowedDomains || []).map(normalizeDomain).filter(Boolean);
    // A CSP host-source with no port means the scheme's default port (443/80),
    // which is what every real client site uses. localhost is the exception —
    // dev servers live on arbitrary ports — so it gets a port wildcard. Scoped
    // to loopback names so it can never widen a real customer's allowlist.
    const isLoopback = (d: string) => d === "localhost" || d === "127.0.0.1" || d === "[::1]";
    const sources = ancestors.length
      ? ancestors.flatMap((d) =>
          isLoopback(d)
            ? [`http://${d}:*`, `https://${d}:*`]
            : [`https://${d}`, `http://${d}`])
      : ["'none'"];
    res.set("content-type", "text/html; charset=utf-8");
    res.set("content-security-policy", `frame-ancestors 'self' ${sources.join(" ")}`);
    res.set("cache-control", "no-store");
    res.send(renderFrameHtml({ mode: "live", config: await publicConfig(cfg) }));
  }));

  // ── 2b. Teaser data for the loader ─────────────────────────────────────────
  // The loader runs on the client's page and fetches this cross-origin, so it
  // answers with CORS for allowed hosts only. Same key + domain checks as the
  // frame; it carries nothing the frame would not show anyway.
  app.get("/widget/meta", wrapAsync(async (req: Request, res: Response) => {
    const cfg = await loadKey(String(req.query.key || ""));
    if (!cfg || !cfg.enabled) return res.status(404).json({});
    const host = requestHost(req);
    if (!host || !domainAllowed(host, cfg.allowedDomains)) return res.status(403).json({});
    const origin = req.get("origin");
    if (origin) {
      res.set("access-control-allow-origin", origin);
      res.set("vary", "Origin");
    }
    res.set("cache-control", "no-cache");
    res.json(teaserMeta(await publicConfig(cfg)));
  }));

  // ── 3. The conversation proxy ──────────────────────────────────────────────
  app.all("/api/widget/:key/:suffix?", wrapAsync(async (req: Request, res: Response) => {
    const key = String(req.params.key || "");
    const segment = String(req.params.suffix || "");
    if (!WIDGET_SUFFIXES.has(segment)) {
      return res.status(404).json({ code: "not_found", message: "Unknown endpoint." });
    }
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ code: "method_not_allowed", message: "Method not allowed." });
    }

    const cfg = await loadKey(key);
    if (!cfg || !cfg.enabled) {
      return res.status(403).json({ code: "widget_disabled", message: "This chat is not available." });
    }
    if (!cfg.campaignsId) {
      return res.status(409).json({ code: "no_campaign", message: "This chat is not configured yet." });
    }

    const host = requestHost(req);
    if (host && !domainAllowed(host, cfg.allowedDomains)) {
      return res.status(403).json({ code: "domain_not_allowed", message: "This chat is not enabled for this site." });
    }

    const visitor = String((req.method === "POST" ? req.body?.visitorId : req.query.visitorId) || "");
    if (!VISITOR_RE.test(visitor)) {
      return res.status(400).json({ code: "bad_visitor", message: "Invalid session." });
    }

    const ip = String(req.ip || req.socket.remoteAddress || "unknown");
    if (!checkIpRate(ip)) {
      return res.status(429).json({ code: "rate_limited", message: "Too many requests. Try again later." });
    }

    // Only a real turn costs money, so only a real turn spends the daily budget.
    if (req.method === "POST" && (segment === "message" || segment === "voice")) {
      if (segment === "message") {
        const text = String(req.body?.text || "");
        if (!text.trim()) return res.status(400).json({ code: "empty", message: "Say something first." });
        if (text.length > MAX_TEXT_CHARS) {
          return res.status(413).json({ code: "too_long", message: "That message is too long." });
        }
      }
      if (!(await consumeDailyMessage(cfg))) {
        return res.status(429).json({ code: "daily_cap", message: "This chat has reached today's limit." });
      }
    }

    const body = req.method === "POST"
      ? JSON.stringify({
          ...(req.body ?? {}),
          // Pre-resolved by Express: the engine never reads widget config, so a
          // forged account or campaign in the request body cannot reach it.
          accountId: cfg.accountsId,
          campaignId: cfg.campaignsId,
          greeting: cfg.greeting || "",
          agentName: cfg.agentName || "",
          language: cfg.language || "en",
          maxTurns: cfg.maxTurnsPerVisitor ?? 30,
        })
      : undefined;

    if (segment === "voice" && Buffer.byteLength(body ?? "") > MAX_VOICE_BYTES) {
      return res.status(413).json({ code: "audio_too_large", message: "That recording is too long." });
    }

    // Rebuilt from validated values rather than forwarded, so req.query cannot
    // become a channel into the engine that the suffix allowlist does not cover.
    const params = new URLSearchParams();
    if (req.method === "GET") {
      params.set("account_id", String(cfg.accountsId));
      params.set("campaign_id", String(cfg.campaignsId));
      params.set("greeting", cfg.greeting || "");
      params.set("agent_name", cfg.agentName || "");
      params.set("language", cfg.language || "en");
      params.set("max_turns", String(cfg.maxTurnsPerVisitor ?? 30));
    }
    if (segment === "audio") {
      const id = Number(req.query.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ code: "bad_id", message: "Unknown message." });
      }
      params.set("id", String(id));
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const suffix = segment ? `/${segment}` : "";

    try {
      const upstream = await fetch(`${ENGINE_BASE}/widget/${visitor}${suffix}${query}`, {
        method: req.method,
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(120_000),
      });
      const text = await upstream.text();
      return res
        .status(upstream.status)
        .set("content-type", upstream.headers.get("content-type") || "application/json")
        .send(text);
    } catch {
      return res.status(502).json({ code: "engine_unreachable", message: "The assistant is offline." });
    }
  }));

  // ── 4. Homepage screenshots for the widget demo ────────────────────────────
  // Capture is agency-only and costs a headless browser run; serving is public,
  // because the demo page a prospect opens has to load the image.
  app.post("/api/site-shot", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const url = String(req.body?.url || "");
    if (!isPublicHttpUrl(url)) {
      return res.status(400).json({ code: "invalid_url", message: "Enter a public http(s) URL." });
    }
    // `refresh` is what the "recapture" button sends: without it an existing
    // shot is reused, so minting a second demo for the same prospect is free.
    if (!req.body?.refresh) {
      const existing = await shotExists(url);
      if (existing) return res.json({ ok: true, file: existing, cached: true });
    }
    const result = await captureSiteShot(url);
    if (!result.ok) return res.status(502).json({ code: "capture_failed", message: result.error });
    res.json({ ok: true, file: result.file, bytes: result.bytes, cookieButton: result.cookieButton });
  }));

  app.get("/api/site-shot/:file", wrapAsync(async (req: Request, res: Response) => {
    // The name is content-addressed, so anything that is not exactly that shape
    // is not one of ours and must never reach the filesystem.
    const file = String(req.params.file || "");
    if (!/^[a-f0-9]{16}\.webp$/.test(file)) return res.status(404).end();
    res.sendFile(path.join(SHOT_DIR, file), {
      headers: { "content-type": "image/webp", "cache-control": "public, max-age=600" },
    }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  }));

  // ── 5. The widget demo page ────────────────────────────────────────────────
  // A prospect's own homepage as a still backdrop, with the real widget live on
  // top of it. Server-rendered rather than static because the backdrop and the
  // company name come from the demo session, and a static page would need a
  // second round trip to learn them.
  //
  // The backdrop is a screenshot, not their live site in an iframe: most real
  // sites refuse to be framed (X-Frame-Options / frame-ancestors), and the ones
  // that allow it would give us no way to prove the widget belongs there.
  app.get("/widget-demo/:token", wrapAsync(async (req: Request, res: Response) => {
    const token = String(req.params.token || "");
    if (!/^[A-Za-z0-9]{4,64}$/.test(token)) return res.status(400).send("Invalid demo link.");

    const { persona, language } = await loadDemoPersona(token);

    // The Client row is read live (not only the persona snapshot) so a
    // recaptured screenshot or a newly picked colour reaches links already sent.
    let shot = String(persona.screenshot || "");
    let color: string | null = null;
    if (persona.raw) {
      const [client] = await db
        .select({ screenshotPath: nicheVocabulary.screenshotPath, widgetColor: nicheVocabulary.widgetColor })
        .from(nicheVocabulary)
        .where(eq(nicheVocabulary.niche, String(persona.raw)))
        .limit(1);
      if (client) {
        if (!shot) shot = client.screenshotPath || "";
        color = (await widgetColorFor({ widgetColor: client.widgetColor, screenshotPath: client.screenshotPath || shot })).color;
      }
    }
    if (!color && shot) color = (await widgetColorFor({ screenshotPath: shot })).color;
    const shotUrl = /^[a-f0-9]{16}\.webp$/.test(shot) ? `/api/site-shot/${shot}` : "";
    const company = String(persona.company_name || "");

    res.set("content-type", "text/html; charset=utf-8");
    res.set("cache-control", "no-store");
    res.send(renderDemoPageHtml({
      token, shotUrl, company, language, color,
      avatar: await widgetDemoAvatarUrl(),
      agentName: String(persona.agent_name || ""),
    }));
  }));

  // ── 5. Agency CRUD for the setup card ──────────────────────────────────────
  const upsertSchema = z.object({
    accountsId: z.number().int().positive(),
    campaignsId: z.number().int().positive().nullable().optional(),
    name: z.string().max(120).optional(),
    enabled: z.boolean().optional(),
    allowedDomains: z.array(z.string().max(253)).max(20).optional(),
    greeting: z.string().max(400).optional(),
    launcherPosition: z.enum(["left", "right"]).optional(),
    agentName: z.string().max(80).optional(),
    avatarUrl: z.string().max(500).optional(),
    language: z.string().max(5).optional(),
    maxTurnsPerVisitor: z.number().int().min(1).max(200).optional(),
    maxMessagesPerDay: z.number().int().min(1).max(100000).optional(),
  });

  app.get("/api/widget-configs", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const accountId = Number(req.query.accountId);
    const scoped = Number.isSafeInteger(accountId) && accountId > 0;
    const configs = scoped
      ? await db.select().from(widgetConfigs).where(eq(widgetConfigs.accountsId, accountId))
      : await db.select().from(widgetConfigs);
    // The account's campaigns ride along so the card's picker needs no second
    // request, the same shape the missed-call status endpoint uses.
    const campaigns = scoped
      ? await db
          .select({ id: campaignsTable.id, name: campaignsTable.name, campaignType: campaignsTable.campaignType })
          .from(campaignsTable)
          .where(eq(campaignsTable.accountsId, accountId))
      : [];
    res.json({ configs, campaigns });
  }));

  app.post("/api/widget-configs", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const domains = (parsed.data.allowedDomains || []).map(normalizeDomain).filter(Boolean);
    const [row] = await db
      .insert(widgetConfigs)
      .values({
        ...parsed.data,
        allowedDomains: domains,
        publicKey: generateWidgetKey(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    res.status(201).json(row);
  }));

  app.patch("/api/widget-configs/:id", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid id" });
    const parsed = upsertSchema.partial().safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.allowedDomains) {
      patch.allowedDomains = parsed.data.allowedDomains.map(normalizeDomain).filter(Boolean);
    }
    const [row] = await db.update(widgetConfigs).set(patch).where(eq(widgetConfigs.id, id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  }));

  app.delete("/api/widget-configs/:id", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid id" });
    await db.delete(widgetConfigs).where(eq(widgetConfigs.id, id));
    res.status(204).end();
  }));
}
