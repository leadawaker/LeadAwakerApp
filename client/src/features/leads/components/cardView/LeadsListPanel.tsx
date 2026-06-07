// Left lead-list panel for the card view: compact avatar rail, mobile list
// chrome (header/tabs/search/filters), the paginated card list, and the mobile
// simplified kanban. Extracted from LeadsCardViewMain.tsx.
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  List,
  Plus,
  X,
  Calendar,
  Kanban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewTabBar } from "@/components/ui/view-tab-bar";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import { CompactLeadCard } from "./CompactLeadCard";
import { GroupHeader, ListSkeleton } from "./atoms";
import { LeadListCard } from "./LeadListCard";
import { MobileSimpleKanban } from "./MobileViews";
import { getLeadId } from "./leadUtils";
import type { ViewMode } from "./types";

type ViewTab = { id: string; label: string; icon: any };

export function LeadsListPanel({
  isHidden,
  isCompact,
  isNarrow,
  scrollContainerRef,
  loading,
  flatItems,
  selectedLead,
  onSelectLead,
  onMobileViewChange,
  handleCompactHover,
  handleCompactHoverEnd,
  isFilterActive,
  filterStatus,
  filterTags,
  filterAccount,
  filterCampaign,
  setFilterSheetOpen,
  mobileListMode,
  setMobileListMode,
  setMobileAddOpen,
  viewTabs,
  viewMode,
  onViewModeChange,
  listSearch,
  onListSearchChange,
  upcomingCallsOnly,
  setUpcomingCallsOnly,
  leads,
  leadTagsInfo,
  leadsPullDistance,
  leadsIsRefreshing,
  cardAnimKey,
  currentPage,
  setCurrentPage,
  pageSize,
  campaignsById,
  peekOn,
  handleOpenConversation,
  openQuickAction,
  toggleLeadSelection,
  selectedLeadIds,
}: {
  isHidden: boolean;
  isCompact: boolean;
  isNarrow: boolean;
  scrollContainerRef: RefObject<HTMLDivElement>;
  loading?: boolean;
  flatItems: any[];
  selectedLead: any;
  onSelectLead: (lead: any) => void;
  onMobileViewChange?: (v: "list" | "detail") => void;
  handleCompactHover: (lead: any, el: HTMLElement | null) => void;
  handleCompactHoverEnd: () => void;
  isFilterActive: boolean;
  filterStatus: string[];
  filterTags: string[];
  filterAccount: string;
  filterCampaign: string;
  setFilterSheetOpen: (v: boolean) => void;
  mobileListMode: "list" | "kanban";
  setMobileListMode: (v: "list" | "kanban") => void;
  setMobileAddOpen: (v: boolean) => void;
  viewTabs: ViewTab[];
  viewMode: string;
  onViewModeChange: (v: ViewMode) => void;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  upcomingCallsOnly: boolean;
  setUpcomingCallsOnly: (v: boolean) => void;
  leads: any[];
  leadTagsInfo: Map<any, any>;
  leadsPullDistance: number;
  leadsIsRefreshing: boolean;
  cardAnimKey: number;
  currentPage: number;
  setCurrentPage: (fn: (p: number) => number) => void;
  pageSize: number;
  campaignsById?: Map<number, any>;
  peekOn: boolean;
  handleOpenConversation: (leadId: number | string) => void;
  openQuickAction: (lead: any, type: "status" | "note" | "delete") => void;
  toggleLeadSelection: (id: number) => void;
  selectedLeadIds: Set<number>;
}) {
  const { t } = useTranslation("leads");
  const filterOn = isFilterActive || filterStatus.length > 0 || filterTags.length > 0;
  return (
    <div className={cn(
      "flex flex-col bg-panel-list-bg rounded-b-lg overflow-hidden shadow-[var(--card-glow)]",
      isHidden
        ? "hidden"
        : isCompact
          ? "w-[65px] shrink-0"
          : "w-full lg:w-[356px] lg:shrink-0"
    )}>

      {isCompact && (
        <>
          {/* Minimized rail: ONLY the vertical strip of stage-colored avatar
              tiles. All tools (tab-switch, search, filter/sort/group, +Add) now
              live in the always-visible top bar. */}
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto" style={{ overflowX: "hidden" }}>
            {loading ? (
              <ListSkeleton />
            ) : flatItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-2">
                <Users className="h-5 w-5 text-muted-foreground/40" />
              </div>
            ) : (
              <div className="flex flex-col items-center" style={{ gap: 9, padding: "12px 0 20px" }}>
                {flatItems.map((item, i) => {
                  if (item.kind === "header") return null;
                  const lid = getLeadId(item.lead);
                  const selectedId = selectedLead ? getLeadId(selectedLead) : null;
                  return (
                    <div key={lid} data-lead-id={lid} className="shrink-0">
                      <CompactLeadCard
                        lead={item.lead}
                        isActive={selectedId === lid}
                        onClick={() => { onSelectLead(item.lead); onMobileViewChange?.("detail"); }}
                        onHover={handleCompactHover}
                        onHoverEnd={handleCompactHoverEnd}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {!isCompact && <>

      {/* ── Mobile list chrome (isNarrow only) — desktop uses the full-width top bar ── */}
      {isNarrow && (
        <>
          {/* Panel header: title + view tabs + action buttons + search */}
          <div className="pl-[17px] pr-[17px] pt-3 pb-1 shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
              {/* Mobile action buttons: filter + kanban toggle + add (Feature #42 + #39 + #45) */}
              <div className="flex items-center gap-1.5">
                {/* Filter button (Feature #42) */}
                <button
                  className="relative flex items-center justify-center h-8 w-8 transition-colors shrink-0"
                  style={{
                    borderRadius: 'var(--r-button)',
                    border: `1px solid ${filterOn ? 'var(--wine)' : 'var(--line)'}`,
                    background: filterOn ? 'var(--wine-tint)' : 'transparent',
                    color: filterOn ? 'var(--wine)' : 'var(--mute)',
                  }}
                  onClick={() => setFilterSheetOpen(true)}
                  title={t("toolbar.filterLeads")}
                  data-testid="mobile-leads-filter-button"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {isFilterActive && (
                    <span
                      className="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center rounded-full text-[8px] font-bold"
                      style={{ background: 'var(--wine)', color: 'var(--paper)' }}
                    >
                      {filterStatus.length + filterTags.length + (filterAccount ? 1 : 0) + (filterCampaign ? 1 : 0)}
                    </span>
                  )}
                </button>
                {/* Kanban toggle (Feature #39) */}
                <button
                  className="flex items-center justify-center h-8 w-8 transition-colors shrink-0"
                  style={{
                    borderRadius: 'var(--r-button)',
                    border: `1px solid ${mobileListMode === "kanban" ? 'var(--wine)' : 'var(--line)'}`,
                    background: mobileListMode === "kanban" ? 'var(--wine-tint)' : 'transparent',
                    color: mobileListMode === "kanban" ? 'var(--wine)' : 'var(--mute)',
                  }}
                  onClick={() => setMobileListMode(mobileListMode === "kanban" ? "list" : "kanban")}
                  title={mobileListMode === "kanban" ? t("toolbar.switchToList") : t("toolbar.switchToKanban")}
                  data-testid="mobile-kanban-toggle"
                >
                  {mobileListMode === "kanban" ? <List className="h-3.5 w-3.5" /> : <Kanban className="h-3.5 w-3.5" />}
                </button>
                {/* Add Lead button (Feature #45) */}
                <button
                  className="flex items-center justify-center h-8 w-8 transition-colors shrink-0"
                  style={{
                    borderRadius: 'var(--r-button)',
                    border: '1px solid var(--line)',
                    background: 'transparent',
                    color: 'var(--mute)',
                  }}
                  onClick={() => setMobileAddOpen(true)}
                  title={t("toolbar.add", "Add Lead")}
                  data-testid="mobile-add-lead-button"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {/* View tabs below title */}
            <ViewTabBar tabs={viewTabs} activeId={viewMode} onTabChange={(id) => onViewModeChange(id as ViewMode)} variant="segment" />

            {/* Mobile search bar — Feature #43 */}
            <div className="px-1 pt-1 pb-0.5">
              <div
                className="flex items-center h-9 px-3 gap-2 transition-colors"
                style={{
                  borderRadius: 'var(--r-button)',
                  border: `1px solid ${listSearch ? 'var(--wine)' : 'var(--line)'}`,
                  background: listSearch ? 'var(--wine-tint)' : 'transparent',
                  color: listSearch ? 'var(--wine)' : 'var(--mute)',
                }}
                data-testid="mobile-leads-search"
              >
                <Search className="h-3.5 w-3.5 shrink-0" />
                <input
                  value={listSearch}
                  onChange={(e) => onListSearchChange(e.target.value)}
                  placeholder={t("toolbar.searchPlaceholder")}
                  className="flex-1 min-w-0 bg-transparent outline-none text-[13px]"
                  style={{ color: 'var(--ink)' }}
                  data-testid="mobile-leads-search-input"
                />
                {listSearch && (
                  <button
                    type="button"
                    onClick={() => onListSearchChange("")}
                    data-testid="mobile-leads-search-clear"
                    className="shrink-0"
                    style={{ color: 'var(--mute)' }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming calls filter chip — mobile only */}
          <div className="px-2 pb-1 flex gap-2">
            <button
              onClick={() => setUpcomingCallsOnly(!upcomingCallsOnly)}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold transition-colors"
              style={{
                borderRadius: 'var(--r-pill)',
                border: `1px solid ${upcomingCallsOnly ? 'var(--wine)' : 'var(--line)'}`,
                background: upcomingCallsOnly ? 'var(--wine-tint)' : 'transparent',
                color: upcomingCallsOnly ? 'var(--wine)' : 'var(--mute)',
              }}
              data-testid="upcoming-calls-filter-chip"
            >
              <Calendar className="h-3 w-3" />
              {t("toolbar.upcomingCalls")}
              {upcomingCallsOnly && <X className="h-3 w-3 ml-0.5" />}
            </button>
          </div>
        </>
      )}

      {/* Mobile simplified kanban view — shown when kanban mode active on mobile */}
      {mobileListMode === "kanban" && (
        <div className="flex-1 min-h-0 overflow-hidden lg:hidden">
          <MobileSimpleKanban
            leads={leads}
            leadTagsInfo={leadTagsInfo}
            onSelectLead={onSelectLead}
            onMobileViewChange={onMobileViewChange}
          />
        </div>
      )}
      {/* Lead list — card list (pagination inside scroll area, below last card) */}
      <div ref={scrollContainerRef} className={cn("la-list-area", mobileListMode === "kanban" && "hidden lg:flex lg:flex-col")}>
        {/* Pull-to-refresh indicator — mobile only */}
        <PullToRefreshIndicator pullDistance={leadsPullDistance} isRefreshing={leadsIsRefreshing} />
        {loading ? (
          <ListSkeleton />
        ) : flatItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {listSearch || isFilterActive ? t("emptyState.noMatch") : t("emptyState.noLeads")}
            </p>
          </div>
        ) : (
          <>
            <div key={`anim-${cardAnimKey}-page-${currentPage}`} className="la-cards">
              {flatItems
                .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                .map((item, i) => {
                  const selectedId = selectedLead ? getLeadId(selectedLead) : null;
                  return item.kind === "header" ? (
                    <GroupHeader key={`h-${item.label}-${i}`} label={item.label} count={item.count} />
                  ) : (() => {
                    const lid = getLeadId(item.lead);
                    return (
                    <div key={lid} data-lead-id={lid} className={i < 15 ? "animate-card-enter" : undefined} style={i < 15 ? { animationDelay: `${Math.min(i, 15) * 30}ms` } : undefined}>
                      <LeadListCard
                        lead={item.lead}
                        isActive={selectedId === getLeadId(item.lead)}
                        onClick={() => { onSelectLead(item.lead); onMobileViewChange?.("detail"); }}
                        leadTags={item.tags}
                        campaignsById={campaignsById}
                        showPeek={peekOn}
                        onOpenConversation={() => handleOpenConversation(getLeadId(item.lead))}
                        onQuickChangeStatus={() => openQuickAction(item.lead, "status")}
                        onQuickAddNote={() => openQuickAction(item.lead, "note")}
                        onQuickDelete={() => openQuickAction(item.lead, "delete")}
                        selected={selectedLeadIds.has(getLeadId(item.lead))}
                        onToggleSelect={() => toggleLeadSelection(getLeadId(item.lead))}
                      />
                    </div>
                    );
                  })()
                })}

            </div>

            {/* Pagination — below last card, inside scroll area */}
            {flatItems.length > pageSize && (
              <div className="px-3 py-3 mt-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="icon-circle-lg icon-circle-base disabled:opacity-30 touch-target"
                  title={t("detailView.previousPage")}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] text-muted-foreground tabular-nums text-center leading-tight">
                  {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, flatItems.length)}
                  {" "}<span className="text-muted-foreground/50">{t("detailView.of")} {flatItems.length}</span>
                </span>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={(currentPage + 1) * pageSize >= flatItems.length}
                  className="icon-circle-lg icon-circle-base disabled:opacity-30 touch-target"
                  title={t("detailView.nextPage")}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      </>}

    </div>
  );
}
