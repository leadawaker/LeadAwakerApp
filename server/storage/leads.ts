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

// Safety cap for no-arg full-table fetches that feed list views / AI tools.
const MAX_UNPAGINATED_ROWS = 5000;

export const leadsStorage = {
  // ─── Leads ──────────────────────────────────────────────────────────

  async getLeads(): Promise<Leads[]> {
    // No-arg global fetch (agency/admin + AI tools). Hard-cap to avoid scanning
    // the entire table; per-account/per-campaign views use the scoped methods.
    const rows = await db.select().from(leads).limit(MAX_UNPAGINATED_ROWS);
    if (rows.length === MAX_UNPAGINATED_ROWS) {
      console.warn(`[storage] getLeads() hit ${MAX_UNPAGINATED_ROWS}-row cap; results truncated — caller should paginate`);
    }
    return rows;
  },

  async getLeadById(id: number): Promise<Leads | undefined> {
    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    return row;
  },

  async getLeadsByAccountId(accountId: number): Promise<Leads[]> {
    return db.select().from(leads).where(eq(leads.accountsId, accountId));
  },

  async getLeadsByCampaignId(campaignId: number): Promise<Leads[]> {
    return db.select().from(leads).where(eq(leads.campaignsId, campaignId));
  },

  async createLead(data: InsertLeads): Promise<Leads> {
    // Default the automation lifecycle so the lead is actually reachable by the
    // engine: a lead with a campaign must be 'queued' (the launcher only claims
    // queued leads), otherwise 'paused'. Never overrides an explicit value.
    const values: any = { ...data };
    if (values.automationStatus == null) {
      values.automationStatus = values.campaignsId ? "queued" : "paused";
    }
    const [row] = await db.insert(leads).values(values).returning();
    return row;
  },

  async updateLead(id: number, data: Partial<InsertLeads>): Promise<Leads | undefined> {
    const [row] = await db.update(leads).set(data).where(eq(leads.id, id)).returning();
    return row;
  },

  async deleteLead(id: number): Promise<boolean> {
    const result = await db.delete(leads).where(eq(leads.id, id)).returning();
    return result.length > 0;
  },

  // ─── Tags ───────────────────────────────────────────────────────────

  async getTags(): Promise<Tags[]> {
    return db.select().from(tags);
  },

  async getTagsByAccountId(accountId: number): Promise<Tags[]> {
    return db.select().from(tags).where(eq(tags.accountsId, accountId));
  },

  async createTag(data: InsertTags): Promise<Tags> {
    const [row] = await db.insert(tags).values(data as any).returning();
    return row;
  },

  async updateTag(id: number, data: Partial<InsertTags>): Promise<Tags | undefined> {
    const [row] = await db.update(tags).set(data).where(eq(tags.id, id)).returning();
    return row;
  },

  async deleteTag(id: number): Promise<boolean> {
    const result = await db.delete(tags).where(eq(tags.id, id)).returning();
    return result.length > 0;
  },

  // ─── Leads_Tags ─────────────────────────────────────────────────────

  async getTagsByLeadId(leadId: number): Promise<Leads_Tags[]> {
    return db.select().from(leadsTags).where(and(eq(leadsTags.leadsId, leadId), isNull(leadsTags.removedAt)));
  },

  async getTagsByLeadIds(leadIds: number[]): Promise<Leads_Tags[]> {
    if (leadIds.length === 0) return [];
    return db.select().from(leadsTags).where(and(inArray(leadsTags.leadsId, leadIds), isNull(leadsTags.removedAt)));
  },

  async createLeadTag(data: InsertLeads_Tags): Promise<Leads_Tags> {
    const [row] = await db.insert(leadsTags).values(data as any).returning();
    return row;
  },

  async bulkCreateLeadTags(data: InsertLeads_Tags[]): Promise<Leads_Tags[]> {
    if (data.length === 0) return [];
    return db.insert(leadsTags).values(data as any).returning();
  },

  async deleteLeadTag(leadId: number, tagId: number): Promise<boolean> {
    const result = await db.delete(leadsTags)
      .where(and(eq(leadsTags.leadsId, leadId), eq(leadsTags.tagsId, tagId)))
      .returning();
    return result.length > 0;
  },

  async deleteAllLeadTags(leadId: number): Promise<void> {
    await db.delete(leadsTags).where(eq(leadsTags.leadsId, leadId));
  },

  // ─── Bulk Operations ──────────────────────────────────────────────────

  async bulkUpdateLeads(ids: number[], data: Partial<InsertLeads>): Promise<Leads[]> {
    if (ids.length === 0) return [];
    return db
      .update(leads)
      .set(data)
      .where(inArray(leads.id, ids))
      .returning();
  },

  // ─── Lead Score History ───────────────────────────────────────────────
  async getLeadScoreHistory(): Promise<Lead_Score_History[]> {
    return db.select().from(leadScoreHistory).orderBy(desc(leadScoreHistory.scoreDate));
  },

  async getLeadScoreHistoryByLeadId(leadId: number): Promise<Lead_Score_History[]> {
    return db
      .select()
      .from(leadScoreHistory)
      .where(eq(leadScoreHistory.leadsId, leadId))
      .orderBy(desc(leadScoreHistory.createdAt));
  },

  /**
   * Fill in a lead's name, phone and email from a contact form, by channel
   * identifier. Returns false when no such lead exists yet.
   *
   * A real value already on the lead is never overwritten, and the database
   * decides that, in one statement, so two submits cannot race each other:
   *   - first_name is written only when it is empty, a placeholder ("Website
   *     visitor"), or just a number (the voice line stores the caller's number
   *     there until a name is known);
   *   - last_name goes with it, and only when last_name is empty too;
   *   - phone and Email are written only when the lead has none.
   * The same rules as the engine's contact_capture.py, which applies them when
   * a visitor types their details instead. Keep the two in step.
   */
  async fillLeadContact(
    channelIdentifier: string,
    accountId: number,
    contact: { firstName: string; lastName: string; phone: string | null; email: string | null },
  ): Promise<boolean> {
    const nameIsEmpty = `(
      COALESCE(btrim(first_name), '') = ''
      OR lower(btrim(first_name)) IN ('website visitor', 'lead', 'unknown')
      OR first_name !~ '[^0-9 +().-]'
    )`;
    const { rowCount } = await pool.query(
      `UPDATE "p2mxx34fvbf3ll6"."Leads" SET
          first_name = CASE WHEN ${nameIsEmpty} THEN $3 ELSE first_name END,
          last_name = CASE WHEN ${nameIsEmpty} AND $4 <> '' AND COALESCE(btrim(last_name), '') = ''
                           THEN $4 ELSE last_name END,
          phone = CASE WHEN $5::text IS NOT NULL AND COALESCE(btrim(phone), '') = ''
                       THEN $5 ELSE phone END,
          "Email" = CASE WHEN $6::text IS NOT NULL AND COALESCE(btrim("Email"), '') = ''
                         THEN $6 ELSE "Email" END,
          updated_at = NOW()
        WHERE channel_identifier = $1 AND "Accounts_id" = $2`,
      [channelIdentifier, accountId, contact.firstName, contact.lastName, contact.phone, contact.email],
    );
    return (rowCount ?? 0) > 0;
  },
};
