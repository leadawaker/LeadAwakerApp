import { Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ExpenseRow } from "../../types";
import { formatCurrency } from "../../types";
import { DedBadge, PdfBadge, fmtDate } from "./atoms";
import { expenseYear, expenseQuarterNum } from "./adapters";

export function ExpenseListCard({ expense, isSelected, onClick }: {
  expense: ExpenseRow; isSelected: boolean; onClick: () => void;
}) {
  const { t } = useTranslation("billing");
  const currency = expense.currency || "EUR";
  const title = (expense.description && expense.description.trim())
    ? expense.description
    : (expense.supplier || t("expenses.unknown"));
  const y = expenseYear(expense);
  const q = expenseQuarterNum(expense);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
      className="w-full text-left flex items-center gap-4 cursor-pointer"
      style={{
        padding: "15px 18px", borderRadius: "var(--r-card)", background: "var(--card)",
        boxShadow: isSelected ? "var(--sh-raised-medium), 0 0 0 1.5px var(--wine)" : "var(--sh-raised-crisp)",
        transition: "box-shadow 130ms, transform 130ms",
      }}
      data-testid="expense-card"
    >
      <span className="shrink-0 flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", color: "var(--mute)" }}>
        <Wallet className="h-[18px] w-[18px]" />
      </span>

      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
        <div className="row" style={{ gap: 7, marginTop: 4 }}>
          {expense.supplier && <span className="truncate" style={{ fontSize: 12, color: "var(--mute)" }}>{expense.supplier}</span>}
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--mute-2)", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{fmtDate(expense.date)}</span>
        </div>
        <div className="row" style={{ gap: 7, marginTop: 8 }}>
          <DedBadge ded={expense.nlBtwDeductible} />
          {expense.pdfPath && <PdfBadge />}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end" style={{ gap: 6 }}>
        <span className="serif" style={{ fontSize: 21, color: "var(--ink)", lineHeight: 1 }}>{formatCurrency(expense.totalAmount, currency)}</span>
        {(y || q) && (
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute-2)", letterSpacing: "0.04em" }}>
            {q ? `Q${q}` : ""} {y ?? ""}
          </span>
        )}
      </div>
    </button>
  );
}
