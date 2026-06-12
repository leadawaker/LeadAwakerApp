import { Wallet, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ExpenseRow } from "../../types";
import { formatCurrency } from "../../types";
import { DedBadge, fmtDate } from "./atoms";

export function ExpenseListCard({ expense, isSelected, isChecked, onClick, onCheck }: {
  expense: ExpenseRow; isSelected: boolean; isChecked?: boolean; onClick: () => void; onCheck?: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation("billing");
  const currency = expense.currency || "EUR";
  const title = (expense.description && expense.description.trim())
    ? expense.description
    : (expense.supplier || t("expenses.unknown"));

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--card)"; }}
      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      className="w-full text-left flex items-center gap-3 cursor-pointer"
      style={{
        padding: "12px 16px", borderRadius: "var(--r-card)",
        background: isSelected ? "var(--card)" : "transparent",
        boxShadow: isSelected ? "inset 3px 0 0 var(--wine), var(--sh-raised-crisp)" : "none",
        transition: "background 120ms, box-shadow 120ms",
      }}
      data-testid="expense-card"
    >
      <span
        className="shrink-0 flex items-center justify-center"
        onClick={onCheck ? (e) => { e.stopPropagation(); onCheck(e); } : undefined}
        style={{
          width: 36, height: 36, borderRadius: "var(--r-surface)",
          background: isChecked ? "var(--wine)" : "var(--bg)",
          color: isChecked ? "var(--paper)" : "var(--mute)",
          cursor: onCheck ? "pointer" : undefined,
          transition: "background 120ms",
        }}
      >
        {isChecked ? <Check className="h-[14px] w-[14px]" /> : <Wallet className="h-[15px] w-[15px]" />}
      </span>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
          <div className="row" style={{ gap: 6, marginTop: 3 }}>
            {expense.supplier && <span className="truncate" style={{ fontSize: 11.5, color: "var(--mute)" }}>{expense.supplier}</span>}
            <DedBadge ded={expense.nlBtwDeductible} />
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end" style={{ gap: 4 }}>
          <span className="serif" style={{ fontSize: 19, color: "var(--ink)", lineHeight: 1 }}>{formatCurrency(expense.totalAmount, currency)}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{fmtDate(expense.date)}</span>
        </div>
      </div>
    </button>
  );
}
