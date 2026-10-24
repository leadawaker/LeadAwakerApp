import { useTranslation } from "react-i18next";
import {
  Plus,
  Filter,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
import { ExpandingSearch, TopbarIconButton } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";

import {
  PROMPT_TABLE_COLUMNS,
  DEFAULT_VISIBLE_PROMPT_COLS,
  type PromptSortOption,
  type PromptGroupOption,
  type PromptColKey,
} from "../types";

/* ════════════════════════════════════════════════════════════════════════════
   PromptsToolbar — search, filters, sort, group, fields, create: the right
   side of the Prompt Library table topbar (PageTopbar `right`).
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Module-level tKey maps (data-as-labels pattern) ──────────────────────── */
const SORT_TKEYS: Record<PromptSortOption, string> = {
  recent:     "sort.recent",
  name_asc:   "sort.nameAsc",
  name_desc:  "sort.nameDesc",
  score_desc: "sort.scoreDesc",
  score_asc:  "sort.scoreAsc",
};

const GROUP_TKEYS: Record<PromptGroupOption, string> = {
  status:   "labels.status",
  model:    "labels.model",
  campaign: "labels.campaign",
  account:  "labels.account",
  none:     "group.none",
};

const STATUS_TKEYS: Record<string, string> = {
  all:      "toolbar.allStatuses",
  active:   "status.active",
  archived: "status.archived",
};

interface PromptsToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchOpen?: boolean;
  onSearchOpenChange?: (v: boolean) => void;
  typeFilter: "all" | "voice";
  onTypeFilterChange: (v: "all" | "voice") => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  modelFilter: string;
  onModelFilterChange: (m: string) => void;
  campaignFilter: string;
  onCampaignFilterChange: (c: string) => void;
  accountFilter: string;
  onAccountFilterChange: (a: string) => void;
  availableModels: string[];
  availableCampaigns: { id: number; name: string }[];
  availableAccounts: { id: number; name: string }[];
  totalCount: number;
  onOpenCreate: () => void;
  isFilterActive: boolean;
  activeFilterCount: number;
  onClearAllFilters: () => void;
  sortBy: PromptSortOption;
  onSortByChange: (s: PromptSortOption) => void;
  groupBy: PromptGroupOption;
  onGroupByChange: (g: PromptGroupOption) => void;
  groupDirection: "asc" | "desc";
  onGroupDirectionChange: (d: "asc" | "desc") => void;
  visibleCols: Set<PromptColKey>;
  onVisibleColsChange: React.Dispatch<React.SetStateAction<Set<PromptColKey>>>;
  showTableControls: boolean;
}

const STATUS_OPTIONS = ["all", "active", "archived"] as const;
const SORT_OPTIONS: PromptSortOption[] = ["recent", "name_asc", "name_desc", "score_desc", "score_asc"];
const GROUP_OPTIONS: PromptGroupOption[] = ["status", "model", "campaign", "account", "none"];

export function PromptsToolbar({
  searchQuery,
  onSearchQueryChange,
  searchOpen,
  onSearchOpenChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  modelFilter,
  onModelFilterChange,
  campaignFilter,
  onCampaignFilterChange,
  accountFilter,
  onAccountFilterChange,
  availableModels,
  availableCampaigns,
  availableAccounts,
  totalCount,
  onOpenCreate,
  isFilterActive,
  activeFilterCount,
  onClearAllFilters,
  sortBy,
  onSortByChange,
  groupBy,
  onGroupByChange,
  groupDirection,
  onGroupDirectionChange,
  visibleCols,
  onVisibleColsChange,
  showTableControls,
}: PromptsToolbarProps) {
  const { t } = useTranslation("prompts");

  return (
    <>
      {/* ── 1. Search ───────────────────────────────────────────────────── */}
      <ExpandingSearch value={searchQuery} onChange={onSearchQueryChange} placeholder={t("toolbar.searchPlaceholder")} />

      {/* ── 3. Filter dropdown (status + model + campaign) ───────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={t("toolbar.filter")} active={isFilterActive}>
            <Filter className="h-4 w-4 shrink-0" />
          </TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
          {/* Type section: voice-agent prompts (use_case voice_*) vs everything else */}
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("labels.type")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(["all", "voice"] as const).map((opt) => (
            <DropdownMenuItem key={opt} className="text-[12px] flex items-center justify-between" onClick={(e) => { e.preventDefault(); onTypeFilterChange(opt); }}>
              {opt === "all" ? t("toolbar.allTypes") : t("toolbar.voiceAgents")}
              {typeFilter === opt && <Check className="h-3 w-3 text-brand-indigo" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* Status section */}
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("labels.status")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt}
              className="text-[12px] flex items-center justify-between"
              onClick={(e) => { e.preventDefault(); onStatusFilterChange(opt); }}
            >
              {t(STATUS_TKEYS[opt])}
              {statusFilter === opt && <Check className="h-3 w-3 text-brand-indigo" />}
            </DropdownMenuItem>
          ))}

          {/* Model section */}
          {availableModels.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("labels.model")}
              </DropdownMenuLabel>
              <DropdownMenuItem
                className={cn("text-[12px]", modelFilter === "all" && "font-semibold text-brand-indigo")}
                onClick={(e) => { e.preventDefault(); onModelFilterChange("all"); }}
              >
                {t("toolbar.allModels")}
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
                {t("labels.campaign")}
              </DropdownMenuLabel>
              <DropdownMenuItem
                className={cn("text-[12px]", !campaignFilter && "font-semibold text-brand-indigo")}
                onClick={(e) => { e.preventDefault(); onCampaignFilterChange(""); }}
              >
                {t("toolbar.allCampaigns")}
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

          {/* Account section */}
          {availableAccounts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("labels.account")}
              </DropdownMenuLabel>
              <DropdownMenuItem
                className={cn("text-[12px]", !accountFilter && "font-semibold text-brand-indigo")}
                onClick={(e) => { e.preventDefault(); onAccountFilterChange(""); }}
              >
                {t("toolbar.allAccounts")}
                {!accountFilter && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableAccounts.map((a) => (
                <DropdownMenuItem
                  key={a.id}
                  className={cn("text-[12px]", accountFilter === String(a.id) && "font-semibold text-brand-indigo")}
                  onClick={(e) => { e.preventDefault(); onAccountFilterChange(accountFilter === String(a.id) ? "" : String(a.id)); }}
                >
                  <span className="truncate flex-1">{a.name}</span>
                  {accountFilter === String(a.id) && <Check className="h-3 w-3 ml-1 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {/* Clear all */}
          {isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClearAllFilters} className="text-[12px] text-destructive">
                {t("toolbar.clearAllFilters")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 4. Sort dropdown ─────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={t("toolbar.sort")} active={sortBy !== "recent"}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
          </TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("toolbar.sortBy")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* recent — flat row, no paired direction */}
          {(() => {
            const isActive = sortBy === "recent";
            return (
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); onSortByChange("recent"); }}
                className="text-[12px] flex items-center gap-2"
              >
                <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>
                  {t(SORT_TKEYS["recent"])}
                </span>
              </DropdownMenuItem>
            );
          })()}
          {/* name — grouped asc/desc row */}
          {(() => {
            const isActive = sortBy === "name_asc" || sortBy === "name_desc";
            const activeDir: "asc" | "desc" = sortBy === "name_asc" ? "asc" : "desc";
            return (
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); if (!isActive) onSortByChange("name_desc"); }}
                className="text-[12px] flex items-center gap-2"
              >
                <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>
                  {t("columns.name")}
                </span>
                {isActive && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange("name_asc"); }}
                      className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                      title="Ascending"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange("name_desc"); }}
                      className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                      title="Descending"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </>
                )}
              </DropdownMenuItem>
            );
          })()}
          {/* score — grouped asc/desc row */}
          {(() => {
            const isActive = sortBy === "score_asc" || sortBy === "score_desc";
            const activeDir: "asc" | "desc" = sortBy === "score_asc" ? "asc" : "desc";
            return (
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); if (!isActive) onSortByChange("score_desc"); }}
                className="text-[12px] flex items-center gap-2"
              >
                <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>
                  {t("columns.score")}
                </span>
                {isActive && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange("score_asc"); }}
                      className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                      title="Ascending"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange("score_desc"); }}
                      className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                      title="Descending"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </>
                )}
              </DropdownMenuItem>
            );
          })()}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 5. Group dropdown (table view only) ──────────────────────────── */}
      {showTableControls && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TopbarIconButton label={t("toolbar.group")} active={groupBy !== "none"}>
              <Layers className="h-4 w-4 shrink-0" />
            </TopbarIconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {GROUP_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt}
                onSelect={(e) => { e.preventDefault(); onGroupByChange(opt); }}
                className="text-[12px] flex items-center gap-2"
              >
                <span className={cn("flex-1", groupBy === opt && "font-semibold !text-brand-indigo")}>
                  {t(GROUP_TKEYS[opt])}
                </span>
                {groupBy === opt && opt !== "none" && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onGroupDirectionChange("asc"); }}
                      className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                      title="Ascending"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onGroupDirectionChange("desc"); }}
                      className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                      title="Descending"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </>
                )}
                {groupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* ── 6. Fields dropdown (table view only) ─────────────────────────── */}
      {showTableControls && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TopbarIconButton label={t("toolbar.fields")} active={visibleCols.size !== DEFAULT_VISIBLE_PROMPT_COLS.length}>
              <Eye className="h-4 w-4 shrink-0" />
            </TopbarIconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 max-h-72 overflow-y-auto">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("toolbar.showHideColumns")}
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
                    isVisible ? "bg-brand-indigo border-brand-indigo" : "border-black/[0.125]",
                  )}>
                    {isVisible && <Check className="h-2 w-2 text-white" />}
                  </div>
                  <span className="flex-1">{col.tKey ? t(col.tKey) : col.label}</span>
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
              {t("toolbar.resetToDefault")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* ── 7. +Create (wine, last) ──────────────────────────────────────── */}
      <TopbarIconButton label={t("toolbar.create")} primary onClick={onOpenCreate} data-testid="button-create-prompt">
        <Plus className="h-4 w-4 shrink-0" />
      </TopbarIconButton>
    </>
  );
}
