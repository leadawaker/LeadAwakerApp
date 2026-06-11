import { useTranslation } from "react-i18next";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Field-based sort menu shared by the Billing tabs (invoices / contracts /
 * expenses). Each row is a sortable FIELD with an ascending and a descending
 * value; the up/down arrows flip direction (Leads-style). The active field row
 * paints a wine background with white text so the selected option stays
 * readable (the old wine-on-wine was invisible).
 */
export interface BillingSortField {
  /** Stable identity for the row key. */
  key: string;
  /** Translated field label, e.g. "Date", "Amount". */
  label: string;
  /** sortBy value for ascending (up arrow). */
  asc: string;
  /** sortBy value for descending (down arrow). */
  desc: string;
  /** Tooltip for the up arrow. */
  ascTitle?: string;
  /** Tooltip for the down arrow. */
  descTitle?: string;
}

interface BillingSortMenuProps {
  sortBy: string;
  setSortBy: (v: string) => void;
  fields: BillingSortField[];
  /** sortBy value that counts as "default" (trigger stays un-tinted). */
  defaultValue?: string;
  triggerClassName?: string;
}

export function BillingSortMenu({
  sortBy,
  setSortBy,
  fields,
  defaultValue = "recent",
  triggerClassName,
}: BillingSortMenuProps) {
  const { t } = useTranslation("billing");
  const isNonDefault = sortBy !== defaultValue;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "la-btn la-btn--soft shrink-0 hidden sm:inline-flex gap-1.5",
            isNonDefault && "[border-color:var(--wine)] [color:var(--wine)]",
            triggerClassName,
          )}
        >
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[11px]">{t("toolbar.sort")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {t("toolbar.sortBy")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {fields.map((f) => {
          const isActive = sortBy === f.asc || sortBy === f.desc;
          const dir = sortBy === f.asc ? "asc" : sortBy === f.desc ? "desc" : null;
          return (
            <div
              key={f.key}
              role="menuitemradio"
              aria-checked={isActive}
              onClick={() => setSortBy(isActive ? sortBy : f.desc)}
              className={cn(
                "flex items-center gap-2 rounded-md my-0.5 px-2 py-1.5 text-[12px] cursor-pointer select-none transition-colors",
                isActive
                  ? "bg-[var(--wine)] text-white"
                  : "text-foreground hover:bg-muted/60",
              )}
            >
              <span className="flex-1 font-medium">{f.label}</span>
              <button
                type="button"
                title={f.ascTitle ?? t("sort.asc")}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSortBy(f.asc); }}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  isActive
                    ? dir === "asc" ? "text-white" : "text-white/40 hover:text-white/80"
                    : "text-foreground/30 hover:text-foreground/60",
                )}
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                title={f.descTitle ?? t("sort.desc")}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSortBy(f.desc); }}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  isActive
                    ? dir === "desc" ? "text-white" : "text-white/40 hover:text-white/80"
                    : "text-foreground/30 hover:text-foreground/60",
                )}
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
