// Pure math and shaping for the live view (LiveCallView): timer, running cost, reply
// delay, newest-first order and an engine event as a tool row. No React.

/** USD so far: elapsed minutes at the engine's per-minute rate. 0 for anything unusable. */
export function runningCost(elapsedMs: number, perMin: number): number {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(perMin) || elapsedMs <= 0 || perMin <= 0) return 0;
  return (elapsedMs / 60_000) * perMin;
}

/** Caller's last final words to her first audio, in ms. Null when either is unknown; never negative. */
export function replyDelay(lastUserFinalAt: number | null | undefined, firstAgentAudioAt: number | null | undefined): number | null {
  if (lastUserFinalAt == null || firstAgentAudioAt == null) return null;
  if (!Number.isFinite(lastUserFinalAt) || !Number.isFinite(firstAgentAudioAt)) return null;
  return Math.max(0, firstAgentAudioAt - lastUserFinalAt);
}

/** Delays are measured from transcripts, so they are shown as approximate (one definition, shared with the call review). */
export { formatDelay } from "@/features/voiceCalls/review/reviewMath";

/** m:ss (minutes keep counting past 59). */
export function formatClock(ms: number | null): string {
  const total = ms != null && Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Small amounts need the third decimal to visibly move while the call runs. */
export function formatCost(usd: number): string {
  return `$${usd.toFixed(usd < 1 ? 3 : 2)}`;
}

/** The live transcript and tools list show the newest entry on top. Returns a copy. */
export function newestFirst<T>(items: readonly T[]): T[] {
  return items.slice().reverse();
}

/**
 * The reply delay of every transcript line, in order: the k-th agent line after the
 * greeting (the call's first line when she speaks first) gets the k-th measured delay.
 * Null where none is known. The live delays are a plain list, so pairing is by order.
 */
export function pairAgentDelays(lines: readonly { role: string }[], delaysMs: readonly number[]): (number | null)[] {
  let next = 0;
  return lines.map((line, i) => {
    if (line.role !== "agent" || i === 0) return null;
    const ms = delaysMs[next++];
    return ms === undefined ? null : ms;
  });
}

export interface LiveToolRow {
  id: number | string;
  name: string;
  result: string;
  /** Engine time; null when the engine logged none, or while the tool is still running. */
  ms: number | null;
  failed: boolean;
  /** Still running (GPT Live: shown the moment it starts, filled in when it is done). */
  pending?: boolean;
  /** What the model sent it (update_call_summary's recap is read from here). */
  args?: unknown;
  /** How many transcript lines existed when it fired: it is drawn right after them. */
  afterLines?: number;
}

/** The slice of a Voice_Call_Events row (GET /api/voice-calls/:callId `events`) the live view uses. */
export interface CallEventLike {
  id: number;
  kind: string;
  toolName: string | null;
  status: string | null;
  error: string | null;
  result: unknown;
  latencyMs: number | null;
  args?: unknown;
}

export const RESULT_MAX = 120;

export function shortText(v: unknown): string {
  let s: string;
  try { s = typeof v === "string" ? v : JSON.stringify(v) ?? ""; } catch { s = String(v); }
  return s.length > RESULT_MAX ? `${s.slice(0, RESULT_MAX - 1)}…` : s;
}

export function eventToTool(e: CallEventLike): LiveToolRow {
  const failed = e.status === "error" || e.status === "refused" || (e.error != null && e.error !== "");
  const text = e.error ? e.error : e.result == null ? "" : shortText(e.result);
  return { id: e.id, name: e.toolName || e.kind, result: shortText(text), ms: e.latencyMs, failed };
}
