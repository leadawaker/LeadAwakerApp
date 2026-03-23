/**
 * LeadsFiltersBar.tsx — desktop filter/sort/group toolbar for the leads list.
 * Extracted from LeadsCardView.tsx to reduce file size.
 *
 * Renders: +Add, Search, Group, Sort, Filter (status/account/campaign/tags), Tags display settings.
 * Used as the `toolbarPrefix` prop inside LeadDetailView when rendered from LeadsCardView.
 */
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Check, Layers, ArrowUpDown, Filter, Plus,
  Phone, Eye, EyeOff, Palette, Tag as TagIcon, X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchPill } from "@/components/ui/search-pill";
import { resolveColor } from "@/features/tags/types";
import { PIPELINE_HEX } from "./LeadsCardView";
import type { GroupByOption, SortByOption } from "./LeadsCardView";

export interface LeadsFiltersBarProps {
  // View state
  listSearch: string;
  groupBy: GroupByOption;
  sortBy: SortByOption;
  filterStatus: string[];
  filterTags: string[];
  filterAccount: string;
  filterCampaign: string;
  tagSearchInput: string;
  isFilterActive: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;

  // Display prefs
  showContactAlways: boolean;
  tagsColorful: boolean;
  hideTags: boolean;

  // Available options for dropdowns
  allTags: { name: string; color: string }[];
  availableAccounts: { id: string; name: string }[];
  availableCampaigns: { id: string; name: string }[];

  // Callbacks
  onCreateLead?: () => void;
  onSearchChange: (v: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (v: boolean) => void;
  onGroupByChange: (v: GroupByOption) => void;
  onSortByChange: (v: SortByOption) => void;
  onToggleFilterStatus: (s: string) => void;
  onToggleFilterTag: (t: string) => void;
  onSetFilterAccount: (v: string) => void;
  onSetFilterCampaign: (v: string) => void;
  onSetTagSearchInput: (v: string) => void;
  onSetShowContactAlways: (v: boolean) => void;
  onSetTagsColorful: (v: boolean) => void;
  onSetHideTags: (v: boolean) => void;
  onMobileBack?: () => void;
}

const STATUS_GROUP_ORDER = ["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"];

const SORT_OPTIONS: SortByOption[] = ["recent", "name_asc", "name_desc", "score_desc", "score_asc"];
const GROUP_OPTIONS: GroupByOption[] = ["date", "status", "campaign", "tag", "none"];

/**
 * LeadsFiltersBar — renders the desktop filter/sort/group toolbar.
 * Intended for use as the `toolbarPrefix` render-prop in LeadDetailView.
 */
export function LeadsFiltersBar({
  listSearch,
  groupBy,
  sortBy,
  filterStatus,
  filterTags,
  filterAccount,
  filterCampaign,
  tagSearchInput,
  isFilterActive,
  isGroupNonDefault,
  isSortNonDefault,
  showContactAlways,
  tagsColorful,
  hideTags,
  allTags,
  availableAccounts,
  availableCampaigns,
  onCreateLead,
  onSearchChange,
  searchOpen,
  onSearchOpenChange,
  onGroupByChange,
  onSortByChange,
  onToggleFilterStatus,
  onToggleFilterTag,
  onSetFilterAccount,
  onSetFilterCampaign,
  onSetTagSearchInput,
  onSetShowContactAlways,
  onSetTagsColorful,
  onSetHideTags,
  onMobileBack,
}: LeadsFiltersBarProps) {
  const { t } = useTranslation("leads");

  const xBtn = (active: boolean, maxW: string) => cn(
    "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0",
    "transition-[max-width,color,border-color] duration-200 max-w-9", maxW,
    active ? "border-brand-indigo text-brand-indigo" : "border-black/[0.125] text-foreground/60 hover:text-foreground"
  );
  const xSpan = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  const groupLabels: Record<GroupByOption, string> = {
    date:     t("sort.mostRecent"),
    status:   t("group.status"),
    campaign: t("group.campaign"),
    tag:      t("detail.sections.tags"),
    none:     t("group.none"),
  };
  const sortLabels: Record<SortByOption, string> = {
    recent:     t("sort.mostRecent"),
    name_asc:   t("sort.nameAZ"),
    name_desc:  t("sort.nameZA"),
    score_desc: t("sort.scoreDown"),
    score_asc:  t("sort.scoreUp"),
  };

  return (
    <>
      {/* Back to list — mobile only */}
      {onMobileBack && (
        <button
          onClick={onMobileBack}
          className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0"
        >
          <span className="sr-only">Back</span>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      )}

      {/* +Add */}
      <button onClick={onCreateLead} className={xBtn(false, "hover:max-w-[90px]")} title={t("detailView.newLead")}>
        <Plus className="h-4 w-4 shrink-0" />
        <span className={xSpan}>{t("toolbar.add")}</span>
      </button>

      {/* Search */}
      <SearchPill
        value={listSearch}
        onChange={onSearchChange}
        open={searchOpen}
        onOpenChange={onSearchOpenChange}
        placeholder={t("toolbar.searchPlaceholder")}
      />

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={xBtn(isGroupNonDefault, "hover:max-w-[115px]")} title={t("toolbar.group")}>
            <Layers className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.group")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {GROUP_OPTIONS.map((value) => (
            <DropdownMenuItem key={value} onClick={() => onGroupByChange(value)} className={cn("text-[12px]", groupBy === value && "font-semibold text-brand-indigo")}>
              {groupLabels[value]}
              {groupBy === value && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={xBtn(isSortNonDefault, "hover:max-w-[100px]")} title={t("toolbar.sort")}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {SORT_OPTIONS.map((value) => (
            <DropdownMenuItem key={value} onClick={() => onSortByChange(value)} className={cn("text-[12px]", sortBy === value && "font-semibold text-brand-indigo")}>
              {sortLabels[value]}
              {sortBy === value && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={xBtn(isFilterActive, "hover:max-w-[110px]")} title={t("toolbar.filter")}>
            <Filter className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.filter")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {/* Status submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
              <span className="flex-1">{t("group.status")}</span>
              {filterStatus.length > 0 && (
                <span className="text-[10px] tabular-nums text-brand-indigo font-semibold">{filterStatus.length}</span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              {STATUS_GROUP_ORDER.map((s) => (
                <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                  <span className="flex-1">{t("kanban.stageLabels." + s.replace(/ /g, ""))}</span>
                  {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Account submenu */}
          {availableAccounts.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                <span className="flex-1">{t("detail.fields.account")}</span>
                {filterAccount && <span className="text-[10px] text-brand-indigo font-semibold">1</span>}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuItem
                  onClick={(e) => { e.preventDefault(); onSetFilterAccount(""); onSetFilterCampaign(""); }}
                  className={cn("text-[12px]", !filterAccount && "font-semibold text-brand-indigo")}
                >
                  {t("filters.allAccounts")}
                  {!filterAccount && <Check className="h-3 w-3 ml-auto text-brand-indigo" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {availableAccounts.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    onClick={(e) => { e.preventDefault(); if (filterAccount === a.id) { onSetFilterAccount(""); } else { onSetFilterAccount(a.id); onSetFilterCampaign(""); } }}
                    className={cn("text-[12px]", filterAccount === a.id && "font-semibold text-brand-indigo")}
                  >
                    <span className="flex-1 truncate">{a.name}</span>
                    {filterAccount === a.id && <Check className="h-3 w-3 ml-auto text-brand-indigo shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Campaign submenu */}
          {availableCampaigns.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                <span className="flex-1">{t("detailView.campaign")}</span>
                {filterCampaign && <span className="text-[10px] text-brand-indigo font-semibold">1</span>}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto">
                <DropdownMenuItem
                  onClick={(e) => { e.preventDefault(); onSetFilterCampaign(""); }}
                  className={cn("text-[12px]", !filterCampaign && "font-semibold text-brand-indigo")}
                >
                  {t("filters.allCampaigns")}
                  {!filterCampaign && <Check className="h-3 w-3 ml-auto text-brand-indigo" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {availableCampaigns.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={(e) => { e.preventDefault(); onSetFilterCampaign(filterCampaign === c.id ? "" : c.id); }}
                    className={cn("text-[12px]", filterCampaign === c.id && "font-semibold text-brand-indigo")}
                  >
                    <span className="flex-1 truncate">{c.name}</span>
                    {filterCampaign === c.id && <Check className="h-3 w-3 ml-auto text-brand-indigo shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Tags search */}
          <DropdownMenuSeparator />
          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("toolbar.tags")}</div>
          <div className="px-2 pb-1.5" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={tagSearchInput}
              onChange={(e) => onSetTagSearchInput(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && tagSearchInput.trim()) {
                  const match = allTags.find((tg) => tg.name.toLowerCase() === tagSearchInput.trim().toLowerCase());
                  if (match) { onToggleFilterTag(match.name); onSetTagSearchInput(""); }
                }
              }}
              placeholder={t("detailView.searchTagName")}
              className="w-full h-7 px-2 rounded-md border border-black/[0.1] bg-muted/30 text-[11px] placeholder:text-muted-foreground/50 outline-none focus:border-brand-indigo/40"
            />
          </div>
          {(() => {
            const q = tagSearchInput.trim().toLowerCase();
            const filtered = q ? allTags.filter((tg) => tg.name.toLowerCase().includes(q)) : [];
            const shown = filterTags.length > 0 && !q
              ? allTags.filter((tg) => filterTags.includes(tg.name))
              : filtered.slice(0, 8);
            return shown.map((tg) => (
              <DropdownMenuItem key={tg.name} onClick={(e) => { e.preventDefault(); onToggleFilterTag(tg.name); }} className="flex items-center gap-2 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: resolveColor(tg.color) }} />
                <span className="flex-1 truncate">{tg.name}</span>
                {filterTags.includes(tg.name) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ));
          })()}

          {/* Clear all */}
          {isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                filterStatus.forEach((s) => onToggleFilterStatus(s));
                filterTags.forEach((tg) => onToggleFilterTag(tg));
                onSetFilterAccount("");
                onSetFilterCampaign("");
                onSetTagSearchInput("");
              }} className="text-[12px] text-destructive">
                <X className="h-3 w-3 mr-1.5 shrink-0" />
                Clear all filters
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tags display settings */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={xBtn(tagsColorful || hideTags || showContactAlways, "hover:max-w-[100px]")} title={t("toolbar.tags")}>
            <TagIcon className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.tags")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onSetTagsColorful(!tagsColorful)} className="flex items-center gap-2 text-[12px]">
            <Palette className="h-3.5 w-3.5 mr-0.5 shrink-0" /><span className="flex-1">Tag Color</span>
            {tagsColorful && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSetHideTags(!hideTags)} className="flex items-center gap-2 text-[12px]">
            {hideTags
              ? <EyeOff className="h-3.5 w-3.5 mr-0.5 shrink-0" />
              : <Eye className="h-3.5 w-3.5 mr-0.5 shrink-0" />
            }
            <span className="flex-1">Hide Tags</span>
            {hideTags && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onSetShowContactAlways(!showContactAlways)} className="flex items-center gap-2 text-[12px]">
            <Phone className="h-3.5 w-3.5 mr-0.5 shrink-0" /><span className="flex-1">Show Phone &amp; Email</span>
            {showContactAlways && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
    </>
  );
}
