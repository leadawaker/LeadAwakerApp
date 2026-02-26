import { eq, desc, asc, count, SQL, inArray, and, gte, isNotNull } from "drizzle-orm";
import { PgTableWithColumns } from "drizzle-orm/pg-core";
import { db } from "./db";
import {
  accounts,
  campaigns,
  leads,
  interactions,
  tags,
  leadsTags,
  automationLogs,
  users,
  promptLibrary,
  leadScoreHistory,
  campaignMetricsHistory,
  invoices,
  contracts,
  expenses,
  notifications,
  type Accounts,
  type InsertAccounts,
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
} from "@shared/schema";


export interface NotificationItem {
  id: string;
  type: 'inbound' | 'booking' | 'error';
  title: string;
  description: string;
  at: string; // ISO date string
  leadId?: number;
}

export interface IStorage {
  // Accounts
  getAccounts(): Promise<Accounts[]>;
  getAccountById(id: number): Promise<Accounts | undefined>;
  createAccount(data: InsertAccounts): Promise<Accounts>;
  updateAccount(id: number, data: Partial<InsertAccounts>): Promise<Accounts | undefined>;
  deleteAccount(id: number): Promise<boolean>;

  // Campaigns
  getCampaigns(): Promise<Campaigns[]>;
  getCampaignById(id: number): Promise<Campaigns | undefined>;
  getCampaignsByAccountId(accountId: number): Promise<Campaigns[]>;
  createCampaign(data: InsertCampaigns): Promise<Campaigns>;
  updateCampaign(id: number, data: Partial<InsertCampaigns>): Promise<Campaigns | undefined>;
  deleteCampaign(id: number): Promise<boolean>;

  // Leads
  getLeads(): Promise<Leads[]>;
  getLeadById(id: number): Promise<Leads | undefined>;
  getLeadsByAccountId(accountId: number): Promise<Leads[]>;
  getLeadsByCampaignId(campaignId: number): Promise<Leads[]>;
  createLead(data: InsertLeads): Promise<Leads>;
  updateLead(id: number, data: Partial<InsertLeads>): Promise<Leads | undefined>;
  deleteLead(id: number): Promise<boolean>;

  // Interactions
  getInteractions(): Promise<Interactions[]>;
  getInteractionsByLeadId(leadId: number): Promise<Interactions[]>;
  getInteractionsByAccountId(accountId: number): Promise<Interactions[]>;
  createInteraction(data: InsertInteractions): Promise<Interactions>;

  // Tags
  getTags(): Promise<Tags[]>;
  getTagsByAccountId(accountId: number): Promise<Tags[]>;
  createTag(data: InsertTags): Promise<Tags>;
  updateTag(id: number, data: Partial<InsertTags>): Promise<Tags | undefined>;
  deleteTag(id: number): Promise<boolean>;

  // Leads_Tags
  getTagsByLeadId(leadId: number): Promise<Leads_Tags[]>;
  getTagsByLeadIds(leadIds: number[]): Promise<Leads_Tags[]>;
  createLeadTag(data: InsertLeads_Tags): Promise<Leads_Tags>;
  bulkCreateLeadTags(data: InsertLeads_Tags[]): Promise<Leads_Tags[]>;
  deleteLeadTag(leadId: number, tagId: number): Promise<boolean>;

  // Bulk operations
  bulkUpdateLeads(ids: number[], data: Partial<InsertLeads>): Promise<Leads[]>;

  // Automation Logs
  getAutomationLogs(): Promise<Automation_Logs[]>;
  getAutomationLogsByAccountId(accountId: number): Promise<Automation_Logs[]>;
  getRecentNotifications(accountId?: number, limit?: number): Promise<NotificationItem[]>;

  // Users
  getAppUsers(): Promise<Users[]>;
  getAppUserById(id: number): Promise<Users | undefined>;
  getAppUserByEmail(email: string): Promise<Users | undefined>;
  createAppUser(data: InsertUsers): Promise<Users>;
  updateAppUser(id: number, data: Partial<Users>): Promise<Users | undefined>;

  // Prompt Library
  getPrompts(): Promise<Prompt_Library[]>;
  getPromptsByAccountId(accountId: number): Promise<Prompt_Library[]>;
  createPrompt(data: InsertPrompt_Library): Promise<Prompt_Library>;
  updatePrompt(id: number, data: Partial<InsertPrompt_Library>): Promise<Prompt_Library | undefined>;
  deletePrompt(id: number): Promise<boolean>;

  // Lead Score History
  getLeadScoreHistory(): Promise<Lead_Score_History[]>;
  getLeadScoreHistoryByLeadId(leadId: number): Promise<Lead_Score_History[]>;

  // Campaign Metrics History
  getCampaignMetricsHistory(): Promise<Campaign_Metrics_History[]>;
  getCampaignMetricsHistoryByCampaignId(campaignId: number): Promise<Campaign_Metrics_History[]>;

  // Invoices
  getInvoices(): Promise<Invoices[]>;
  getInvoiceById(id: number): Promise<Invoices | undefined>;
  getInvoicesByAccountId(accountId: number): Promise<Invoices[]>;
  getInvoiceByViewToken(token: string): Promise<Invoices | undefined>;
  getInvoiceCountByAccountId(accountId: number): Promise<number>;
  createInvoice(data: InsertInvoices): Promise<Invoices>;
  updateInvoice(id: number, data: Partial<InsertInvoices>): Promise<Invoices | undefined>;
  deleteInvoice(id: number): Promise<boolean>;

  // Contracts
  getContracts(): Promise<Contracts[]>;
  getContractById(id: number): Promise<Contracts | undefined>;
  getContractsByAccountId(accountId: number): Promise<Contracts[]>;
  getContractByViewToken(token: string): Promise<Contracts | undefined>;
  createContract(data: InsertContracts): Promise<Contracts>;
  updateContract(id: number, data: Partial<InsertContracts>): Promise<Contracts | undefined>;
  deleteContract(id: number): Promise<boolean>;

  // Expenses
  getExpenses(year?: number, quarter?: string): Promise<Expenses[]>;
  createExpense(data: InsertExpenses): Promise<Expenses>;
  updateExpense(id: number, data: Partial<InsertExpenses>): Promise<Expenses | undefined>;
  deleteExpense(id: number): Promise<boolean>;

  // Notifications
  getNotificationsByUserId(userId: number, opts?: { limit?: number; offset?: number; unreadOnly?: boolean }): Promise<Notifications[]>;
  getNotificationById(id: number): Promise<Notifications | undefined>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  getTotalNotificationCount(userId: number): Promise<number>;
  createNotification(data: InsertNotifications): Promise<Notifications>;
  updateNotification(id: number, data: Partial<InsertNotifications>): Promise<Notifications | undefined>;
  markAllNotificationsRead(userId: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // ─── Accounts ───────────────────────────────────────────────────────

  async getAccounts(): Promise<Accounts[]> {
    return db.select().from(accounts);
  }

  async getAccountById(id: number): Promise<Accounts | undefined> {
    const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
    return row;
  }

  async createAccount(data: InsertAccounts): Promise<Accounts> {
    const [row] = await db.insert(accounts).values(data as any).returning();
    return row;
  }

  async updateAccount(id: number, data: Partial<InsertAccounts>): Promise<Accounts | undefined> {
    const [row] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    return row;
  }

  async deleteAccount(id: number): Promise<boolean> {
    const result = await db.delete(accounts).where(eq(accounts.id, id)).returning();
    return result.length > 0;
  }

  // ─── Campaigns ──────────────────────────────────────────────────────

  async getCampaigns(): Promise<Campaigns[]> {
    return db.select().from(campaigns);
  }

  async getCampaignById(id: number): Promise<Campaigns | undefined> {
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return row;
  }

  async getCampaignsByAccountId(accountId: number): Promise<Campaigns[]> {
    return db.select().from(campaigns).where(eq(campaigns.accountsId, accountId));
  }

  async createCampaign(data: InsertCampaigns): Promise<Campaigns> {
    const [row] = await db.insert(campaigns).values(data as any).returning();
    return row;
  }

  async updateCampaign(id: number, data: Partial<InsertCampaigns>): Promise<Campaigns | undefined> {
    const [row] = await db.update(campaigns).set(data).where(eq(campaigns.id, id)).returning();
    return row;
  }

  async deleteCampaign(id: number): Promise<boolean> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
    return result.length > 0;
  }

  // ─── Leads ──────────────────────────────────────────────────────────

  async getLeads(): Promise<Leads[]> {
    return db.select().from(leads);
  }

  async getLeadById(id: number): Promise<Leads | undefined> {
    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    return row;
  }

  async getLeadsByAccountId(accountId: number): Promise<Leads[]> {
    return db.select().from(leads).where(eq(leads.accountsId, accountId));
  }

  async getLeadsByCampaignId(campaignId: number): Promise<Leads[]> {
    return db.select().from(leads).where(eq(leads.campaignsId, campaignId));
  }

  async createLead(data: InsertLeads): Promise<Leads> {
    const [row] = await db.insert(leads).values(data as any).returning();
    return row;
  }

  async updateLead(id: number, data: Partial<InsertLeads>): Promise<Leads | undefined> {
    const [row] = await db.update(leads).set(data).where(eq(leads.id, id)).returning();
    return row;
  }

  async deleteLead(id: number): Promise<boolean> {
    const result = await db.delete(leads).where(eq(leads.id, id)).returning();
    return result.length > 0;
  }

  // ─── Interactions ───────────────────────────────────────────────────

  async getInteractions(): Promise<Interactions[]> {
    return db.select().from(interactions).orderBy(desc(interactions.createdAt));
  }

  async getInteractionsByLeadId(leadId: number): Promise<Interactions[]> {
    return db
      .select()
      .from(interactions)
      .where(eq(interactions.leadsId, leadId))
      .orderBy(desc(interactions.createdAt));
  }

  async getInteractionsByAccountId(accountId: number): Promise<Interactions[]> {
    return db
      .select()
      .from(interactions)
      .where(eq(interactions.accountsId, accountId))
      .orderBy(desc(interactions.createdAt));
  }

  async createInteraction(data: InsertInteractions): Promise<Interactions> {
    const [row] = await db.insert(interactions).values(data as any).returning();
    return row;
  }

  // ─── Tags ───────────────────────────────────────────────────────────

  async getTags(): Promise<Tags[]> {
    return db.select().from(tags);
  }

  async getTagsByAccountId(accountId: number): Promise<Tags[]> {
    return db.select().from(tags).where(eq(tags.accountsId, accountId));
  }

  async createTag(data: InsertTags): Promise<Tags> {
    const [row] = await db.insert(tags).values(data as any).returning();
    return row;
  }

  async updateTag(id: number, data: Partial<InsertTags>): Promise<Tags | undefined> {
    const [row] = await db.update(tags).set(data).where(eq(tags.id, id)).returning();
    return row;
  }

  async deleteTag(id: number): Promise<boolean> {
    const result = await db.delete(tags).where(eq(tags.id, id)).returning();
    return result.length > 0;
  }

  // ─── Leads_Tags ─────────────────────────────────────────────────────

  async getTagsByLeadId(leadId: number): Promise<Leads_Tags[]> {
    return db.select().from(leadsTags).where(eq(leadsTags.leadsId, leadId));
  }

  async getTagsByLeadIds(leadIds: number[]): Promise<Leads_Tags[]> {
    if (leadIds.length === 0) return [];
    return db.select().from(leadsTags).where(inArray(leadsTags.leadsId, leadIds));
  }

  async createLeadTag(data: InsertLeads_Tags): Promise<Leads_Tags> {
    const [row] = await db.insert(leadsTags).values(data as any).returning();
    return row;
  }

  async bulkCreateLeadTags(data: InsertLeads_Tags[]): Promise<Leads_Tags[]> {
    if (data.length === 0) return [];
    return db.insert(leadsTags).values(data as any).returning();
  }

  async deleteLeadTag(leadId: number, tagId: number): Promise<boolean> {
    const result = await db.delete(leadsTags)
      .where(and(eq(leadsTags.leadsId, leadId), eq(leadsTags.tagsId, tagId)))
      .returning();
    return result.length > 0;
  }

  // ─── Bulk Operations ──────────────────────────────────────────────────

  async bulkUpdateLeads(ids: number[], data: Partial<InsertLeads>): Promise<Leads[]> {
    if (ids.length === 0) return [];
    return db
      .update(leads)
      .set(data)
      .where(inArray(leads.id, ids))
      .returning();
  }

  // ─── Automation Logs ────────────────────────────────────────────────

  async getAutomationLogs(): Promise<Automation_Logs[]> {
    return db.select().from(automationLogs).orderBy(desc(automationLogs.createdAt));
  }

  async getAutomationLogsByAccountId(accountId: number): Promise<Automation_Logs[]> {
    return db
      .select()
      .from(automationLogs)
      .where(eq(automationLogs.accountsId, accountId))
      .orderBy(desc(automationLogs.createdAt));
  }

  // ─── Notifications ──────────────────────────────────────────────────

  async getRecentNotifications(accountId?: number, limit = 20): Promise<NotificationItem[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Inbound interactions (last 7 days)
    const interactionRows = accountId
      ? await db.select().from(interactions)
          .where(and(eq(interactions.accountsId, accountId), eq(interactions.direction, 'inbound'), gte(interactions.createdAt, sevenDaysAgo)))
          .orderBy(desc(interactions.createdAt))
          .limit(20)
      : await db.select().from(interactions)
          .where(and(eq(interactions.direction, 'inbound'), gte(interactions.createdAt, sevenDaysAgo)))
          .orderBy(desc(interactions.createdAt))
          .limit(20);
    const inboundNotifs: NotificationItem[] = interactionRows.map(r => ({
      id: `i-${r.id}`,
      type: 'inbound',
      title: 'New inbound reply',
      description: r.content ? r.content.substring(0, 80) : 'Lead sent a message',
      at: r.createdAt?.toISOString() ?? new Date().toISOString(),
      leadId: r.leadsId ?? undefined,
    }));

    // 2. Booked calls (last 7 days)
    const bookedLeads = accountId
      ? await db.select().from(leads)
          .where(and(eq(leads.accountsId, accountId), isNotNull(leads.bookedCallDate), gte(leads.bookedCallDate, sevenDaysAgo)))
          .orderBy(desc(leads.bookedCallDate))
          .limit(10)
      : await db.select().from(leads)
          .where(and(isNotNull(leads.bookedCallDate), gte(leads.bookedCallDate, sevenDaysAgo)))
          .orderBy(desc(leads.bookedCallDate))
          .limit(10);
    const bookingNotifs: NotificationItem[] = bookedLeads.map(l => ({
      id: `b-${l.id}`,
      type: 'booking',
      title: 'Call booked',
      description: `${[l.firstName, l.lastName].filter(Boolean).join(' ') || 'A lead'} booked a call`,
      at: l.bookedCallDate?.toISOString() ?? new Date().toISOString(),
      leadId: l.id ?? undefined,
    }));

    // 3. Automation errors (last 7 days)
    const errorLogs = accountId
      ? await db.select().from(automationLogs)
          .where(and(eq(automationLogs.accountsId, accountId), eq(automationLogs.status, 'error'), gte(automationLogs.createdAt, sevenDaysAgo)))
          .orderBy(desc(automationLogs.createdAt))
          .limit(10)
      : await db.select().from(automationLogs)
          .where(and(eq(automationLogs.status, 'error'), gte(automationLogs.createdAt, sevenDaysAgo)))
          .orderBy(desc(automationLogs.createdAt))
          .limit(10);
    const errorNotifs: NotificationItem[] = errorLogs.map(l => ({
      id: `a-${l.id}`,
      type: 'error',
      title: 'Automation error',
      description: `${l.workflowName || 'Workflow'} failed${l.leadName ? ` for ${l.leadName}` : ''}`,
      at: l.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    // merge + sort + limit
    return [...inboundNotifs, ...bookingNotifs, ...errorNotifs]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit);
  }

  // ─── Users ──────────────────────────────────────────────────────────

  async getAppUsers(): Promise<Users[]> {
    return db.select().from(users);
  }

  async getAppUserById(id: number): Promise<Users | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row;
  }

  async getAppUserByEmail(email: string): Promise<Users | undefined> {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row;
  }

  async createAppUser(data: InsertUsers): Promise<Users> {
    const [row] = await db.insert(users).values(data as any).returning();
    return row;
  }

  async updateAppUser(id: number, data: Partial<Users>): Promise<Users | undefined> {
    const { id: _id, createdAt: _createdAt, createdBy: _createdBy, ...updateData } = data as any;
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return updated;
  }

  // ─── Prompt Library ─────────────────────────────────────────────────

  async getPrompts(): Promise<Prompt_Library[]> {
    return db.select().from(promptLibrary);
  }

  async getPromptsByAccountId(accountId: number): Promise<Prompt_Library[]> {
    return db.select().from(promptLibrary).where(eq(promptLibrary.accountsId, accountId));
  }

  async createPrompt(data: InsertPrompt_Library): Promise<Prompt_Library> {
    const [row] = await db.insert(promptLibrary).values(data as any).returning();
    return row;
  }

  async updatePrompt(id: number, data: Partial<InsertPrompt_Library>): Promise<Prompt_Library | undefined> {
    const [row] = await db.update(promptLibrary).set(data as any).where(eq(promptLibrary.id, id)).returning();
    return row;
  }

  async deletePrompt(id: number): Promise<boolean> {
    const rows = await db.delete(promptLibrary).where(eq(promptLibrary.id, id)).returning();
    return rows.length > 0;
  }

  // ─── Lead Score History ───────────────────────────────────────────────
  async getLeadScoreHistory(): Promise<Lead_Score_History[]> {
    return db.select().from(leadScoreHistory).orderBy(desc(leadScoreHistory.scoreDate));
  }

  async getLeadScoreHistoryByLeadId(leadId: number): Promise<Lead_Score_History[]> {
    return db
      .select()
      .from(leadScoreHistory)
      .where(eq(leadScoreHistory.leadsId, leadId))
      .orderBy(desc(leadScoreHistory.scoreDate));
  }

  // ─── Campaign Metrics History ─────────────────────────────────────────
  async getCampaignMetricsHistory(): Promise<Campaign_Metrics_History[]> {
    return db.select().from(campaignMetricsHistory).orderBy(desc(campaignMetricsHistory.metricDate));
  }

  async getCampaignMetricsHistoryByCampaignId(campaignId: number): Promise<Campaign_Metrics_History[]> {
    return db
      .select()
      .from(campaignMetricsHistory)
      .where(eq(campaignMetricsHistory.campaignsId, campaignId))
      .orderBy(desc(campaignMetricsHistory.metricDate));
  }

  async createCampaignMetricsHistory(data: any): Promise<Campaign_Metrics_History> {
    const [row] = await db.insert(campaignMetricsHistory).values(data as any).returning();
    return row;
  }

  // ─── Invoices ──────────────────────────────────────────────────────────

  async getInvoices(): Promise<Invoices[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoiceById(id: number): Promise<Invoices | undefined> {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id));
    return row;
  }

  async getInvoicesByAccountId(accountId: number): Promise<Invoices[]> {
    return db.select().from(invoices).where(eq(invoices.accountsId, accountId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoiceByViewToken(token: string): Promise<Invoices | undefined> {
    const [row] = await db.select().from(invoices).where(eq(invoices.viewToken, token));
    return row;
  }

  async getInvoiceCountByAccountId(accountId: number): Promise<number> {
    const [result] = await db.select({ total: count() }).from(invoices).where(eq(invoices.accountsId, accountId));
    return result?.total ?? 0;
  }

  async createInvoice(data: InsertInvoices): Promise<Invoices> {
    const [row] = await db.insert(invoices).values(data as any).returning();
    return row;
  }

  async updateInvoice(id: number, data: Partial<InsertInvoices>): Promise<Invoices | undefined> {
    const [row] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return row;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id)).returning();
    return result.length > 0;
  }

  // ─── Contracts ─────────────────────────────────────────────────────────

  async getContracts(): Promise<Contracts[]> {
    return db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }

  async getContractById(id: number): Promise<Contracts | undefined> {
    const [row] = await db.select().from(contracts).where(eq(contracts.id, id));
    return row;
  }

  async getContractsByAccountId(accountId: number): Promise<Contracts[]> {
    return db.select().from(contracts).where(eq(contracts.accountsId, accountId)).orderBy(desc(contracts.createdAt));
  }

  async getContractByViewToken(token: string): Promise<Contracts | undefined> {
    const [row] = await db.select().from(contracts).where(eq(contracts.viewToken, token));
    return row;
  }

  async createContract(data: InsertContracts): Promise<Contracts> {
    const [row] = await db.insert(contracts).values(data as any).returning();
    return row;
  }

  async updateContract(id: number, data: Partial<InsertContracts>): Promise<Contracts | undefined> {
    const [row] = await db.update(contracts).set(data).where(eq(contracts.id, id)).returning();
    return row;
  }

  async deleteContract(id: number): Promise<boolean> {
    const result = await db.delete(contracts).where(eq(contracts.id, id)).returning();
    return result.length > 0;
  }

  // ─── Expenses ──────────────────────────────────────────────────────────

  async getExpenses(year?: number, quarter?: string): Promise<Expenses[]> {
    const conditions = [];
    if (year) conditions.push(eq(expenses.year, year));
    if (quarter) conditions.push(eq(expenses.quarter, quarter));
    if (conditions.length > 0) {
      return await db.select().from(expenses).where(and(...conditions)).orderBy(desc(expenses.date));
    }
    return await db.select().from(expenses).orderBy(desc(expenses.date));
  }

  async createExpense(data: InsertExpenses): Promise<Expenses> {
    const [row] = await db.insert(expenses).values(data as any).returning();
    return row;
  }

  async updateExpense(id: number, data: Partial<InsertExpenses>): Promise<Expenses | undefined> {
    const [row] = await db.update(expenses).set({ ...data, updatedAt: new Date() }).where(eq(expenses.id, id)).returning();
    return row;
  }

  async deleteExpense(id: number): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
    return result.length > 0;
  }

  // ─── Notifications ──────────────────────────────────────────────────────

  async getNotificationsByUserId(userId: number, opts?: { limit?: number; offset?: number; unreadOnly?: boolean }): Promise<Notifications[]> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const conditions = [eq(notifications.userId, userId)];
    if (opts?.unreadOnly) {
      conditions.push(eq(notifications.read, false));
    }
    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getNotificationById(id: number): Promise<Notifications | undefined> {
    const [row] = await db.select().from(notifications).where(eq(notifications.id, id));
    return row;
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result?.total ?? 0;
  }

  async getTotalNotificationCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId));
    return result?.total ?? 0;
  }

  async createNotification(data: InsertNotifications): Promise<Notifications> {
    const [row] = await db.insert(notifications).values(data as any).returning();
    return row;
  }

  async updateNotification(id: number, data: Partial<InsertNotifications>): Promise<Notifications | undefined> {
    const [row] = await db.update(notifications).set(data as any).where(eq(notifications.id, id)).returning();
    return row;
  }

  async markAllNotificationsRead(userId: number): Promise<number> {
    const rows = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .returning({ id: notifications.id });
    return rows.length;
  }
}

// ─── Pagination helpers ───────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Generic paginated query. Works with any Drizzle table.
 * Pass an optional `where` clause to filter.
 */
export async function paginatedQuery<T>(
  table: any,
  params: PaginationParams,
  where?: SQL,
): Promise<PaginatedResult<T>> {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  // Count total and fetch page in parallel — both queries are independent
  let countQuery = db.select({ total: count() }).from(table);
  if (where) countQuery = countQuery.where(where) as any;

  let dataQuery = db.select().from(table);
  if (where) dataQuery = dataQuery.where(where) as any;
  dataQuery = dataQuery.limit(limit).offset(offset) as any;

  const [[{ total }], data] = await Promise.all([countQuery, dataQuery]);

  return { data: data as T[], total, page, limit };
}

export const storage = new DatabaseStorage();
