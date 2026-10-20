import type { Express, Request, Response } from "express";
import { Readable } from "node:stream";
import { storage } from "../storage";
import { requireAuth, scopeToAccount } from "../auth";
import { wrapAsync } from "./_helpers";
import { decideScope, hidesTestData, resolveVoiceAccess, type VoiceAccess } from "./voiceCallsAccess";
import { registerVoiceCallersRoutes } from "./voiceCallers";

const ENGINE_BASE = process.env.ENGINE_URL || "http://localhost:8100";
const guards = [requireAuth, scopeToAccount];

/**
 * Every route here is open to any signed-in user, so the access rule lives in
 * the server and nowhere else: clients see only their own account's Live calls,
 * only the Owner (not impersonating) may query Demo, and a call outside the
 * caller's reach answers 404 so its existence does not leak.
 * scopeToAccount rejects the internal-key bypass (no session user), on purpose.
 */
function accessOf(req: Request): VoiceAccess {
  const user = req.user!;
  return resolveVoiceAccess({
    role: user.role,
    accountsId: user.accountsId ?? null,
    impersonatedAccountId: req.session?.impersonation?.accountId ?? null,
    impersonatedRole: req.session?.impersonation?.role ?? null,
  });
}

async function loadAllowedCall(req: Request) {
  const access = accessOf(req);
  return storage.getVoiceCall(String(req.params.callId), {
    accountId: access.lockedAccountId,
    allowDemo: access.isOwner,
    includeAccountName: access.isAgency,
    hideTest: hidesTestData(access),
  });
}

async function proxyRecording(req: Request, res: Response): Promise<void> {
  const call = await loadAllowedCall(req);
  if (!call || !call.sessionId) {
    res.status(404).json({ message: "Call not found" });
    return;
  }
  const ctl = new AbortController();
  res.on("close", () => ctl.abort());
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(`${ENGINE_BASE}/voice/live/recording/${encodeURIComponent(call.sessionId)}`, {
      headers: { "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
      signal: ctl.signal,
    });
  } catch {
    if (!res.headersSent) res.status(502).json({ message: "Recording unavailable" });
    return;
  }
  if (!upstream.ok || !upstream.body) {
    res.status(502).json({ message: "Recording unavailable" });
    return;
  }
  res.status(200);
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Cache-Control", "private, no-store");
  const len = upstream.headers.get("content-length");
  if (len) res.setHeader("Content-Length", len);
  Readable.fromWeb(upstream.body as never).on("error", () => res.destroy()).pipe(res);
}

export function registerVoiceCallsRoutes(app: Express): void {
  app.get("/api/voice-calls/capabilities", ...guards, wrapAsync(async (req, res) => {
    res.json(await storage.getVoiceCapabilities(accessOf(req)));
  }));

  app.get("/api/voice-calls/stats", ...guards, wrapAsync(async (req, res) => {
    const access = accessOf(req);
    const decision = decideScope(access, req.query);
    if (!decision.ok) return res.status(decision.status).json({ message: "Owner access required" });
    res.json(await storage.getVoiceStats({ scope: decision.scope, accountId: decision.accountId, hideTest: hidesTestData(access) }));
  }));

  app.get("/api/voice-calls", ...guards, wrapAsync(async (req, res) => {
    const access = accessOf(req);
    const decision = decideScope(access, req.query);
    if (!decision.ok) return res.status(decision.status).json({ message: "Owner access required" });
    // One person's calls (People tab) are never capped by the list's 200 rows.
    const leadId = Number(req.query.leadId);
    const callerNumber = typeof req.query.number === "string" && req.query.number.trim() ? req.query.number.trim() : undefined;
    const person = Number.isInteger(leadId) && leadId > 0 ? { leadId } : callerNumber ? { callerNumber } : null;
    const maxLimit = person ? 1000 : 200;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), maxLimit);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const calls = await storage.listVoiceCalls({
      limit,
      offset,
      scope: decision.scope,
      accountId: decision.accountId,
      includeAccountName: access.isAgency,
      hideTest: hidesTestData(access),
      ...person,
    });
    res.json({ calls });
  }));

  // Calendar detail: the call that booked this lead's appointment, if any.
  app.get("/api/voice-calls/for-lead/:leadId", ...guards, wrapAsync(async (req, res) => {
    const leadId = Number(req.params.leadId);
    if (!Number.isInteger(leadId) || leadId <= 0) return res.status(400).json({ message: "Bad lead id" });
    const access = accessOf(req);
    const callId = await storage.findBookingCallId(leadId, { accountId: access.lockedAccountId, allowDemo: access.isOwner, hideTest: hidesTestData(access) });
    res.json({ callId });
  }));

  // Before "/:callId", or "callers" would be read as a call id.
  registerVoiceCallersRoutes(app, guards, accessOf);

  app.get("/api/voice-calls/:callId/recording", ...guards, wrapAsync(proxyRecording));

  // Owner only (not impersonating): hide a call, and its lead, from clients and Home.
  app.patch("/api/voice-calls/:callId/test", ...guards, wrapAsync(async (req, res) => {
    if (!accessOf(req).isOwner) return res.status(403).json({ message: "Owner access required" });
    if (typeof req.body?.isTest !== "boolean") return res.status(400).json({ message: "isTest must be a boolean" });
    const ok = await storage.setCallTestFlag(String(req.params.callId), req.body.isTest);
    if (!ok) return res.status(404).json({ message: "Call not found" });
    res.json({ isTest: req.body.isTest });
  }));

  app.get("/api/voice-calls/:callId", ...guards, wrapAsync(async (req, res) => {
    const call = await loadAllowedCall(req);
    if (!call) return res.status(404).json({ message: "Call not found" });
    res.json(call);
  }));
}
