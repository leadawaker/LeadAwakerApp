// The call's own turns (VoiceCallDetail.turns) as review lines, for when the
// review request fails: the Calls page still shows what was said instead of an
// empty call. A light copy of the server's timing (storage/voiceCallReview.ts):
// no turn metrics, no reply delays, times from the rows' clocks.
import type { VoiceCallTurn } from "../api/voiceCallsApi";
import type { ReviewTurn } from "./reviewMath";

interface CallTurns {
  startedAt: string;
  recordingStartedAt: string | null;
  turns: Pick<VoiceCallTurn, "direction" | "content" | "spokenAt" | "createdAt" | "kind">[];
}

export function fallbackTurns(call: CallTurns): ReviewTurn[] {
  const t0 = new Date(call.recordingStartedAt ?? call.startedAt).getTime();
  const secs = (iso: string | null): number | null => {
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) || Number.isNaN(t0) ? null : (ms - t0) / 1000;
  };
  let prevAt = 0;
  return call.turns
    .filter((t) => t.kind !== "receipt")
    .map((t, i): ReviewTurn => {
      const atS = Math.round(Math.max(0, secs(t.spokenAt) ?? secs(t.createdAt) ?? prevAt) * 10) / 10;
      prevAt = atS;
      return { i, role: t.direction === "inbound" ? "user" : "agent", text: t.content ?? "", atS, delayMs: null };
    });
}
