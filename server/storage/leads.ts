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

// Safety cap for no-arg full-table fetches that feed list views / AI tools.
const MAX_UNPAGINATED_ROWS = 5000;

export const leadsStorage = {
  // ─── Leads ──────────────────────────────────────────────────────────

  async getLeads(): Promise<Leads[]> {
    // No-arg global fetch (agency/admin + AI tools). Hard-cap to avoid scanning
    // the entire table; per-account/per-campaign views use the scoped methods.
    const rows = await db.select().from(leads).limit(MAX_UNPAGINATED_ROWS);
    if (rows.length === MAX_UNPAGINATED_ROWS) {
      console.warn(`[storage] getLeads() hit ${MAX_UNPAGINATED_ROWS}-row cap; results truncated — caller should paginate`);
    }
    return rows;
  },

  async getLeadById(id: number): Promise<Leads | undefined> {
    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    return row;
  },

  async getLeadsByAccountId(accountId: number): Promise<Leads[]> {
    return db.select().from(leads).where(eq(leads.accountsId, accountId));
  },

  async getLeadsByCampaignId(campaignId: number): Promise<Leads[]> {
    return db.select().from(leads).where(eq(leads.campaignsId, campaignId));
  },

  async createLead(data: InsertLeads): Promise<Leads> {
    const [row] = await db.insert(leads).values(data as any).returning();
    return row;
  },

  async updateLead(id: number, data: Partial<InsertLeads>): Promise<Leads | undefined> {
    const [row] = await db.update(leads).set(data).where(eq(leads.id, id)).returning();
    return row;
  },

  async deleteLead(id: number): Promise<boolean> {
    const result = await db.delete(leads).where(eq(leads.id, id)).returning();
    return result.length > 0;
  },

  // ─── Tags ───────────────────────────────────────────────────────────

  async getTags(): Promise<Tags[]> {
    return db.select().from(tags);
  },

  async getTagsByAccountId(accountId: number): Promise<Tags[]> {
    return db.select().from(tags).where(eq(tags.accountsId, accountId));
  },

  async createTag(data: InsertTags): Promise<Tags> {
    const [row] = await db.insert(tags).values(data as any).returning();
    return row;
  },

  async updateTag(id: number, data: Partial<InsertTags>): Promise<Tags | undefined> {
    const [row] = await db.update(tags).set(data).where(eq(tags.id, id)).returning();
    return row;
  },

  async deleteTag(id: number): Promise<boolean> {
    const result = await db.delete(tags).where(eq(tags.id, id)).returning();
    return result.length > 0;
  },

  // ─── Leads_Tags ─────────────────────────────────────────────────────

  async getTagsByLeadId(leadId: number): Promise<Leads_Tags[]> {
    return db.select().from(leadsTags).where(and(eq(leadsTags.leadsId, leadId), isNull(leadsTags.removedAt)));
  },

  async getTagsByLeadIds(leadIds: number[]): Promise<Leads_Tags[]> {
    if (leadIds.length === 0) return [];
    return db.select().from(leadsTags).where(and(inArray(leadsTags.leadsId, leadIds), isNull(leadsTags.removedAt)));
  },

  async createLeadTag(data: InsertLeads_Tags): Promise<Leads_Tags> {
    const [row] = await db.insert(leadsTags).values(data as any).returning();
    return row;
  },

  async bulkCreateLeadTags(data: InsertLeads_Tags[]): Promise<Leads_Tags[]> {
    if (data.length === 0) return [];
    return db.insert(leadsTags).values(data as any).returning();
  },

  async deleteLeadTag(leadId: number, tagId: number): Promise<boolean> {
    const result = await db.delete(leadsTags)
      .where(and(eq(leadsTags.leadsId, leadId), eq(leadsTags.tagsId, tagId)))
      .returning();
    return result.length > 0;
  },

  async deleteAllLeadTags(leadId: number): Promise<void> {
    await db.delete(leadsTags).where(eq(leadsTags.leadsId, leadId));
  },

  // ─── Bulk Operations ──────────────────────────────────────────────────

  async bulkUpdateLeads(ids: number[], data: Partial<InsertLeads>): Promise<Leads[]> {
    if (ids.length === 0) return [];
    return db
      .update(leads)
      .set(data)
      .where(inArray(leads.id, ids))
      .returning();
  },

  // ─── Lead Score History ───────────────────────────────────────────────
  async getLeadScoreHistory(): Promise<Lead_Score_History[]> {
    return db.select().from(leadScoreHistory).orderBy(desc(leadScoreHistory.scoreDate));
  },

  async getLeadScoreHistoryByLeadId(leadId: number): Promise<Lead_Score_History[]> {
    return db
      .select()
      .from(leadScoreHistory)
      .where(eq(leadScoreHistory.leadsId, leadId))
      .orderBy(desc(leadScoreHistory.createdAt));
  },
};
