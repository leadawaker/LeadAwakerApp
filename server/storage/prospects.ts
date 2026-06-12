import { eq, desc, asc, count, sum, SQL, inArray, and, or, ilike, gte, lt, isNotNull, isNull, getTableColumns, sql } from "drizzle-orm";
import { PgTableWithColumns } from "drizzle-orm/pg-core";
import { db, pool } from "../db";
import {
  accounts,
  prospects,
  campaigns,
  leads,
  interactions,
  tags,
  leadsTags,
  automationLogs,
  users,
  promptLibrary,
  promptVersions,
  leadScoreHistory,
  campaignMetricsHistory,
  invoices,
  contracts,
  expenses,
  notifications,
  type Accounts,
  type InsertAccounts,
  type Prospects,
  type InsertProspects,
  insertProspectsSchema,
  type Campaigns,
  type InsertCampaigns,
  type Leads,
  type InsertLeads,
  type Interactions,
  type InsertInteractions,
  type Tags,
  type InsertTags,
  type Leads_Tags,
  type InsertLeads_Tags,
  type Automation_Logs,
  type Users,
  type InsertUsers,
  type Prompt_Library,
  type InsertPrompt_Library,
  type Prompt_Version,
  type InsertPrompt_Version,
  type Lead_Score_History,
  type Campaign_Metrics_History,
  type Invoices,
  type InsertInvoices,
  type Contracts,
  type InsertContracts,
  type Expenses,
  type InsertExpenses,
  type Notifications,
  type InsertNotifications,
  supportSessions,
  supportMessages,
  type SupportSession,
  type InsertSupportSession,
  type SupportMessage,
  type InsertSupportMessage,
  tasks,
  type Task,
  type InsertTask,
  insertTaskSchema,
  aiAgents,
  aiSessions,
  aiMessages,
  aiFiles,
  type AiAgent,
  type InsertAiAgent,
  type AiSession,
  type InsertAiSession,
  type AiMessage,
  type InsertAiMessage,
  type AiFile,
  type InsertAiFile,
  notificationPreferences,
  pushSubscriptions,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type PushSubscriptionRow,
  type InsertPushSubscription,
  taskSubtasks,
  type TaskSubtask,
  type InsertTaskSubtask,
  taskCategories,
  type TaskCategory,
  type InsertTaskCategory,
  taskComments,
  taskAttachments,
  taskActivity,
  type TaskComment,
  type InsertTaskComment,
  type TaskAttachment,
  type InsertTaskAttachment,
  type TaskActivity,
  type InsertTaskActivity,
  outreachTemplates,
  type OutreachTemplate,
  type InsertOutreachTemplate,
  gmailSyncState,
  type GmailSyncState,
  type InsertGmailSyncState,
} from "@shared/schema";

import type { NotificationItem, ProspectsListParams } from "./types";

export const prospectsStorage = {
  // ─── Prospects ──────────────────────────────────────────────────────

  async getProspectsPaginated(params: ProspectsListParams): Promise<{ items: Prospects[]; total: number; hasMore: boolean }> {
    const conditions: SQL[] = [];

    // Filters (IN clauses for array filters, skip empty arrays)
    if (params.niche && params.niche.length > 0) conditions.push(inArray(prospects.niche, params.niche));
    if (params.status && params.status.length > 0) conditions.push(inArray(prospects.status, params.status));
    if (params.country && params.country.length > 0) conditions.push(inArray(prospects.country, params.country));
    if (params.priority && params.priority.length > 0) conditions.push(inArray(prospects.priority, params.priority));
    if (params.source && params.source.length > 0) conditions.push(inArray(prospects.source, params.source));

    // Search: ILIKE across name, company, email, contact_name
    if (params.search && params.search.trim()) {
      const s = `%${params.search.trim()}%`;
      const searchCond = or(
        ilike(prospects.name, s),
        ilike(prospects.company, s),
        ilike(prospects.email, s),
        ilike(prospects.contactName, s),
      );
      if (searchCond) conditions.push(searchCond);
    }

    // Overdue: next_follow_up_date < now()
    if (params.overdue) {
      conditions.push(lt(prospects.nextFollowUpDate, new Date()));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Sort column whitelist
    const dir = params.groupDirection === "desc" ? desc : asc;
    const orderBy: SQL[] = [];

    // Group-by column leads the sort
    switch (params.groupBy) {
      case "status": orderBy.push(dir(prospects.status)); break;
      case "niche": orderBy.push(dir(prospects.niche)); break;
      case "country": orderBy.push(dir(prospects.country)); break;
      case "priority": orderBy.push(dir(prospects.priority)); break;
      case "outreach_status": orderBy.push(dir(prospects.outreachStatus)); break;
      default: break;
    }

    // Then the user-selected sort
    switch (params.sortBy) {
      case "name_asc": orderBy.push(asc(prospects.name)); break;
      case "name_desc": orderBy.push(desc(prospects.name)); break;
      case "priority": orderBy.push(desc(prospects.priority)); break;
      case "recent":
      default:
        orderBy.push(desc(prospects.updatedAt), desc(prospects.createdAt));
        break;
    }

    // Count
    const countQuery = db
      .select({ c: count() })
      .from(prospects)
      .where(whereClause as any);
    const [{ c: total }] = await countQuery;

    // Items
    const baseQuery = db.select().from(prospects).where(whereClause as any).orderBy(...orderBy);

    if (params.all) {
      const items = await baseQuery;
      return { items, total, hasMore: false };
    }

    const limit = Math.min(Math.max(1, params.limit ?? 100), 200);
    const offset = Math.max(0, params.offset ?? 0);
    const items = await baseQuery.limit(limit).offset(offset);
    return { items, total, hasMore: offset + items.length < total };
  },

  async getProspectsByIds(ids: number[]): Promise<Prospects[]> {
    if (ids.length === 0) return [];
    return db.select().from(prospects).where(inArray(prospects.id, ids));
  },

  async getProspectsFilterOptions(): Promise<{ niches: string[]; countries: string[]; sources: string[] }> {
    const niches = await db.selectDistinct({ v: prospects.niche }).from(prospects).where(isNotNull(prospects.niche));
    const countries = await db.selectDistinct({ v: prospects.country }).from(prospects).where(isNotNull(prospects.country));
    const sources = await db.selectDistinct({ v: prospects.source }).from(prospects).where(isNotNull(prospects.source));
    const clean = (rows: { v: string | null }[]) => rows.map(r => r.v).filter((v): v is string => !!v && v.trim() !== "").sort();
    return { niches: clean(niches), countries: clean(countries), sources: clean(sources) };
  },

  async getProspectById(id: number): Promise<Prospects | undefined> {
    const [row] = await db.select().from(prospects).where(eq(prospects.id, id));
    return row;
  },

  async createProspect(data: InsertProspects): Promise<Prospects> {
    const [row] = await db.insert(prospects).values(data as any).returning();
    return row;
  },

  async updateProspect(id: number, data: Partial<InsertProspects>): Promise<Prospects | undefined> {
    const [row] = await db.update(prospects).set(data).where(eq(prospects.id, id)).returning();
    return row;
  },

  async deleteProspect(id: number): Promise<boolean> {
    const result = await db.delete(prospects).where(eq(prospects.id, id)).returning();
    return result.length > 0;
  },

  // ─── Outreach Templates ────────────────────────────────────────────

  async getOutreachTemplates(): Promise<OutreachTemplate[]> {
    return db.select().from(outreachTemplates).orderBy(desc(outreachTemplates.createdAt));
  },

  async getOutreachTemplateById(id: number): Promise<OutreachTemplate | undefined> {
    const [row] = await db.select().from(outreachTemplates).where(eq(outreachTemplates.id, id));
    return row;
  },

  async createOutreachTemplate(data: InsertOutreachTemplate): Promise<OutreachTemplate> {
    const [row] = await db.insert(outreachTemplates).values(data as any).returning();
    return row;
  },

  async updateOutreachTemplate(id: number, data: Partial<InsertOutreachTemplate>): Promise<OutreachTemplate | undefined> {
    const [row] = await db.update(outreachTemplates).set(data).where(eq(outreachTemplates.id, id)).returning();
    return row;
  },

  async deleteOutreachTemplate(id: number): Promise<boolean> {
    const result = await db.delete(outreachTemplates).where(eq(outreachTemplates.id, id)).returning();
    return result.length > 0;
  },
};
