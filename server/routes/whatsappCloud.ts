import type { Express, Request, Response } from "express";
import { z } from "zod";
import { randomInt } from "crypto";
import { storage } from "../storage";
import { requireAgency, requireAuth, scopeToAccount } from "../auth";
import { accountIdFor, getEngineUrl, handleZodError, wrapAsync } from "./_helpers";
import { WhatsappSenderError } from "../storage/whatsappSenders";
import { canManageSocial } from "../social/access";

// Per-client WhatsApp on Meta's Cloud API (specs/receptionist-channels Phase 4):
// the account's sender details and its message templates. Agency only.
//
// Secrets go in through PUT and never come back: reads answer hasAppSecret and
// hasToken. Everything that talks to Meta runs in the engine, which holds the
// template catalog and opens the sealed secrets itself.

const metaId = (label: string) => z.string().trim().regex(/^\d{5,30}$/, `${label} must be digits only`);
const secret = z.string().trim().max(1000).optional();

const senderBodySchema = z.object({
  wabaId: metaId("WhatsApp Business account id"),
  phoneNumberId: metaId("Phone number id"),
  appId: metaId("App id"),
  appSecret: secret,
  accessToken: secret,
}).strict();

const connectBodySchema = z.object({
  code: z.string().trim().min(10).max(2000),
  wabaId: metaId("WhatsApp Business account id"),
  phoneNumberId: metaId("Phone number id").nullable().optional(),
  // app: the number stays on the client's WhatsApp Business app. new: Cloud API only.
  mode: z.enum(["app", "new"]),
}).strict();

// Lead Awaker's own Meta app, the one Embedded Signup runs on. Its id is public
// (the browser SDK embeds it); its secret only ever lives here.
const META_APP_ID = process.env.META_APP_ID || process.env.VITE_META_APP_ID || "1431602527965445";
const GRAPH = "https://graph.facebook.com/v21.0";

class MetaConnectError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

async function graph(path: string, token: string | null, init?: RequestInit): Promise<Record<string, any>> {
  let resp: globalThis.Response;
  try {
    resp = await fetch(`${GRAPH}/${path}`, {
      ...init,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MetaConnectError("meta_unreachable", "Meta could not be reached");
  }
  const data = (await resp.json().catch(() => ({}))) as Record<string, any>;
  if (!resp.ok) throw new MetaConnectError("meta_refused", data?.error?.message || `Meta answered ${resp.status}`);
  return data;
}

/**
 * Finish Embedded Signup: swap the popup's code for the client's token, find
 * the number when Meta did not name it, and subscribe our app to the client's
 * account so its messages reach the engine's webhook.
 */
async function finishSignup(accountId: number, mode: "app" | "new", code: string, wabaId: string, phoneNumberId?: string | null) {
  const appSecret = process.env.META_APP_SECRET || "";
  if (!appSecret) throw new MetaConnectError("app_secret_missing", "META_APP_SECRET is not set on the server");
  const q = new URLSearchParams({ client_id: META_APP_ID, client_secret: appSecret, code });
  const accessToken = String((await graph(`oauth/access_token?${q}`, null)).access_token || "");
  if (!accessToken) throw new MetaConnectError("meta_refused", "Meta returned no token");

  let numberId = phoneNumberId || "";
  if (!numberId) {
    const numbers = (await graph(`${wabaId}/phone_numbers?fields=id`, accessToken)).data;
    if (!Array.isArray(numbers) || numbers.length !== 1) {
      throw new MetaConnectError("number_unclear", "The WhatsApp account has no number, or more than one");
    }
    numberId = String(numbers[0].id);
  }
  // Before anything at Meta changes: a number on another account must keep
  // its PIN, and the one-time history sync must not be spent on a failed connect.
  const takenBy = await storage.whatsappNumberTakenBy(numberId);
  if (takenBy != null && takenBy !== accountId) {
    throw new WhatsappSenderError(409, "number_in_use", "This phone number id is already connected to another account");
  }
  await graph(`${wabaId}/subscribed_apps`, accessToken, { method: "POST" });

  // A number that is only on the Cloud API has to be registered, with a
  // two-step PIN we choose here. A number on the WhatsApp Business app is
  // registered already and must be left alone.
  // A number that stays on the WhatsApp Business app: ask Meta for the owner's
  // contacts and chat history now. Meta allows this once, within 24 hours; the
  // engine marks those customers as the owner's own (whatsapp_coexistence.py).
  if (mode === "app") {
    for (const syncType of ["smb_app_state_sync", "history"]) {
      try {
        await graph(`${numberId}/smb_app_data`, accessToken, {
          method: "POST",
          body: new URLSearchParams({ messaging_product: "whatsapp", sync_type: syncType }),
        });
      } catch (err) {
        console.warn(`[whatsapp-connect] ${syncType} sync not started:`, err instanceof Error ? err.message : err);
      }
    }
  }

  let twoStepPin: string | undefined;
  if (mode === "new") {
    twoStepPin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const q2 = new URLSearchParams({ messaging_product: "whatsapp", pin: twoStepPin });
    await graph(`${numberId}/register?${q2}`, accessToken, { method: "POST" });
  }
  return { wabaId, phoneNumberId: numberId, appId: META_APP_ID, appSecret, accessToken, onboardingMode: mode, twoStepPin };
}

const behaviourSchema = z.object({
  aiScope: z.enum(["all", "new_only", "off"]).optional(),
  resumeAfterHours: z.number().int().min(1).max(720).nullable().optional(),
  resumeCommand: z.string().trim().min(2).max(20).regex(/^\S+$/).optional(),
}).strict();

const submitBodySchema = z.object({
  languages: z.array(z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/)).max(10).optional(),
  name: z.string().trim().regex(/^[a-z0-9_]{1,100}$/).optional(),
  language: z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/).optional(),
}).strict();

interface EngineReply { reached: boolean; status: number; data: Record<string, any> }

/** Call an engine internal route. Never throws: `reached` is false when the engine is down or the route is missing. */
async function engine(method: "GET" | "POST", path: string, body?: unknown, timeoutMs = 30_000): Promise<EngineReply> {
  try {
    const resp = await fetch(`${getEngineUrl()}/internal/whatsapp/${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await resp.json().catch(() => ({}));
    return { reached: resp.ok, status: resp.status, data: (data ?? {}) as Record<string, any> };
  } catch {
    return { reached: false, status: 0, data: {} };
  }
}

// Answered with 200 on purpose: Cloudflare swaps a 502 from this server for its
// own HTML error page, and the card would lose the reason.
const ENGINE_DOWN = { ok: false, errorCode: "engine_unavailable", error: "The automation engine did not answer" };

/** One template row as the client reads it (the engine speaks snake_case). */
function toRow(r: Record<string, any>) {
  return {
    name: String(r.name),
    language: String(r.language),
    version: Number(r.version ?? 0),
    category: r.category ?? null,
    status: String(r.status ?? "not_submitted"),
    outdated: !!r.outdated,
    canResubmit: !!r.can_resubmit,
    rejectedReason: r.rejected_reason ?? null,
    body: r.body ?? "",
    preview: r.preview ?? "",
    submittedAt: r.submitted_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

const rowsOf = (data: Record<string, any>) => (Array.isArray(data.rows) ? data.rows.map(toRow) : undefined);


// The sender card a client Manager uses to connect their own number at Meta:
// read, connect and test. Saving by hand, behaviour and templates stay agency-only.
function senderAccountFor(req: Request, res: Response): number | null {
  const accountId = accountIdFor(req, res);
  if (accountId == null) return null;
  if (!canManageSocial(req.user, accountId)) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return accountId;
}

export function registerWhatsappCloudRoutes(app: Express): void {
  // Chats reply box (clients): can a human reply reach a WhatsApp contact? Only
  // when the account has its own connected sender. Yes/no only, no sender details.
  app.get("/api/whatsapp-sender/has-own", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forced = (req as any).forcedAccountId as number | undefined;
    const accountId = forced ?? Number(req.query.accountId);
    if (!Number.isInteger(accountId) || accountId <= 0) return res.json({ hasOwn: false });
    const sender = await storage.getWhatsappSender(accountId);
    res.json({ hasOwn: !!sender && sender.status === "connected" });
  }));

  app.get("/api/accounts/:id/whatsapp-sender", requireAuth, wrapAsync(async (req, res) => {
    const accountId = senderAccountFor(req, res);
    if (accountId == null) return;
    res.json({ sender: await storage.getWhatsappSender(accountId) });
  }));

  app.put("/api/accounts/:id/whatsapp-sender", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const parsed = senderBodySchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    if (!(await storage.getAccountById(accountId))) return res.status(404).json({ message: "Account not found" });
    try {
      res.json({ sender: await storage.saveWhatsappSender(accountId, { ...parsed.data, onboardingMode: null }) });
    } catch (err) {
      if (err instanceof WhatsappSenderError) return res.status(err.status).json({ message: err.message, code: err.code });
      throw err;
    }
  }));

  app.put("/api/accounts/:id/whatsapp-sender/behaviour", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const parsed = behaviourSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const sender = await storage.saveWhatsappBehaviour(accountId, parsed.data);
    if (!sender) return res.status(404).json({ message: "No WhatsApp number connected" });
    res.json({ sender });
  }));

  // Meta's Embedded Signup popup finished in the browser: no values to paste.
  app.post("/api/accounts/:id/whatsapp-sender/connect", requireAuth, wrapAsync(async (req, res) => {
    const accountId = senderAccountFor(req, res);
    if (accountId == null) return;
    const parsed = connectBodySchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    if (!(await storage.getAccountById(accountId))) return res.status(404).json({ message: "Account not found" });
    try {
      const input = await finishSignup(accountId, parsed.data.mode, parsed.data.code, parsed.data.wabaId, parsed.data.phoneNumberId);
      res.json({ sender: await storage.saveWhatsappSender(accountId, input) });
    } catch (err) {
      if (err instanceof MetaConnectError) return res.status(422).json({ message: err.message, code: err.code });
      if (err instanceof WhatsappSenderError) return res.status(err.status).json({ message: err.message, code: err.code });
      throw err;
    }
  }));

  // Reads the number at Meta with the saved details and marks the sender
  // connected or failed. The engine does the work; the sender is re-read here.
  app.post("/api/accounts/:id/whatsapp-sender/test", requireAuth, wrapAsync(async (req, res) => {
    const accountId = senderAccountFor(req, res);
    if (accountId == null) return;
    const reply = await engine("POST", `${accountId}/test-connection`);
    if (!reply.reached) return res.json(ENGINE_DOWN);
    res.json({
      ok: !!reply.data.ok,
      errorCode: reply.data.error_code ?? null,
      error: reply.data.error ?? null,
      metaDetail: reply.data.meta_detail ?? null,
      checks: reply.data.checks ?? {},
      warnings: Array.isArray(reply.data.warnings) ? reply.data.warnings : [],
      sender: await storage.getWhatsappSender(accountId),
    });
  }));

  app.get("/api/accounts/:id/whatsapp-templates", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const reply = await engine("GET", `${accountId}/templates`, undefined, 10_000);
    const rows = reply.reached ? rowsOf(reply.data) : undefined;
    if (rows) return res.json({ catalogAvailable: true, rows });
    // Engine down: show what is stored, without the texts only the catalog has.
    const stored = await storage.listWhatsappTemplates(accountId);
    res.json({
      catalogAvailable: false,
      rows: stored.map((t) => toRow({
        name: t.name, language: t.language, version: t.catalogVersion, category: t.category,
        status: t.status === "not_submitted" ? t.status : t.status.toLowerCase(),
        rejected_reason: t.rejectedReason,
        submitted_at: t.submittedAt?.toISOString() ?? null, updated_at: t.updatedAt?.toISOString() ?? null,
      })),
    });
  }));

  // Body {} = "Submit all" (missing and outdated). {name, language} = resubmit that one row.
  app.post("/api/accounts/:id/whatsapp-templates/submit", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const parsed = submitBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) return handleZodError(res, parsed.error);
    const reply = await engine("POST", `${accountId}/templates/submit`, parsed.data, 90_000);
    if (!reply.reached) return res.json(ENGINE_DOWN);
    res.json({
      ok: !!reply.data.ok,
      errorCode: reply.data.error_code ?? null,
      error: reply.data.error ?? null,
      submitted: Number(reply.data.submitted ?? 0),
      failed: Number(reply.data.failed ?? 0),
      results: Array.isArray(reply.data.results) ? reply.data.results : [],
      rows: rowsOf(reply.data) ?? null,
    });
  }));

  app.post("/api/accounts/:id/whatsapp-templates/refresh", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const reply = await engine("POST", `${accountId}/templates/refresh`, undefined, 60_000);
    if (!reply.reached) return res.json(ENGINE_DOWN);
    res.json({
      ok: !!reply.data.ok,
      errorCode: reply.data.error_code ?? null,
      error: reply.data.error ?? null,
      rows: rowsOf(reply.data) ?? null,
    });
  }));
}
