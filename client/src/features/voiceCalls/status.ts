import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import { VOICE_OUTCOMES, type VoiceCallListItem, type VoiceOutcome } from "./api/voiceCallsApi";

/** What a call amounted to, strongest first. */
export type VoiceCallStatus = "dnc" | "booked" | "quote" | "message" | "info" | "responded";

export const VOICE_CALL_STATUSES: VoiceCallStatus[] = ["booked", "quote", "message", "info", "responded", "dnc"];

// Borrow the Chats pipeline palettes so a colour means the same on both pages:
// Booked is yellow, DND is wine, a plain answered call is Responded teal.
const PALETTE: Record<VoiceCallStatus, string> = {
  dnc: "DND",
  booked: "Booked",
  quote: "Closed",
  message: "New",
  info: "Contacted",
  responded: "Responded",
};

/** The server always sends an outcome; anything missing or unknown reads as "other". */
export function normalizeOutcome(outcome: unknown): VoiceOutcome {
  return VOICE_OUTCOMES.includes(outcome as VoiceOutcome) ? (outcome as VoiceOutcome) : "other";
}

export function callStatus(call: Pick<VoiceCallListItem, "bookedSlot" | "intents" | "leadStatus" | "outcome">): VoiceCallStatus {
  const has = (i: string) => call.intents.includes(i);
  const outcome = normalizeOutcome(call.outcome);
  if (call.leadStatus === "DND" || has("do_not_contact")) return "dnc";
  if (call.bookedSlot || outcome === "booked") return "booked";
  if (outcome === "transferred") return "quote";
  if (outcome === "callback") return "info";
  if (has("request_quote")) return "quote";
  if (has("callback_now") || has("leave_message") || has("existing_customer") || has("complaint_or_fault")) return "message";
  if (has("ask_advice")) return "info";
  return "responded";
}

export function statusColors(status: VoiceCallStatus): { bg: string; text: string } {
  return getLeadStatusAvatarColor(PALETTE[status]);
}

// Outcome pills use the light tint the Chats page uses for its status pills
// (the Booked pill in the lead header: a pale wash of the stage colour, a
// faint ring, the stage colour as text) instead of the saturated avatar
// pastels. The two quiet outcomes (hung up, other) stay recessed and muted.
const OUTCOME_STAGE: Partial<Record<VoiceOutcome, string>> = {
  booked: "var(--stage-booked)",
  callback: "var(--stage-responded)",
  transferred: "var(--stage-contacted)",
};

/** Pill colours for an outcome. `inset` marks the quiet, recessed look; `ring` is the faint edge of a tinted pill. */
export function outcomeColors(outcome: VoiceOutcome): { bg: string; text: string; inset: boolean; ring: string | null } {
  const stage = OUTCOME_STAGE[outcome];
  if (!stage) return { bg: "var(--bg)", text: "var(--mute)", inset: true, ring: null };
  return {
    bg: `color-mix(in srgb, ${stage} 13%, transparent)`,
    text: `color-mix(in srgb, ${stage} 78%, var(--ink))`,
    inset: false,
    ring: `color-mix(in srgb, ${stage} 35%, transparent)`,
  };
}

/** Locale key under `outcomes.` for each outcome (hung_up is camel-cased in the JSON). */
export const OUTCOME_LABEL_KEY: Record<VoiceOutcome, string> = {
  booked: "booked",
  callback: "callback",
  transferred: "transferred",
  hung_up: "hungUp",
  other: "other",
};
