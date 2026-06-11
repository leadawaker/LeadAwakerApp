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

// Safety cap for no-arg full-table fetches that feed global views / AI tools.
const MAX_UNPAGINATED_ROWS = 5000;

export const interactionsStorage = {
  // ─── Interactions ───────────────────────────────────────────────────

  async getInteractions(): Promise<Interactions[]> {
    // No-arg global fetch returns the whole interactions table (largest table).
    // Hard-cap to the most recent rows; scoped views use the by-lead/by-account methods.
    const rows = await db.select().from(interactions).orderBy(desc(interactions.createdAt)).limit(MAX_UNPAGINATED_ROWS);
    if (rows.length === MAX_UNPAGINATED_ROWS) {
      console.warn(`[storage] getInteractions() hit ${MAX_UNPAGINATED_ROWS}-row cap; results truncated — caller should paginate`);
    }
    return rows;
  },

  async getInteractionById(id: number): Promise<Interactions | undefined> {
    const [row] = await db.select().from(interactions).where(eq(interactions.id, id));
    return row;
  },

  async getInteractionsByLeadId(leadId: number): Promise<Interactions[]> {
    return db
      .select()
      .from(interactions)
      .where(eq(interactions.leadsId, leadId))
      .orderBy(desc(interactions.createdAt));
  },

  async getInteractionsByAccountId(accountId: number): Promise<Interactions[]> {
    return db
      .select()
      .from(interactions)
      .where(eq(interactions.accountsId, accountId))
      .orderBy(desc(interactions.createdAt));
  },

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
  },

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
        p.company_logo_url,
        p.website,
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
  },

  async getProspectMessages(prospectId: number, limit: number, offset: number): Promise<any[]> {
    const result = await pool.query(`
      SELECT * FROM p2mxx34fvbf3ll6."Interactions"
      WHERE prospect_id = $1
      ORDER BY sent_at ASC
      LIMIT $2 OFFSET $3
    `, [prospectId, limit, offset]);
    return result.rows;
  },

  async markProspectInteractionsRead(prospectId: number): Promise<void> {
    await pool.query(`
      UPDATE p2mxx34fvbf3ll6."Interactions"
      SET is_read = true
      WHERE prospect_id = $1 AND is_read = false
    `, [prospectId]);
  },

  async createInteraction(data: InsertInteractions): Promise<Interactions> {
    const now = new Date();
    const [row] = await db.insert(interactions).values({
      createdAt: now,
      updatedAt: now,
      ...data,
    } as any).returning();
    return row;
  },

  async updateInteraction(id: number, data: Partial<InsertInteractions>): Promise<Interactions | undefined> {
    const [row] = await db.update(interactions)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(interactions.id, id))
      .returning();
    return row;
  },

  async deleteInteraction(id: number): Promise<boolean> {
    const rows = await db.delete(interactions).where(eq(interactions.id, id)).returning();
    return rows.length > 0;
  },

  async bulkDeleteInteractions(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await db.delete(interactions).where(inArray(interactions.id, ids)).returning();
    return rows.length;
  },

  async bulkDeleteInteractionsScoped(ids: number[], accountId: number): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await db.delete(interactions)
      .where(and(inArray(interactions.id, ids), eq(interactions.accountsId, accountId)))
      .returning();
    return rows.length;
  },

  async deleteInteractionsByLeadId(leadId: number): Promise<void> {
    await db.delete(interactions).where(eq(interactions.leadsId, leadId));
  },
};
