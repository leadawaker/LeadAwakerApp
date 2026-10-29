/**
 * Home's Recent activity: calls and the latest message of each chat, newest
 * first, for one channel or all of them (HomeQuery.channel).
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import type { HomeChannel, RecentItem } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, liveCallSql, liveLeadSql, needsCallbackSql, num, receptionistLeadSql } from "./homeSql";
import { classify } from "./homePhone";

const LIMIT = 12;
type Row = Record<string, unknown>;
const rows = (r: { rows: unknown[] }) => r.rows as Row[];
const iso = (v: unknown) => new Date(v as string).toISOString();

/** Calls in [cur, end), with what classify() needs for the outcome tag. */
function callsSql(q: HomeQuery, cur: SQL, end: SQL): SQL {
  return sql`
    SELECT vc.call_id, vc.leads_id, vc.started_at, vc.ended_at, vc.caller_number, vc.transfer_outcome,
           vc.outcome AS raw_outcome, vc.booked_iso, vc.summary ->> 'outcome' AS headline, vc.summary IS NOT NULL AS has_summary,
           ARRAY(SELECT it ->> 'intent' FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(vc.summary -> 'items') = 'array' THEN vc.summary -> 'items' ELSE '[]'::jsonb END) it) AS intents,
           ${needsCallbackSql} AS cb,
           GREATEST(EXTRACT(EPOCH FROM (COALESCE(vc.ended_at,
             (SELECT max(ti.created_at) FROM ${T.interactions} ti WHERE ti.conversation_thread_id = vc.call_id)) - vc.started_at)), 0) AS seconds,
           NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name
    FROM ${T.voiceCalls} vc LEFT JOIN ${T.leads} l ON l.id = vc.leads_id
    WHERE ${acct("vc.accounts_id", q.accountId)} AND vc.started_at >= ${cur} AND vc.started_at < ${end} AND ${liveCallSql}
    ORDER BY vc.started_at DESC LIMIT ${LIMIT}`;
}

/**
 * One page of messages in [cur, end) on the given text channels, newest first.
 * WhatsApp and Webchat count the lead's own messages; SMS is mostly one-way (a
 * fallback), so its sent messages count too. `after` is the keyset of the
 * previous page's last row (created_at as text keeps the microseconds).
 */
const CHAT_PAGE = 200;
/** Enough for any real week; caps the walk when a few leads send thousands of messages. */
const MAX_CHAT_PAGES = 5;
function chatPageSql(q: HomeQuery, channels: HomeChannel[], cur: SQL, end: SQL, after: { at: string; id: number } | null): SQL {
  const list = sql.join(channels.map((c) => sql`${c}`), sql`, `);
  return sql`
    SELECT i.id, i."Leads_id" AS lead_id, i.channel, i.created_at AS at, i.created_at::text AS at_key,
           left(i."Content", 90) AS snippet,
           NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS name
    FROM ${T.interactions} i
    JOIN ${T.leads} l ON l.id = i."Leads_id"
    LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
    WHERE ${acct('i."Accounts_id"', q.accountId)} AND i.channel IN (${list})
      AND (lower(i.direction) = 'inbound' OR i.channel = 'sms')
      AND lower(COALESCE(i.type, '')) NOT IN ('voice_call', 'voicemail')
      AND i.created_at >= ${cur} AND i.created_at < ${end}
      AND ${liveLeadSql} AND ${receptionistLeadSql}
      ${after ? sql`AND (i.created_at, i.id) < (${after.at}::timestamptz, ${after.id})` : sql``}
    ORDER BY i.created_at DESC, i.id DESC LIMIT ${CHAT_PAGE}`;
}

/**
 * Each lead's latest message, the LIMIT newest leads. Walks the messages newest
 * first a page at a time and stops once LIMIT leads are found, so "all time"
 * reads a page or two instead of every lead's history (at most MAX_CHAT_PAGES).
 */
async function latestChats(q: HomeQuery, channels: HomeChannel[], cur: SQL, end: SQL): Promise<Row[]> {
  const byLead = new Map<number, Row>();
  let after: { at: string; id: number } | null = null;
  for (let n = 0; n < MAX_CHAT_PAGES; n++) {
    const page = rows(await db.execute(chatPageSql(q, channels, cur, end, after)));
    for (const r of page) {
      const lead = num(r.lead_id);
      if (byLead.has(lead)) continue;
      byLead.set(lead, r);
      if (byLead.size === LIMIT) return Array.from(byLead.values());
    }
    if (page.length < CHAT_PAGE) return Array.from(byLead.values());
    const last = page[page.length - 1];
    after = { at: String(last.at_key), id: num(last.id) };
  }
  return Array.from(byLead.values());
}

export async function recentActivity(q: HomeQuery, cur: SQL, end: SQL): Promise<RecentItem[]> {
  const ch = q.channel;
  const textChannels = (["whatsapp", "sms", "website"] as HomeChannel[]).filter((c) => ch === null || ch === c);
  const [calls, chats] = await Promise.all([
    ch === null || ch === "phone" ? db.execute(callsSql(q, cur, end)) : Promise.resolve({ rows: [] }),
    textChannels.length > 0 ? latestChats(q, textChannels, cur, end) : Promise.resolve([] as Row[]),
  ]);
  const items: RecentItem[] = [
    ...rows(calls).map((r): RecentItem => ({
      channel: "phone", callId: String(r.call_id), leadId: r.leads_id == null ? null : num(r.leads_id), name: (r.name as string | null) ?? null,
      callerNumber: (r.caller_number as string | null) ?? null, at: iso(r.started_at),
      text: (r.headline as string | null) || null, outcome: classify(r),
    })),
    ...chats.map((r): RecentItem => ({
      channel: r.channel as HomeChannel, callId: null, leadId: num(r.lead_id), name: (r.name as string | null) ?? null,
      callerNumber: null, at: iso(r.at), text: String(r.snippet ?? "") || null, outcome: null,
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT);
}
