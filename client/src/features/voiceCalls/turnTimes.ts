import type { VoiceCallTurn } from "./api/voiceCallsApi";
import type { Segment } from "./useCallAudio";

// Engine calls since 2026-10-20 store when a turn's first words were heard
// (metadata.spoken_at). That lands close to the real start: snap it to a
// stretch of speech only when one starts this near.
const SNAP_S = 1.5;
// Older turns only have created_at: the row is written this long after the
// speaker's LAST words (the engine's TURN_GAP_S), so it marks the end.
const TURN_GAP_S = 1.4;
// How far a turn's end may sit from that anchor (the AI's text can run
// seconds ahead of its audio) and still count as its stretch of speech.
const END_WINDOW_S = 8;

type Side = "caller" | "ai";
interface Run { side: Side; first: number; last: number; turns: number[] }

const clamp = (at: number, duration: number) => Math.max(0, duration > 0 ? Math.min(at, duration) : at);

/**
 * Where each turn starts in the recording, in seconds, or null when it has no
 * time (a booking receipt is written, never spoken). `t0Iso` is when the
 * recording started: Voice_Calls.recording_started_at, else started_at.
 */
export function turnTimes(
  turns: VoiceCallTurn[],
  t0Iso: string,
  caller: Segment[],
  ai: Segment[],
  duration: number,
): (number | null)[] {
  const t0 = new Date(t0Iso).getTime();
  const segsOf = (side: Side) => (side === "caller" ? caller : ai);
  const out: (number | null)[] = turns.map(() => null);
  const used = new Set<Segment>();
  // Old-call bookkeeping, per side: the last segment a turn ended on.
  const floor: Record<Side, number> = { caller: 0, ai: 0 };
  const runs: Run[] = [];
  const lastRun: Partial<Record<Side, Run>> = {};

  turns.forEach((turn, i) => {
    if (turn.kind === "receipt") return;
    const side: Side = turn.direction === "inbound" ? "caller" : "ai";
    const segs = segsOf(side);

    if (turn.spokenAt) {
      const est = (new Date(turn.spokenAt).getTime() - t0) / 1000;
      let best: Segment | null = null;
      for (const s of segs) {
        if (used.has(s) || Math.abs(s.start - est) > SNAP_S) continue;
        if (!best || Math.abs(s.start - est) < Math.abs(best.start - est)) best = s;
      }
      if (best) used.add(best);
      out[i] = clamp(best ? best.start : est, duration);
      return;
    }

    if (!turn.createdAt) return;
    const anchor = (new Date(turn.createdAt).getTime() - t0) / 1000 - TURN_GAP_S;
    // The segment this turn ended on: at or after the previous turn's on this side.
    let end = -1;
    for (let j = floor[side]; j < segs.length; j++) {
      if (used.has(segs[j])) continue;
      const d = Math.abs(segs[j].end - anchor);
      if (d > END_WINDOW_S) { if (segs[j].end > anchor) break; continue; }
      if (end < 0 || d < Math.abs(segs[end].end - anchor)) end = j;
    }
    if (end < 0) { out[i] = clamp(anchor, duration); return; }
    const prev = lastRun[side];
    if (prev && end <= prev.last) {
      // Ended on the same stretch as the turn before it: they share it.
      prev.turns.push(i);
      return;
    }
    // Back to where this stretch began: earlier segments closer together than
    // the engine's turn gap were one turn, as long as no earlier turn owns them.
    let first = end;
    const lowest = prev ? prev.last + 1 : 0;
    while (first > lowest && segs[first].start - segs[first - 1].end < TURN_GAP_S) first--;
    const run: Run = { side, first, last: end, turns: [i] };
    runs.push(run);
    lastRun[side] = run;
    floor[side] = end;
  });

  // Each run's start goes to its first turn; turns sharing a run split it by text length.
  for (const run of runs) {
    const segs = segsOf(run.side);
    const start = segs[run.first].start;
    const span = segs[run.last].end - start;
    const lens = run.turns.map((i) => Math.max(1, (turns[i].content ?? "").length));
    const total = lens.reduce((a, b) => a + b, 0);
    let before = 0;
    run.turns.forEach((i, n) => {
      out[i] = clamp(start + (before / total) * span, duration);
      before += lens[n];
    });
  }
  return out;
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
