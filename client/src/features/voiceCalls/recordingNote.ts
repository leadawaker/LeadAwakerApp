// Why a call has no recording to play. OpenAI needs a few minutes after hang-up to
// finish a recording, and keeps it for 30 days: only blame the 30 days once the call is
// actually that old. Keys in the voiceCalls locale.
export const RECORDING_PENDING_MS = 60 * 60 * 1000;
const RECORDING_KEPT_MS = 30 * 24 * 60 * 60 * 1000;

export function recordingMissingKey(startedAt: string, now = Date.now()): "recordingPending" | "recordingExpired" | "recordingUnavailable" {
  const age = now - new Date(startedAt).getTime();
  if (age < RECORDING_PENDING_MS) return "recordingPending";
  return age > RECORDING_KEPT_MS ? "recordingExpired" : "recordingUnavailable";
}

/** A call this fresh may still be finishing its recording: ask a few times before saying it is missing. */
export function recordingMayStillCome(startedAt: string, now = Date.now()): boolean {
  return now - new Date(startedAt).getTime() < RECORDING_PENDING_MS;
}
