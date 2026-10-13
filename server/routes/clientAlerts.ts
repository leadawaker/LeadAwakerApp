import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isValidInternalKey, requireAgency, requireAuth } from "../auth";
import { accountIdFor, getEngineUrl, handleZodError, wrapAsync } from "./_helpers";
import { sendRawEmail } from "../email";
import { renderClientAlertEmail } from "../clientAlerts/renderEmail";
import { AlertSettingsError } from "../storage/clientAlerts";
import { ALERT_CHANNELS, ALERT_LANGUAGES, ALERT_TYPES, MAX_EMAIL_RECIPIENTS, MAX_WHATSAPP_RECIPIENTS } from "@shared/clientAlerts";

// Client recaps and instant alerts (specs/client-recaps):
// - the engine's email endpoint (internal key only): render with the shared
//   layout, deliver through Resend, report per address;
// - the Recaps & alerts settings (agency edits, clients read);
// - the "Send test" proxy to the engine;
// - the /go/:code link behind every alert button.

function internalKeyOk(req: Request): boolean {
  return isValidInternalKey(req.headers["x-internal-key"] as string | undefined);
}

const isAgency = (req: Request) => {
  const u = req.user;
  if (!u) return internalKeyOk(req);
  return u.accountsId === 1 || u.role === "Owner" || u.role === "Admin";
};


const emailTypes = ["daily_recap", ...ALERT_TYPES] as const;
const emailBodySchema = z.object({
  ledgerId: z.number().int(),
  kind: z.enum(["alert", "recap"]),
  type: z.enum(emailTypes),
  language: z.string().max(5),
  accountName: z.string().max(200),
  to: z.array(z.object({ address: z.string().email(), name: z.string().max(100).optional() })).min(1).max(10),
  link: z.string().url().max(300),
  data: z.record(z.string(), z.any()),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const channelPatch = z.object(Object.fromEntries(ALERT_CHANNELS.map((c) => [c, z.boolean().optional()]))).strict();
const patchSchema = z.object({
  recap: z.object({ enabled: z.boolean().optional(), time: hhmm.optional() }).strict().optional(),
  alerts: z.object({
    language: z.enum(ALERT_LANGUAGES).nullable().optional(),
    channels: z.object({ recap: channelPatch.optional(), alerts: channelPatch.optional() }).strict().optional(),
    instant: z.object(Object.fromEntries(ALERT_TYPES.map((t) => [t, z.boolean().optional()]))).strict().optional(),
    quietHours: z.object({ enabled: z.boolean().optional(), from: hhmm.optional(), to: hhmm.optional() }).strict().optional(),
    includePhoneInWhatsApp: z.boolean().optional(),
    recipients: z.object({
      emails: z.array(z.object({ address: z.string().trim().email().max(200), name: z.string().trim().max(80).optional() }))
        .max(MAX_EMAIL_RECIPIENTS).optional(),
      whatsapp: z.array(z.object({
        number: z.string().trim().min(6).max(30),
        name: z.string().trim().min(1).max(60),
        consent: z.boolean().optional(),
        resubscribe: z.boolean().optional(),
      })).max(MAX_WHATSAPP_RECIPIENTS).optional(),
    }).strict().optional(),
  }).strict().optional(),
}).strict();

const testSchema = z.object({ channel: z.enum(["email", "whatsapp"]), type: z.enum(emailTypes) }).strict();

export function registerClientAlertsRoutes(app: Express): void {
  app.post("/api/internal/client-alerts/email", wrapAsync(async (req, res) => {
    if (!internalKeyOk(req)) return res.status(401).json({ message: "invalid internal key" });
    const parsed = emailBodySchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const body = parsed.data;
    let rendered;
    try {
      rendered = renderClientAlertEmail({
        type: body.type, language: body.language, accountName: body.accountName, link: body.link, data: body.data,
      });
    } catch (err: any) {
      console.error("[client-alerts] render failed:", err?.message);
      return res.json({ results: body.to.map((t) => ({ address: t.address, ok: false, error: "render_failed" })) });
    }
    const results = await Promise.all(body.to.map(async (t) => {
      try {
        const r = await sendRawEmail({ to: t.address, ...rendered, idempotencyKey: `${body.ledgerId}:${t.address.toLowerCase()}` });
        return { address: t.address, ok: true, provider: r.provider, id: r.id ?? null };
      } catch (err: any) {
        return { address: t.address, ok: false, error: String(err?.message ?? err).slice(0, 300), transient: true };
      }
    }));
    res.json({ results });
  }));

  app.get("/api/accounts/:id/alert-settings", requireAuth, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const settings = await storage.getAlertSettings(accountId);
    if (!settings) return res.status(404).json({ message: "Account not found" });
    res.json({ ...settings, canEdit: isAgency(req) });
  }));

  app.patch("/api/accounts/:id/alert-settings", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    try {
      const settings = await storage.patchAlertSettings(accountId, parsed.data as any);
      res.json({ ...settings, canEdit: true });
    } catch (err) {
      if (err instanceof AlertSettingsError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
  }));

  app.post("/api/accounts/:id/alert-settings/test", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const parsed = testSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    try {
      const resp = await fetch(`${getEngineUrl()}/internal/client-alerts/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
        body: JSON.stringify({ account_id: accountId, channel: parsed.data.channel, type: parsed.data.type }),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return res.json({ ok: false, error: resp.status === 404 ? "engine_not_restarted" : `engine_${resp.status}` });
      res.json(data);
    } catch {
      // 200 on purpose: Cloudflare swaps a 502 for its own page and the card loses the reason.
      res.json({ ok: false, error: "engine_unavailable" });
    }
  }));

  app.get("/api/go/:code", requireAuth, wrapAsync(async (req, res) => {
    const code = String(req.params.code || "");
    if (!/^[A-Za-z0-9]{8}$/.test(code)) return res.status(404).json({ message: "Not found" });
    const target = await storage.getAlertLinkTarget(code);
    const user = req.user;
    if (!target || (user && user.accountsId !== 1 && user.accountsId !== target.accountsId)) {
      return res.status(404).json({ message: "Not found" });
    }
    if (req.query.to === "settings") {
      // The email footer's "choose which emails you get" link.
      return res.json({ path: "/platform/accounts?tab=alerts", selectAccountId: target.accountsId, accountId: target.accountsId });
    }
    const t = target.eventType;
    if (target.leadsId && t !== "daily_recap") {
      // The Leads page shows the conversation and the booking side by side.
      return res.json({ path: "/platform/leads", selectLeadId: target.leadsId, accountId: target.accountsId });
    }
    if (target.voiceCallId) {
      return res.json({ path: "/platform/voice-calls", selectVoiceCallId: target.voiceCallId, accountId: target.accountsId });
    }
    res.json({ path: "/platform/leads", accountId: target.accountsId });
  }));
}
