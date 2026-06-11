import { eq, desc, asc, count, sum, SQL, inArray, and, or, ilike, gte, lt, isNotNull, isNull, getTableColumns, sql } from "drizzle-orm";
import { PgTableWithColumns } from "drizzle-orm/pg-core";
import { db, pool } from "./db";
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


import { accountsStorage } from "./storage/accounts";
import { prospectsStorage } from "./storage/prospects";
import { campaignsStorage } from "./storage/campaigns";
import { leadsStorage } from "./storage/leads";
import { interactionsStorage } from "./storage/interactions";
import { automationStorage } from "./storage/automation";
import { notificationsStorage } from "./storage/notifications";
import { billingStorage } from "./storage/billing";
import { tasksStorage } from "./storage/tasks";
import type { NotificationItem, ProspectsListParams } from "./storage/types";
export type { NotificationItem, ProspectsListParams } from "./storage/types";

export interface IStorage {
  // Accounts
  getAccounts(): Promise<Accounts[]>;
  getAccountById(id: number): Promise<Accounts | undefined>;
  createAccount(data: InsertAccounts): Promise<Accounts>;
  updateAccount(id: number, data: Partial<InsertAccounts>): Promise<Accounts | undefined>;
  deleteAccount(id: number): Promise<boolean>;

  // Prospects
  getProspects(): Promise<Prospects[]>;
  getProspectsPaginated(params: ProspectsListParams): Promise<{ items: Prospects[]; total: number; hasMore: boolean }>;
  getProspectsByIds(ids: number[]): Promise<Prospects[]>;
  getProspectsFilterOptions(): Promise<{ niches: string[]; countries: string[]; sources: string[] }>;
  getProspectById(id: number): Promise<Prospects | undefined>;
  createProspect(data: InsertProspects): Promise<Prospects>;
  updateProspect(id: number, data: Partial<InsertProspects>): Promise<Prospects | undefined>;
  deleteProspect(id: number): Promise<boolean>;

  // Outreach Templates
  getOutreachTemplates(): Promise<OutreachTemplate[]>;
  getOutreachTemplateById(id: number): Promise<OutreachTemplate | undefined>;
  createOutreachTemplate(data: InsertOutreachTemplate): Promise<OutreachTemplate>;
  updateOutreachTemplate(id: number, data: Partial<InsertOutreachTemplate>): Promise<OutreachTemplate | undefined>;
  deleteOutreachTemplate(id: number): Promise<boolean>;

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
  getInteractionsByProspectId(prospectId: number, limit?: number, offset?: number): Promise<{ interactions: Interactions[]; total: number }>;
  getProspectConversations(): Promise<any[]>;
  getProspectMessages(prospectId: number, limit: number, offset: number): Promise<any[]>;
  markProspectInteractionsRead(prospectId: number): Promise<void>;
  createInteraction(data: InsertInteractions): Promise<Interactions>;
  updateInteraction(id: number, data: Partial<InsertInteractions>): Promise<Interactions | undefined>;
  deleteInteraction(id: number): Promise<boolean>;
  bulkDeleteInteractions(ids: number[]): Promise<number>;
  bulkDeleteInteractionsScoped(ids: number[], accountId: number): Promise<number>;
  deleteInteractionsByLeadId(leadId: number): Promise<void>;

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
  deleteAllLeadTags(leadId: number): Promise<void>;

  // Bulk operations
  bulkUpdateLeads(ids: number[], data: Partial<InsertLeads>): Promise<Leads[]>;

  // Automation Logs
  getAutomationLogs(): Promise<Automation_Logs[]>;
  getAutomationLogsByAccountId(accountId: number): Promise<Automation_Logs[]>;
  getAutomationLogsSummary(accountId?: number): Promise<any>;
  getAutomationLogsPaginated(opts: {
    page: number;
    limit: number;
    accountId?: number;
    status?: string;
    workflowName?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ data: any[]; total: number; page: number; limit: number }>;
  getRecentFailedAutomationLogs(since: Date): Promise<Automation_Logs[]>;
  getRecentNotifications(accountId?: number, limit?: number): Promise<NotificationItem[]>;

  // Users
  getAppUsers(): Promise<Users[]>;
  getAppUserById(id: number): Promise<Users | undefined>;
  getAppUserByEmail(email: string): Promise<Users | undefined>;
  createAppUser(data: InsertUsers): Promise<Users>;
  updateAppUser(id: number, data: Partial<Users>): Promise<Users | undefined>;

  // Prompt Library
  getPrompts(): Promise<Prompt_Library[]>;
  getPromptById(id: number): Promise<Prompt_Library | undefined>;
  getPromptsByAccountId(accountId: number): Promise<Prompt_Library[]>;
  getPromptByUseCase(useCase: string): Promise<Prompt_Library | undefined>;
  createPrompt(data: InsertPrompt_Library): Promise<Prompt_Library>;
  updatePrompt(id: number, data: Partial<InsertPrompt_Library>): Promise<Prompt_Library | undefined>;
  deletePrompt(id: number): Promise<boolean>;
  deletePromptsByCampaignId(campaignId: number): Promise<number>;

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
  deleteNotification(id: number): Promise<void>;
  deleteAllNotifications(userId: number): Promise<number>;

  // Notification Preferences
  getNotificationPreferences(userId: number, accountId: number): Promise<NotificationPreferences | undefined>;
  upsertNotificationPreferences(userId: number, accountId: number, data: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences>;

  // Push Subscriptions
  getPushSubscriptionsByUser(userId: number, accountId: number): Promise<PushSubscriptionRow[]>;
  getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscriptionRow | undefined>;
  createPushSubscription(data: InsertPushSubscription): Promise<PushSubscriptionRow>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<boolean>;

  // Tasks
  getTasks(): Promise<Task[]>;
  getTasksByAccountId(accountId: number): Promise<Task[]>;
  getTasksFiltered(filters: { accountId?: number; categoryId?: number | null; parentTaskId?: number | null }): Promise<Task[]>;
  getTaskById(id: number): Promise<Task | undefined>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;

  // Task Categories
  getTaskCategories(): Promise<TaskCategory[]>;
  getTaskCategoryById(id: number): Promise<TaskCategory | undefined>;
  createTaskCategory(data: InsertTaskCategory): Promise<TaskCategory>;
  updateTaskCategory(id: number, data: Partial<InsertTaskCategory>): Promise<TaskCategory | undefined>;
  deleteTaskCategory(id: number): Promise<boolean>;

  // Task Subtasks
  getSubtasksByTaskId(taskId: number): Promise<TaskSubtask[]>;
  createSubtask(data: InsertTaskSubtask): Promise<TaskSubtask>;
  updateSubtask(id: number, data: Partial<InsertTaskSubtask>): Promise<TaskSubtask | undefined>;
  deleteSubtask(id: number): Promise<boolean>;
  reorderSubtasks(taskId: number, subtaskIds: number[]): Promise<TaskSubtask[]>;
  getSubtaskCounts(): Promise<{ taskId: number; total: number; completed: number }[]>;
  getCommentCounts(): Promise<{ taskId: number; count: number }[]>;

  // Task Comments
  getCommentsByTaskId(taskId: number): Promise<TaskComment[]>;
  createComment(data: InsertTaskComment): Promise<TaskComment>;
  updateComment(id: number, body: string): Promise<TaskComment | undefined>;
  deleteComment(id: number): Promise<boolean>;

  // Task Attachments
  getAttachmentsByTaskId(taskId: number): Promise<TaskAttachment[]>;
  getAttachmentById(id: number): Promise<TaskAttachment | undefined>;
  createAttachment(data: InsertTaskAttachment): Promise<TaskAttachment>;
  deleteAttachment(id: number): Promise<boolean>;

  // Support Chat
  createSupportSession(data: InsertSupportSession): Promise<SupportSession>;
  getActiveSupportSession(userId: number, channel?: string): Promise<SupportSession | undefined>;
  getSupportSessionBySessionId(sessionId: string): Promise<SupportSession | undefined>;
  updateSupportSession(id: number, data: Partial<InsertSupportSession>): Promise<SupportSession | undefined>;
  createSupportMessage(data: InsertSupportMessage): Promise<SupportMessage>;
  getSupportMessagesBySessionId(sessionId: string): Promise<SupportMessage[]>;
  getFounderSessions(): Promise<SupportSession[]>;
  cleanupOldSupportData(olderThanDays: number): Promise<{ sessions: number; messages: number }>;

  // AI Agents
  getAiAgents(): Promise<AiAgent[]>;
  getAiAgentById(id: number): Promise<AiAgent | undefined>;
  createAiAgent(data: InsertAiAgent): Promise<AiAgent>;
  updateAiAgent(id: number, data: Partial<InsertAiAgent>): Promise<AiAgent | undefined>;

  // AI Sessions
  createAiSession(data: InsertAiSession): Promise<AiSession>;
  getAiSessionsByUserId(userId: number): Promise<AiSession[]>;
  getAiSessionBySessionId(sessionId: string): Promise<AiSession | undefined>;
  getActiveAiSessionByUserAndAgent(userId: number, agentId: number): Promise<AiSession | undefined>;
  updateAiSession(id: number, data: Partial<InsertAiSession>): Promise<AiSession | undefined>;

  // AI Messages
  createAiMessage(data: InsertAiMessage): Promise<AiMessage>;
  getAiMessagesBySessionId(sessionId: string): Promise<AiMessage[]>;

  // AI Files
  createAiFile(data: InsertAiFile): Promise<AiFile>;
  getAiFilesByConversationId(conversationId: string): Promise<AiFile[]>;
  getAiFilesByMessageId(messageId: number): Promise<AiFile[]>;

  // Gmail Sync State
  getGmailSyncState(accountEmail: string): Promise<GmailSyncState | undefined>;
  upsertGmailSyncState(data: InsertGmailSyncState): Promise<GmailSyncState>;
  deleteGmailSyncState(accountEmail: string): Promise<boolean>;
}

export class DatabaseStorage {
  // ─── Support Chat ─────────────────────────────────────────────────────

  async createSupportSession(data: InsertSupportSession): Promise<SupportSession> {
    const [row] = await db.insert(supportSessions).values(data as any).returning();
    return row;
  }

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
  }

  async getSupportSessionBySessionId(sessionId: string): Promise<SupportSession | undefined> {
    const [row] = await db.select().from(supportSessions).where(eq(supportSessions.sessionId, sessionId));
    return row;
  }

  async updateSupportSession(id: number, data: Partial<InsertSupportSession>): Promise<SupportSession | undefined> {
    const [row] = await db.update(supportSessions).set(data as any).where(eq(supportSessions.id, id)).returning();
    return row;
  }

  async createSupportMessage(data: InsertSupportMessage): Promise<SupportMessage> {
    const [row] = await db.insert(supportMessages).values(data as any).returning();
    return row;
  }

  async getSupportMessagesBySessionId(sessionId: string): Promise<SupportMessage[]> {
    return db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.sessionId, sessionId))
      .orderBy(asc(supportMessages.createdAt));
  }

  async getFounderSessions(): Promise<SupportSession[]> {
    return db
      .select()
      .from(supportSessions)
      .where(and(
        eq(supportSessions.channel, "founder"),
        inArray(supportSessions.status, ["active", "escalated"]),
      ))
      .orderBy(desc(supportSessions.createdAt));
  }

  // ─── AI Agents ────────────────────────────────────────────────────────

  async getAiAgents(): Promise<AiAgent[]> {
    return db.select().from(aiAgents).where(eq(aiAgents.enabled, true)).orderBy(asc(aiAgents.displayOrder));
  }

  async getAiAgentById(id: number): Promise<AiAgent | undefined> {
    const [row] = await db.select().from(aiAgents).where(eq(aiAgents.id, id));
    return row;
  }

  async createAiAgent(data: InsertAiAgent): Promise<AiAgent> {
    const [row] = await db.insert(aiAgents).values(data as any).returning();
    return row;
  }

  async updateAiAgent(id: number, data: Partial<InsertAiAgent>): Promise<AiAgent | undefined> {
    const [row] = await db.update(aiAgents).set({ ...data, updatedAt: new Date() } as any).where(eq(aiAgents.id, id)).returning();
    return row;
  }

  // ─── AI Sessions ──────────────────────────────────────────────────────

  async createAiSession(data: InsertAiSession): Promise<AiSession> {
    const [row] = await db.insert(aiSessions).values(data as any).returning();
    return row;
  }

  async getAiSessionsByUserId(userId: number): Promise<AiSession[]> {
    return db.select().from(aiSessions).where(eq(aiSessions.userId, userId)).orderBy(desc(aiSessions.createdAt));
  }

  async getAiSessionBySessionId(sessionId: string): Promise<AiSession | undefined> {
    const [row] = await db.select().from(aiSessions).where(eq(aiSessions.sessionId, sessionId));
    return row;
  }

  async getActiveAiSessionByUserAndAgent(userId: number, agentId: number): Promise<AiSession | undefined> {
    const [row] = await db
      .select()
      .from(aiSessions)
      .where(and(eq(aiSessions.userId, userId), eq(aiSessions.agentId, agentId), eq(aiSessions.status, "active")))
      .orderBy(desc(aiSessions.createdAt))
      .limit(1);
    return row;
  }

  async updateAiSession(id: number, data: Partial<InsertAiSession>): Promise<AiSession | undefined> {
    const [row] = await db.update(aiSessions).set(data as any).where(eq(aiSessions.id, id)).returning();
    return row;
  }

  // ─── AI Messages ──────────────────────────────────────────────────────

  async createAiMessage(data: InsertAiMessage): Promise<AiMessage> {
    const [row] = await db.insert(aiMessages).values(data as any).returning();
    return row;
  }

  async getAiMessagesBySessionId(sessionId: string): Promise<AiMessage[]> {
    return db.select().from(aiMessages).where(eq(aiMessages.sessionId, sessionId)).orderBy(asc(aiMessages.createdAt));
  }

  // ─── AI Files ────────────────────────────────────────────────────────

  async createAiFile(data: InsertAiFile): Promise<AiFile> {
    const [row] = await db.insert(aiFiles).values(data as any).returning();
    return row;
  }

  async getAiFilesByConversationId(conversationId: string): Promise<AiFile[]> {
    return db.select().from(aiFiles).where(eq(aiFiles.conversationId, conversationId)).orderBy(asc(aiFiles.createdAt));
  }

  async getAiFilesByMessageId(messageId: number): Promise<AiFile[]> {
    return db.select().from(aiFiles).where(eq(aiFiles.messageId, messageId)).orderBy(asc(aiFiles.createdAt));
  }

  // ─── Gmail Sync State ──────────────────────────────────────────────────────

  async getGmailSyncState(accountEmail: string): Promise<GmailSyncState | undefined> {
    const [row] = await db.select().from(gmailSyncState).where(eq(gmailSyncState.accountEmail, accountEmail));
    return row;
  }

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
  }

  async deleteGmailSyncState(accountEmail: string): Promise<boolean> {
    const result = await db.delete(gmailSyncState).where(eq(gmailSyncState.accountEmail, accountEmail)).returning();
    return result.length > 0;
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

// Composed storage object: class methods plus extracted domain modules.
// Object.assign keeps `this.x()` calls working across module boundaries.
export const storage = Object.assign(
  new DatabaseStorage(),
  tasksStorage,
  billingStorage,
  notificationsStorage,
  automationStorage,
  interactionsStorage,
  leadsStorage,
  campaignsStorage,
  prospectsStorage,
  accountsStorage,
);

