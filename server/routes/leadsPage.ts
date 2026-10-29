// GET /api/leads/page: one page of leads for the Chats and Leads pages, with
// server-side search, filters, sort, grouping and counts. The old full-list
// GET /api/leads stays as it was for every other consumer.
import type { Express, Request } from "express";
import { inArray } from "drizzle-orm";
import { requireAuth, scopeToAccount } from "../auth";
import { storage } from "../storage";
import { db } from "../db";
import { leads } from "@shared/schema";
import { toDbKeysArray } from "../dbKeys";
import { wrapAsync } from "./_helpers";
import { requestHidesTestData } from "./testDataAccess";
import { requestChatsScope } from "./leadsPageScope";
import { getLeadsPage, type LeadsPageParams, type LeadsPageSort, type LeadsPageGroup } from "../storage/leadsPage";

const SORTS: LeadsPageSort[] = [
  "recent", "latest_message", "oldest", "name_asc", "name_desc",
  "activity_desc", "activity_asc", "created_desc", "created_asc", "appointment",
];
const GROUPS: LeadsPageGroup[] = ["none", "date", "status", "campaign", "account", "service", "source", "tag", "type"];

function list(v: unknown): string[] {
  if (v == null || v === "") return [];
  const arr = Array.isArray(v) ? v : String(v).split(",");
  return arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 100);
}
function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
function flag(v: unknown): boolean {
  return v === "1" || v === "true";
}

function parseParams(req: Request): LeadsPageParams {
  const q = req.query;
  const forcedId = (req as any).forcedAccountId as number | undefined;
  const sort = SORTS.includes(q.sort as LeadsPageSort) ? (q.sort as LeadsPageSort) : "recent";
  const groupBy = GROUPS.includes(q.groupBy as LeadsPageGroup) ? (q.groupBy as LeadsPageGroup) : "none";
  const chat = String(q.chatChannel || "");
  const channel = String(q.channel || "");
  return {
    accountId: forcedId ?? num(q.accountId),
    hideTest: requestHidesTestData(req),
    limit: Math.min(num(q.limit) ?? 50, 200),
    offset: Math.max(0, Number(q.offset) || 0),
    perGroup: q.perGroup ? Math.min(num(q.perGroup) ?? 30, 200) : undefined,
    ids: list(q.ids).map(Number).filter((n) => Number.isInteger(n) && n > 0),
    search: String(q.search || "").slice(0, 120),
    sort,
    groupBy,
    groupDir: q.groupDir === "desc" ? "desc" : "asc",
    status: list(q.status),
    campaign: num(q.campaign),
    account: forcedId ? undefined : num(q.account),
    service: list(q.service),
    source: list(q.source),
    tags: list(q.tags),
    type: list(q.type),
    chatChannel: chat === "website" || chat === "whatsapp" ? chat : undefined,
    chatsOnly: flag(q.chatsOnly),
    scope: requestChatsScope(req, flag(q.chatsOnly)),
    channel: channel === "website" || channel === "whatsapp" || channel === "phone" ? channel : undefined,
    needsReply: flag(q.needsReply),
    upcoming: flag(q.upcoming),
    hasPhone: flag(q.hasPhone),
    hasEmail: flag(q.hasEmail),
    facets: flag(q.facets),
  };
}

export function registerLeadsPageRoutes(app: Express): void {
  app.get("/api/leads/page", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const params = parseParams(req);
    const result = await getLeadsPage(params);
    const ids = result.rows.map((r) => Number(r.id));

    // Full lead rows through Drizzle so the shape matches GET /api/leads exactly.
    const [full, tagRows] = ids.length
      ? await Promise.all([
          db.select().from(leads).where(inArray(leads.id, ids)),
          storage.getTagsByLeadIds(ids),
        ])
      : [[], []];
    const byId = new Map<number, any>(toDbKeysArray(full as any, leads).map((l: any) => [Number(l.id), l]));
    const tagIds = new Map<number, number[]>();
    (tagRows as any[]).forEach((row) => {
      if (row.leadsId == null || row.tagsId == null) return;
      const arr = tagIds.get(row.leadsId) ?? [];
      arr.push(row.tagsId);
      tagIds.set(row.leadsId, arr);
    });

    const data = result.rows
      .map((r) => {
        const lead = byId.get(Number(r.id));
        if (!lead) return null;
        return {
          ...lead,
          tag_ids: tagIds.get(Number(r.id)) ?? [],
          last_message: r.last_message ?? null,
          last_message_direction: r.last_message_direction ?? null,
          unread_count: Number(r.unread_count) || 0,
          last_channel: r.chat_channel ?? null,
          channels: r.channels ?? [],
          last_contact_channel: r.contact_channel ?? null,
          last_contact_at: r.contact_at ?? null,
          needs_reply: !!r.needs_reply,
          upcoming: !!r.upcoming,
          is_receptionist: !!r.is_receptionist,
          is_demo: !!r.is_demo,
          stage_key: r.stage_key,
          group_key: r.group_key ?? "",
          conversation_type: r.conversation_type,
          campaign_type: r.campaign_type || null,
          recency_at: r.recency_at ?? null,
        };
      })
      .filter(Boolean);

    res.json({
      data,
      total: result.total,
      offset: params.offset,
      limit: params.limit,
      groups: result.groups,
      chatChannelCounts: result.chatChannelCounts,
      channelCounts: result.channelCounts,
      viewCounts: result.viewCounts,
      ...(result.facets ? { facets: result.facets } : {}),
    });
  }));
}
