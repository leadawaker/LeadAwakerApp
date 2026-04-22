// LeadsCardView main component extracted from LeadsCardView.tsx

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Users,
  BookUser,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  List,
  Table2,
  Plus,
  X,
  Calendar,
  Kanban,
  MoreVertical,
  Filter,
  ArrowUpDown,
  Layers,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  useCompactPanelState,
  useCompactHoverCard,
  CompactTabPopover,
  CompactHoverCardPortal,
} from "@/components/crm/CompactEntityRail";
import { CompactLeadCard } from "./CompactLeadCard";
import { useListPanelState } from "@/hooks/useListPanelState";
import { ListPanelToggleButton } from "@/components/crm/ListPanelToggleButton";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";
import { useLocation } from "wouter";
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { SkeletonLeadPanel } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeadsSelection } from "../useLeadsSelection";
import { useLeadsFilters } from "../useLeadsFilters";
import { LeadsFiltersBar } from "../LeadsFiltersBar";

import type { ViewMode, LeadsCardViewProps, LeadFilterSheetApplyState } from "./types";
import { PIPELINE_HEX, STATUS_COLORS, ALL_LEAD_FILTER_STAGES } from "./constants";
import { getLeadId, getFullName } from "./leadUtils";
import { GroupHeader, ListSkeleton } from "./atoms";
import { LeadDetailView } from "./LeadDetailView";
import {
  MobileLeadDetailPanel,
  MobileSimpleKanban,
  MobileAddLeadForm,
  LeadFilterBottomSheet,
} from "./MobileViews";
import { LeadListCard } from "./LeadListCard";

// ── Local component: empty detail placeholder ─────────────────────────────────
function EmptyDetailState({ leadsCount }: { leadsCount: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="relative">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 flex items-center justify-center ring-1 ring-amber-200/50 dark:ring-amber-800/30">
          <BookUser className="h-10 w-10 text-amber-400 dark:text-amber-500" />
        </div>
        <div className="absolute -top-2 -right-2 h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center shadow-md ring-2 ring-background">
          <span className="text-[10px] font-bold text-white">{leadsCount > 99 ? "99+" : leadsCount}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">Select a lead</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          Click any lead in the list to see their profile, score, and messages.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-amber-500 dark:text-amber-400 font-medium">
        <span>← Choose from the list</span>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function LeadsCardView({
  leads,
  loading,
  selectedLead,
  onSelectLead,
  onClose,
  leadTagsInfo,
  onRefresh,
  listSearch,
  groupBy,
  sortBy,
  filterStatus,
  filterTags,
  viewMode,
  onViewModeChange,
  searchOpen,
  onSearchOpenChange,
  onListSearchChange,
  onGroupByChange,
  onSortByChange,
  onToggleFilterStatus,
  onToggleFilterTag,
  allTags,
  hasNonDefaultControls,
  isGroupNonDefault,
  isSortNonDefault,
  onResetControls,
  onCreateLead,
  mobileView = "list",
  onMobileViewChange,
  accountsById,
  campaignsById,
}: LeadsCardViewProps) {
  const { t } = useTranslation("leads");
  const [, setLocation] = useLocation();
  const { isAgencyUser } = useWorkspace();
  const isNarrow = useIsMobile(1024);

  // Shared global list-panel state (Prospects/Leads/Campaigns/Chats all cycle together).
  const { ref: rightPanelRef, narrow: rightPanelNarrow } = useCompactPanelState(isNarrow);
  const { state: leftPanelState } = useListPanelState();
  const isCompact = !isNarrow && (leftPanelState === "compact" || (leftPanelState === "full" && rightPanelNarrow));
  const isHidden = !isNarrow && leftPanelState === "hidden";

  // ── Mobile kanban toggle (Feature #39): persisted preference ─────────────────
  const [mobileListMode, setMobileListMode] = usePersistedState<"list" | "kanban">(
    "mobile-leads-list-mode",
    "list",
    (v) => v === "list" || v === "kanban",
  );

  // ── Navigate to Conversations with this lead pre-selected (Feature #40) ──────
  const handleOpenConversation = useCallback((leadId: number | string) => {
    try {
      localStorage.setItem("selected-conversation-lead-id", String(leadId));
    } catch { /* ignore */ }
    const basePath = isAgencyUser ? "/agency" : "/subaccount";
    setLocation(`${basePath}/conversations`);
  }, [isAgencyUser, setLocation]);

  // ── Quick action tray state (Feature #41) ────────────────────────────────────
  const {
    quickActionLead,
    quickActionType,
    quickNoteText,
    quickStatusPending,
    quickActionBusy,
    setQuickNoteText,
    setQuickStatusPending,
    openQuickAction,
    closeQuickAction,
    handleQuickSaveStatus,
    handleQuickSaveNote,
    handleQuickConfirmDelete,
  } = useLeadsSelection({ onRefresh });

  const viewTabs: TabDef[] = [
    { id: "list",     label: t("viewTabs.list"),     icon: List   },
    { id: "table",    label: t("viewTabs.table"),    icon: Table2 },
    { id: "pipeline", label: t("viewTabs.pipeline"), icon: Kanban },
  ];


  const [currentPage, setCurrentPage]   = useState(0);
  const [cardAnimKey, setCardAnimKey] = useState(0);
  const PAGE_SIZE = 50;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Compact hover card state (shared hook).
  const findLeadEl = useCallback(
    (id: string | number) =>
      scrollContainerRef.current?.querySelector(`[data-lead-id="${id}"]`) as HTMLElement | null,
    [],
  );
  const {
    hovered: hoveredLead,
    rect: hoveredRect,
    onHover: handleCompactHover,
    onHoverEnd: handleCompactHoverEnd,
    cancelHoverEnd: cancelHoveredEnd,
    close: closeHoveredLead,
  } = useCompactHoverCard<Record<string, any>>((l) => getLeadId(l), findLeadEl);

  // ── Pull-to-refresh (mobile) ─────────────────────────────────────────────
  const { pullDistance: leadsPullDistance, isRefreshing: leadsIsRefreshing } = usePullToRefresh({
    containerRef: scrollContainerRef,
    onRefresh: async () => { onRefresh?.(); },
  });

  // Shared scroll helper — finds the card in the DOM and positions it just below its group header.
  const scrollToLead = useCallback((id: number, behavior: ScrollBehavior) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-lead-id="${id}"]`) as HTMLElement | null;
    if (!el) return;
    let headerHeight = 0;
    let sibling = el.previousElementSibling;
    while (sibling) {
      if (sibling.getAttribute("data-group-header") === "true") {
        headerHeight = (sibling as HTMLElement).offsetHeight;
        break;
      }
      sibling = sibling.previousElementSibling;
    }
    const cardTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: cardTop - headerHeight - 3, behavior });
  }, []);

  // Initial load: snap to the selected card instantly (no slide-down artifact).
  const initialScrollDoneRef = useRef(false);
  useEffect(() => {
    if (!selectedLead || initialScrollDoneRef.current) return;
    const id = getLeadId(selectedLead);
    // Use setTimeout so the card is in the DOM before we query it
    const t = window.setTimeout(() => {
      initialScrollDoneRef.current = true;
      scrollToLead(id, "instant");
    }, 0);
    return () => window.clearTimeout(t);
  }, [selectedLead, scrollToLead]);

  // On card click: smooth-scroll the newly selected card to the top.
  const prevSelectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!selectedLead) return;
    const id = getLeadId(selectedLead);
    if (prevSelectedIdRef.current === null) { prevSelectedIdRef.current = id; return; }
    if (prevSelectedIdRef.current === id) return;
    prevSelectedIdRef.current = id;
    const capturedId = id;
    window.setTimeout(() => scrollToLead(capturedId, "smooth"), 0);
  }, [selectedLead, scrollToLead]);

  const [showContactAlways, setShowContactAlways] = useState<boolean>(() => {
    try { return localStorage.getItem("list_contact_always_show") === "true"; } catch {} return false;
  });
  useEffect(() => {
    try { localStorage.setItem("list_contact_always_show", String(showContactAlways)); } catch {}
  }, [showContactAlways]);

  const [tagsColorful, setTagsColorful] = useState<boolean>(() => {
    try { return localStorage.getItem("list_tags_colorful") === "true"; } catch {} return false;
  });
  useEffect(() => {
    try { localStorage.setItem("list_tags_colorful", String(tagsColorful)); } catch {}
  }, [tagsColorful]);

  const [hideTags, setHideTags] = useState<boolean>(() => {
    try { return localStorage.getItem("list_tags_hidden") === "true"; } catch {} return false;
  });
  useEffect(() => {
    try { localStorage.setItem("list_tags_hidden", String(hideTags)); } catch {}
  }, [hideTags]);

  // ── Local filter state: account, campaign, tags, upcoming calls, flatItems ──
  const {
    filterAccount,
    filterCampaign,
    tagSearchInput,
    upcomingCallsOnly,
    setFilterAccount,
    setFilterCampaign,
    setTagSearchInput,
    setUpcomingCallsOnly,
    flatItems,
    availableAccounts,
    availableCampaigns,
    isFilterActive,
    handleFilterReset,
  } = useLeadsFilters({
    leads,
    listSearch,
    groupBy,
    sortBy,
    filterStatus,
    filterTags,
    leadTagsInfo,
    campaignsById,
    accountsById,
    onSortByChange,
    onToggleFilterStatus,
    onToggleFilterTag,
  });

  // ── Mobile filter bottom sheet state (Feature #42) ───────────────────────
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);

  const handleFilterApply = useCallback((state: LeadFilterSheetApplyState) => {
    if (state.sortBy !== sortBy) onSortByChange(state.sortBy);
    filterStatus.forEach((s) => { if (!state.filterStatus.includes(s)) onToggleFilterStatus(s); });
    state.filterStatus.forEach((s) => { if (!filterStatus.includes(s)) onToggleFilterStatus(s); });
    filterTags.forEach((tag) => { if (!state.filterTags.includes(tag)) onToggleFilterTag(tag); });
    state.filterTags.forEach((tag) => { if (!filterTags.includes(tag)) onToggleFilterTag(tag); });
    setFilterCampaign(state.filterCampaign);
    setFilterAccount(state.filterAccount);
  }, [sortBy, filterStatus, filterTags, onSortByChange, onToggleFilterStatus, onToggleFilterTag, setFilterCampaign, setFilterAccount]);

  // Reset to page 0 whenever the filtered/sorted list changes + bump anim key to re-trigger entrance
  useEffect(() => { setCurrentPage(0); setCardAnimKey((k) => k + 1); }, [flatItems]);

  // F shortcut: scroll selected lead into view, jumping to its page if paginated.
  useFKeyScrollToSelected({
    containerRef: scrollContainerRef,
    selectedId: selectedLead ? getLeadId(selectedLead) : null,
    getSelector: (id) => `[data-lead-id="${id}"]`,
    ensureLoaded: async (id) => {
      const items = flatItems.filter((i: any) => i.kind === "lead");
      const idx = items.findIndex((i: any) => getLeadId(i.lead) === id);
      if (idx >= 0) {
        const page = Math.floor(idx / PAGE_SIZE);
        if (page !== currentPage) setCurrentPage(page);
      }
    },
  });

  return (
    /* Outer shell: transparent — gaps between panels reveal stone-gray page background */
    <div className="relative flex h-full min-h-[600px] gap-[3px] max-w-[1729px] mx-auto w-full">

      {/* ── LEFT: Lead List ── muted panel (#E3E3E3) */}
      {/* On mobile: always visible (MobileLeadDetailPanel is a fixed overlay on top) */}
      <div className={cn(
        "flex flex-col bg-muted rounded-lg overflow-hidden",
        isHidden
          ? "hidden"
          : isCompact
            ? "w-[65px] shrink-0"
            : "w-full lg:w-[340px] lg:shrink-0"
      )}>

        {isCompact && (
          <>
            <CompactTabPopover
              tabs={viewTabs.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon }))}
              activeId={viewMode}
              onChange={(id) => onViewModeChange(id as ViewMode)}
            />
            <div className="flex flex-col items-center gap-1 px-1.5 pb-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
                      (isFilterActive || isSortNonDefault || isGroupNonDefault)
                        ? "bg-brand-indigo/10 text-brand-indigo"
                        : "text-foreground/50 hover:text-foreground hover:bg-black/[0.04]"
                    )}
                    title={t("toolbar.more", "More")}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-56 max-h-[500px] overflow-y-auto">
                  {/* Inline search */}
                  <div className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className={cn(
                      "flex items-center h-8 px-2.5 gap-1.5 rounded-full border",
                      listSearch ? "border-brand-indigo/40 bg-brand-indigo/5" : "border-black/[0.08] bg-muted/40"
                    )}>
                      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <input
                        value={listSearch}
                        onChange={(e) => onListSearchChange(e.target.value)}
                        placeholder={t("toolbar.searchPlaceholder")}
                        onKeyDown={(e) => { if (e.key === "Escape") onListSearchChange(""); }}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[12px] text-foreground placeholder:text-muted-foreground/60"
                      />
                      {listSearch && (
                        <button type="button" onClick={() => onListSearchChange("")} className="shrink-0 text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {/* Filter submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                      <Filter className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">{t("toolbar.filter")}</span>
                      {isFilterActive && (
                        <span className="h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                          {filterStatus.length + filterTags.length + (filterAccount ? 1 : 0) + (filterCampaign ? 1 : 0)}
                        </span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52 max-h-[400px] overflow-y-auto">
                      {/* Status */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                          <span className="flex-1">{t("group.status")}</span>
                          {filterStatus.length > 0 && (
                            <span className="text-[10px] tabular-nums text-brand-indigo font-semibold">{filterStatus.length}</span>
                          )}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                          {["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"].map((s) => (
                            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                              <span className="flex-1">{s}</span>
                              {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      {/* Account */}
                      {availableAccounts.length > 0 && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                            <span className="flex-1">{t("detail.fields.account")}</span>
                            {filterAccount && <span className="text-[10px] text-brand-indigo font-semibold">1</span>}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-48 max-h-64 overflow-y-auto">
                            <DropdownMenuItem
                              onClick={(e) => { e.preventDefault(); setFilterAccount(""); setFilterCampaign(""); }}
                              className={cn("text-[12px]", !filterAccount && "font-semibold text-brand-indigo")}
                            >
                              {t("filters.allAccounts")}
                              {!filterAccount && <Check className="h-3 w-3 ml-auto text-brand-indigo" />}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {availableAccounts.map((a) => (
                              <DropdownMenuItem
                                key={a.id}
                                onClick={(e) => { e.preventDefault(); if (filterAccount === a.id) { setFilterAccount(""); } else { setFilterAccount(a.id); setFilterCampaign(""); } }}
                                className={cn("text-[12px]", filterAccount === a.id && "font-semibold text-brand-indigo")}
                              >
                                <span className="flex-1 truncate">{a.name}</span>
                                {filterAccount === a.id && <Check className="h-3 w-3 ml-auto text-brand-indigo shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
                      {/* Campaign */}
                      {availableCampaigns.length > 0 && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                            <span className="flex-1">{t("detailView.campaign")}</span>
                            {filterCampaign && <span className="text-[10px] text-brand-indigo font-semibold">1</span>}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-52 max-h-64 overflow-y-auto">
                            <DropdownMenuItem
                              onClick={(e) => { e.preventDefault(); setFilterCampaign(""); }}
                              className={cn("text-[12px]", !filterCampaign && "font-semibold text-brand-indigo")}
                            >
                              {t("filters.allCampaigns")}
                              {!filterCampaign && <Check className="h-3 w-3 ml-auto text-brand-indigo" />}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {availableCampaigns.map((c) => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={(e) => { e.preventDefault(); if (filterCampaign === c.id) { setFilterCampaign(""); } else { setFilterCampaign(c.id); } }}
                                className={cn("text-[12px]", filterCampaign === c.id && "font-semibold text-brand-indigo")}
                              >
                                <span className="flex-1 truncate">{c.name}</span>
                                {filterCampaign === c.id && <Check className="h-3 w-3 ml-auto text-brand-indigo shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
                      {/* Tags */}
                      {allTags.length > 0 && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                            <span className="flex-1">{t("detail.sections.tags")}</span>
                            {filterTags.length > 0 && (
                              <span className="text-[10px] tabular-nums text-brand-indigo font-semibold">{filterTags.length}</span>
                            )}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-48 max-h-64 overflow-y-auto">
                            {allTags.map((tag) => (
                              <DropdownMenuItem key={tag.name} onClick={(e) => { e.preventDefault(); onToggleFilterTag(tag.name); }} className="flex items-center gap-2 text-[12px]">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                <span className="flex-1 truncate">{tag.name}</span>
                                {filterTags.includes(tag.name) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
                      {isFilterActive && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { onResetControls(); setFilterAccount(""); setFilterCampaign(""); }} className="text-[12px] text-muted-foreground">
                            {t("toolbar.clearAllFilters", "Clear filters")}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* Sort submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                      <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                      <span className={cn("flex-1", isSortNonDefault && "text-brand-indigo font-semibold")}>{t("toolbar.sort")}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {(["recent", "name_asc", "name_desc", "score_desc", "score_asc"] as const).map((value) => {
                        const label = {
                          recent:     t("sort.mostRecent"),
                          name_asc:   t("sort.nameAZ"),
                          name_desc:  t("sort.nameZA"),
                          score_desc: t("sort.scoreDown"),
                          score_asc:  t("sort.scoreUp"),
                        }[value];
                        return (
                          <DropdownMenuItem key={value} onClick={() => onSortByChange(value)} className={cn("text-[12px]", sortBy === value && "font-semibold text-brand-indigo")}>
                            {label}
                            {sortBy === value && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* Group submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                      <Layers className="h-3.5 w-3.5 shrink-0" />
                      <span className={cn("flex-1", isGroupNonDefault && "text-brand-indigo font-semibold")}>{t("toolbar.group")}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {(["date", "status", "campaign", "tag", "none"] as const).map((value) => {
                        const label = {
                          date:     t("sort.mostRecent"),
                          status:   t("group.status"),
                          campaign: t("group.campaign"),
                          tag:      t("detail.sections.tags"),
                          none:     t("group.none"),
                        }[value];
                        return (
                          <DropdownMenuItem key={value} onClick={() => onGroupByChange(value)} className={cn("text-[12px]", groupBy === value && "font-semibold text-brand-indigo")}>
                            {label}
                            {groupBy === value && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />

                  {/* +Add */}
                  {onCreateLead && (
                    <DropdownMenuItem onClick={onCreateLead} className="flex items-center gap-2 text-[12px]">
                      <Plus className="h-3.5 w-3.5 shrink-0" />
                      <span>{t("toolbar.add", "Add Lead")}</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-[3px]">
              {loading ? (
                <ListSkeleton />
              ) : flatItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-2">
                  <Users className="h-5 w-5 text-muted-foreground/40" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0">
                  {flatItems.map((item, i) => {
                    if (item.kind === "header") return null;
                    const lid = getLeadId(item.lead);
                    const selectedId = selectedLead ? getLeadId(selectedLead) : null;
                    return (
                      <div key={lid} data-lead-id={lid}>
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

        {/* ── Panel header: title + ViewTabBar ── */}
        <div className="pl-[17px] pr-[17px] pt-3 lg:pt-10 pb-1 lg:pb-3 shrink-0 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-0">
          <div className="flex items-center justify-between w-full lg:w-[306px] lg:shrink-0">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
            <span className="hidden lg:block">
              <ViewTabBar tabs={viewTabs} activeId={viewMode} onTabChange={(id) => onViewModeChange(id as ViewMode)} variant="segment" />
            </span>
            {/* Mobile action buttons: filter + kanban toggle (Feature #42 + #39) */}
            <div className="lg:hidden flex items-center gap-1.5">
              {/* Filter button (Feature #42) */}
              <button
                className={cn(
                  "relative flex items-center justify-center h-8 w-8 rounded-lg border transition-colors shrink-0",
                  (isFilterActive || filterStatus.length > 0 || filterTags.length > 0)
                    ? "border-brand-indigo bg-brand-indigo/10 text-brand-indigo"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setFilterSheetOpen(true)}
                title="Filter leads"
                data-testid="mobile-leads-filter-button"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {isFilterActive && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 flex items-center justify-center rounded-full bg-brand-indigo text-white text-[8px] font-bold">
                    {filterStatus.length + filterTags.length + (filterAccount ? 1 : 0) + (filterCampaign ? 1 : 0)}
                  </span>
                )}
              </button>
              {/* Kanban toggle (Feature #39) */}
              <button
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-lg border transition-colors shrink-0",
                  mobileListMode === "kanban"
                    ? "border-brand-indigo bg-brand-indigo/10 text-brand-indigo"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setMobileListMode(mobileListMode === "kanban" ? "list" : "kanban")}
                title={mobileListMode === "kanban" ? "Switch to list view" : "Switch to kanban view"}
                data-testid="mobile-kanban-toggle"
              >
                {mobileListMode === "kanban" ? <List className="h-3.5 w-3.5" /> : <Kanban className="h-3.5 w-3.5" />}
              </button>
              {/* Add Lead button (Feature #45) */}
              <button
                className="flex items-center justify-center h-8 w-8 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                onClick={() => setMobileAddOpen(true)}
                title={t("toolbar.add", "Add Lead")}
                data-testid="mobile-add-lead-button"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {/* ViewTabBar below title on mobile */}
          <div className="lg:hidden">
            <ViewTabBar tabs={viewTabs} activeId={viewMode} onTabChange={(id) => onViewModeChange(id as ViewMode)} variant="segment" />
          </div>

          {/* Mobile search bar — Feature #43 */}
          <div className="lg:hidden px-1 pt-1 pb-0.5">
            <div
              className={cn(
                "flex items-center h-9 px-3 gap-2 rounded-lg border transition-colors",
                listSearch
                  ? "border-brand-indigo/40 text-brand-indigo bg-brand-indigo/5"
                  : "border-border/40 text-muted-foreground"
              )}
              data-testid="mobile-leads-search"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <input
                value={listSearch}
                onChange={(e) => onListSearchChange(e.target.value)}
                placeholder={t("toolbar.searchPlaceholder")}
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground/60"
                data-testid="mobile-leads-search-input"
              />
              {listSearch && (
                <button
                  type="button"
                  onClick={() => onListSearchChange("")}
                  data-testid="mobile-leads-search-clear"
                  className="shrink-0"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming calls filter chip — mobile only */}
        <div className="lg:hidden px-2 pb-1 flex gap-2">
          <button
            onClick={() => setUpcomingCallsOnly(!upcomingCallsOnly)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors",
              upcomingCallsOnly
                ? "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/40"
                : "bg-card text-muted-foreground border-border/40 hover:border-amber-400/30"
            )}
            data-testid="upcoming-calls-filter-chip"
          >
            <Calendar className="h-3 w-3" />
            Upcoming calls
            {upcomingCallsOnly && <X className="h-3 w-3 ml-0.5" />}
          </button>
        </div>

        {/* Mobile simplified kanban view (Feature #39) — shown when kanban mode active on mobile */}
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

        {/* ── Desktop toolbar: search + create + sort + filter + group ── */}
        <div className="hidden lg:flex pl-2 pr-[17px] pb-2 items-center gap-1 shrink-0">
          <LeadsFiltersBar
            listSearch={listSearch}
            groupBy={groupBy}
            sortBy={sortBy}
            filterStatus={filterStatus}
            filterTags={filterTags}
            filterAccount={filterAccount}
            filterCampaign={filterCampaign}
            tagSearchInput={tagSearchInput}
            isFilterActive={isFilterActive}
            isGroupNonDefault={isGroupNonDefault}
            isSortNonDefault={isSortNonDefault}
            allTags={allTags}
            availableAccounts={availableAccounts}
            availableCampaigns={availableCampaigns}
            onCreateLead={onCreateLead}
            onSearchChange={onListSearchChange}
            searchOpen={searchOpen}
            onSearchOpenChange={onSearchOpenChange}
            onGroupByChange={onGroupByChange}
            onSortByChange={onSortByChange}
            onToggleFilterStatus={onToggleFilterStatus}
            onToggleFilterTag={onToggleFilterTag}
            onSetFilterAccount={setFilterAccount}
            onSetFilterCampaign={setFilterCampaign}
            onSetTagSearchInput={setTagSearchInput}
          />
        </div>

        {/* Lead list — card list (pagination inside scroll area, below last card) */}
        <div ref={scrollContainerRef} className={cn("flex-1 overflow-y-auto px-[3px] pt-0 pb-[3px]", mobileListMode === "kanban" && "hidden lg:flex lg:flex-col")}>
          {/* Pull-to-refresh indicator — mobile only */}
          <PullToRefreshIndicator pullDistance={leadsPullDistance} isRefreshing={leadsIsRefreshing} />
          {loading ? (
            <ListSkeleton />
          ) : flatItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                {listSearch || isFilterActive ? "No leads match your filters" : "No leads found"}
              </p>
            </div>
          ) : (
            <>
              <div key={`anim-${cardAnimKey}-page-${currentPage}`} className="flex flex-col gap-[3px]">
                {flatItems
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
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
                          showContactAlways={showContactAlways}
                          tagsColorful={tagsColorful}
                          hideTags={hideTags}
                          campaignsById={campaignsById}
                          onOpenConversation={() => handleOpenConversation(getLeadId(item.lead))}
                          onQuickChangeStatus={() => openQuickAction(item.lead, "status")}
                          onQuickAddNote={() => openQuickAction(item.lead, "note")}
                          onQuickDelete={() => openQuickAction(item.lead, "delete")}
                        />
                      </div>
                      );
                    })()
                  })}

              </div>

              {/* Pagination — below last card, inside scroll area */}
              {flatItems.length > PAGE_SIZE && (
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
                    {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, flatItems.length)}
                    {" "}<span className="text-muted-foreground/50">{t("detailView.of")} {flatItems.length}</span>
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={(currentPage + 1) * PAGE_SIZE >= flatItems.length}
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

      {/* ── RIGHT: Detail panel ── */}
      {/* Mobile full-screen detail overlay — only shown on mobile when a lead is selected */}
      <AnimatePresence>
        {mobileView === "detail" && selectedLead && (
          <MobileLeadDetailPanel
            key={String(getLeadId(selectedLead))}
            lead={selectedLead}
            onBack={() => {
              const returnTo = localStorage.getItem("leadawaker-returnto");
              if (returnTo) {
                localStorage.removeItem("leadawaker-returnto");
                setLocation(returnTo);
              } else {
                onMobileViewChange?.("list");
              }
            }}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* Desktop detail panel — always hidden on mobile (mobile uses MobileLeadDetailPanel overlay) */}
      <div ref={rightPanelRef} className={cn(
        "relative flex-1 flex-col min-w-0 overflow-hidden bg-card rounded-lg hidden lg:flex max-w-[1386px]"
      )}>
        {/* List panel toggle — shared pill style, floating top-right */}
        {!isNarrow && (
          <div className="absolute top-3 right-3 z-20">
            <ListPanelToggleButton />
          </div>
        )}
        {loading && !selectedLead ? (
          <SkeletonLeadPanel />
        ) : selectedLead ? (
          <LeadDetailView
            lead={selectedLead}
            onClose={onClose}
            leadTags={leadTagsInfo.get(getLeadId(selectedLead)) || []}
            onRefresh={onRefresh}
            campaignsById={campaignsById}
          />
        ) : (
          <EmptyDetailState leadsCount={leads.length} />
        )}
      </div>

      {/* ── Quick action sheets (Feature #41) ──────────────────────────────── */}
      {createPortal(
        <AnimatePresence>
          {quickActionType && quickActionLead && (
            <>
              {/* Backdrop */}
              <motion.div
                key="quick-action-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[400] bg-black/50 md:hidden"
                onClick={closeQuickAction}
              />
              {/* Sheet */}
              <motion.div
                key="quick-action-sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "tween", duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
                className="fixed inset-x-0 bottom-0 z-[401] bg-background rounded-t-3xl border-t border-border/30 md:hidden"
                style={{ paddingBottom: "calc(1rem + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))" }}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-foreground/20" />
                </div>

                {/* ── Status Picker ── */}
                {quickActionType === "status" && (
                  <div className="px-5 pb-2">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[17px] font-semibold">Change Status</h2>
                      <button onClick={closeQuickAction} className="h-8 w-8 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-[50dvh] overflow-y-auto pb-2">
                      {ALL_LEAD_FILTER_STAGES.map((stage) => {
                        const colors = STATUS_COLORS[stage];
                        const active = quickStatusPending === stage;
                        return (
                          <button
                            key={stage}
                            className={cn(
                              "flex items-center justify-between px-4 py-3 rounded-2xl border text-[15px] min-h-[52px] transition-colors",
                              active
                                ? (colors?.badge ?? "bg-brand-indigo/10 text-brand-indigo border-brand-indigo/40")
                                : "border-border/40 text-foreground"
                            )}
                            onClick={() => setQuickStatusPending(stage)}
                          >
                            <span className="flex items-center gap-2.5">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[stage] || "#9ca3af" }} />
                              {stage}
                            </span>
                            {active && <Check className="h-5 w-5 text-brand-indigo shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-3 pt-3">
                      <button onClick={closeQuickAction} className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground">Cancel</button>
                      <button
                        onClick={handleQuickSaveStatus}
                        disabled={quickActionBusy}
                        className="flex-1 h-12 rounded-2xl bg-brand-indigo text-white text-[15px] font-semibold disabled:opacity-60"
                        data-testid="quick-status-save"
                      >
                        {quickActionBusy ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Add Note ── */}
                {quickActionType === "note" && (
                  <div className="px-5 pb-2">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[17px] font-semibold">Add Note</h2>
                      <button onClick={closeQuickAction} className="h-8 w-8 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
                    </div>
                    <textarea
                      autoFocus
                      value={quickNoteText}
                      onChange={(e) => setQuickNoteText(e.target.value)}
                      placeholder="Note about this lead…"
                      rows={4}
                      className="w-full px-4 py-3 rounded-2xl border border-border/40 bg-muted/30 text-[15px] placeholder:text-muted-foreground/50 outline-none focus:border-brand-indigo/50 resize-none"
                      data-testid="quick-note-input"
                    />
                    <div className="flex gap-3 pt-3">
                      <button onClick={closeQuickAction} className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground">Cancel</button>
                      <button
                        onClick={handleQuickSaveNote}
                        disabled={quickActionBusy || !quickNoteText.trim()}
                        className="flex-1 h-12 rounded-2xl bg-brand-indigo text-white text-[15px] font-semibold disabled:opacity-60"
                        data-testid="quick-note-save"
                      >
                        {quickActionBusy ? "Saving…" : "Save Note"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Delete Confirm ── */}
                {quickActionType === "delete" && (
                  <div className="px-5 pb-2">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[17px] font-semibold text-red-600">Delete Lead?</h2>
                      <button onClick={closeQuickAction} className="h-8 w-8 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
                    </div>
                    <p className="text-[14px] text-muted-foreground mb-5">
                      Are you sure you want to delete <strong>{getFullName(quickActionLead)}</strong>? This cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={closeQuickAction} className="flex-1 h-12 rounded-2xl border border-border/40 text-[15px] font-semibold text-muted-foreground">Cancel</button>
                      <button
                        onClick={handleQuickConfirmDelete}
                        disabled={quickActionBusy}
                        className="flex-1 h-12 rounded-2xl bg-red-500 text-white text-[15px] font-semibold disabled:opacity-60"
                        data-testid="quick-delete-confirm"
                      >
                        {quickActionBusy ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Lead filter bottom sheet (Feature #42) ─────────────────────────── */}
      <LeadFilterBottomSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filterStatus={filterStatus}
        filterTags={filterTags}
        sortBy={sortBy}
        filterCampaign={filterCampaign}
        filterAccount={filterAccount}
        allTags={allTags}
        availableCampaigns={availableCampaigns}
        availableAccounts={availableAccounts}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
      />

      {/* ── Mobile Add Lead Form (Feature #45) ───────────────────────────────── */}
      <MobileAddLeadForm
        open={mobileAddOpen}
        onClose={() => setMobileAddOpen(false)}
        campaignsById={campaignsById}
        onCreated={(newLead) => {
          onRefresh?.();
          if (newLead?.id || newLead?.Id) {
            onSelectLead(newLead);
            onMobileViewChange?.("detail");
          }
        }}
      />

      {/* ── Compact mode hover card overlay ───────────────────────────────── */}
      {isCompact && hoveredLead && (
        <CompactHoverCardPortal
          rect={hoveredRect}
          onMouseEnter={cancelHoveredEnd}
          onMouseLeave={handleCompactHoverEnd}
        >
          <LeadListCard
            lead={hoveredLead}
            isActive={selectedLead ? getLeadId(selectedLead) === getLeadId(hoveredLead) : false}
            onClick={() => { onSelectLead(hoveredLead); closeHoveredLead(); }}
            leadTags={leadTagsInfo.get(getLeadId(hoveredLead)) || []}
            showContactAlways={showContactAlways}
            tagsColorful={tagsColorful}
            hideTags={hideTags}
            campaignsById={campaignsById}
          />
        </CompactHoverCardPortal>
      )}
    </div>
  );
}
