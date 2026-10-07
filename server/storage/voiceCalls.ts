import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { interactions, voiceCalls, type VoiceCall, type VoiceCallSummary } from "@shared/schema";
import { deriveOutcome, isVoiceOutcome, type VoiceOutcome } from "@shared/voiceOutcome";
import type { VoiceAccess } from "../routes/voiceCallsAccess";
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

export type { VoiceOutcome };
export type VoiceScope = "live" | "demo";

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
  scope: VoiceScope;
  /** Demo calls only. Null falls back to "Universal demo" in the client. */
  personaCompany: string | null;
  personaNiche: string | null;
  accountId: number;
  /** Only populated for agency users. */
  accountName: string | null;
}

export interface VoiceStats {
  calls: number;
  bookedRate: number;
  avgDurationSeconds: number | null;
}

export interface VoiceCapabilities {
  live: boolean;
  demo: boolean;
}

export interface VoiceCallTurn {
  id: number;
  who: string | null;
  direction: string | null;
  content: string | null;
  createdAt: string | null;
}

export interface VoiceCallDetail extends VoiceCallListItem {
  summary: VoiceCallSummary | null;
  turns: VoiceCallTurn[];
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
  accountName: string | null;
}

export function toItem(row: VoiceCall, x: ItemExtras): VoiceCallListItem {
  const end = row.endedAt ?? (x.lastTurn ? new Date(x.lastTurn) : null);
  const durationSeconds = end
    ? Math.max(0, Math.round((end.getTime() - row.startedAt.getTime()) / 1000))
    : null;
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
    callerNumber: x.callerNumber,
    scope: x.isDemo ? "demo" : "live",
    personaCompany: x.isDemo ? row.personaCompany : null,
    personaNiche: x.isDemo ? row.personaNiche : null,
    accountId: row.accountsId,
    accountName: x.accountName,
  };
}

/** Live ALWAYS excludes demo calls, whoever asks. */
export function scopeWhere(scope: VoiceScope, accountId: number | null): SQL {
  // Test calls are listed on the tested client's Voice tab instead.
  const base = scope === "demo" ? sql`${isDemoSql} AND ${testAccountIdSql} IS NULL` : sql`NOT ${isDemoSql}`;
  return accountId === null ? base : sql`${base} AND ${voiceCalls.accountsId} = ${accountId}`;
}

export function itemColumns(includeAccountName: boolean) {
  return {
    call: voiceCalls,
    lastTurn: lastTurnAt,
    leadStatus: leadStatusOf,
    callerNumber: leadPhoneOf,
    isDemo: isDemoSql,
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
  }): Promise<VoiceCallListItem[]> {
    const rows = await db
      .select(itemColumns(opts.includeAccountName))
      .from(voiceCalls)
      .where(scopeWhere(opts.scope, opts.accountId))
      .orderBy(desc(voiceCalls.startedAt))
      .limit(opts.limit)
      .offset(opts.offset);
    return rows.map((r) => toItem(r.call, r));
  },

  /** Browser test calls of one client's line, newest first (Voice tab). */
  async listTestCalls(accountId: number, limit = 10): Promise<VoiceCallListItem[]> {
    const rows = await db
      .select(itemColumns(false))
      .from(voiceCalls)
      .where(sql`${testAccountIdSql} = ${accountId}`)
      .orderBy(desc(voiceCalls.startedAt))
      .limit(limit);
    return rows.map((r) => toItem(r.call, r));
  },

  /**
   * Returns undefined (the route answers 404, never 403) when the call is a
   * demo call the caller may not see, or belongs to another account.
   */
  async getVoiceCall(
    callId: string,
    opts: { accountId: number | null; allowDemo: boolean; includeAccountName?: boolean },
  ): Promise<VoiceCallDetail | undefined> {
    const [row] = await db
      .select(itemColumns(opts.includeAccountName ?? false))
      .from(voiceCalls)
      .where(eq(voiceCalls.callId, callId));
    if (!row) return undefined;
    if (row.isDemo && !opts.allowDemo) return undefined;
    if (opts.accountId !== null && row.call.accountsId !== opts.accountId) return undefined;
    const turns = await db
      .select({
        id: interactions.id,
        who: interactions.who,
        direction: interactions.direction,
        content: interactions.content,
        createdAt: interactions.createdAt,
      })
      .from(interactions)
      .where(and(
        eq(interactions.conversationThreadId, callId),
        eq(interactions.type, "voice_call"),
      ))
      .orderBy(asc(interactions.createdAt), asc(interactions.id));
    return {
      ...toItem(row.call, row),
      summary: normalizeSummary(row.call.summary),
      turns: turns.map((t) => ({
        id: t.id as number,
        who: t.who,
        direction: t.direction,
        content: t.content,
        createdAt: t.createdAt ? t.createdAt.toISOString() : null,
      })),
    };
  },

  /** Rolling 7 days, computed in SQL so the list's row cap does not matter. */
  async getVoiceStats(opts: { scope: VoiceScope; accountId: number | null }): Promise<VoiceStats> {
    const result = await db.execute(sql`
      SELECT count(*)::int AS calls,
             count(*) FILTER (WHERE booked_slot IS NOT NULL)::int AS booked,
             avg(dur) FILTER (WHERE dur >= 10) AS avg_dur
      FROM (
        SELECT ${voiceCalls.bookedSlot} AS booked_slot, ${durationSecondsSql} AS dur
        FROM ${voiceCalls}
        WHERE ${voiceCalls.startedAt} > now() - interval '7 days'
          AND ${scopeWhere(opts.scope, opts.accountId)}
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

  async getVoiceCapabilities(access: VoiceAccess): Promise<VoiceCapabilities> {
    if (access.isOwner) return { live: true, demo: true };
    const result = await db.execute(sql`SELECT ${hasEnabledClientLineSql(access.lockedAccountId)} AS ok`);
    return { live: (result.rows[0] as { ok: boolean }).ok === true, demo: false };
  },
};
