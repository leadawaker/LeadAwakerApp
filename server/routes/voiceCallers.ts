import type { Express, Request, RequestHandler } from "express";
import { storage } from "../storage";
import { wrapAsync } from "./_helpers";
import { decideScope, type VoiceAccess } from "./voiceCallsAccess";
import type { VoiceOutcome } from "@shared/voiceOutcome";

const ENGINE_BASE = process.env.ENGINE_URL || "http://localhost:8100";
const ENGINE_TIMEOUT_MS = 45_000;
const RECAP_CALLS = 5;

const OUTCOME_LABEL: Record<VoiceOutcome, string> = {
  booked: "Booked",
  callback: "Callback requested",
  transferred: "Transferred",
  hung_up: "Hung up",
  other: "Other",
};

function leadIdParam(req: Request): number | null {
  const n = Number(req.params.leadsId);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function engineError(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string" && d) return d;
    if (d !== undefined) return JSON.stringify(d);
  }
  return `HubSpot push failed (engine ${status})`;
}

/**
 * Callers view routes. Same guards and access rule as the calls routes:
 * the list goes through decideScope, and both actions first resolve the lead
 * through getCallerLead with the user's reach, so a demo lead or another
 * account's lead answers 404 and nothing is written.
 */
export function registerVoiceCallersRoutes(
  app: Express,
  guards: RequestHandler[],
  accessOf: (req: Request) => VoiceAccess,
): void {
  app.get("/api/voice-calls/callers", ...guards, wrapAsync(async (req, res) => {
    const access = accessOf(req);
    const decision = decideScope(access, req.query);
    if (!decision.ok) return res.status(decision.status).json({ message: "Owner access required" });
    const callers = await storage.listVoiceCallers({
      scope: decision.scope,
      accountId: decision.accountId,
      isOwner: access.isOwner,
      includeAccountName: access.isAgency,
    });
    res.json({ callers });
  }));

  app.post("/api/voice-calls/callers/:leadsId/call-back", ...guards, wrapAsync(async (req, res) => {
    const channel = req.body?.channel;
    if (channel !== "phone" && channel !== "whatsapp") {
      return res.status(400).json({ message: "channel must be phone or whatsapp" });
    }
    const leadsId = leadIdParam(req);
    if (leadsId === null) return res.status(404).json({ message: "Caller not found" });
    const access = accessOf(req);
    const lead = await storage.getCallerLead(leadsId, {
      accountId: access.lockedAccountId,
      allowDemo: access.isOwner,
    });
    if (!lead) return res.status(404).json({ message: "Caller not found" });
    const user = req.user!;
    const who = user.fullName1?.trim() || user.email || "User";
    const record = await storage.logCallBack({
      leadsId,
      accountId: lead.accountId,
      usersId: typeof user.id === "number" ? user.id : null,
      who,
      content: `Called back by ${who} (${channel})`,
    });
    res.json(record);
  }));

  app.post("/api/voice-calls/callers/:leadsId/hubspot", ...guards, wrapAsync(async (req, res) => {
    const access = accessOf(req);
    if (!access.isOwner) return res.status(403).json({ message: "Owner access required" });
    const leadsId = leadIdParam(req);
    if (leadsId === null) return res.status(404).json({ message: "Caller not found" });
    const lead = await storage.getCallerLead(leadsId, { accountId: null, allowDemo: true });
    if (!lead) return res.status(404).json({ message: "Caller not found" });

    const recapLines = lead.calls.slice(0, RECAP_CALLS).map((c) => {
      const line = `${c.startedAt.slice(0, 10)}: ${OUTCOME_LABEL[c.outcome]}`;
      return c.conclusion ? `${line}: ${c.conclusion}` : line;
    });
    // Leads has no company column today, so the persona is the only source.
    const companyName = lead.calls.find((c) => c.personaCompany)?.personaCompany ?? null;

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(`${ENGINE_BASE}/voice/hubspot/push-caller`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
        body: JSON.stringify({
          contact_id: lead.hubspotContactId,
          first_name: lead.firstName,
          last_name: lead.lastName,
          email: lead.email,
          phone: lead.phone, // as stored: the engine's phone search is an exact match
          company_name: companyName,
          recap_lines: recapLines,
        }),
        signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
      });
    } catch (err) {
      return res.status(502).json({ message: `HubSpot push failed: ${(err as Error).message}` });
    }
    const body = await upstream.json().catch(() => null);
    if (!upstream.ok) return res.status(502).json({ message: engineError(body, upstream.status) });
    const result = body as { contact_id?: unknown; url?: unknown; note_created?: unknown } | null;
    const contactId = result && (typeof result.contact_id === "string" || typeof result.contact_id === "number")
      ? String(result.contact_id)
      : null;
    if (!contactId) return res.status(502).json({ message: "HubSpot push returned no contact id" });
    // Always overwrite: the engine may have re-created a contact deleted in HubSpot.
    await storage.setLeadHubspotContactId(leadsId, contactId);
    res.json({
      contactId,
      url: typeof result?.url === "string" ? result.url : null,
      noteCreated: result?.note_created === true,
    });
  }));
}
