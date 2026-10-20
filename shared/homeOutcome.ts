/**
 * The outcome a call gets on the Home tabs. "answered" is the old "other":
 * a call the receptionist simply handled (questions answered).
 * Order: booked, callback, transferred, hung_up, answered.
 * `needsCallback` is the needsCallbackSql result from the database, so callbacks agree everywhere.
 */
import { deriveOutcome, isVoiceOutcome } from "./voiceOutcome";

export type HomeOutcome = "booked" | "transferred" | "callback" | "hung_up" | "answered";

export function classifyHomeOutcome(r: {
  outcome: string | null;
  transferOutcome: string | null;
  bookedIso: string | null;
  intents: string[];
  durationSeconds: number | null;
  hasSummary: boolean;
  abandoned: boolean;
  needsCallback: boolean;
}): HomeOutcome {
  if (r.outcome === "booked") return "booked";
  if (r.needsCallback) return "callback";
  if (r.transferOutcome === "completed" || r.transferOutcome === "transferred" || r.outcome === "transferred") return "transferred";
  if (r.outcome === "hung_up") return "hung_up";
  const outcome = isVoiceOutcome(r.outcome)
    ? r.outcome
    : deriveOutcome({
        transferred: false,
        bookedSlot: r.bookedIso,
        intents: r.intents,
        durationSeconds: r.durationSeconds,
        hasSummary: r.hasSummary,
        abandoned: r.abandoned,
      });
  if (outcome === "booked") return "booked";
  if (outcome === "callback") return "callback";
  if (outcome === "hung_up") return "hung_up";
  return "answered";
}
