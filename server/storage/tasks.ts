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

export const tasksStorage = {
  // ─── Tasks ────────────────────────────────────────────────────────────

  async getTasks(): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.isArchived, false)).orderBy(desc(tasks.createdAt));
  },

  async getTasksByAccountId(accountId: number): Promise<Task[]> {
    return db.select().from(tasks).where(and(eq(tasks.accountsId, accountId), eq(tasks.isArchived, false))).orderBy(desc(tasks.createdAt));
  },

  async getTasksFiltered(filters: { accountId?: number; categoryId?: number | null; parentTaskId?: number | null }): Promise<Task[]> {
    const conditions: SQL[] = [eq(tasks.isArchived, false)];
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
    return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt));
  },

  async getTaskById(id: number): Promise<Task | undefined> {
    const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
    return row;
  },

  async createTask(data: InsertTask): Promise<Task> {
    const [row] = await db.insert(tasks).values(data as any).returning();
    return row;
  },

  async updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [row] = await db.update(tasks).set({ ...data as any, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return row;
  },

  async deleteTask(id: number): Promise<boolean> {
    const rows = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return rows.length > 0;
  },

  // ─── Task Categories ───────────────────────────────────────────────────

  async getTaskCategories(): Promise<TaskCategory[]> {
    return db.select().from(taskCategories).orderBy(asc(taskCategories.sortOrder));
  },

  async getTaskCategoryById(id: number): Promise<TaskCategory | undefined> {
    const [row] = await db.select().from(taskCategories).where(eq(taskCategories.id, id));
    return row;
  },

  async createTaskCategory(data: InsertTaskCategory): Promise<TaskCategory> {
    const [row] = await db.insert(taskCategories).values(data as any).returning();
    return row;
  },

  async updateTaskCategory(id: number, data: Partial<InsertTaskCategory>): Promise<TaskCategory | undefined> {
    const [row] = await db.update(taskCategories).set({ ...data as any, updatedAt: new Date() }).where(eq(taskCategories.id, id)).returning();
    return row;
  },

  async deleteTaskCategory(id: number): Promise<boolean> {
    const rows = await db.delete(taskCategories).where(eq(taskCategories.id, id)).returning();
    return rows.length > 0;
  },

  // ─── Task Subtasks ─────────────────────────────────────────────────────

  async getSubtasksByTaskId(taskId: number): Promise<TaskSubtask[]> {
    return db.select().from(taskSubtasks).where(eq(taskSubtasks.taskId, taskId)).orderBy(asc(taskSubtasks.sortOrder));
  },

  async createSubtask(data: InsertTaskSubtask): Promise<TaskSubtask> {
    const [row] = await db.insert(taskSubtasks).values(data as any).returning();
    return row;
  },

  async updateSubtask(id: number, data: Partial<InsertTaskSubtask>): Promise<TaskSubtask | undefined> {
    const [row] = await db.update(taskSubtasks).set({ ...data as any, updatedAt: new Date() }).where(eq(taskSubtasks.id, id)).returning();
    return row;
  },

  async deleteSubtask(id: number): Promise<boolean> {
    const rows = await db.delete(taskSubtasks).where(eq(taskSubtasks.id, id)).returning();
    return rows.length > 0;
  },

  async reorderSubtasks(taskId: number, subtaskIds: number[]): Promise<TaskSubtask[]> {
    // Single UPDATE: set sortOrder from array position via a CASE expression
    // (was one UPDATE per subtask in a for-loop — N+1 round-trips per drag).
    if (subtaskIds.length > 0) {
      const cases = subtaskIds.map((id, i) => sql`when ${taskSubtasks.id} = ${id} then ${i}`);
      await db
        .update(taskSubtasks)
        .set({ sortOrder: sql`case ${sql.join(cases, sql` `)} end`, updatedAt: new Date() })
        .where(and(eq(taskSubtasks.taskId, taskId), inArray(taskSubtasks.id, subtaskIds)));
    }
    // Return updated subtasks in new order
    return db.select().from(taskSubtasks).where(eq(taskSubtasks.taskId, taskId)).orderBy(asc(taskSubtasks.sortOrder));
  },

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
  },

  async getCommentCounts(): Promise<{ taskId: number; count: number }[]> {
    const rows = await db
      .select({ taskId: taskComments.taskId, count: count(taskComments.id) })
      .from(taskComments)
      .groupBy(taskComments.taskId);
    return rows.map(r => ({ taskId: r.taskId, count: Number(r.count) }));
  },

  // ─── Task Comments ─────────────────────────────────────────────────────

  async getCommentsByTaskId(taskId: number): Promise<TaskComment[]> {
    return db.select().from(taskComments).where(eq(taskComments.taskId, taskId)).orderBy(asc(taskComments.createdAt));
  },

  async createComment(data: InsertTaskComment): Promise<TaskComment> {
    const [row] = await db.insert(taskComments).values(data as any).returning();
    return row;
  },

  async updateComment(id: number, body: string): Promise<TaskComment | undefined> {
    const [row] = await db.update(taskComments).set({ body }).where(eq(taskComments.id, id)).returning();
    return row;
  },

  async deleteComment(id: number): Promise<boolean> {
    const rows = await db.delete(taskComments).where(eq(taskComments.id, id)).returning();
    return rows.length > 0;
  },

  // ─── Task Activity ─────────────────────────────────────────────────────

  async getActivityByTaskId(taskId: number): Promise<TaskActivity[]> {
    return db.select().from(taskActivity).where(eq(taskActivity.taskId, taskId)).orderBy(asc(taskActivity.createdAt));
  },

  async createActivity(data: InsertTaskActivity): Promise<TaskActivity> {
    const [row] = await db.insert(taskActivity).values(data as any).returning();
    return row;
  },

  // ─── Task Attachments ──────────────────────────────────────────────────

  async getAttachmentsByTaskId(taskId: number): Promise<TaskAttachment[]> {
    return db.select().from(taskAttachments).where(eq(taskAttachments.taskId, taskId)).orderBy(asc(taskAttachments.createdAt));
  },

  async getAttachmentById(id: number): Promise<TaskAttachment | undefined> {
    const [row] = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id));
    return row;
  },

  async createAttachment(data: InsertTaskAttachment): Promise<TaskAttachment> {
    const [row] = await db.insert(taskAttachments).values(data as any).returning();
    return row;
  },

  async deleteAttachment(id: number): Promise<boolean> {
    const rows = await db.delete(taskAttachments).where(eq(taskAttachments.id, id)).returning();
    return rows.length > 0;
  },

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
  },
};
