import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { CONTRACT_STATUS_COLORS } from "../types";
import type { ContractRow } from "../types";

interface ContractCardProps {
  contract: ContractRow;
  isSelected: boolean;
  onClick: () => void;
}

export function ContractCard({ contract, isSelected, onClick }: ContractCardProps) {
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
              {contract.title || "Untitled Contract"}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.dot }} />
              {status}
            </span>
          </div>

          {/* Row 2: Account */}
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <span className="text-[11px] text-muted-foreground truncate">
              {contract.account_name || "No account"}
            </span>
            {contract.file_size && (
              <span className="text-[10px] text-muted-foreground/70 shrink-0">
                {formatFileSize(contract.file_size)}
              </span>
            )}
          </div>

          {/* Row 3: Date range */}
          {(startDate || endDate) && (
            <div className="text-[10px] text-muted-foreground/70 mt-1">
              {startDate && endDate
                ? `${formatShortDate(startDate)} → ${formatShortDate(endDate)}`
                : startDate
                  ? `From ${formatShortDate(startDate)}`
                  : endDate
                    ? `Until ${formatShortDate(endDate)}`
                    : ""
              }
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
