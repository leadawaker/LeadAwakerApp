// Account "Voice" tab API (specs/voice-tab). Shapes follow the binding API
// contract in specs/voice-tab/implementation-plan.md. camelCase on the wire.
import { apiFetch } from "@/lib/apiUtils";
import type { PronunciationRow } from "../communication/setupConstants";
import type { VoiceCallListItem } from "@/features/voiceCalls/api/voiceCallsApi";

export type NumberStatus = "not_set" | "pending" | "live";
export type AfterHoursMode = "message" | "callback" | "ringHot";
export type ReadinessKey = "number" | "persona" | "kb" | "voice" | "agent" | "transfer" | "hours";

export interface VoiceNumber {
  id: number;
  phoneNumber: string;
  enabled: boolean;
  status: NumberStatus;
}

export interface VoicePersona {
  id: number;
  niche: string;
  companyName: string;
  description: string;
  usp: string;
  isLive: boolean;
}

/** What a caller hears while a screened transfer rings the owner. */
export const TRANSFER_WAITING = ["sara", "hold"] as const;
export type TransferWaiting = (typeof TRANSFER_WAITING)[number];
/** Screened: brief + press 1. Direct: connected on answer. Off: nobody is put through. */
export const TRANSFER_MODES = ["screened", "direct", "off"] as const;
export type TransferMode = (typeof TRANSFER_MODES)[number];
/** Unwanted calls she turns away, one switch each. */
export const SCREENING_KINDS = ["sales", "robocalls", "abuse"] as const;
export type ScreeningKind = (typeof SCREENING_KINDS)[number];
export type Screening = Record<ScreeningKind, boolean>;

/** Where a number is wired at Telnyx, as the save that just ran left it. */
export interface NumberWiring { number: string; wiring: "conference" | "direct" | null; changed?: boolean; error?: string }

export interface BlockedCaller { id: number; phone: string; reason: string; blockedUntil: string; createdAt: string }

export interface VoiceLine {
  accountId: number;
  number: VoiceNumber | null;
  persona: VoicePersona | null;
  agentName: string | null;
  agentNameCustom: string | null;
  voice: string | null;
  locale: string | null;
  transferNumber: string | null;
  transferName: string | null;
  transferWaiting: TransferWaiting;
  /** A track id from holdMusic.ts: what the caller hears when `transferWaiting` is "hold". */
  transferHoldMusic: string;
  transferMode: TransferMode;
  officeSound: boolean;
  region: VoiceRegion;
  /** The recorded "this call is recorded" line before she answers. `custom` null: the standard line. */
  recordingNotice: { enabled: boolean; custom: RecordingNoticeCustom | null };
  screening: Screening;
  /** On a PUT that can move a number: the engine's wiring sync, or its error. useVoiceLine keeps the last one. */
  wiring?: NumberWiring[] | { error: string };
  greeting: string | null;
  pronunciation: PronunciationRow[] | null;
  /** What the team wants to know before an appointment, one item per line; "" when not set. */
  intake: string | null;
  afterHours: AfterHoursMode | null;
  extraInstructions: string | null;
  /** The WhatsApp message after each call. `whatsappConnected`: the account's own number can send. */
  followUp: { enabled: boolean; smsSenderId: string | null; whatsappConnected: boolean };
  hours: { start: string | null; end: string | null; timezone: string | null };
  kbCount: number;
  readiness: { items: { key: ReadinessKey; ok: boolean }[]; ready: boolean };
}

/** Any subset of these may be sent to PUT /api/accounts/:id/voice. */
export interface VoiceLinePatch {
  numberId?: number | null;
  phoneNumber?: string;
  createPersona?: boolean;
  agentName?: string | null;
  agentNameCustom?: string | null;
  voice?: string | null;
  locale?: string | null;
  transferNumber?: string | null;
  transferName?: string | null;
  transferWaiting?: TransferWaiting;
  transferHoldMusic?: string;
  transferMode?: TransferMode;
  officeSound?: boolean;
  region?: VoiceRegion;
  recordingNotice?: boolean;
  screening?: Partial<Screening>;
  greeting?: string | null;
  pronunciation?: PronunciationRow[];
  /** Trimmed and cut to 6 lines of 120 characters by the server. */
  intake?: string;
  afterHours?: AfterHoursMode | null;
  extraInstructions?: string;
  followUpEnabled?: boolean;
  /** The name an SMS fallback is sent from; null for none. */
  smsSenderId?: string | null;
  /** Switch the attached number on (real callers reach her) or off. */
  live?: boolean;
}

export type NoticeVoice = "nova" | "sage" | "ash" | "onyx" | "kore" | "aoede" | "puck" | "charon";
/** Where Telnyx places a line's call legs (engine telnyx_bridge.py REGIONS). */
export const VOICE_REGIONS = ["Europe", "US", "Canada", "Australia", "Middle East"] as const;
export type VoiceRegion = (typeof VOICE_REGIONS)[number];

export interface RecordingNoticeCustom {
  text: string;
  voice: NoticeVoice;
  speed: number;
  seconds: number;
  v: number;
}

/** A rendered draft: the same fields plus where to hear it. */
export type RecordingNoticeDraft = RecordingNoticeCustom & { url: string };

export interface VoiceStats {
  month: string;
  calls: number;
  bookings: number;
  transfers: number;
  transfersFailed: number;
  minutes: number;
  /** Typical gap from the caller's last word to hers, in ms. Null before a measured call. */
  latencyMs: number | null;
  /** Only sent to the Owner. Null before a priced call. */
  costUsd?: number | null;
  costPerMinute?: number | null;
}

export interface UnassignedNumber {
  id: number;
  phoneNumber: string;
  label: string | null;
  enabled: boolean;
}

export const EXTRA_INSTRUCTIONS_MAX = 1000;

/** An SMS sender name: at most 11 letters, digits or spaces, with at least one letter. */
export const SMS_SENDER_MAX = 11;
/** What the field lets through as you type: other characters are dropped, double spaces collapsed. */
export const cleanSmsSender = (v: string) =>
  v.replace(/[^A-Za-z0-9 ]/g, "").replace(/ {2,}/g, " ").replace(/^ /, "").slice(0, SMS_SENDER_MAX);
export const validSmsSender = (v: string) => v === "" || /[A-Za-z]/.test(v);

export const E164 = /^\+[1-9]\d{6,14}$/;
/** "+31 6 1234-5678" -> "+31612345678" (E.164 never carries separators). */
export const normalizePhone = (v: string) => v.replace(/[\s().-]/g, "");

export const voiceLineKey = (accountId: number) => ["/api/accounts", accountId, "voice"] as const;
export const voiceStatsKey = (accountId: number, month: string) => ["/api/accounts", accountId, "voice-stats", month] as const;
export const UNASSIGNED_KEY = ["/api/voice-numbers/unassigned"] as const;
export const blockedKey = (accountId: number) => ["/api/accounts", accountId, "voice", "blocked"] as const;
export const testCallsKey = (accountId: number) => ["/api/accounts", accountId, "voice", "test-calls"] as const;

async function readError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  return new Error((body as { message?: string }).message || fallback);
}

export async function fetchVoiceLine(accountId: number): Promise<VoiceLine> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice`);
  if (!res.ok) throw await readError(res, "Failed to load voice line");
  return res.json();
}

export async function putVoiceLine(accountId: number, patch: VoiceLinePatch): Promise<VoiceLine> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await readError(res, "Failed to save voice line");
  return res.json();
}

export async function fetchVoiceStats(accountId: number, month: string): Promise<VoiceStats> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice-stats?month=${encodeURIComponent(month)}`);
  if (!res.ok) throw await readError(res, "Failed to load voice stats");
  return res.json();
}

export async function fetchUnassignedNumbers(): Promise<UnassignedNumber[]> {
  const res = await apiFetch("/api/voice-numbers/unassigned");
  if (!res.ok) throw await readError(res, "Failed to load numbers");
  return res.json();
}

export async function fetchTestCalls(accountId: number): Promise<VoiceCallListItem[]> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice/test-calls`);
  if (!res.ok) throw await readError(res, "Failed to load test calls");
  return res.json();
}

export async function fetchBlockedCallers(accountId: number): Promise<BlockedCaller[]> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice/blocked`);
  if (!res.ok) throw await readError(res, "Failed to load blocked callers");
  return res.json();
}

export async function unblockCaller(accountId: number, blockId: number): Promise<void> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice/blocked/${blockId}`, { method: "DELETE" });
  if (!res.ok) throw await readError(res, "Failed to unblock");
}

export async function draftRecordingNotice(
  accountId: number, body: { text: string; voice: NoticeVoice; speed: number },
): Promise<RecordingNoticeDraft> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice/recording-notice/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res, "Failed to make the clip");
  return res.json();
}

/** Make the last draft the clip callers hear; returns the fresh line. */
export async function applyRecordingNotice(accountId: number): Promise<VoiceLine> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice/recording-notice/apply`, { method: "POST" });
  if (!res.ok) throw await readError(res, "Failed to save the clip");
  return res.json();
}

/** Back to the standard line; returns the fresh line. */
export async function resetRecordingNotice(accountId: number): Promise<VoiceLine> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice/recording-notice`, { method: "DELETE" });
  if (!res.ok) throw await readError(res, "Failed to reset the clip");
  return res.json();
}

/** The wiring error of a save, if the engine could not wire every number. */
export function wiringError(line: VoiceLine): string | null {
  const w = line.wiring;
  if (!w) return null;
  if (!Array.isArray(w)) return w.error;
  return w.find((n) => n.error)?.error ?? null;
}
