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

export const agentsStorage = {
  // ─── AI Agents ────────────────────────────────────────────────────────

  async getAiAgents(): Promise<AiAgent[]> {
    return db.select().from(aiAgents).where(eq(aiAgents.enabled, true)).orderBy(asc(aiAgents.displayOrder));
  },

  async getAiAgentById(id: number): Promise<AiAgent | undefined> {
    const [row] = await db.select().from(aiAgents).where(eq(aiAgents.id, id));
    return row;
  },

  async createAiAgent(data: InsertAiAgent): Promise<AiAgent> {
    const [row] = await db.insert(aiAgents).values(data as any).returning();
    return row;
  },

  async updateAiAgent(id: number, data: Partial<InsertAiAgent>): Promise<AiAgent | undefined> {
    const [row] = await db.update(aiAgents).set({ ...data, updatedAt: new Date() } as any).where(eq(aiAgents.id, id)).returning();
    return row;
  },

  // ─── AI Sessions ──────────────────────────────────────────────────────

  async createAiSession(data: InsertAiSession): Promise<AiSession> {
    const [row] = await db.insert(aiSessions).values(data as any).returning();
    return row;
  },

  async getAiSessionsByUserId(userId: number): Promise<AiSession[]> {
    return db.select().from(aiSessions).where(eq(aiSessions.userId, userId)).orderBy(desc(aiSessions.createdAt));
  },

  async getAiSessionBySessionId(sessionId: string): Promise<AiSession | undefined> {
    const [row] = await db.select().from(aiSessions).where(eq(aiSessions.sessionId, sessionId));
    return row;
  },

  async getActiveAiSessionByUserAndAgent(userId: number, agentId: number): Promise<AiSession | undefined> {
    const [row] = await db
      .select()
      .from(aiSessions)
      .where(and(eq(aiSessions.userId, userId), eq(aiSessions.agentId, agentId), eq(aiSessions.status, "active")))
      .orderBy(desc(aiSessions.createdAt))
      .limit(1);
    return row;
  },

  async updateAiSession(id: number, data: Partial<InsertAiSession>): Promise<AiSession | undefined> {
    const [row] = await db.update(aiSessions).set(data as any).where(eq(aiSessions.id, id)).returning();
    return row;
  },

  // ─── AI Messages ──────────────────────────────────────────────────────

  async createAiMessage(data: InsertAiMessage): Promise<AiMessage> {
    const [row] = await db.insert(aiMessages).values(data as any).returning();
    return row;
  },

  async getAiMessagesBySessionId(sessionId: string): Promise<AiMessage[]> {
    return db.select().from(aiMessages).where(eq(aiMessages.sessionId, sessionId)).orderBy(asc(aiMessages.createdAt));
  },

  // ─── AI Files ────────────────────────────────────────────────────────

  async createAiFile(data: InsertAiFile): Promise<AiFile> {
    const [row] = await db.insert(aiFiles).values(data as any).returning();
    return row;
  },

  async getAiFilesByConversationId(conversationId: string): Promise<AiFile[]> {
    return db.select().from(aiFiles).where(eq(aiFiles.conversationId, conversationId)).orderBy(asc(aiFiles.createdAt));
  },

  async getAiFilesByMessageId(messageId: number): Promise<AiFile[]> {
    return db.select().from(aiFiles).where(eq(aiFiles.messageId, messageId)).orderBy(asc(aiFiles.createdAt));
  },
};
