/**
 * Data for the weekly voice call review: the week's ElevenLabs phone calls with their
 * transcripts, tool events and knowledge base, and the Voice_Reviews rows themselves.
 *
 * Only real phone calls count: this account, call id starting `el_`, and no
 * test_account_id (browser tests, live or draft, carry it). A week is claimed with one
 * INSERT ... ON CONFLICT so a missed or repeated run can never review it twice.
 */
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db";
import {
  accounts, interactions, leads, voiceCallEvents, voiceCalls, voiceReviews, type VoiceReviewRow,
} from "@shared/schema";
import type { CallLabelDto, ReviewDto, ReviewKind, ReviewReport, ReviewStats, ReviewStatus } from "@shared/voiceReview";
import type { ReviewCallRow } from "../voice/review/reviewStats";
import type { ReviewWeek } from "../voice/review/weekWindow";
import { testAccountIdSql } from "./voiceCallsSql";

export interface TranscriptTurn { role: "caller" | "agent"; text: string }
export interface ToolEventLite { tool: string; status: string | null; error: string | null; args: string }

const KB_TABLE = sql.raw(`"p2mxx34fvbf3ll6"."Account_Knowledge_Base"`);
const STOCK_TITLE = "Current stock, updated every hour";
const SECRET_KEY = /secret|token|header|authoriz|password|api[-_]?key|cookie/i;
const ARGS_MAX_CHARS = 200;
const ERROR_MAX_CHARS = 500;
const REVIEW_LOCK_KEY = 4_217_002;

const callOf = sql`${voiceCalls}."call_id"`;

/** ElevenLabs phone calls (with `withTests`, browser tests too) that started inside [start, end). */
const phoneCallsWhere = (start: Date, end: Date, withTests = false) => and(
  sql`left(${callOf}, 3) = 'el_'`,
  withTests ? undefined : sql`${testAccountIdSql} IS NULL`,
  gte(voiceCalls.startedAt, start),
  lt(voiceCalls.startedAt, end),
);

// ─── Calls ───────────────────────────────────────────────────────────────────

async function listReviewCalls(accountId: number, start: Date, end: Date, withTests = false): Promise<ReviewCallRow[]> {
  const rows = await db.select({
    callId: voiceCalls.callId,
    startedAt: voiceCalls.startedAt,
    endedAt: voiceCalls.endedAt,
    outcome: voiceCalls.outcome,
    endReason: voiceCalls.endReason,
    costUsd: voiceCalls.costUsd,
    latencyMs: voiceCalls.latencyMs,
    latencyP90Ms: voiceCalls.latencyP90Ms,
    toolErrors: sql<number>`(
      SELECT count(*)::int FROM ${voiceCallEvents} e
      WHERE e.call_id = ${callOf} AND e.kind = 'tool' AND (e.error IS NOT NULL OR e.status = 'error')
    )`,
  }).from(voiceCalls)
    .where(and(eq(voiceCalls.accountsId, accountId), phoneCallsWhere(start, end, withTests)))
    .orderBy(asc(voiceCalls.startedAt), asc(voiceCalls.id));
  return rows.map((r) => ({
    callId: r.callId,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt ? r.endedAt.toISOString() : null,
    outcome: r.outcome,
    endReason: r.endReason,
    costUsd: r.costUsd == null ? null : Number(r.costUsd),
    latencyMs: r.latencyMs,
    latencyP90Ms: r.latencyP90Ms,
    toolErrors: Number(r.toolErrors) || 0,
  }));
}

const LABEL_DAYS = 180;
const LABEL_LIMIT = 2000;

/** The account's recent ElevenLabs calls (phone and browser) with the lead's name and the caller's number, for the call chips. */
async function voiceCallLabels(accountId: number): Promise<CallLabelDto[]> {
  const rows = await db.select({
    callId: voiceCalls.callId,
    startedAt: voiceCalls.startedAt,
    number: voiceCalls.callerNumber,
    firstName: leads.firstName,
    lastName: leads.lastName,
  }).from(voiceCalls)
    .leftJoin(leads, eq(leads.id, voiceCalls.leadsId))
    .where(and(
      eq(voiceCalls.accountsId, accountId),
      sql`left(${callOf}, 3) = 'el_'`,
      gte(voiceCalls.startedAt, sql`now() - make_interval(days => ${LABEL_DAYS})`),
    ))
    .orderBy(desc(voiceCalls.startedAt))
    .limit(LABEL_LIMIT);
  return rows.map((r) => ({
    callId: r.callId,
    startedAt: r.startedAt.toISOString(),
    name: [r.firstName, r.lastName].map((x) => x?.trim()).filter(Boolean).join(" ") || null,
    number: r.number?.trim() || null,
  }));
}

async function accountsWithElevenCalls(start: Date, end: Date): Promise<number[]> {
  const rows = await db.selectDistinct({ id: voiceCalls.accountsId }).from(voiceCalls)
    .where(phoneCallsWhere(start, end))
    .orderBy(asc(voiceCalls.accountsId));
  return rows.map((r) => r.id);
}

async function loadReviewTranscripts(callIds: string[]): Promise<Map<string, TranscriptTurn[]>> {
  const out = new Map<string, TranscriptTurn[]>();
  if (!callIds.length) return out;
  const rows = await db.select({
    callId: interactions.conversationThreadId,
    direction: interactions.direction,
    content: interactions.content,
    metadata: interactions.metadata,
  }).from(interactions)
    .where(and(eq(interactions.type, "voice_call"), inArray(interactions.conversationThreadId, callIds)))
    .orderBy(asc(interactions.createdAt), asc(interactions.id));
  for (const r of rows) {
    const meta = r.metadata as { kind?: unknown } | null;
    if (!r.callId || meta?.kind === "receipt" || !r.content?.trim()) continue;
    const turns = out.get(r.callId) ?? [];
    turns.push({ role: r.direction === "inbound" ? "caller" : "agent", text: r.content });
    out.set(r.callId, turns);
  }
  return out;
}

/** The args as JSON with credential-looking top-level keys removed, cut to a short line. */
function argsLine(args: unknown): string {
  if (args == null) return "";
  let safe = args;
  if (typeof args === "object" && !Array.isArray(args)) {
    safe = Object.fromEntries(Object.entries(args).filter(([k]) => !SECRET_KEY.test(k)));
  }
  return (JSON.stringify(safe) ?? "").slice(0, ARGS_MAX_CHARS);
}

async function loadReviewToolEvents(callIds: string[]): Promise<Map<string, ToolEventLite[]>> {
  const out = new Map<string, ToolEventLite[]>();
  if (!callIds.length) return out;
  const rows = await db.select().from(voiceCallEvents)
    .where(and(eq(voiceCallEvents.kind, "tool"), inArray(voiceCallEvents.callId, callIds)))
    .orderBy(asc(voiceCallEvents.startedAt), asc(voiceCallEvents.id));
  for (const r of rows) {
    const events = out.get(r.callId) ?? [];
    events.push({ tool: r.toolName ?? "unknown", status: r.status, error: r.error, args: argsLine(r.args) });
    out.set(r.callId, events);
  }
  return out;
}

/** The account's knowledge base, without the hourly stock note (it changes every hour and is not wording to review). */
async function loadAccountKnowledge(accountId: number): Promise<{ title: string; content: string }[]> {
  const res = await db.execute(sql`
    SELECT title, content FROM ${KB_TABLE}
    WHERE account_id = ${accountId} AND COALESCE(title, '') NOT LIKE ${`${STOCK_TITLE}%`}
    ORDER BY category, id
  `);
  return (res.rows as { title: string | null; content: string | null }[])
    .map((r) => ({ title: r.title ?? "", content: r.content ?? "" }));
}

async function accountNameOf(accountId: number): Promise<string> {
  const [row] = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, accountId));
  return row?.name?.trim() || `Account ${accountId}`;
}

// ─── Review rows ─────────────────────────────────────────────────────────────

/** Claim a week in one statement: a new row, or a failed or stalled one with fewer than 3 attempts. Null when not claimable. */
async function claimWeeklyReview(accountId: number, week: ReviewWeek): Promise<number | null> {
  const res = await db.execute(sql`
    INSERT INTO "p2mxx34fvbf3ll6"."Voice_Reviews" (accounts_id, kind, week_key, period_start, period_end, status, attempts, started_at)
    VALUES (${accountId}, 'weekly', ${week.weekKey}, ${week.periodStart.toISOString()}, ${week.periodEnd.toISOString()}, 'running', 1, now())
    ON CONFLICT (accounts_id, week_key) WHERE kind = 'weekly'
    DO UPDATE SET status = 'running', attempts = "Voice_Reviews".attempts + 1, started_at = now(), error = NULL
    WHERE "Voice_Reviews".attempts < 3 AND ("Voice_Reviews".status = 'failed'
      OR ("Voice_Reviews".status = 'running' AND "Voice_Reviews".started_at < now() - interval '30 minutes'))
    RETURNING id
  `);
  const row = (res.rows as { id: number }[])[0];
  return row ? row.id : null;
}

/**
 * Reviews that have sat in `running` for over 30 minutes and will not run again: a manual review (a
 * restart killed it mid-run) or a weekly one with every attempt used (the claim needs fewer than 3).
 * Mark them failed rather than leave the UI on "running" forever. A weekly review with attempts left
 * is not touched: the next tick claims it again. Returns how many were marked.
 */
async function failStalledReviews(): Promise<number> {
  const res = await db.execute(sql`
    UPDATE "p2mxx34fvbf3ll6"."Voice_Reviews" SET status = 'failed', error = 'stalled'
    WHERE status = 'running' AND started_at < now() - interval '30 minutes' AND (kind = 'manual' OR attempts >= 3)
    RETURNING id
  `);
  return res.rows.length;
}

/** A manual review of [start, end). Null when this account already has a review running (started in the last 30 minutes). */
async function createManualReview(accountId: number, start: Date, end: Date): Promise<number | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${REVIEW_LOCK_KEY}, ${accountId})`);
    const [busy] = await tx.select({ id: voiceReviews.id }).from(voiceReviews)
      .where(and(
        eq(voiceReviews.accountsId, accountId),
        eq(voiceReviews.status, "running"),
        sql`${voiceReviews.startedAt} > now() - interval '30 minutes'`,
      ))
      .limit(1);
    if (busy) return null;
    const [row] = await tx.insert(voiceReviews).values({
      accountsId: accountId, kind: "manual", periodStart: start, periodEnd: end, status: "running", attempts: 1,
    }).returning({ id: voiceReviews.id });
    return row.id;
  });
}

async function finishVoiceReview(
  id: number,
  out: { stats: ReviewStats; report: ReviewReport; model: string | null },
): Promise<void> {
  await db.update(voiceReviews)
    .set({ status: "done", stats: out.stats, report: out.report, model: out.model, error: null, finishedAt: new Date() })
    .where(eq(voiceReviews.id, id));
}

async function failVoiceReview(id: number, error: string): Promise<void> {
  await db.update(voiceReviews)
    .set({ status: "failed", error: error.slice(0, ERROR_MAX_CHARS) })
    .where(eq(voiceReviews.id, id));
}

function toReviewDto(r: VoiceReviewRow): ReviewDto {
  const stats = r.stats as Partial<ReviewStats> | null;
  return {
    id: r.id,
    accountId: r.accountsId,
    kind: r.kind as ReviewKind,
    weekKey: r.weekKey,
    periodStart: new Date(r.periodStart).toISOString(),
    periodEnd: new Date(r.periodEnd).toISOString(),
    status: r.status as ReviewStatus,
    // A running or failed review has `{}`: no numbers yet.
    stats: stats && typeof stats.calls === "number" ? (stats as ReviewStats) : null,
    report: (r.report as ReviewReport | null) ?? null,
    error: r.error,
    startedAt: new Date(r.startedAt).toISOString(),
    finishedAt: r.finishedAt ? new Date(r.finishedAt).toISOString() : null,
  };
}

async function listVoiceReviews(accountId: number, limit = 20): Promise<ReviewDto[]> {
  const rows = await db.select().from(voiceReviews)
    .where(eq(voiceReviews.accountsId, accountId))
    .orderBy(desc(voiceReviews.periodEnd), desc(voiceReviews.id))
    .limit(limit);
  return rows.map(toReviewDto);
}

async function getVoiceReview(accountId: number, id: number): Promise<ReviewDto | null> {
  const [row] = await db.select().from(voiceReviews)
    .where(and(eq(voiceReviews.accountsId, accountId), eq(voiceReviews.id, id)));
  return row ? toReviewDto(row) : null;
}

/** The latest finished review with a smaller id than `beforeId`. */
async function previousVoiceReview(accountId: number, beforeId: number): Promise<ReviewDto | null> {
  const [row] = await db.select().from(voiceReviews)
    .where(and(eq(voiceReviews.accountsId, accountId), eq(voiceReviews.status, "done"), lt(voiceReviews.id, beforeId)))
    .orderBy(desc(voiceReviews.id))
    .limit(1);
  return row ? toReviewDto(row) : null;
}

async function latestDoneVoiceReview(accountId: number): Promise<ReviewDto | null> {
  const [row] = await db.select().from(voiceReviews)
    .where(and(eq(voiceReviews.accountsId, accountId), eq(voiceReviews.status, "done")))
    .orderBy(desc(voiceReviews.id))
    .limit(1);
  return row ? toReviewDto(row) : null;
}

export const voiceReviewsStorage = {
  listReviewCalls,
  voiceCallLabels,
  accountsWithElevenCalls,
  loadReviewTranscripts,
  loadReviewToolEvents,
  loadAccountKnowledge,
  accountNameOf,
  claimWeeklyReview,
  failStalledReviews,
  createManualReview,
  finishVoiceReview,
  failVoiceReview,
  listVoiceReviews,
  getVoiceReview,
  previousVoiceReview,
  latestDoneVoiceReview,
};
