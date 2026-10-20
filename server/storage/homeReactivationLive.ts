/**
 * Live panels of the Home Reactivation tab: upcoming bookings, what just
 * happened, and today's bumps. Moved here from the Campaigns dashboard, which
 * computed them in the browser from full lead lists.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { HomeReactivationLive } from "@shared/homeTypes";
import { todayIn } from "@shared/homePeriod";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, at, boundsFor, dbrCampaignSql, liveLeadSql, num } from "./homeSql";

type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const str = (v: unknown) => (v == null || v === "" ? null : String(v));

const LIST_LIMIT = 8;
const ACTIVITY_LIMIT = 12;

/** Outbound rows the engine sends as campaign outreach: the first message and the bumps. */
const outreachSql = sql`(i.is_bump IS TRUE OR i.triggered_by IN ('campaign_launcher', 'bump_scheduler', 'manual_bump_trigger', 'bump'))`;
const stageSql = sql`CASE WHEN i.triggered_by = 'campaign_launcher' THEN 0 ELSE COALESCE(i.bump_number, 1) END`;

/** Lead l will get a bump from the engine's bump scheduler (mirror of get_leads_due_for_bump). */
const bumpPendingSql = sql`(
  l.automation_status = 'active' AND c.status = 'Active' AND l.next_action_at IS NOT NULL
  AND l.opted_out IS NOT TRUE AND l.manual_takeover IS NOT TRUE
  AND COALESCE(l.current_bump_stage, 0) + 1 <= COALESCE(c.max_bumps, 4)
)`;
const nameSql = sql`NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '')`;

async function getHomeReactivationLive(q: HomeQuery): Promise<HomeReactivationLive> {
  const { tz } = await boundsFor(q);
  const today = todayIn(tz);
  const midnight = at(today, tz);
  const tomorrow = sql`(((${today}::date + 1))::timestamp AT TIME ZONE ${tz})`;
  const campaign = q.campaignId === null ? sql`TRUE` : sql`c.id = ${q.campaignId}`;
  const scope = sql`${acct('l."Accounts_id"', q.accountId)} AND ${dbrCampaignSql} AND ${liveLeadSql} AND ${campaign}`;
  const fromLeads = sql`FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"`;

  const [upcoming, activity, sent, due, next] = await Promise.all([
    db.execute(sql`
      SELECT l.id, ${nameSql} AS name, c.name AS campaign, l.booked_call_date AS at, COALESCE(l.manual_takeover, false) AS handoff
      ${fromLeads}
      WHERE ${scope} AND l.booked_call_date >= now()
        AND (l.booking_cancelled_at IS NULL OR l.booked_at > l.booking_cancelled_at)
      ORDER BY l.booked_call_date LIMIT ${LIST_LIMIT}`),
    db.execute(sql`
      SELECT i.id, l.id AS lead_id, ${nameSql} AS name, c.name AS campaign, lower(i.direction) AS direction,
        left(regexp_replace(COALESCE(i."Content", ''), '\\s+', ' ', 'g'), 160) AS preview, i.created_at
      FROM ${T.interactions} i
      JOIN ${T.leads} l ON l.id = i."Leads_id"
      JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
      WHERE ${scope} AND COALESCE(i.type, '') <> 'Note' AND i.created_at IS NOT NULL
        AND i.created_at >= now() - interval '30 days'
      ORDER BY i.created_at DESC LIMIT ${ACTIVITY_LIMIT}`),
    db.execute(sql`
      SELECT ${stageSql} AS stage, count(*)::int AS n
      FROM ${T.interactions} i
      JOIN ${T.leads} l ON l.id = i."Leads_id"
      JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
      WHERE ${scope} AND lower(i.direction) = 'outbound' AND ${outreachSql}
        AND i.created_at >= ${midnight} AND i.created_at < ${tomorrow}
      GROUP BY 1 ORDER BY 1`),
    db.execute(sql`
      SELECT count(*)::int AS n ${fromLeads}
      WHERE ${scope} AND ${bumpPendingSql} AND l.next_action_at < ${tomorrow}`),
    db.execute(sql`
      SELECT l.id, ${nameSql} AS name, c.name AS campaign, COALESCE(l.current_bump_stage, 0) + 1 AS stage, l.next_action_at AS at
      ${fromLeads}
      WHERE ${scope} AND ${bumpPendingSql}
      ORDER BY l.next_action_at LIMIT ${LIST_LIMIT}`),
  ]);

  const sentByStage = rows(sent).map((r) => ({ stage: num(r.stage), count: num(r.n) }));
  return {
    tz,
    upcoming: rows(upcoming).map((r) => ({
      leadId: num(r.id), name: str(r.name), campaign: str(r.campaign), at: iso(r.at), handoff: r.handoff === true,
    })),
    activity: rows(activity).map((r) => ({
      id: num(r.id), leadId: num(r.lead_id), name: str(r.name), campaign: str(r.campaign),
      direction: String(r.direction ?? "").startsWith("in") ? "in" as const : "out" as const,
      preview: String(r.preview ?? ""), at: iso(r.created_at),
    })),
    bumps: {
      sentToday: sentByStage.reduce((s, r) => s + r.count, 0),
      sentByStage,
      dueToday: num(rows(due)[0]?.n),
      next: rows(next).map((r) => ({
        leadId: num(r.id), name: str(r.name), campaign: str(r.campaign), stage: num(r.stage), at: iso(r.at),
      })),
    },
  };
}

export const homeReactivationLiveStorage = { getHomeReactivationLive };
