/**
 * Outcome of a voice call. Mirrors `tools/db/voice_outcome.py` in the engine:
 * the engine stamps the column going forward, and the API derives it with the
 * same rules for rows written before the stamp existed.
 * Precedence: transferred, booked, callback, hung_up, other.
 */
export type VoiceOutcome = "booked" | "callback" | "transferred" | "hung_up" | "other";

export const HUNG_UP_MAX_SECONDS = 10;

export function deriveOutcome(a: {
  transferred: boolean;
  bookedSlot: string | null;
  intents: string[];
  durationSeconds: number | null;
  hasSummary: boolean;
  abandoned: boolean;
}): VoiceOutcome {
  if (a.transferred) return "transferred";
  if (a.bookedSlot) return "booked";
  if (a.intents.includes("callback_now")) return "callback";
  if (a.abandoned) return "hung_up";
  if (a.durationSeconds !== null && a.durationSeconds < HUNG_UP_MAX_SECONDS && !a.hasSummary) return "hung_up";
  return "other";
}

export function isVoiceOutcome(v: unknown): v is VoiceOutcome {
  return v === "booked" || v === "callback" || v === "transferred" || v === "hung_up" || v === "other";
}
