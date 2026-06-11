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

export const billingStorage = {
  // ─── Invoices ──────────────────────────────────────────────────────────

  async getInvoices(): Promise<Invoices[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  },

  async getInvoiceById(id: number): Promise<Invoices | undefined> {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id));
    return row;
  },

  async getInvoicesByAccountId(accountId: number): Promise<Invoices[]> {
    return db.select().from(invoices).where(eq(invoices.accountsId, accountId)).orderBy(desc(invoices.createdAt));
  },

  async getInvoiceByViewToken(token: string): Promise<Invoices | undefined> {
    const [row] = await db.select().from(invoices).where(eq(invoices.viewToken, token));
    return row;
  },

  async getInvoiceCountByAccountId(accountId: number): Promise<number> {
    const [result] = await db.select({ total: count() }).from(invoices).where(eq(invoices.accountsId, accountId));
    return result?.total ?? 0;
  },

  async createInvoice(data: InsertInvoices): Promise<Invoices> {
    const [row] = await db.insert(invoices).values(data as any).returning();
    return row;
  },

  async updateInvoice(id: number, data: Partial<InsertInvoices>): Promise<Invoices | undefined> {
    const [row] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return row;
  },

  async deleteInvoice(id: number): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id)).returning();
    return result.length > 0;
  },

  // ─── Contracts ─────────────────────────────────────────────────────────

  async getContracts(): Promise<Contracts[]> {
    return db.select().from(contracts).orderBy(desc(contracts.createdAt));
  },

  async getContractById(id: number): Promise<Contracts | undefined> {
    const [row] = await db.select().from(contracts).where(eq(contracts.id, id));
    return row;
  },

  async getContractsByAccountId(accountId: number): Promise<Contracts[]> {
    return db.select().from(contracts).where(eq(contracts.accountsId, accountId)).orderBy(desc(contracts.createdAt));
  },

  async getContractByViewToken(token: string): Promise<Contracts | undefined> {
    const [row] = await db.select().from(contracts).where(eq(contracts.viewToken, token));
    return row;
  },

  async createContract(data: InsertContracts): Promise<Contracts> {
    const [row] = await db.insert(contracts).values(data as any).returning();
    return row;
  },

  async updateContract(id: number, data: Partial<InsertContracts>): Promise<Contracts | undefined> {
    const [row] = await db.update(contracts).set(data).where(eq(contracts.id, id)).returning();
    return row;
  },

  async deleteContract(id: number): Promise<boolean> {
    const result = await db.delete(contracts).where(eq(contracts.id, id)).returning();
    return result.length > 0;
  },

  // ─── Expenses ──────────────────────────────────────────────────────────

  async getExpenses(year?: number, quarter?: string): Promise<Expenses[]> {
    const conditions = [];
    if (year) conditions.push(eq(expenses.year, year));
    if (quarter) conditions.push(eq(expenses.quarter, quarter));
    if (conditions.length > 0) {
      return await db.select().from(expenses).where(and(...conditions)).orderBy(desc(expenses.date));
    }
    return await db.select().from(expenses).orderBy(desc(expenses.date));
  },

  async createExpense(data: InsertExpenses): Promise<Expenses> {
    const [row] = await db.insert(expenses).values(data as any).returning();
    return row;
  },

  async updateExpense(id: number, data: Partial<InsertExpenses>): Promise<Expenses | undefined> {
    const [row] = await db.update(expenses).set({ ...data, updatedAt: new Date() }).where(eq(expenses.id, id)).returning();
    return row;
  },

  async deleteExpense(id: number): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
    return result.length > 0;
  },
};
