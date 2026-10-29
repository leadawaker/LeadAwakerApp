import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import type { HomeWebsite } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, boundsFor, rangeOf, bucketSql, fillDays, liveLeadSql, num, receptionistLeadSql } from "./homeSql";
import { channelMessagesSql, recentLeadsSql, toRecent } from "./homeMessaging";

type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];

async function getHomeWebsite(q: HomeQuery): Promise<HomeWebsite> {
  const b = await boundsFor(q);
  const { cur, end, prev, prevEnd } = rangeOf(b);
  const msg = channelMessagesSql(q, "website", prev, end);
  // No lower date bound: a visitor's first message may predate the window.
  const msgAll = channelMessagesSql(q, "website", sql`'-infinity'::timestamptz`, end);
  const bookings = (from: SQL, to: SQL) => sql`
    SELECT count(*)::int AS n FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.booked_call_date IS NOT NULL AND l.booking_channel = 'website'
      AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${from} AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${to}
      AND ${liveLeadSql} AND ${receptionistLeadSql}`;
  // A chat is "started" at the visitor's first-ever inbound message. A widget lead that
  // only received the greeting never appears in msg as inbound. A returning visitor is not a new chat.
  const chats = sql`
    chats AS (SELECT lead_id, min(created_at) AS first_at FROM msg WHERE direction = 'inbound' GROUP BY lead_id)`;
  const [totals, days, recent, bookCur, bookPrev] = await Promise.all([
    db.execute(sql`
      WITH msg AS (${msgAll}), ${chats}
      SELECT
        count(*) FILTER (WHERE ch.first_at >= ${cur})::int AS chats,
        count(*) FILTER (WHERE ch.first_at >= ${prev} AND ch.first_at < ${prevEnd})::int AS chats_prev,
        count(*) FILTER (WHERE ch.first_at >= ${cur} AND (COALESCE(l.phone, '') <> '' OR COALESCE(l."Email", '') <> ''))::int AS contacts,
        count(*) FILTER (WHERE ch.first_at >= ${prev} AND ch.first_at < ${prevEnd} AND (COALESCE(l.phone, '') <> '' OR COALESCE(l."Email", '') <> ''))::int AS contacts_prev
      FROM chats ch JOIN ${T.leads} l ON l.id = ch.lead_id`),
    db.execute(sql`
      WITH msg AS (${msgAll}), ${chats}
      SELECT ${bucketSql("first_at", b)} AS day, count(*)::int AS value
      FROM chats WHERE first_at >= ${cur} GROUP BY 1`),
    db.execute(recentLeadsSql(msg, cur)),
    db.execute(bookings(cur, end)),
    db.execute(bookings(prev, prevEnd)),
  ]);

  const t = rows(totals)[0] ?? {};
  return {
    chats: { value: num(t.chats), previous: num(t.chats_prev) },
    contacts: { value: num(t.contacts), previous: num(t.contacts_prev) },
    bookings: { value: num(rows(bookCur)[0]?.n), previous: num(rows(bookPrev)[0]?.n) },
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    recent: rows(recent).map(toRecent),
  };
}

export const homeWebsiteStorage = { getHomeWebsite };
