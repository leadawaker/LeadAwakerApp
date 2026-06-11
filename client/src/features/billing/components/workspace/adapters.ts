import type { ExpenseRow, InvoiceRow, ContractRow } from "../../types";
import { parseLineItems, isOverdue, INVOICE_STATUS_COLORS, CONTRACT_STATUS_COLORS } from "../../types";

export { parseLineItems, isOverdue };

// ── Numeric parsing (Drizzle numerics arrive as strings) ───────────────────────
export function parseNum(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// ── Status → token resolution (wraps the shared types.ts colour maps) ──────────
export function invoiceStatusColors(status: string) {
  return INVOICE_STATUS_COLORS[status] || { bg: "#F4F4F5", text: "#52525B", dot: "#94A3B8" };
}
export function contractStatusColors(status: string) {
  return CONTRACT_STATUS_COLORS[status] || { bg: "var(--surface)", text: "var(--mute)", dot: "var(--mute-2)" };
}

// Effective invoice status — promotes Sent/Viewed to "Overdue" past due date.
export function effectiveInvoiceStatus(inv: InvoiceRow): string {
  return isOverdue(inv) ? "Overdue" : String(inv.status || "Draft");
}

// ── Date bucket grouping for invoices / contracts (port of BillingListView) ────
export function getDateGroupKey(dateStr: string | null | undefined): string {
  if (!dateStr) return "No Date";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diff <= 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return "This Week";
    if (diff < 30) return "This Month";
    if (diff < 90) return "Last 3 Months";
    return "Older";
  } catch { return "No Date"; }
}

export const DATE_GROUP_I18N_KEYS: Record<string, string> = {
  "Today": "dateGroups.today",
  "Yesterday": "dateGroups.yesterday",
  "This Week": "dateGroups.thisWeek",
  "This Month": "dateGroups.thisMonth",
  "Last 3 Months": "dateGroups.last3Months",
  "Older": "dateGroups.older",
  "No Date": "dateGroups.noDate",
};

export const DATE_GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "No Date"];

// ── Status group ordering (for grouping cards by status) ───────────────────────
export const INVOICE_STATUS_ORDER = ["Overdue", "Sent", "Viewed", "Draft", "Paid", "Cancelled"];
export const CONTRACT_STATUS_ORDER = ["Draft", "Sent", "Viewed", "Signed", "Expired", "Cancelled"];

// ── Expense year / quarter derivation ──────────────────────────────────────────
export function expenseYear(row: ExpenseRow): number | null {
  return row.year ?? (row.date ? new Date(row.date).getFullYear() : null);
}
export function expenseQuarterNum(row: ExpenseRow): number | null {
  if (row.quarter) {
    const m = String(row.quarter).match(/([1-4])/);
    if (m) return Number(m[1]);
  }
  if (row.date) {
    const mo = new Date(row.date).getMonth();
    return mo <= 2 ? 1 : mo <= 5 ? 2 : mo <= 8 ? 3 : 4;
  }
  return null;
}

// Reclaimable BTW (voorbelasting) — only counts when deductible.
export function expenseBtw(row: ExpenseRow): number {
  return row.nlBtwDeductible ? parseNum(row.vatAmount) : 0;
}

// ── Nested year → quarter grouping for the spreadsheet (port of bExpenseGroups) ─
export type ExpenseQuarterGroup = { q: number; items: ExpenseRow[] };
export type ExpenseYearGroup = { y: number; quarters: ExpenseQuarterGroup[] };

export function groupExpensesByYearQuarter(items: ExpenseRow[]): ExpenseYearGroup[] {
  const years: Record<number, Record<number, ExpenseRow[]>> = {};
  items.forEach((e) => {
    const y = expenseYear(e) ?? 0;
    const q = expenseQuarterNum(e) ?? 0;
    (years[y] = years[y] || {})[q] = (years[y][q] || []).concat(e);
  });
  return Object.keys(years)
    .map(Number)
    .sort((a, b) => b - a)
    .map((y) => ({
      y,
      quarters: Object.keys(years[y])
        .map(Number)
        .sort((a, b) => b - a)
        .map((q) => ({ q, items: years[y][q] })),
    }));
}

// ── Currency-split sums (port of bSums) ────────────────────────────────────────
export type ExpenseSums = { exclEur: number; exclUsd: number; totalEur: number; totalUsd: number; btw: number };

export function sumExpenses(items: ExpenseRow[]): ExpenseSums {
  const s: ExpenseSums = { exclEur: 0, exclUsd: 0, totalEur: 0, totalUsd: 0, btw: 0 };
  items.forEach((e) => {
    const excl = parseNum(e.amountExclVat);
    const total = parseNum(e.totalAmount);
    if ((e.currency || "EUR") === "USD") { s.exclUsd += excl; s.totalUsd += total; }
    else { s.exclEur += excl; s.totalEur += total; }
    s.btw += expenseBtw(e);
  });
  return s;
}

// Avoid unused-import warnings if a consumer only wants the contract helper.
export type { InvoiceRow, ContractRow, ExpenseRow };
