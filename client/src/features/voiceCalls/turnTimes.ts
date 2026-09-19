import type { VoiceCallTurn } from "./api/voiceCallsApi";
import type { Segment } from "./useCallAudio";

// A turn is saved when its transcript finishes, which lands anywhere from a
// few seconds after the words started to a few seconds before (the AI's text
// can arrive ahead of its audio). Search that window for the real start.
const LOOK_BACK_S = 8;
const LOOK_AHEAD_S = 4;

/**
 * Where each turn starts in the recording, in seconds. Starts from the saved
 * time and snaps to the nearest unclaimed stretch of speech on that speaker's
 * channel; keeps the saved time when nothing is close.
 */
export function turnTimes(
  turns: VoiceCallTurn[],
  startedAt: string,
  caller: Segment[],
  ai: Segment[],
  duration: number,
): (number | null)[] {
  const t0 = new Date(startedAt).getTime();
  const used = new Set<Segment>();
  return turns.map((turn) => {
    if (!turn.createdAt) return null;
    const est = (new Date(turn.createdAt).getTime() - t0) / 1000;
    const segs = turn.direction === "inbound" ? caller : ai;
    let best: Segment | null = null;
    for (const s of segs) {
      if (used.has(s) || s.start < est - LOOK_BACK_S || s.start > est + LOOK_AHEAD_S) continue;
      if (!best || Math.abs(s.start - est) < Math.abs(best.start - est)) best = s;
    }
    if (best) used.add(best);
    const at = best ? best.start : est;
    return Math.max(0, duration > 0 ? Math.min(at, duration) : at);
  });
}

/** Index of the turn being spoken at `time`: the latest one that has started. */
export function activeTurn(times: (number | null)[], time: number): number {
  let idx = -1;
  let bestStart = -Infinity;
  times.forEach((t, i) => {
    if (t != null && t <= time + 0.05 && t >= bestStart) { bestStart = t; idx = i; }
  });
  return idx;
}
