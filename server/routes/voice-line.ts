import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { accountIdFor, handleZodError, wrapAsync } from "./_helpers";
import {
  AFTER_HOURS, HOLD_MUSIC, NOTICE_SPEEDS, NOTICE_VOICES, TRANSFER_MODES, TRANSFER_WAITING, VOICE_LOCALES,
  VOICE_REGIONS, VoiceLineError, type RecordingNoticeCustom,
} from "../storage/voiceLines";

// Account Workspace "Voice" tab (specs/voice-tab). Reads are open to the
// account's own users; writes are agency-only.

const E164 = /^\+[1-9]\d{6,14}$/;
const e164 = z.string().trim().regex(E164, "Must be an E.164 number, e.g. +31612345678");
/** "" clears a number field, same as null. */
const clearableE164 = z.preprocess((v) => (v === "" ? null : v), e164.nullable());
// An SMS alphanumeric sender (engine telnyx_messaging.sanitize_sender_id):
// letters, digits and single spaces, at most 11 characters, at least one letter.
const SMS_SENDER = /^(?=.*[A-Za-z])[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$/;
const smsSender = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(11, "At most 11 characters")
    .regex(SMS_SENDER, "Letters, digits and spaces only, with at least one letter").nullable(),
);

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
  transferHoldMusic: z.enum(HOLD_MUSIC).optional(),
  transferMode: z.enum(TRANSFER_MODES).optional(),
  officeSound: z.boolean().optional(),
  region: z.enum(VOICE_REGIONS).optional(),
  recordingNotice: z.boolean().optional(),
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
  // Trimmed and cut to 6 lines of 120 characters on save (storage/voiceLines.ts).
  intake: z.string().max(5000).optional(),
  afterHours: z.enum(AFTER_HOURS).nullable().optional(),
  extraInstructions: z.string().max(1000, "Extra instructions are limited to 1000 characters").optional(),
  followUpEnabled: z.boolean().optional(),
  smsSenderId: smsSender.optional(),
  live: z.boolean().optional(),
}).refine((b) => !(b.numberId !== undefined && b.phoneNumber !== undefined), {
  message: "Send either numberId or phoneNumber, not both",
  path: ["numberId"],
});

const ENGINE_BASE = process.env.ENGINE_URL || "http://localhost:8100";

/** The patch fields that can change which Telnyx route a number belongs on. */
const WIRING_FIELDS = ["numberId", "phoneNumber", "transferNumber", "transferMode", "officeSound"] as const;

export interface NumberWiring { number: string; wiring: "conference" | "direct" | null; changed?: boolean; error?: string }

/**
 * Put the account's numbers on the Telnyx route its saved settings call for
 * (engine line_wiring.py): the conference route for screened transfers or the
 * office sound, else direct. Never throws: a save that worked stays saved, and
 * the tab shows the wiring error instead.
 */
export async function syncVoiceWiring(
  accountId: number, released: string[] = [],
): Promise<NumberWiring[] | { error: string }> {
  try {
    const resp = await fetch(`${ENGINE_BASE}/voice/phone/wiring/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
      body: JSON.stringify({ account_id: accountId, released }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { error: (data as { detail?: string }).detail || `engine ${resp.status}` };
    return (data as { numbers: NumberWiring[] }).numbers ?? [];
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const noticeDraftSchema = z.object({
  text: z.string().trim().min(8).max(200),
  voice: z.enum(NOTICE_VOICES),
  speed: z.number().refine((n) => (NOTICE_SPEEDS as readonly number[]).includes(n), "Unknown speed"),
}).strict();

/** The engine renders and keeps the notice clips (recording_notice.py). Throws VoiceLineError with its message. */
async function noticeEngine<T>(path: "draft" | "apply", body: Record<string, unknown>): Promise<T> {
  let resp: globalThis.Response;
  try {
    resp = await fetch(`${ENGINE_BASE}/voice/phone/notice/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(75_000),
    });
  } catch (err) {
    throw new VoiceLineError(502, err instanceof Error ? err.message : String(err));
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail = (data as { detail?: unknown }).detail;
    throw new VoiceLineError(resp.status === 422 ? 422 : 502, typeof detail === "string" ? detail : `engine ${resp.status}`);
  }
  return data as T;
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
      const touchesWiring = WIRING_FIELDS.some((k) => parsed.data[k] !== undefined);
      const before = touchesWiring ? (await storage.getVoiceLine(accountId))?.number?.phoneNumber : undefined;
      const line = await storage.saveVoiceLine(accountId, parsed.data);
      if (!line) return res.status(404).json({ message: "Account not found" });
      // A number swapped out or detached goes back to the direct route.
      const released = before && before !== line.number?.phoneNumber ? [before] : [];
      // Only saves that can move a number wait on the engine (Telnyx round trips).
      const wiring = touchesWiring && (line.number || released.length)
        ? await syncVoiceWiring(accountId, released)
        : undefined;
      res.json(wiring === undefined ? line : { ...line, wiring });
    } catch (err) {
      if (err instanceof VoiceLineError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
  }));

  // The recording notice editor: a draft to listen to, then "use this one".
  app.post("/api/accounts/:id/voice/recording-notice/draft", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const parsed = noticeDraftSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const line = await storage.getVoiceLine(accountId);
    if (!line) return res.status(404).json({ message: "Account not found" });
    try {
      res.json(await noticeEngine<RecordingNoticeCustom & { url: string }>("draft", {
        account_id: accountId, ...parsed.data, locale: line.locale ?? "en-GB",
      }));
    } catch (err) {
      if (err instanceof VoiceLineError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
  }));

  app.post("/api/accounts/:id/voice/recording-notice/apply", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    try {
      const { text, voice, speed, seconds, v } = await noticeEngine<RecordingNoticeCustom>("apply", { account_id: accountId });
      const line = await storage.saveVoiceLine(accountId, { recordingNoticeCustom: { text, voice, speed, seconds, v } });
      if (!line) return res.status(404).json({ message: "Account not found" });
      res.json(line);
    } catch (err) {
      if (err instanceof VoiceLineError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
  }));

  // Back to the standard line in the line's own language.
  app.delete("/api/accounts/:id/voice/recording-notice", requireAgency, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const line = await storage.saveVoiceLine(accountId, { recordingNoticeCustom: null });
    if (!line) return res.status(404).json({ message: "Account not found" });
    res.json(line);
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
