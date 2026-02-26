import {
  Plus,
  Filter,
  Cpu,
  Search,
  X,
  Check,
  ArrowUpDown,
  Layers,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToolbarPill } from "@/components/ui/toolbar-pill";
import { cn } from "@/lib/utils";

import {
  PROMPT_TABLE_COLUMNS,
  DEFAULT_VISIBLE_PROMPT_COLS,
  PROMPT_SORT_LABELS,
  PROMPT_GROUP_LABELS,
  type PromptSortOption,
  type PromptGroupOption,
  type PromptColKey,
} from "../types";

/* ════════════════════════════════════════════════════════════════════════════
   PromptsToolbar — search, filters, sort, group, fields, create
   ════════════════════════════════════════════════════════════════════════════ */

interface PromptsToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  modelFilter: string;
  onModelFilterChange: (m: string) => void;
  campaignFilter: string;
  onCampaignFilterChange: (c: string) => void;
  availableModels: string[];
  availableCampaigns: { id: number; name: string }[];
  totalCount: number;
  onOpenCreate: () => void;
  isFilterActive: boolean;
  activeFilterCount: number;
  onClearAllFilters: () => void;
  sortBy: PromptSortOption;
  onSortByChange: (s: PromptSortOption) => void;
  groupBy: PromptGroupOption;
  onGroupByChange: (g: PromptGroupOption) => void;
  visibleCols: Set<PromptColKey>;
  onVisibleColsChange: React.Dispatch<React.SetStateAction<Set<PromptColKey>>>;
  showTableControls: boolean;
}

const STATUS_OPTIONS = ["all", "active", "archived"] as const;
const SORT_OPTIONS: PromptSortOption[] = ["recent", "name_asc", "name_desc", "score_desc", "score_asc"];
const GROUP_OPTIONS: PromptGroupOption[] = ["status", "model", "campaign", "none"];

export function PromptsToolbar({
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  modelFilter,
  onModelFilterChange,
  campaignFilter,
  onCampaignFilterChange,
  availableModels,
  availableCampaigns,
  totalCount,
  onOpenCreate,
  isFilterActive,
  activeFilterCount,
  onClearAllFilters,
  sortBy,
  onSortByChange,
  groupBy,
  onGroupByChange,
  visibleCols,
  onVisibleColsChange,
  showTableControls,
}: PromptsToolbarProps) {
  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      {/* ── Separator from ViewTabBar ───────────────────────────────────── */}
      <div className="w-px h-4 bg-border/25 mx-0.5 shrink-0" />

      {/* ── 1. Search (always visible) ───────────────────────────────────── */}
      <div className="h-10 flex items-center gap-1.5 rounded-full border border-border/30 bg-card/60 px-3 min-w-[180px] max-w-[240px]">
        <Search className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        <input
          type="text"
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-none min-w-0"
          data-testid="input-prompt-search"
        />
        {searchQuery && (
          <button onClick={() => onSearchQueryChange("")} className="shrink-0">
            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* ── 2. +Create button ────────────────────────────────────────────── */}
      <button
        className="toolbar-pill-base shrink-0"
        onClick={onOpenCreate}
        data-testid="button-create-prompt"
      >
        <Plus className="h-4 w-4" />
        Create
      </button>

      {/* ── 3. Sort dropdown ─────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={ArrowUpDown}
            label="Sort"
            active={sortBy !== "recent"}
            activeValue={sortBy !== "recent" ? PROMPT_SORT_LABELS[sortBy].split(" ")[0] : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Sort by
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SORT_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt}
              onClick={() => onSortByChange(opt)}
              className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}
            >
              {PROMPT_SORT_LABELS[opt]}
              {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 4. Filter dropdown (status + model + campaign) ───────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={Filter}
            label="Filter"
            active={isFilterActive}
            activeValue={isFilterActive ? activeFilterCount : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
          {/* Status section */}
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Status
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt}
              className="text-[12px] flex items-center justify-between"
              onClick={(e) => { e.preventDefault(); onStatusFilterChange(opt); }}
            >
              {opt === "all" ? "All Statuses" : opt.charAt(0).toUpperCase() + opt.slice(1)}
              {statusFilter === opt && <Check className="h-3 w-3 text-brand-indigo" />}
            </DropdownMenuItem>
          ))}

          {/* Model section */}
          {availableModels.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Model
              </DropdownMenuLabel>
              <DropdownMenuItem
                className={cn("text-[12px]", modelFilter === "all" && "font-semibold text-brand-indigo")}
                onClick={(e) => { e.preventDefault(); onModelFilterChange("all"); }}
              >
                All Models
                {modelFilter === "all" && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableModels.map((m) => (
                <DropdownMenuItem
                  key={m}
                  className={cn("text-[12px]", modelFilter === m && "font-semibold text-brand-indigo")}
                  onClick={(e) => { e.preventDefault(); onModelFilterChange(m); }}
                >
                  <span className="truncate flex-1">{m}</span>
                  {modelFilter === m && <Check className="h-3 w-3 ml-1 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {/* Campaign section */}
          {availableCampaigns.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Campaign
              </DropdownMenuLabel>
              <DropdownMenuItem
                className={cn("text-[12px]", !campaignFilter && "font-semibold text-brand-indigo")}
                onClick={(e) => { e.preventDefault(); onCampaignFilterChange(""); }}
              >
                All Campaigns
                {!campaignFilter && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableCampaigns.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  className={cn("text-[12px]", campaignFilter === String(c.id) && "font-semibold text-brand-indigo")}
                  onClick={(e) => { e.preventDefault(); onCampaignFilterChange(campaignFilter === String(c.id) ? "" : String(c.id)); }}
                >
                  <span className="truncate flex-1">{c.name}</span>
                  {campaignFilter === String(c.id) && <Check className="h-3 w-3 ml-1 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {/* Clear all */}
          {isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClearAllFilters} className="text-[12px] text-destructive">
                Clear all filters
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 5. Group dropdown (table view only) ──────────────────────────── */}
      {showTableControls && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarPill
              icon={Layers}
              label="Group"
              active={groupBy !== "none"}
              activeValue={groupBy !== "none" ? PROMPT_GROUP_LABELS[groupBy] : undefined}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {GROUP_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt}
                onClick={() => onGroupByChange(opt)}
                className={cn("text-[12px]", groupBy === opt && "font-semibold text-brand-indigo")}
              >
                {PROMPT_GROUP_LABELS[opt]}
                {groupBy === opt && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* ── 6. Fields dropdown (table view only) ─────────────────────────── */}
      {showTableControls && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarPill
              icon={Eye}
              label="Fields"
              active={visibleCols.size !== DEFAULT_VISIBLE_PROMPT_COLS.length}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Show / Hide Columns
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PROMPT_TABLE_COLUMNS.filter((col) => col.key !== "actions").map((col) => {
              const isVisible = visibleCols.has(col.key);
              return (
                <DropdownMenuItem
                  key={col.key}
                  onClick={(e) => {
                    e.preventDefault();
                    onVisibleColsChange((prev) => {
                      const next = new Set(prev);
                      if (next.has(col.key)) {
                        if (next.size > 2) next.delete(col.key); // keep at least name + actions
                      } else {
                        next.add(col.key);
                      }
                      return next;
                    });
                  }}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <div className={cn(
                    "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                    isVisible ? "bg-brand-indigo border-brand-indigo" : "border-border/50",
                  )}>
                    {isVisible && <Check className="h-2 w-2 text-white" />}
                  </div>
                  <span className="flex-1">{col.label}</span>
                  {col.defaultVisible === false && (
                    <span className="text-[9px] text-muted-foreground/40 px-1 bg-muted rounded font-medium">+</span>
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onVisibleColsChange(new Set(DEFAULT_VISIBLE_PROMPT_COLS))}
              className="text-[12px] text-muted-foreground"
            >
              Reset to default
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* ── 7. Count label ─────────────────────────────────────────────── */}
      <span className="text-[12px] text-muted-foreground/60 tabular-nums whitespace-nowrap shrink-0 ml-1">
        {totalCount} {totalCount === 1 ? "prompt" : "prompts"}
      </span>

      {/* ── Spacer ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0" />
    </div>
  );
}
