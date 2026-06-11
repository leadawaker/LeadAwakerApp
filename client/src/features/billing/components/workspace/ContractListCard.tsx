import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ContractRow } from "../../types";
import { formatCurrency } from "../../types";
import { StatusPill, fmtDate } from "./atoms";
import { contractStatusColors } from "./adapters";

// Derive a display value from the contract's deal-type money fields.
export function deriveContractValue(contract: ContractRow, t: (k: string, o?: any) => string): string | null {
  const cur = contract.currency || "EUR";
  if (contract.fixed_fee_amount && parseFloat(String(contract.fixed_fee_amount)) > 0) return formatCurrency(contract.fixed_fee_amount, cur);
  if (contract.monthly_fee && parseFloat(String(contract.monthly_fee)) > 0) return `${formatCurrency(contract.monthly_fee, cur)}/mo`;
  if (contract.value_per_booking && parseFloat(String(contract.value_per_booking)) > 0) return `${formatCurrency(contract.value_per_booking, cur)}/booking`;
  if (contract.deposit_amount && parseFloat(String(contract.deposit_amount)) > 0) return formatCurrency(contract.deposit_amount, cur);
  return null;
}

export function ContractListCard({ contract, isSelected, onClick }: {
  contract: ContractRow; isSelected: boolean; onClick: () => void;
}) {
  const { t } = useTranslation("billing");
  const status = contract.status || "Draft";
  const colors = contractStatusColors(status);

  const fmtShort = (d: string) => fmtDate(d);
  const termLabel = contract.start_date && contract.end_date
    ? `${fmtShort(contract.start_date)} → ${fmtShort(contract.end_date)}`
    : contract.start_date
      ? t("contracts.card.from", { date: fmtShort(contract.start_date) })
      : contract.end_date
        ? t("contracts.card.until", { date: fmtShort(contract.end_date) })
        : null;

  const stampDate = contract.signed_at || contract.created_at;
  const value = deriveContractValue(contract, t);

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
      data-testid="contract-card"
    >
      <span className="shrink-0 flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: "var(--r-surface)", background: colors.bg, color: colors.text }}>
        <FileText className="h-[18px] w-[18px]" />
      </span>

      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
          {contract.title || t("contracts.card.untitledContract")}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <span className="truncate" style={{ fontSize: 12, color: "var(--mute)" }}>
            {contract.account_name || t("contracts.card.noAccount")}
          </span>
          {termLabel && (
            <>
              <span className="shrink-0" style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--mute-2)" }} />
              <span className="shrink-0" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute-2)", whiteSpace: "nowrap" }}>{termLabel}</span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end" style={{ gap: 7 }}>
        {value && <span className="serif" style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1 }}>{value}</span>}
        <div className="row" style={{ gap: 10 }}>
          {stampDate && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{fmtShort(stampDate)}</span>}
          <StatusPill kind="contract" status={status} label={t(`contracts.statusLabels.${status}`, status)} />
        </div>
      </div>
    </button>
  );
}
