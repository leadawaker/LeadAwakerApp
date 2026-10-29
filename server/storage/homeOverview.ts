/**
 * Overview tab. Definitions follow the daily client recap
 * (automations client_alerts/recap_data.py) so the two always agree.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { AttentionRow, HomeChannel, HomeOverview } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import {
  T, acct, boundsFor, rangeOf, bookingsSql, bucketSql, fillDays,
  liveCallSql, liveLeadSql, needsCallbackSql, num, receptionistLeadSql,
} from "./homeSql";
import { recentActivity } from "./homeRecent";
import { attentionSql } from "./homeAttention";

const TEXT_CHANNELS: HomeChannel[] = ["whatsapp", "website", "sms"];
type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];
const iso = (v: unknown) => new Date(v as string).toISOString();

async function getHomeOverview(q: HomeQuery): Promise<HomeOverview> {
  const b = await boundsFor(q);
  const { cur, end, prev, prevEnd } = rangeOf(b);

  // Inbound non-phone messages from receptionist leads, both periods.
  // channel NULL (unclassified) still counts as a conversation, under no channel.
  // channel 'other' is a system event (restart marker, booking note), never a conversation.
  // Phone transcript rows (voice_call, voicemail) are calls, counted from Voice_Calls, as in the recap.
  const msg = sql`
    SELECT i."Leads_id" AS lead_id, COALESCE(i.channel, 'other') AS channel, i.created_at, l.created_at AS lead_created
    FROM ${T.interactions} i
    JOIN ${T.leads} l ON l.id = i."Leads_id"
    LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${acct('i."Accounts_id"', q.accountId)} AND lower(i.direction) = 'inbound'
      AND COALESCE(i.channel, 'unclassified') NOT IN ('phone', 'other')
      AND lower(COALESCE(i.type, '')) NOT IN ('voice_call', 'voicemail')
      AND i.created_at >= ${prev} AND i.created_at < ${end}
      AND ${liveLeadSql} AND ${receptionistLeadSql}`;
  const calls = sql`
    SELECT vc.started_at, ${needsCallbackSql} AS cb
    FROM ${T.voiceCalls} vc
    WHERE ${acct("vc.accounts_id", q.accountId)} AND vc.started_at >= ${prev} AND vc.started_at < ${end} AND ${liveCallSql}`;
  const bookings = bookingsSql(q.accountId, prev, end);

  // The current to-do list (minus rows marked as handled), shared by the list (LIMIT 8) and the true count.
  const attentionList = attentionSql(q);

  const smsOut = sql`
    SELECT count(*)::int AS n FROM ${T.interactions} i
    JOIN ${T.leads} l ON l.id = i."Leads_id"
    LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${acct('i."Accounts_id"', q.accountId)} AND lower(i.direction) = 'outbound' AND i.channel = 'sms'
      AND i.created_at >= ${cur} AND i.created_at < ${end}
      AND ${liveLeadSql} AND ${receptionistLeadSql}`;

  // Conversations per bucket for the channel switcher: calls, chats on one text
  // channel, or (SMS, a one-way fallback) messages sent, as in byChannel.
  const ch = q.channel;
  const msgDays = sql`SELECT ${bucketSql("created_at", b)} AS day, count(DISTINCT lead_id) AS n FROM msg
        WHERE created_at >= ${cur} ${ch === null ? sql`` : sql`AND channel = ${ch}`} GROUP BY 1`;
  const callDays = sql`SELECT ${bucketSql("started_at", b)} AS day, count(*) AS n FROM calls WHERE started_at >= ${cur} GROUP BY 1`;
  const perDaySql = ch === "sms"
    ? sql`
      SELECT ${bucketSql("i.created_at", b)} AS day, count(*)::int AS value FROM ${T.interactions} i
      JOIN ${T.leads} l ON l.id = i."Leads_id"
      LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
      WHERE ${acct('i."Accounts_id"', q.accountId)} AND lower(i.direction) = 'outbound' AND i.channel = 'sms'
        AND i.created_at >= ${cur} AND i.created_at < ${end} AND ${liveLeadSql} AND ${receptionistLeadSql}
      GROUP BY 1`
    : sql`
      WITH msg AS (${msg}), calls AS (${calls})
      SELECT day, sum(n)::int AS value FROM (
        ${ch === "phone" ? callDays : ch !== null ? msgDays : sql`${msgDays} UNION ALL ${callDays}`}
      ) d GROUP BY day`;

  const [totals, chanMsg, chanBook, days, attention, waitingCount, recent, smsSent] = await Promise.all([
    db.execute(sql`
      WITH msg AS (${msg}), calls AS (${calls}), bk AS (${bookings})
      SELECT
        (SELECT count(DISTINCT lead_id) FROM msg WHERE created_at >= ${cur})::int AS chats,
        (SELECT count(DISTINCT lead_id) FROM msg WHERE created_at < ${prevEnd})::int AS chats_prev,
        (SELECT count(DISTINCT lead_id) FROM msg WHERE created_at >= ${cur} AND lead_created >= ${cur})::int AS new_contacts,
        (SELECT count(DISTINCT lead_id) FROM msg WHERE created_at < ${prevEnd} AND lead_created >= ${prev})::int AS new_contacts_prev,
        (SELECT count(*) FROM calls WHERE started_at >= ${cur})::int AS calls,
        (SELECT count(*) FROM calls WHERE started_at < ${prevEnd})::int AS calls_prev,
        (SELECT count(*) FROM calls WHERE started_at >= ${cur} AND cb)::int AS callbacks,
        (SELECT count(*) FROM calls WHERE started_at < ${prevEnd} AND cb)::int AS callbacks_prev,
        (SELECT count(*) FROM bk WHERE booked >= ${cur})::int AS bookings,
        (SELECT count(*) FROM bk WHERE booked < ${prevEnd})::int AS bookings_prev`),
    db.execute(sql`
      WITH msg AS (${msg})
      SELECT channel, count(DISTINCT lead_id)::int AS n FROM msg WHERE created_at >= ${cur} GROUP BY channel`),
    db.execute(sql`
      WITH bk AS (${bookings})
      SELECT channel, count(*)::int AS n FROM bk WHERE booked >= ${cur} GROUP BY channel`),
    db.execute(perDaySql),
    // The current to-do list: not tied to the period.
    db.execute(sql`SELECT * FROM (${attentionList}) a ORDER BY at DESC NULLS LAST LIMIT 8`),
    db.execute(sql`SELECT count(*)::int AS n FROM (${attentionList}) a`),
    recentActivity(q, cur, end),
    db.execute(smsOut),
  ]);

  const t = rows(totals)[0] ?? {};
  const msgBy = new Map(rows(chanMsg).map((r) => [String(r.channel), num(r.n)]));
  const bookBy = new Map(rows(chanBook).map((r) => [String(r.channel), num(r.n)]));
  const attentionRows = rows(attention);
  const smsMessages = num(rows(smsSent)[0]?.n);

  return {
    conversations: { value: num(t.chats) + num(t.calls), previous: num(t.chats_prev) + num(t.calls_prev) },
    bookings: { value: num(t.bookings), previous: num(t.bookings_prev) },
    callbacks: { value: num(t.callbacks), previous: num(t.callbacks_prev) },
    newContacts: { value: num(t.new_contacts), previous: num(t.new_contacts_prev) },
    waiting: num(rows(waitingCount)[0]?.n),
    byChannel: [
      { channel: "phone" as HomeChannel, conversations: num(t.calls), bookings: bookBy.get("phone") ?? 0 },
      // For sms, `conversations` is messages sent (SMS is a one-way fallback).
      ...TEXT_CHANNELS.map((channel) => ({
        channel,
        conversations: channel === "sms" ? smsMessages : msgBy.get(channel) ?? 0,
        bookings: bookBy.get(channel) ?? 0,
      })),
    ],
    perDay: fillDays(b, rows(days).map((r) => ({ day: String(r.day), value: num(r.value) }))),
    attention: attentionRows.map((r): AttentionRow => ({
      kind: r.kind as AttentionRow["kind"], channel: r.channel as HomeChannel,
      leadId: r.lead_id == null ? null : num(r.lead_id), callId: (r.call_id as string | null) ?? null,
      name: (r.name as string | null) ?? null, at: iso(r.at), ref: (r.ref as string | null) ?? null,
    })),
    recent,
  };
}

export const homeOverviewStorage = { getHomeOverview };
