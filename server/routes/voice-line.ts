import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { handleZodError, wrapAsync } from "./_helpers";
import { AFTER_HOURS, TRANSFER_WAITING, VOICE_LOCALES, VoiceLineError } from "../storage/voiceLines";

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
      res.json(line);
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

  app.get("/api/voice-numbers/unassigned", requireAgency, wrapAsync(async (_req, res) => {
    res.json(await storage.listUnassignedNumbers());
  }));
}
