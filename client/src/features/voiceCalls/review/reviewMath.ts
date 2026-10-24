// Pure math and shaping for the call review (CallReviewView): marker positions, cost and
// delay labels, skip bounds, the transcript line that is playing, speeds and zoom. No React.
// Shared by the Calls page's call detail and the Voice tab's test panel.

/** Delays are measured from transcripts, so they are shown as approximate. */
export function formatDelay(ms: number): string {
  return `≈ ${(ms / 1000).toFixed(1)} s`;
}

/** Mirrors CallReview in server/storage/voiceCallReview.ts (GET /api/voice-calls/:callId/review). */
export type ReviewEngine = "gpt-live" | "elevenlabs";
export interface ReviewTool { name: string; atS: number; ms: number | null; args: string; result: string }
export interface ReviewTurn { i: number; role: "user" | "agent"; text: string; atS: number; delayMs: number | null }
export interface ReviewCost { total: number; minutes: number; ai: number; recap: number; telephony: number; estimate: boolean }
/** The receptionist's recap of the call (intents, what they wanted, notes, outcome). Mirrors ReviewRecap on the server. */
export interface ReviewRecap { intents: string[]; interests: string[]; notes: string[]; outcome: string | null }
export interface CallReview {
  callId: string;
  /** Agency only: a client's review leaves the engine out. */
  engine?: ReviewEngine;
  startedAt: string;
  durationSeconds: number;
  /** Null when the call has no recording to play. */
  recordingUrl: string | null;
  /** The server's guess from the engine (agency only). The player reads the channels of the audio itself. */
  stereo?: boolean;
  turns: ReviewTurn[];
  /** For a client, args and result are empty: the tag shows the name, time and latency only. */
  tools: ReviewTool[];
  summary: { medianDelayMs: number | null; slowestDelayMs: number | null; toolCount: number };
  /** Null for non-Owners and for older calls. */
  cost: ReviewCost | null;
  /** Absent on an older server build. */
  recap?: ReviewRecap;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Where a marker at `atS` sits on the track, as a percentage (0 to 100). */
export function markerLeftPct(atS: number, durationS: number): number {
  if (!finite(atS) || !finite(durationS) || durationS <= 0) return 0;
  return Math.min(100, Math.max(0, (atS / durationS) * 100));
}

/** Small parts need a third decimal to be readable. */
export function formatUsd(usd: number): string {
  return `$${usd.toFixed(Math.abs(usd) < 0.01 && usd !== 0 ? 3 : 2)}`;
}

/** The call's total; estimates (ElevenLabs) carry the approximate sign. */
export function formatCost(cost: ReviewCost | null | undefined, unknownLabel: string): string {
  if (!cost || !finite(cost.total)) return unknownLabel;
  const usd = `$${cost.total.toFixed(2)}`;
  return cost.estimate ? `≈ ${usd}` : usd;
}

export type CostPartKey = "ai" | "telephony" | "recap";

/** The breakdown for the cost tooltip, without parts that cost nothing. */
export function costParts(cost: ReviewCost | null | undefined): { key: CostPartKey; usd: number }[] {
  if (!cost) return [];
  return (["ai", "telephony", "recap"] as const)
    .map((key) => ({ key, usd: cost[key] }))
    .filter((p) => finite(p.usd) && p.usd > 0);
}

/** Delays come from transcripts and timestamps, so they are approximate. */
export function formatReviewDelay(ms: number | null | undefined, unknownLabel: string): string {
  return finite(ms) ? formatDelay(ms) : unknownLabel;
}

/** A seek or skip target kept inside the recording. */
export function clampTime(s: number, durationS: number): number {
  if (!finite(s) || !finite(durationS) || durationS <= 0) return 0;
  return Math.min(durationS, Math.max(0, s));
}

/** The transcript line playing at `currentS`: the last one that has started, or -1. */
export function activeTurnIndex(turns: readonly { atS: number }[], currentS: number): number {
  let found = -1;
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].atS <= currentS) found = i;
    else break;
  }
  return found;
}

export const REVIEW_SPEEDS = [1, 1.25, 1.5, 2] as const;
export const SKIP_S = 10;

/** Pixels per second per zoom step; 0 fits the whole call in the track. */
export const ZOOM_LEVELS = [0, 40, 100, 220] as const;

export function nextZoom(index: number, step: 1 | -1): number {
  return Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index + step));
}

/** m:ss for the time labels. */
export function formatTime(s: number): string {
  const total = finite(s) && s > 0 ? Math.floor(s) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** How long after a call ends its review may still fill in (ElevenLabs loads the transcript at wrap-up, up to 120 s plus the recap). */
export const REVIEW_PROCESSING_MS = 3 * 60_000;
/** A call without a duration yet that started longer ago than this is old, not still processing (a browser test is capped at 20 minutes). */
const RECENT_CALL_MS = 30 * 60_000;

/**
 * Whether the engine may still be writing this call's transcript or cost: one is missing
 * and the call ended less than 3 minutes ago. While there are no turns and no duration
 * (an ElevenLabs call's end is only stored at wrap-up) the window counts from
 * `firstSeenMs`, when the review was first fetched, for a call that started recently.
 * A missing cost only waits when `costExpected` (the viewer is the Owner; others never get one).
 */
export function stillProcessing(review: CallReview, nowMs: number, opts: { firstSeenMs?: number | null; costExpected?: boolean } = {}): boolean {
  const noTurns = review.turns.length === 0;
  const noCost = !review.cost && opts.costExpected !== false;
  if (!noTurns && !noCost) return false;
  const started = new Date(review.startedAt).getTime();
  if (!Number.isFinite(started)) return false;
  let from = started + (review.durationSeconds || 0) * 1000;
  if (noTurns && !review.durationSeconds && opts.firstSeenMs != null && nowMs - started < RECENT_CALL_MS) {
    from = Math.max(from, opts.firstSeenMs);
  }
  return nowMs - from < REVIEW_PROCESSING_MS;
}
