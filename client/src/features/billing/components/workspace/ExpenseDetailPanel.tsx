import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, ExternalLink, Pencil, Trash2, Check, FileText, Wallet } from "lucide-react";
import type { ExpenseRow } from "../../types";
import { formatCurrency } from "../../types";
import { deleteExpense, updateExpense } from "../../api/expensesApi";
import { DetailSection, ActBtn, DetailRow, DetailField, fmtDateFull } from "./atoms";
import { parseNum, expenseYear, expenseQuarterNum } from "./adapters";

interface Props {
  expense: ExpenseRow;
  onEdit: (expense: ExpenseRow) => void;
  onDeleted: () => void;
  onNew?: () => void;
}

// Inline expense detail — rebuilt to match the invoice detail panel
// (neu-raised DetailSections, serif total, shared spacing). Fully wired:
// edit / delete / BTW toggle / PDF download.
export function ExpenseDetailPanel({ expense, onEdit, onDeleted, onNew }: Props) {
  const { t } = useTranslation("billing");
  const queryClient = useQueryClient();
  const currency = expense.currency || "EUR";

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingBtw, setTogglingBtw] = useState(false);

  useEffect(() => { setDeleteConfirm(false); }, [expense.id]);
  useEffect(() => {
    if (!deleteConfirm) return;
    const tm = setTimeout(() => setDeleteConfirm(false), 3000);
    return () => clearTimeout(tm);
  }, [deleteConfirm]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setIsDeleting(true); setDeleteConfirm(false);
    try {
      await deleteExpense(expense.id);
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      onDeleted();
    } finally { setIsDeleting(false); }
  }, [deleteConfirm, expense.id, queryClient, onDeleted]);

  const handleToggleBtw = useCallback(async () => {
    setTogglingBtw(true);
    try {
      await updateExpense(expense.id, { nl_btw_deductible: !expense.nlBtwDeductible });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    } finally { setTogglingBtw(false); }
  }, [expense.id, expense.nlBtwDeductible, queryClient]);

  const exclNum = parseNum(expense.amountExclVat);
  const vatNum = parseNum(expense.vatAmount);
  const ratePct = parseNum(expense.vatRatePct);
  const y = expenseYear(expense);
  const q = expenseQuarterNum(expense);
  const period = q && y ? `Q${q} ${y}` : y ? String(y) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }} data-testid="expense-detail-panel">
      {/* Header — white panel matching contract/invoice header style */}
      <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", padding: "18px 20px" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 26, color: "var(--ink)", lineHeight: 1.1 }}>
              {expense.supplier || t("expenses.detail.unknownSupplier")}
            </div>
            <div className="row" style={{ gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              {expense.invoiceNumber && <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute-2)" }}>#{expense.invoiceNumber}</span>}
              {expense.country && (
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute)", background: "var(--bg)", boxShadow: "var(--sh-inset-super-crisp)", padding: "3px 8px", borderRadius: "var(--r-pill)" }}>{expense.country}</span>
              )}
              <button onClick={handleToggleBtw} disabled={togglingBtw} title={t("expenses.detail.toggleNlBtw")} style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer",
                background: expense.nlBtwDeductible ? "var(--good-tint)" : "rgba(148,138,119,0.14)", color: expense.nlBtwDeductible ? "var(--good)" : "var(--mute-2)",
                fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, opacity: togglingBtw ? 0.6 : 1,
              }}>
                {expense.nlBtwDeductible && <Check size={10} />}{expense.nlBtwDeductible ? t("expenses.status.deductible", "BTW Deductible") : t("expenses.status.notDeductible", "Non-deductible")}
              </button>
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {onNew && <ActBtn icon={<Plus size={14} />} label={t("expenses.actions.new")} onClick={onNew} />}
            {expense.pdfPath && <ActBtn icon={<ExternalLink size={14} />} label={t("expenses.actions.pdf")} href={`/api/expenses/${expense.id}/pdf`} />}
            <ActBtn icon={<Pencil size={14} />} label={t("expenses.actions.edit")} onClick={() => onEdit(expense)} />
            <ActBtn icon={<Trash2 size={14} />} label={deleteConfirm ? t("expenses.actions.confirm") : isDeleting ? t("expenses.actions.deleting") : t("expenses.actions.delete")} onClick={handleDelete} disabled={isDeleting} danger={deleteConfirm} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 16 }} className="max-md:!grid-cols-1">
        {/* Amounts */}
        <DetailSection title={t("expenses.detail.amounts")}>
          <div className="serif" style={{ fontSize: 30, color: "var(--ink)", lineHeight: 1 }}>{formatCurrency(expense.totalAmount, currency)}</div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
            <DetailRow label={t("expenses.detail.exclVat")} value={exclNum > 0 ? formatCurrency(expense.amountExclVat, currency) : "—"} />
            {ratePct > 0 && <DetailRow label={t("expenses.detail.vatPercent", { percent: expense.vatRatePct })} value={vatNum > 0 ? formatCurrency(expense.vatAmount, currency) : "—"} />}
            {expense.nlBtwDeductible && vatNum > 0 && <DetailRow label={t("expenses.detail.nlBtwDeductible")} value={formatCurrency(expense.vatAmount, currency)} valueColor="var(--good)" />}
            <div className="row" style={{ justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{t("expenses.detail.total")}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--mono)" }}>{formatCurrency(expense.totalAmount, currency)}</span>
            </div>
          </div>
          {expense.description && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <div className="eyebrow eyebrow-sm" style={{ marginBottom: 6 }}>{t("expenses.detail.description")}</div>
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5, margin: 0 }}>{expense.description}</p>
            </div>
          )}
          {expense.notes && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <div className="eyebrow eyebrow-sm" style={{ marginBottom: 6 }}>{t("expenses.detail.notes")}</div>
              <p style={{ fontSize: 11.5, color: "var(--mute)", lineHeight: 1.5, whiteSpace: "pre-wrap", margin: 0 }}>{expense.notes}</p>
            </div>
          )}
        </DetailSection>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <DetailSection title={t("expenses.detail.date")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <DetailField label={t("expenses.detail.invoiceDate")}>{fmtDateFull(expense.date)}</DetailField>
              <DetailField label={t("expenses.detail.period")} divider>{period}</DetailField>
            </div>
          </DetailSection>

          <DetailSection title={t("expenses.detail.document")}>
            {expense.pdfPath ? (
              <a href={`/api/expenses/${expense.id}/pdf`} target="_blank" rel="noopener noreferrer"
                className="row" style={{ gap: 11, padding: "11px 13px", borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", textDecoration: "none" }}>
                <span style={{ width: 34, height: 34, borderRadius: "var(--r-button)", flexShrink: 0, background: "var(--wine-tint)", color: "var(--wine)", display: "flex", alignItems: "center", justifyContent: "center" }}><FileText size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{t("expenses.detail.invoicePdf")}</div>
                  <div style={{ fontSize: 10.5, color: "var(--mute-2)" }}>{t("expenses.detail.clickToView")}</div>
                </div>
                <ExternalLink size={13} style={{ color: "var(--mute-2)", flexShrink: 0 }} />
              </a>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "16px 0" }}>
                <Wallet size={26} style={{ color: "var(--mute-2)" }} />
                <span style={{ fontSize: 11, color: "var(--mute-2)" }}>{t("expenses.detail.noPdfAttached")}</span>
              </div>
            )}
          </DetailSection>
        </div>
      </div>
    </div>
  );
}

export function ExpenseDetailPanelEmpty({ onNew }: { onNew?: () => void }) {
  const { t } = useTranslation("billing");
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ height: "100%", color: "var(--mute)" }}>
      <Wallet className="w-10 h-10 mb-3" style={{ color: "var(--mute-2)" }} />
      <p style={{ fontSize: 14 }}>{t("expenses.empty.selectAnExpense")}</p>
      {onNew && <button onClick={onNew} className="la-btn la-btn--wine" style={{ marginTop: 14 }}><Plus size={14} />{t("expenses.actions.new")}</button>}
    </div>
  );
}
