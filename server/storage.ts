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
  outreachTemplates,
  type OutreachTemplate,
  type InsertOutreachTemplate,
  gmailSyncState,
  type GmailSyncState,
  type InsertGmailSyncState,
} from "@shared/schema";


export interface NotificationItem {
  id: string;
  type: 'inbound' | 'booking' | 'error';
  title: string;
  description: string;
  at: string; // ISO date string
  leadId?: number;
}

export interface ProspectsListParams {
  limit?: number;
  offset?: number;
  search?: string;
  niche?: string[];
  status?: string[];
  country?: string[];
  priority?: string[];
  source?: string[];
  overdue?: boolean;
  sortBy?: string; // "recent" | "name_asc" | "name_desc" | "priority"
  groupBy?: string;
  groupDirection?: "asc" | "desc";
  all?: boolean;
}

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

export class DatabaseStorage implements IStorage {
  // ─── Accounts ───────────────────────────────────────────────────────

  async getAccounts(): Promise<Accounts[]> {
    const { voiceFileData, ...cols } = getTableColumns(accounts);
    return db.select(cols).from(accounts) as any;
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

  // ─── Prospects ──────────────────────────────────────────────────────

  async getProspects(): Promise<Prospects[]> {
    return db.select().from(prospects).orderBy(desc(prospects.createdAt));
  }

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
  }

  async getProspectsByIds(ids: number[]): Promise<Prospects[]> {
    if (ids.length === 0) return [];
    return db.select().from(prospects).where(inArray(prospects.id, ids));
  }

  async getProspectsFilterOptions(): Promise<{ niches: string[]; countries: string[]; sources: string[] }> {
    const niches = await db.selectDistinct({ v: prospects.niche }).from(prospects).where(isNotNull(prospects.niche));
    const countries = await db.selectDistinct({ v: prospects.country }).from(prospects).where(isNotNull(prospects.country));
    const sources = await db.selectDistinct({ v: prospects.source }).from(prospects).where(isNotNull(prospects.source));
    const clean = (rows: { v: string | null }[]) => rows.map(r => r.v).filter((v): v is string => !!v && v.trim() !== "").sort();
    return { niches: clean(niches), countries: clean(countries), sources: clean(sources) };
  }

  async getProspectById(id: number): Promise<Prospects | undefined> {
    const [row] = await db.select().from(prospects).where(eq(prospects.id, id));
    return row;
  }

  async createProspect(data: InsertProspects): Promise<Prospects> {
    const [row] = await db.insert(prospects).values(data as any).returning();
    return row;
  }

  async updateProspect(id: number, data: Partial<InsertProspects>): Promise<Prospects | undefined> {
    const [row] = await db.update(prospects).set(data).where(eq(prospects.id, id)).returning();
    return row;
  }

  async deleteProspect(id: number): Promise<boolean> {
    const result = await db.delete(prospects).where(eq(prospects.id, id)).returning();
    return result.length > 0;
  }

  // ─── Outreach Templates ────────────────────────────────────────────

  async getOutreachTemplates(): Promise<OutreachTemplate[]> {
    return db.select().from(outreachTemplates).orderBy(desc(outreachTemplates.createdAt));
  }

  async getOutreachTemplateById(id: number): Promise<OutreachTemplate | undefined> {
    const [row] = await db.select().from(outreachTemplates).where(eq(outreachTemplates.id, id));
    return row;
  }

  async createOutreachTemplate(data: InsertOutreachTemplate): Promise<OutreachTemplate> {
    const [row] = await db.insert(outreachTemplates).values(data as any).returning();
    return row;
  }

  async updateOutreachTemplate(id: number, data: Partial<InsertOutreachTemplate>): Promise<OutreachTemplate | undefined> {
    const [row] = await db.update(outreachTemplates).set(data).where(eq(outreachTemplates.id, id)).returning();
    return row;
  }

  async deleteOutreachTemplate(id: number): Promise<boolean> {
    const result = await db.delete(outreachTemplates).where(eq(outreachTemplates.id, id)).returning();
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

  async getInteractionById(id: number): Promise<Interactions | undefined> {
    const [row] = await db.select().from(interactions).where(eq(interactions.id, id));
    return row;
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

  async getInteractionsByProspectId(prospectId: number, limit: number = 20, offset: number = 0): Promise<{ interactions: Interactions[]; total: number }> {
    // Fetch prospect to get all email addresses
    const prospect = await this.getProspectById(prospectId);
    if (!prospect) return { interactions: [], total: 0 };

    const emails: string[] = [];
    if (prospect.email) emails.push(prospect.email);
    if (prospect.contactEmail) emails.push(prospect.contactEmail);
    if (prospect.contact2Email) emails.push(prospect.contact2Email);

    // Build query: match by prospect_id FK OR by email in metadata JSON
    let emailClause = "";
    const params: any[] = [prospectId];
    if (emails.length > 0) {
      params.push(emails);
      emailClause = ` OR metadata->>'from_email' = ANY($2) OR metadata->>'to_email' = ANY($2)`;
    }

    const whereClause = `WHERE prospect_id = $1${emailClause}`;
    const countParam = emails.length > 0 ? 2 : 1;

    // Use raw SQL via pool for complex OR with JSON operators
    const countRows = await pool.query(
      `SELECT COUNT(*)::int as total FROM p2mxx34fvbf3ll6."Interactions" ${whereClause}`,
      emails.length > 0 ? [prospectId, emails] : [prospectId]
    );
    const total = countRows.rows[0]?.total ?? 0;

    // Fetch data
    const dataRows = await pool.query(
      `SELECT * FROM p2mxx34fvbf3ll6."Interactions" ${whereClause} ORDER BY COALESCE(sent_at, created_at) DESC LIMIT $${countParam + 1} OFFSET $${countParam + 2}`,
      emails.length > 0 ? [prospectId, emails, limit, offset] : [prospectId, limit, offset]
    );

    return { interactions: dataRows.rows as Interactions[], total };
  }

  async getProspectConversations(): Promise<any[]> {
    const result = await pool.query(`
      SELECT
        p.id as prospect_id,
        p.name,
        p.company,
        p.contact_name,
        p.contact_email,
        p.niche,
        p.outreach_status,
        p.priority,
        p.contact_phone,
        p.phone,
        COUNT(i.id) FILTER (WHERE i.is_read = false AND i.direction = 'inbound') as unread_count,
        COUNT(i.id) as total_messages,
        MAX(i.sent_at) as last_message_at,
        (SELECT i2."Content" FROM p2mxx34fvbf3ll6."Interactions" i2
         WHERE i2.prospect_id = p.id ORDER BY i2.sent_at DESC LIMIT 1) as last_message,
        (SELECT i2.direction FROM p2mxx34fvbf3ll6."Interactions" i2
         WHERE i2.prospect_id = p.id ORDER BY i2.sent_at DESC LIMIT 1) as last_message_direction,
        (SELECT i2.type FROM p2mxx34fvbf3ll6."Interactions" i2
         WHERE i2.prospect_id = p.id ORDER BY i2.sent_at DESC LIMIT 1) as last_message_type,
        ARRAY(SELECT DISTINCT LOWER(i3.type) FROM p2mxx34fvbf3ll6."Interactions" i3
         WHERE i3.prospect_id = p.id AND i3.type IS NOT NULL) as channels
      FROM p2mxx34fvbf3ll6."Prospects" p
      INNER JOIN p2mxx34fvbf3ll6."Interactions" i ON i.prospect_id = p.id
      GROUP BY p.id
      ORDER BY MAX(i.sent_at) DESC
    `);
    return result.rows;
  }

  async getProspectMessages(prospectId: number, limit: number, offset: number): Promise<any[]> {
    const result = await pool.query(`
      SELECT * FROM p2mxx34fvbf3ll6."Interactions"
      WHERE prospect_id = $1
      ORDER BY sent_at ASC
      LIMIT $2 OFFSET $3
    `, [prospectId, limit, offset]);
    return result.rows;
  }

  async markProspectInteractionsRead(prospectId: number): Promise<void> {
    await pool.query(`
      UPDATE p2mxx34fvbf3ll6."Interactions"
      SET is_read = true
      WHERE prospect_id = $1 AND is_read = false
    `, [prospectId]);
  }

  async createInteraction(data: InsertInteractions): Promise<Interactions> {
    const now = new Date();
    const [row] = await db.insert(interactions).values({
      createdAt: now,
      updatedAt: now,
      ...data,
    } as any).returning();
    return row;
  }

  async updateInteraction(id: number, data: Partial<InsertInteractions>): Promise<Interactions | undefined> {
    const [row] = await db.update(interactions)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(interactions.id, id))
      .returning();
    return row;
  }

  async deleteInteraction(id: number): Promise<boolean> {
    const rows = await db.delete(interactions).where(eq(interactions.id, id)).returning();
    return rows.length > 0;
  }

  async bulkDeleteInteractions(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await db.delete(interactions).where(inArray(interactions.id, ids)).returning();
    return rows.length;
  }

  async bulkDeleteInteractionsScoped(ids: number[], accountId: number): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await db.delete(interactions)
      .where(and(inArray(interactions.id, ids), eq(interactions.accountsId, accountId)))
      .returning();
    return rows.length;
  }

  async deleteInteractionsByLeadId(leadId: number): Promise<void> {
    await db.delete(interactions).where(eq(interactions.leadsId, leadId));
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
    return db.select().from(leadsTags).where(and(eq(leadsTags.leadsId, leadId), isNull(leadsTags.removedAt)));
  }

  async getTagsByLeadIds(leadIds: number[]): Promise<Leads_Tags[]> {
    if (leadIds.length === 0) return [];
    return db.select().from(leadsTags).where(and(inArray(leadsTags.leadsId, leadIds), isNull(leadsTags.removedAt)));
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

  async deleteAllLeadTags(leadId: number): Promise<void> {
    await db.delete(leadsTags).where(eq(leadsTags.leadsId, leadId));
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

  async getAutomationLogsSummary(accountId?: number) {
    const result = await db.execute(sql`
      SELECT
        COUNT(DISTINCT workflow_execution_id) as total_executions,
        COUNT(*) FILTER (WHERE status = 'Failure') as error_count_total,
        COUNT(*) FILTER (WHERE status = 'Failure' AND created_at > NOW() - INTERVAL '24 hours') as errors_today,
        ROUND(AVG(execution_time_ms)) as avg_execution_time_ms,
        MAX(created_at) as last_run_at
      FROM "p2mxx34fvbf3ll6"."Automation_Logs"
      ${accountId ? sql`WHERE "Accounts_id" = ${accountId}` : sql``}
    `);
    const topFailing = await db.execute(sql`
      SELECT workflow_name, COUNT(*) as fail_count
      FROM "p2mxx34fvbf3ll6"."Automation_Logs"
      WHERE status = 'Failure'
      ${accountId ? sql`AND "Accounts_id" = ${accountId}` : sql``}
      GROUP BY workflow_name
      ORDER BY fail_count DESC
      LIMIT 3
    `);
    const successRate = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE fail_count = 0) * 100.0 / NULLIF(COUNT(*), 0) as rate
      FROM (
        SELECT workflow_execution_id, COUNT(*) FILTER (WHERE status = 'Failure') as fail_count
        FROM "p2mxx34fvbf3ll6"."Automation_Logs"
        ${accountId ? sql`WHERE "Accounts_id" = ${accountId}` : sql``}
        GROUP BY workflow_execution_id
      ) sub
    `);
    return { ...result.rows[0], successRate: successRate.rows[0]?.rate, topFailingWorkflows: topFailing.rows };
  }

  async getAutomationLogsPaginated(opts: {
    page: number;
    limit: number;
    accountId?: number;
    status?: string;
    workflowName?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { page, limit, accountId, status, workflowName, dateFrom, dateTo } = opts;
    const offset = page * limit;

    // Build WHERE conditions
    const conditions: SQL[] = [];
    if (accountId) conditions.push(sql`"Accounts_id" = ${accountId}`);
    if (workflowName) conditions.push(sql`workflow_name ILIKE ${'%' + workflowName + '%'}`);
    if (dateFrom) conditions.push(sql`created_at >= ${dateFrom}::timestamp`);
    if (dateTo) conditions.push(sql`created_at <= ${dateTo}::timestamp + INTERVAL '1 day'`);

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    // Status filter applies at execution group level
    const statusHaving = status === 'failed'
      ? sql`HAVING COUNT(*) FILTER (WHERE status = 'Failure') > 0`
      : status === 'success'
      ? sql`HAVING COUNT(*) FILTER (WHERE status = 'Failure') = 0`
      : sql``;

    // Step 1: Get paginated execution IDs + total count in parallel
    const [execIds, countResult] = await Promise.all([
      db.execute(sql`
        SELECT workflow_execution_id, MAX(created_at) as latest
        FROM "p2mxx34fvbf3ll6"."Automation_Logs"
        ${whereClause}
        GROUP BY workflow_execution_id
        ${statusHaving}
        ORDER BY latest DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.execute(sql`
        SELECT COUNT(*) as total FROM (
          SELECT workflow_execution_id
          FROM "p2mxx34fvbf3ll6"."Automation_Logs"
          ${whereClause}
          GROUP BY workflow_execution_id
          ${statusHaving}
        ) sub
      `),
    ]);

    if (execIds.rows.length === 0) {
      return { data: [], total: Number(countResult.rows[0]?.total || 0), page, limit };
    }

    const ids = execIds.rows.map((r: any) => r.workflow_execution_id);

    // Step 2: Get all rows for those execution IDs, with entity names via LEFT JOIN
    const data = await db.execute(sql`
      SELECT al.*,
        l.first_name as "leadFirstName", l.last_name as "leadLastName",
        c.name as "campaignJoinName",
        a.name as "accountJoinName", a.logo_url as "accountLogoUrl"
      FROM "p2mxx34fvbf3ll6"."Automation_Logs" al
      LEFT JOIN "p2mxx34fvbf3ll6"."Leads" l ON l.id = al."Leads_id"
      LEFT JOIN "p2mxx34fvbf3ll6"."Campaigns" c ON c.id = al."Campaigns_id"
      LEFT JOIN "p2mxx34fvbf3ll6"."Accounts" a ON a.id = al."Accounts_id"
      WHERE al.workflow_execution_id IN ${sql`(${sql.join(ids.map((id: string) => sql`${id}`), sql`, `)})`}
      ORDER BY al.created_at DESC, al.step_number ASC
    `);

    return {
      data: data.rows,
      total: Number(countResult.rows[0]?.total || 0),
      page,
      limit,
    };
  }

  async getRecentFailedAutomationLogs(since: Date): Promise<Automation_Logs[]> {
    return db
      .select()
      .from(automationLogs)
      .where(
        and(
          inArray(automationLogs.status, ["failed", "error"]),
          gte(automationLogs.createdAt, since),
        ),
      );
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

  async getPromptById(id: number): Promise<Prompt_Library | undefined> {
    const [row] = await db.select().from(promptLibrary).where(eq(promptLibrary.id, id)).limit(1);
    return row;
  }

  async getPromptsByAccountId(accountId: number): Promise<Prompt_Library[]> {
    return db.select().from(promptLibrary).where(eq(promptLibrary.accountsId, accountId));
  }

  async getPromptByUseCase(useCase: string): Promise<Prompt_Library | undefined> {
    const [row] = await db.select().from(promptLibrary).where(eq(promptLibrary.useCase, useCase)).limit(1);
    return row;
  }

  async createPrompt(data: InsertPrompt_Library): Promise<Prompt_Library> {
    const [row] = await db.insert(promptLibrary).values(data as any).returning();
    return row;
  }

  async updatePrompt(id: number, data: Partial<InsertPrompt_Library>): Promise<Prompt_Library | undefined> {
    const [row] = await db.update(promptLibrary).set({ ...data, updatedAt: new Date() } as any).where(eq(promptLibrary.id, id)).returning();
    return row;
  }

  async deletePrompt(id: number): Promise<boolean> {
    const rows = await db.delete(promptLibrary).where(eq(promptLibrary.id, id)).returning();
    return rows.length > 0;
  }

  async deletePromptsByCampaignId(campaignId: number): Promise<number> {
    const rows = await db.delete(promptLibrary)
      .where(eq(promptLibrary.campaignsId, campaignId))
      .returning();
    return rows.length;
  }

  // ─── Prompt Versions ─────────────────────────────────────────────────

  async getPromptVersions(promptId: number): Promise<Prompt_Version[]> {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    await db.delete(promptVersions)
      .where(and(eq(promptVersions.promptsId, promptId), lt(promptVersions.savedAt, oneMonthAgo)));
    return db.select().from(promptVersions)
      .where(eq(promptVersions.promptsId, promptId))
      .orderBy(desc(promptVersions.savedAt));
  }

  async getLatestPromptVersion(promptId: number): Promise<Prompt_Version | undefined> {
    const [row] = await db.select().from(promptVersions)
      .where(eq(promptVersions.promptsId, promptId))
      .orderBy(desc(promptVersions.savedAt))
      .limit(1);
    return row;
  }

  async createPromptVersion(data: InsertPrompt_Version): Promise<Prompt_Version> {
    const [row] = await db.insert(promptVersions).values(data as any).returning();
    return row;
  }

  async deletePromptVersion(id: number): Promise<boolean> {
    const [row] = await db.delete(promptVersions).where(eq(promptVersions.id, id)).returning();
    return !!row;
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
      .orderBy(desc(leadScoreHistory.createdAt));
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

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async deleteAllNotifications(userId: number): Promise<number> {
    const rows = await db
      .delete(notifications)
      .where(eq(notifications.userId, userId))
      .returning({ id: notifications.id });
    return rows.length;
  }

  // ─── Notification Preferences ──────────────────────────────────────────

  async getNotificationPreferences(userId: number, accountId: number): Promise<NotificationPreferences | undefined> {
    const [row] = await db
      .select()
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.accountId, accountId)))
      .limit(1);
    return row;
  }

  async upsertNotificationPreferences(userId: number, accountId: number, data: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences> {
    const existing = await this.getNotificationPreferences(userId, accountId);
    if (existing) {
      const [row] = await db
        .update(notificationPreferences)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(notificationPreferences.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db
      .insert(notificationPreferences)
      .values({ userId, accountId, ...data } as any)
      .returning();
    return row;
  }

  // ─── Push Subscriptions ──────────────────────────────────────────────

  async getPushSubscriptionsByUser(userId: number, accountId: number): Promise<PushSubscriptionRow[]> {
    return db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.accountId, accountId)))
      .orderBy(desc(pushSubscriptions.createdAt));
  }

  async createPushSubscription(data: InsertPushSubscription): Promise<PushSubscriptionRow> {
    // Delete existing subscription for same endpoint (re-subscribe)
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint));
    const [row] = await db.insert(pushSubscriptions).values(data as any).returning();
    return row;
  }

  async getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscriptionRow | undefined> {
    const [row] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);
    return row;
  }

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<boolean> {
    const rows = await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).returning({ id: pushSubscriptions.id });
    return rows.length > 0;
  }

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

  // ─── Tasks ────────────────────────────────────────────────────────────

  async getTasks(): Promise<Task[]> {
    return db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTasksByAccountId(accountId: number): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.accountsId, accountId)).orderBy(desc(tasks.createdAt));
  }

  async getTasksFiltered(filters: { accountId?: number; categoryId?: number | null; parentTaskId?: number | null }): Promise<Task[]> {
    const conditions: SQL[] = [];
    if (filters.accountId !== undefined) {
      conditions.push(eq(tasks.accountsId, filters.accountId));
    }
    if (filters.categoryId !== undefined) {
      if (filters.categoryId === null) {
        conditions.push(isNull(tasks.categoryId));
      } else {
        conditions.push(eq(tasks.categoryId, filters.categoryId));
      }
    }
    if (filters.parentTaskId !== undefined) {
      if (filters.parentTaskId === null) {
        conditions.push(isNull(tasks.parentTaskId));
      } else {
        conditions.push(eq(tasks.parentTaskId, filters.parentTaskId));
      }
    }
    const query = db.select().from(tasks);
    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(tasks.createdAt));
    }
    return query.orderBy(desc(tasks.createdAt));
  }

  async getTaskById(id: number): Promise<Task | undefined> {
    const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
    return row;
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [row] = await db.insert(tasks).values(data as any).returning();
    return row;
  }

  async updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [row] = await db.update(tasks).set({ ...data as any, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return row;
  }

  async deleteTask(id: number): Promise<boolean> {
    const rows = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return rows.length > 0;
  }

  // ─── Task Categories ───────────────────────────────────────────────────

  async getTaskCategories(): Promise<TaskCategory[]> {
    return db.select().from(taskCategories).orderBy(asc(taskCategories.sortOrder));
  }

  async getTaskCategoryById(id: number): Promise<TaskCategory | undefined> {
    const [row] = await db.select().from(taskCategories).where(eq(taskCategories.id, id));
    return row;
  }

  async createTaskCategory(data: InsertTaskCategory): Promise<TaskCategory> {
    const [row] = await db.insert(taskCategories).values(data as any).returning();
    return row;
  }

  async updateTaskCategory(id: number, data: Partial<InsertTaskCategory>): Promise<TaskCategory | undefined> {
    const [row] = await db.update(taskCategories).set({ ...data as any, updatedAt: new Date() }).where(eq(taskCategories.id, id)).returning();
    return row;
  }

  async deleteTaskCategory(id: number): Promise<boolean> {
    const rows = await db.delete(taskCategories).where(eq(taskCategories.id, id)).returning();
    return rows.length > 0;
  }

  // ─── Task Subtasks ─────────────────────────────────────────────────────

  async getSubtasksByTaskId(taskId: number): Promise<TaskSubtask[]> {
    return db.select().from(taskSubtasks).where(eq(taskSubtasks.taskId, taskId)).orderBy(asc(taskSubtasks.sortOrder));
  }

  async createSubtask(data: InsertTaskSubtask): Promise<TaskSubtask> {
    const [row] = await db.insert(taskSubtasks).values(data as any).returning();
    return row;
  }

  async updateSubtask(id: number, data: Partial<InsertTaskSubtask>): Promise<TaskSubtask | undefined> {
    const [row] = await db.update(taskSubtasks).set({ ...data as any, updatedAt: new Date() }).where(eq(taskSubtasks.id, id)).returning();
    return row;
  }

  async deleteSubtask(id: number): Promise<boolean> {
    const rows = await db.delete(taskSubtasks).where(eq(taskSubtasks.id, id)).returning();
    return rows.length > 0;
  }

  async reorderSubtasks(taskId: number, subtaskIds: number[]): Promise<TaskSubtask[]> {
    // Update sortOrder for each subtask based on array position
    for (let i = 0; i < subtaskIds.length; i++) {
      await db
        .update(taskSubtasks)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(taskSubtasks.id, subtaskIds[i]), eq(taskSubtasks.taskId, taskId)));
    }
    // Return updated subtasks in new order
    return db.select().from(taskSubtasks).where(eq(taskSubtasks.taskId, taskId)).orderBy(asc(taskSubtasks.sortOrder));
  }

  async getSubtaskCounts(): Promise<{ taskId: number; total: number; completed: number }[]> {
    const rows = await db
      .select({
        taskId: taskSubtasks.taskId,
        total: count(taskSubtasks.id),
        completed: sql<number>`count(*) filter (where ${taskSubtasks.isCompleted} = true)`,
      })
      .from(taskSubtasks)
      .groupBy(taskSubtasks.taskId);
    return rows.map(r => ({ taskId: r.taskId, total: Number(r.total), completed: Number(r.completed) }));
  }

  async cleanupOldSupportData(olderThanDays: number): Promise<{ sessions: number; messages: number }> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const deletedMsgs = await db
      .delete(supportMessages)
      .where(lt(supportMessages.createdAt, cutoff))
      .returning({ id: supportMessages.id });
    const deletedSessions = await db
      .delete(supportSessions)
      .where(lt(supportSessions.createdAt, cutoff))
      .returning({ id: supportSessions.id });
    return { sessions: deletedSessions.length, messages: deletedMsgs.length };
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

export const storage = new DatabaseStorage();

