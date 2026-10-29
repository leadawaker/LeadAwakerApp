// Paged leads list for the Chats and Leads pages: one page of leads plus the
// counts the page shows (total, group headers, channel tabs, quick views),
// all computed server side so search and counts cover every lead, not only
// the loaded page.
//
// Per lead it derives (from Interactions, the channel truth):
//   chat_channel      latest whatsapp/website message channel (Chats tabs)
//   channels          every channel the lead reached us on (Leads filter)
//   contact_channel   channel of the latest contact (card "WhatsApp · 2h ago")
//   needs_reply       latest message (not a call) is inbound, or a human
//                     takeover was flagged and no human answered yet
//   stage_key         display stage: receptionist leads map to
//                     rx_new / rx_answered / Booked / rx_done, DBR leads keep
//                     their Conversion_Status. Display only, never written.

import { pool } from "../db";

const S = "p2mxx34fvbf3ll6";

export type LeadsPageSort =
  | "recent" | "latest_message" | "oldest" | "name_asc" | "name_desc"
  | "activity_desc" | "activity_asc" | "created_desc" | "created_asc" | "appointment";
export type LeadsPageGroup =
  | "none" | "date" | "status" | "campaign" | "account" | "service" | "source" | "tag" | "type";

export interface LeadsPageParams {
  accountId?: number;
  /** Clients never see Owner-flagged test leads. */
  hideTest?: boolean;
  limit: number;
  offset: number;
  /** Kanban: top N rows of every group instead of limit/offset. */
  perGroup?: number;
  ids?: number[];
  search?: string;
  sort: LeadsPageSort;
  groupBy: LeadsPageGroup;
  groupDir: "asc" | "desc";
  status: string[];
  campaign?: number;
  account?: number;
  service: string[];
  source: string[];
  tags: string[];
  type: string[];
  chatChannel?: "website" | "whatsapp";
  /** Chats page: only leads with a chat (a caller who later chatted stays; a call-only lead does not). */
  chatsOnly?: boolean;
  /** Chats page Live / Demo: demo leads (demo campaign, demo persona or demo channel) or everything else. Unset: both. */
  scope?: "live" | "demo";
  channel?: "website" | "whatsapp" | "phone";
  needsReply: boolean;
  upcoming: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  facets: boolean;
}

export const STAGE_ORDER = [
  "New", "rx_new", "Contacted", "Responded", "rx_answered", "Multiple Responses",
  "Qualified", "Booked", "rx_done", "Lost", "DND",
];
const TYPE_ORDER = ["widget", "voice", "dbr", "instagram", "other"];
const DATE_BUCKETS = ["today", "yesterday", "thisWeek", "thisMonth", "last3Months", "older", "noActivity"];

// Derived per-lead columns. One aggregate over the lead's interactions. The Chats list
// (`chats`) leaves phone turns out of the order and the preview: a call shows in the thread as
// one line, and must not move a chat up the list or stand in as its last message.
export function baseSql(chats: boolean): string {
  const noPhone = chats ? ` FILTER (WHERE i.channel IS DISTINCT FROM 'phone')` : "";
  return `
  SELECT
    l.id,
    l."Accounts_id" AS account_id,
    l."Campaigns_id" AS campaign_id,
    COALESCE(c.name, '') AS campaign_name,
    COALESCE(a.name, '') AS account_name,
    COALESCE(c.campaign_type, '') AS campaign_type,
    COALESCE(l."Source", '') AS source,
    l.first_name, l.last_name, l.phone, l."Email" AS email, l.channel_identifier,
    l.created_at, l.booked_call_date,
    COALESCE(l."Conversion_Status", '') AS status_raw,
    (COALESCE(c.bump_mode, '') = 'receptionist' OR COALESCE(c.campaign_type, '') = 'receptionist'
      OR COALESCE(l."Source", '') IN ('voice_receptionist', 'Website Chat')) AS is_receptionist,
    ix.chans, ix.has_out, ix.unread, ix.chat_channel, ix.contact_channel, ix.contact_at,
    ix.msg_dir, ix.msg_ai, ix.last_message, ix.last_dir,
    GREATEST(l.last_message_received_at, l.last_message_sent_at, l.last_interaction_at::timestamptz, ix.any_at) AS activity_at,
    COALESCE(GREATEST(l.last_message_received_at, l.last_message_sent_at, l.last_interaction_at::timestamptz, ix.any_at), l.created_at) AS recency_at,
    CASE
      WHEN COALESCE(l.channel_identifier, '') ~ '^web[:-]' OR COALESCE(l."Source", '') ILIKE '%website%' THEN 'website'
      WHEN COALESCE(l.channel_identifier, '') ~ '^wa[:-]' OR COALESCE(l."Source", '') ILIKE '%whatsapp%' THEN 'whatsapp'
      WHEN COALESCE(l."Source", '') = 'voice_receptionist' THEN 'phone'
    END AS fallback_channel,
    CASE
      WHEN COALESCE(l."Source", '') = 'Website Chat' OR COALESCE(l.channel_identifier, '') ~ '^web:' THEN 'widget'
      WHEN COALESCE(l."Source", '') = 'voice_receptionist' THEN 'voice'
      WHEN c.campaign_type = 'social_reply' THEN 'instagram'
      -- The browser demo page is a website chat, whatever the demo campaign. Receptionist and
      -- demo campaigns carry the default campaign_type 'reactivation', so the campaign alone
      -- would file website visitors as dbr. Keep in step with client conversationType.ts.
      WHEN COALESCE(l.channel_identifier, '') ~ '^web-demo:' THEN 'widget'
      WHEN COALESCE(c.bump_mode, '') = 'receptionist' THEN 'other'
      WHEN c.campaign_type IN ('reactivation', 'speed_to_lead') THEN 'dbr'
      ELSE 'other'
    END AS conv_type,
    (NOT COALESCE(l.opted_out, false) AND COALESCE(l."Conversion_Status", '') NOT IN ('DND', 'Lost')
      AND (ix.msg_dir = 'inbound'
        OR (COALESCE(l.manual_takeover, false) AND l.handoff_reason IS NOT NULL
            AND (ix.msg_dir IS DISTINCT FROM 'outbound' OR COALESCE(ix.msg_ai, false))))) AS needs_reply,
    (l.booked_call_date >= date_trunc('day', now())
      AND (l.booking_cancelled_at IS NULL OR l.booked_at > l.booking_cancelled_at)) AS upcoming,
    l.service_completed_at,
    (COALESCE(c.is_demo, false) OR l.demo_niche IS NOT NULL OR COALESCE(l.channel_identifier, '') ~ '^((wa|web)-demo:|tg:|tg-)') AS is_demo
  FROM ${S}."Leads" l
  LEFT JOIN ${S}."Campaigns" c ON c.id = l."Campaigns_id"
  LEFT JOIN ${S}."Accounts" a ON a.id = l."Accounts_id"
  LEFT JOIN LATERAL (
    SELECT
      array_agg(DISTINCT i.channel) FILTER (WHERE i.channel IN ('whatsapp', 'website', 'phone')) AS chans,
      COALESCE(bool_or(i.direction = 'outbound'), false) AS has_out,
      (count(*) FILTER (WHERE i.direction = 'inbound' AND COALESCE(i.is_read, true) = false))::int AS unread,
      (array_agg(i.channel ORDER BY i.created_at DESC NULLS LAST) FILTER (WHERE i.channel IN ('whatsapp', 'website')))[1] AS chat_channel,
      (array_agg(i.channel ORDER BY i.created_at DESC NULLS LAST) FILTER (WHERE i.channel IN ('whatsapp', 'website', 'phone', 'email', 'sms')))[1] AS contact_channel,
      max(i.created_at) FILTER (WHERE i.channel IN ('whatsapp', 'website', 'phone', 'email', 'sms')) AS contact_at,
      (array_agg(i.direction ORDER BY i.created_at DESC NULLS LAST) FILTER (WHERE i.channel IS DISTINCT FROM 'phone'))[1] AS msg_dir,
      (array_agg(i.ai_generated ORDER BY i.created_at DESC NULLS LAST) FILTER (WHERE i.channel IS DISTINCT FROM 'phone'))[1] AS msg_ai,
      (array_agg(LEFT(i."Content", 140) ORDER BY i.created_at DESC NULLS LAST)${noPhone})[1] AS last_message,
      (array_agg(i.direction ORDER BY i.created_at DESC NULLS LAST)${noPhone})[1] AS last_dir,
      max(i.created_at)${noPhone} AS any_at
    FROM ${S}."Interactions" i
    WHERE i."Leads_id" = l.id
  ) ix ON true
`;
}

// Second layer: values that depend on the derived columns above.
const DERIVED_SQL = `
  SELECT b.*,
    COALESCE(b.chat_channel, CASE WHEN b.fallback_channel IN ('website', 'whatsapp') THEN b.fallback_channel END) AS chat_channel_eff,
    CASE WHEN b.chans IS NOT NULL THEN b.chans
         WHEN b.fallback_channel IS NOT NULL THEN ARRAY[b.fallback_channel]
         ELSE ARRAY[]::text[] END AS channels_eff,
    CASE WHEN b.is_receptionist THEN
      CASE WHEN b.status_raw IN ('Lost', 'DND', 'Cancelled', 'Closed') OR b.service_completed_at IS NOT NULL THEN 'rx_done'
           WHEN b.status_raw = 'Booked' THEN 'Booked'
           WHEN b.has_out THEN 'rx_answered'
           ELSE 'rx_new' END
    ELSE COALESCE(NULLIF(b.status_raw, ''), 'Unknown') END AS stage_key,
    CASE
      WHEN b.activity_at IS NULL THEN 6
      WHEN floor(extract(epoch FROM now() - b.activity_at) / 86400) <= 0 THEN 0
      WHEN floor(extract(epoch FROM now() - b.activity_at) / 86400) = 1 THEN 1
      WHEN floor(extract(epoch FROM now() - b.activity_at) / 86400) < 7 THEN 2
      WHEN floor(extract(epoch FROM now() - b.activity_at) / 86400) < 30 THEN 3
      WHEN floor(extract(epoch FROM now() - b.activity_at) / 86400) < 90 THEN 4
      ELSE 5 END AS date_bucket,
    lower(trim(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, ''))) AS sort_name
  FROM base b
`;

class Params {
  values: unknown[] = [];
  add(v: unknown): string { this.values.push(v); return `$${this.values.length}`; }
}

function groupExpr(groupBy: LeadsPageGroup, p: Params): { key: string; rank: string } {
  switch (groupBy) {
    case "date":
      return { key: `(${p.add(DATE_BUCKETS)}::text[])[d.date_bucket + 1]`, rank: "d.date_bucket" };
    case "status":
      return { key: "d.stage_key", rank: `COALESCE(array_position(${p.add(STAGE_ORDER)}::text[], d.stage_key), 99)` };
    case "type":
      return { key: "d.conv_type", rank: `COALESCE(array_position(${p.add(TYPE_ORDER)}::text[], d.conv_type), 99)` };
    case "campaign": return { key: "d.campaign_name", rank: "0" };
    case "account": return { key: "d.account_name", rank: "0" };
    case "service": return { key: "d.campaign_type", rank: "0" };
    case "source": return { key: "d.source", rank: "0" };
    case "tag":
      return {
        key: `COALESCE((SELECT t.name FROM ${S}."Leads_Tags" lt JOIN ${S}."Tags" t ON t.id = lt."Tags_id"
               WHERE lt."Leads_id" = d.id AND lt.removed_at IS NULL ORDER BY lt.id LIMIT 1), '')`,
        rank: "0",
      };
    default: return { key: "''", rank: "0" };
  }
}

function sortExpr(sort: LeadsPageSort): string {
  switch (sort) {
    case "oldest": return "d.id ASC";
    case "name_asc": return "(d.sort_name = '') ASC, d.sort_name ASC";
    case "name_desc": return "(d.sort_name = '') ASC, d.sort_name DESC";
    case "activity_desc": return "d.activity_at DESC NULLS LAST";
    case "activity_asc": return "d.activity_at ASC NULLS LAST";
    case "created_desc": return "d.created_at DESC NULLS LAST";
    case "created_asc": return "d.created_at ASC NULLS LAST";
    case "appointment": return "d.booked_call_date ASC NULLS LAST";
    default: return "d.recency_at DESC NULLS LAST";
  }
}

export interface LeadsPageResult {
  rows: Array<Record<string, any>>;
  total: number;
  groups: Array<{ key: string; count: number }>;
  chatChannelCounts: Record<string, number>;
  channelCounts: Record<string, number>;
  viewCounts: { needsReply: number; upcoming: number };
  facets?: {
    accounts: Array<{ id: number; name: string }>;
    campaigns: Array<{ id: number; name: string; accountId: number | null }>;
    services: string[];
    sources: string[];
  };
}

export async function getLeadsPage(params: LeadsPageParams): Promise<LeadsPageResult> {
  const p = new Params();
  const scope: string[] = [];
  if (params.accountId) scope.push(`l."Accounts_id" = ${p.add(params.accountId)}`);
  if (params.ids && params.ids.length > 0) scope.push(`l.id = ANY(${p.add(params.ids)}::int[])`);
  if (params.hideTest) scope.push(`COALESCE(l.is_test, false) = false`);
  const scopeSql = scope.length ? `WHERE ${scope.join(" AND ")}` : "";

  // Base filters: everything except the four "axis" filters whose counts we show.
  const base: string[] = [];
  const q = (params.search || "").trim();
  if (q) {
    // % and _ are LIKE wildcards: escape them so they match themselves.
    const like = p.add(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
    const parts = [
      `d.first_name ILIKE ${like}`, `d.last_name ILIKE ${like}`,
      `(COALESCE(d.first_name, '') || ' ' || COALESCE(d.last_name, '')) ILIKE ${like}`,
      `d.phone ILIKE ${like}`, `d.email ILIKE ${like}`, `d.channel_identifier ILIKE ${like}`,
      `d.campaign_name ILIKE ${like}`, `d.source ILIKE ${like}`,
    ];
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 3) parts.push(`regexp_replace(COALESCE(d.phone, ''), '\\D', '', 'g') LIKE ${p.add(`%${digits}%`)}`);
    if (/^\d+$/.test(q)) parts.push(`d.id = ${p.add(Number(q))}`);
    base.push(`(${parts.join(" OR ")})`);
  }
  if (params.status.length) base.push(`d.stage_key = ANY(${p.add(params.status)}::text[])`);
  if (params.campaign) base.push(`d.campaign_id = ${p.add(params.campaign)}`);
  if (params.account) base.push(`d.account_id = ${p.add(params.account)}`);
  if (params.service.length) base.push(`d.campaign_type = ANY(${p.add(params.service)}::text[])`);
  if (params.source.length) base.push(`d.source = ANY(${p.add(params.source)}::text[])`);
  if (params.type.length) base.push(`d.conv_type = ANY(${p.add(params.type)}::text[])`);
  if (params.tags.length) {
    base.push(`EXISTS (SELECT 1 FROM ${S}."Leads_Tags" lt JOIN ${S}."Tags" t ON t.id = lt."Tags_id"
      WHERE lt."Leads_id" = d.id AND lt.removed_at IS NULL AND t.name = ANY(${p.add(params.tags)}::text[]))`);
  }
  // In the base filter, so the list and every count (tabs, totals) agree.
  if (params.chatsOnly) base.push(`d.chat_channel_eff IS NOT NULL`);
  if (params.scope) base.push(params.scope === "demo" ? `d.is_demo` : `NOT d.is_demo`);
  if (params.hasPhone) base.push(`COALESCE(d.phone, '') <> ''`);
  if (params.hasEmail) base.push(`COALESCE(d.email, '') <> ''`);

  // Axis filters, kept apart so each count can drop its own axis.
  const axis = {
    chat: params.chatChannel ? `d.chat_channel_eff = ${p.add(params.chatChannel)}` : "",
    channel: params.channel ? `${p.add(params.channel)} = ANY(d.channels_eff)` : "",
    reply: params.needsReply ? "d.needs_reply" : "",
    upcoming: params.upcoming ? "d.upcoming" : "",
  };
  const allBut = (skip?: keyof typeof axis) =>
    Object.entries(axis).filter(([k, v]) => v && k !== skip).map(([, v]) => v).join(" AND ") || "true";

  const g = groupExpr(params.groupBy, p);
  const dir = params.groupDir === "desc" ? "DESC" : "ASC";
  const groupOrder = params.groupBy === "none" ? "" : `(f.group_key = '') ASC, f.group_rank ${dir}, f.group_key ${dir}, `;
  const rowOrder = sortExpr(params.sort).replace(/d\./g, "f.");
  const orderSql = `${groupOrder}${rowOrder}, f.id DESC`;

  let pageWhere: string;
  if (params.ids && params.ids.length > 0) pageWhere = "true";
  else if (params.perGroup) pageWhere = `f.rn_group <= ${p.add(params.perGroup)}`;
  else pageWhere = `f.rn > ${p.add(params.offset)} AND f.rn <= ${p.add(params.offset + params.limit)}`;

  const facetsSql = params.facets ? `,
    'facets', json_build_object(
      'accounts', (SELECT COALESCE(json_agg(json_build_object('id', x.account_id, 'name', x.account_name) ORDER BY x.account_name), '[]')
                   FROM (SELECT DISTINCT account_id, account_name FROM derived WHERE account_id IS NOT NULL AND account_name <> '') x),
      'campaigns', (SELECT COALESCE(json_agg(json_build_object('id', x.campaign_id, 'name', x.campaign_name, 'accountId', x.account_id) ORDER BY x.campaign_name), '[]')
                   FROM (SELECT DISTINCT campaign_id, campaign_name, account_id FROM derived WHERE campaign_id IS NOT NULL AND campaign_name <> '') x),
      'services', (SELECT COALESCE(json_agg(DISTINCT campaign_type), '[]') FROM derived WHERE campaign_type <> ''),
      'sources', (SELECT COALESCE(json_agg(DISTINCT source), '[]') FROM derived WHERE source <> '')
    )` : "";

  const sql = `
    WITH base AS MATERIALIZED (${baseSql(!!params.chatsOnly)} ${scopeSql}),
    derived AS MATERIALIZED (${DERIVED_SQL}),
    f0 AS MATERIALIZED (SELECT d.* FROM derived d WHERE ${base.length ? base.join(" AND ") : "true"}),
    f AS (
      SELECT x.*,
        row_number() OVER (ORDER BY ${orderSql.replace(/f\./g, "x.")}) AS rn,
        row_number() OVER (PARTITION BY x.group_key ORDER BY ${rowOrder.replace(/f\./g, "x.")}, x.id DESC) AS rn_group
      FROM (SELECT d.*, ${g.key} AS group_key, ${g.rank} AS group_rank FROM f0 d WHERE ${allBut()}) x
    )
    SELECT json_build_object(
      'total', (SELECT count(*) FROM f),
      'groups', (SELECT COALESCE(json_agg(json_build_object('key', gk.group_key, 'count', gk.n) ORDER BY gk.ord), '[]')
                 FROM (SELECT f.group_key, count(*) AS n, min(f.rn) AS ord FROM f GROUP BY f.group_key) gk),
      'rows', (SELECT COALESCE(json_agg(json_build_object(
                 'id', f.id, 'group_key', f.group_key, 'stage_key', f.stage_key, 'is_receptionist', f.is_receptionist, 'is_demo', f.is_demo,
                 'needs_reply', f.needs_reply, 'upcoming', f.upcoming, 'conversation_type', f.conv_type,
                 'campaign_type', f.campaign_type, 'chat_channel', f.chat_channel, 'channels', f.channels_eff,
                 'contact_channel', COALESCE(f.contact_channel, f.fallback_channel), 'contact_at', COALESCE(f.contact_at, f.activity_at),
                 'unread_count', f.unread, 'last_message', f.last_message, 'last_message_direction', f.last_dir,
                 'recency_at', f.recency_at
               ) ORDER BY f.rn), '[]') FROM f WHERE ${pageWhere}),
      'chatChannelCounts', (SELECT json_build_object(
                 'all', count(*) FILTER (WHERE ${allBut("chat")}),
                 'website', count(*) FILTER (WHERE ${allBut("chat")} AND d.chat_channel_eff = 'website'),
                 'whatsapp', count(*) FILTER (WHERE ${allBut("chat")} AND d.chat_channel_eff = 'whatsapp')) FROM f0 d),
      'channelCounts', (SELECT json_build_object(
                 'all', count(*) FILTER (WHERE ${allBut("channel")}),
                 'website', count(*) FILTER (WHERE ${allBut("channel")} AND 'website' = ANY(d.channels_eff)),
                 'whatsapp', count(*) FILTER (WHERE ${allBut("channel")} AND 'whatsapp' = ANY(d.channels_eff)),
                 'phone', count(*) FILTER (WHERE ${allBut("channel")} AND 'phone' = ANY(d.channels_eff))) FROM f0 d),
      'viewCounts', (SELECT json_build_object(
                 'needsReply', count(*) FILTER (WHERE ${allBut("reply")} AND d.needs_reply),
                 'upcoming', count(*) FILTER (WHERE ${allBut("upcoming")} AND d.upcoming)) FROM f0 d)
      ${facetsSql}
    ) AS result
  `;

  const { rows } = await pool.query(sql, p.values);
  const r = rows[0].result;
  return {
    rows: r.rows,
    total: Number(r.total) || 0,
    groups: (r.groups || []).map((x: any) => ({ key: x.key ?? "", count: Number(x.count) || 0 })),
    chatChannelCounts: r.chatChannelCounts,
    channelCounts: r.channelCounts,
    viewCounts: r.viewCounts,
    facets: r.facets,
  };
}
