import { useState, useCallback, useRef, useMemo, Fragment } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, ChevronUp, ChevronDown, X } from "lucide-react";
import type { InvoiceRow } from "../types";
import { INVOICE_STATUS_COLORS, isOverdue } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmtAmt(val: string | number | null, currency = "EUR"): string {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function parseAmt(val: string | number | null): number {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  return isNaN(n) ? 0 : n;
}

function getMostCommonCurrency(invoices: InvoiceRow[]): string | null {
  const counts: Record<string, number> = {};
  for (const inv of invoices) {
    if (inv.currency) counts[inv.currency] = (counts[inv.currency] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  const allSame = entries.length === 1;
  if (!allSame) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

// ── Grouping helpers ───────────────────────────────────────────────────────────

function getInvoiceYear(inv: InvoiceRow): number {
  const d = inv.issued_date || inv.created_at;
  return d ? new Date(d).getFullYear() : 0;
}

function getInvoiceQuarter(inv: InvoiceRow): string {
  const d = inv.issued_date || inv.created_at;
  if (!d) return "Q4";
  const m = new Date(d).getMonth();
  return m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4";
}

const QUARTER_MONTHS: Record<string, string> = {
  Q1: "Jan–Mar", Q2: "Apr–Jun", Q3: "Jul–Sep", Q4: "Oct–Dec",
};

// ── Sort types ─────────────────────────────────────────────────────────────────

type SortKey =
  | "invoiceNum" | "title" | "account" | "status" | "currency"
  | "total" | "subtotal" | "taxAmt" | "discount"
  | "issuedDate" | "dueDate" | "sentAt" | "paidAt" | "viewedAt"
  | "viewedCount";
type SortDir = "asc" | "desc";

// ── Skeleton ───────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] bg-[#F1F1F1]/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ── Column definitions ─────────────────────────────────────────────────────────

export const INVOICE_FIELD_DEFS = [
  // ── Default visible ──
  { key: "invoiceNum",  label: "Invoice #",    visible: true  },
  { key: "title",       label: "Title",         visible: true  },
  { key: "account",     label: "Account",       visible: true  },
  { key: "status",      label: "Status",        visible: true  },
  { key: "currency",    label: "Currency",      visible: true  },
  { key: "total",       label: "Total",         visible: true  },
  { key: "issuedDate",  label: "Issued",        visible: true  },
  { key: "dueDate",     label: "Due Date",      visible: true  },
  // ── Hidden by default ──
  { key: "subtotal",    label: "Subtotal",      visible: false },
  { key: "taxPct",      label: "Tax %",         visible: false },
  { key: "taxAmt",      label: "Tax Amount",    visible: false },
  { key: "discount",    label: "Discount",      visible: false },
  { key: "sentAt",      label: "Sent Date",     visible: false },
  { key: "paidAt",      label: "Paid Date",     visible: false },
  { key: "viewedAt",    label: "Viewed Date",   visible: false },
  { key: "viewedCount", label: "Views",         visible: false },
  { key: "notes",       label: "Notes",         visible: false },
  { key: "paymentInfo", label: "Payment Info",  visible: false },
] as const;

/** Columns visible by default — use this for the initial useState value */
export const DEFAULT_INVOICE_COLS = new Set(
  INVOICE_FIELD_DEFS.filter((c) => c.visible).map((c) => c.key)
);

/** All possible columns — use this for "Show all fields" */
export const ALL_INVOICE_COLS = new Set(INVOICE_FIELD_DEFS.map((c) => c.key));

// ── Props ──────────────────────────────────────────────────────────────────────

interface InvoicesInlineTableProps {
  invoices: InvoiceRow[];
  loading: boolean;
  selectedInvoice: InvoiceRow | null;
  onSelectInvoice: (invoice: InvoiceRow) => void;
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  visibleColumns?: Set<string>;
  groupBy?: "none" | "year_quarter";
}

// ── Main component ─────────────────────────────────────────────────────────────

export function InvoicesInlineTable({
  invoices,
  loading,
  selectedInvoice,
  onSelectInvoice,
  selectedIds,
  onSelectionChange,
  visibleColumns,
  groupBy,
}: InvoicesInlineTableProps) {
  const show = (col: string) => !visibleColumns || visibleColumns.has(col);
  const CURRENT_YEAR = new Date().getFullYear();
  const orderedCols = INVOICE_FIELD_DEFS.filter(c => show(c.key)).map(c => c.key);
  const totalIdx = orderedCols.indexOf("total");
  const [sortKey, setSortKey] = useState<SortKey>("issuedDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const lastClickedIndexRef = useRef<number>(-1);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleHeaderClick = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  const sortedInvoices = useMemo(() => {
    const arr = [...invoices];
    arr.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortKey) {
        case "invoiceNum":
          aVal = a.invoice_number ?? "";
          bVal = b.invoice_number ?? "";
          break;
        case "title":
          aVal = a.title ?? "";
          bVal = b.title ?? "";
          break;
        case "account":
          aVal = a.account_name ?? "";
          bVal = b.account_name ?? "";
          break;
        case "status": {
          const aDisplay = isOverdue(a) ? "Overdue" : (a.status ?? "");
          const bDisplay = isOverdue(b) ? "Overdue" : (b.status ?? "");
          aVal = aDisplay;
          bVal = bDisplay;
          break;
        }
        case "currency":
          aVal = a.currency ?? "";
          bVal = b.currency ?? "";
          break;
        case "total":
          aVal = parseAmt(a.total);
          bVal = parseAmt(b.total);
          break;
        case "issuedDate":
          aVal = a.issued_date ? new Date(a.issued_date).getTime() : 0;
          bVal = b.issued_date ? new Date(b.issued_date).getTime() : 0;
          break;
        case "dueDate":
          aVal = a.due_date ? new Date(a.due_date).getTime() : 0;
          bVal = b.due_date ? new Date(b.due_date).getTime() : 0;
          break;
        case "subtotal":
          aVal = parseAmt(a.subtotal);
          bVal = parseAmt(b.subtotal);
          break;
        case "taxAmt":
          aVal = parseAmt(a.tax_amount);
          bVal = parseAmt(b.tax_amount);
          break;
        case "discount":
          aVal = parseAmt(a.discount_amount);
          bVal = parseAmt(b.discount_amount);
          break;
        case "sentAt":
          aVal = a.sent_at ? new Date(a.sent_at).getTime() : 0;
          bVal = b.sent_at ? new Date(b.sent_at).getTime() : 0;
          break;
        case "paidAt":
          aVal = a.paid_at ? new Date(a.paid_at).getTime() : 0;
          bVal = b.paid_at ? new Date(b.paid_at).getTime() : 0;
          break;
        case "viewedAt":
          aVal = a.viewed_at ? new Date(a.viewed_at).getTime() : 0;
          bVal = b.viewed_at ? new Date(b.viewed_at).getTime() : 0;
          break;
        case "viewedCount":
          aVal = a.viewed_count ?? 0;
          bVal = b.viewed_count ?? 0;
          break;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [invoices, sortKey, sortDir]);

  // ── Row click handler ──────────────────────────────────────────────────────
  const handleRowClick = useCallback(
    (invoice: InvoiceRow, index: number, e: React.MouseEvent) => {
      const id = invoice.id;

      if (e.shiftKey && lastClickedIndexRef.current >= 0) {
        const lo = Math.min(lastClickedIndexRef.current, index);
        const hi = Math.max(lastClickedIndexRef.current, index);
        const rangeIds = sortedInvoices.slice(lo, hi + 1).map((inv) => inv.id);
        const next = new Set(selectedIds);
        rangeIds.forEach((rid) => next.add(rid));
        onSelectionChange(next);
        if (next.size === 1) {
          const only = sortedInvoices.find((inv) => inv.id === Array.from(next)[0]);
          if (only) onSelectInvoice(only);
        }
      } else if (e.ctrlKey || e.metaKey) {
        const next = new Set(selectedIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        onSelectionChange(next);
        if (next.size === 1) {
          const only = sortedInvoices.find((inv) => inv.id === Array.from(next)[0]);
          if (only) onSelectInvoice(only);
        }
        lastClickedIndexRef.current = index;
      } else {
        onSelectionChange(new Set([id]));
        onSelectInvoice(invoice);
        lastClickedIndexRef.current = index;
      }
    },
    [sortedInvoices, selectedIds, onSelectionChange, onSelectInvoice]
  );

  // ── Checkbox toggle ────────────────────────────────────────────────────────
  const handleCheckboxClick = useCallback(
    (invoice: InvoiceRow, e: React.MouseEvent) => {
      e.stopPropagation();
      const id = invoice.id;
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange(next);
      if (next.size === 1) {
        const only = sortedInvoices.find((inv) => inv.id === Array.from(next)[0]);
        if (only) onSelectInvoice(only);
      }
    },
    [selectedIds, sortedInvoices, onSelectionChange, onSelectInvoice]
  );

  // ── Summary stats ──────────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const count = sortedInvoices.length;
    const currency = getMostCommonCurrency(sortedInvoices);
    const cur = currency ?? "EUR";

    let sumTotal = 0;
    let paidTotal = 0;
    let outstandingTotal = 0;

    for (const inv of sortedInvoices) {
      const amt = parseAmt(inv.total);
      sumTotal += amt;
      if (inv.status === "Paid") paidTotal += amt;
      if (inv.status === "Sent" || inv.status === "Viewed" || isOverdue(inv)) outstandingTotal += amt;
    }

    return { count, currency, cur, sumTotal, paidTotal, outstandingTotal };
  }, [sortedInvoices]);

  const selectionStats = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const selInvoices = sortedInvoices.filter((inv) => selectedIds.has(inv.id));
    const total = selInvoices.reduce((s, inv) => s + parseAmt(inv.total), 0);
    const cur = selInvoices[0]?.currency ?? "EUR";
    return { count: selInvoices.length, total, cur };
  }, [sortedInvoices, selectedIds]);

  // ── Grouping ───────────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (!groupBy || groupBy === "none") return null;
    const byYear = new Map<number, Map<string, InvoiceRow[]>>();
    for (const inv of sortedInvoices) {
      const y = getInvoiceYear(inv);
      const q = getInvoiceQuarter(inv);
      if (!byYear.has(y)) byYear.set(y, new Map());
      const byQ = byYear.get(y)!;
      if (!byQ.has(q)) byQ.set(q, []);
      byQ.get(q)!.push(inv);
    }
    const QQ = ["Q4", "Q3", "Q2", "Q1"];
    const result: Array<{ year: number; quarters: Array<{ q: string; rows: InvoiceRow[] }> }> = [];
    for (const [year, byQ] of Array.from(byYear.entries()).sort(([a], [b]) => b - a)) {
      const quarters = QQ.filter(q => byQ.has(q)).map(q => ({ q, rows: byQ.get(q)! }));
      result.push({ year, quarters });
    }
    return result;
  }, [sortedInvoices, groupBy]);

  // ── Collapsible group state ────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("billing-group-collapsed");
      if (!stored) return new Set<string>();
      const obj = JSON.parse(stored) as Record<string, boolean>;
      return new Set(Object.keys(obj).filter((k) => k.startsWith("invoice-") && obj[k]));
    } catch { return new Set<string>(); }
  });

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try {
        const stored = localStorage.getItem("billing-group-collapsed") || "{}";
        const obj = JSON.parse(stored) as Record<string, boolean>;
        if (next.has(key)) obj[key] = true; else delete obj[key];
        localStorage.setItem("billing-group-collapsed", JSON.stringify(obj));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ── Column count (for colSpan in group headers / subtotals) ───────────────
  const colCount = (visibleColumns ? visibleColumns.size : DEFAULT_INVOICE_COLS.size) + 1;

  // ── Sort icon helper ───────────────────────────────────────────────────────
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 inline-block ml-0.5 shrink-0" />
    ) : (
      <ChevronDown className="h-3 w-3 inline-block ml-0.5 shrink-0" />
    );
  }

  const thBase =
    "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/40 whitespace-nowrap select-none bg-[#E3E3E3] border-b border-border/20 cursor-pointer hover:text-foreground/70";

  // ── Row renderer (shared between flat and grouped views) ──────────────────
  function renderInvoiceRow(invoice: InvoiceRow, index: number) {
    const isDetailSelected = selectedInvoice?.id === invoice.id;
    const isMultiSelected = selectedIds.has(invoice.id);
    const isHighlighted = isMultiSelected || isDetailSelected;

    const displayStatus = isOverdue(invoice) ? "Overdue" : (invoice.status ?? "");
    const statusColors = INVOICE_STATUS_COLORS[displayStatus] ?? {
      bg: "#F4F4F5",
      text: "#52525B",
      dot: "#94A3B8",
    };

    const rowBg = isHighlighted ? "#FFF1C8" : "#F1F1F1";
    const rowHoverClass = isHighlighted ? "" : "hover:bg-[#F8F8F8]";

    return (
      <tr
        key={invoice.id}
        className={cn(
          "group/row cursor-pointer h-[52px]",
          rowHoverClass,
        )}
        style={{ backgroundColor: rowBg }}
        onClick={(e) => handleRowClick(invoice, index, e)}
      >
        {/* Checkbox */}
        <td
          className="sticky left-0 z-10 px-2.5"
          style={{
            width: 40,
            minWidth: 40,
            backgroundColor: isHighlighted ? "#FFF1C8" : undefined,
          }}
        >
          <div
            className={cn(
              "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
              isMultiSelected
                ? "border-[#FCB803] bg-[#FCB803]"
                : "border-border/40 group-hover/row:border-border/60"
            )}
            onClick={(e) => handleCheckboxClick(invoice, e)}
          >
            {isMultiSelected && <Check className="h-2.5 w-2.5 text-[#131B49]" />}
          </div>
        </td>

        {show("invoiceNum") && (
          <td className="px-3" style={{ width: 130, minWidth: 130 }}>
            <span className="text-[11px] font-mono text-foreground/70 truncate block">
              {invoice.invoice_number ?? <span className="text-muted-foreground/30">—</span>}
            </span>
          </td>
        )}
        {show("title") && (
          <td className="px-3" style={{ width: 200, minWidth: 200 }}>
            <span className="text-[12px] font-medium text-foreground truncate block">
              {invoice.title ?? <span className="text-muted-foreground/30 font-normal">Untitled</span>}
            </span>
          </td>
        )}
        {show("account") && (
          <td className="px-3" style={{ width: 160, minWidth: 160 }}>
            <span className="text-[11px] text-muted-foreground truncate block">
              {invoice.account_name ?? <span className="text-muted-foreground/30">—</span>}
            </span>
          </td>
        )}
        {show("status") && (
          <td className="px-3" style={{ width: 120, minWidth: 120 }}>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColors.dot }} />
              <span className="text-[11px] font-medium" style={{ color: statusColors.text }}>
                {displayStatus || "—"}
              </span>
            </div>
          </td>
        )}
        {show("currency") && (
          <td className="px-3 text-center" style={{ width: 80, minWidth: 80 }}>
            <span className="text-[11px] text-muted-foreground">
              {invoice.currency ?? <span className="text-muted-foreground/30">—</span>}
            </span>
          </td>
        )}
        {show("total") && (
          <td className="px-3 text-right" style={{ width: 110, minWidth: 110 }}>
            <span className="text-[12px] font-semibold text-foreground tabular-nums">
              {invoice.total != null
                ? fmtAmt(invoice.total, invoice.currency ?? "EUR")
                : <span className="text-muted-foreground/30 font-normal">—</span>}
            </span>
          </td>
        )}
        {show("issuedDate") && (
          <td className="px-3" style={{ width: 110, minWidth: 110 }}>
            <span className="text-[11px] text-muted-foreground">{fmtDate(invoice.issued_date)}</span>
          </td>
        )}
        {show("dueDate") && (
          <td className="px-3" style={{ width: 110, minWidth: 110 }}>
            <span className={cn("text-[11px]", isOverdue(invoice) ? "text-red-600 font-semibold" : "text-muted-foreground")}>
              {fmtDate(invoice.due_date)}
            </span>
          </td>
        )}
        {show("subtotal") && (
          <td className="px-3 text-right" style={{ width: 110, minWidth: 110 }}>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {invoice.subtotal != null ? fmtAmt(invoice.subtotal, invoice.currency ?? "EUR") : <span className="opacity-30">—</span>}
            </span>
          </td>
        )}
        {show("taxPct") && (
          <td className="px-3 text-right" style={{ width: 80, minWidth: 80 }}>
            <span className="text-[11px] text-muted-foreground">
              {invoice.tax_percent != null ? `${invoice.tax_percent}%` : <span className="opacity-30">—</span>}
            </span>
          </td>
        )}
        {show("taxAmt") && (
          <td className="px-3 text-right" style={{ width: 110, minWidth: 110 }}>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {invoice.tax_amount != null ? fmtAmt(invoice.tax_amount, invoice.currency ?? "EUR") : <span className="opacity-30">—</span>}
            </span>
          </td>
        )}
        {show("discount") && (
          <td className="px-3 text-right" style={{ width: 100, minWidth: 100 }}>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {invoice.discount_amount != null ? fmtAmt(invoice.discount_amount, invoice.currency ?? "EUR") : <span className="opacity-30">—</span>}
            </span>
          </td>
        )}
        {show("sentAt") && (
          <td className="px-3" style={{ width: 110, minWidth: 110 }}>
            <span className="text-[11px] text-muted-foreground">{fmtDate(invoice.sent_at)}</span>
          </td>
        )}
        {show("paidAt") && (
          <td className="px-3" style={{ width: 110, minWidth: 110 }}>
            {invoice.paid_at ? (
              <span className="text-[11px] font-medium" style={{ color: "#065F46" }}>{fmtDate(invoice.paid_at)}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground/30">—</span>
            )}
          </td>
        )}
        {show("viewedAt") && (
          <td className="px-3" style={{ width: 110, minWidth: 110 }}>
            <span className="text-[11px] text-muted-foreground">{fmtDate(invoice.viewed_at)}</span>
          </td>
        )}
        {show("viewedCount") && (
          <td className="px-3 text-center" style={{ width: 70, minWidth: 70 }}>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {invoice.viewed_count ?? <span className="opacity-30">0</span>}
            </span>
          </td>
        )}
        {show("notes") && (
          <td className="px-3" style={{ width: 200, minWidth: 200 }}>
            <span className="text-[11px] text-muted-foreground truncate block max-w-[188px]">
              {invoice.notes ?? <span className="opacity-30">—</span>}
            </span>
          </td>
        )}
        {show("paymentInfo") && (
          <td className="px-3" style={{ width: 180, minWidth: 180 }}>
            <span className="text-[11px] text-muted-foreground truncate block max-w-[168px]">
              {invoice.payment_info ?? <span className="opacity-30">—</span>}
            </span>
          </td>
        )}
      </tr>
    );
  }

  // ── Subtotal row renderer ──────────────────────────────────────────────────
  function renderSubtotalRow(label: string, total: number, cur: string, isBold: boolean, bgColor: string, borderClass: string) {
    return (
      <tr className={borderClass} style={{ backgroundColor: bgColor }}>
        {/* Checkbox cell */}
        <td className="px-3 py-1" style={{ width: 40, minWidth: 40 }} />
        {/* Label spans first few visible cols */}
        {show("invoiceNum") && (
          <td className="px-3 py-1">
            <span className={cn("italic", isBold ? "text-[11px] font-bold text-foreground/60" : "text-[10px] text-foreground/40")}>
              {label}
            </span>
          </td>
        )}
        {show("title") && <td className="px-3 py-1" />}
        {show("account") && <td className="px-3 py-1" />}
        {show("status") && <td className="px-3 py-1" />}
        {show("currency") && <td className="px-3 py-1" />}
        {show("total") && (
          <td className="px-3 py-1 text-right" style={{ width: 110, minWidth: 110 }}>
            <span className={cn("tabular-nums", isBold ? "text-[12px] font-bold text-foreground" : "text-[11px] font-semibold text-foreground")}>
              {fmtAmt(total, cur)}
            </span>
          </td>
        )}
        {show("issuedDate") && <td className="px-3 py-1" />}
        {show("dueDate") && <td className="px-3 py-1" />}
        {show("subtotal") && <td className="px-3 py-1" />}
        {show("taxPct") && <td className="px-3 py-1" />}
        {show("taxAmt") && <td className="px-3 py-1" />}
        {show("discount") && <td className="px-3 py-1" />}
        {show("sentAt") && <td className="px-3 py-1" />}
        {show("paidAt") && <td className="px-3 py-1" />}
        {show("viewedAt") && <td className="px-3 py-1" />}
        {show("viewedCount") && <td className="px-3 py-1" />}
        {show("notes") && <td className="px-3 py-1" />}
        {show("paymentInfo") && <td className="px-3 py-1" />}
      </tr>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">

      {/* ── Summary stats bar (TOP, above headers) ── */}
      {!loading && (
        <div className="shrink-0 flex items-center px-5 h-[52px] border-b border-border/30 bg-card">
          {/* Count */}
          <div className="flex flex-col justify-center pr-5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/35">Invoices</span>
            <span className="text-[15px] font-bold tabular-nums text-foreground leading-tight">{summaryStats.count}</span>
          </div>
          <div className="w-px h-8 bg-border/30" />
          {/* Total */}
          <div className="flex flex-col justify-center px-5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/35">Total</span>
            <span className="text-[15px] font-bold tabular-nums text-foreground leading-tight">
              {summaryStats.currency ? fmtAmt(summaryStats.sumTotal, summaryStats.cur) : "—"}
            </span>
          </div>
          <div className="w-px h-8 bg-border/30" />
          {/* Paid */}
          <div className="flex flex-col justify-center px-5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/35">Paid</span>
            <span className="text-[15px] font-bold tabular-nums leading-tight" style={{ color: "#065F46" }}>
              {summaryStats.currency ? fmtAmt(summaryStats.paidTotal, summaryStats.cur) : "—"}
            </span>
          </div>
          <div className="w-px h-8 bg-border/30" />
          {/* Outstanding */}
          <div className="flex flex-col justify-center px-5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/35">Outstanding</span>
            <span className="text-[15px] font-bold tabular-nums leading-tight" style={{ color: summaryStats.outstandingTotal > 0 ? "#9F1239" : undefined }}>
              {summaryStats.currency ? fmtAmt(summaryStats.outstandingTotal, summaryStats.cur) : "—"}
            </span>
          </div>
          {selectionStats && (
            <div className="ml-auto flex items-center gap-2 text-[12px]">
              <div className="w-px h-8 bg-border/30 mr-1" />
              <span className="font-semibold text-foreground">{selectionStats.count} selected</span>
              <span className="text-foreground/30">·</span>
              <span className="font-bold tabular-nums text-foreground">{fmtAmt(selectionStats.total, selectionStats.cur)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Table or skeleton ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto bg-[#E3E3E3]">
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 3px", minWidth: 400 }}>

            {/* Sticky header */}
            <thead className="sticky top-0 z-20">
              <tr>
                {/* Checkbox column — always visible */}
                <th
                  className={cn(thBase, "sticky left-0 z-30 text-center")}
                  style={{ width: 40, minWidth: 40 }}
                >
                  {/* no label */}
                </th>

                {show("invoiceNum") && (
                  <th className={thBase} style={{ width: 130, minWidth: 130 }} onClick={() => handleHeaderClick("invoiceNum")}>
                    Invoice # <SortIcon col="invoiceNum" />
                  </th>
                )}
                {show("title") && (
                  <th className={thBase} style={{ width: 200, minWidth: 200 }} onClick={() => handleHeaderClick("title")}>
                    Title <SortIcon col="title" />
                  </th>
                )}
                {show("account") && (
                  <th className={thBase} style={{ width: 160, minWidth: 160 }} onClick={() => handleHeaderClick("account")}>
                    Account <SortIcon col="account" />
                  </th>
                )}
                {show("status") && (
                  <th className={thBase} style={{ width: 120, minWidth: 120 }} onClick={() => handleHeaderClick("status")}>
                    Status <SortIcon col="status" />
                  </th>
                )}
                {show("currency") && (
                  <th className={cn(thBase, "text-center")} style={{ width: 80, minWidth: 80 }} onClick={() => handleHeaderClick("currency")}>
                    Currency <SortIcon col="currency" />
                  </th>
                )}
                {show("total") && (
                  <th className={cn(thBase, "text-right")} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("total")}>
                    Total <SortIcon col="total" />
                  </th>
                )}
                {show("issuedDate") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("issuedDate")}>
                    Issued <SortIcon col="issuedDate" />
                  </th>
                )}
                {show("dueDate") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("dueDate")}>
                    Due <SortIcon col="dueDate" />
                  </th>
                )}
                {show("subtotal") && (
                  <th className={cn(thBase, "text-right")} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("subtotal")}>
                    Subtotal <SortIcon col="subtotal" />
                  </th>
                )}
                {show("taxPct") && (
                  <th className={cn(thBase, "text-right")} style={{ width: 80, minWidth: 80 }}>
                    Tax %
                  </th>
                )}
                {show("taxAmt") && (
                  <th className={cn(thBase, "text-right")} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("taxAmt")}>
                    Tax Amt <SortIcon col="taxAmt" />
                  </th>
                )}
                {show("discount") && (
                  <th className={cn(thBase, "text-right")} style={{ width: 100, minWidth: 100 }} onClick={() => handleHeaderClick("discount")}>
                    Discount <SortIcon col="discount" />
                  </th>
                )}
                {show("sentAt") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("sentAt")}>
                    Sent <SortIcon col="sentAt" />
                  </th>
                )}
                {show("paidAt") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("paidAt")}>
                    Paid <SortIcon col="paidAt" />
                  </th>
                )}
                {show("viewedAt") && (
                  <th className={thBase} style={{ width: 110, minWidth: 110 }} onClick={() => handleHeaderClick("viewedAt")}>
                    Viewed <SortIcon col="viewedAt" />
                  </th>
                )}
                {show("viewedCount") && (
                  <th className={cn(thBase, "text-center")} style={{ width: 70, minWidth: 70 }} onClick={() => handleHeaderClick("viewedCount")}>
                    Views <SortIcon col="viewedCount" />
                  </th>
                )}
                {show("notes") && (
                  <th className={thBase} style={{ width: 200, minWidth: 200 }}>
                    Notes
                  </th>
                )}
                {show("paymentInfo") && (
                  <th className={thBase} style={{ width: 180, minWidth: 180 }}>
                    Payment Info
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {sortedInvoices.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="py-12 text-center text-xs text-muted-foreground">
                    No invoices found
                  </td>
                </tr>
              )}

              {!grouped ? (
                // ── Flat list ──
                sortedInvoices.map((invoice, index) => renderInvoiceRow(invoice, index))
              ) : (
                // ── Grouped by year / quarter ──
                grouped.map(({ year, quarters }) => {
                  const yearCollapsed = collapsedGroups.has(`invoice-${year}`);
                  const yearRows = quarters.flatMap(q => q.rows);
                  const yearTotal = yearRows.reduce((s, inv) => s + parseAmt(inv.total), 0);
                  const yearCur = yearRows[0]?.currency ?? "EUR";

                  return (
                    <Fragment key={year}>
                      {/* Year header */}
                      {(() => {
                        const yearBg = year >= CURRENT_YEAR ? "#DBEAFE" : "#EEF2FF";
                        const labelColSpan = totalIdx >= 0 ? totalIdx : orderedCols.length;
                        const afterTotal = totalIdx >= 0 ? orderedCols.slice(totalIdx + 1) : [];
                        return (
                          <tr style={{ backgroundColor: yearBg }} className="cursor-pointer select-none h-[44px]">
                            <td className="px-2.5" style={{ width: 40, minWidth: 40, backgroundColor: yearBg }} onClick={(e) => e.stopPropagation()}>
                              <div
                                className={cn(
                                  "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                                  yearRows.every((inv) => selectedIds.has(inv.id))
                                    ? "bg-[#FCB803] border-[#FCB803]"
                                    : yearRows.some((inv) => selectedIds.has(inv.id))
                                    ? "bg-[#FCB803]/30 border-[#FCB803]/60"
                                    : "border-border/60 hover:border-[#FCB803]/40"
                                )}
                                onClick={() => {
                                  const allYearSelected = yearRows.every((inv) => selectedIds.has(inv.id));
                                  const next = new Set(selectedIds);
                                  if (allYearSelected) {
                                    yearRows.forEach((inv) => next.delete(inv.id));
                                  } else {
                                    yearRows.forEach((inv) => next.add(inv.id));
                                  }
                                  onSelectionChange(next);
                                }}
                              >
                                {(yearRows.every((inv) => selectedIds.has(inv.id)) || yearRows.some((inv) => selectedIds.has(inv.id))) && <Check className="h-2.5 w-2.5 text-[#131B49]" />}
                              </div>
                            </td>
                            <td colSpan={labelColSpan} style={{ backgroundColor: yearBg }} onClick={() => toggleGroup(`invoice-${year}`)}>
                              <div className="flex items-center gap-1.5 px-1">
                                {yearCollapsed
                                  ? <ChevronRight className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
                                  : <ChevronDown className="h-3.5 w-3.5 text-foreground/40 shrink-0" />}
                                <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/60">{year}</span>
                              </div>
                            </td>
                            {totalIdx >= 0 && (
                              <td className="px-3 text-right" style={{ backgroundColor: yearBg }}>
                                <span className="text-[11px] font-bold text-foreground tabular-nums">
                                  {fmtAmt(yearTotal, yearCur)}
                                </span>
                              </td>
                            )}
                            {afterTotal.map((col) => (
                              <td key={col} style={{ backgroundColor: yearBg }} />
                            ))}
                          </tr>
                        );
                      })()}

                      {!yearCollapsed && quarters.map(({ q, rows }) => {
                        const qCollapsed = collapsedGroups.has(`invoice-${year}-${q}`);
                        const qTotal = rows.reduce((s, inv) => s + parseAmt(inv.total), 0);
                        const qCur = rows[0]?.currency ?? "EUR";

                        return (
                          <Fragment key={q}>
                            {/* Quarter sub-header */}
                            {(() => {
                              const qBg = "#E3E3E3";
                              const labelColSpan = totalIdx >= 0 ? totalIdx : orderedCols.length;
                              const afterTotal = totalIdx >= 0 ? orderedCols.slice(totalIdx + 1) : [];
                              return (
                                <tr style={{ backgroundColor: qBg }} className="cursor-pointer select-none h-[38px]">
                                  <td className="px-2.5" style={{ width: 40, minWidth: 40, backgroundColor: qBg }} onClick={(e) => e.stopPropagation()}>
                                    <div
                                      className={cn(
                                        "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                                        rows.every((inv) => selectedIds.has(inv.id))
                                          ? "bg-[#FCB803] border-[#FCB803]"
                                          : rows.some((inv) => selectedIds.has(inv.id))
                                          ? "bg-[#FCB803]/30 border-[#FCB803]/60"
                                          : "border-border/60 hover:border-[#FCB803]/40"
                                      )}
                                      onClick={() => {
                                        const allQSelected = rows.every((inv) => selectedIds.has(inv.id));
                                        const next = new Set(selectedIds);
                                        if (allQSelected) {
                                          rows.forEach((inv) => next.delete(inv.id));
                                        } else {
                                          rows.forEach((inv) => next.add(inv.id));
                                        }
                                        onSelectionChange(next);
                                      }}
                                    >
                                      {(rows.every((inv) => selectedIds.has(inv.id)) || rows.some((inv) => selectedIds.has(inv.id))) && <Check className="h-2.5 w-2.5 text-[#131B49]" />}
                                    </div>
                                  </td>
                                  <td colSpan={labelColSpan} style={{ backgroundColor: qBg }} onClick={() => toggleGroup(`invoice-${year}-${q}`)}>
                                    <div className="flex items-center gap-1.5 px-1">
                                      {qCollapsed
                                        ? <ChevronRight className="h-3 w-3 text-foreground/40 shrink-0" />
                                        : <ChevronDown className="h-3 w-3 text-foreground/40 shrink-0" />}
                                      <span className="text-[10px] font-semibold text-foreground/50">{q} · {QUARTER_MONTHS[q]}</span>
                                    </div>
                                  </td>
                                  {totalIdx >= 0 && (
                                    <td className="px-3 text-right" style={{ backgroundColor: qBg }}>
                                      <span className="text-[10px] font-semibold text-foreground tabular-nums">
                                        {fmtAmt(qTotal, qCur)}
                                      </span>
                                    </td>
                                  )}
                                  {afterTotal.map((col) => (
                                    <td key={col} style={{ backgroundColor: qBg }} />
                                  ))}
                                </tr>
                              );
                            })()}

                            {/* Data rows */}
                            {!qCollapsed && rows.map((invoice) => {
                              const globalIndex = sortedInvoices.indexOf(invoice);
                              return renderInvoiceRow(invoice, globalIndex);
                            })}

                          </Fragment>
                        );
                      })}

                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
