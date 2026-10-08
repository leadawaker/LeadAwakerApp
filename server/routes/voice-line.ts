import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { handleZodError, wrapAsync } from "./_helpers";
import {
  AFTER_HOURS, TRANSFER_MODES, TRANSFER_WAITING, VOICE_LOCALES, VoiceLineError,
} from "../storage/voiceLines";

// Account Workspace "Voice" tab (specs/voice-tab). Reads are open to the
// account's own users; writes are agency-only.

const E164 = /^\+[1-9]\d{6,14}$/;
const e164 = z.string().trim().regex(E164, "Must be an E.164 number, e.g. +31612345678");
/** "" clears a number field, same as null. */
const clearableE164 = z.preprocess((v) => (v === "" ? null : v), e164.nullable());

const putBodySchema = z.object({
  numberId: z.number().int().positive().nullable().optional(),
  phoneNumber: e164.optional(),
  createPersona: z.boolean().optional(),
  agentName: z.string().trim().max(60).nullable().optional(),
  agentNameCustom: z.string().trim().max(60).nullable().optional(),
  voice: z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/).nullable().optional(),
  locale: z.enum(VOICE_LOCALES).nullable().optional(),
  transferNumber: clearableE164.optional(),
  transferName: z.string().trim().max(100).nullable().optional(),
  transferWaiting: z.enum(TRANSFER_WAITING).optional(),
  transferMode: z.enum(TRANSFER_MODES).optional(),
  officeSound: z.boolean().optional(),
  screening: z.object({
    sales: z.boolean().optional(),
    robocalls: z.boolean().optional(),
    abuse: z.boolean().optional(),
  }).strict().optional(),
  greeting: z.string().max(500).optional(),
  pronunciation: z.array(z.object({
    word: z.string().max(80),
    sayAs: z.string().max(120),
  })).max(50).optional(),
  afterHours: z.enum(AFTER_HOURS).nullable().optional(),
  extraInstructions: z.string().max(1000, "Extra instructions are limited to 1000 characters").optional(),
  live: z.boolean().optional(),
}).refine((b) => !(b.numberId !== undefined && b.phoneNumber !== undefined), {
  message: "Send either numberId or phoneNumber, not both",
  path: ["numberId"],
});

const ENGINE_BASE = process.env.ENGINE_URL || "http://localhost:8100";

export interface NumberWiring { number: string; wiring: "conference" | "direct" | null; changed?: boolean; error?: string }

/**
 * Put the account's numbers on the Telnyx route its saved settings call for
 * (engine line_wiring.py): the conference route for screened transfers or the
 * office sound, else direct. Never throws: a save that worked stays saved, and
 * the tab shows the wiring error instead.
 */
export async function syncVoiceWiring(accountId: number): Promise<NumberWiring[] | { error: string }> {
  try {
    const resp = await fetch(`${ENGINE_BASE}/voice/phone/wiring/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
      body: JSON.stringify({ account_id: accountId }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { error: (data as { detail?: string }).detail || `engine ${resp.status}` };
    return (data as { numbers: NumberWiring[] }).numbers ?? [];
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Parse :id and enforce the same account access check as booking-stats. */
function accountIdFor(req: Request, res: Response): number | null {
  const accountId = Number(req.params.id);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    res.status(400).json({ message: "Invalid account id" });
    return null;
  }
  // No session user means requireAuth admitted the internal API key (agency-level).
  const user = req.user;
  if (user && user.accountsId !== 1 && user.accountsId !== accountId) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return accountId;
}

export function registerVoiceLineRoutes(app: Express): void {
  app.get("/api/accounts/:id/voice", requireAuth, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const line = await storage.getVoiceLine(accountId);
    if (!line) return res.status(404).json({ message: "Account not found" });
    res.json(line);
  }));

  app.put("/api/accounts/:id/voice", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const parsed = putBodySchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    try {
      const line = await storage.saveVoiceLine(accountId, parsed.data);
      if (!line) return res.status(404).json({ message: "Account not found" });
      // Only when a real number is attached: there is nothing to wire otherwise.
      const wiring = line.number ? await syncVoiceWiring(accountId) : [];
      res.json({ ...line, wiring });
    } catch (err) {
      if (err instanceof VoiceLineError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
  }));

  app.get("/api/accounts/:id/voice-stats", requireAuth, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const month = typeof req.query.month === "string" ? req.query.month : undefined;
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ message: "month must be YYYY-MM" });
    }
    res.json(await storage.getAccountVoiceStats(accountId, month));
  }));

  // Agency only: a test call lives in the demo account, whose leads a client must not see.
  app.get("/api/accounts/:id/voice/test-calls", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    res.json(await storage.listTestCalls(accountId));
  }));

  // Numbers blocked for abuse on this account's line, and lifting one.
  app.get("/api/accounts/:id/voice/blocked", requireAuth, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    res.json(await storage.listBlockedCallers(accountId));
  }));

  app.delete("/api/accounts/:id/voice/blocked/:blockId", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const blockId = Number(req.params.blockId);
    if (!Number.isInteger(blockId) || blockId <= 0) return res.status(400).json({ message: "Invalid block id" });
    const ok = await storage.unblockCaller(accountId, blockId);
    if (!ok) return res.status(404).json({ message: "No such block" });
    res.json({ ok: true });
  }));

  app.get("/api/voice-numbers/unassigned", requireAgency, wrapAsync(async (_req, res) => {
    res.json(await storage.listUnassignedNumbers());
  }));
}
