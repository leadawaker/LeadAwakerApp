import { sql } from "drizzle-orm";
import { db } from "../db";
import type { HomeSocial } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, boundsFor, rangeOf, bucketSql, fillDays, liveLeadSql, num, socialCampaignSql } from "./homeSql";
import { recentLeadsSql, toRecent } from "./homeMessaging";

type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];

async function getHomeSocial(q: HomeQuery): Promise<HomeSocial> {
  const b = await boundsFor(q);
  const { cur, end, prev, prevEnd } = rangeOf(b);
  const scope = sql`${acct('l."Accounts_id"', q.accountId)} AND ${socialCampaignSql} AND ${liveLeadSql}`;

  // The Social stream is picked by campaign: Instagram messages are stored with channel 'other'.
  const msg = sql`
    SELECT i."Leads_id" AS lead_id, lower(i.direction) AS direction, i.created_at, i."Content" AS content
    FROM ${T.interactions} i
    JOIN ${T.leads} l ON l.id = i."Leads_id"
    JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${scope} AND i.created_at >= ${prev} AND i.created_at < ${end}`;
  const booked = sql`COALESCE(l.booked_at, l.booking_confirmed_at_)`;

  const [totals, days, recent, extras] = await Promise.all([
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT
        count(DISTINCT lead_id) FILTER (WHERE created_at >= ${cur} AND direction = 'inbound')::int AS conversations,
        count(DISTINCT lead_id) FILTER (WHERE created_at < ${prevEnd} AND direction = 'inbound')::int AS conversations_prev,
        count(*) FILTER (WHERE created_at >= ${cur} AND direction = 'inbound')::int AS msg_in,
        count(*) FILTER (WHERE created_at < ${prevEnd} AND direction = 'inbound')::int AS msg_in_prev,
        count(*) FILTER (WHERE created_at >= ${cur} AND direction = 'outbound')::int AS msg_out,
        count(*) FILTER (WHERE created_at < ${prevEnd} AND direction = 'outbound')::int AS msg_out_prev
      FROM msg`),
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT ${bucketSql("created_at", b)} AS day, count(DISTINCT lead_id)::int AS value
      FROM msg WHERE created_at >= ${cur} AND direction = 'inbound' GROUP BY 1`),
    db.execute(recentLeadsSql(msg, cur)),
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${scope} AND l.booked_call_date IS NOT NULL AND ${booked} >= ${cur} AND ${booked} < ${end})::int AS bookings,
        (SELECT count(*) FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${scope} AND l.booked_call_date IS NOT NULL AND ${booked} >= ${prev} AND ${booked} < ${prevEnd})::int AS bookings_prev,
        EXISTS (SELECT 1 FROM ${T.accounts} a WHERE ${acct("a.id", q.accountId)} AND a.instagram_access_token IS NOT NULL) AS connected`),
  ]);

  const t = rows(totals)[0] ?? {};
  const x = rows(extras)[0] ?? {};
  return {
    // One Instagram account per CRM account: no single one in the all-accounts view.
    connected: q.accountId !== null && x.connected === true,
    conversations: { value: num(t.conversations), previous: num(t.conversations_prev) },
    messagesIn: { value: num(t.msg_in), previous: num(t.msg_in_prev) },
    messagesOut: { value: num(t.msg_out), previous: num(t.msg_out_prev) },
    bookings: { value: num(x.bookings), previous: num(x.bookings_prev) },
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    recent: rows(recent).map(toRecent),
  };
}

export const homeSocialStorage = { getHomeSocial };
