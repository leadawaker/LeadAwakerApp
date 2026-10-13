import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { NumberRequest } from "@shared/schema";
import { storage } from "../storage";
import { requireAgency } from "../auth";
import { createAndDispatchNotification } from "../notification-dispatcher";
import { NUMBER_DOC_KINDS } from "../storage/numberRequests";
import { handleZodError, wrapAsync } from "./_helpers";
import { placeOrder, refreshOrder, searchNumbers, telnyxFetch, TelnyxOrderError } from "../numberRequests/telnyxOrder";

// The client's side of getting a phone number in their own name: a private
// link (/number-docs/<token>) where they fill in the company details and hand
// in the documents the carrier asks for.
//
// A file is held in memory only for the moment it takes to pass it on to
// Telnyx's document store. Nothing is written to this server's disk or
// database except the file's name and its Telnyx id.

const AGENCY_ACCOUNT_ID = 1;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const UPLOADS_PER_HOUR = 20;

const field = z.string().trim().max(200);
const detailsSchema = z.object({
  legalName: field, kvkNumber: field, representative: field, contactPhone: field,
  street: field, postalCode: field, city: field,
}).strict();
const DETAIL_KEYS = Object.keys(detailsSchema.shape);

const planSchema = z.object({
  areaCode: z.string().trim().regex(/^0?\d{2,3}$/).nullable().optional(),
  preferredNumber: z.string().trim().regex(/^\+31\d{9}$/).nullable().optional(),
  autoOrder: z.boolean().optional(),
}).strict();

const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(FILE_TYPES as [string, ...string[]]),
  // base64 of the file
  data: z.string().min(1),
}).strict();

/** What the client's page may see: no Telnyx ids, no account id. */
function publicView(row: NumberRequest, companyName: string) {
  return {
    companyName,
    status: row.status,
    details: row.details,
    documents: row.documents.map((d) => ({ kind: d.kind, filename: d.filename, uploadedAt: d.uploadedAt })),
  };
}

const uploads = new Map<string, number[]>();
function uploadAllowed(token: string): boolean {
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recent = (uploads.get(token) ?? []).filter((t) => t > cutoff);
  if (recent.length >= UPLOADS_PER_HOUR) return false;
  uploads.set(token, [...recent, Date.now()]);
  return true;
}

// A document upload can be a few MB over a slow line: twice the usual wait.
const telnyx = (path: string, init: RequestInit) => telnyxFetch(path, init, 60_000);

// Buying a number costs money: one order at a time per request, whoever asks
// (a double click, a retried submit). The server is one process, so a set will do.
const ordering = new Set<number>();
async function orderOnce(row: NumberRequest, companyName: string): Promise<NumberRequest | null> {
  if (ordering.has(row.id)) return null;
  ordering.add(row.id);
  try {
    return await storage.saveNumberRequestOrder(row.id, await placeOrder(row, companyName));
  } finally {
    ordering.delete(row.id);
  }
}

async function openRow(req: Request, res: Response): Promise<NumberRequest | null> {
  const token = String(req.params.token || "");
  const row = /^[A-Za-z0-9_-]{20,40}$/.test(token) ? await storage.getNumberRequestByToken(token) : null;
  if (!row) { res.status(404).json({ message: "This link is not valid" }); return null; }
  return row;
}

async function companyNameOf(accountId: number): Promise<string> {
  return (await storage.getAccountById(accountId))?.name ?? "";
}

export function registerNumberRequestRoutes(app: Express): void {
  // ── Agency: the card on the account's Integrations tab ────────────────────
  app.get("/api/accounts/:id/number-request", requireAgency, wrapAsync(async (req, res) => {
    let row = await storage.getNumberRequest(Number(req.params.id));
    // A pending order is re-read from Telnyx at most once a minute.
    const order = row?.numberOrder;
    if (row && order?.status === "pending" && Date.now() - Date.parse(order.checkedAt) > 60_000) {
      row = await storage.saveNumberRequestOrder(row.id, await refreshOrder(order));
    }
    res.json({ request: row });
  }));

  // Numbers in stock for an area code, to pick one before the client submits.
  app.get("/api/accounts/:id/number-request/available", requireAgency, wrapAsync(async (req, res) => {
    const areaCode = String(req.query.areaCode || "").replace(/^0/, "");
    if (!/^\d{2,3}$/.test(areaCode)) return res.status(400).json({ message: "Area code must be 2 or 3 digits" });
    try {
      res.json({ numbers: await searchNumbers(areaCode) });
    } catch (err) {
      if (err instanceof TelnyxOrderError) return res.status(502).json({ message: err.message });
      throw err;
    }
  }));

  app.put("/api/accounts/:id/number-request/plan", requireAgency, wrapAsync(async (req, res) => {
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const row = await storage.getNumberRequest(Number(req.params.id));
    if (!row) return res.status(404).json({ message: "No request yet" });
    if (row.numberOrder && row.numberOrder.status !== "failure") return res.status(409).json({ message: "Already ordered" });
    const plan = { ...parsed.data, ...(parsed.data.areaCode ? { areaCode: parsed.data.areaCode.replace(/^0/, "") } : {}) };
    res.json({ request: await storage.saveNumberRequestPlan(row.id, plan) });
  }));

  // Order now (after the client submitted), or again after a failure.
  app.post("/api/accounts/:id/number-request/order", requireAgency, wrapAsync(async (req, res) => {
    const row = await storage.getNumberRequest(Number(req.params.id));
    if (!row) return res.status(404).json({ message: "No request yet" });
    if (row.status !== "submitted") return res.status(409).json({ message: "The client has not submitted yet" });
    if (row.numberOrder && row.numberOrder.status !== "failure") return res.status(409).json({ message: "Already ordered" });
    const saved = await orderOnce(row, await companyNameOf(row.accountsId));
    if (!saved) return res.status(409).json({ message: "Already ordering" });
    res.json({ request: saved });
  }));

  app.post("/api/accounts/:id/number-request", requireAgency, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    if (!(await storage.getAccountById(accountId))) return res.status(404).json({ message: "Account not found" });
    res.json({ request: await storage.openNumberRequest(accountId) });
  }));

  // ── Public: the client's page, by token ───────────────────────────────────
  app.get("/api/number-request/:token", wrapAsync(async (req, res) => {
    const row = await openRow(req, res);
    if (row) res.json(publicView(row, await companyNameOf(row.accountsId)));
  }));

  app.put("/api/number-request/:token/details", wrapAsync(async (req, res) => {
    const row = await openRow(req, res);
    if (!row) return;
    if (row.status !== "open") return res.status(409).json({ message: "Already sent" });
    const parsed = detailsSchema.partial().safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const saved = await storage.saveNumberRequestDetails(row.id, { ...row.details, ...parsed.data });
    res.json(publicView(saved, await companyNameOf(row.accountsId)));
  }));

  app.post("/api/number-request/:token/documents/:kind", wrapAsync(async (req, res) => {
    const row = await openRow(req, res);
    if (!row) return;
    if (row.status !== "open") return res.status(409).json({ message: "Already sent" });
    const kind = NUMBER_DOC_KINDS.find((k) => k === req.params.kind);
    if (!kind) return res.status(400).json({ message: "Unknown document" });
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const bytes = Buffer.from(parsed.data.data, "base64");
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) return res.status(413).json({ message: "File too large", code: "too_large" });
    if (!uploadAllowed(row.token)) return res.status(429).json({ message: "Too many uploads", code: "too_many" });

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: parsed.data.contentType }), parsed.data.filename);
    form.append("customer_reference", `account-${row.accountsId}-${kind}`);
    const resp = await telnyx("documents", { method: "POST", body: form }).catch(() => null);
    const body = resp ? ((await resp.json().catch(() => ({}))) as any) : {};
    const documentId = body?.data?.id;
    if (!resp?.ok || !documentId) {
      console.error(`[number-request] Telnyx upload failed (${resp?.status ?? "no answer"}):`, JSON.stringify(body?.errors ?? body).slice(0, 400));
      return res.status(502).json({ message: "The upload did not go through", code: "upload_failed" });
    }
    const replaced = await storage.putNumberRequestDocument(row, {
      kind, telnyxDocumentId: String(documentId), filename: parsed.data.filename, uploadedAt: new Date().toISOString(),
    });
    // The earlier file of this kind is no longer wanted: remove it at Telnyx too.
    if (replaced) telnyx(`documents/${replaced.telnyxDocumentId}`, { method: "DELETE" }).catch(() => {});
    const fresh = await storage.getNumberRequestByToken(row.token);
    res.json(publicView(fresh ?? row, await companyNameOf(row.accountsId)));
  }));

  app.post("/api/number-request/:token/submit", wrapAsync(async (req, res) => {
    const row = await openRow(req, res);
    if (!row) return;
    const companyName = await companyNameOf(row.accountsId);
    if (row.status !== "open") return res.json(publicView(row, companyName));
    if (DETAIL_KEYS.some((k) => !row.details[k]?.trim())) return res.status(422).json({ message: "Details missing", code: "details_missing" });
    const submitted = await storage.submitNumberRequest(row.id);
    // A second submit (two tabs, a retry) finds it already sent: no second order.
    if (!submitted) return res.json(publicView((await storage.getNumberRequestByToken(row.token)) ?? row, companyName));
    let saved = submitted;
    // Ordered by itself when Gabriel set that up: the client never waits on it.
    let orderNote = "";
    const ordered = saved.autoOrder && saved.areaCode ? await orderOnce(saved, companyName) : null;
    if (ordered) {
      saved = ordered;
      const o = saved.numberOrder!;
      orderNote = o.status === "failure" ? ` · ordering failed: ${o.error}` : ` · ${o.phoneNumber} ordered, Telnyx is checking the documents`;
    }
    const users = (await storage.getAppUsers()).filter((u: any) => u.accountsId === AGENCY_ACCOUNT_ID);
    for (const user of users) {
      createAndDispatchNotification({
        type: "number_request_submitted",
        title: `${companyName || "A client"} sent the details for their phone number`,
        body: `${saved.documents.length} of ${NUMBER_DOC_KINDS.length} documents uploaded${orderNote}`,
        userId: user.id!,
        accountId: AGENCY_ACCOUNT_ID,
        read: false,
        link: "/platform/accounts",
      } as any).catch((err: any) => console.error(`[number-request] notify user ${user.id} failed:`, err.message));
    }
    res.json(publicView(saved, companyName));
  }));
}
