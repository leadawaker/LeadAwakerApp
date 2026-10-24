/**
 * The call review screen's one shape for both engines (GPT Live and ElevenLabs):
 * turns with offsets into the recording, reply delays, tool markers and cost.
 *
 * `buildCallReview` is pure so it tests without a database; `loadCallReview`
 * loads the db lazily for the same reason (as in voiceLineEngine.ts).
 *
 * Voice_Calls.turn_metrics (written by the engine's staff_test.py and
 * eleven_metrics.py):
 *   {"turns": [{"i","role": "caller"|"user"|"agent","at_s","delay_ms","interrupted"}],
 *    "tools": [{"name","at_s","latency_ms"}],
 *    "cost":  {"total","minutes","ai","recap","telephony","estimate"}}
 * Older calls have none: the review then works from turn and event timestamps,
 * and its reply delays are approximate.
 */

export type ReviewEngine = "gpt-live" | "elevenlabs";

export interface ReviewTool { name: string; atS: number; ms: number | null; args: string; result: string }
export interface ReviewTurnOut { i: number; role: "user" | "agent"; text: string; atS: number; delayMs: number | null }
export interface ReviewCost { total: number; minutes: number; ai: number; recap: number; telephony: number; estimate: boolean }

/** What the receptionist took from the call (its recap), for the review's "What she understood". No mood or urgency read. */
export interface ReviewRecap { intents: string[]; interests: string[]; notes: string[]; outcome: string | null }

const NO_RECAP: ReviewRecap = { intents: [], interests: [], notes: [], outcome: null };

/** The recap of a call detail: distinct intents, interests and notes of its summary items, and the call's outcome. */
export function recapOf(detail: {
  intents?: string[] | null; outcome?: string | null;
  summary?: { items?: { interest?: string | null; notes?: string | null }[] } | null;
}): ReviewRecap {
  const uniq = (xs: (string | null | undefined)[]) =>
    Array.from(new Set(xs.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)));
  const items = detail.summary?.items ?? [];
  return {
    intents: uniq(detail.intents ?? []),
    interests: uniq(items.map((i) => i.interest)),
    notes: uniq(items.map((i) => i.notes)),
    outcome: typeof detail.outcome === "string" && detail.outcome ? detail.outcome : null,
  };
}

export interface CallReview {
  callId: string;
  engine: ReviewEngine;
  startedAt: string;
  durationSeconds: number;
  /** The existing recording proxy; null when the call has no recording to play. */
  recordingUrl: string | null;
  /** A guess from the engine (GPT Live stereo, ElevenLabs mono). The player decides from the decoded audio's channels; clients never get it. */
  stereo: boolean;
  turns: ReviewTurnOut[];
  tools: ReviewTool[];
  summary: { medianDelayMs: number | null; slowestDelayMs: number | null; toolCount: number };
  cost: ReviewCost | null;
  recap: ReviewRecap;
}

export interface ReviewCall {
  callId: string;
  sessionId: string | null;
  startedAt: string;
  /** Telnyx and ElevenLabs calls: when the recording began. Null means it began at startedAt. */
  recordingStartedAt: string | null;
  durationSeconds: number | null;
}

export interface ReviewTurn {
  direction: string | null;
  content: string | null;
  createdAt: string | null;
  spokenAt: string | null;
  kind: string | null;
}

export interface ReviewEvent {
  kind: string;
  toolName: string | null;
  status: string | null;
  error: string | null;
  args: unknown;
  result: unknown;
  startedAt: string;
  latencyMs: number | null;
}

/** Engine calls get "el_" ids for ElevenLabs conversations; everything else is GPT Live. */
export function callEngine(callId: string, sessionId: string | null): ReviewEngine {
  return callId.startsWith("el_") || (sessionId ?? "").startsWith("el_") ? "elevenlabs" : "gpt-live";
}

const MAX_TEXT = 120;
// A turn's row is written this long after its speaker's LAST words (the engine's TURN_GAP_S).
const TURN_GAP_S = 1.4;
// Keys that may carry credentials (ElevenLabs tool headers hold the webhook secret): dropped, never masked.
const SENSITIVE_KEY = /secret|token|header|authoriz|password|api[-_]?key|cookie|credential/i;

const looksJson = (t: string) => /^\s*[{[]/.test(t);
const SENSITIVE_PAIR = new RegExp(
  `"[^"]*(?:${SENSITIVE_KEY.source})[^"]*"\\s*:\\s*(?:\\{[^{}]*\\}|\\[[^\\[\\]]*\\]|"(?:[^"\\\\]|\\\\.)*"|[^,}\\]]*)`, "gi",
);

/** A string value: JSON inside it (tool results nest JSON in strings) is parsed and scrubbed too. */
function scrubText(text: string, depth: number): string {
  if (!looksJson(text)) return text;
  try {
    return JSON.stringify(scrub(JSON.parse(text), depth + 1)) ?? "";
  } catch {
    // Cut off or not quite JSON: drop the sensitive pairs, and the whole text if one is left.
    const cleaned = text.replace(SENSITIVE_PAIR, "");
    return new RegExp(`"[^"]*(?:${SENSITIVE_KEY.source})[^"]*"\\s*:`, "i").test(cleaned) ? "" : cleaned;
  }
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6) return undefined;
  if (typeof value === "string") return scrubText(value, depth);
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!SENSITIVE_KEY.test(k)) out[k] = scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

function clip(text: string): string {
  return text.length <= MAX_TEXT ? text : `${text.slice(0, MAX_TEXT - 1)}\u2026`;
}

function show(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return clip(scrubText(value, 0));
  try { return clip(JSON.stringify(scrub(value)) ?? ""); } catch { return ""; }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round1 = (n: number) => Math.round(n * 10) / 10;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object").map(obj) : []);

const roleOf = (raw: unknown): "user" | "agent" | null => (raw === "agent" ? "agent" : raw === "caller" || raw === "user" ? "user" : null);

function costOf(raw: unknown): ReviewCost | null {
  const c = obj(raw);
  const total = num(c.total), minutes = num(c.minutes), ai = num(c.ai), recap = num(c.recap), telephony = num(c.telephony);
  if (total === null || minutes === null || ai === null || recap === null || telephony === null) return null;
  return { total, minutes, ai, recap, telephony, estimate: c.estimate === true };
}

/** The engine's PRICES_VERSION (call_costs.py) since which ElevenLabs minutes are priced. */
export const ELEVEN_PRICES_SINCE = "2026-10-23";

/**
 * Whether a call's stored cost is one the test list can show. ElevenLabs rows priced
 * before ElevenLabs minutes were (Voice_Calls.usage.prices_version older than
 * ELEVEN_PRICES_SINCE), or without the review's cost in turn_metrics, carry an old,
 * wrong price. GPT Live was priced right before this, so its cost always counts.
 */
export function costIsCurrent(engine: ReviewEngine, usage: unknown, metrics: unknown): boolean {
  if (engine !== "elevenlabs") return true;
  const version = obj(usage).prices_version;
  return typeof version === "string" && version >= ELEVEN_PRICES_SINCE && costOf(obj(metrics).cost) !== null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}

/**
 * A GPT Live staff test's tool events carry the browser's clock, its metric tools the
 * trace's offsets from session start (staff_test.py), both from the same relay. The
 * first event that matches a metric tool on name and latency gives where the trace
 * began on the browser clock, so every tool lands on the trace's clock with the turns.
 * Null when nothing matches: the tools then fall back to the call's start.
 */
function traceStartMs(toolEvents: ReviewEvent[], metricTools: Record<string, unknown>[]): number | null {
  for (const e of toolEvents) {
    const ms = new Date(e.startedAt).getTime();
    if (Number.isNaN(ms)) continue;
    const hit = metricTools.find((t) => t.name === e.toolName && num(t.latency_ms) === e.latencyMs && num(t.at_s) !== null);
    if (hit) return ms - (num(hit.at_s) as number) * 1000;
  }
  return null;
}

export function buildCallReview(
  call: ReviewCall,
  turns: ReviewTurn[],
  events: ReviewEvent[],
  metrics: unknown,
  recap: ReviewRecap = NO_RECAP,
): CallReview {
  const engine = callEngine(call.callId, call.sessionId);
  const m = obj(metrics);
  const metricTurns = list(m.turns);
  // Offsets count from the start of the recording.
  const t0 = new Date(call.recordingStartedAt ?? call.startedAt).getTime();
  const secs = (iso: string | null): number | null => {
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : (ms - t0) / 1000;
  };

  const spoken = turns.filter((t) => t.kind !== "receipt");
  let prevAt = 0;
  const out: ReviewTurnOut[] = spoken.map((t, i) => {
    const role: "user" | "agent" = t.direction === "inbound" ? "user" : "agent";
    const metric = metricTurns[i];
    const fits = metric !== undefined && roleOf(metric.role) === role;

    const spokenS = secs(t.spokenAt);
    const createdS = secs(t.createdAt);
    const stamped = spokenS ?? (createdS === null ? null : createdS - TURN_GAP_S);
    // Both engines' metrics time turns from their start on the recording's clock (ElevenLabs'
    // own, the GPT Live staff trace from session start); rows are only the fallback.
    const metricAt = fits ? num(metric.at_s) : null;
    const atS = round1(Math.max(0, metricAt ?? stamped ?? prevAt));
    prevAt = atS;

    let delayMs: number | null = null;
    if (fits) {
      const d = num(metric.delay_ms);
      delayMs = d !== null && d >= 0 && role === "agent" ? Math.round(d) : null;
    } else if (role === "agent" && spokenS !== null) {
      // No metrics: caller's last words (row time minus the turn gap) to her first words.
      const before = spoken[i - 1];
      const callerDone = before && before.direction === "inbound" ? secs(before.createdAt) : null;
      // A gap at or below zero means the two clocks overlap (she spoke over him): no usable delay.
      const gapMs = callerDone === null ? 0 : Math.round((spokenS - (callerDone - TURN_GAP_S)) * 1000);
      if (gapMs > 0) delayMs = gapMs;
    }
    return { i, role, text: t.content ?? "", atS, delayMs };
  });

  const toolEvents = events.filter((e) => e.kind === "tool");
  const traceT0 = engine === "gpt-live" ? traceStartMs(toolEvents, list(m.tools)) : null;
  const toolSecs = (iso: string): number | null => {
    if (traceT0 === null) return secs(iso);
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : (ms - traceT0) / 1000;
  };
  const eventTools: ReviewTool[] = toolEvents
    .map((e) => ({
      name: e.toolName ?? "tool",
      atS: round1(Math.max(0, toolSecs(e.startedAt) ?? 0)),
      ms: e.latencyMs ?? null,
      args: show(e.args),
      result: show(e.result ?? e.error),
    }));
  const tools: ReviewTool[] = eventTools.length
    ? eventTools
    : list(m.tools).map((t) => ({
        name: typeof t.name === "string" ? t.name : "tool",
        atS: round1(Math.max(0, num(t.at_s) ?? 0)),
        ms: num(t.latency_ms),
        args: "",
        result: "",
      }));

  const delays = out.map((t) => t.delayMs).filter((d): d is number => d !== null);
  const lastAt = out.length ? out[out.length - 1].atS : 0;
  return {
    callId: call.callId,
    engine,
    startedAt: call.startedAt,
    durationSeconds: call.durationSeconds ?? Math.ceil(lastAt),
    recordingUrl: call.sessionId ? `/api/voice-calls/${encodeURIComponent(call.callId)}/recording` : null,
    stereo: engine === "gpt-live",
    turns: out,
    tools,
    summary: {
      medianDelayMs: median(delays),
      slowestDelayMs: delays.length ? Math.max(...delays) : null,
      toolCount: tools.length,
    },
    cost: costOf(m.cost),
    recap,
  };
}

/** The call's turn_metrics json, or null (older call, or the column is missing). */
async function loadTurnMetrics(callId: string): Promise<unknown> {
  const [{ eq }, { db }, { voiceCalls }] = await Promise.all([
    import("drizzle-orm"), import("../db"), import("@shared/schema"),
  ]);
  const [row] = await db.select({ m: voiceCalls.turnMetrics }).from(voiceCalls).where(eq(voiceCalls.callId, callId));
  return row?.m ?? null;
}

/** Review of a call the caller may see (the route loads it with the access rule and its events). */
export async function loadCallReview(detail: {
  callId: string; sessionId: string | null; startedAt: string; recordingStartedAt: string | null;
  durationSeconds: number | null; turns: ReviewTurn[]; events: ReviewEvent[];
  intents?: string[]; outcome?: string | null; summary?: Parameters<typeof recapOf>[0]["summary"];
}): Promise<CallReview> {
  return buildCallReview(detail, detail.turns, detail.events, await loadTurnMetrics(detail.callId), recapOf(detail));
}
