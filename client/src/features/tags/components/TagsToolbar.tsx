import { useState, useRef, useEffect } from "react";
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
import { ToolbarPill } from "@/components/ui/toolbar-pill";
import { InlineColorPicker } from "./ColorPicker";
import type {
  TagSortOption,
  TagGroupOption,
  TagAutoAppliedFilter,
} from "../types";
import {
  TAG_SORT_LABELS,
  TAG_GROUP_LABELS,
  TAG_TABLE_COLUMNS,
} from "../types";

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
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (confirming) {
    return (
      <div className="h-10 flex items-center gap-1 rounded-full border border-border/30 bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">
          {label}?
        </span>
        <button
          className="px-2 py-0.5 rounded-full bg-brand-blue text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
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
          {loading ? "\u2026" : "Yes"}
        </button>
        <button
          className="px-2 py-0.5 rounded-full text-muted-foreground text-[11px] hover:text-foreground"
          onClick={() => setConfirming(false)}
        >
          No
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

const tbBase    = "h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 select-none";
const tbDefault = "border border-border/55 text-foreground/60 hover:text-foreground hover:bg-card";
const tbActive  = "bg-card border border-border/55 text-foreground";

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
  /* ── Responsive collapse (ResizeObserver) ────────────────────────────── */
  const [isNarrow, setIsNarrow] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setIsNarrow(e.contentRect.width < 920));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    <div ref={toolbarRef} className="flex items-center gap-1 flex-1 min-w-0">
      {/* ── 1. Search (always visible) ───────────────────────────────────── */}
      <div className="h-10 flex items-center gap-1.5 rounded-full border border-border/30 bg-card/60 px-3 min-w-[140px] max-w-[220px]">
        <Search className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        <input
          type="text"
          placeholder="Search tags..."
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
          {isNarrow ? (
            <button className="icon-circle-lg icon-circle-base shrink-0" title="Add tag">
              <Plus className="h-4 w-4" />
            </button>
          ) : (
            <button className={cn(tbBase, tbDefault, "shrink-0")}>
              <Plus className="h-4 w-4" />Add
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-3 bg-popover" align="start" side="bottom" sideOffset={4}>
          <div className="space-y-2.5">
            <div className="text-[12px] font-semibold text-foreground">New Tag</div>
            <input
              placeholder="Tag name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-border/30 bg-background text-[12px] placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-brand-blue/40"
            />
            <div className="flex items-center gap-2">
              <InlineColorPicker value={createColor} onChange={setCreateColor} />
              <input
                placeholder="Category"
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value)}
                className="flex-1 h-9 px-2.5 rounded-lg border border-border/30 bg-background text-[12px] placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-brand-blue/40"
              />
            </div>
            <button
              disabled={!createName.trim() || creating}
              onClick={handleCreateSubmit}
              className="w-full h-9 rounded-lg bg-brand-blue text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* ── 3. Account dropdown ──────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isNarrow ? (
            <button className={cn("icon-circle-lg icon-circle-base shrink-0", selectedAccountId !== "all" && "bg-card border-border/55")} title="Account filter">
              <Building2 className="h-4 w-4" />
            </button>
          ) : (
            <ToolbarPill
              icon={Building2}
              label={selectedAccountId === "all" ? "Account" : (accountNameMap.get(selectedAccountId) ?? "Account")}
              active={selectedAccountId !== "all"}
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
          <DropdownMenuItem className="text-[12px]" onClick={() => onAccountChange("all")}>
            All Accounts
            {selectedAccountId === "all" && <Check className="h-3.5 w-3.5 text-brand-blue ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {accounts.map((acc: any) => (
            <DropdownMenuItem key={acc.id} className="text-[12px]" onClick={() => onAccountChange(String(acc.id))}>
              <span className="flex-1 truncate">{acc.name}</span>
              {selectedAccountId === String(acc.id) && <Check className="h-3.5 w-3.5 text-brand-blue ml-1" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 4. Campaign dropdown ─────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isNarrow ? (
            <button className={cn("icon-circle-lg icon-circle-base shrink-0", campaignId !== "all" && "bg-card border-border/55")} title="Campaign filter">
              <Megaphone className="h-4 w-4" />
            </button>
          ) : (
            <ToolbarPill
              icon={Megaphone}
              label={campaignId === "all" ? "Campaign" : (campaigns.find((c: any) => String(c.id) === campaignId)?.name ?? "Campaign")}
              active={campaignId !== "all"}
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
          <DropdownMenuItem className="text-[12px]" onClick={() => onCampaignChange("all")}>
            All Campaigns
            {campaignId === "all" && <Check className="h-3.5 w-3.5 text-brand-blue ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {campaigns.map((camp: any) => (
            <DropdownMenuItem key={camp.id} className="text-[12px]" onClick={() => onCampaignChange(String(camp.id))}>
              <span className="flex-1 truncate">{camp.name}</span>
              {campaignId === String(camp.id) && <Check className="h-3.5 w-3.5 text-brand-blue ml-1" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 5. Sort ──────────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isNarrow ? (
            <button className={cn("icon-circle-lg icon-circle-base shrink-0", sortBy !== "name_asc" && "bg-card border-border/55")} title="Sort">
              <ArrowUpDown className="h-4 w-4" />
            </button>
          ) : (
            <ToolbarPill
              icon={ArrowUpDown}
              label="Sort"
              active={sortBy !== "name_asc"}
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Sort by
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.entries(TAG_SORT_LABELS) as [TagSortOption, string][]).map(
            ([key, label]) => (
              <DropdownMenuItem
                key={key}
                className="text-[12px] flex items-center justify-between"
                onClick={() => onSortByChange(key)}
              >
                {label}
                {sortBy === key && (
                  <Check className="h-3.5 w-3.5 text-brand-blue" />
                )}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 6. Filter ────────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isNarrow ? (
            <button className={cn("icon-circle-lg icon-circle-base shrink-0", isFilterActive && "bg-card border-border/55")} title="Filter">
              <Filter className="h-4 w-4" />
            </button>
          ) : (
            <ToolbarPill
              icon={Filter}
              label="Filter"
              active={isFilterActive}
              activeValue={isFilterActive ? filterCount : undefined}
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {/* Category checkboxes */}
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Category
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
                      ? "border-brand-blue bg-brand-blue"
                      : "border-border/50",
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
            Auto-Applied
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
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
              {filterAutoApplied === opt && (
                <Check className="h-3.5 w-3.5 text-brand-blue" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 7. Group ─────────────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isNarrow ? (
            <button className={cn("icon-circle-lg icon-circle-base shrink-0", groupBy !== "none" && "bg-card border-border/55")} title="Group">
              <Layers className="h-4 w-4" />
            </button>
          ) : (
            <ToolbarPill
              icon={Layers}
              label="Group"
              active={groupBy !== "none"}
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Group by
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.entries(TAG_GROUP_LABELS) as [TagGroupOption, string][]).map(
            ([key, label]) => (
              <DropdownMenuItem
                key={key}
                className="text-[12px] flex items-center justify-between"
                onClick={() => onGroupByChange(key)}
              >
                {label}
                {groupBy === key && (
                  <Check className="h-3.5 w-3.5 text-brand-blue" />
                )}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 8. Fields (column visibility) ────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isNarrow ? (
            <button className="icon-circle-lg icon-circle-base shrink-0" title="Fields">
              <Eye className="h-4 w-4" />
            </button>
          ) : (
            <ToolbarPill icon={Eye} label="Fields" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Columns
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
                      ? "border-brand-blue bg-brand-blue"
                      : "border-border/50",
                  )}
                >
                  {checked && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                {col.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 9. Tag count ─────────────────────────────────────────────────── */}
      <span className="text-[12px] text-muted-foreground/60 tabular-nums whitespace-nowrap shrink-0 ml-1">
        {tagOnlyCount} {tagOnlyCount === 1 ? "tag" : "tags"}
      </span>

      {/* ── 10. Spacer ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0" />

      {/* ── 11. Bulk actions (only when selection exists) ─────────────────── */}
      {hasSelection && (
        <div className="ml-auto flex items-center gap-1.5">
          {isNarrow ? (
            <button
              className="icon-circle-lg icon-circle-base shrink-0"
              onClick={() => onDuplicate()}
              title="Duplicate selected"
            >
              <Copy className="h-4 w-4" />
            </button>
          ) : (
            <ConfirmToolbarButton
              icon={Copy}
              label="Duplicate"
              onConfirm={onDuplicate}
            />
          )}

          <button
            className={cn(
              isNarrow
                ? "icon-circle-lg icon-circle-base hover:text-red-600 shrink-0"
                : cn(tbBase, "border border-border/60 hover:text-red-600")
            )}
            onClick={onOpenDeleteBulk}
            title="Delete selected"
          >
            <Trash2 className="h-4 w-4" />
            {!isNarrow && "Delete"}
          </button>

          {/* Selection count badge */}
          <span className={cn(tbBase, tbDefault, "cursor-default")}>
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
