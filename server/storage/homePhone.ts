import { sql } from "drizzle-orm";
import { db } from "../db";
import type { CallOutcome, HomePhone } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import { DEFAULT_TZ, T, acct, at, boundsFor, dayOf, fillDays, liveCallSql, num } from "./homeSql";

const OUTCOMES: CallOutcome[] = ["booked", "callback", "transferred", "hung_up", "other"];
type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];
const outcomeOf = (v: unknown): CallOutcome => (OUTCOMES.includes(v as CallOutcome) ? (v as CallOutcome) : "other");

async function getHomePhone(q: HomeQuery): Promise<HomePhone> {
  const b = await boundsFor(q);
  const cur = at(b.from, b.tz), end = at(b.to, b.tz), prev = at(b.prevFrom, b.tz), prevEnd = at(b.prevTo, b.tz);

  // ended_at, else the last transcript turn (a tab closed before wrap-up leaves ended_at null).
  const calls = sql`
    SELECT vc.call_id, vc.started_at, vc.caller_number, vc.leads_id, vc.transfer_outcome, vc.screened_kind,
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

  const [totals, byOutcome, days, recent] = await Promise.all([
    db.execute(sql`
      WITH calls AS (${calls})
      SELECT
        count(*) FILTER (WHERE started_at >= ${cur})::int AS calls,
        count(*) FILTER (WHERE started_at < ${prevEnd})::int AS calls_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND outcome = 'booked')::int AS booked,
        count(*) FILTER (WHERE started_at < ${prevEnd} AND outcome = 'booked')::int AS booked_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND (outcome = 'transferred' OR transfer_outcome = 'transferred'))::int AS transferred,
        count(*) FILTER (WHERE started_at < ${prevEnd} AND (outcome = 'transferred' OR transfer_outcome = 'transferred'))::int AS transferred_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND transfer_outcome = 'failed')::int AS transfers_failed,
        avg(seconds) FILTER (WHERE started_at >= ${cur} AND seconds >= 10) AS avg_seconds,
        avg(seconds) FILTER (WHERE started_at < ${prevEnd} AND seconds >= 10) AS avg_seconds_prev,
        count(*) FILTER (WHERE started_at >= ${cur} AND screened_kind IN ('sales_pitch', 'robocall'))::int AS screened,
        count(*) FILTER (WHERE started_at >= ${cur} AND out_of_hours = true)::int AS out_of_hours,
        count(*) FILTER (WHERE started_at >= ${cur} AND out_of_hours IS NOT NULL)::int AS hours_known
      FROM calls`),
    db.execute(sql`
      WITH calls AS (${calls})
      SELECT outcome, count(*)::int AS n FROM calls WHERE started_at >= ${cur} GROUP BY outcome`),
    db.execute(sql`
      WITH calls AS (${calls})
      SELECT ${dayOf("started_at", b.tz)} AS day, count(*)::int AS value FROM calls WHERE started_at >= ${cur} GROUP BY 1`),
    db.execute(sql`
      WITH calls AS (${calls})
      SELECT c.call_id, c.started_at, c.caller_number, c.outcome, c.seconds,
             NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name
      FROM calls c LEFT JOIN ${T.leads} l ON l.id = c.leads_id
      WHERE c.started_at >= ${cur} ORDER BY c.started_at DESC LIMIT 8`),
  ]);

  const t = rows(totals)[0] ?? {};
  const byOut = new Map(rows(byOutcome).map((r) => [String(r.outcome), num(r.n)]));
  const known = num(t.hours_known);
  return {
    calls: { value: num(t.calls), previous: num(t.calls_prev) },
    booked: { value: num(t.booked), previous: num(t.booked_prev) },
    transferred: { value: num(t.transferred), previous: num(t.transferred_prev) },
    avgSeconds: { value: Math.round(num(t.avg_seconds)), previous: Math.round(num(t.avg_seconds_prev)) },
    transfersFailed: num(t.transfers_failed),
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    outcomes: OUTCOMES.map((outcome) => ({ outcome, count: byOut.get(outcome) ?? 0 })),
    outOfHoursPct: known === 0 ? null : Math.round((num(t.out_of_hours) / known) * 100),
    screened: num(t.screened),
    recent: rows(recent).map((r) => ({
      callId: String(r.call_id), name: (r.name as string | null) ?? null,
      callerNumber: (r.caller_number as string | null) ?? null, outcome: outcomeOf(r.outcome),
      seconds: r.seconds == null ? null : Math.round(num(r.seconds)), at: new Date(r.started_at as string).toISOString(),
    })),
  };
}

export const homePhoneStorage = { getHomePhone };
