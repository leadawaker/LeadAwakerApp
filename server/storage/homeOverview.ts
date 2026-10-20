/**
 * Overview tab. Definitions follow the daily client recap
 * (automations client_alerts/recap_data.py) so the two always agree.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { ActivityRow, AttentionRow, HomeChannel, HomeOverview } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import {
  T, acct, at, boundsFor, bookingsSql, dayOf, fillDays, humanOutboundSql,
  liveCallSql, liveLeadSql, needsCallbackSql, num, receptionistLeadSql,
} from "./homeSql";

const TEXT_CHANNELS: HomeChannel[] = ["whatsapp", "website", "sms"];
type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];
const iso = (v: unknown) => new Date(v as string).toISOString();

async function getHomeOverview(q: HomeQuery): Promise<HomeOverview> {
  const b = await boundsFor(q);
  const cur = at(b.from, b.tz), end = at(b.to, b.tz), prev = at(b.prevFrom, b.tz), prevEnd = at(b.prevTo, b.tz);

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

  // The current to-do list as one union, shared by the list (LIMIT 8) and the true count.
  // A callback is done once the lead has a logged call back (Voice Calls page) after the call,
  // or rang again and that later live call was booked or transferred. Calls with no lead stay.
  const attentionUnion = sql`
        SELECT CASE WHEN o.transfer_outcome = 'failed' THEN 'transfer_failed' ELSE 'callback' END AS kind,
               'phone' AS channel, o.leads_id AS lead_id, o.call_id,
               NULLIF(trim(concat_ws(' ', cl.first_name, cl.last_name)), '') AS name, o.started_at AS at
        FROM (SELECT vc.leads_id, vc.call_id, vc.started_at, vc.transfer_outcome
              FROM ${T.voiceCalls} vc
              WHERE ${acct("vc.accounts_id", q.accountId)} AND vc.started_at > now() - interval '7 days'
                AND ${liveCallSql} AND ${needsCallbackSql}) o
        LEFT JOIN ${T.leads} cl ON cl.id = o.leads_id
        WHERE NOT EXISTS (SELECT 1 FROM ${T.interactions} cb WHERE cb."Leads_id" = o.leads_id
                          AND cb.type = 'call_back' AND cb.created_at > o.started_at)
          AND NOT EXISTS (SELECT 1 FROM ${T.voiceCalls} vc WHERE vc.leads_id = o.leads_id
                          AND vc.started_at > o.started_at AND vc.outcome IN ('booked', 'transferred') AND ${liveCallSql})
        UNION ALL
        SELECT 'handoff' AS kind,
               COALESCE((SELECT li.channel FROM ${T.interactions} li WHERE li."Leads_id" = l.id AND lower(li.direction) = 'inbound'
                         AND li.channel IN ('whatsapp', 'sms', 'website', 'phone') ORDER BY li.created_at DESC LIMIT 1), 'whatsapp') AS channel,
               l.id AS lead_id, NULL AS call_id,
               NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name,
               COALESCE(l.last_message_received_at,
                        (SELECT max(mi.created_at) FROM ${T.interactions} mi WHERE mi."Leads_id" = l.id AND lower(mi.direction) = 'inbound'),
                        l.created_at) AS at
        FROM ${T.leads} l
        LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
        WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.manual_takeover = true
          AND ${liveLeadSql} AND ${receptionistLeadSql}
          AND NOT EXISTS (SELECT 1 FROM ${T.interactions} i WHERE i."Leads_id" = l.id AND lower(i.direction) = 'outbound'
                          AND i.created_at > COALESCE(l.last_message_received_at,
                        (SELECT max(mi.created_at) FROM ${T.interactions} mi WHERE mi."Leads_id" = l.id AND lower(mi.direction) = 'inbound'),
                        l.created_at) AND ${humanOutboundSql})
  `;

  const smsOut = sql`
    SELECT count(*)::int AS n FROM ${T.interactions} i
    JOIN ${T.leads} l ON l.id = i."Leads_id"
    LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${acct('i."Accounts_id"', q.accountId)} AND lower(i.direction) = 'outbound' AND i.channel = 'sms'
      AND i.created_at >= ${cur} AND i.created_at < ${end}
      AND ${liveLeadSql} AND ${receptionistLeadSql}`;

  const [totals, chanMsg, chanBook, days, attention, waitingCount, activity, smsSent] = await Promise.all([
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
    db.execute(sql`
      WITH msg AS (${msg}), calls AS (${calls})
      SELECT day, sum(n)::int AS value FROM (
        SELECT ${dayOf("created_at", b.tz)} AS day, count(DISTINCT lead_id) AS n FROM msg WHERE created_at >= ${cur} GROUP BY 1
        UNION ALL
        SELECT ${dayOf("started_at", b.tz)} AS day, count(*) AS n FROM calls WHERE started_at >= ${cur} GROUP BY 1
      ) d GROUP BY day`),
    // The current to-do list: not tied to the period.
    db.execute(sql`SELECT * FROM (${attentionUnion}) a ORDER BY at DESC NULLS LAST LIMIT 8`),
    db.execute(sql`SELECT count(*)::int AS n FROM (${attentionUnion}) a`),
    db.execute(sql`
      SELECT * FROM (
        SELECT 'booked' AS kind, COALESCE(l.booking_channel, 'unknown') AS channel, l.id AS lead_id, NULL AS call_id,
               NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name,
               COALESCE(l.booked_at, l.booking_confirmed_at_) AS at, NULL::text AS headline
        FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
        WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.booked_call_date IS NOT NULL
          AND COALESCE(l.booked_at, l.booking_confirmed_at_) >= ${cur} AND COALESCE(l.booked_at, l.booking_confirmed_at_) < ${end}
          AND ${liveLeadSql} AND ${receptionistLeadSql}
        UNION ALL
        SELECT CASE WHEN vc.outcome = 'transferred' THEN 'transferred' ELSE 'call' END, 'phone', vc.leads_id, vc.call_id,
               NULLIF(trim(concat_ws(' ', cl.first_name, cl.last_name)), ''), vc.started_at,
               NULLIF(vc.summary ->> 'outcome', '')
        FROM ${T.voiceCalls} vc LEFT JOIN ${T.leads} cl ON cl.id = vc.leads_id
        WHERE ${acct("vc.accounts_id", q.accountId)} AND vc.started_at >= ${cur} AND vc.started_at < ${end} AND ${liveCallSql}
        UNION ALL
        SELECT 'chat_started', 'website', l.id, NULL,
               NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), ''), l.created_at, NULL
        FROM ${T.leads} l LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
        WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.channel_identifier LIKE 'web:%'
          AND l.created_at >= ${cur} AND l.created_at < ${end} AND ${liveLeadSql} AND ${receptionistLeadSql}
        UNION ALL
        SELECT 'followup_sent', CASE WHEN f.channel = 'sms' THEN 'sms' ELSE 'whatsapp' END, f.leads_id, NULL,
               NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), ''), f.created_at, NULL
        FROM ${T.callFollowupLog} f LEFT JOIN ${T.leads} l ON l.id = f.leads_id
        LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
        WHERE ${acct("f.accounts_id", q.accountId)} AND f.decision = 'sent'
          AND (l.id IS NULL OR (${liveLeadSql} AND ${receptionistLeadSql}))
          AND f.created_at >= ${cur} AND f.created_at < ${end}
      ) a ORDER BY at DESC NULLS LAST LIMIT 12`),
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
      name: (r.name as string | null) ?? null, at: iso(r.at),
    })),
    activity: rows(activity).map((r): ActivityRow => ({
      kind: r.kind as ActivityRow["kind"], channel: r.channel as ActivityRow["channel"],
      leadId: r.lead_id == null ? null : num(r.lead_id), callId: (r.call_id as string | null) ?? null,
      name: (r.name as string | null) ?? null, at: iso(r.at), headline: (r.headline as string | null) || null,
    })),
  };
}

export const homeOverviewStorage = { getHomeOverview };
