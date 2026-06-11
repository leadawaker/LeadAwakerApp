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

export const campaignsStorage = {
  // ─── Campaigns ──────────────────────────────────────────────────────

  async getCampaigns(): Promise<Campaigns[]> {
    return db.select().from(campaigns);
  },

  async getCampaignById(id: number): Promise<Campaigns | undefined> {
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return row;
  },

  async getCampaignsByAccountId(accountId: number): Promise<Campaigns[]> {
    return db.select().from(campaigns).where(eq(campaigns.accountsId, accountId));
  },

  async createCampaign(data: InsertCampaigns): Promise<Campaigns> {
    const [row] = await db.insert(campaigns).values(data as any).returning();
    return row;
  },

  async updateCampaign(id: number, data: Partial<InsertCampaigns>): Promise<Campaigns | undefined> {
    const [row] = await db.update(campaigns).set(data).where(eq(campaigns.id, id)).returning();
    return row;
  },

  async deleteCampaign(id: number): Promise<boolean> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
    return result.length > 0;
  },

  // ─── Prompt Library ─────────────────────────────────────────────────

  async getPrompts(): Promise<Prompt_Library[]> {
    return db.select().from(promptLibrary);
  },

  async getPromptById(id: number): Promise<Prompt_Library | undefined> {
    const [row] = await db.select().from(promptLibrary).where(eq(promptLibrary.id, id)).limit(1);
    return row;
  },

  async getPromptsByAccountId(accountId: number): Promise<Prompt_Library[]> {
    return db.select().from(promptLibrary).where(eq(promptLibrary.accountsId, accountId));
  },

  async getPromptByUseCase(useCase: string): Promise<Prompt_Library | undefined> {
    const [row] = await db.select().from(promptLibrary).where(eq(promptLibrary.useCase, useCase)).limit(1);
    return row;
  },

  async createPrompt(data: InsertPrompt_Library): Promise<Prompt_Library> {
    const [row] = await db.insert(promptLibrary).values(data as any).returning();
    return row;
  },

  async updatePrompt(id: number, data: Partial<InsertPrompt_Library>): Promise<Prompt_Library | undefined> {
    const [row] = await db.update(promptLibrary).set({ ...data, updatedAt: new Date() } as any).where(eq(promptLibrary.id, id)).returning();
    return row;
  },

  async deletePrompt(id: number): Promise<boolean> {
    const rows = await db.delete(promptLibrary).where(eq(promptLibrary.id, id)).returning();
    return rows.length > 0;
  },

  async deletePromptsByCampaignId(campaignId: number): Promise<number> {
    const rows = await db.delete(promptLibrary)
      .where(eq(promptLibrary.campaignsId, campaignId))
      .returning();
    return rows.length;
  },

  // ─── Prompt Versions ─────────────────────────────────────────────────

  async getPromptVersions(promptId: number): Promise<Prompt_Version[]> {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    await db.delete(promptVersions)
      .where(and(eq(promptVersions.promptsId, promptId), lt(promptVersions.savedAt, oneMonthAgo)));
    return db.select().from(promptVersions)
      .where(eq(promptVersions.promptsId, promptId))
      .orderBy(desc(promptVersions.savedAt));
  },

  async getLatestPromptVersion(promptId: number): Promise<Prompt_Version | undefined> {
    const [row] = await db.select().from(promptVersions)
      .where(eq(promptVersions.promptsId, promptId))
      .orderBy(desc(promptVersions.savedAt))
      .limit(1);
    return row;
  },

  async createPromptVersion(data: InsertPrompt_Version): Promise<Prompt_Version> {
    const [row] = await db.insert(promptVersions).values(data as any).returning();
    return row;
  },

  async deletePromptVersion(id: number): Promise<boolean> {
    const [row] = await db.delete(promptVersions).where(eq(promptVersions.id, id)).returning();
    return !!row;
  },

  // ─── Campaign Metrics History ─────────────────────────────────────────
  async getCampaignMetricsHistory(): Promise<Campaign_Metrics_History[]> {
    return db.select().from(campaignMetricsHistory).orderBy(desc(campaignMetricsHistory.metricDate));
  },

  async getCampaignMetricsHistoryByCampaignId(campaignId: number): Promise<Campaign_Metrics_History[]> {
    return db
      .select()
      .from(campaignMetricsHistory)
      .where(eq(campaignMetricsHistory.campaignsId, campaignId))
      .orderBy(desc(campaignMetricsHistory.metricDate));
  },

  async createCampaignMetricsHistory(data: any): Promise<Campaign_Metrics_History> {
    const [row] = await db.insert(campaignMetricsHistory).values(data as any).returning();
    return row;
  },
};
