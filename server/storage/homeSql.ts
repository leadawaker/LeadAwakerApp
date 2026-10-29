/**
 * Shared SQL for the Home dashboard summaries (specs/home-dashboard).
 * Aliases are fixed: i = Interactions, l = Leads, c = Campaigns, vc = Voice_Calls.
 */
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { accounts } from "@shared/schema";
import { bucketOf, eachBucket, periodDates, todayIn, type PeriodDates } from "@shared/homePeriod";
import type { DayPoint, HomeBucket, HomePeriod } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";

const table = (name: string) => sql.raw(`"p2mxx34fvbf3ll6"."${name}"`);
export const T = {
  interactions: table("Interactions"), leads: table("Leads"), campaigns: table("Campaigns"),
  accounts: table("Accounts"), voiceCalls: table("Voice_Calls"), voiceNumbers: table("Voice_Numbers"),
  widgetConfigs: table("Widget_Configs"), whatsappSenders: table("WhatsApp_Senders"),
  callFollowupLog: table("Call_Followup_Log"), attentionDismissed: table("Home_Attention_Dismissed"),
  accountReviews: table("Account_Reviews"), calendarConnections: table("Calendar_Connections"),
};

export const DEFAULT_TZ = "Europe/Amsterdam";

/**
 * Lead l (campaign c) is real traffic. Mirrors the engine's recap filter, plus the
 * Telegram demo bots (tg:<chat> and tg-<bot>:<chat>), which carry no demo flag.
 */
export const liveLeadSql = sql`(
  COALESCE(c.is_demo, false) = false AND l.demo_niche IS NULL
  AND COALESCE(l.channel_identifier, '') NOT LIKE 'wa-demo:%'
  AND COALESCE(l.channel_identifier, '') NOT LIKE 'web-demo:%'
  AND COALESCE(l.channel_identifier, '') NOT LIKE 'tg:%'
  AND COALESCE(l.channel_identifier, '') NOT LIKE 'tg-%'
  AND COALESCE(l.is_test, false) = false
)`;

/** Campaign c is wired to a receptionist surface (widget, voice number, inbound). */
export const receptionistCampaignSql = sql`(
  EXISTS (SELECT 1 FROM ${T.widgetConfigs} w WHERE w."Campaigns_id" = c.id)
  OR EXISTS (SELECT 1 FROM ${T.voiceNumbers} rn WHERE rn.campaigns_id = c.id)
  OR EXISTS (SELECT 1 FROM ${T.accounts} ra WHERE ra.inbound_campaign_id = c.id OR ra.missed_call_campaign_id = c.id)
)`;

/** Campaign c is database reactivation. campaign_type alone cannot say: it defaults to 'reactivation'. */
export const dbrCampaignSql = sql`(
  c.id IS NOT NULL AND c.campaign_type = 'reactivation'
  AND COALESCE(c.is_demo, false) = false AND NOT ${receptionistCampaignSql}
)`;

/** Campaign c belongs to the Reputation service. */
export const reputationCampaignSql = sql`(c.id IS NOT NULL AND c.campaign_type = 'reputation' AND COALESCE(c.is_demo, false) = false)`;

/** Campaign c belongs to the Social service (Instagram comment-to-DM). */
export const socialCampaignSql = sql`(
  c.id IS NOT NULL AND COALESCE(c.is_demo, false) = false
  AND (c.campaign_type = 'social_reply' OR lower(COALESCE(c.channel, '')) = 'instagram')
)`;

/** Lead l (campaign c) is in the receptionist stream: not DBR, not Reputation, not Social. */
export const receptionistLeadSql = sql`(
  NOT ${dbrCampaignSql}
  AND COALESCE(c.campaign_type, '') NOT IN ('reputation', 'social_reply')
  AND lower(COALESCE(c.channel, '')) <> 'instagram'
)`;

/** Call vc is live. Mirror of IS_LIVE_SQL in automations client_alerts/live_calls.py. */
export const liveCallSql = sql`(
  vc.test_account_id IS NULL
  AND COALESCE(vc.is_test, false) = false
  AND NOT EXISTS (SELECT 1 FROM ${T.campaigns} dc WHERE dc.id = vc.campaigns_id AND dc.is_demo = true)
  AND NOT EXISTS (SELECT 1 FROM ${T.leads} dl WHERE dl.id = vc.leads_id
                  AND (dl.demo_niche IS NOT NULL OR dl.channel_identifier LIKE 'wa-demo:%' OR dl.channel_identifier LIKE 'web-demo:%' OR dl.is_test = true))
  AND NOT EXISTS (SELECT 1 FROM ${T.voiceNumbers} dn WHERE dn.id = vc.voice_numbers_id AND dn.client_niche IS NULL)
  AND NOT (vc.voice_numbers_id IS NULL AND vc.campaigns_id IS NULL)
)`;

/** Mirror of call_needs_callback in automations client_alerts/events.py. */
export const needsCallbackSql = sql`(
  COALESCE(vc.outcome, '') <> 'booked'
  AND (vc.outcome = 'callback' OR vc.transfer_outcome = 'failed'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(vc.summary -> 'items') = 'array' THEN vc.summary -> 'items' ELSE '[]'::jsonb END) it
            WHERE it ->> 'intent' = 'leave_message'))
)`;

/** Interaction i was written by a person, not the AI. Same rule as the recap. */
export const humanOutboundSql = sql`(
  COALESCE(i.ai_generated, false) = false
  AND (i.triggered_by IS NULL OR i.triggered_by IN ('manual', 'crm', 'user'))
)`;

export interface Bounds extends PeriodDates { tz: string; period: HomePeriod; bucket: HomeBucket }

function validTz(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return DEFAULT_TZ; }
}

/**
 * Where "all time" starts on the chart: the account's creation or its first call,
 * message or lead, whichever is earliest (every account for the agency view).
 */
async function queryFirstDay(accountId: number | null, tz: string): Promise<string | null> {
  const r = await db.execute(sql`
    SELECT to_char(LEAST(
      (SELECT min(a.created_at) FROM ${T.accounts} a WHERE ${acct("a.id", accountId)}),
      (SELECT min(vc.started_at) FROM ${T.voiceCalls} vc WHERE ${acct("vc.accounts_id", accountId)}),
      (SELECT min(i.created_at) FROM ${T.interactions} i WHERE ${acct('i."Accounts_id"', accountId)}),
      (SELECT min(l.created_at) FROM ${T.leads} l WHERE ${acct('l."Accounts_id"', accountId)})
    ) AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS first`);
  const first = (r.rows[0] as { first?: string | null } | undefined)?.first;
  return typeof first === "string" ? first : null;
}

/**
 * firstDay() runs on every Home endpoint for "all time" (the default) and only
 * moves when older data is backfilled, so it is kept per account and timezone
 * for a few minutes. The promise is cached too, so the tabs Home loads at once
 * share one query.
 */
const FIRST_DAY_TTL_MS = 10 * 60 * 1000;
const firstDayCache = new Map<string, { at: number; value: Promise<string | null> }>();

function firstDay(accountId: number | null, tz: string): Promise<string | null> {
  const key = `${accountId ?? "all"}|${tz}`;
  const hit = firstDayCache.get(key);
  if (hit && Date.now() - hit.at < FIRST_DAY_TTL_MS) return hit.value;
  const value = queryFirstDay(accountId, tz);
  firstDayCache.set(key, { at: Date.now(), value });
  // A failed query must not stick for the whole TTL.
  value.catch(() => { if (firstDayCache.get(key)?.value === value) firstDayCache.delete(key); });
  return value;
}

/** Period bounds in the account's timezone; the agency timezone for all accounts. */
export async function boundsFor(q: HomeQuery): Promise<Bounds> {
  let tz = DEFAULT_TZ;
  if (q.accountId !== null && q.accountId > 0) {
    const [a] = await db.select({ timezone: accounts.timezone }).from(accounts).where(eq(accounts.id, q.accountId));
    tz = validTz(a?.timezone);
  }
  const allFrom = q.period === "all" ? await firstDay(q.accountId, tz) : null;
  return { ...periodDates(q.period, todayIn(tz), allFrom), tz, period: q.period, bucket: bucketOf(q.period) };
}

/** A local date as an instant: start of that day in the timezone. */
export const at = (date: string, tz: string): SQL => sql`((${date}::date)::timestamp AT TIME ZONE ${tz})`;

const NEVER = sql`'-infinity'::timestamptz`;
/**
 * The period and the one before it as instants. "All time" counts everything,
 * also data from before the chart's first bucket, and has an empty previous range.
 */
export function rangeOf(b: Bounds): { cur: SQL; end: SQL; prev: SQL; prevEnd: SQL } {
  if (b.period === "all") return { cur: NEVER, end: at(b.to, b.tz), prev: NEVER, prevEnd: NEVER };
  // Today so far is compared with yesterday up to the same time of day, not all of yesterday.
  if (b.period === "today") {
    const prev = at(b.prevFrom, b.tz);
    return { cur: at(b.from, b.tz), end: at(b.to, b.tz), prev, prevEnd: sql`(${prev} + (now() - ${at(b.from, b.tz)}))` };
  }
  return { cur: at(b.from, b.tz), end: at(b.to, b.tz), prev: at(b.prevFrom, b.tz), prevEnd: at(b.prevTo, b.tz) };
}

/** Account filter. null = all accounts (agency only, decided in homeScope). */
export const acct = (column: string, accountId: number | null): SQL =>
  accountId === null ? sql`TRUE` : sql`${sql.raw(column)} = ${accountId}`;

const BUCKET_FORMAT: Record<HomeBucket, string> = { month: "YYYY-MM", day: "YYYY-MM-DD", hour: "YYYY-MM-DD HH24" };
/** The chart bucket key (see DayPoint) of a timestamp column, in the period's timezone. */
export const bucketSql = (column: string, b: Bounds): SQL =>
  sql`to_char(${sql.raw(column)} AT TIME ZONE ${b.tz}, ${BUCKET_FORMAT[b.bucket]})`;
export const num = (v: unknown): number => Number(v ?? 0) || 0;

/** A value for every bucket of the period, zero where the query returned no row. */
export function fillDays(b: Bounds, rows: { day: string; value: number }[]): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r.value]));
  return eachBucket(b.from, b.to, b.bucket).map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}

/**
 * Bookings in [from, to) as rows of (channel, booked). One definition for Overview and Phone:
 * leads with a booked call, dated by booked_at, live and receptionist traffic only.
 */
export const bookingsSql = (accountId: number | null, from: SQL, to: SQL): SQL => sql`
    SELECT COALESCE(l.booking_channel, 'other') AS channel, COALESCE(l.booked_at, l.booking_confirmed_at_) AS booked
    FROM ${T.leads} l
    LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${acct('l."Accounts_id"', accountId)} AND l.booked_call_date IS NOT NULL
      AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${from}
      AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${to}
      AND ${liveLeadSql} AND ${receptionistLeadSql}`;
