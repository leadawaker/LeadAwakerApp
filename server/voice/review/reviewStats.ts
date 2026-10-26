import type { ReviewStats } from "@shared/voiceReview";

export interface ReviewCallRow {
  callId: string;
  startedAt: string;
  endedAt: string | null;
  outcome: string | null;
  endReason: string | null;
  costUsd: number | null;
  latencyMs: number | null;
  latencyP90Ms: number | null;
  toolErrors: number;
}

const count = (values: (string | null)[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const v of values) { const k = v ?? "unknown"; out[k] = (out[k] ?? 0) + 1; }
  return out;
};
const nonNull = (xs: (number | null)[]): number[] => xs.filter((x): x is number => x != null);
const round = (n: number, decimals: number) => { const f = 10 ** decimals; return Math.round(n * f) / f; };

export function computeStats(calls: ReviewCallRow[]): ReviewStats {
  const latency = nonNull(calls.map((c) => c.latencyMs));
  const p90s = nonNull(calls.map((c) => c.latencyP90Ms)).sort((a, b) => a - b);
  let ms = 0;
  for (const c of calls) {
    if (!c.endedAt) continue;
    const d = Date.parse(c.endedAt) - Date.parse(c.startedAt);
    if (Number.isFinite(d) && d > 0) ms += d;
  }
  return {
    calls: calls.length,
    byOutcome: count(calls.map((c) => c.outcome)),
    byEndReason: count(calls.map((c) => c.endReason)),
    latencyAvgMs: latency.length ? Math.round(latency.reduce((a, b) => a + b, 0) / latency.length) : null,
    latencyP90Ms: p90s.length ? p90s[Math.ceil(0.9 * p90s.length) - 1] : null,
    costUsd: round(calls.reduce((a, c) => a + (c.costUsd ?? 0), 0), 2),
    minutes: round(ms / 60000, 1),
  };
}

const BAD_OUTCOMES = new Set(["hung_up", "other"]);
const BAD_END_REASONS = new Set(["silence", "lost", "caller_hung_up", "time_limit", "no_greeting"]);

/** How much a call looks like a problem: higher is worth reading first. */
export function problemScore(c: ReviewCallRow): number {
  let score = 0;
  if (c.outcome == null || BAD_OUTCOMES.has(c.outcome)) score += 2;
  if (c.endReason != null && BAD_END_REASONS.has(c.endReason)) score += 2;
  if (c.toolErrors > 0) score += 2;
  if (c.latencyP90Ms != null && c.latencyP90Ms > 2500) score += 1;
  return score;
}

const startedMs = (c: ReviewCallRow) => { const t = Date.parse(c.startedAt); return Number.isFinite(t) ? t : 0; };

/** Call ids to pull transcripts for: worst first, newest first among equals. */
export function pickTranscriptCalls(calls: ReviewCallRow[], max: number): string[] {
  return calls
    .map((c) => ({ id: c.callId, score: problemScore(c), at: startedMs(c) }))
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, Math.max(0, max))
    .map((c) => c.id);
}
