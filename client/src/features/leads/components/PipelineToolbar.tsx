import { useState, useCallback } from "react";
import {
  Search,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  Columns3,
  Tag,
  Flame,
  Phone,
  Mail,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToolbarPill } from "@/components/ui/toolbar-pill";
import { IconBtn } from "@/components/ui/icon-btn";
import { cn } from "@/lib/utils";

export interface PipelineToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showHighScore: boolean;
  onShowHighScoreChange: (v: boolean) => void;
  filterHasPhone: boolean;
  onFilterHasPhoneChange: (v: boolean) => void;
  filterHasEmail: boolean;
  onFilterHasEmailChange: (v: boolean) => void;
  sortBy: "score-desc" | "recency" | "alpha" | null;
  onSortByChange: (v: "score-desc" | "recency" | "alpha" | null) => void;
  showTagsAlways: boolean;
  onShowTagsAlwaysChange: (v: boolean) => void;
  hasAnyCollapsed: boolean;
  onFoldAll: () => void;
  onExpandAll: () => void;
  onFoldThreshold: (threshold: number) => void;
  activeFilterCount: number;
}

const SORT_OPTIONS: { value: "score-desc" | "recency" | "alpha" | null; label: string }[] = [
  { value: null, label: "Default" },
  { value: "score-desc", label: "Score (High \u2192 Low)" },
  { value: "recency", label: "Recency (Newest first)" },
  { value: "alpha", label: "Alphabetical (A \u2192 Z)" },
];

export default function PipelineToolbar({
  searchQuery,
  onSearchChange,
  showHighScore,
  onShowHighScoreChange,
  filterHasPhone,
  onFilterHasPhoneChange,
  filterHasEmail,
  onFilterHasEmailChange,
  sortBy,
  onSortByChange,
  showTagsAlways,
  onShowTagsAlwaysChange,
  hasAnyCollapsed,
  onExpandAll,
  onFoldThreshold,
  activeFilterCount,
}: PipelineToolbarProps) {
  /* ── Local state ── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [foldPopoverOpen, setFoldPopoverOpen] = useState(false);
  const [foldThresholdInput, setFoldThresholdInput] = useState("0");

  const isFilterActive = activeFilterCount > 0;
  const isSortActive = sortBy !== null;

  const clearAllFilters = useCallback(() => {
    onShowHighScoreChange(false);
    onFilterHasPhoneChange(false);
    onFilterHasEmailChange(false);
  }, [onShowHighScoreChange, onFilterHasPhoneChange, onFilterHasEmailChange]);

  const applyFold = useCallback(() => {
    const threshold = parseInt(foldThresholdInput, 10);
    if (isNaN(threshold) || threshold < 0) return;
    onFoldThreshold(threshold);
    setFoldPopoverOpen(false);
  }, [foldThresholdInput, onFoldThreshold]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Separator from ViewTabBar */}
      <div className="w-px h-4 bg-border/25 mx-0.5 shrink-0" />

      {/* ── 1. Search (expandable) ── */}
      {searchOpen ? (
        <div className="flex items-center gap-1.5 h-10 rounded-full border border-border/30 bg-card/60 px-2.5 shrink-0">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search leads..."
            onBlur={() => {
              if (!searchQuery) setSearchOpen(false);
            }}
            className="text-[12px] bg-transparent outline-none w-28 min-w-0 text-foreground placeholder:text-muted-foreground/60"
          />
          <button
            type="button"
            onClick={() => {
              onSearchChange("");
              setSearchOpen(false);
            }}
          >
            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      ) : (
        <IconBtn
          onClick={() => setSearchOpen(true)}
          active={!!searchQuery}
          title="Search leads"
        >
          <Search className="h-4 w-4" />
        </IconBtn>
      )}

      {/* ── 2. Filter Dropdown ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "toolbar-pill-base",
              isFilterActive && "toolbar-pill-active",
            )}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            Filter
            {isFilterActive && (
              <span className="h-4 w-4 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center shrink-0 ml-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 rounded-2xl">
          <DropdownMenuItem
            onClick={() => onShowHighScoreChange(!showHighScore)}
            className="flex items-center gap-2 cursor-pointer rounded-xl"
          >
            <Flame
              className={cn(
                "h-4 w-4 shrink-0",
                showHighScore ? "text-[#FCB803]" : "text-muted-foreground",
              )}
            />
            <span className={cn("text-sm flex-1", showHighScore && "font-semibold")}>
              High Score (70+)
            </span>
            {showHighScore && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onFilterHasPhoneChange(!filterHasPhone)}
            className="flex items-center gap-2 cursor-pointer rounded-xl"
          >
            <Phone
              className={cn(
                "h-4 w-4 shrink-0",
                filterHasPhone ? "text-brand-indigo" : "text-muted-foreground",
              )}
            />
            <span className={cn("text-sm flex-1", filterHasPhone && "font-semibold")}>
              Has Phone
            </span>
            {filterHasPhone && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onFilterHasEmailChange(!filterHasEmail)}
            className="flex items-center gap-2 cursor-pointer rounded-xl"
          >
            <Mail
              className={cn(
                "h-4 w-4 shrink-0",
                filterHasEmail ? "text-brand-indigo" : "text-muted-foreground",
              )}
            />
            <span className={cn("text-sm flex-1", filterHasEmail && "font-semibold")}>
              Has Email
            </span>
            {filterHasEmail && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
          </DropdownMenuItem>

          {isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={clearAllFilters}
                className="flex items-center gap-2 cursor-pointer rounded-xl text-muted-foreground"
              >
                <X className="h-4 w-4 shrink-0" />
                <span className="text-sm">Clear all</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 3. Sort Dropdown ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={ArrowUpDown}
            label="Sort"
            active={isSortActive}
            activeValue={
              isSortActive
                ? SORT_OPTIONS.find((o) => o.value === sortBy)?.label.split(" ")[0]
                : undefined
            }
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 rounded-2xl">
          {SORT_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={String(opt.value)}
              onClick={() => onSortByChange(opt.value)}
              className="flex items-center gap-2 cursor-pointer rounded-xl"
            >
              <span
                className={cn("text-sm flex-1", sortBy === opt.value && "font-semibold")}
              >
                {opt.label}
              </span>
              {sortBy === opt.value && (
                <Check className="h-4 w-4 text-brand-indigo shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 4. Fold / Unfold ── */}
      {hasAnyCollapsed ? (
        <button
          onClick={onExpandAll}
          className="h-10 px-4 rounded-full flex items-center gap-2 text-sm font-medium bg-black text-[#FFE35B] border border-black hover:opacity-85 transition-opacity"
        >
          <Columns3 className="h-4 w-4 shrink-0" />
          <span>Unfold</span>
        </button>
      ) : (
        <Popover open={foldPopoverOpen} onOpenChange={setFoldPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "toolbar-pill-base",
                foldPopoverOpen && "toolbar-pill-active",
              )}
            >
              <Columns3 className="h-4 w-4 shrink-0" />
              Fold
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 rounded-2xl p-4">
            <p className="text-sm font-semibold mb-1">Fold columns</p>
            <p className="text-xs text-muted-foreground mb-3">
              Fold columns with this many leads or fewer.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={foldThresholdInput}
                onChange={(e) => setFoldThresholdInput(e.target.value)}
                min="0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFold();
                }}
                className="h-9 w-20 rounded-xl border border-border bg-background px-3 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
              />
              <span className="text-sm text-muted-foreground flex-1">leads</span>
              <button
                onClick={applyFold}
                className="h-9 px-4 rounded-xl bg-brand-indigo text-white text-sm font-semibold hover:bg-brand-indigo/90 transition-colors"
              >
                Apply
              </button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* ── 5. Tags Toggle ── */}
      <IconBtn
        onClick={() => onShowTagsAlwaysChange(!showTagsAlways)}
        active={showTagsAlways}
        title={
          showTagsAlways
            ? "Tags always visible \u2014 click to hover-only"
            : "Show tags on hover only \u2014 click to always show"
        }
      >
        <Tag className="h-4 w-4" />
      </IconBtn>
    </div>
  );
}
