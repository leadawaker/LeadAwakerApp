import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import type { HomeWhatsapp, RecentLead } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, boundsFor, rangeOf, bucketSql, fillDays, humanOutboundSql, liveCallSql, liveLeadSql, num, receptionistLeadSql } from "./homeSql";

type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];

/** Receptionist messages on one channel, both periods. Shared with the Website tab. */
export const channelMessagesSql = (q: HomeQuery, channel: "whatsapp" | "website", prev: SQL, end: SQL) => sql`
  SELECT i."Leads_id" AS lead_id, lower(i.direction) AS direction, i.created_at, i."Content" AS content, ${humanOutboundSql} AS human
  FROM ${T.interactions} i
  JOIN ${T.leads} l ON l.id = i."Leads_id"
  LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
  WHERE ${acct('i."Accounts_id"', q.accountId)} AND i.channel = ${channel}
    AND i.created_at >= ${prev} AND i.created_at < ${end}
    AND ${liveLeadSql} AND ${receptionistLeadSql}`;

export const recentLeadsSql = (msg: SQL, cur: SQL) => sql`
  WITH msg AS (${msg})
  SELECT m.lead_id, m.created_at AS at, left(m.content, 90) AS snippet,
         NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name
  FROM (SELECT DISTINCT ON (lead_id) lead_id, created_at, content FROM msg
        WHERE created_at >= ${cur} AND direction = 'inbound' ORDER BY lead_id, created_at DESC) m
  JOIN ${T.leads} l ON l.id = m.lead_id
  ORDER BY m.created_at DESC LIMIT 8`;

export const toRecent = (r: Row): RecentLead => ({
  leadId: num(r.lead_id), name: (r.name as string | null) ?? null,
  at: new Date(r.at as string).toISOString(), snippet: String(r.snippet ?? ""),
});

async function getHomeWhatsapp(q: HomeQuery): Promise<HomeWhatsapp> {
  const b = await boundsFor(q);
  const { cur, end, prev, prevEnd } = rangeOf(b);
  const msg = channelMessagesSql(q, "whatsapp", prev, end);

  const [totals, days, recent, extras, sms] = await Promise.all([
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT
        count(DISTINCT lead_id) FILTER (WHERE created_at >= ${cur} AND direction = 'inbound')::int AS conversations,
        count(DISTINCT lead_id) FILTER (WHERE created_at < ${prevEnd} AND direction = 'inbound')::int AS conversations_prev,
        count(*) FILTER (WHERE created_at >= ${cur} AND direction = 'inbound')::int AS msg_in,
        count(*) FILTER (WHERE created_at < ${prevEnd} AND direction = 'inbound')::int AS msg_in_prev,
        count(*) FILTER (WHERE created_at >= ${cur} AND direction = 'outbound')::int AS msg_out,
        count(*) FILTER (WHERE created_at < ${prevEnd} AND direction = 'outbound')::int AS msg_out_prev,
        count(DISTINCT lead_id) FILTER (WHERE created_at >= ${cur} AND direction = 'outbound' AND human)::int AS handed_off,
        count(DISTINCT lead_id) FILTER (WHERE created_at < ${prevEnd} AND direction = 'outbound' AND human)::int AS handed_off_prev
      FROM msg`),
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT ${bucketSql("created_at", b)} AS day, count(DISTINCT lead_id)::int AS value
      FROM msg WHERE created_at >= ${cur} AND direction = 'inbound' GROUP BY 1`),
    db.execute(recentLeadsSql(msg, cur)),
    db.execute(sql`
      SELECT
        (SELECT count(*) FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.booked_call_date IS NOT NULL AND l.booking_channel = 'whatsapp'
            AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${cur} AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${end}
            AND ${liveLeadSql} AND ${receptionistLeadSql})::int AS bookings,
        (SELECT count(*) FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
          WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.booked_call_date IS NOT NULL AND l.booking_channel = 'whatsapp'
            AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${prev} AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${prevEnd}
            AND ${liveLeadSql} AND ${receptionistLeadSql})::int AS bookings_prev,
        -- Call_Followup_Log.channel is whatsapp_template | whatsapp_text | sms (after_call_followup.py).
        (SELECT count(*) FROM ${T.callFollowupLog} f JOIN ${T.voiceCalls} vc ON vc.id = f.voice_call_id
          WHERE ${acct("f.accounts_id", q.accountId)} AND f.decision = 'sent' AND ${liveCallSql}
            AND f.created_at >= ${cur} AND f.created_at < ${end})::int AS follow_ups,
        (SELECT count(*) FROM ${T.callFollowupLog} f JOIN ${T.voiceCalls} vc ON vc.id = f.voice_call_id
          WHERE ${acct("f.accounts_id", q.accountId)} AND f.decision = 'sent' AND f.channel = 'sms' AND ${liveCallSql}
            AND f.created_at >= ${cur} AND f.created_at < ${end})::int AS follow_ups_sms,
        EXISTS (SELECT 1 FROM ${T.accounts} a WHERE ${acct("a.id", q.accountId)} AND COALESCE(a.sms_sender_id, '') <> '') AS sms_on,
        (SELECT s.status FROM ${T.whatsappSenders} s WHERE ${acct("s.accounts_id", q.accountId)} ORDER BY s.id LIMIT 1) AS sender_status,
        (SELECT s.quality_rating FROM ${T.whatsappSenders} s WHERE ${acct("s.accounts_id", q.accountId)} ORDER BY s.id LIMIT 1) AS sender_quality`),
    // SMS sends to real leads only (demo excluded, like every other number).
    db.execute(sql`
      SELECT count(*)::int AS sent,
             count(*) FILTER (WHERE lower(i.status) = 'delivered')::int AS delivered,
             count(*) FILTER (WHERE lower(i.status) IN ('failed', 'undelivered'))::int AS failed
      FROM ${T.interactions} i
      JOIN ${T.leads} l ON l.id = i."Leads_id"
      LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
      WHERE ${acct('i."Accounts_id"', q.accountId)} AND i.channel = 'sms' AND lower(i.direction) = 'outbound'
        AND i.created_at >= ${cur} AND i.created_at < ${end} AND ${liveLeadSql} AND ${receptionistLeadSql}`),
  ]);

  const t = rows(totals)[0] ?? {};
  const x = rows(extras)[0] ?? {};
  const m = rows(sms)[0] ?? {};
  const smsSent = num(m.sent);
  const followUps = num(x.follow_ups);
  return {
    conversations: { value: num(t.conversations), previous: num(t.conversations_prev) },
    messagesIn: { value: num(t.msg_in), previous: num(t.msg_in_prev) },
    messagesOut: { value: num(t.msg_out), previous: num(t.msg_out_prev) },
    bookings: { value: num(x.bookings), previous: num(x.bookings_prev) },
    handedOff: { value: num(t.handed_off), previous: num(t.handed_off_prev) },
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    followUps,
    sms: x.sms_on === true || smsSent > 0
      ? { sent: smsSent, delivered: num(m.delivered), failed: num(m.failed),
          followUpShare: followUps === 0 ? null : Math.round((num(x.follow_ups_sms) / followUps) * 100) }
      : null,
    // One sender per account. In the all-accounts view there is no single number to report.
    sender: q.accountId === null || x.sender_status == null ? null
      : { connected: x.sender_status === "connected", quality: (x.sender_quality as string | null) ?? null },
    recent: rows(recent).map(toRecent),
  };
}

export const homeMessagingStorage = { getHomeWhatsapp };
