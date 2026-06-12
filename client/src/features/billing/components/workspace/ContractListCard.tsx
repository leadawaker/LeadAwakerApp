import { FileText, Check } from "lucide-react";
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

export function ContractListCard({ contract, isSelected, isChecked, onClick, onCheck }: {
  contract: ContractRow; isSelected: boolean; isChecked?: boolean; onClick: () => void; onCheck?: (e: React.MouseEvent) => void;
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

  const value = deriveContractValue(contract, t);

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
      data-testid="contract-card"
    >
      <span
        className="shrink-0 flex items-center justify-center"
        onClick={onCheck ? (e) => { e.stopPropagation(); onCheck(e); } : undefined}
        style={{
          width: 36, height: 36, borderRadius: "var(--r-surface)",
          background: isChecked ? "var(--wine)" : colors.bg,
          color: isChecked ? "var(--paper)" : colors.text,
          cursor: onCheck ? "pointer" : undefined,
          transition: "background 120ms",
        }}
      >
        {isChecked ? <Check className="h-[14px] w-[14px]" /> : <FileText className="h-[15px] w-[15px]" />}
      </span>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            {contract.title || t("contracts.card.untitledContract")}
          </div>
          <div className="row" style={{ gap: 6, marginTop: 3 }}>
            <span className="truncate" style={{ fontSize: 11.5, color: "var(--mute)" }}>
              {contract.account_name || t("contracts.card.noAccount")}
            </span>
            {termLabel && (
              <>
                <span className="shrink-0" style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--mute-2)" }} />
                <span className="shrink-0" style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", whiteSpace: "nowrap" }}>{termLabel}</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end" style={{ gap: 5 }}>
          {value && <span className="serif" style={{ fontSize: 19, color: "var(--ink)", lineHeight: 1 }}>{value}</span>}
          <StatusPill kind="contract" status={status} label={t(`contracts.statusLabels.${status}`, status)} />
        </div>
      </div>
    </button>
  );
}
