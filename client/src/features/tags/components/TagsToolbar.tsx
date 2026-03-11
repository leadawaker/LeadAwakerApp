import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Plus,
  ArrowUpDown,
  Filter,
  Layers,
  Eye,
  Check,
  Copy,
  Trash2,
  Search,
  X,
  Building2,
  Megaphone,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { InlineColorPicker } from "./ColorPicker";
import type {
  TagSortOption,
  TagGroupOption,
  TagAutoAppliedFilter,
} from "../types";
import {
  TAG_TABLE_COLUMNS,
} from "../types";

/* ── i18n key maps (module-level, no hooks) ───────────────────────────────── */

const SORT_TKEYS: Record<TagSortOption, string> = {
  name_asc:     "sort.nameAsc",
  name_desc:    "sort.nameDesc",
  count_desc:   "sort.countDesc",
  category_asc: "sort.categoryAsc",
};

const GROUP_TKEYS: Record<TagGroupOption, string> = {
  category: "group.category",
  color:    "group.color",
  none:     "group.none",
};

const AUTO_APPLIED_TKEYS: Record<TagAutoAppliedFilter, string> = {
  all: "toolbar.autoAll",
  yes: "toolbar.autoYes",
  no:  "toolbar.autoNo",
};

/* ════════════════════════════════════════════════════════════════════════════
   TagsToolbar — action buttons: search, sort, filter, group, fields, bulk
   ════════════════════════════════════════════════════════════════════════════ */

interface TagsToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sortBy: TagSortOption;
  onSortByChange: (s: TagSortOption) => void;
  groupBy: TagGroupOption;
  onGroupByChange: (g: TagGroupOption) => void;
  filterCategories: string[];
  filterAutoApplied: TagAutoAppliedFilter;
  onToggleFilterCategory: (cat: string) => void;
  onFilterAutoAppliedChange: (f: TagAutoAppliedFilter) => void;
  isFilterActive: boolean;
  filterCount: number;
  categoryOptions: string[];
  visibleCols: Set<string>;
  onVisibleColsChange: (cols: Set<string>) => void;
  selectedTagIds: Set<number>;
  tagOnlyCount: number;
  onCreate: (payload: { name: string; color?: string; category?: string }) => Promise<any>;
  onDuplicate: () => Promise<void>;
  onOpenDeleteBulk: () => void;
  onClearSelection?: () => void;
  // Account / Campaign dropdowns
  accounts: any[];
  campaigns: any[];
  selectedAccountId: string;
  onAccountChange: (id: string) => void;
  campaignId: string;
  onCampaignChange: (id: string) => void;
  accountNameMap: Map<string, string>;
}

/* ── ConfirmToolbarButton ──────────────────────────────────────────────── */

function ConfirmToolbarButton({
  icon: Icon,
  label,
  onConfirm,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  onConfirm: () => Promise<void> | void;
  variant?: "default" | "danger";
}) {
  const { t } = useTranslation("tags");
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (confirming) {
    return (
      <div className="h-10 flex items-center gap-1 rounded-full border border-black/[0.125] bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">
          {label}?
        </span>
        <button
          className="px-2 py-0.5 rounded-full bg-brand-indigo text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
          onClick={async () => {
            setLoading(true);
            try {
              await onConfirm();
            } finally {
              setLoading(false);
              setConfirming(false);
            }
          }}
          disabled={loading}
        >
          {loading ? "\u2026" : t("toolbar.confirmYes")}
        </button>
        <button
          className="px-2 py-0.5 rounded-full text-muted-foreground text-[11px] hover:text-foreground"
          onClick={() => setConfirming(false)}
        >
          {t("toolbar.confirmNo")}
        </button>
      </div>
    );
  }

  return (
    <button
      className={cn(
        "h-10 inline-flex items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium shrink-0",
        variant === "danger"
          ? "border-red-300/50 text-red-600 hover:bg-red-50/60"
          : "border-border/30 text-foreground/70 hover:bg-card hover:text-foreground",
      )}
      onClick={() => setConfirming(true)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════════════════════════ */

const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive  = "border-brand-indigo text-brand-indigo";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

export function TagsToolbar({
  searchQuery,
  onSearchQueryChange,
  sortBy,
  onSortByChange,
  groupBy,
  onGroupByChange,
  filterCategories,
  filterAutoApplied,
  onToggleFilterCategory,
  onFilterAutoAppliedChange,
  isFilterActive,
  filterCount,
  categoryOptions,
  visibleCols,
  onVisibleColsChange,
  selectedTagIds,
  tagOnlyCount,
  onCreate,
  onDuplicate,
  onOpenDeleteBulk,
  onClearSelection,
  accounts,
  campaigns,
  selectedAccountId,
  onAccountChange,
  campaignId,
  onCampaignChange,
  accountNameMap,
}: TagsToolbarProps) {
  const { t } = useTranslation("tags");

  /* ── Create popover state ────────────────────────────────────────────── */
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState("blue");
  const [createCategory, setCreateCategory] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateSubmit = async () => {
    if (!createName.trim() || creating) return;
    setCreating(true);
    try {
      await onCreate({
        name: createName.trim(),
        color: createColor || undefined,
        category: createCategory.trim() || undefined,
      });
      // Reset form and close on success
      setCreateName("");
      setCreateColor("blue");
      setCreateCategory("");
      setCreateOpen(false);
    } finally {
      setCreating(false);
    }
  };

  /* ── Column toggle helper ──────────────────────────────────────────────── */
  const toggleCol = (key: string) => {
    const next = new Set(visibleCols);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onVisibleColsChange(next);
  };

  /* ── Toggleable columns (exclude always-visible) ───────────────────────── */
  const toggleableColumns = TAG_TABLE_COLUMNS.filter(
    (c) => !c.alwaysVisible && c.label,
  );

  const hasSelection = selectedTagIds.size > 0;

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      {/* ── 1. Search (always visible) ───────────────────────────────────── */}
      <div className="h-10 flex items-center gap-1.5 rounded-full border border-black/[0.125] bg-card/60 px-3 min-w-[140px] max-w-[220px]">
        <Search className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        <input
          type="text"
          placeholder={t("toolbar.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-none min-w-0"
        />
        {searchQuery && (
          <button onClick={() => onSearchQueryChange("")} className="shrink-0">
            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* ── 2. +Add (Popover with inline create form) ────────────────────── */}
      <Popover open={createOpen} onOpenChange={setCreateOpen}>
        <PopoverTrigger asChild>
          <button className={cn(xBase, xDefault, "hover:max-w-[80px]")} title={t("toolbar.addTitle")}>
            <Plus className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.add")}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-3 bg-popover" align="start" side="bottom" sideOffset={4}>
          <div className="space-y-2.5">
            <div className="text-[12px] font-semibold text-foreground">{t("toolbar.newTag")}</div>
            <input
              placeholder={t("toolbar.tagNamePlaceholder")}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-border/30 bg-background text-[12px] placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-brand-indigo/40"
            />
            <div className="flex items-center gap-2">
              <InlineColorPicker value={createColor} onChange={setCreateColor} />
              <input
                placeholder={t("toolbar.categoryPlaceholder")}
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value)}
                className="flex-1 h-9 px-2.5 rounded-lg border border-border/30 bg-background text-[12px] placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-brand-indigo/40"
              />
            </div>
            <button
              disabled={!createName.trim() || creating}
              onClick={handleCreateSubmit}
              className="w-full h-9 rounded-lg bg-brand-indigo text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {creating ? t("toolbar.creating") : t("toolbar.create")}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* ── 3. Account dropdown ──────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, selectedAccountId !== "all" ? xActive : xDefault, "hover:max-w-[100px]")} title={t("toolbar.accountTitle")}>
            <Building2 className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.account")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
          <DropdownMenuItem className="text-[12px]" onClick={() => onAccountChange("all")}>
            {t("toolbar.allAccounts")}
            {selectedAccountId === "all" && <Check className="h-3.5 w-3.5 text-brand-indigo ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {accounts.map((acc: any) => (
            <DropdownMenuItem key={acc.id} className="text-[12px]" onClick={() => onAccountChange(String(acc.id))}>
              <span className="flex-1 truncate">{acc.name}</span>
              {selectedAccountId === String(acc.id) && <Check className="h-3.5 w-3.5 text-brand-indigo ml-1" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 4. Campaign dropdown ─────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, campaignId !== "all" ? xActive : xDefault, "hover:max-w-[120px]")} title={t("toolbar.campaignTitle")}>
            <Megaphone className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.campaign")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
          <DropdownMenuItem className="text-[12px]" onClick={() => onCampaignChange("all")}>
            {t("toolbar.allCampaigns")}
            {campaignId === "all" && <Check className="h-3.5 w-3.5 text-brand-indigo ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {campaigns.map((camp: any) => (
            <DropdownMenuItem key={camp.id} className="text-[12px]" onClick={() => onCampaignChange(String(camp.id))}>
              <span className="flex-1 truncate">{camp.name}</span>
              {campaignId === String(camp.id) && <Check className="h-3.5 w-3.5 text-brand-indigo ml-1" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 5. Sort ──────────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, sortBy !== "name_asc" ? xActive : xDefault, "hover:max-w-[100px]")} title={t("toolbar.sortTitle")}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("toolbar.sortBy")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(SORT_TKEYS) as TagSortOption[]).map((key) => (
            <DropdownMenuItem
              key={key}
              className="text-[12px] flex items-center justify-between"
              onClick={() => onSortByChange(key)}
            >
              {t(SORT_TKEYS[key])}
              {sortBy === key && (
                <Check className="h-3.5 w-3.5 text-brand-indigo" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 6. Filter ────────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isFilterActive ? xActive : xDefault, "hover:max-w-[100px]")} title={t("toolbar.filterTitle")}>
            <Filter className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.filter")}{isFilterActive && filterCount > 0 ? ` (${filterCount})` : ""}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {/* Category checkboxes */}
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("toolbar.category")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {categoryOptions.map((cat) => {
            const checked = filterCategories.includes(cat);
            return (
              <DropdownMenuItem
                key={cat}
                className="text-[12px] flex items-center gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleFilterCategory(cat);
                }}
              >
                <div
                  className={cn(
                    "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                    checked
                      ? "border-brand-indigo bg-brand-indigo"
                      : "border-black/[0.125]",
                  )}
                >
                  {checked && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                {cat}
              </DropdownMenuItem>
            );
          })}

          {/* Auto-applied radio */}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("toolbar.autoApplied")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(["all", "yes", "no"] as TagAutoAppliedFilter[]).map((opt) => (
            <DropdownMenuItem
              key={opt}
              className="text-[12px] flex items-center justify-between"
              onClick={(e) => {
                e.preventDefault();
                onFilterAutoAppliedChange(opt);
              }}
            >
              {t(AUTO_APPLIED_TKEYS[opt])}
              {filterAutoApplied === opt && (
                <Check className="h-3.5 w-3.5 text-brand-indigo" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 7. Group ─────────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, groupBy !== "none" ? xActive : xDefault, "hover:max-w-[100px]")} title={t("toolbar.groupTitle")}>
            <Layers className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.group")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("toolbar.groupBy")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(GROUP_TKEYS) as TagGroupOption[]).map((key) => (
            <DropdownMenuItem
              key={key}
              className="text-[12px] flex items-center justify-between"
              onClick={() => onGroupByChange(key)}
            >
              {t(GROUP_TKEYS[key])}
              {groupBy === key && (
                <Check className="h-3.5 w-3.5 text-brand-indigo" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 8. Fields (column visibility) ────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, xDefault, "hover:max-w-[100px]")} title={t("toolbar.fieldsTitle")}>
            <Eye className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.fields")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("toolbar.columns")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {toggleableColumns.map((col) => {
            const checked = visibleCols.has(col.key);
            return (
              <DropdownMenuItem
                key={col.key}
                className="text-[12px] flex items-center gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  toggleCol(col.key);
                }}
              >
                <div
                  className={cn(
                    "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                    checked
                      ? "border-brand-indigo bg-brand-indigo"
                      : "border-black/[0.125]",
                  )}
                >
                  {checked && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                {col.tKey ? t(col.tKey) : col.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 9. Tag count ─────────────────────────────────────────────────── */}
      <span className="text-[12px] text-muted-foreground/60 tabular-nums whitespace-nowrap shrink-0 ml-1">
        {t("toolbar.tagCount", { count: tagOnlyCount })}
      </span>

      {/* ── 10. Spacer ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0" />

      {/* ── 11. Bulk actions (only when selection exists) ─────────────────── */}
      {hasSelection && (
        <div className="ml-auto flex items-center gap-1.5">
          <ConfirmToolbarButton
            icon={Copy}
            label={t("toolbar.duplicate")}
            onConfirm={onDuplicate}
          />

          <button
            className={cn(xBase, "border-black/[0.125] text-foreground/60 hover:text-red-600 hover:border-red-300/50 hover:max-w-[100px]")}
            onClick={onOpenDeleteBulk}
            title={t("toolbar.deleteTitle")}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.delete")}</span>
          </button>

          {/* Selection count badge */}
          <span className="h-9 px-3 rounded-full border border-black/[0.125] text-foreground/60 text-[12px] font-medium inline-flex items-center gap-1.5 shrink-0 cursor-default">
            {selectedTagIds.size}
            <button onClick={() => onClearSelection?.()} className="text-foreground/40 hover:text-foreground" title="Clear selection">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
