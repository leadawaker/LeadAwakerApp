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

export const accountsStorage = {
  // ─── Accounts ───────────────────────────────────────────────────────

  async getAccounts(): Promise<Accounts[]> {
    const { voiceFileData, ...cols } = getTableColumns(accounts);
    return db.select(cols).from(accounts) as any;
  },

  async getAccountById(id: number): Promise<Accounts | undefined> {
    const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
    return row;
  },

  async createAccount(data: InsertAccounts): Promise<Accounts> {
    const [row] = await db.insert(accounts).values(data as any).returning();
    return row;
  },

  async updateAccount(id: number, data: Partial<InsertAccounts>): Promise<Accounts | undefined> {
    const [row] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    return row;
  },

  async deleteAccount(id: number): Promise<boolean> {
    const result = await db.delete(accounts).where(eq(accounts.id, id)).returning();
    return result.length > 0;
  },

  // ─── Users ──────────────────────────────────────────────────────────

  async getAppUsers(): Promise<Users[]> {
    return db.select().from(users);
  },

  async getAppUserById(id: number): Promise<Users | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row;
  },

  async getAppUserByEmail(email: string): Promise<Users | undefined> {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row;
  },

  async createAppUser(data: InsertUsers): Promise<Users> {
    const [row] = await db.insert(users).values(data as any).returning();
    return row;
  },

  async updateAppUser(id: number, data: Partial<Users>): Promise<Users | undefined> {
    const { id: _id, createdAt: _createdAt, createdBy: _createdBy, ...updateData } = data as any;
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return updated;
  },
};
