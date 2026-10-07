// Account "Voice" tab API (specs/voice-tab). Shapes follow the binding API
// contract in specs/voice-tab/implementation-plan.md. camelCase on the wire.
import { apiFetch } from "@/lib/apiUtils";
import type { PronunciationRow } from "../communication/setupConstants";

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
  greeting: string | null;
  pronunciation: PronunciationRow[] | null;
  afterHours: AfterHoursMode | null;
  extraInstructions: string | null;
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
  greeting?: string | null;
  pronunciation?: PronunciationRow[];
  afterHours?: AfterHoursMode | null;
  extraInstructions?: string;
}

export interface VoiceStats {
  month: string;
  calls: number;
  bookings: number;
  transfers: number;
  transfersFailed: number;
  minutes: number;
}

export interface UnassignedNumber {
  id: number;
  phoneNumber: string;
  label: string | null;
  enabled: boolean;
}

export const EXTRA_INSTRUCTIONS_MAX = 1000;

export const E164 = /^\+[1-9]\d{6,14}$/;
/** "+31 6 1234-5678" -> "+31612345678" (E.164 never carries separators). */
export const normalizePhone = (v: string) => v.replace(/[\s().-]/g, "");

export const voiceLineKey = (accountId: number) => ["/api/accounts", accountId, "voice"] as const;
export const voiceStatsKey = (accountId: number, month: string) => ["/api/accounts", accountId, "voice-stats", month] as const;
export const UNASSIGNED_KEY = ["/api/voice-numbers/unassigned"] as const;

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
