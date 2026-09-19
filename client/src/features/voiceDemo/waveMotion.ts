import { useCallback, useRef } from "react";
import type { AIState } from "@/components/siriOrb/aiCore";
import { RESTING_WAVE, type WaveParams } from "@/components/siriWave/SiriWave";
import type { CallLevels } from "./useCallLevels";
import type { CallState } from "./types";

/**
 * What the wave does, frame by frame, during a call.
 *
 * Who holds the floor is read from the AUDIO, not from the transcript events:
 * GPT-Live has no "speaking started/stopped" event, and transcript deltas lag
 * the voice and never say when a turn is over. Her track and the caller's mic
 * each have their own analyser (see useCallLevels), and that is ground truth.
 *
 *  - She speaks:      full colour, tall, fast, shaped by her own voice bands.
 *  - Caller speaks:   she is listening. A calm, mostly white line that rises
 *                     and falls with the caller's voice, so they can see she
 *                     hears them without it looking like she is talking.
 *  - She is working:  (connecting, or a tool call in flight) a slow breathing
 *                     swell in soft colour.
 *  - Nobody talking:  a low idle drift, so the line is alive but quiet.
 *
 * Around all of that, the wave's life: it is born as a small dot that
 * breathes while the call connects, stretches out into the full wave when
 * she picks up, and shrinks back into the dot and out when the call ends.
 *
 * Every parameter eases toward its target rather than jumping, and the floor
 * has a short hold so a breath between words does not flip the colour.
 */

type Floor = "them" | "you" | "none";

/** Below this, a side counts as silent. Mic noise sits well under it. */
const SPEAKING = 0.05;
/** The mic hears her faintly through the speakers; she must clearly lead it. */
const THEM_LEAD = 0.7;
/** A floor change must hold this long before the wave follows it. */
const FLOOR_HOLD_S = 0.25;
/** Per-second approach rates: rising fast, settling slower. */
const RISE = 9;
const SETTLE = 3;
/** The birth is slower than any voice reaction, so the grow reads as a gesture. */
const REVEAL_GROW = 1.8;
const REVEAL_SHRINK = 5;
/** The dot's size while connecting, and how much it breathes. */
const DOT = 0.1;
const DOT_BREATH = 0.03;

function target(floor: Floor, state: AIState, levels: CallLevels, t: number): WaveParams {
  if (floor === "them") {
    const s = levels.them;
    return {
      speed: 2.4 + 3 * s.level,
      amp: 0.4 + 0.9 * s.level,
      low: s.low,
      mid: s.mid,
      high: s.high,
      sat: 1,
      gain: 1,
      reveal: 1,
    };
  }
  if (floor === "you") {
    const s = levels.you;
    return {
      speed: 1.2,
      amp: 0.15 + 0.55 * s.level,
      low: s.low * 0.6,
      mid: s.mid * 0.6,
      high: 0,
      sat: 0.2,
      gain: 0.85,
      reveal: 1,
    };
  }
  if (state === "thinking") {
    const breath = 0.5 + 0.5 * Math.sin(t * 2.2);
    return { speed: 0.9, amp: 0.12 + 0.12 * breath, low: 0.3, mid: 0.2, high: 0, sat: 0.55, gain: 0.8, reveal: 1 };
  }
  return { speed: 0.6, amp: 0.08, low: 0.2, mid: 0.1, high: 0, sat: 0.5, gain: 0.7, reveal: 1 };
}

function revealFor(call: CallState, t: number): number {
  if (call === "connecting") return DOT + DOT_BREATH * Math.sin(t * 3.2);
  if (call === "live") return 1;
  return 0;
}

function approach(cur: number, next: number, dt: number) {
  const rate = next > cur ? RISE : SETTLE;
  return cur + (next - cur) * Math.min(1, rate * dt);
}

export function useWaveMotion(call: CallState, state: AIState, readLevels: () => CallLevels) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const callRef = useRef(call);
  callRef.current = call;

  // Born invisible: the first frames grow it from nothing into the dot.
  const currentRef = useRef<WaveParams>({ ...RESTING_WAVE, reveal: 0 });
  const floorRef = useRef<Floor>("none");
  const pendingRef = useRef<{ floor: Floor; since: number }>({ floor: "none", since: 0 });
  const clockRef = useRef(0);

  return useCallback(
    (dt: number): WaveParams => {
      clockRef.current += dt;
      const t = clockRef.current;
      const levels = readLevels();

      const heard: Floor =
        levels.them.level > SPEAKING && levels.them.level >= levels.you.level * THEM_LEAD
          ? "them"
          : levels.you.level > SPEAKING
            ? "you"
            : "none";

      if (heard !== pendingRef.current.floor) pendingRef.current = { floor: heard, since: t };
      // She takes the floor at once, since that is the moment worth showing;
      // everything else waits out the hold.
      if (heard === "them" || t - pendingRef.current.since >= FLOOR_HOLD_S) floorRef.current = heard;

      const goal = target(floorRef.current, stateRef.current, levels, t);
      goal.reveal = revealFor(callRef.current, t);
      const cur = currentRef.current;
      (Object.keys(goal) as (keyof WaveParams)[]).forEach((k) => {
        if (k === "reveal") return;
        cur[k] = approach(cur[k], goal[k], dt);
      });
      const rate = goal.reveal > cur.reveal ? REVEAL_GROW : REVEAL_SHRINK;
      cur.reveal += (goal.reveal - cur.reveal) * Math.min(1, rate * dt);
      return cur;
    },
    [readLevels],
  );
}
