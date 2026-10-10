// Public website demo (specs/public-website-demo).
//
// Public:   the landing page creates a request and polls it.
// Internal: the engine reports the WhatsApp verification and usage events.
// Agency:   the Demos page reads and edits the limits.
//
// Nothing paid happens on the public routes: the scrape, the persona and any
// voice session only start once the visitor's phone has verified itself by
// sending the prefilled WhatsApp message (the engine then calls /verified).
import type { Express, Request, Response } from "express";
import { isIP } from "net";
import { timingSafeEqual } from "crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth, requireAgency } from "../auth";
import { wrapAsync, handleZodError } from "./_helpers";
import {
  SPEED_TO_LEAD_DEMO_CAMPAIGN_ID,
  DEMO_WHATSAPP_NUMBER,
  buildWhatsAppLink,
  createPendingDemoLead,
  generateToken,
  isVipPhone,
} from "../demo-session";
import {
  addSpend,
  hashIp,
  ipRequestsToday,
  isOverBudget,
  isOverDailyDemoCap,
  phoneRecentDemo,
  spendToday,
} from "../publicDemo/limits";
import { getPublicDemoSettings, savePublicDemoSettings, PUBLIC_DEMO_SOURCE } from "../publicDemo/settings";
import { verifyTurnstile } from "../publicDemo/turnstile";
import { buildPublicDemo } from "../publicDemo/build";

const REQ = `"p2mxx34fvbf3ll6"."Public_Demo_Requests"`;
const LEADS = `"p2mxx34fvbf3ll6"."Leads"`;
const TOKEN_RE = /^[a-f0-9]{16}$/;

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function internalKeyOk(req: Request): boolean {
  const expected = process.env.INTERNAL_API_KEY || "";
  const got = String(req.headers["x-internal-key"] || "");
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/**
 * The visitor's URL, normalised, or null. Cheap shape checks only: the real
 * guard against internal addresses is the engine's tools/safe_fetch.py.
 */
export function normaliseSiteUrl(raw: string): { url: string; domain: string } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || host.length > 253 || isIP(host.replace(/^\[|\]$/g, ""))) return null;
  u.hash = "";
  return { url: u.toString(), domain: host.replace(/^www\./, "") };
}

// Status polls are cheap but public: a small in-memory ceiling per IP.
const pollHits = new Map<string, { n: number; at: number }>();
function pollAllowed(ip: string): boolean {
  const now = Date.now();
  const e = pollHits.get(ip);
  if (!e || now - e.at > 60_000) {
    pollHits.set(ip, { n: 1, at: now });
    if (pollHits.size > 5000) pollHits.clear();
    return true;
  }
  e.n += 1;
  return e.n <= 120;
}

// The visitor's first message after "your receptionist is ready" is what
// starts the WhatsApp chat (Sara answers it with her greeting), so the link
// arrives with a greeting already typed.
const CHAT_OPENERS: Record<string, string> = { en: "Hi", nl: "Hoi", pt: "Oi" };

/** A chat link to the demo number, for after the token has been used. */
function plainChatLink(language: string): string {
  const text = CHAT_OPENERS[language] || CHAT_OPENERS.en;
  return `https://wa.me/${DEMO_WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

async function availability(): Promise<{ available: boolean; reason?: "disabled" | "busy" }> {
  const settings = await getPublicDemoSettings();
  if (!settings.enabled) return { available: false, reason: "disabled" };
  if ((await isOverBudget()) || (await isOverDailyDemoCap())) return { available: false, reason: "busy" };
  return { available: true };
}

const createSchema = z.object({
  url: z.string().max(2048),
  language: z.enum(["en", "nl", "pt"]),
  consent: z.literal(true),
  turnstileToken: z.string().min(1).max(2048),
});

const eventSchema = z.object({
  token: z.string().regex(TOKEN_RE),
  type: z.enum(["voice_session_started", "voice_ended", "chat_turn", "blocked_country"]),
  seconds: z.number().int().min(0).max(4 * 3600).optional(),
  feedback: z.string().max(2000).nullable().optional(),
  phone: z.string().max(20).optional(),
});

const settingsSchema = z
  .object({
    enabled: z.boolean(),
    dailyBudgetEur: z.number().min(0).max(1000),
    maxDemosPerDay: z.number().int().min(0).max(1000),
    maxRequestsPerIpPerDay: z.number().int().min(1).max(100),
    voiceMaxMinutesPerSession: z.number().int().min(1).max(30),
    voiceMaxSessionsPerDemo: z.number().int().min(1).max(20),
    unknownCallerMaxMinutes: z.number().int().min(1).max(30),
    callNumber: z.string().regex(/^\+\d{8,15}$/).nullable(),
    bookingUrl: z.string().url().max(500).nullable(),
    feedbackMessage: z.object({ enabled: z.boolean(), delayMinutes: z.number().int().min(10).max(1440) }),
  })
  .partial();

export function registerPublicDemoRoutes(app: Express): void {
  // ── Public ─────────────────────────────────────────────────────────────

  // Also hands the page the Turnstile site key (public by design), so adding
  // or rotating it is an .env change rather than a page rebuild.
  app.get("/api/public-demo/availability", wrapAsync(async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const siteKey = process.env.TURNSTILE_SITE_KEY || null;
    const state = await availability();
    res.json(siteKey ? { ...state, siteKey } : { available: false, reason: "disabled", siteKey });
  }));

  app.post("/api/public-demo/requests", wrapAsync(async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const settings = await getPublicDemoSettings();
    if (!settings.enabled) return res.status(503).json({ ok: false, code: "disabled" });

    const parsed = createSchema.safeParse(req.body);
    const ip = clientIp(req);
    if (!parsed.success) {
      const consentMissing = parsed.error.issues.some((i) => i.path[0] === "consent");
      return res.status(400).json({ ok: false, code: consentMissing ? "consent" : "invalid" });
    }
    const { url, language, turnstileToken } = parsed.data;

    if (!(await verifyTurnstile(turnstileToken, ip))) {
      return res.status(403).json({ ok: false, code: "bot_check" });
    }
    const site = normaliseSiteUrl(url);
    if (!site) return res.status(400).json({ ok: false, code: "invalid_url" });

    const ipHash = hashIp(ip);
    if ((await ipRequestsToday(ipHash)) >= settings.maxRequestsPerIpPerDay) {
      return res.status(429).json({ ok: false, code: "limit" });
    }
    if ((await isOverBudget()) || (await isOverDailyDemoCap())) {
      return res.status(503).json({ ok: false, code: "busy", bookingUrl: settings.bookingUrl });
    }

    const { token } = generateToken();
    const leadId = await createPendingDemoLead({
      token,
      firstName: "",
      language,
      campaignId: SPEED_TO_LEAD_DEMO_CAMPAIGN_ID,
      source: PUBLIC_DEMO_SOURCE,
    });
    await pool.query(
      `INSERT INTO ${REQ} (token, status, website_url, domain, language, ip_hash, user_agent, consent_at, lead_id)
       VALUES ($1, 'awaiting_phone', $2, $3, $4, $5, $6, now(), $7)`,
      [token, site.url, site.domain, language, ipHash, String(req.headers["user-agent"] || "").slice(0, 300), leadId],
    );

    const whatsappUrl = buildWhatsAppLink({ token });
    const qrSvg = await QRCode.toString(whatsappUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    res.json({ ok: true, token, whatsappUrl, qrSvg, domain: site.domain });
  }));

  app.get("/api/public-demo/requests/:token", wrapAsync(async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const token = String(req.params.token || "");
    if (!TOKEN_RE.test(token)) return res.status(400).json({ status: "invalid" });
    if (!pollAllowed(clientIp(req))) return res.status(429).json({ status: "slow_down" });

    const { rows } = await pool.query(`SELECT * FROM ${REQ} WHERE token = $1`, [token]);
    let r = rows[0];
    if (!r) return res.status(404).json({ status: "expired" });
    const settings = await getPublicDemoSettings();

    // A repeat visitor was put back on the demo they already had.
    if (r.status === "reconnected" && r.reason && TOKEN_RE.test(r.reason)) {
      const prior = await pool.query(`SELECT * FROM ${REQ} WHERE token = $1`, [r.reason]);
      if (prior.rows[0]) r = prior.rows[0];
    }

    const base = { domain: r.domain as string, bookingUrl: settings.bookingUrl };
    switch (r.status) {
      case "awaiting_phone": {
        const stale = Date.now() - new Date(r.created_at).getTime() > 24 * 3600 * 1000;
        return res.json(stale ? { ...base, status: "expired" } : { ...base, status: "verify", whatsappUrl: buildWhatsAppLink({ token }) });
      }
      case "building":
        return res.json({ ...base, status: "building" });
      case "ready":
      case "completed":
        return res.json({
          ...base,
          status: "ready",
          companyName: r.company_name,
          logo: r.logo || null,
          voiceUrl: `/voice-demo?token=${r.token}&embed=1`,
          whatsappUrl: plainChatLink(r.language),
          callNumber: settings.callNumber,
        });
      case "failed":
        return res.json({ ...base, status: "blocked", code: "unreadable" });
      case "blocked_country":
        return res.json({ ...base, status: "blocked", code: "country" });
      default:
        return res.json({ ...base, status: "blocked", code: "busy" });
    }
  }));

  // ── Internal (engine) ──────────────────────────────────────────────────

  app.post("/api/public-demo/internal/verified", wrapAsync(async (req: Request, res: Response) => {
    if (!internalKeyOk(req)) return res.status(401).json({ message: "invalid internal key" });
    const token = String(req.body?.token || "");
    const phone = String(req.body?.phone || "");
    if (!TOKEN_RE.test(token) || !/^\+\d{8,15}$/.test(phone)) return res.status(400).json({ message: "bad input" });

    const { rows } = await pool.query(`SELECT * FROM ${REQ} WHERE token = $1`, [token]);
    const r = rows[0];
    if (!r) return res.status(404).json({ message: "unknown token" });
    if (r.status !== "awaiting_phone") return res.json({ action: "ignore" });

    const settings = await getPublicDemoSettings();
    const vip = isVipPhone(phone);

    // One demo per phone: a repeat visitor goes back to the demo they have.
    const prior = vip ? null : await phoneRecentDemo(phone, token);
    if (prior?.leadId) {
      await pool.query(
        `UPDATE ${REQ} SET status = 'reconnected', reason = $1, phone = $2, verified_at = now() WHERE token = $3`,
        [prior.token, phone, token],
      );
      // The fresh pending lead was only ever the vehicle for this message.
      await pool.query(`DELETE FROM ${LEADS} WHERE id = $1 AND demo_niche IS NULL`, [r.lead_id]);
      return res.json({ action: "reconnect", leadId: prior.leadId, domain: prior.domain });
    }

    if (!settings.enabled || (!vip && ((await isOverBudget()) || (await isOverDailyDemoCap())))) {
      await pool.query(
        `UPDATE ${REQ} SET status = 'blocked_limit', reason = 'limit', phone = $1, verified_at = now() WHERE token = $2`,
        [phone, token],
      );
      return res.json({ action: "limit", bookingUrl: settings.bookingUrl });
    }

    const claimed = await pool.query(
      `UPDATE ${REQ} SET status = 'building', phone = $1, verified_at = now()
       WHERE token = $2 AND status = 'awaiting_phone' RETURNING id`,
      [phone, token],
    );
    if (!claimed.rowCount) return res.json({ action: "ignore" });
    res.json({ action: "build", domain: r.domain });
    // After the answer: the engine sends "reading your site" right away.
    setImmediate(() => {
      buildPublicDemo(token).catch((err) => console.error("[public-demo] build crashed", err));
    });
  }));

  app.post("/api/public-demo/internal/event", wrapAsync(async (req: Request, res: Response) => {
    if (!internalKeyOk(req)) return res.status(401).json({ message: "invalid internal key" });
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const { token, type, seconds, feedback, phone } = parsed.data;
    const { costEstimates } = await getPublicDemoSettings();

    if (type === "voice_ended") {
      const secs = seconds ?? 0;
      const fb = (feedback || "").trim() || null;
      await pool.query(
        `UPDATE ${REQ} SET voice_seconds = voice_seconds + $1, voice_ended_at = now(),
                feedback = COALESCE($2, feedback) WHERE token = $3`,
        [secs, fb, token],
      );
      await addSpend((secs / 60) * costEstimates.voiceMinuteEur, { token });
    } else if (type === "chat_turn") {
      await pool.query(`UPDATE ${REQ} SET chat_turns = chat_turns + 1 WHERE token = $1`, [token]);
      await addSpend(costEstimates.chatTurnEur, { token });
    } else if (type === "blocked_country") {
      const { rows } = await pool.query(
        `UPDATE ${REQ} SET status = 'blocked_country', reason = 'country', phone = $1
         WHERE token = $2 AND status = 'awaiting_phone' RETURNING lead_id`,
        [phone || null, token],
      );
      // Not a lead we can serve: the pending row would only catch their
      // later messages and answer them with silence.
      if (rows[0]?.lead_id) {
        await pool.query(`DELETE FROM ${LEADS} WHERE id = $1 AND demo_niche IS NULL`, [rows[0].lead_id]);
      }
    }
    res.json({ ok: true });
  }));

  // ── Agency (Demos page) ────────────────────────────────────────────────

  app.get("/api/demo-settings/public-demo", requireAuth, requireAgency, wrapAsync(async (_req: Request, res: Response) => {
    const [settings, today] = await Promise.all([getPublicDemoSettings(), spendToday()]);
    res.json({ settings, today: { eur: today.eur, built: today.built } });
  }));

  app.put("/api/demo-settings/public-demo", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    res.json({ settings: await savePublicDemoSettings(parsed.data) });
  }));
}
