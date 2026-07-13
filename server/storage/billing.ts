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

export const billingStorage = {
  // ─── Invoices ──────────────────────────────────────────────────────────

  async getInvoices(): Promise<Invoices[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  },

  async getInvoiceById(id: number): Promise<Invoices | undefined> {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id));
    return row;
  },

  async getInvoicesByAccountId(accountId: number): Promise<Invoices[]> {
    return db.select().from(invoices).where(eq(invoices.accountsId, accountId)).orderBy(desc(invoices.createdAt));
  },

  async getInvoiceByViewToken(token: string): Promise<Invoices | undefined> {
    const [row] = await db.select().from(invoices).where(eq(invoices.viewToken, token));
    return row;
  },

  async getInvoiceCountByAccountId(accountId: number): Promise<number> {
    const [result] = await db.select({ total: count() }).from(invoices).where(eq(invoices.accountsId, accountId));
    return result?.total ?? 0;
  },

  async createInvoice(data: InsertInvoices): Promise<Invoices> {
    const [row] = await db.insert(invoices).values(data as any).returning();
    return row;
  },

  async updateInvoice(id: number, data: Partial<InsertInvoices>): Promise<Invoices | undefined> {
    const [row] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return row;
  },

  async deleteInvoice(id: number): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id)).returning();
    return result.length > 0;
  },

  // ─── Billable booking stats (Leads.billable_booking) ────────────────────
  // Period key = booked_call_date (a booking bills in the month the call
  // happened). "Final" means the 48h no-show claim window has closed.
  // Cancellations clear booked_call_date + billable_booking engine-side, so
  // they never appear here; no-show claims keep the date but flip the flag.

  async getAccountBookingStats(
    accountId: number,
    opts: { months?: number; month?: string } = {},
  ): Promise<{
    ratePerBooking: number | null;
    months: { month: string; billable: number; pending: number; excluded: number; amount: number | null }[];
    leads?: { id: number; name: string; bookedCallDate: string; status: "billed" | "pending" | "excluded" | "unbilled"; noShowReason: string | null }[];
    existingInvoice?: { id: number; invoiceNumber: string | null; status: string | null } | null;
  }> {
    const [account] = await db
      .select({ pricePerBooking: accounts.pricePerBooking })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    const rate = account?.pricePerBooking != null ? Number(account.pricePerBooking) : null;

    if (opts.month) {
      const monthStart = `${opts.month}-01`;
      const detail = await db.execute(sql`
        SELECT id, first_name, last_name, booked_call_date, no_show_reason,
          CASE
            WHEN no_show = TRUE THEN 'excluded'
            WHEN billable_booking = TRUE AND booked_call_date + interval '48 hours' <= NOW() THEN 'billed'
            WHEN billable_booking = TRUE THEN 'pending'
            ELSE 'unbilled'
          END AS status
        FROM "p2mxx34fvbf3ll6"."Leads"
        WHERE "Accounts_id" = ${accountId}
          AND booked_call_date >= ${monthStart}::date
          AND booked_call_date < ${monthStart}::date + interval '1 month'
        ORDER BY booked_call_date ASC
      `);
      const leadRows = (detail.rows as any[]).map((r) => ({
        id: Number(r.id),
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || `Lead #${r.id}`,
        bookedCallDate: new Date(r.booked_call_date).toISOString(),
        status: r.status as "billed" | "pending" | "excluded" | "unbilled",
        noShowReason: r.no_show_reason ?? null,
      }));
      const billable = leadRows.filter((l) => l.status === "billed").length;
      const pending = leadRows.filter((l) => l.status === "pending").length;
      const excluded = leadRows.filter((l) => l.status === "excluded").length;

      const inv = await db.execute(sql`
        SELECT id, invoice_number, status
        FROM "p2mxx34fvbf3ll6"."Invoices"
        WHERE "Accounts_id" = ${accountId}
          AND period_start >= ${monthStart}::date
          AND period_start < ${monthStart}::date + interval '1 month'
        ORDER BY id ASC LIMIT 1
      `);
      const invRow = (inv.rows as any[])[0];

      return {
        ratePerBooking: rate,
        months: [{
          month: opts.month,
          billable, pending, excluded,
          amount: rate != null ? billable * rate : null,
        }],
        leads: leadRows,
        existingInvoice: invRow
          ? { id: Number(invRow.id), invoiceNumber: invRow.invoice_number ?? null, status: invRow.status ?? null }
          : null,
      };
    }

    const monthsBack = Math.min(Math.max(opts.months ?? 2, 1), 12);
    const summary = await db.execute(sql`
      SELECT to_char(date_trunc('month', booked_call_date), 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE no_show IS NOT TRUE AND billable_booking = TRUE AND booked_call_date + interval '48 hours' <= NOW()) AS billable,
        COUNT(*) FILTER (WHERE no_show IS NOT TRUE AND billable_booking = TRUE AND booked_call_date + interval '48 hours' > NOW()) AS pending,
        COUNT(*) FILTER (WHERE no_show = TRUE) AS excluded
      FROM "p2mxx34fvbf3ll6"."Leads"
      WHERE "Accounts_id" = ${accountId}
        AND booked_call_date IS NOT NULL
        AND booked_call_date >= date_trunc('month', NOW()) - make_interval(months => ${monthsBack - 1})
      GROUP BY 1
    `);
    const byMonth = new Map((summary.rows as any[]).map((r) => [r.month as string, r]));
    const months: { month: string; billable: number; pending: number; excluded: number; amount: number | null }[] = [];
    const now = new Date();
    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row = byMonth.get(key);
      const billable = row ? Number(row.billable) : 0;
      months.push({
        month: key,
        billable,
        pending: row ? Number(row.pending) : 0,
        excluded: row ? Number(row.excluded) : 0,
        amount: rate != null ? billable * rate : null,
      });
    }
    return { ratePerBooking: rate, months };
  },

  // ─── Contracts ─────────────────────────────────────────────────────────

  async getContracts(): Promise<Contracts[]> {
    return db.select().from(contracts).orderBy(desc(contracts.createdAt));
  },

  async getContractById(id: number): Promise<Contracts | undefined> {
    const [row] = await db.select().from(contracts).where(eq(contracts.id, id));
    return row;
  },

  async getContractsByAccountId(accountId: number): Promise<Contracts[]> {
    return db.select().from(contracts).where(eq(contracts.accountsId, accountId)).orderBy(desc(contracts.createdAt));
  },

  async getContractByViewToken(token: string): Promise<Contracts | undefined> {
    const [row] = await db.select().from(contracts).where(eq(contracts.viewToken, token));
    return row;
  },

  async createContract(data: InsertContracts): Promise<Contracts> {
    const [row] = await db.insert(contracts).values(data as any).returning();
    return row;
  },

  async updateContract(id: number, data: Partial<InsertContracts>): Promise<Contracts | undefined> {
    const [row] = await db.update(contracts).set(data).where(eq(contracts.id, id)).returning();
    return row;
  },

  async deleteContract(id: number): Promise<boolean> {
    const result = await db.delete(contracts).where(eq(contracts.id, id)).returning();
    return result.length > 0;
  },

  // ─── Expenses ──────────────────────────────────────────────────────────

  async getExpenses(year?: number, quarter?: string): Promise<Expenses[]> {
    const conditions = [];
    if (year) conditions.push(eq(expenses.year, year));
    if (quarter) conditions.push(eq(expenses.quarter, quarter));
    if (conditions.length > 0) {
      return await db.select().from(expenses).where(and(...conditions)).orderBy(desc(expenses.date));
    }
    return await db.select().from(expenses).orderBy(desc(expenses.date));
  },

  async createExpense(data: InsertExpenses): Promise<Expenses> {
    const [row] = await db.insert(expenses).values(data as any).returning();
    return row;
  },

  async updateExpense(id: number, data: Partial<InsertExpenses>): Promise<Expenses | undefined> {
    const [row] = await db.update(expenses).set({ ...data, updatedAt: new Date() }).where(eq(expenses.id, id)).returning();
    return row;
  },

  async deleteExpense(id: number): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
    return result.length > 0;
  },
};
