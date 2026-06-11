import { useTranslation } from "react-i18next";
import { getInitials } from "@/lib/avatarUtils";
import type { InvoiceRow } from "../../types";
import { formatCurrency } from "../../types";
import { Avatar, daysFrom } from "./atoms";
import { effectiveInvoiceStatus } from "./adapters";

// Deterministic warm-palette avatar colour from a name (mirrors the prototype's per-client tints).
const AVATAR_COLORS = ["#C48A2F", "#5E8E5E", "#7A2E3E", "#547BB0", "#3F8E8E", "#6C5A8C"];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

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

export function InvoiceListCard({ invoice, isSelected, onClick }: {
  invoice: InvoiceRow; isSelected: boolean; onClick: () => void;
}) {
  const { t } = useTranslation("billing");
  const title = invoice.title
    ? toDisplayTitle(invoice.title)
    : invoice.invoice_number || t("invoices.card.untitled");
  const account = invoice.account_name || t("invoices.card.noAccount");
  const seed = account || title;

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
      data-testid="invoice-card"
    >
      <Avatar init={getInitials(account)} size={42} color={avatarColor(seed)} />

      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
        <div className="row" style={{ gap: 8, marginTop: 4, whiteSpace: "nowrap" }}>
          <span className="truncate" style={{ fontSize: 12, color: "var(--mute)" }}>{account}</span>
          {invoice.invoice_number && (
            <>
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--mute-2)", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)", letterSpacing: "0.06em" }}>{invoice.invoice_number}</span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end" style={{ gap: 7 }}>
        <span className="serif" style={{ fontSize: 24, color: "var(--ink)", lineHeight: 1 }}>
          {formatCurrency(invoice.total, invoice.currency || "EUR")}
        </span>
        <DueLabel invoice={invoice} />
      </div>
    </button>
  );
}
