import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReceiptText, AlertCircle, Trash2, Download, CalendarRange, X, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildEntityRows } from "@/components/crm/entityList";
import type { ExpenseRow } from "../types";
import { fetchExpenses, deleteExpense, updateExpense } from "../api/expensesApi";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpensesListViewProps {
  quarterFilter: string | null;
  yearFilter: number | null;
  searchQuery: string;
  sortBy?: "recent" | "oldest" | "amount_desc" | "amount_asc" | "name_asc" | "name_desc" | "due_asc" | "due_desc";
  selectedId: number | null;
  onSelect: (expense: ExpenseRow) => void;
  groupBy?: "none" | "year_quarter";
  groupDirection?: "asc" | "desc";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNum(val: string | null | undefined): number {
  if (!val) return 0;
  const n = parseFloat(String(val).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function fmtAmt(val: string | null | undefined, cur = "EUR"): string {
  const n = parseNum(val);
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: cur, minimumFractionDigits: 2,
  }).format(n);
}

function fmtDateShort(val: string | null | undefined): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return val;
  }
}

// ── Grouping helpers ─────────────────────────────────────────────────────────

function getExpenseYearQuarter(row: ExpenseRow): string {
  const year = row.year ?? (row.date ? new Date(row.date).getFullYear() : null);
  const quarter = row.quarter || (() => {
    if (!row.date) return null;
    const m = new Date(row.date).getMonth();
    return m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4";
  })();
  if (!year && !quarter) return "Undated";
  return `${year ?? "?"} · ${quarter ?? "?"}`;
}

function ExpenseGroupHeader({ label, count }: { label: string; count: number }) {
  const { t } = useTranslation("billing");
  const displayLabel = label === "Undated" ? t("expenses.empty.undated") : label;
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-3 pb-3" style={{ boxShadow: '0 -8px 0 8px hsl(var(--muted))' }}>
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{displayLabel}</span>
        <span className="text-foreground/20 shrink-0">{"\u2013"}</span>
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15" />
      </div>
    </div>
  );
}

// ── Expense row card ──────────────────────────────────────────────────────────

function ExpenseListRow({
  row,
  isSelected,
  onClick,
  checked,
  onToggleCheck,
}: {
  row: ExpenseRow;
  isSelected: boolean;
  onClick: () => void;
  checked: boolean;
  onToggleCheck: () => void;
}) {
  const { t } = useTranslation("billing");
  const currency = row.currency || "EUR";
  const hasDescription = !!(row.description && row.description.trim());
  const hasPdf = !!row.pdfPath;

  // Derive category from quarter + year (e.g. "Q1 2026") or country
  const category = (() => {
    const q = row.quarter || (() => {
      if (!row.date) return null;
      const m = new Date(row.date).getMonth();
      return m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4";
    })();
    const y = row.year ?? (row.date ? new Date(row.date).getFullYear() : null);
    if (q && y) return `${q} ${y}`;
    if (q) return q;
    return null;
  })();

  // Status: BTW deductible or not
  const statusLabel = row.nlBtwDeductible
    ? t("expenses.status.deductible", "BTW Deductible")
    : t("expenses.status.notDeductible", "Non-deductible");
  const statusColor = row.nlBtwDeductible
    ? "bg-emerald-50 text-emerald-700"
    : "bg-foreground/[0.06] text-foreground/50";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      data-expense-id={row.id}
      className={cn(
        "group/exp w-full text-left rounded-xl px-2.5 pt-2.5 pb-2 transition-colors cursor-pointer",
        checked ? "bg-highlight-selected" : isSelected ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Selection checkbox — appears on hover or when checked */}
        <button
          type="button"
          aria-label="Select expense"
          onClick={(e) => { e.stopPropagation(); onToggleCheck(); }}
          className={cn(
            "h-[34px] w-[18px] shrink-0 flex items-center justify-center text-foreground/40 hover:text-foreground transition-opacity",
            checked ? "opacity-100" : "opacity-0 group-hover/exp:opacity-100"
          )}
        >
          {checked ? <CheckSquare className="h-4 w-4 text-[var(--wine)]" /> : <Square className="h-4 w-4" />}
        </button>
        {/* Avatar */}
        <div className="h-[34px] w-[34px] rounded-full shrink-0 flex items-center justify-center bg-foreground/[0.08] border border-black/[0.125]">
          <ReceiptText className="h-4 w-4 text-foreground/40" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: Description / Supplier (left) + Total amount (right) */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[16px] font-semibold font-heading text-foreground truncate">
              {hasDescription ? row.description : (row.supplier || t("expenses.unknown"))}
            </span>
            <span className="text-[12px] font-bold text-foreground shrink-0 tabular-nums">
              {fmtAmt(row.totalAmount, currency)}
            </span>
          </div>

          {/* Row 2: Supplier (if description shown above) / Category */}
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <span className="text-[11px] text-muted-foreground truncate">
              {hasDescription ? (row.supplier || "") : ""}
            </span>
            {category && (
              <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                {category}
              </span>
            )}
          </div>

          {/* Row 3: Date (left) + Status badge + PDF indicator (right) */}
          <div className="flex items-center justify-between gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground/70 tabular-nums">
              {fmtDateShort(row.date)}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <span className={cn(
                "inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                statusColor
              )}>
                {statusLabel}
              </span>
              {hasPdf && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-indigo/10 text-brand-indigo">
                  PDF
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ExpensesListView({
  quarterFilter,
  yearFilter,
  searchQuery,
  sortBy = "recent",
  selectedId,
  onSelect,
  groupBy = "none",
  groupDirection = "desc",
}: ExpensesListViewProps) {
  const { t } = useTranslation("billing");
  const { data, isLoading, isError, error } = useQuery<ExpenseRow[]>({
    queryKey: ["expenses"],
    queryFn: async () => fetchExpenses(),
    staleTime: 1000 * 60 * 5,
  });

  const expenses = data ?? [];

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    let result = expenses;

    if (quarterFilter) {
      result = result.filter((r) => {
        const q = r.quarter || (() => {
          if (!r.date) return null;
          const m = new Date(r.date).getMonth();
          return m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4";
        })();
        return q === quarterFilter;
      });
    }
    if (yearFilter) {
      result = result.filter((r) => {
        const y = r.year ?? (r.date ? new Date(r.date).getFullYear() : null);
        return y === yearFilter;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        (r.supplier || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.invoiceNumber || "").toLowerCase().includes(q) ||
        (r.notes || "").toLowerCase().includes(q)
      );
    }

    // Sort based on sortBy
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "amount_desc":
          return parseNum(b.totalAmount) - parseNum(a.totalAmount);
        case "amount_asc":
          return parseNum(a.totalAmount) - parseNum(b.totalAmount);
        case "name_asc":
          return (a.supplier || "").localeCompare(b.supplier || "");
        case "name_desc":
          return (b.supplier || "").localeCompare(a.supplier || "");
        case "oldest":
          return (a.date || "").localeCompare(b.date || "");
        default: // "recent"
          return (b.date || "").localeCompare(a.date || "");
      }
    });
  }, [expenses, quarterFilter, yearFilter, searchQuery, sortBy]);

  // ── Grouped items (year·quarter) ────────────────────────────────────────────

  type ListItem =
    | { kind: "header"; label: string; count: number }
    | { kind: "expense"; expense: ExpenseRow };

  const groupedItems = useMemo((): ListItem[] => {
    if (groupBy !== "year_quarter" || filteredExpenses.length === 0) return [];
    // Groups sorted by year·quarter ascending; groupDirection reverses to desc.
    return buildEntityRows<ExpenseRow, ListItem>({
      items: filteredExpenses,
      groupKeyOf: getExpenseYearQuarter,
      groupDirection,
      orderGroups: (keys) => [...keys].sort((a, b) => a.localeCompare(b)),
      makeHeader: (label, count) => ({ kind: "header", label, count }),
      makeItem: (expense) => ({ kind: "expense", expense }),
    });
  }, [filteredExpenses, groupBy, groupDirection]);

  // ── Multi-select + bulk actions ──────────────────────────────────────────────
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodQuarter, setPeriodQuarter] = useState("");
  const [periodYear, setPeriodYear] = useState("");

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => { setSelectedIds(new Set()); setConfirmDelete(false); }, []);

  const selectedRows = useMemo(
    () => filteredExpenses.filter((r) => selectedIds.has(r.id)),
    [filteredExpenses, selectedIds],
  );
  const allVisibleSelected = filteredExpenses.length > 0 && filteredExpenses.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(filteredExpenses.map((r) => r.id)));
  }, [allVisibleSelected, filteredExpenses]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteExpense(id)));
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      clearSelection();
    } finally { setBusy(false); }
  }, [selectedIds, queryClient, clearSelection]);

  const handleBulkSetPeriod = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const patch: Record<string, unknown> = {};
    if (periodQuarter) patch.quarter = periodQuarter;
    if (periodYear) patch.year = Number(periodYear);
    if (Object.keys(patch).length === 0) return;
    setBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => updateExpense(id, patch)));
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setPeriodOpen(false);
      setPeriodQuarter(""); setPeriodYear("");
      clearSelection();
    } finally { setBusy(false); }
  }, [selectedIds, periodQuarter, periodYear, queryClient, clearSelection]);

  const handleExportCsv = useCallback(() => {
    if (selectedRows.length === 0) return;
    const cols: [string, (r: ExpenseRow) => string][] = [
      ["Date", (r) => r.date || ""],
      ["Supplier", (r) => r.supplier || ""],
      ["Description", (r) => r.description || ""],
      ["Invoice #", (r) => r.invoiceNumber || ""],
      ["Country", (r) => r.country || ""],
      ["Currency", (r) => r.currency || ""],
      ["Amount excl VAT", (r) => r.amountExclVat || ""],
      ["VAT %", (r) => r.vatRatePct || ""],
      ["VAT amount", (r) => r.vatAmount || ""],
      ["Total", (r) => r.totalAmount || ""],
      ["Quarter", (r) => r.quarter || ""],
      ["Year", (r) => (r.year != null ? String(r.year) : "")],
      ["BTW deductible", (r) => (r.nlBtwDeductible ? "yes" : "no")],
      ["Notes", (r) => r.notes || ""],
    ];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [
      cols.map((c) => esc(c[0])).join(","),
      ...selectedRows.map((r) => cols.map((c) => esc(c[1](r))).join(",")),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedRows]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-7 w-7 text-rose-400" />
        <p className="text-xs text-muted-foreground">
          {(error as Error)?.message || t("expenses.empty.couldNotLoad")}
        </p>
      </div>
    );
  }

  if (filteredExpenses.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <ReceiptText className="h-7 w-7 text-foreground/20" />
        <p className="text-xs text-muted-foreground">
          {searchQuery ? t("expenses.empty.noExpensesMatchSearch") : t("expenses.empty.noExpensesFound")}
        </p>
      </div>
    );
  }

  const listContent =
    groupBy === "year_quarter" && groupedItems.length > 0 ? (
      <div className="flex-1 overflow-y-auto p-[3px] flex flex-col gap-[3px]">
        {groupedItems.map((item) =>
          item.kind === "header" ? (
            <ExpenseGroupHeader key={`h-${item.label}`} label={item.label} count={item.count} />
          ) : (
            <ExpenseListRow
              key={item.expense.id}
              row={item.expense}
              isSelected={item.expense.id === selectedId}
              onClick={() => onSelect(item.expense)}
              checked={selectedIds.has(item.expense.id)}
              onToggleCheck={() => toggleSelect(item.expense.id)}
            />
          )
        )}
      </div>
    ) : (
      <div className="flex-1 overflow-y-auto p-[3px] flex flex-col gap-[3px]">
        {filteredExpenses.map((row) => (
          <ExpenseListRow
            key={row.id}
            row={row}
            isSelected={row.id === selectedId}
            onClick={() => onSelect(row)}
            checked={selectedIds.has(row.id)}
            onToggleCheck={() => toggleSelect(row.id)}
          />
        ))}
      </div>
    );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {selectedIds.size > 0 && (
        <div className="shrink-0 mx-[3px] mb-[3px] flex items-center gap-1.5 rounded-xl bg-[var(--wine)] px-2.5 py-2 text-white shadow-sm">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-[12px] font-semibold"
            title={t("expenses.bulk.selectAll", "Select all")}
          >
            {allVisibleSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {t("expenses.table.summary.selected", { count: selectedIds.size })}
          </button>
          <div className="flex-1" />

          {/* Set quarter / year */}
          <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
            <PopoverTrigger asChild>
              <button type="button" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50">
                <CalendarRange className="h-3.5 w-3.5" />
                {t("expenses.bulk.setPeriod", "Set quarter/year")}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3 bg-white">
              <p className="text-[11px] font-semibold text-foreground mb-2">{t("expenses.bulk.setPeriod", "Set quarter/year")}</p>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("expenses.bulk.quarter", "Quarter")}</label>
                  <div className="mt-1 flex gap-1">
                    {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setPeriodQuarter((p) => (p === q ? "" : q))}
                        className={cn(
                          "flex-1 rounded-md border px-1.5 py-1 text-[11px] font-medium transition-colors",
                          periodQuarter === q ? "border-[var(--wine)] bg-[var(--wine)] text-white" : "border-border text-foreground hover:bg-muted/60",
                        )}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("expenses.bulk.year", "Year")}</label>
                  <input
                    type="number"
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                    placeholder="2026"
                    className="mt-1 w-full h-8 rounded-md border border-border px-2 text-[12px] outline-none focus:border-[var(--wine)]"
                    style={{ background: "var(--bg)" }}
                  />
                </div>
                <button
                  type="button"
                  disabled={busy || (!periodQuarter && !periodYear)}
                  onClick={handleBulkSetPeriod}
                  className="mt-1 h-8 rounded-md bg-[var(--wine)] text-white text-[12px] font-medium disabled:opacity-50"
                >
                  {t("expenses.bulk.apply", "Apply")}
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Export CSV */}
          <button type="button" onClick={handleExportCsv} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50">
            <Download className="h-3.5 w-3.5" />
            {t("expenses.bulk.export", "Export CSV")}
          </button>

          {/* Delete (inline confirm) */}
          {confirmDelete ? (
            <div className="inline-flex items-center gap-1 text-[11px]">
              <span className="font-medium">{t("expenses.bulk.confirmDelete", { count: selectedIds.size, defaultValue: "Delete {{count}}?" })}</span>
              <button type="button" disabled={busy} onClick={handleBulkDelete} className="rounded-lg bg-white px-2 py-1 font-semibold text-[var(--wine)] disabled:opacity-50">{t("expenses.bulk.confirm", "Yes")}</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg bg-white/15 hover:bg-white/25 px-2 py-1">{t("expenses.bulk.cancel", "No")}</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />
              {t("expenses.bulk.delete", "Delete")}
            </button>
          )}

          {/* Clear */}
          <button type="button" onClick={clearSelection} title={t("expenses.bulk.clear", "Clear")} className="rounded-lg hover:bg-white/20 p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {listContent}
    </div>
  );
}

// ── Export raw data hook for parent to find latest ────────────────────────────
export function useExpensesData(enabled = true) {
  return useQuery<ExpenseRow[]>({
    queryKey: ["expenses"],
    queryFn: async () => fetchExpenses(),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}
