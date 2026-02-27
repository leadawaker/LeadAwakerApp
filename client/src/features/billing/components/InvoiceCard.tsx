import { cn } from "@/lib/utils";
import { INVOICE_STATUS_COLORS, formatCurrency, isOverdue } from "../types";
import type { InvoiceRow } from "../types";

interface InvoiceCardProps {
  invoice: InvoiceRow;
  isSelected: boolean;
  onClick: () => void;
}

export function InvoiceCard({ invoice, isSelected, onClick }: InvoiceCardProps) {
  const displayStatus = isOverdue(invoice) ? "Overdue" : (invoice.status || "Draft");
  const colors = INVOICE_STATUS_COLORS[displayStatus] || INVOICE_STATUS_COLORS.Draft;

  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const now = new Date();
  const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

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
        {/* Status-colored avatar */}
        <div
          className="h-[34px] w-[34px] rounded-full shrink-0 flex items-center justify-center border border-border/50"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          <span className="text-[11px] font-bold">$</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: Title + Amount */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[16px] font-semibold font-heading text-foreground truncate">
              {invoice.title || invoice.invoice_number || "Untitled"}
            </span>
            <span className="text-[12px] font-bold text-foreground shrink-0 tabular-nums">
              {formatCurrency(invoice.total, invoice.currency || "USD")}
            </span>
          </div>

          {/* Row 2: Account + Status badge */}
          <div className="flex items-center justify-between gap-1 mt-0.5">
            <span className="text-[11px] text-muted-foreground truncate">
              {invoice.account_name || "No account"}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.dot }} />
              {displayStatus}
            </span>
          </div>

          {/* Row 3: Invoice number + Due date */}
          <div className="flex items-center justify-between gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground/70 tabular-nums">
              {invoice.invoice_number || ""}
            </span>
            {dueDate && (
              <span className={cn(
                "text-[10px] tabular-nums",
                displayStatus === "Overdue" ? "text-rose-600 font-semibold" : "text-muted-foreground/70"
              )}>
                {displayStatus === "Overdue"
                  ? `${Math.abs(daysUntilDue!)}d overdue`
                  : displayStatus === "Paid"
                    ? "Paid"
                    : daysUntilDue !== null && daysUntilDue <= 7
                      ? `Due in ${daysUntilDue}d`
                      : `Due ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                }
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
