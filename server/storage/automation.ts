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

export const automationStorage = {
  // ─── Automation Logs ────────────────────────────────────────────────

  async getSchedulerJobHealth() {
    const result = await db.execute(sql`
      SELECT
        workflow_name,
        MAX(created_at) as last_run_at,
        (array_agg(status ORDER BY created_at DESC))[1] as last_status,
        COUNT(*) FILTER (WHERE status = 'Failure' AND created_at > NOW() - INTERVAL '24 hours') as errors_24h
      FROM "p2mxx34fvbf3ll6"."Automation_Logs"
      GROUP BY workflow_name
    `);
    return result.rows as Array<{
      workflow_name: string;
      last_run_at: string | null;
      last_status: string | null;
      errors_24h: number;
    }>;
  },

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
  },

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
  },

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
  },
};
