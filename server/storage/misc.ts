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

export const miscStorage = {
  // ─── Support Chat ─────────────────────────────────────────────────────

  async createSupportSession(data: InsertSupportSession): Promise<SupportSession> {
    const [row] = await db.insert(supportSessions).values(data as any).returning();
    return row;
  },

  async getActiveSupportSession(userId: number, channel = "bot"): Promise<SupportSession | undefined> {
    const [row] = await db
      .select()
      .from(supportSessions)
      .where(and(
        eq(supportSessions.userId, userId),
        eq(supportSessions.channel, channel),
        inArray(supportSessions.status, ["active", "escalated"]),
      ))
      .orderBy(desc(supportSessions.createdAt))
      .limit(1);
    return row;
  },

  async getSupportSessionBySessionId(sessionId: string): Promise<SupportSession | undefined> {
    const [row] = await db.select().from(supportSessions).where(eq(supportSessions.sessionId, sessionId));
    return row;
  },

  async updateSupportSession(id: number, data: Partial<InsertSupportSession>): Promise<SupportSession | undefined> {
    const [row] = await db.update(supportSessions).set(data as any).where(eq(supportSessions.id, id)).returning();
    return row;
  },

  async createSupportMessage(data: InsertSupportMessage): Promise<SupportMessage> {
    const [row] = await db.insert(supportMessages).values(data as any).returning();
    return row;
  },

  async getSupportMessagesBySessionId(sessionId: string): Promise<SupportMessage[]> {
    return db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.sessionId, sessionId))
      .orderBy(asc(supportMessages.createdAt));
  },

  async getFounderSessions(): Promise<SupportSession[]> {
    return db
      .select()
      .from(supportSessions)
      .where(and(
        eq(supportSessions.channel, "founder"),
        inArray(supportSessions.status, ["active", "escalated"]),
      ))
      .orderBy(desc(supportSessions.createdAt));
  },

  // ─── Gmail Sync State ──────────────────────────────────────────────────────

  async getGmailSyncState(accountEmail: string): Promise<GmailSyncState | undefined> {
    const [row] = await db.select().from(gmailSyncState).where(eq(gmailSyncState.accountEmail, accountEmail));
    return row;
  },

  async upsertGmailSyncState(data: InsertGmailSyncState): Promise<GmailSyncState> {
    const existing = await this.getGmailSyncState(data.accountEmail);
    if (existing) {
      const [row] = await db.update(gmailSyncState)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(gmailSyncState.accountEmail, data.accountEmail))
        .returning();
      return row;
    }
    const [row] = await db.insert(gmailSyncState).values(data as any).returning();
    return row;
  },

  async deleteGmailSyncState(accountEmail: string): Promise<boolean> {
    const result = await db.delete(gmailSyncState).where(eq(gmailSyncState.accountEmail, accountEmail)).returning();
    return result.length > 0;
  },
};
