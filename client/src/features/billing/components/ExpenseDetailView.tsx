import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText, Pencil, Trash2, Plus, ExternalLink, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Expand-on-hover toolbar button constants ──────────────────────────────────
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";
import type { ExpenseRow } from "../types";
import { deleteExpense, updateExpense } from "../api/expensesApi";
import { useQueryClient } from "@tanstack/react-query";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtAmt(val: string | null | undefined, cur = "EUR"): string {
  if (!val) return "—";
  const n = parseFloat(String(val).replace(",", "."));
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: cur, minimumFractionDigits: 2,
  }).format(n);
}

function parseNum(val: string | null | undefined): number {
  if (!val) return 0;
  const n = parseFloat(String(val).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function ExpenseDetailViewEmpty({
  onNew,
  toolbarSlot,
}: {
  onNew?: () => void;
  toolbarSlot?: React.ReactNode;
}) {
  const { t } = useTranslation("billing");
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {toolbarSlot && (
        <div className="relative z-10 px-4 pt-3 pb-1.5 flex items-center gap-1.5">
          {toolbarSlot}
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-stone-50 to-gray-100 dark:from-stone-800 dark:to-stone-700 flex items-center justify-center ring-1 ring-stone-200/50 dark:ring-stone-600/50">
        <FileText className="h-10 w-10 text-stone-400" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground/70">{t("expenses.empty.selectAnExpense")}</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          {t("expenses.empty.selectAnExpenseDesc")}
        </p>
      </div>
      {onNew && (
        <button
          onClick={onNew}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-[13px] font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("expenses.empty.newExpense")}
        </button>
      )}
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExpenseDetailViewProps {
  expense: ExpenseRow;
  onEdit: (expense: ExpenseRow) => void;
  onDeleted: () => void;
  onNew?: () => void;
  toolbarSlot?: React.ReactNode;
  noBackground?: boolean;
}

// ── Mobile tab type ───────────────────────────────────────────────────────────
type ExpenseMobileTab = "details" | "attachments";

// ── Main Component ────────────────────────────────────────────────────────────

export function ExpenseDetailView({
  expense,
  onEdit,
  onDeleted,
  onNew,
  toolbarSlot,
  noBackground,
}: ExpenseDetailViewProps) {
  const { t } = useTranslation("billing");
  const queryClient = useQueryClient();
  const [mobileTab, setMobileTab] = useState<ExpenseMobileTab>("details");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const currency = expense.currency || "EUR";

  // Reset confirm on expense change
  useEffect(() => {
    setDeleteConfirm(false);
    setMobileTab("details");
  }, [expense.id]);

  // Auto-reset delete confirm after 3s
  useEffect(() => {
    if (deleteConfirm) {
      const t = setTimeout(() => setDeleteConfirm(false), 3000);
      return () => clearTimeout(t);
    }
  }, [deleteConfirm]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setIsDeleting(true);
    setDeleteConfirm(false);
    try {
      await deleteExpense(expense.id);
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      onDeleted();
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirm, expense.id, queryClient, onDeleted]);

  // ── Toggle NL BTW ─────────────────────────────────────────────────────────
  const [togglingBtw, setTogglingBtw] = useState(false);
  const handleToggleBtw = useCallback(async () => {
    setTogglingBtw(true);
    try {
      await updateExpense(expense.id, { nl_btw_deductible: !expense.nlBtwDeductible });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    } finally {
      setTogglingBtw(false);
    }
  }, [expense.id, expense.nlBtwDeductible, queryClient]);

  const totalNum = parseNum(expense.totalAmount);
  const vatNum   = parseNum(expense.vatAmount);
  const exclNum  = parseNum(expense.amountExclVat);

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="expense-detail-view">

      {/* Warm gradient bloom background */}
      {!noBackground && (
        <>
          <div className="absolute inset-0 bg-[#ffffff] dark:bg-card" />
          {/* Layer 1: White bloom — disabled */}
          {/* Layer 2: Yellow — disabled */}
          {/* Layer 3: Peach — disabled */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_150%_140%_at_40%_91%,rgba(255,204,204,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,#C7E0FF_5%,transparent_30%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_136%_152%_at_53%_59%,rgba(255,216,116,0.4)_0%,transparent_66%)] dark:opacity-[0.08]" />
        </>
      )}

      {/* ── Header ── */}
      <div className="relative z-10 shrink-0 px-[3px] pt-[3px] pb-[3px] space-y-[3px]">

        {/* Action toolbar */}
        <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {toolbarSlot}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {/* New */}
            {onNew && (
              <button
                onClick={onNew}
                className={cn(xBase, xDefault, "hover:max-w-[80px]")}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("expenses.actions.new")}</span>
              </button>
            )}

            {/* PDF */}
            {expense.pdfPath && (
              <a
                href={`/api/expenses/${expense.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(xBase, xDefault, "hover:max-w-[80px]")}
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("expenses.actions.pdf")}</span>
              </a>
            )}

            {/* Edit */}
            <button
              onClick={() => onEdit(expense)}
              className={cn(xBase, xDefault, "hover:max-w-[80px]")}
            >
              <Pencil className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("expenses.actions.edit")}</span>
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                xBase,
                "hover:max-w-[100px]",
                deleteConfirm
                  ? "border-red-400/60 text-red-600"
                  : xDefault
              )}
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{deleteConfirm ? t("expenses.actions.confirm") : (isDeleting ? t("expenses.actions.deleting") : t("expenses.actions.delete"))}</span>
            </button>
          </div>
        </div>

        {/* Supplier + invoice number */}
        <div className="px-4 pt-3 pb-2 space-y-1">
          <h2 className="text-[22px] font-semibold font-heading text-foreground leading-tight">
            {expense.supplier || t("expenses.detail.unknownSupplier")}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {expense.invoiceNumber && (
              <span className="text-[13px] text-foreground/50 font-mono">
                #{expense.invoiceNumber}
              </span>
            )}
            {expense.country && (
              <>
                {expense.invoiceNumber && <span className="text-foreground/25">·</span>}
                <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-white/50 dark:bg-white/[0.10] text-foreground/60">
                  {expense.country}
                </span>
              </>
            )}
            {/* NL BTW badge */}
            <button
              onClick={handleToggleBtw}
              disabled={togglingBtw}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors",
                expense.nlBtwDeductible
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-white/50 dark:bg-white/[0.10] text-foreground/40"
              )}
              title={t("expenses.detail.toggleNlBtw")}
            >
              {expense.nlBtwDeductible && <Check className="h-3 w-3" />}
              {expense.nlBtwDeductible ? t("expenses.detail.nlBtwDeductible") : t("expenses.detail.nlBtwNonDeductible")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile tab bar (hidden on desktop) ── */}
      <div className="md:hidden relative z-10 flex gap-1 px-4 pb-3 overflow-x-auto [scrollbar-width:none] shrink-0" data-testid="expense-mobile-tabs">
        {([
          { id: "details" as const,     label: t("mobileTabs.details") },
          { id: "attachments" as const, label: t("mobileTabs.attachments") },
        ] as { id: ExpenseMobileTab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            data-testid={`expense-tab-${id}`}
            className={cn(
              "h-8 px-3.5 rounded-full text-[12px] font-semibold shrink-0 transition-colors",
              mobileTab === id
                ? "bg-foreground text-background"
                : "bg-white/60 dark:bg-white/[0.10] text-foreground/60 border border-border/40"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Content area ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-[3px] pb-[3px] min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-[3px] max-w-[1386px] w-full mr-auto">

          {/* Left column: amounts breakdown */}
          <div className={cn("bg-white/60 dark:bg-white/[0.10] rounded-xl p-5 flex flex-col gap-4", mobileTab !== "details" ? "hidden md:flex" : "flex")}>
            <p className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">
              {t("expenses.detail.amounts")}
            </p>

            {/* Total (big) */}
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40 block mb-1">
                {t("expenses.detail.total")}
              </span>
              <span className="text-[28px] font-bold tabular-nums text-foreground leading-none">
                {fmtAmt(expense.totalAmount, currency)}
              </span>
              {expense.currency && expense.currency !== "EUR" && (
                <span className="text-[11px] text-foreground/40 ml-1.5">{expense.currency}</span>
              )}
            </div>

            <div className="h-px bg-border/20" />

            {/* Amount excl. VAT */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-foreground/50">{t("expenses.detail.exclVat")}</span>
                <span className="text-[13px] font-medium tabular-nums text-foreground">
                  {exclNum > 0 ? fmtAmt(expense.amountExclVat, currency) : "—"}
                </span>
              </div>

              {parseNum(expense.vatRatePct) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-foreground/50">
                    {t("expenses.detail.vatPercent", { percent: expense.vatRatePct })}
                  </span>
                  <span className="text-[13px] font-medium tabular-nums text-foreground">
                    {vatNum > 0 ? fmtAmt(expense.vatAmount, currency) : "—"}
                  </span>
                </div>
              )}

              {expense.nlBtwDeductible && vatNum > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-emerald-700/70 font-medium">{t("expenses.detail.nlBtwDeductible")}</span>
                  <span className="text-[13px] font-semibold tabular-nums text-emerald-700">
                    {fmtAmt(expense.vatAmount, currency)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1.5 border-t border-border/20">
                <span className="text-[13px] font-bold text-foreground">{t("expenses.detail.total")}</span>
                <span className="text-[13px] font-bold tabular-nums text-foreground">
                  {fmtAmt(expense.totalAmount, currency)}
                </span>
              </div>
            </div>

            {/* Description */}
            {expense.description && (
              <>
                <div className="h-px bg-border/20" />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-foreground/30 mb-1">
                    {t("expenses.detail.description")}
                  </p>
                  <p className="text-[12px] text-foreground/70 leading-relaxed">
                    {expense.description}
                  </p>
                </div>
              </>
            )}

            {/* Notes */}
            {expense.notes && (
              <>
                <div className="h-px bg-border/20" />
                <div className="mt-auto">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-foreground/30 mb-1">
                    {t("expenses.detail.notes")}
                  </p>
                  <p className="text-[11px] text-foreground/50 leading-relaxed whitespace-pre-wrap">
                    {expense.notes}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Right column: metadata */}
          <div className={cn("flex flex-col gap-[3px]", mobileTab === "details" ? "hidden md:flex" : "flex")}>

            {/* Date */}
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl px-5 py-5">
              <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-3">
                {t("expenses.detail.date")}
              </span>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">
                    {t("expenses.detail.invoiceDate")}
                  </span>
                  <span className="text-[12px] font-semibold text-foreground block mt-0.5">
                    {fmtDate(expense.date)}
                  </span>
                </div>
                <div className="pt-3 border-t border-border/20">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 block">
                    {t("expenses.detail.period")}
                  </span>
                  <span className="text-[12px] font-semibold text-foreground block mt-0.5">
                    {expense.quarter && expense.year
                      ? `${expense.quarter} ${expense.year}`
                      : expense.quarter || (expense.year ? String(expense.year) : "—")}
                  </span>
                </div>
              </div>
            </div>

            {/* PDF */}
            <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl px-5 py-5 flex-1">
              <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading block mb-3">
                {t("expenses.detail.document")}
              </span>
              {expense.pdfPath ? (
                <a
                  href={`/api/expenses/${expense.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/40 bg-card hover:bg-muted/60 transition-colors group"
                >
                  <div className="h-8 w-8 rounded-lg bg-brand-indigo/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-brand-indigo" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate">{t("expenses.detail.invoicePdf")}</p>
                    <p className="text-[10px] text-foreground/40">{t("expenses.detail.clickToView")}</p>
                  </div>
                  <ExternalLink className="h-3 w-3 text-foreground/30 group-hover:text-brand-indigo transition-colors shrink-0" />
                </a>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 gap-1.5">
                  <FileText className="h-8 w-8 text-foreground/15" />
                  <p className="text-[11px] text-foreground/30">{t("expenses.detail.noPdfAttached")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
