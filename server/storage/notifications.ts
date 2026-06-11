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

export const notificationsStorage = {
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
  },

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
  },

  async getNotificationById(id: number): Promise<Notifications | undefined> {
    const [row] = await db.select().from(notifications).where(eq(notifications.id, id));
    return row;
  },

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result?.total ?? 0;
  },

  async getTotalNotificationCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId));
    return result?.total ?? 0;
  },

  async createNotification(data: InsertNotifications): Promise<Notifications> {
    const [row] = await db.insert(notifications).values(data as any).returning();
    return row;
  },

  async updateNotification(id: number, data: Partial<InsertNotifications>): Promise<Notifications | undefined> {
    const [row] = await db.update(notifications).set(data as any).where(eq(notifications.id, id)).returning();
    return row;
  },

  async markAllNotificationsRead(userId: number): Promise<number> {
    const rows = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .returning({ id: notifications.id });
    return rows.length;
  },

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  },

  async deleteAllNotifications(userId: number): Promise<number> {
    const rows = await db
      .delete(notifications)
      .where(eq(notifications.userId, userId))
      .returning({ id: notifications.id });
    return rows.length;
  },

  // ─── Notification Preferences ──────────────────────────────────────────

  async getNotificationPreferences(userId: number, accountId: number): Promise<NotificationPreferences | undefined> {
    const [row] = await db
      .select()
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.accountId, accountId)))
      .limit(1);
    return row;
  },

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
  },

  // ─── Push Subscriptions ──────────────────────────────────────────────

  async getPushSubscriptionsByUser(userId: number, accountId: number): Promise<PushSubscriptionRow[]> {
    return db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.accountId, accountId)))
      .orderBy(desc(pushSubscriptions.createdAt));
  },

  async createPushSubscription(data: InsertPushSubscription): Promise<PushSubscriptionRow> {
    // Delete existing subscription for same endpoint (re-subscribe)
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint));
    const [row] = await db.insert(pushSubscriptions).values(data as any).returning();
    return row;
  },

  async getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscriptionRow | undefined> {
    const [row] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);
    return row;
  },

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<boolean> {
    const rows = await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).returning({ id: pushSubscriptions.id });
    return rows.length > 0;
  },
};
