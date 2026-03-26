// src/features/accounts/pages/pageWidgets/TableToolbar.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpDown, Filter, Layers, Eye, Check, Plus, Copy, Trash2, Pencil, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchPill } from "@/components/ui/search-pill";
import { cn } from "@/lib/utils";
import {
  TABLE_COL_META_KEYS,
  DEFAULT_VISIBLE,
  TABLE_SORT_KEYS,
  TABLE_GROUP_KEYS,
  STATUS_OPTIONS,
  STATUS_DOT,
  xBase,
  xDefault,
  xActive,
  xSpan,
  type TableSortByOption,
  type TableGroupByOption,
} from "./accountsPageConstants";
import { ConfirmToolbarButton } from "./ConfirmToolbarButton";

interface TableToolbarProps {
  tableSearch: string;
  onTableSearchChange: (v: string) => void;
  tableSortBy: TableSortByOption;
  onTableSortByChange: (v: TableSortByOption) => void;
  isTableFilterActive: boolean;
  tableFilterStatus: string[];
  onToggleTableFilterStatus: (s: string) => void;
  availableTypes: string[];
  tableFilterType: string;
  onTableFilterTypeChange: (v: string) => void;
  onClearTableFilters: () => void;
  tableGroupBy: TableGroupByOption;
  onTableGroupByChange: (v: TableGroupByOption) => void;
  visibleCols: Set<string>;
  onVisibleColsChange: (cols: Set<string>) => void;
  tableSelectedIds: Set<number>;
  onClearSelection: () => void;
  onAddAccount: () => Promise<void>;
  onBulkStatusChange: (status: string) => Promise<void>;
  onDuplicateAccounts: () => Promise<void>;
  onBulkDeleteAccounts: () => Promise<void>;
}

export function TableToolbar({
  tableSearch,
  onTableSearchChange,
  tableSortBy,
  onTableSortByChange,
  isTableFilterActive,
  tableFilterStatus,
  onToggleTableFilterStatus,
  availableTypes,
  tableFilterType,
  onTableFilterTypeChange,
  onClearTableFilters,
  tableGroupBy,
  onTableGroupByChange,
  visibleCols,
  onVisibleColsChange,
  tableSelectedIds,
  onClearSelection,
  onAddAccount,
  onBulkStatusChange,
  onDuplicateAccounts,
  onBulkDeleteAccounts,
}: TableToolbarProps) {
  const { t } = useTranslation("accounts");
  const TABLE_COL_META = TABLE_COL_META_KEYS.map((c) => ({ ...c, label: t(c.labelKey) }));

  return (
    <>
      <div className="w-px h-4 bg-border/25 mx-0.5 shrink-0" />

      {/* Search */}
      <SearchPill
        value={tableSearch}
        onChange={onTableSearchChange}
        open={!!tableSearch}
        onOpenChange={() => {}}
        placeholder={t("page.searchPlaceholder")}
      />

      {/* +Add */}
      <ConfirmToolbarButton icon={Plus} label={t("toolbar.add")} onConfirm={onAddAccount} confirmYes={t("toolbar.yes")} confirmNo={t("toolbar.no")} />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, tableSortBy !== "recent" ? xActive : xDefault, "hover:max-w-[100px]")}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.sortBy")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(TABLE_SORT_KEYS) as TableSortByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => onTableSortByChange(opt)} className={cn("text-[12px]", tableSortBy === opt && "font-semibold text-brand-indigo")}>
              {t(TABLE_SORT_KEYS[opt])}
              {tableSortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isTableFilterActive ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Filter className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.filter")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("filter.status")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleTableFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[s] ?? "bg-zinc-400")} />
              <span className="flex-1">{s}</span>
              {tableFilterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}

          {availableTypes.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("group.type")}</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); onTableFilterTypeChange(""); }}
                className={cn("text-[12px]", !tableFilterType && "font-semibold text-brand-indigo")}
              >
                {t("filter.allTypes")} {!tableFilterType && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableTypes.map((t) => (
                <DropdownMenuItem
                  key={t}
                  onClick={(e) => { e.preventDefault(); onTableFilterTypeChange(tableFilterType === t ? "" : t); }}
                  className={cn("text-[12px]", tableFilterType === t && "font-semibold text-brand-indigo")}
                >
                  <span className="flex-1 truncate">{t}</span>
                  {tableFilterType === t && <Check className="h-3 w-3 ml-1 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {isTableFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClearTableFilters} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, tableGroupBy !== "status" ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Layers className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.group")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(Object.keys(TABLE_GROUP_KEYS) as TableGroupByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => onTableGroupByChange(opt)} className={cn("text-[12px]", tableGroupBy === opt && "font-semibold text-brand-indigo")}>
              {t(TABLE_GROUP_KEYS[opt])}
              {tableGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Fields (Column Visibility) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, visibleCols.size !== DEFAULT_VISIBLE.length ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Eye className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.fields")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.showHideColumns")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TABLE_COL_META.map((col) => {
            const isVisible = visibleCols.has(col.key);
            return (
              <DropdownMenuItem
                key={col.key}
                onClick={(e) => {
                  e.preventDefault();
                  const next = new Set(visibleCols);
                  if (next.has(col.key)) { if (next.size > 1) next.delete(col.key); }
                  else next.add(col.key);
                  onVisibleColsChange(next);
                }}
                className="flex items-center gap-2 text-[12px]"
              >
                <div className={cn(
                  "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                  isVisible ? "bg-brand-indigo border-brand-indigo" : "border-border/50"
                )}>
                  {isVisible && <Check className="h-2 w-2 text-white" />}
                </div>
                <span className="flex-1">{col.label}</span>
                {!col.defaultVisible && (
                  <span className="text-[9px] text-muted-foreground/40 px-1 bg-muted rounded font-medium">+</span>
                )}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onVisibleColsChange(new Set(DEFAULT_VISIBLE))} className="text-[12px] text-muted-foreground">
            {t("toolbar.resetToDefault")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selection actions — far right, when rows selected */}
      {tableSelectedIds.size > 0 && (
        <>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-1 shrink-0">
            {/* Change Status dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(xBase, xDefault, "hover:max-w-[140px]")}>
                  <Pencil className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("toolbar.changeStatus")}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => onBulkStatusChange(s)} className="text-[12px]">
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmToolbarButton icon={Copy} label={t("toolbar.duplicate")} onConfirm={onDuplicateAccounts} confirmYes={t("toolbar.yes")} confirmNo={t("toolbar.no")} />
            <ConfirmToolbarButton icon={Trash2} label={t("toolbar.delete")} onConfirm={onBulkDeleteAccounts} variant="danger" confirmYes={t("toolbar.yes")} confirmNo={t("toolbar.no")} />

            {/* Count badge with dismiss */}
            <button
              className="h-9 inline-flex items-center gap-1.5 rounded-full border border-black/[0.125] bg-card px-3 text-[12px] font-medium shrink-0 cursor-default ml-1 text-foreground/60"
              onClick={onClearSelection}
            >
              <span className="tabular-nums">{tableSelectedIds.size}</span>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </>
  );
}
