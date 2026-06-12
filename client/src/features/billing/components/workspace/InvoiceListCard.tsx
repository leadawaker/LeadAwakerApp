import { Receipt, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { InvoiceRow } from "../../types";
import { formatCurrency, INVOICE_STATUS_COLORS } from "../../types";
import { daysFrom } from "./atoms";
import { effectiveInvoiceStatus } from "./adapters";

function toDisplayTitle(title: string): string {
  return title.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function DueLabel({ invoice }: { invoice: InvoiceRow }) {
  const { t } = useTranslation("billing");
  const status = effectiveInvoiceStatus(invoice);
  if (status === "Paid") return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--good)" }}>{t("invoices.card.paid")}</span>;
  if (status === "Draft") return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)" }}>{t("invoices.card.notSent", "Not sent")}</span>;
  const d = daysFrom(invoice.due_date);
  if (d == null) return null;
  if (d < 0) return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, color: "var(--stage-lost)" }}>{t("invoices.card.dOverdue", { count: Math.abs(d) })}</span>;
  if (d === 0) return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, color: "var(--wine)" }}>{t("invoices.card.dueToday", "Due today")}</span>;
  return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute)" }}>{t("invoices.card.dueIn", { count: d })}</span>;
}

export function InvoiceListCard({ invoice, isSelected, isChecked, onClick, onCheck }: {
  invoice: InvoiceRow; isSelected: boolean; isChecked?: boolean; onClick: () => void; onCheck?: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation("billing");
  const status = effectiveInvoiceStatus(invoice);
  const statusColors = INVOICE_STATUS_COLORS[status] || { bg: "var(--surface)", text: "var(--mute)" };
  const title = invoice.title
    ? toDisplayTitle(invoice.title)
    : invoice.invoice_number || t("invoices.card.untitled");
  const account = invoice.account_name || t("invoices.card.noAccount");

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
      data-testid="invoice-card"
    >
      <span
        className="shrink-0 flex items-center justify-center"
        onClick={onCheck ? (e) => { e.stopPropagation(); onCheck(e); } : undefined}
        style={{
          width: 36, height: 36, borderRadius: "var(--r-surface)",
          background: isChecked ? "var(--wine)" : statusColors.bg,
          color: isChecked ? "var(--paper)" : statusColors.text,
          cursor: onCheck ? "pointer" : undefined,
          transition: "background 120ms",
        }}
      >
        {isChecked ? <Check className="h-[14px] w-[14px]" /> : <Receipt className="h-[15px] w-[15px]" />}
      </span>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
          <div className="row" style={{ gap: 6, marginTop: 3, whiteSpace: "nowrap" }}>
            <span className="truncate" style={{ fontSize: 11.5, color: "var(--mute)" }}>{account}</span>
            {invoice.invoice_number && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--mute-2)", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", letterSpacing: "0.06em" }}>{invoice.invoice_number}</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end" style={{ gap: 4 }}>
          <span className="serif" style={{ fontSize: 20, color: "var(--ink)", lineHeight: 1 }}>
            {formatCurrency(invoice.total, invoice.currency || "EUR")}
          </span>
          <DueLabel invoice={invoice} />
        </div>
      </div>
    </button>
  );
}
