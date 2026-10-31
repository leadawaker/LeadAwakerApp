import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { T, liveCallSql } from "./homeSql";
import { interactions, leads, voiceCalls, voiceNumbers, type VoiceCall, type VoiceCallSummary } from "@shared/schema";
import { deriveOutcome, isVoiceOutcome, type VoiceOutcome } from "@shared/voiceOutcome";
import { demoCallVisible, type VoiceAccess } from "../routes/voiceCallsAccess";
import {
  accountNameOf,
  durationSecondsSql,
  hasEnabledClientLineSql,
  isDemoSql,
  lastTurnAt,
  leadPhoneOf,
  leadStatusOf,
  testAccountIdSql,
} from "./voiceCallsSql";
import { listVoiceCallEvents, type VoiceCallEventItem } from "./voiceCallEvents";
import { callEngine, costIsCurrent, type ReviewEngine } from "./voiceCallReview";

export type { VoiceOutcome };
export type VoiceScope = "live" | "demo" | "test";

export interface VoiceCallListItem {
  callId: string;
  sessionId: string | null;
  leadsId: number | null;
  callerName: string | null;
  language: string | null;
  startedAt: string;
  durationSeconds: number | null;
  turnCount: number;
  bookedSlot: string | null;
  bookedIso: string | null;
  /** Always set: the stored column, or derived with the engine's rules when the row predates it. */
  outcome: VoiceOutcome;
  /** The old free-text recap outcome (`summary.outcome`). */
  conclusion: string | null;
  /** What the caller raised, from the recap; drives the avatar colour. */
  intents: string[];
  /** The linked lead's pipeline status, so a DND lead shows as such. */
  leadStatus: string | null;
  /** The number the caller rang from (made up for the web demo). */
  callerNumber: string | null;
  /** The tab the call belongs to: test (the Test call button), else demo, else live. */
  scope: VoiceScope;
  /** Owner-flagged test data: hidden from clients. */
  isTest: boolean;
  /** Demo calls only. Null falls back to "Universal demo" in the client. */
  personaCompany: string | null;
  personaNiche: string | null;
  accountId: number;
  /** Only populated for agency users. */
  accountName: string | null;
  /** Test-call list only (null elsewhere): what the call cost us, USD; the route nulls it again for non-Owners. */
  costUsd: number | null;
  /** Test-call list only (null elsewhere): gpt-live or elevenlabs, from the call id. */
  engine: ReviewEngine | null;
  /** Test-call list only (null elsewhere): false when costUsd is an old, wrong price (costIsCurrent). */
  costCurrent: boolean | null;
  /** Test-call list only (null elsewhere): median reply delay in ms (Voice_Calls.latency_ms); null on older calls. */
  latencyMs: number | null;
}

export interface VoiceStats {
  calls: number;
  bookedRate: number;
  avgDurationSeconds: number | null;
}

export interface VoiceCapabilities {
  live: boolean;
  demo: boolean;
  /** The Tests tab: agency users (Owner, Admin). */
  test: boolean;
}

export interface VoiceCallTurn {
  id: number;
  who: string | null;
  direction: string | null;
  content: string | null;
  /** When the row was written: after the speaker's LAST words. */
  createdAt: string | null;
  /** When the turn's first words were heard (metadata.spoken_at); null on older calls. */
  spokenAt: string | null;
  /** metadata.kind: "receipt" for a booking/cancel line that was written, never spoken. */
  kind: string | null;
}

export type { VoiceCallEventItem };

export interface VoiceCallDetail extends VoiceCallListItem {
  summary: VoiceCallSummary | null;
  turns: VoiceCallTurn[];
  /** The Grok test calls (2026-10-22): when the recording began. Null means it began at startedAt. */
  recordingStartedAt: string | null;
  /** Tool calls and backend delegations, oldest first. */
  events: VoiceCallEventItem[];
}

function metaOf(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try { const v = JSON.parse(raw); return v && typeof v === "object" ? v : {}; } catch { return {}; }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/**
 * `record_summary` stores tool arguments verbatim, and `/voice/relay` is
 * unauthenticated, so `summary` in the DB may be `{}`, missing `items`, or
 * have non-string fields. Coerce it into something the detail pane can
 * safely `.items.length`/`.map` and render, dropping anything that does not
 * fit rather than throwing.
 */
function normalizeSummary(raw: unknown): VoiceCallSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name : null;
  const outcome = typeof obj.outcome === "string" ? obj.outcome : null;
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = rawItems
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      intent: typeof item.intent === "string" ? item.intent : "",
      interest: typeof item.interest === "string" ? item.interest : null,
      notes: typeof item.notes === "string" ? item.notes : null,
    }))
    .filter((item) => item.intent !== "");
  return { name, outcome, items };
}

// A call that never got an ended_at and has been quiet this long was dropped.
const ABANDONED_AFTER_MS = 15 * 60 * 1000;

interface ItemExtras {
  lastTurn: string | Date | null;
  leadStatus: string | null;
  callerNumber: string | null;
  isDemo: boolean;
  /** A test call (testCallSql). */
  testCall: boolean;
  accountName: string | null;
  /** The test-call list's extra figures (cost, engine, reply speed). Off by default: most lists reach clients. */
  forTestList?: boolean;
}

/**
 * ElevenLabs calls: the provider's own call length (`usage.seconds` = its call_duration_secs),
 * which matches the recording. Our started_at is stamped well before her audio starts (up to
 * ~10s on browser calls), so the wall clock overstates short calls. GPT-Live `usage.seconds` is
 * our wall clock again, so GPT-Live calls use `usage.recording_seconds`: the stored recording's
 * own length (engine live_recording_length.py), which is what the player plays. Rows without it
 * fall back to the wall clock.
 */
function meteredSeconds(usage: unknown): number | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as { live_model?: unknown; seconds?: unknown; recording_seconds?: unknown };
  if (u.recording_seconds != null) {
    const r = typeof u.recording_seconds === "number" ? u.recording_seconds : Number(u.recording_seconds);
    if (Number.isFinite(r) && r >= 0) return Math.round(r);
  }
  if (typeof u.live_model !== "string" || !u.live_model.startsWith("eleven")) return null;
  const s = typeof u.seconds === "number" ? u.seconds : Number(u.seconds);
  return Number.isFinite(s) && s > 0 ? Math.round(s) : null;
}

/** The demo stores the placeholder "web" as a number: that is not one. */
function realCallerNumber(v: string | null): string | null {
  return v && v.trim() !== "" && v.trim() !== "web" ? v : null;
}

export function toItem(row: VoiceCall, x: ItemExtras): VoiceCallListItem {
  const end = row.endedAt ?? (x.lastTurn ? new Date(x.lastTurn) : null);
  const durationSeconds = meteredSeconds(row.usage) ?? (end
    ? Math.max(0, Math.round((end.getTime() - row.startedAt.getTime()) / 1000))
    : null);
  const summary = normalizeSummary(row.summary);
  const intents = summary?.items.map((i) => i.intent) ?? [];
  const outcome: VoiceOutcome = isVoiceOutcome(row.outcome)
    ? row.outcome
    : deriveOutcome({
        transferred: false, // not derivable for old rows, so they never show it
        bookedSlot: row.bookedSlot,
        intents,
        durationSeconds,
        hasSummary: !!summary,
        abandoned: row.endedAt === null && Date.now() - row.startedAt.getTime() > ABANDONED_AFTER_MS,
      });
  return {
    callId: row.callId,
    sessionId: row.sessionId,
    leadsId: row.leadsId,
    callerName: summary?.name ?? null,
    language: row.language,
    startedAt: row.startedAt.toISOString(),
    durationSeconds,
    turnCount: row.turnCount,
    bookedSlot: row.bookedSlot,
    bookedIso: row.bookedIso ? row.bookedIso.toISOString() : null,
    outcome,
    conclusion: summary?.outcome ?? null,
    intents,
    leadStatus: x.leadStatus,
    // The lead's phone, else (Live only) the number the line saw ring: a phone call that never
    // got a lead (caller hung up before she spoke) would otherwise read as "Web caller".
    // Demo and Tests keep the lead's phone only (their stored caller_number is made up).
    callerNumber: x.callerNumber ?? (!x.isDemo && !x.testCall ? realCallerNumber(row.callerNumber) : null),
    scope: scopeOf(x),
    isTest: row.isTest === true,
    personaCompany: x.isDemo ? row.personaCompany : null,
    personaNiche: x.isDemo ? row.personaNiche : null,
    accountId: row.accountsId,
    accountName: x.accountName,
    costUsd: x.forTestList && row.costUsd !== null && Number.isFinite(Number(row.costUsd)) ? Number(row.costUsd) : null,
    engine: x.forTestList ? callEngine(row.callId, row.sessionId) : null,
    costCurrent: x.forTestList ? costIsCurrent(callEngine(row.callId, row.sessionId), row.usage, row.turnMetrics) : null,
    latencyMs: x.forTestList ? row.latencyMs ?? null : null,
  };
}

/**
 * Every call belongs to exactly one tab: Tests first (browser test calls), then Demo, else
 * Live. So Live and Demo never hold a browser test call, whoever asks. `hideTest` (clients)
 * also drops calls and leads Gabriel marked as test data.
 */
export function scopeWhere(scope: VoiceScope, accountId: number | null, hideTest = false): SQL {
  const base = scope === "test" ? testCallSql
    : scope === "demo" ? sql`${isDemoSql} AND NOT ${testCallSql}`
    : sql`NOT ${isDemoSql} AND NOT ${testCallSql}`;
  // Test calls live in the demo account and point to the tested client through test_account_id.
  const accountCol = scope === "test" ? testAccountIdSql : voiceCalls.accountsId;
  const scoped = accountId === null ? base : sql`${base} AND ${accountCol} = ${accountId}`;
  return hideTest ? sql`${scoped} AND ${notTestSql}` : scoped;
}

/** The tab of a call row (the same order as scopeWhere). */
export function scopeOf(x: { isDemo: boolean; testCall: boolean }): VoiceScope {
  return x.testCall ? "test" : x.isDemo ? "demo" : "live";
}

/** Not flagged is_test itself and not linked to a lead flagged is_test. */
export const notTestSql = sql`(COALESCE(${voiceCalls.isTest}, false) = false
  AND NOT EXISTS (SELECT 1 FROM ${leads} tl WHERE tl.id = ${voiceCalls.leadsId} AND tl.is_test = true))`;

/**
 * A test call: one staff made from the "Test call" button on an account's Voice tab (the
 * engine tags it with test_account_id). These make up the Tests tab; calls other people made
 * stay in Live or Demo, whatever the test-data marks say.
 */
export const testCallSql = sql<boolean>`(${testAccountIdSql} IS NOT NULL)`;

export function itemColumns(includeAccountName: boolean) {
  return {
    call: voiceCalls,
    lastTurn: lastTurnAt,
    leadStatus: leadStatusOf,
    callerNumber: leadPhoneOf,
    isDemo: isDemoSql,
    testCall: testCallSql,
    testAccountId: testAccountIdSql,
    accountName: includeAccountName ? accountNameOf : sql<string | null>`NULL::text`,
  };
}

export const voiceCallsStorage = {
  async listVoiceCalls(opts: {
    limit: number;
    offset: number;
    scope: VoiceScope;
    accountId: number | null;
    includeAccountName: boolean;
    hideTest?: boolean;
    /** One person's calls (People tab): their lead, or a number without a lead. */
    leadId?: number;
    callerNumber?: string;
  }): Promise<VoiceCallListItem[]> {
    const conds: SQL[] = [scopeWhere(opts.scope, opts.accountId, opts.hideTest)];
    if (opts.leadId !== undefined) conds.push(eq(voiceCalls.leadsId, opts.leadId));
    else if (opts.callerNumber !== undefined) conds.push(sql`${voiceCalls.leadsId} IS NULL AND ${voiceCalls.callerNumber} = ${opts.callerNumber}`);
    const rows = await db
      .select(itemColumns(opts.includeAccountName))
      .from(voiceCalls)
      .where(and(...conds))
      .orderBy(desc(voiceCalls.startedAt))
      .limit(opts.limit)
      .offset(opts.offset);
    return rows.map((r) => toItem(r.call, r));
  },

  /** Live calls (never demo or test) that started after `since`: the Calls nav badge. */
  async countVoiceCallsSince(opts: { accountId: number | null; since: Date }): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(voiceCalls)
      .where(and(scopeWhere("live", opts.accountId, true), sql`${voiceCalls.startedAt} > ${opts.since}`));
    return row?.n ?? 0;
  },

  /** Browser test calls of one client's line, newest first (Voice tab). */
  async listTestCalls(accountId: number, limit = 50): Promise<VoiceCallListItem[]> {
    const rows = await db
      .select(itemColumns(false))
      .from(voiceCalls)
      .where(sql`${testAccountIdSql} = ${accountId}`)
      .orderBy(desc(voiceCalls.startedAt))
      .limit(limit);
    return rows.map((r) => toItem(r.call, { ...r, forTestList: true }));
  },

  /**
   * Returns undefined (the route answers 404, never 403) when the call is a
   * demo call the caller may not see, or belongs to another account.
   */
  async getVoiceCall(
    callId: string,
    opts: { accountId: number | null; allowDemo: boolean; allowTest?: boolean; includeAccountName?: boolean; hideTest?: boolean; includeEvents?: boolean },
  ): Promise<VoiceCallDetail | undefined> {
    const [row] = await db
      .select(itemColumns(opts.includeAccountName ?? false))
      .from(voiceCalls)
      .where(eq(voiceCalls.callId, callId));
    if (!row) return undefined;
    if (opts.hideTest) {
      const [t] = await db.select({ hidden: sql<boolean>`NOT ${notTestSql}` }).from(voiceCalls).where(eq(voiceCalls.callId, callId));
      if (t?.hidden) return undefined;
    }
    // Browser test calls classify as demo; agency users may open them (allowTest), real demo calls stay Owner only.
    if (!demoCallVisible({ isDemo: row.isDemo, testAccountId: row.testAccountId }, { allowDemo: opts.allowDemo, allowTest: opts.allowTest === true })) return undefined;
    const ownerAccount = row.testAccountId ?? row.call.accountsId;
    if (opts.accountId !== null && ownerAccount !== opts.accountId) return undefined;
    const turns = await db
      .select({
        id: interactions.id,
        who: interactions.who,
        direction: interactions.direction,
        content: interactions.content,
        createdAt: interactions.createdAt,
        metadata: interactions.metadata,
      })
      .from(interactions)
      .where(and(
        eq(interactions.conversationThreadId, callId),
        eq(interactions.type, "voice_call"),
      ))
      .orderBy(asc(interactions.createdAt), asc(interactions.id));
    // Tool calls and backend lookups are our plumbing: agency staff only.
    const events = opts.includeEvents ? await listVoiceCallEvents(callId) : [];
    // The line's name only while the line still belongs to this call's account: a number lent
    // to another client answered under another name before, and those calls stay generic.
    const [line] = row.call.voiceNumbersId !== null && !row.isDemo
      ? await db.select({ agentName: voiceNumbers.agentName, accountsId: voiceNumbers.accountsId }).from(voiceNumbers).where(eq(voiceNumbers.id, row.call.voiceNumbersId))
      : [];
    return {
      ...toItem(row.call, row),
      agentName: line?.accountsId === row.call.accountsId ? line.agentName : null,
      summary: normalizeSummary(row.call.summary),
      recordingStartedAt: row.call.recordingStartedAt ? row.call.recordingStartedAt.toISOString() : null,
      events,
      turns: turns.map((t) => {
        const meta = metaOf(t.metadata);
        return {
          id: t.id as number,
          who: t.who,
          direction: t.direction,
          content: t.content,
          createdAt: t.createdAt ? t.createdAt.toISOString() : null,
          spokenAt: typeof meta.spoken_at === "string" ? meta.spoken_at : null,
          kind: typeof meta.kind === "string" ? meta.kind : null,
        };
      }),
    };
  },

  /**
   * The call that made a lead's booking (Calendar detail): this lead's booked
   * calls, the one whose slot matches the lead's booked_call_date first, else
   * the newest. Same reach rule as getVoiceCall; null when there is none.
   */
  async findBookingCallId(
    leadId: number,
    opts: { accountId: number | null; allowDemo: boolean; hideTest?: boolean },
  ): Promise<string | null> {
    const conds: SQL[] = [eq(voiceCalls.leadsId, leadId), sql`${voiceCalls.bookedSlot} IS NOT NULL`];
    if (opts.accountId !== null) conds.push(eq(voiceCalls.accountsId, opts.accountId));
    if (!opts.allowDemo) conds.push(sql`NOT ${isDemoSql}`);
    if (opts.hideTest) conds.push(notTestSql);
    const bookedAt = sql`(SELECT l.booked_call_date FROM ${leads} l WHERE l.id = ${leadId})`;
    const [row] = await db
      .select({ callId: voiceCalls.callId })
      .from(voiceCalls)
      .where(and(...conds))
      .orderBy(
        sql`(${voiceCalls.bookedIso} IS NOT NULL AND ${voiceCalls.bookedIso} = ${bookedAt}) DESC`,
        desc(voiceCalls.startedAt),
      )
      .limit(1);
    return row?.callId ?? null;
  },

  /** Rolling 7 days, computed in SQL so the list's row cap does not matter. */
  async getVoiceStats(opts: { scope: VoiceScope; accountId: number | null; hideTest?: boolean }): Promise<VoiceStats> {
    const result = await db.execute(sql`
      SELECT count(*)::int AS calls,
             count(*) FILTER (WHERE booked_slot IS NOT NULL)::int AS booked,
             avg(dur) FILTER (WHERE dur >= 10) AS avg_dur
      FROM (
        SELECT ${voiceCalls.bookedSlot} AS booked_slot, ${durationSecondsSql} AS dur
        FROM ${voiceCalls}
        WHERE ${voiceCalls.startedAt} > now() - interval '7 days'
          AND ${scopeWhere(opts.scope, opts.accountId, opts.hideTest)}
      ) t
    `);
    const r = result.rows[0] as { calls: number; booked: number; avg_dur: string | number | null };
    const calls = Number(r.calls) || 0;
    const booked = Number(r.booked) || 0;
    return {
      calls,
      bookedRate: calls ? booked / calls : 0,
      avgDurationSeconds: r.avg_dur === null || r.avg_dur === undefined ? null : Math.round(Number(r.avg_dur)),
    };
  },

  /** Owner toggle: flags the call, and its lead when it has one. False when the call does not exist. */
  async setCallTestFlag(callId: string, isTest: boolean): Promise<boolean> {
    const [call] = await db
      .update(voiceCalls)
      .set({ isTest })
      .where(eq(voiceCalls.callId, callId))
      .returning({ leadsId: voiceCalls.leadsId });
    if (!call) return false;
    if (call.leadsId !== null) {
      await db.update(leads).set({ isTest }).where(eq(leads.id, call.leadsId));
    }
    return true;
  },

  async getVoiceCapabilities(access: VoiceAccess): Promise<VoiceCapabilities> {
    if (access.isOwner) return { live: true, demo: true, test: true };
    // Same rule as the Home phone service: an enabled client line, or a live call in the last 90 days.
    const result = await db.execute(sql`SELECT (
      ${hasEnabledClientLineSql(access.lockedAccountId)}
      OR EXISTS (SELECT 1 FROM ${T.voiceCalls} vc
                 WHERE vc.accounts_id = ${access.lockedAccountId} AND vc.started_at > now() - interval '90 days'
                   AND ${liveCallSql})
    ) AS ok`);
    return { live: (result.rows[0] as { ok: boolean }).ok === true, demo: false, test: access.isAgency };
  },
};
