import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAgency } from "../auth";
import { getEngineUrl, handleZodError, wrapAsync } from "./_helpers";
import { WhatsappSenderError } from "../storage/whatsappSenders";

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

function accountIdFor(req: Request, res: Response): number | null {
  const accountId = Number(req.params.id);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    res.status(400).json({ message: "Invalid account id" });
    return null;
  }
  return accountId;
}

export function registerWhatsappCloudRoutes(app: Express): void {
  app.get("/api/accounts/:id/whatsapp-sender", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
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
      res.json({ sender: await storage.saveWhatsappSender(accountId, parsed.data) });
    } catch (err) {
      if (err instanceof WhatsappSenderError) return res.status(err.status).json({ message: err.message, code: err.code });
      throw err;
    }
  }));

  // Reads the number at Meta with the saved details and marks the sender
  // connected or failed. The engine does the work; the sender is re-read here.
  app.post("/api/accounts/:id/whatsapp-sender/test", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
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
