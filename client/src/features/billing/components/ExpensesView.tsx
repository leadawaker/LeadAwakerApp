import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronRight, ReceiptText, AlertCircle, FileText, Check } from "lucide-react";
import type { ExpenseRow } from "../types";
import { fetchExpenses } from "../api/expensesApi";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortField = "date" | "supplier" | "description" | "amountExclVat" | "vatRatePct" | "totalAmount";

interface ExpensesViewProps {
  quarterFilter: string | null;
  yearFilter: number | null;
  searchQuery?: string;
  selectedIds?: Set<number>;
  onSelectionChange?: (ids: Set<number>) => void;
  groupBy?: "none" | "year_quarter";
  exportTrigger?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(val: string | null | undefined): string {
  if (!val || val === "" || val === "0") return "—";
  const n = parseFloat(val.replace(",", "."));
  if (isNaN(n)) return val;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function parseNum(val: string | null | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function fmtCur(n: number, cur: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: 2 }).format(n);
}

function groupByCurrency(rows: ExpenseRow[]) {
  const map = new Map<string, { exclVat: number; total: number; nlBtw: number }>();
  for (const r of rows) {
    const cur = r.currency || "EUR";
    if (!map.has(cur)) map.set(cur, { exclVat: 0, total: 0, nlBtw: 0 });
    const e = map.get(cur)!;
    e.exclVat += parseNum(r.amountExclVat);
    e.total   += parseNum(r.totalAmount);
    e.nlBtw   += r.nlBtwDeductible ? parseNum(r.vatAmount) : 0;
  }
  return Array.from(map.entries());
}

function getExpenseYear(r: ExpenseRow): number {
  return r.year ?? (r.date ? new Date(r.date).getFullYear() : 0);
}

function getExpenseQuarter(r: ExpenseRow): string {
  if (r.quarter) return r.quarter;
  if (!r.date) return "Q1";
  const m = new Date(r.date).getMonth();
  return m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4";
}

const CURRENT_YEAR = new Date().getFullYear();

const QUARTER_MONTHS: Record<string, string> = {
  Q1: "Jan–Mar",
  Q2: "Apr–Jun",
  Q3: "Jul–Sep",
  Q4: "Oct–Dec",
};

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: Array<{ key: string; label: string; sortable: boolean; align?: "right" }> = [
  { key: "date",            label: "Date",        sortable: true  },
  { key: "supplier",        label: "Supplier",    sortable: true  },
  { key: "description",     label: "Description", sortable: true  },
  { key: "invoiceNumber",   label: "Invoice #",   sortable: false },
  { key: "amountExclVat",   label: "Excl. VAT",   sortable: true,  align: "right" },
  { key: "vatRatePct",      label: "VAT %",       sortable: true,  align: "right" },
  { key: "totalAmount",     label: "Total",       sortable: true,  align: "right" },
  { key: "nlBtwDeductible", label: "NL BTW",      sortable: false, align: "right" },
  { key: "notes",           label: "Notes",       sortable: false  },
  { key: "pdf",             label: "PDF",         sortable: false, align: "right" },
];

// ── Data Row ──────────────────────────────────────────────────────────────────

function ExpenseDataRow({
  row,
  i,
  hasSelection,
  isSelected,
  toggleRow,
}: {
  row: ExpenseRow;
  i: number;
  hasSelection: boolean;
  isSelected: (id: number) => boolean;
  toggleRow: (id: number) => void;
}) {
  const sel = isSelected(row.id);
  return (
    <tr
      key={row.id ?? i}
      onClick={hasSelection ? () => toggleRow(row.id) : undefined}
      className={cn(
        "h-[52px] transition-colors",
        hasSelection && "cursor-pointer",
        !sel && "hover:bg-card-hover"
      )}
      style={{ backgroundColor: sel ? "#FFF1C8" : "#F1F1F1" }}
    >
      {hasSelection && (
        <td
          className="px-3 py-0 w-10"
          style={{ backgroundColor: sel ? "#FFF1C8" : undefined }}
        >
          <div
            className={cn(
              "h-4 w-4 rounded border flex items-center justify-center transition-colors",
              sel
                ? "bg-[#FCB803] border-[#FCB803]"
                : "border-border/60"
            )}
          >
            {sel && <Check className="h-2.5 w-2.5 text-[#131B49]" />}
          </div>
        </td>
      )}
      <td className="px-3 py-0 whitespace-nowrap text-foreground/60">{row.date || "—"}</td>
      <td className="px-3 py-0 font-medium text-foreground max-w-[140px] truncate">{row.supplier || "—"}</td>
      <td className="px-3 py-0 text-foreground/70 max-w-[200px] truncate">{row.description || "—"}</td>
      <td className="px-3 py-0 text-foreground/50 whitespace-nowrap font-mono text-[11px]">{row.invoiceNumber || "—"}</td>
      <td className="px-3 py-0 text-right tabular-nums text-foreground">{fmtCur(parseNum(row.amountExclVat), row.currency || "EUR")}</td>
      <td className="px-3 py-0 text-right tabular-nums text-foreground/60">{row.vatRatePct ? `${row.vatRatePct}%` : "—"}</td>
      <td className="px-3 py-0 text-right tabular-nums font-semibold text-foreground">{fmtCur(parseNum(row.totalAmount), row.currency || "EUR")}</td>
      <td className="px-3 py-0 text-right">
        {row.nlBtwDeductible ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            {fmtCur(parseNum(row.vatAmount), row.currency || "EUR")}
          </span>
        ) : (
          <span className="text-foreground/20">—</span>
        )}
      </td>
      <td className="px-3 py-0 text-foreground/40 max-w-[120px] truncate text-[11px]">{row.notes || "—"}</td>
      <td className="px-3 py-0 text-right">
        {row.pdfPath ? (
          <a
            href={`/api/expenses/${row.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-brand-indigo/10 text-brand-indigo/50 hover:text-brand-indigo transition-colors"
            title="View PDF"
          >
            <FileText className="h-4 w-4" />
          </a>
        ) : (
          <span className="text-foreground/20">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ExpensesView({
  quarterFilter,
  yearFilter,
  searchQuery = "",
  selectedIds,
  onSelectionChange,
  groupBy = "none",
  exportTrigger,
}: ExpensesViewProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const hasSelection = !!onSelectionChange;

  // ── Fetch ─────────────────────────────────────────────────────────────────
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
        if (r.quarter) return r.quarter === quarterFilter;
        if (!r.date) return false;
        const m = new Date(r.date).getMonth();
        return (m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4") === quarterFilter;
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
    return result;
  }, [expenses, quarterFilter, yearFilter, searchQuery]);

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!filteredExpenses.length) return [];
    return [...filteredExpenses].sort((a, b) => {
      const av = (a as any)[sortField] ?? "";
      const bv = (b as any)[sortField] ?? "";
      if (["amountExclVat", "vatRatePct", "totalAmount"].includes(sortField)) {
        const an = parseNum(av);
        const bn = parseNum(bv);
        return sortDir === "asc" ? an - bn : bn - an;
      }
      const as_ = String(av);
      const bs_ = String(bv);
      return sortDir === "asc" ? as_.localeCompare(bs_) : bs_.localeCompare(as_);
    });
  }, [filteredExpenses, sortField, sortDir]);

  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }, [sortField]);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const isSelected = useCallback((id: number) => selectedIds?.has(id) ?? false, [selectedIds]);

  const toggleRow = useCallback((id: number) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const allSelected = sorted.length > 0 && sorted.every((r) => selectedIds?.has(r.id));
  const someSelected = !allSelected && sorted.some((r) => selectedIds?.has(r.id));

  const toggleAll = useCallback(() => {
    if (!onSelectionChange || !selectedIds) return;
    if (allSelected) {
      const next = new Set(selectedIds);
      sorted.forEach((r) => next.delete(r.id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      sorted.forEach((r) => next.add(r.id));
      onSelectionChange(next);
    }
  }, [allSelected, sorted, selectedIds, onSelectionChange]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalCount    = filteredExpenses.length;
  const totalSpend    = filteredExpenses.reduce((s, r) => s + parseNum(r.totalAmount), 0);
  const totalExclVat  = filteredExpenses.reduce((s, r) => s + parseNum(r.amountExclVat), 0);
  const totalNlBtw    = filteredExpenses.reduce((s, r) => s + (r.nlBtwDeductible ? parseNum(r.vatAmount) : 0), 0);

  const fmtEur = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);

  // ── Footer totals by currency (flat view) ──────────────────────────────────
  const footerByCurrency = useMemo(() => {
    const map = new Map<string, { exclVat: number; vatAmt: number; total: number; nlBtw: number }>();
    for (const r of filteredExpenses) {
      const cur = r.currency || "EUR";
      if (!map.has(cur)) map.set(cur, { exclVat: 0, vatAmt: 0, total: 0, nlBtw: 0 });
      const entry = map.get(cur)!;
      entry.exclVat += parseNum(r.amountExclVat);
      entry.vatAmt  += parseNum(r.vatAmount);
      entry.total   += parseNum(r.totalAmount);
      entry.nlBtw   += r.nlBtwDeductible ? parseNum(r.vatAmount) : 0;
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredExpenses]);

  // ── Grouped data ──────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (groupBy !== "year_quarter") return null;
    const byYear = new Map<number, Map<string, ExpenseRow[]>>();
    for (const r of sorted) {
      const y = getExpenseYear(r);
      const q = getExpenseQuarter(r);
      if (!byYear.has(y)) byYear.set(y, new Map());
      const byQ = byYear.get(y)!;
      if (!byQ.has(q)) byQ.set(q, []);
      byQ.get(q)!.push(r);
    }
    const QQ = ["Q4", "Q3", "Q2", "Q1"];
    const result: Array<{
      year: number;
      quarters: Array<{ q: string; rows: ExpenseRow[] }>;
    }> = [];
    for (const [year, byQ] of Array.from(byYear.entries()).sort(([a], [b]) => b - a)) {
      const quarters = QQ
        .filter((q) => byQ.has(q))
        .map((q) => ({ q, rows: byQ.get(q)! }));
      result.push({ year, quarters });
    }
    return result;
  }, [sorted, groupBy]);

  // ── Collapsible group state (localStorage persistent) ──────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("billing-group-collapsed");
      if (!stored) return new Set<string>();
      const obj = JSON.parse(stored) as Record<string, boolean>;
      return new Set(Object.keys(obj).filter((k) => k.startsWith("expense-") && obj[k]));
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

  const totalColCount = COLUMNS.length + (hasSelection ? 1 : 0);

  // ── Print / Export PDF ─────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const rows = filteredExpenses;
    const reportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const filterLabel = [
      yearFilter ? String(yearFilter) : null,
      quarterFilter ?? null,
    ].filter(Boolean).join(" · ") || "All periods";

    // Build grouped rows HTML if grouped
    const buildGroupedRows = () => {
      if (!grouped) return rows.map((r) => `
        <tr>
          <td>${r.date || "—"}</td>
          <td>${r.supplier || "—"}</td>
          <td>${r.description || "—"}</td>
          <td>${r.invoiceNumber || "—"}</td>
          <td style="text-align:right">${fmtAmt(r.amountExclVat)}</td>
          <td style="text-align:right">${r.vatRatePct ? r.vatRatePct + "%" : "—"}</td>
          <td style="text-align:right;font-weight:600">${fmtAmt(r.totalAmount)}</td>
          <td style="text-align:right;color:#065F46">${r.nlBtwDeductible ? fmtAmt(r.vatAmount) : "—"}</td>
        </tr>`).join("");

      return grouped.map(({ year, quarters }) => {
        const yearRows = quarters.flatMap((qg) => qg.rows);
        const yearCurrencies = groupByCurrency(yearRows);
        return `
          <tr class="yr-hdr"><td colspan="8"><strong>${year}</strong></td></tr>
          ${quarters.map(({ q, rows: qRows }) => {
            const qCurrencies = groupByCurrency(qRows);
            return `
              <tr class="q-hdr"><td colspan="8">${q} · ${QUARTER_MONTHS[q]}</td></tr>
              ${qRows.map((r) => `
                <tr>
                  <td>${r.date || "—"}</td>
                  <td>${r.supplier || "—"}</td>
                  <td>${r.description || "—"}</td>
                  <td>${r.invoiceNumber || "—"}</td>
                  <td style="text-align:right">${fmtAmt(r.amountExclVat)}</td>
                  <td style="text-align:right">${r.vatRatePct ? r.vatRatePct + "%" : "—"}</td>
                  <td style="text-align:right;font-weight:600">${fmtAmt(r.totalAmount)}</td>
                  <td style="text-align:right;color:#065F46">${r.nlBtwDeductible ? fmtAmt(r.vatAmount) : "—"}</td>
                </tr>`).join("")}
              ${qCurrencies.map(([cur, t]) => `
                <tr class="subtotal">
                  <td colspan="4" style="font-style:italic;color:#666">Total ${cur} · ${q}</td>
                  <td style="text-align:right">${fmtCur(t.exclVat, cur)}</td>
                  <td></td>
                  <td style="text-align:right;font-weight:600">${fmtCur(t.total, cur)}</td>
                  <td style="text-align:right;color:#065F46">${t.nlBtw > 0 ? fmtCur(t.nlBtw, cur) : "—"}</td>
                </tr>`).join("")}`;
          }).join("")}
          ${yearCurrencies.map(([cur, t]) => `
            <tr class="yr-total">
              <td colspan="4"><strong>Total ${cur} · ${year}</strong></td>
              <td style="text-align:right;font-weight:700">${fmtCur(t.exclVat, cur)}</td>
              <td></td>
              <td style="text-align:right;font-weight:700">${fmtCur(t.total, cur)}</td>
              <td style="text-align:right;font-weight:700;color:#065F46">${t.nlBtw > 0 ? fmtCur(t.nlBtw, cur) : "—"}</td>
            </tr>`).join("")}`;
      }).join("");
    };

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Expenses Report</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
  .stats { display: flex; gap: 24px; margin-bottom: 20px; padding: 12px 16px; background: #f5f5f5; border-radius: 6px; }
  .stat label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin-bottom: 2px; }
  .stat value { font-size: 16px; font-weight: 700; }
  .stat.btw value { color: #065F46; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #999; padding: 6px 8px; border-bottom: 2px solid #e5e5e5; background: #fafafa; }
  td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  tr.yr-hdr td { background: #E9E9E9; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; padding: 5px 8px; }
  tr.q-hdr td { background: #EDEDED; font-weight: 600; font-size: 10px; padding: 4px 12px; color: #555; }
  tr.subtotal td { background: #F7F7F7; }
  tr.yr-total td { background: #EDEDED; border-top: 2px solid #ddd; }
  @media print { @page { margin: 1.5cm; } }
</style></head><body>
<h1>Expenses Report</h1>
<div class="meta">${reportDate} · ${filterLabel} · ${totalCount} record${totalCount !== 1 ? "s" : ""}</div>
<div class="stats">
  <div class="stat"><label>Expenses</label><value>${totalCount}</value></div>
  <div class="stat"><label>Total Spend</label><value>${fmtEur(totalSpend)}</value></div>
  <div class="stat"><label>Excl. VAT</label><value>${fmtEur(totalExclVat)}</value></div>
  <div class="stat btw"><label>BTW Deductible</label><value>${fmtEur(totalNlBtw)}</value></div>
</div>
<table>
  <thead><tr>
    <th>Date</th><th>Supplier</th><th>Description</th><th>Invoice #</th>
    <th style="text-align:right">Excl. VAT</th><th style="text-align:right">VAT %</th>
    <th style="text-align:right">Total</th><th style="text-align:right">NL BTW</th>
  </tr></thead>
  <tbody>${buildGroupedRows()}</tbody>
</table>
</body></html>`;

    const win = window.open("", "_blank", "width=960,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  }, [filteredExpenses, grouped, yearFilter, quarterFilter, totalCount, totalSpend, totalExclVat, totalNlBtw]);

  // ── exportTrigger effect ───────────────────────────────────────────────────
  const prevExportTrigger = useRef(0);
  useEffect(() => {
    if (exportTrigger && exportTrigger !== prevExportTrigger.current) {
      prevExportTrigger.current = exportTrigger;
      handlePrint();
    }
  }, [exportTrigger, handlePrint]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card">

      {/* ── Summary topbar ── */}
      {!isLoading && !isError && totalCount > 0 && (
        <div className="shrink-0 px-5 py-3 border-b border-border/30 flex items-center gap-6">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/35 block">Expenses</span>
            <span className="text-[15px] font-bold tabular-nums text-foreground">{totalCount}</span>
          </div>
          <div className="w-px h-8 bg-border/30" />
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/35 block">Total Spend</span>
            <span className="text-[15px] font-bold tabular-nums text-foreground">{fmtEur(totalSpend)}</span>
          </div>
          <div className="w-px h-8 bg-border/30" />
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/35 block">Excl. VAT</span>
            <span className="text-[15px] font-bold tabular-nums text-foreground">{fmtEur(totalExclVat)}</span>
          </div>
          <div className="w-px h-8 bg-border/30" />
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-700/60 block">BTW Deductible</span>
            <span className="text-[15px] font-bold tabular-nums text-emerald-700">{fmtEur(totalNlBtw)}</span>
          </div>
          {(quarterFilter || yearFilter) && (
            <>
              <div className="w-px h-8 bg-border/30" />
              <div className="flex items-center gap-1.5">
                {yearFilter && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-indigo/8 text-brand-indigo">
                    {yearFilter}
                  </span>
                )}
                {quarterFilter && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-indigo/8 text-brand-indigo">
                    {quarterFilter}
                  </span>
                )}
              </div>
            </>
          )}
          {hasSelection && selectedIds && selectedIds.size > 0 && (() => {
              const selExpenses = filteredExpenses.filter((r) => selectedIds.has(r.id));
              const selTotal = selExpenses.reduce((s, r) => s + parseNum(r.totalAmount), 0);
              const selBtw = selExpenses.reduce((s, r) => s + (r.nlBtwDeductible ? parseNum(r.vatAmount) : 0), 0);
              return (
                <div className="ml-auto flex items-center gap-2 text-[12px]">
                  <div className="w-px h-8 bg-border/30 mr-1" />
                  <span className="font-semibold text-foreground">{selectedIds.size} selected</span>
                  <span className="text-foreground/30">·</span>
                  <span className="font-bold tabular-nums text-foreground">{fmtEur(selTotal)}</span>
                  {selBtw > 0 && (
                    <>
                      <span className="text-foreground/30">·</span>
                      <span className="font-semibold tabular-nums text-emerald-700">{fmtEur(selBtw)} BTW</span>
                    </>
                  )}
                </div>
              );
            })()}
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <p className="text-sm font-semibold text-foreground/70">Could not load expenses</p>
            <p className="text-xs text-muted-foreground">{(error as Error)?.message}</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <ReceiptText className="h-8 w-8 text-foreground/20" />
            <p className="text-sm font-medium text-foreground/40">No expenses found</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-[#E3E3E3]">
            <table className="w-full text-[12px]" style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>

              {/* Header */}
              <thead className="sticky top-0 z-10 bg-[#E3E3E3] border-b border-border/30">
                <tr>
                  {hasSelection && (
                    <th className="w-10 px-3 py-2.5">
                      <button
                        onClick={toggleAll}
                        className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                          allSelected
                            ? "bg-[#FCB803] border-[#FCB803]"
                            : someSelected
                            ? "bg-[#FCB803]/30 border-[#FCB803]/60"
                            : "border-border/60 hover:border-[#FCB803]/40"
                        )}
                      >
                        {(allSelected || someSelected) && <Check className="h-2.5 w-2.5 text-[#131B49]" />}
                      </button>
                    </th>
                  )}
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={col.sortable ? () => handleSort(col.key as SortField) : undefined}
                      className={cn(
                        "py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-foreground/40 whitespace-nowrap",
                        col.sortable && "cursor-pointer hover:text-foreground/60 select-none",
                        col.align === "right" ? "text-right" : "text-left"
                      )}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {col.label}
                        {col.sortable && sortField === col.key && (
                          sortDir === "asc"
                            ? <ChevronUp className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body — grouped or flat */}
              {grouped ? (
                <tbody>
                  {grouped.map(({ year, quarters }) => {
                    const yearRows = quarters.flatMap((qg) => qg.rows);
                    const yearCurrencies = groupByCurrency(yearRows);
                    const yearCollapsed = collapsedGroups.has(`expense-${year}`);
                    return (
                      <>
                        {/* Year header */}
                        {(() => {
                          const yearBg = year >= CURRENT_YEAR ? "#DBEAFE" : "#EEF2FF";
                          return (
                            <tr key={`year-${year}`} className="cursor-pointer select-none h-[44px]">
                              {hasSelection && (
                                <td className="px-3" style={{ backgroundColor: yearBg }} onClick={(e) => e.stopPropagation()}>
                                  <div
                                    className={cn(
                                      "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                                      yearRows.every((r) => selectedIds?.has(r.id))
                                        ? "bg-[#FCB803] border-[#FCB803]"
                                        : yearRows.some((r) => selectedIds?.has(r.id))
                                        ? "bg-[#FCB803]/30 border-[#FCB803]/60"
                                        : "border-border/60 hover:border-[#FCB803]/40"
                                    )}
                                    onClick={() => {
                                      if (!onSelectionChange || !selectedIds) return;
                                      const allYearSelected = yearRows.every((r) => selectedIds.has(r.id));
                                      const next = new Set(selectedIds);
                                      if (allYearSelected) {
                                        yearRows.forEach((r) => next.delete(r.id));
                                      } else {
                                        yearRows.forEach((r) => next.add(r.id));
                                      }
                                      onSelectionChange(next);
                                    }}
                                  >
                                    {(yearRows.every((r) => selectedIds?.has(r.id)) || yearRows.some((r) => selectedIds?.has(r.id))) && <Check className="h-2.5 w-2.5 text-[#131B49]" />}
                                  </div>
                                </td>
                              )}
                              {/* Label spanning Date + Supplier + Description + Invoice# = 4 columns */}
                              <td colSpan={4} onClick={() => toggleGroup(`expense-${year}`)} style={{ backgroundColor: yearBg }}>
                                <div className="flex items-center gap-1.5 px-1">
                                  {yearCollapsed
                                    ? <ChevronRight className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
                                    : <ChevronDown className="h-3.5 w-3.5 text-foreground/40 shrink-0" />}
                                  <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/60">{year}</span>
                                </div>
                              </td>
                              {/* Excl. VAT column */}
                              <td className="px-3 text-right" style={{ backgroundColor: yearBg }}>
                                {yearCurrencies.map(([cur, totals]) => (
                                  <div key={cur} className="text-[11px] font-semibold text-foreground/60 tabular-nums">
                                    {fmtCur(totals.exclVat, cur)}
                                  </div>
                                ))}
                              </td>
                              {/* VAT % - empty */}
                              <td style={{ backgroundColor: yearBg }} />
                              {/* Total column */}
                              <td className="px-3 text-right" style={{ backgroundColor: yearBg }}>
                                {yearCurrencies.map(([cur, totals]) => (
                                  <div key={cur} className="text-[11px] font-bold text-foreground tabular-nums">
                                    {fmtCur(totals.total, cur)}
                                  </div>
                                ))}
                              </td>
                              {/* NL BTW column */}
                              <td className="px-3 text-right" style={{ backgroundColor: yearBg }}>
                                {yearCurrencies.map(([cur, totals]) => (
                                  totals.nlBtw > 0 ? (
                                    <div key={cur} className="text-[11px] font-semibold text-emerald-700 tabular-nums">
                                      {fmtCur(totals.nlBtw, cur)}
                                    </div>
                                  ) : <div key={cur} />
                                ))}
                              </td>
                              {/* Notes - empty */}
                              <td style={{ backgroundColor: yearBg }} />
                              {/* PDF - empty */}
                              <td style={{ backgroundColor: yearBg }} />
                            </tr>
                          );
                        })()}

                        {!yearCollapsed && (
                          <>
                            {quarters.map(({ q, rows: qRows }) => {
                              const qCurrencies = groupByCurrency(qRows);
                              const qCollapsed = collapsedGroups.has(`expense-${year}-${q}`);
                              return (
                                <>
                                  {/* Quarter sub-header */}
                                  {(() => {
                                    const qBg = "#E3E3E3";
                                    return (
                                      <tr key={`qhdr-${year}-${q}`} className="cursor-pointer select-none h-[38px]">
                                        {hasSelection && (
                                          <td className="px-3" style={{ backgroundColor: qBg }} onClick={(e) => e.stopPropagation()}>
                                            <div
                                              className={cn(
                                                "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                                                qRows.every((r) => selectedIds?.has(r.id))
                                                  ? "bg-[#FCB803] border-[#FCB803]"
                                                  : qRows.some((r) => selectedIds?.has(r.id))
                                                  ? "bg-[#FCB803]/30 border-[#FCB803]/60"
                                                  : "border-border/60 hover:border-[#FCB803]/40"
                                              )}
                                              onClick={() => {
                                                if (!onSelectionChange || !selectedIds) return;
                                                const allQSelected = qRows.every((r) => selectedIds.has(r.id));
                                                const next = new Set(selectedIds);
                                                if (allQSelected) {
                                                  qRows.forEach((r) => next.delete(r.id));
                                                } else {
                                                  qRows.forEach((r) => next.add(r.id));
                                                }
                                                onSelectionChange(next);
                                              }}
                                            >
                                              {(qRows.every((r) => selectedIds?.has(r.id)) || qRows.some((r) => selectedIds?.has(r.id))) && <Check className="h-2.5 w-2.5 text-[#131B49]" />}
                                            </div>
                                          </td>
                                        )}
                                        {/* Label spanning Date + Supplier + Description + Invoice# = 4 columns */}
                                        <td colSpan={4} onClick={() => toggleGroup(`expense-${year}-${q}`)} style={{ backgroundColor: qBg }}>
                                          <div className="flex items-center gap-1.5 px-1">
                                            {qCollapsed
                                              ? <ChevronRight className="h-3 w-3 text-foreground/40 shrink-0" />
                                              : <ChevronDown className="h-3 w-3 text-foreground/40 shrink-0" />}
                                            <span className="text-[10px] font-semibold text-foreground/50">{q} · {QUARTER_MONTHS[q]}</span>
                                          </div>
                                        </td>
                                        {/* Excl. VAT column */}
                                        <td className="px-3 text-right" style={{ backgroundColor: qBg }}>
                                          {qCurrencies.map(([cur, totals]) => (
                                            <div key={cur} className="text-[10px] font-semibold text-foreground/50 tabular-nums">
                                              {fmtCur(totals.exclVat, cur)}
                                            </div>
                                          ))}
                                        </td>
                                        {/* VAT % - empty */}
                                        <td style={{ backgroundColor: qBg }} />
                                        {/* Total column */}
                                        <td className="px-3 text-right" style={{ backgroundColor: qBg }}>
                                          {qCurrencies.map(([cur, totals]) => (
                                            <div key={cur} className="text-[10px] font-semibold text-foreground tabular-nums">
                                              {fmtCur(totals.total, cur)}
                                            </div>
                                          ))}
                                        </td>
                                        {/* NL BTW column */}
                                        <td className="px-3 text-right" style={{ backgroundColor: qBg }}>
                                          {qCurrencies.map(([cur, totals]) => (
                                            totals.nlBtw > 0 ? (
                                              <div key={cur} className="text-[10px] font-semibold text-emerald-700 tabular-nums">
                                                {fmtCur(totals.nlBtw, cur)}
                                              </div>
                                            ) : <div key={cur} />
                                          ))}
                                        </td>
                                        {/* Notes - empty */}
                                        <td style={{ backgroundColor: qBg }} />
                                        {/* PDF - empty */}
                                        <td style={{ backgroundColor: qBg }} />
                                      </tr>
                                    );
                                  })()}

                                  {!qCollapsed && (
                                    <>
                                      {/* Data rows */}
                                      {qRows.map((row, i) => (
                                        <ExpenseDataRow
                                          key={row.id ?? `${year}-${q}-${i}`}
                                          row={row}
                                          i={i}
                                          hasSelection={hasSelection}
                                          isSelected={isSelected}
                                          toggleRow={toggleRow}
                                        />
                                      ))}

                                    </>
                                  )}
                                </>
                              );
                            })}

                          </>
                        )}
                      </>
                    );
                  })}
                </tbody>
              ) : (
                <>
                  <tbody>
                    {sorted.map((row, i) => (
                      <ExpenseDataRow
                        key={row.id ?? i}
                        row={row}
                        i={i}
                        hasSelection={hasSelection}
                        isSelected={isSelected}
                        toggleRow={toggleRow}
                      />
                    ))}
                  </tbody>

                  {/* Footer totals (flat view only) */}
                  {footerByCurrency.map(([cur, totals]) => (
                    <tfoot key={cur} className="bg-card">
                      <tr className="h-[52px] border-t-2 border-border/30">
                        {hasSelection && <td />}
                        <td className="px-3 py-0" colSpan={3}>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                            Total ({cur})
                          </span>
                        </td>
                        <td className="px-3 py-0" />
                        <td className="px-3 py-0 text-right tabular-nums font-bold text-foreground">
                          {new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(totals.exclVat)}
                        </td>
                        <td className="px-3 py-0" />
                        <td className="px-3 py-0 text-right tabular-nums font-bold text-foreground">
                          {new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(totals.total)}
                        </td>
                        <td className="px-3 py-0 text-right tabular-nums font-bold text-emerald-700">
                          {new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(totals.nlBtw)}
                        </td>
                        <td className="px-3 py-0" />
                        <td className="px-3 py-0" />
                      </tr>
                    </tfoot>
                  ))}
                </>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
