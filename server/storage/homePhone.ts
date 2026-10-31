import { sql } from "drizzle-orm";
import { db } from "../db";
import type { CallOutcome, HomePhone } from "@shared/homeTypes";
import { classifyHomeOutcome } from "@shared/homeOutcome";
import type { HomeQuery } from "../routes/homeScope";
import { DEFAULT_TZ, T, needsCallbackSql, acct, bookingsSql, boundsFor, rangeOf, bucketSql, fillDays, liveCallSql, num } from "./homeSql";

const OUTCOMES: CallOutcome[] = ["booked", "callback", "transferred", "hung_up", "answered"];
// A call with no ended_at that has been quiet this long was dropped (same as the Voice calls page).
const ABANDONED_AFTER_MS = 15 * 60 * 1000;
type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];

/** The Home outcome of one calls-CTE row. Null-outcome legacy rows are derived. */
export function classify(r: Row): CallOutcome {
  const intents = Array.isArray(r.intents) ? (r.intents as unknown[]).map(String) : [];
  return classifyHomeOutcome({
    outcome: (r.raw_outcome as string | null) ?? null,
    transferOutcome: (r.transfer_outcome as string | null) ?? null,
    bookedIso: r.booked_iso == null ? null : String(r.booked_iso),
    intents,
    durationSeconds: r.seconds == null ? null : Math.round(num(r.seconds)),
    hasSummary: r.has_summary === true,
    needsCallback: r.cb === true,
    abandoned: r.ended_at == null && Date.now() - new Date(r.started_at as string).getTime() > ABANDONED_AFTER_MS,
  });
}

async function getHomePhone(q: HomeQuery): Promise<HomePhone> {
  const b = await boundsFor(q);
  const { cur, end, prev, prevEnd } = rangeOf(b);

  // ended_at, else the last transcript turn (a tab closed before wrap-up leaves ended_at null).
  const callsOf = (full: boolean) => sql`
    SELECT vc.call_id, vc.started_at, vc.caller_number, vc.leads_id, vc.transfer_outcome, vc.screened_kind,
           vc.latency_ms, vc.cost_usd, vc.outcome AS raw_outcome, vc.booked_iso, vc.ended_at,
           vc.summary ->> 'outcome' AS headline, vc.summary IS NOT NULL AS has_summary,
           ${full ? sql`ARRAY(SELECT it ->> 'intent' FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(vc.summary -> 'items') = 'array' THEN vc.summary -> 'items' ELSE '[]'::jsonb END) it) AS intents,
           ${needsCallbackSql} AS cb,` : sql``}
           CASE WHEN vc.outcome IN ('booked', 'callback', 'transferred', 'hung_up') THEN vc.outcome
                WHEN vc.booked_iso IS NOT NULL THEN 'booked' ELSE 'other' END AS outcome,
           GREATEST(EXTRACT(EPOCH FROM (COALESCE(vc.ended_at,
             (SELECT max(ti.created_at) FROM ${T.interactions} ti WHERE ti.conversation_thread_id = vc.call_id)) - vc.started_at)), 0) AS seconds,
           CASE WHEN a.business_hours_start IS NULL OR a.business_hours_end IS NULL THEN NULL
                ELSE NOT (
                  EXTRACT(dow FROM vc.started_at AT TIME ZONE COALESCE(a.timezone, ${DEFAULT_TZ}))::int
                    IN (SELECT (jsonb_array_elements_text(
                         CASE WHEN jsonb_typeof(a.open_days) = 'array' THEN a.open_days ELSE '[1,2,3,4,5]'::jsonb END))::int)
                  AND (vc.started_at AT TIME ZONE COALESCE(a.timezone, ${DEFAULT_TZ}))::time >= a.business_hours_start
                  AND (vc.started_at AT TIME ZONE COALESCE(a.timezone, ${DEFAULT_TZ}))::time < a.business_hours_end)
           END AS out_of_hours
    FROM ${T.voiceCalls} vc
    JOIN ${T.accounts} a ON a.id = vc.accounts_id
    WHERE ${acct("vc.accounts_id", q.accountId)} AND vc.started_at >= ${prev} AND vc.started_at < ${end} AND ${liveCallSql}`;

  const calls = callsOf(false), classifyCalls = callsOf(true);
  const [totals, bookedRows, outcomeRows, days, recent] = await Promise.all([
    db.execute(sql`
      WITH calls AS (${calls})
      SELECT
        count(*) FILTER (WHERE started_at >= ${cur})::int AS calls,
        count(*) FILTER (WHERE started_at < ${prevEnd})::int AS calls_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND (outcome = 'transferred' OR transfer_outcome = 'transferred'))::int AS transferred,
        count(*) FILTER (WHERE started_at < ${prevEnd} AND (outcome = 'transferred' OR transfer_outcome = 'transferred'))::int AS transferred_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND transfer_outcome = 'failed')::int AS transfers_failed,
        sum(seconds) FILTER (WHERE started_at >= ${cur})::float8 AS total_seconds,
        avg(seconds) FILTER (WHERE started_at >= ${cur} AND seconds >= 10) AS avg_seconds,
        avg(seconds) FILTER (WHERE started_at < ${prevEnd} AND seconds >= 10) AS avg_seconds_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND screened_kind IN ('sales_pitch', 'robocall'))::int AS screened,
        count(*) FILTER (WHERE started_at >= ${cur} AND out_of_hours = true)::int AS out_of_hours,
        count(*) FILTER (WHERE started_at >= ${cur} AND out_of_hours IS NOT NULL)::int AS hours_known,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE started_at >= ${cur} AND latency_ms IS NOT NULL) AS latency_ms,
        sum(cost_usd) FILTER (WHERE started_at >= ${cur})::float8 AS cost_usd,
        sum(seconds) FILTER (WHERE started_at >= ${cur} AND cost_usd IS NOT NULL)::float8 AS costed_seconds
      FROM calls`),
    // Booked is the Overview bookings definition (leads), filtered to the phone channel.
    db.execute(sql`
      WITH bk AS (${bookingsSql(q.accountId, prev, end)})
      SELECT count(*) FILTER (WHERE booked >= ${cur})::int AS booked,
             count(*) FILTER (WHERE booked < ${prevEnd})::int AS booked_prev
      FROM bk WHERE channel = 'phone'`),
    db.execute(sql`
      WITH calls AS (${classifyCalls})
      SELECT started_at, ended_at, seconds, raw_outcome, transfer_outcome, booked_iso, intents, has_summary, cb
      FROM calls WHERE started_at >= ${cur}`),
    db.execute(sql`
      WITH calls AS (${calls})
      SELECT ${bucketSql("started_at", b)} AS day, count(*)::int AS value FROM calls WHERE started_at >= ${cur} GROUP BY 1`),
    db.execute(sql`
      WITH calls AS (${classifyCalls})
      SELECT c.call_id, c.started_at, c.ended_at, c.caller_number, c.seconds, c.headline,
             c.raw_outcome, c.transfer_outcome, c.booked_iso, c.intents, c.has_summary, c.cb,
             NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name
      FROM calls c LEFT JOIN ${T.leads} l ON l.id = c.leads_id
      WHERE c.started_at >= ${cur} ORDER BY c.started_at DESC LIMIT 8`),
  ]);

  const t = rows(totals)[0] ?? {};
  const bk = rows(bookedRows)[0] ?? {};
  const byOut = new Map<string, number>();
  for (const r of rows(outcomeRows)) { const o = classify(r); byOut.set(o, (byOut.get(o) ?? 0) + 1); }
  const known = num(t.hours_known);
  return {
    calls: { value: num(t.calls), previous: num(t.calls_prev) },
    booked: { value: num(bk.booked), previous: num(bk.booked_prev) },
    transferred: { value: num(t.transferred), previous: num(t.transferred_prev) },
    avgSeconds: { value: Math.round(num(t.avg_seconds)), previous: Math.round(num(t.avg_seconds_prev)) },
    minutes: Math.round(num(t.total_seconds) / 60),
    transfersFailed: num(t.transfers_failed),
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    outcomes: OUTCOMES.map((outcome) => ({ outcome, count: byOut.get(outcome) ?? 0 })),
    outOfHoursPct: known === 0 ? null : Math.round((num(t.out_of_hours) / known) * 100),
    screened: num(t.screened),
    latencyMs: t.latency_ms == null ? null : Math.round(num(t.latency_ms)),
    cost: t.cost_usd == null ? null : {
      total: num(t.cost_usd),
      perMinute: num(t.costed_seconds) > 0 ? num(t.cost_usd) / (num(t.costed_seconds) / 60) : null,
    },
    recent: rows(recent).map((r) => ({
      callId: String(r.call_id), name: (r.name as string | null) ?? null,
      callerNumber: (r.caller_number as string | null) ?? null, outcome: classify(r),
      headline: (r.headline as string | null) || null,
      seconds: r.seconds == null ? null : Math.round(num(r.seconds)), at: new Date(r.started_at as string).toISOString(),
    })),
  };
}

export const homePhoneStorage = { getHomePhone };
