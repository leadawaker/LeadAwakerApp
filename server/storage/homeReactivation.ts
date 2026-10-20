import { sql } from "drizzle-orm";
import { db } from "../db";
import type { HomeReactivation } from "@shared/homeTypes";
import { eachDay } from "@shared/homePeriod";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, at, boundsFor, dayOf, dbrCampaignSql, liveLeadSql, num } from "./homeSql";
import { homeReactivationLiveStorage } from "./homeReactivationLive";

type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];

async function getHomeReactivation(q: HomeQuery): Promise<HomeReactivation> {
  const b = await boundsFor(q);
  const cur = at(b.from, b.tz), end = at(b.to, b.tz), prev = at(b.prevFrom, b.tz), prevEnd = at(b.prevTo, b.tz);
  const campaign = q.campaignId === null ? sql`TRUE` : sql`c.id = ${q.campaignId}`;
  const scope = sql`${acct('l."Accounts_id"', q.accountId)} AND ${dbrCampaignSql} AND ${liveLeadSql} AND ${campaign}`;

  const msg = sql`
    SELECT i."Leads_id" AS lead_id, lower(i.direction) AS direction, i.created_at
    FROM ${T.interactions} i
    JOIN ${T.leads} l ON l.id = i."Leads_id"
    JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${scope} AND i.created_at >= ${prev} AND i.created_at < ${end}`;
  const booked = sql`COALESCE(l.booked_at, l.booking_confirmed_at_)`;

  const [totals, days, pipeline, campaigns] = await Promise.all([
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT
        count(DISTINCT lead_id) FILTER (WHERE created_at >= ${cur} AND direction = 'outbound')::int AS contacted,
        count(DISTINCT lead_id) FILTER (WHERE created_at < ${prevEnd} AND direction = 'outbound')::int AS contacted_prev,
        count(DISTINCT lead_id) FILTER (WHERE created_at >= ${cur} AND direction = 'inbound')::int AS replied,
        count(DISTINCT lead_id) FILTER (WHERE created_at < ${prevEnd} AND direction = 'inbound')::int AS replied_prev,
        (SELECT count(*) FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${scope} AND l.booked_call_date IS NOT NULL AND ${booked} >= ${cur} AND ${booked} < ${end})::int AS bookings,
        (SELECT count(*) FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${scope} AND l.booked_call_date IS NOT NULL AND ${booked} >= ${prev} AND ${booked} < ${prevEnd})::int AS bookings_prev,
        (SELECT sum(COALESCE(c.total_cost, 0)) FROM ${T.campaigns} c
          WHERE ${acct('c."Accounts_id"', q.accountId)} AND ${dbrCampaignSql} AND ${campaign}) AS total_cost,
        (SELECT sum(COALESCE(c.bookings_generated, 0)) FROM ${T.campaigns} c
          WHERE ${acct('c."Accounts_id"', q.accountId)} AND ${dbrCampaignSql} AND ${campaign}) AS total_bookings
      FROM msg`),
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT day, sum(replies)::int AS replies, sum(bookings)::int AS bookings FROM (
        SELECT ${dayOf("created_at", b.tz)} AS day, count(DISTINCT lead_id) AS replies, 0 AS bookings
        FROM msg WHERE created_at >= ${cur} AND direction = 'inbound' GROUP BY 1
        UNION ALL
        SELECT to_char(${booked} AT TIME ZONE ${b.tz}, 'YYYY-MM-DD'), 0, count(*)
        FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
        WHERE ${scope} AND l.booked_call_date IS NOT NULL AND ${booked} >= ${cur} AND ${booked} < ${end} GROUP BY 1
      ) d GROUP BY day`),
    db.execute(sql`
      SELECT COALESCE(NULLIF(l."Conversion_Status", ''), 'New') AS status, count(*)::int AS n
      FROM ${T.leads} l JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
      WHERE ${scope} GROUP BY 1 ORDER BY 2 DESC`),
    db.execute(sql`
      SELECT c.id, c.name FROM ${T.campaigns} c
      WHERE ${acct('c."Accounts_id"', q.accountId)} AND ${dbrCampaignSql} ORDER BY c.name`),
  ]);

  const t = rows(totals)[0] ?? {};
  const byDay = new Map(rows(days).map((r) => [String(r.day), r]));
  const totalBookings = num(t.total_bookings);
  return {
    contacted: { value: num(t.contacted), previous: num(t.contacted_prev) },
    replied: { value: num(t.replied), previous: num(t.replied_prev) },
    bookings: { value: num(t.bookings), previous: num(t.bookings_prev) },
    // Lifetime cost over lifetime bookings: campaign cost is not stored per period.
    costPerBooking: totalBookings === 0 ? null : Math.round((num(t.total_cost) / totalBookings) * 100) / 100,
    perDay: eachDay(b.from, b.to).map((day) => ({
      day, replies: num(byDay.get(day)?.replies), bookings: num(byDay.get(day)?.bookings),
    })),
    pipeline: rows(pipeline).map((r) => ({ status: String(r.status), count: num(r.n) })),
    campaigns: rows(campaigns).map((r) => ({ id: num(r.id), name: String(r.name ?? "") })),
  };
}

export const homeReactivationStorage = { getHomeReactivation, ...homeReactivationLiveStorage };
