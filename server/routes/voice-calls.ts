import type { Express, Request, Response } from "express";
import { Readable } from "node:stream";
import { storage } from "../storage";
import { requireAuth, scopeToAccount } from "../auth";
import { wrapAsync } from "./_helpers";
import { decideScope, resolveVoiceAccess, type VoiceAccess } from "./voiceCallsAccess";

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
    const decision = decideScope(accessOf(req), req.query);
    if (!decision.ok) return res.status(decision.status).json({ message: "Owner access required" });
    res.json(await storage.getVoiceStats({ scope: decision.scope, accountId: decision.accountId }));
  }));

  app.get("/api/voice-calls", ...guards, wrapAsync(async (req, res) => {
    const access = accessOf(req);
    const decision = decideScope(access, req.query);
    if (!decision.ok) return res.status(decision.status).json({ message: "Owner access required" });
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const calls = await storage.listVoiceCalls({
      limit,
      offset,
      scope: decision.scope,
      accountId: decision.accountId,
      includeAccountName: access.isAgency,
    });
    res.json({ calls });
  }));

  app.get("/api/voice-calls/:callId/recording", ...guards, wrapAsync(proxyRecording));

  app.get("/api/voice-calls/:callId", ...guards, wrapAsync(async (req, res) => {
    const call = await loadAllowedCall(req);
    if (!call) return res.status(404).json({ message: "Call not found" });
    res.json(call);
  }));
}
