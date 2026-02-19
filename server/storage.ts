import { eq, desc, asc, count, SQL } from "drizzle-orm";
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
  type Automation_Logs,
  type Users,
  type InsertUsers,
  type Prompt_Library,
  type InsertPrompt_Library,
  type Lead_Score_History,
  type Campaign_Metrics_History,
} from "@shared/schema";

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

  // Leads_Tags
  getTagsByLeadId(leadId: number): Promise<Leads_Tags[]>;

  // Automation Logs
  getAutomationLogs(): Promise<Automation_Logs[]>;
  getAutomationLogsByAccountId(accountId: number): Promise<Automation_Logs[]>;

  // Users
  getAppUsers(): Promise<Users[]>;
  getAppUserById(id: number): Promise<Users | undefined>;
  getAppUserByEmail(email: string): Promise<Users | undefined>;

  // Prompt Library
  getPrompts(): Promise<Prompt_Library[]>;
  getPromptsByAccountId(accountId: number): Promise<Prompt_Library[]>;
  createPrompt(data: InsertPrompt_Library): Promise<Prompt_Library>;

  // Lead Score History
  getLeadScoreHistory(): Promise<Lead_Score_History[]>;
  getLeadScoreHistoryByLeadId(leadId: number): Promise<Lead_Score_History[]>;

  // Campaign Metrics History
  getCampaignMetricsHistory(): Promise<Campaign_Metrics_History[]>;
  getCampaignMetricsHistoryByCampaignId(campaignId: number): Promise<Campaign_Metrics_History[]>;
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

  // ─── Leads_Tags ─────────────────────────────────────────────────────

  async getTagsByLeadId(leadId: number): Promise<Leads_Tags[]> {
    return db.select().from(leadsTags).where(eq(leadsTags.leadsId, leadId));
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

  // Count total
  let countQuery = db.select({ total: count() }).from(table);
  if (where) countQuery = countQuery.where(where) as any;
  const [{ total }] = await countQuery;

  // Fetch page
  let dataQuery = db.select().from(table);
  if (where) dataQuery = dataQuery.where(where) as any;
  dataQuery = dataQuery.limit(limit).offset(offset) as any;
  const data = await dataQuery;

  return { data: data as T[], total, page, limit };
}

export const storage = new DatabaseStorage();
