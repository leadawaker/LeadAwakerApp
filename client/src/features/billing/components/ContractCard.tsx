import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CONTRACT_STATUS_COLORS, formatCurrency } from "../types";
import type { ContractRow } from "../types";

interface ContractCardProps {
  contract: ContractRow;
  isSelected: boolean;
  onClick: () => void;
}

export function ContractCard({ contract, isSelected, onClick }: ContractCardProps) {
  const { t } = useTranslation("billing");
  const status = contract.status || "Draft";
  const colors = CONTRACT_STATUS_COLORS[status] || CONTRACT_STATUS_COLORS.Draft;

  const startDate = contract.start_date ? new Date(contract.start_date) : null;
  const endDate = contract.end_date ? new Date(contract.end_date) : null;
  const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

  // Date shown bottom-right: prefer signed date, else created date
  const stampDate = contract.signed_at
    ? new Date(contract.signed_at)
    : contract.created_at
      ? new Date(contract.created_at)
      : null;

  // Term sub-label (date range) shown in the middle row
  const termLabel = startDate && endDate
    ? `${fmtShort(startDate)} → ${fmtShort(endDate)}`
    : startDate
      ? t("contracts.card.from", { date: fmtShort(startDate) })
      : endDate
        ? t("contracts.card.until", { date: fmtShort(endDate) })
        : null;

  // Derive contract value from deal_type / monetary fields
  const contractValue = (() => {
    const cur = contract.currency || "EUR";
    if (contract.fixed_fee_amount && parseFloat(String(contract.fixed_fee_amount)) > 0) {
      return formatCurrency(contract.fixed_fee_amount, cur);
    }
    if (contract.monthly_fee && parseFloat(String(contract.monthly_fee)) > 0) {
      return `${formatCurrency(contract.monthly_fee, cur)}/mo`;
    }
    if (contract.value_per_booking && parseFloat(String(contract.value_per_booking)) > 0) {
      return `${formatCurrency(contract.value_per_booking, cur)}/booking`;
    }
    if (contract.deposit_amount && parseFloat(String(contract.deposit_amount)) > 0) {
      return formatCurrency(contract.deposit_amount, cur);
    }
    return null;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
      className="w-full text-left flex items-center gap-3 cursor-pointer"
      style={{
        padding: "13px 16px",
        borderRadius: "var(--r-card)",
        background: "var(--card)",
        boxShadow: isSelected
          ? "var(--sh-raised-medium), 0 0 0 1.5px var(--wine)"
          : "var(--sh-raised-crisp)",
        transition: "box-shadow 130ms, transform 130ms",
      }}
    >
      {/* Status-tinted file tile */}
      <span
        className="shrink-0 flex items-center justify-center"
        style={{
          width: 42,
          height: 42,
          borderRadius: "var(--r-surface)",
          background: colors.bg,
          color: colors.text,
        }}
      >
        <FileText className="h-[18px] w-[18px]" />
      </span>

      <div className="flex-1 min-w-0">
        {/* Title */}
        <div
          className="truncate"
          style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}
        >
          {contract.title || t("contracts.card.untitledContract")}
        </div>
        {/* client • term */}
        <div className="row mt-1" style={{ gap: 8 }}>
          <span className="truncate" style={{ fontSize: 12, color: "var(--mute)" }}>
            {contract.account_name || t("contracts.card.noAccount")}
          </span>
          {termLabel && (
            <>
              <span className="shrink-0" style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--mute-2)" }} />
              <span
                className="shrink-0"
                style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)", whiteSpace: "nowrap" }}
              >
                {termLabel}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: serif value + date/status row */}
      <div className="shrink-0 flex flex-col items-end" style={{ gap: 7 }}>
        {contractValue && (
          <span className="serif" style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1 }}>
            {contractValue}
          </span>
        )}
        <div className="row" style={{ gap: 10 }}>
          {stampDate && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>
              {fmtShort(stampDate)}
            </span>
          )}
          <span
            className="inline-flex items-center shrink-0"
            style={{
              gap: 6,
              padding: "4px 10px",
              borderRadius: "var(--r-pill)",
              background: colors.bg,
              color: colors.text,
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.dot, flexShrink: 0 }} />
            {t(`contracts.statusLabels.${status}`, status)}
          </span>
        </div>
      </div>
    </button>
  );
}
