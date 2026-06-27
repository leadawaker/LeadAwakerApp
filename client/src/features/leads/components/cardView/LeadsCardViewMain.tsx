// LeadsCardView main component extracted from LeadsCardView.tsx

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  List,
  Table2,
  Kanban,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useDeleteAction } from "@/hooks/useDeleteAction";
import {
  useCompactPanelState,
  useCompactHoverCard,
  CompactHoverCardPortal,
} from "@/components/crm/CompactEntityRail";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";
import { useLocation } from "wouter";
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { SkeletonLeadPanel } from "@/components/ui/skeleton";
import { MobileRecede } from "@/components/crm/mobile/MobileSheet";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeadsSelection } from "../useLeadsSelection";
import { useLeadsFilters } from "../useLeadsFilters";

import type { ViewMode, LeadsCardViewProps, LeadFilterSheetApplyState } from "./types";
import { getLeadId } from "./leadUtils";
import { LeadDetailView } from "./LeadDetailView";
import { LeadsQuickActionSheets } from "./LeadsQuickActionSheets";
import { LeadsDesktopToolbar } from "./LeadsDesktopToolbar";
import { LeadsListPanel } from "./LeadsListPanel";
import { EmptyDetailState } from "./EmptyDetailState";
import { useLeadsListControls } from "./useLeadsListControls";
import { exportLeadsCsv } from "./exportLeadsCsv";
import {
  MobileLeadDetailPanel,
  MobileAddLeadForm,
  LeadFilterBottomSheet,
} from "./MobileViews";
import { LeadListCard } from "./LeadListCard";

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
  allowedViews,
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
  const { label: deleteLabel } = useDeleteAction("lead");
  const [, setLocation] = useLocation();
  const { isAgencyUser } = useWorkspace();
  const isNarrow = useIsMobile(1024);

  // Shared global list-panel state (Prospects/Leads/Campaigns/Chats all cycle together).
  // Only auto-compact the list when the detail panel is genuinely cramped (not
  // on merely "rather wide" screens). Hysteresis keeps it from flickering.
  const { ref: rightPanelRef, narrow: rightPanelNarrow } = useCompactPanelState(isNarrow, { activateBelow: 680, deactivateAbove: 860 });
  const { state: leftPanelState, setState: setLeftPanelState } = useListPanelState();
  const isCompact = !isNarrow && (leftPanelState === "compact" || (leftPanelState === "full" && rightPanelNarrow));
  const isHidden = !isNarrow && leftPanelState === "hidden";

  // ── Mobile kanban toggle (Feature #39): persisted preference ─────────────────
  const [mobileListMode, setMobileListMode] = usePersistedState<"list" | "kanban">(
    "mobile-leads-list-mode",
    "list",
    (v) => v === "list" || v === "kanban",
  );

  // ── Open this lead's chat inline on the Leads page (Chats page retired) ──────
  const handleOpenConversation = useCallback((leadId: number | string) => {
    try {
      localStorage.setItem("selected-lead-id", String(leadId));
    } catch { /* ignore */ }
    const basePath = "/platform";
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

  const viewTabs: { id: string; label: string; icon: typeof List }[] = [
    { id: "list",     label: t("viewTabs.list"),     icon: List   },
    { id: "table",    label: t("viewTabs.table"),    icon: Table2 },
    { id: "pipeline", label: t("viewTabs.pipeline"), icon: Kanban },
  ].filter((tab) => !allowedViews || allowedViews.includes(tab.id as ViewMode));


  const [currentPage, setCurrentPage]   = useState(0);
  const [cardAnimKey, setCardAnimKey] = useState(0);

  const [toolbarCollapsed, setToolbarCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 1200);
  useEffect(() => {
    const onResize = () => setToolbarCollapsed(window.innerWidth < 1200);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const PAGE_SIZE = 50;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Keeps the mobile sheet showing the last lead's content while it animates closed.
  const lastSelectedLeadRef = useRef<typeof selectedLead>(null);
  if (selectedLead) lastSelectedLeadRef.current = selectedLead;

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

  // Selecting a card no longer moves the list, and the list always opens at
  // its natural scroll position (top) rather than snapping to whichever lead
  // was last selected (per Gabriel, 2026-06-21). Press F to bring the
  // selected lead to the top on demand (useFKeyScrollToSelected below).

  // ── List-view UI controls (display toggles, selection, bulk actions) ──────
  const {
    selectedLeadIds, toggleLeadSelection, clearLeadSelection,
    bulkBusy, handleListBulkStageChange, handleListBulkDelete, handleListBulkCampaignChange,
    peekOn, setPeekOn,
    bulkStageOpen, setBulkStageOpen,
    bulkCampaignOpen, setBulkCampaignOpen,
    bulkDeleteConfirm, setBulkDeleteConfirm,
  } = useLeadsListControls(onRefresh);

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

  // Reset to page 0 whenever the filtered/sorted list changes + bump anim key to re-trigger entrance.
  // Keyed on row composition/order (not flatItems identity) so a background leads
  // refetch (e.g. marking a conversation read on select) doesn't remount every
  // card and replay the entrance animation — that's what made cards "shrink" on click.
  const flatItemsSignature = useMemo(
    () => flatItems.map((it) => (it.kind === "lead" ? `l${getLeadId(it.lead)}` : `h${it.label}`)).join(","),
    [flatItems],
  );
  useEffect(() => { setCurrentPage(0); setCardAnimKey((k) => k + 1); }, [flatItemsSignature]);

  // ── Export all currently-filtered leads to CSV ──────────────────────────────
  const handleExportCsv = useCallback(() => {
    const rows = flatItems.filter((it: any) => it.kind === "lead").map((it: any) => it.lead);
    exportLeadsCsv(rows, campaignsById, accountsById);
  }, [flatItems, campaignsById, accountsById]);

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

  // ── Keyboard navigation between leads (↑/↓ or j/k) ──────────────────────────
  // Selecting via keyboard scrolls the new card into view (mouse-click does not).
  useEffect(() => {
    if (isNarrow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const down = e.key === "ArrowDown" || e.key === "j";
      const up = e.key === "ArrowUp" || e.key === "k";
      if (!down && !up) return;
      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (active as HTMLElement | null)?.isContentEditable) return;
      const rows = flatItems.filter((it: any) => it.kind === "lead").map((it: any) => it.lead);
      if (rows.length === 0) return;
      e.preventDefault();
      const curId = selectedLead ? getLeadId(selectedLead) : null;
      let idx = rows.findIndex((l: any) => getLeadId(l) === curId);
      if (idx === -1) idx = down ? -1 : 0;
      const nextIdx = Math.min(rows.length - 1, Math.max(0, idx + (down ? 1 : -1)));
      const next = rows[nextIdx];
      if (!next || getLeadId(next) === curId) return;
      const page = Math.floor(nextIdx / PAGE_SIZE);
      if (page !== currentPage) setCurrentPage(page);
      onSelectLead(next);
      const nid = getLeadId(next);
      window.setTimeout(() => {
        const el = scrollContainerRef.current?.querySelector(`[data-lead-id="${nid}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: "nearest" });
      }, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flatItems, selectedLead, onSelectLead, currentPage, isNarrow]);

  return (
    /* Outer shell: transparent — gaps between panels reveal stone-gray page background */
    <div className="relative flex flex-col h-full min-h-[600px] w-full">

      {/* ── Full-width flat top bar — all desktop formats (expanded + minimized) ── */}
      {!isNarrow && (
        <LeadsDesktopToolbar
          leadsCount={leads.length}
          viewTabs={viewTabs}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          selectedLeadIds={selectedLeadIds}
          bulkBusy={bulkBusy}
          bulkStageOpen={bulkStageOpen}
          setBulkStageOpen={setBulkStageOpen}
          handleListBulkStageChange={handleListBulkStageChange}
          bulkCampaignOpen={bulkCampaignOpen}
          setBulkCampaignOpen={setBulkCampaignOpen}
          handleListBulkCampaignChange={handleListBulkCampaignChange}
          onExport={handleExportCsv}
          bulkDeleteConfirm={bulkDeleteConfirm}
          setBulkDeleteConfirm={setBulkDeleteConfirm}
          handleListBulkDelete={handleListBulkDelete}
          clearLeadSelection={clearLeadSelection}
          deleteLabel={deleteLabel}
          peekOn={peekOn}
          setPeekOn={setPeekOn}
          isCompact={isCompact}
          setLeftPanelState={setLeftPanelState}
          listSearch={listSearch}
          onListSearchChange={onListSearchChange}
          toolbarCollapsed={toolbarCollapsed}
          isFilterActive={isFilterActive}
          isSortNonDefault={isSortNonDefault}
          isGroupNonDefault={isGroupNonDefault}
          filterStatus={filterStatus}
          onToggleFilterStatus={onToggleFilterStatus}
          filterTags={filterTags}
          onToggleFilterTag={onToggleFilterTag}
          availableAccounts={availableAccounts}
          filterAccount={filterAccount}
          setFilterAccount={setFilterAccount}
          availableCampaigns={availableCampaigns}
          filterCampaign={filterCampaign}
          setFilterCampaign={setFilterCampaign}
          allTags={allTags}
          sortBy={sortBy}
          onSortByChange={onSortByChange}
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
          onCreateLead={onCreateLead}
          showLeadActions={isAgencyUser && !!selectedLead}
        />
      )}

      {/* ── Content row: list panel + detail panel ── */}
      <div className="relative flex flex-1 min-h-0 w-full" style={{ gap: "var(--panel-gap)", paddingLeft: 0, paddingRight: isNarrow ? 0 : "var(--panel-gap)" }}>

      {/* ── LEFT: Lead List ── */}
      <MobileRecede open={isNarrow && mobileView === "detail" && !!selectedLead} fill={isNarrow}>
        <LeadsListPanel
          isHidden={isHidden}
          isCompact={isCompact}
          isNarrow={isNarrow}
          scrollContainerRef={scrollContainerRef}
          loading={loading}
          flatItems={flatItems}
          selectedLead={selectedLead}
          onSelectLead={onSelectLead}
          onMobileViewChange={onMobileViewChange}
          handleCompactHover={handleCompactHover}
          handleCompactHoverEnd={handleCompactHoverEnd}
          isFilterActive={isFilterActive}
          filterStatus={filterStatus}
          filterTags={filterTags}
          filterAccount={filterAccount}
          filterCampaign={filterCampaign}
          setFilterSheetOpen={setFilterSheetOpen}
          mobileListMode={mobileListMode}
          setMobileListMode={setMobileListMode}
          setMobileAddOpen={setMobileAddOpen}
          viewTabs={viewTabs}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          listSearch={listSearch}
          onListSearchChange={onListSearchChange}
          upcomingCallsOnly={upcomingCallsOnly}
          setUpcomingCallsOnly={setUpcomingCallsOnly}
          leads={leads}
          leadTagsInfo={leadTagsInfo}
          leadsPullDistance={leadsPullDistance}
          leadsIsRefreshing={leadsIsRefreshing}
          cardAnimKey={cardAnimKey}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={PAGE_SIZE}
          campaignsById={campaignsById}
          peekOn={peekOn}
          setPeekOn={setPeekOn}
          handleOpenConversation={handleOpenConversation}
          openQuickAction={openQuickAction}
          toggleLeadSelection={toggleLeadSelection}
          selectedLeadIds={selectedLeadIds}
          sortBy={sortBy}
          onSortByChange={onSortByChange}
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
          isSortNonDefault={isSortNonDefault}
          isGroupNonDefault={isGroupNonDefault}
          onToggleFilterStatus={onToggleFilterStatus}
          onToggleFilterTag={onToggleFilterTag}
          allTags={allTags}
          availableAccounts={availableAccounts}
          availableCampaigns={availableCampaigns}
          setFilterAccount={setFilterAccount}
          setFilterCampaign={setFilterCampaign}
          accountsById={accountsById}
          bulkBusy={bulkBusy}
          handleListBulkDelete={handleListBulkDelete}
        />
      </MobileRecede>

      {/* ── RIGHT: Detail panel ── */}
      {/* Mobile bottom-sheet detail — rises over the list, drag down to close */}
      <MobileLeadDetailPanel
        open={mobileView === "detail" && !!selectedLead}
        lead={selectedLead ?? lastSelectedLeadRef.current}
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

      {/* Desktop detail panel — always hidden on mobile (mobile uses MobileLeadDetailPanel overlay) */}
      <div ref={rightPanelRef} className={cn(
        "relative flex-1 flex-col min-w-0 rounded-lg hidden lg:flex"
      )}>
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

      </div>{/* ── end content row ── */}

      {/* ── Quick action sheets (Feature #41) ──────────────────────────────── */}
      <LeadsQuickActionSheets
        quickActionType={quickActionType}
        quickActionLead={quickActionLead}
        quickNoteText={quickNoteText}
        quickStatusPending={quickStatusPending}
        quickActionBusy={quickActionBusy}
        deleteLabel={deleteLabel}
        setQuickNoteText={setQuickNoteText}
        setQuickStatusPending={setQuickStatusPending}
        closeQuickAction={closeQuickAction}
        handleQuickSaveStatus={handleQuickSaveStatus}
        handleQuickSaveNote={handleQuickSaveNote}
        handleQuickConfirmDelete={handleQuickConfirmDelete}
      />

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
            campaignsById={campaignsById}
            selected={selectedLeadIds.has(getLeadId(hoveredLead))}
            onToggleSelect={() => toggleLeadSelection(getLeadId(hoveredLead))}
          />
        </CompactHoverCardPortal>
      )}
    </div>
  );
}
