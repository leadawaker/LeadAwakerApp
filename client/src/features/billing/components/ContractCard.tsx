import { cn } from "@/lib/utils";
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const startDate = contract.start_date ? new Date(contract.start_date) : null;
  const endDate = contract.end_date ? new Date(contract.end_date) : null;
  const formatShortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

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
      className={cn(
        "w-full text-left rounded-xl px-2.5 pt-2.5 pb-2 transition-colors cursor-pointer",
        isSelected ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* File icon avatar */}
        <div
          className="h-[34px] w-[34px] rounded-full shrink-0 flex items-center justify-center border border-black/[0.125]"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          <FileText className="h-3.5 w-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: Title */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[16px] font-semibold font-heading text-foreground truncate">
              {contract.title || t("contracts.card.untitledContract")}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.dot }} />
              {t(`contracts.statusLabels.${status}`, status)}
            </span>
          </div>

          {/* Row 2: Account + Value */}
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <span className="text-[11px] text-muted-foreground truncate">
              {contract.account_name || t("contracts.card.noAccount")}
            </span>
            {contractValue ? (
              <span className="text-[11px] font-semibold text-foreground shrink-0 tabular-nums">
                {contractValue}
              </span>
            ) : contract.file_size ? (
              <span className="text-[10px] text-muted-foreground/70 shrink-0">
                {formatFileSize(contract.file_size)}
              </span>
            ) : null}
          </div>

          {/* Row 3: Date range */}
          {(startDate || endDate) && (
            <div className="text-[10px] text-muted-foreground/70 mt-1">
              {startDate && endDate
                ? `${formatShortDate(startDate)} → ${formatShortDate(endDate)}`
                : startDate
                  ? t("contracts.card.from", { date: formatShortDate(startDate) })
                  : endDate
                    ? t("contracts.card.until", { date: formatShortDate(endDate) })
                    : ""
              }
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
