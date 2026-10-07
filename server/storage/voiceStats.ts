/**
 * Monthly voice-line stats for the Account Voice tab (specs/voice-tab).
 * Pattern: getAccountBookingStats in ./billing.ts.
 *
 * Month boundaries are in the account's own timezone, so a call at 00:30 on the
 * 1st in Amsterdam belongs to the new month.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { accounts } from "@shared/schema";

export interface AccountVoiceStats {
  month: string;
  calls: number;
  bookings: number;
  transfers: number;
  transfersFailed: number;
  minutes: number;
}

const DEFAULT_TZ = "Europe/Amsterdam";

function validTimezone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** The current YYYY-MM in a timezone. */
function currentMonthIn(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}

async function getAccountVoiceStats(accountId: number, month?: string): Promise<AccountVoiceStats> {
  const [account] = await db.select({ timezone: accounts.timezone }).from(accounts).where(eq(accounts.id, accountId));
  const tz = validTimezone(account?.timezone);
  const key = month ?? currentMonthIn(tz);
  const monthStart = `${key}-01`;

  // Minutes: ended_at - started_at, or the last transcript turn when the call
  // was never closed out (a tab closed before wrap-up leaves ended_at null).
  // A call with neither counts as zero.
  const result = await db.execute(sql`
    SELECT
      count(*)::int AS calls,
      (count(*) FILTER (WHERE vc.booked_iso IS NOT NULL))::int AS bookings,
      (count(*) FILTER (WHERE vc.transfer_outcome = 'transferred' OR vc.outcome = 'transferred'))::int AS transfers,
      (count(*) FILTER (WHERE vc.transfer_outcome = 'failed'))::int AS transfers_failed,
      COALESCE(sum(GREATEST(EXTRACT(EPOCH FROM (
        COALESCE(vc.ended_at, (
          SELECT max(i.created_at) FROM "p2mxx34fvbf3ll6"."Interactions" i
          WHERE i.conversation_thread_id = vc.call_id
        )) - vc.started_at
      )), 0)), 0)::float8 AS seconds
    FROM "p2mxx34fvbf3ll6"."Voice_Calls" vc
    WHERE vc.accounts_id = ${accountId}
      AND vc.started_at >= (${monthStart}::date)::timestamp AT TIME ZONE ${tz}
      AND vc.started_at <  ((${monthStart}::date + interval '1 month')::timestamp AT TIME ZONE ${tz})
  `);
  const r = (result.rows as Record<string, unknown>[])[0] ?? {};
  return {
    month: key,
    calls: Number(r.calls ?? 0),
    bookings: Number(r.bookings ?? 0),
    transfers: Number(r.transfers ?? 0),
    transfersFailed: Number(r.transfers_failed ?? 0),
    minutes: Math.round(Number(r.seconds ?? 0) / 60),
  };
}

export const voiceStatsStorage = { getAccountVoiceStats };
