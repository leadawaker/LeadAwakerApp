/**
 * Home "Needs attention": the open to-do list, and the rows an account marked as handled
 * (Home_Attention_Dismissed, shared by every user of the account).
 * A row's ref is the call id (callback, transfer_failed) or "<lead id>:<handoff epoch ms>",
 * so a new handoff on the same lead shows up again. Leads have no handoff timestamp, so the
 * handoff starts at the lead's first inbound message after the last human reply: later
 * messages in the same handoff keep the ref, a human reply and a new message start a new one.
 */
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { homeAttentionDismissed, leads, voiceCalls } from "@shared/schema";
import type { AttentionRow } from "@shared/homeTypes";
import type { HomeQuery } from "../routes/homeScope";
import { T, acct, humanOutboundSql, liveCallSql, liveLeadSql, needsCallbackSql, receptionistLeadSql } from "./homeSql";

export const ATTENTION_KINDS: readonly AttentionRow["kind"][] = ["callback", "transfer_failed", "handoff"];
export interface AttentionRef { kind: AttentionRow["kind"]; refId: string }

/**
 * The current to-do list for q (account and channel, not the period), minus dismissed rows.
 * Columns: kind, channel, lead_id, call_id, name, at, account_id, ref_at, ref.
 * A callback is done once the lead has a logged call back (Voice Calls page) after the call,
 * or rang again and that later live call was booked or transferred. Calls with no lead stay.
 */
export function attentionSql(q: HomeQuery): SQL {
  const handoffAt = sql`COALESCE(l.last_message_received_at,
    (SELECT max(mi.created_at) FROM ${T.interactions} mi WHERE mi."Leads_id" = l.id AND lower(mi.direction) = 'inbound'),
    l.created_at)`;
  const handoffStart = sql`COALESCE((SELECT min(fi.created_at) FROM ${T.interactions} fi
      WHERE fi."Leads_id" = l.id AND lower(fi.direction) = 'inbound'
        AND fi.created_at > COALESCE((SELECT max(i.created_at) FROM ${T.interactions} i
          WHERE i."Leads_id" = l.id AND lower(i.direction) = 'outbound' AND ${humanOutboundSql}), '-infinity'::timestamptz)),
    l.created_at)`;
  const union = sql`
        SELECT CASE WHEN o.transfer_outcome = 'failed' THEN 'transfer_failed' ELSE 'callback' END AS kind,
               'phone' AS channel, o.leads_id AS lead_id, o.call_id,
               NULLIF(trim(concat_ws(' ', cl.first_name, cl.last_name)), '') AS name, o.started_at AS at,
               o.accounts_id AS account_id, NULL::timestamptz AS ref_at
        FROM (SELECT vc.leads_id, vc.call_id, vc.started_at, vc.transfer_outcome, vc.accounts_id
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
               ${handoffAt} AS at,
               l."Accounts_id" AS account_id, ${handoffStart} AS ref_at
        FROM ${T.leads} l
        LEFT JOIN ${T.campaigns} c ON c.id = l."Campaigns_id"
        WHERE ${acct('l."Accounts_id"', q.accountId)} AND l.manual_takeover = true
          AND ${liveLeadSql} AND ${receptionistLeadSql}
          AND NOT EXISTS (SELECT 1 FROM ${T.interactions} i WHERE i."Leads_id" = l.id AND lower(i.direction) = 'outbound'
                          AND i.created_at > ${handoffAt} AND ${humanOutboundSql})`;
  const channel = q.channel === null ? sql`TRUE` : sql`a.channel = ${q.channel}`;
  return sql`
    SELECT * FROM (
      SELECT u.*, CASE WHEN u.kind = 'handoff'
                       THEN u.lead_id::text || ':' || floor(extract(epoch FROM u.ref_at) * 1000)::bigint::text
                       ELSE u.call_id END AS ref
      FROM (${union}) u
    ) a
    WHERE ${channel}
      AND NOT EXISTS (SELECT 1 FROM ${T.attentionDismissed} d
                      WHERE d.accounts_id = a.account_id AND d.kind = a.kind AND d.ref_id = a.ref)`;
}

/** The account each ref belongs to, for refs inside the caller's scope (null = every account). */
async function ownersOf(items: AttentionRef[], accountId: number | null): Promise<(AttentionRef & { accountsId: number })[]> {
  const callIds = items.filter((i) => i.kind !== "handoff").map((i) => i.refId);
  const leadIds = items.filter((i) => i.kind === "handoff").map((i) => Number(i.refId.split(":")[0])).filter(Number.isSafeInteger);
  const [calls, leadRows] = await Promise.all([
    callIds.length ? db.select({ id: voiceCalls.callId, acc: voiceCalls.accountsId }).from(voiceCalls).where(inArray(voiceCalls.callId, callIds)) : [],
    leadIds.length ? db.select({ id: leads.id, acc: leads.accountsId }).from(leads).where(inArray(leads.id, leadIds)) : [],
  ]);
  const callAcc = new Map(calls.map((c) => [String(c.id), c.acc]));
  const leadAcc = new Map(leadRows.map((l) => [l.id, l.acc]));
  return items.flatMap((i) => {
    const acc = i.kind === "handoff" ? leadAcc.get(Number(i.refId.split(":")[0])) : callAcc.get(i.refId);
    if (acc == null || (accountId !== null && acc !== accountId)) return [];
    return [{ ...i, accountsId: acc }];
  });
}

/** Mark rows as handled. `all` dismisses the whole current list for q. Returns what was dismissed (for undo). */
async function dismissAttention(q: HomeQuery, items: AttentionRef[] | "all", userId: number | null): Promise<AttentionRef[]> {
  const owned = items === "all"
    ? (await db.execute(sql`SELECT kind, ref, account_id FROM (${attentionSql(q)}) x WHERE ref IS NOT NULL`)).rows
        .map((r: any) => ({ kind: r.kind as AttentionRow["kind"], refId: String(r.ref), accountsId: Number(r.account_id) }))
    : await ownersOf(items, q.accountId);
  if (owned.length === 0) return [];
  await db.insert(homeAttentionDismissed)
    .values(owned.map((o) => ({ accountsId: o.accountsId, kind: o.kind, refId: o.refId, dismissedByUserId: userId })))
    .onConflictDoNothing();
  return owned.map(({ kind, refId }) => ({ kind, refId }));
}

/** Undo: bring dismissed rows back. */
async function restoreAttention(q: HomeQuery, items: AttentionRef[]): Promise<number> {
  const owned = await ownersOf(items, q.accountId);
  if (owned.length === 0) return 0;
  const res = await db.delete(homeAttentionDismissed).where(or(...owned.map((o) => and(
    eq(homeAttentionDismissed.accountsId, o.accountsId), eq(homeAttentionDismissed.kind, o.kind), eq(homeAttentionDismissed.refId, o.refId),
  ))));
  return res.rowCount ?? 0;
}

export const homeAttentionStorage = { dismissAttention, restoreAttention };
