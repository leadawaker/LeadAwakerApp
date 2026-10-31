import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isValidInternalKey, requireAgency, requireAuth } from "../auth";
import { editLevelForRequest } from "./clientEditAccess";
import { accountIdFor, getEngineUrl, handleZodError, wrapAsync } from "./_helpers";
import { sendRawEmail, type EmailAttachment } from "../email";
import { renderClientAlertEmail } from "../clientAlerts/renderEmail";
import { AlertSettingsError } from "../storage/clientAlerts";
import { parseGoLinkParams } from "@shared/goLinkParams";
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

/** Photo caps per email: one photo above MAX_PHOTO_BYTES goes by link only,
 *  and the set stops at MAX_PHOTOS or MAX_PHOTOS_BYTES (Resend allows 40 MB
 *  per email, base64 included). The rest is one click away in the CRM. */
const MAX_PHOTO_BYTES = 4_000_000;
const MAX_PHOTOS = 10;
const MAX_PHOTOS_BYTES = 15_000_000;
const PHOTO_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** new_photo: the photos of one bundle, from their Interactions rows (the
 *  engine sends the row ids, never the images). A photo that is missing,
 *  belongs to another lead or is over a cap is left out and counted in
 *  `left`. Older single-photo rows carry one top-level interaction_id. */
async function loadAlertPhotos(data: Record<string, any>): Promise<{ files: EmailAttachment[]; shown: number[]; left: number }> {
  const items: any[] = Array.isArray(data.photos) && data.photos.length
    ? data.photos
    : data.interaction_id ? [{ interaction_id: data.interaction_id }] : [];
  const c = data.customer ?? {};
  const who = [c.first, c.last].filter(Boolean).join(" ").trim();
  const files: EmailAttachment[] = [];
  const shown: number[] = [];
  let total = 0;
  for (const [index, item] of items.entries()) {
    if (files.length >= MAX_PHOTOS) break;
    const id = Number(item?.interaction_id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const row = await storage.getInteractionById(id).catch(() => null);
    if (!row?.attachment || (data.lead_id && row.leadsId !== Number(data.lead_id))) continue;
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(row.attachment);
    if (!m) continue;
    const content = m[2].replace(/\s/g, "");
    const bytes = Math.floor(content.length * 3 / 4);
    if (bytes > MAX_PHOTO_BYTES || total + bytes > MAX_PHOTOS_BYTES) continue;
    total += bytes;
    const slug = (who && !who.startsWith("+") ? who : `lead-${row.leadsId ?? id}`)
      .normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "lead";
    const day = new Date(row.createdAt ?? Date.now()).toISOString().slice(0, 10);
    const n = files.length + 1;
    files.push({
      filename: `photo-${slug}-${day}${items.length > 1 ? `-${n}` : ""}.${PHOTO_EXT[m[1]] ?? "jpg"}`,
      contentType: m[1], content, contentId: `lead-photo-${n}`,
    });
    shown.push(index);
  }
  return { files, shown, left: Math.max(0, items.length - files.length) };
}

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

const testSchema = z.object({ channel: z.enum(["email", "whatsapp"]), type: z.enum(emailTypes), onlyMe: z.boolean().optional() }).strict();

export function registerClientAlertsRoutes(app: Express): void {
  app.post("/api/internal/client-alerts/email", wrapAsync(async (req, res) => {
    if (!internalKeyOk(req)) return res.status(401).json({ message: "invalid internal key" });
    const parsed = emailBodySchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const body = parsed.data;
    const photos = body.type === "new_photo"
      ? await loadAlertPhotos(body.data).catch(() => ({ files: [] as EmailAttachment[], shown: [] as number[], left: 0 }))
      : null;
    let rendered;
    try {
      rendered = renderClientAlertEmail({
        type: body.type, language: body.language, accountName: body.accountName, link: body.link, data: body.data,
        photos: photos ? { contentIds: photos.files.map((f) => f.contentId as string), shown: photos.shown, left: photos.left } : null,
      });
    } catch (err: any) {
      console.error("[client-alerts] render failed:", err?.message);
      return res.json({ results: body.to.map((t) => ({ address: t.address, ok: false, error: "render_failed" })) });
    }
    const results = await Promise.all(body.to.map(async (t) => {
      try {
        const r = await sendRawEmail({
          to: t.address, ...rendered, idempotencyKey: `${body.ledgerId}:${t.address.toLowerCase()}`,
          ...(photos?.files.length ? { attachments: photos.files } : {}),
        });
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
    res.json({ ...settings, canEdit: editLevelForRequest(req, accountId) !== "none" });
  }));

  app.patch("/api/accounts/:id/alert-settings", requireAuth, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    if (editLevelForRequest(req, accountId) === "none") return res.status(403).json({ message: "Forbidden" });
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

  app.post("/api/accounts/:id/alert-settings/test", requireAuth, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    if (editLevelForRequest(req, accountId) === "none") return res.status(403).json({ message: "Forbidden" });
    const parsed = testSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    try {
      const resp = await fetch(`${getEngineUrl()}/internal/client-alerts/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
        body: JSON.stringify({ account_id: accountId, channel: parsed.data.channel, type: parsed.data.type, only_me: parsed.data.onlyMe === true }),
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
    const params = parseGoLinkParams(new URLSearchParams(req.query as Record<string, string>).toString());
    if (params.to === "settings") {
      // The email footer's "choose which emails you get" link.
      return res.json({ path: "/platform/settings?tab=alerts", selectAccountId: target.accountsId, accountId: target.accountsId });
    }
    if (params.to === "calls") {
      // The recap's "See all N calls".
      return res.json({ path: "/platform/voice-calls", accountId: target.accountsId });
    }
    if (params.call) {
      // One call row in the recap: only a live call of the code's own account opens; anything else falls back to the Calls page.
      const call = await storage.getVoiceCall(params.call, { accountId: target.accountsId, allowDemo: false }).catch(() => undefined);
      return res.json({ path: "/platform/voice-calls", ...(call ? { selectVoiceCallId: params.call } : {}), accountId: target.accountsId });
    }
    if (params.lead) {
      // One chat row in the recap: only a lead of the code's own account is preselected; anything else opens the Leads page.
      const lead = await storage.getLeadById(params.lead).catch(() => undefined);
      return res.json({ path: "/platform/leads", ...(lead?.accountsId === target.accountsId ? { selectLeadId: params.lead } : {}), accountId: target.accountsId });
    }
    const t = target.eventType;
    // A callback request or message from a phone call opens that call (its
    // recording and transcript hold the request); a chat callback has no call
    // and opens the lead's chat below. A caller who hung up right away opens
    // their call too (the row may carry a lead id; the call still comes first).
    if ((t === "callback_requested" || t === "caller_hung_up") && target.voiceCallId) {
      return res.json({ path: "/platform/voice-calls", selectVoiceCallId: target.voiceCallId, accountId: target.accountsId });
    }
    // Appointment alerts open where the booking happened: the phone call, the
    // chat, or (source unknown) the Calendar.
    if (target.open === "call" && target.voiceCallId) {
      return res.json({ path: "/platform/voice-calls", selectVoiceCallId: target.voiceCallId, accountId: target.accountsId });
    }
    if (target.open === "chat" && target.leadsId) {
      return res.json({ path: "/platform/leads", selectLeadId: target.leadsId, accountId: target.accountsId });
    }
    if (target.open) {
      return res.json({ path: "/platform/calendar", accountId: target.accountsId });
    }
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
