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
  accountCommunicationProfile,
  type AccountCommunicationProfile,
  type InsertAccountCommunicationProfile,
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
  nicheVocabulary,
  type NicheVocabulary,
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

  // ─── Communication Profile (onboarding wizard) ──────────────────────

  async getCommunicationProfile(accountId: number): Promise<AccountCommunicationProfile | undefined> {
    const [row] = await db.select().from(accountCommunicationProfile)
      .where(eq(accountCommunicationProfile.accountsId, accountId));
    return row;
  },

  async upsertCommunicationProfile(
    accountId: number,
    data: Partial<InsertAccountCommunicationProfile>,
  ): Promise<AccountCommunicationProfile> {
    const existing = await this.getCommunicationProfile(accountId);
    const now = new Date();
    const completedAt = data.status === "completed" ? now : (data.completedAt ?? existing?.completedAt ?? null);
    const payload = { ...data, accountsId: accountId, updatedAt: now, completedAt } as any;
    if (existing) {
      const [row] = await db.update(accountCommunicationProfile)
        .set(payload).where(eq(accountCommunicationProfile.id, existing.id)).returning();
      return row;
    }
    const [row] = await db.insert(accountCommunicationProfile)
      .values({ ...payload, createdAt: now }).returning();
    return row;
  },

  // ─── Niche Vocabulary ───────────────────────────────────────────────

  async getNicheVocabulary(niche: string): Promise<{ projectTerm: string[]; proposalTerm: string[]; decisionTerm: string[] }> {
    const empty = { projectTerm: [], proposalTerm: [], decisionTerm: [] };
    const [row] = await db.select().from(nicheVocabulary)
      .where(eq(nicheVocabulary.niche, niche));
    const [def] = row ? [row] : await db.select().from(nicheVocabulary)
      .where(eq(nicheVocabulary.niche, "__default__"));
    if (!def) return empty;
    return {
      projectTerm: def.projectTerms ?? [],
      proposalTerm: def.proposalTerms ?? [],
      decisionTerm: def.decisionTerms ?? [],
    };
  },

  async addNicheWord(niche: string, group: "projectTerm" | "proposalTerm" | "decisionTerm", word: string): Promise<{ projectTerm: string[]; proposalTerm: string[]; decisionTerm: string[] }> {
    // Resolve the words currently shown for this niche (falls back to the
    // __default__ row when no niche-specific row exists yet). We seed the new
    // niche row with ALL of these so adding a word never drops the fallback
    // vocabulary the user was looking at.
    const current = await this.getNicheVocabulary(niche);
    const withWord = (arr: string[]) => (arr.includes(word) ? arr : [...arr, word]);
    const next = {
      projectTerm: group === "projectTerm" ? withWord(current.projectTerm) : current.projectTerm,
      proposalTerm: group === "proposalTerm" ? withWord(current.proposalTerm) : current.proposalTerm,
      decisionTerm: group === "decisionTerm" ? withWord(current.decisionTerm) : current.decisionTerm,
    };
    // Upsert the full row so all three columns are persisted for this niche.
    await db.execute(sql`
      INSERT INTO "p2mxx34fvbf3ll6"."Niche_Vocabulary" (niche, project_terms, proposal_terms, decision_terms, created_at, updated_at)
      VALUES (
        ${niche},
        ${JSON.stringify(next.projectTerm)}::jsonb,
        ${JSON.stringify(next.proposalTerm)}::jsonb,
        ${JSON.stringify(next.decisionTerm)}::jsonb,
        NOW(), NOW()
      )
      ON CONFLICT (niche) DO UPDATE SET
        project_terms  = ${JSON.stringify(next.projectTerm)}::jsonb,
        proposal_terms = ${JSON.stringify(next.proposalTerm)}::jsonb,
        decision_terms = ${JSON.stringify(next.decisionTerm)}::jsonb,
        updated_at = NOW()
    `);
    return this.getNicheVocabulary(niche);
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
