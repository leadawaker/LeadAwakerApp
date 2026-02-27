import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReceiptText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExpenseRow } from "../types";
import { fetchExpenses } from "../api/expensesApi";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpensesListViewProps {
  quarterFilter: string | null;
  yearFilter: number | null;
  searchQuery: string;
  sortBy?: "recent" | "amount_desc" | "amount_asc" | "name_asc";
  selectedId: number | null;
  onSelect: (expense: ExpenseRow) => void;
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

// ── Expense row card ──────────────────────────────────────────────────────────

function ExpenseListRow({
  row,
  isSelected,
  onClick,
}: {
  row: ExpenseRow;
  isSelected: boolean;
  onClick: () => void;
}) {
  const currency = row.currency || "EUR";
  const hasDescription = !!(row.description && row.description.trim());
  const hasPdf = !!row.pdfPath;
  const showRow2 = hasDescription || row.nlBtwDeductible;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl px-2.5 pt-2.5 pb-2 transition-colors cursor-pointer",
        isSelected ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <div className="h-[34px] w-[34px] rounded-full shrink-0 flex items-center justify-center bg-foreground/[0.08] border border-border/50">
          <ReceiptText className="h-4 w-4 text-foreground/40" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: Supplier name + Total amount */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[16px] font-semibold font-heading text-foreground truncate">
              {row.supplier || "Unknown"}
            </span>
            <span className="text-[12px] font-bold text-foreground shrink-0 tabular-nums">
              {fmtAmt(row.totalAmount, currency)}
            </span>
          </div>

          {/* Row 2: Description (left) + BTW amount (right) */}
          {showRow2 && (
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <span className="text-[11px] text-muted-foreground truncate">
                {hasDescription ? row.description : ""}
              </span>
              {row.nlBtwDeductible && (
                <span className="text-[10px] font-semibold text-emerald-700 tabular-nums shrink-0">
                  {fmtAmt(row.vatAmount, currency)}
                </span>
              )}
            </div>
          )}

          {/* Row 3: Date (left) + PDF indicator (right) */}
          <div className="flex items-center justify-between gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground/70 tabular-nums">
              {fmtDateShort(row.date)}
            </span>
            {hasPdf && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-indigo/10 text-brand-indigo shrink-0">
                PDF
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
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
}: ExpensesListViewProps) {
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
        default: // "recent"
          return (b.date || "").localeCompare(a.date || "");
      }
    });
  }, [expenses, quarterFilter, yearFilter, searchQuery, sortBy]);

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
          {(error as Error)?.message || "Could not load expenses."}
        </p>
      </div>
    );
  }

  if (filteredExpenses.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <ReceiptText className="h-7 w-7 text-foreground/20" />
        <p className="text-xs text-muted-foreground">
          {searchQuery ? "No expenses match your search" : "No expenses found"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-1.5 px-2 py-2">
      {filteredExpenses.map((row) => (
        <ExpenseListRow
          key={row.id}
          row={row}
          isSelected={row.id === selectedId}
          onClick={() => onSelect(row)}
        />
      ))}
    </div>
  );
}

// ── Export raw data hook for parent to find latest ────────────────────────────
export function useExpensesData() {
  return useQuery<ExpenseRow[]>({
    queryKey: ["expenses"],
    queryFn: async () => fetchExpenses(),
    staleTime: 1000 * 60 * 5,
  });
}
