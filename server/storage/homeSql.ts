/**
 * Shared SQL for the Home dashboard summaries (specs/home-dashboard).
 * Aliases are fixed: i = Interactions, l = Leads, c = Campaigns, vc = Voice_Calls.
 */
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { accounts } from "@shared/schema";
import { eachDay, periodDates, todayIn, type PeriodDates } from "@shared/homePeriod";
import type { DayPoint } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";

const table = (name: string) => sql.raw(`"p2mxx34fvbf3ll6"."${name}"`);
export const T = {
  interactions: table("Interactions"), leads: table("Leads"), campaigns: table("Campaigns"),
  accounts: table("Accounts"), voiceCalls: table("Voice_Calls"), voiceNumbers: table("Voice_Numbers"),
  widgetConfigs: table("Widget_Configs"), whatsappSenders: table("WhatsApp_Senders"),
  callFollowupLog: table("Call_Followup_Log"),
  accountReviews: table("Account_Reviews"), calendarConnections: table("Calendar_Connections"),
};

export const DEFAULT_TZ = "Europe/Amsterdam";

/** Lead l (campaign c) is real traffic. Mirrors the engine's recap filter. */
export const liveLeadSql = sql`(
  COALESCE(c.is_demo, false) = false AND l.demo_niche IS NULL
  AND COALESCE(l.channel_identifier, '') NOT LIKE 'wa-demo:%'
  AND COALESCE(l.channel_identifier, '') NOT LIKE 'web-demo:%'
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
  AND NOT EXISTS (SELECT 1 FROM ${T.campaigns} dc WHERE dc.id = vc.campaigns_id AND dc.is_demo = true)
  AND NOT EXISTS (SELECT 1 FROM ${T.leads} dl WHERE dl.id = vc.leads_id
                  AND (dl.demo_niche IS NOT NULL OR dl.channel_identifier LIKE 'wa-demo:%' OR dl.channel_identifier LIKE 'web-demo:%'))
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

export interface Bounds extends PeriodDates { tz: string }

function validTz(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return DEFAULT_TZ; }
}

/** Period bounds in the account's timezone; the agency timezone for all accounts. */
export async function boundsFor(q: HomeQuery): Promise<Bounds> {
  let tz = DEFAULT_TZ;
  if (q.accountId !== null && q.accountId > 0) {
    const [a] = await db.select({ timezone: accounts.timezone }).from(accounts).where(eq(accounts.id, q.accountId));
    tz = validTz(a?.timezone);
  }
  return { ...periodDates(q.period, todayIn(tz)), tz };
}

/** A local date as an instant: start of that day in the timezone. */
export const at = (date: string, tz: string): SQL => sql`((${date}::date)::timestamp AT TIME ZONE ${tz})`;
/** Account filter. null = all accounts (agency only, decided in homeScope). */
export const acct = (column: string, accountId: number | null): SQL =>
  accountId === null ? sql`TRUE` : sql`${sql.raw(column)} = ${accountId}`;
export const dayOf = (column: string, tz: string): SQL =>
  sql`to_char(${sql.raw(column)} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;
export const num = (v: unknown): number => Number(v ?? 0) || 0;

/** A value for every day of the period, zero where the query returned no row. */
export function fillDays(b: Bounds, rows: { day: string; value: number }[]): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r.value]));
  return eachDay(b.from, b.to).map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}
