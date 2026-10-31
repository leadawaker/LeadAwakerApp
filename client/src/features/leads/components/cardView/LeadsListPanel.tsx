// Left lead-list panel for the card view: compact avatar rail, mobile list
// chrome (header/tabs/search/filters), the paginated card list, and the mobile
// simplified kanban. Extracted from LeadsCardViewMain.tsx.
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { LoadMoreSentinel } from "./LoadMoreSentinel";
import { useTranslation } from "react-i18next";
import {
  Users,
  Search,
  SlidersHorizontal,
  List,
  Plus,
  X,
  Kanban,
  MessageSquare,
  Trash2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewTabBar } from "@/components/ui/view-tab-bar";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import { useDeleteAction } from "@/hooks/useDeleteAction";
import { resolveColor } from "@/features/tags/types";
import { CompactLeadCard } from "./CompactLeadCard";
import { CONVERSATION_TYPE_ICON, CONVERSATION_TYPES, type ConversationType } from "../conversationType";
import { useWorkspace } from "@/hooks/useWorkspace";
import { GroupHeader, ListSkeleton } from "./atoms";
import { ListSection, SplitListSkeleton } from "@/components/crm/primitives";
import { LeadListCard } from "./LeadListCard";
import { ListPanelFooter } from "@/components/crm/ListPanelToggleButton";
import { MobileMenuGroup } from "../FilterGroups";
import { MobileSimpleKanban } from "./MobileViews";
import { ChatsPresentingToggle, useChatsPresenting } from "../../presenting";
import {
  MobileListHeader,
  MobileHeaderIconBtn,
  MobileTabSeg,
  MobileDrawerOption,
  MobileDrawerSubheading,
  DrawerMainButton,
} from "@/components/crm/mobile/MobileListHeader";
import { getLeadId, getFullName, getStatus, getPhone } from "./leadUtils";
import { ALL_LEAD_FILTER_STAGES, PIPELINE_HEX, isRealTag } from "./constants";
import type { ViewMode, GroupByOption, SortByOption } from "./types";

type ViewTab = { id: string; label: string; icon: any };

/** The Calls list panel width (VoiceCallsInbox, CallersInbox): Chats uses the same on desktop. */
const CHATS_LIST_WIDTH = "var(--toolbar-w)";

/** The flat list (group headers and lead rows) as one section per group. */
function groupSections(flat: any[]) {
  const out: { label?: string; count?: number; rows: { item: any; i: number }[] }[] = [];
  flat.forEach((item, i) => {
    if (item.kind === "header") { out.push({ label: item.label, count: item.count, rows: [] }); return; }
    if (out.length === 0) out.push({ rows: [] });
    out[out.length - 1].rows.push({ item, i });
  });
  return out;
}

export function LeadsListPanel({
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
  leads,
  leadTagsInfo,
  leadsPullDistance,
  leadsIsRefreshing,
  cardAnimKey,
  hasMore,
  loadingMore,
  onLoadMore,
  campaignsById,
  peekOn,
  setPeekOn,
  handleOpenConversation,
  openQuickAction,
  toggleLeadSelection,
  selectedLeadIds,
  sortBy,
  onSortByChange,
  groupBy,
  onGroupByChange,
  isSortNonDefault,
  isGroupNonDefault,
  onToggleFilterStatus,
  onToggleFilterTag,
  isConversationsMode,
  channelTabs,
  tabletScopeSwitch,
  mobileScopeSwitch,
  mobilePageTabs,
  showChannelBadge = false,
  filterType,
  onToggleFilterType,
  allTags,
  availableAccounts,
  availableCampaigns,
  setFilterAccount,
  setFilterCampaign,
  accountsById,
  bulkBusy,
  handleListBulkDelete,
}: {
  isCompact: boolean;
  isNarrow: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  loading?: boolean;
  flatItems: any[];
  selectedLead: any;
  onSelectLead: (lead: any) => void;
  onMobileViewChange?: (v: "list" | "detail") => void;
  handleCompactHover: (lead: Record<string, any>, rect: DOMRect) => void;
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
  leads: any[];
  leadTagsInfo: Map<any, any>;
  leadsPullDistance: number;
  leadsIsRefreshing: boolean;
  cardAnimKey: number;
  /** Infinite scroll: more leads on the server than loaded. */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  campaignsById?: Map<number, any>;
  peekOn: boolean;
  setPeekOn: (fn: (p: boolean) => boolean) => void;
  handleOpenConversation: (leadId: number | string) => void;
  openQuickAction: (lead: any, type: "status" | "note" | "delete") => void;
  toggleLeadSelection: (id: number) => void;
  selectedLeadIds: Set<number>;
  sortBy: SortByOption;
  onSortByChange: (v: SortByOption) => void;
  groupBy: GroupByOption;
  onGroupByChange: (v: GroupByOption) => void;
  isSortNonDefault: boolean;
  isGroupNonDefault: boolean;
  onToggleFilterStatus: (s: string) => void;
  onToggleFilterTag: (t: string) => void;
  isConversationsMode?: boolean;
  /** Chats page inbox tabs, shown above the card list. */
  channelTabs?: ReactNode;
  /** Chats page on a tablet: the compact Live / Demo switch (Owner), above the inbox tabs. */
  /** Chats page on a phone: the round Live / Demo menu button (Owner), beside the Chat settings gear. */
  /** Tablets have no topbar: the scope switch stays on the list. */
  tabletScopeSwitch?: ReactNode;
  mobileScopeSwitch?: ReactNode;
  /** Chats page: Stats · Chats in the mobile header, in place of the (dead) List switch. */
  mobilePageTabs?: ReactNode;
  /** Both chat channels are on: a small website / WhatsApp badge on each avatar (C8). */
  showChannelBadge?: boolean;
  filterType: ConversationType[];
  onToggleFilterType: (v: ConversationType) => void;
  allTags: { name: string; color: string }[];
  availableAccounts: { id: string; name: string }[];
  availableCampaigns: { id: string; name: string }[];
  setFilterAccount: (v: string) => void;
  setFilterCampaign: (v: string) => void;
  accountsById?: Map<number, string>;
  bulkBusy: boolean;
  handleListBulkDelete: () => Promise<void> | void;
}) {
  const { t } = useTranslation("leads");
  // Owner on Chats: the Hide / Show identities row in the phone tools drawer.
  const { canToggle: canPresent } = useChatsPresenting();
  const { label: deleteLabel } = useDeleteAction("lead");
  const filterOn = isFilterActive || filterStatus.length > 0 || filterTags.length > 0 || filterType.length > 0;
  const [moreDeleteConfirm, setMoreDeleteConfirm] = useState(false);
  const hasSelection = selectedLeadIds.size > 0;
  const pdfPrintRef = useRef<HTMLDivElement>(null);

  // ── Mobile bulk "..." menu: export the selected leads as a printable PDF ──
  const handleExportSelectedPdf = () => {
    const id = "__pdf_leads_selected__";
    if (pdfPrintRef.current) pdfPrintRef.current.id = id;
    const style = document.createElement("style");
    style.id = "__pdf_print_style__";
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #${id} { display: block !important; position: fixed !important; inset: 0 !important; width: 100vw !important; padding: 24px !important; z-index: 9999 !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.getElementById("__pdf_print_style__")?.remove(), 1200);
  };

  const selectedLeads = leads.filter((l) => selectedLeadIds.has(getLeadId(l)));

  // ── Filter / Sort / Group drill-in panels for the mobile header drawer ──
  const sortOptions: { value: SortByOption; label: string }[] = [
    { value: "recent",         label: t("sort.mostRecent") },
    { value: "name_asc",       label: t("sort.nameAZ") },
    { value: "name_desc",      label: t("sort.nameZA") },
    { value: "created_desc",   label: t("sort.createdNewest") },
    { value: "created_asc",    label: t("sort.createdOldest") },
  ];
  // Clients get the short menus (C11): no campaign or channel-type grouping, filtering.
  const { isAgencyUser } = useWorkspace();
  const showTypes = !!isConversationsMode && isAgencyUser;
  const groupOptions: { value: GroupByOption; label: string }[] = [
    { value: "date",     label: t("sort.mostRecent") },
    { value: "status",   label: t("group.status") },
    ...(isAgencyUser ? [{ value: "campaign" as GroupByOption, label: t("group.campaign") }] : []),
    ...(showTypes ? [{ value: "type" as GroupByOption, label: t("conversationType.label") }] : []),
  ];

  // Tags table has leftover conversion-status/sentiment entries that were never
  // real tags — never show them as filter options (Gabriel, 2026-06-21).
  const realTags = allTags.filter((tag) => isRealTag(tag.name));

  const leadsFilterPanel = (
    <>
      {showTypes && (
        <MobileMenuGroup label={t("conversationType.label")} count={filterType.length}>
          {CONVERSATION_TYPES.map((v) => {
            const Icon = CONVERSATION_TYPE_ICON[v];
            return (
              <MobileDrawerOption
                key={v}
                label={<span className="row" style={{ alignItems: "center", gap: 7 }}><Icon size={14} style={{ color: "var(--mute)", flexShrink: 0 }} />{t(`conversationType.${v}`)}</span>}
                selected={filterType.includes(v)}
                onClick={() => onToggleFilterType(v)}
              />
            );
          })}
        </MobileMenuGroup>
      )}
      <MobileMenuGroup label={t("group.status", "Status")} count={filterStatus.length}>
      {ALL_LEAD_FILTER_STAGES.map((s) => (
        <MobileDrawerOption
          key={s}
          label={
            <span className="row" style={{ alignItems: "center", gap: 7 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: PIPELINE_HEX[s] ?? "#6B7280", flexShrink: 0 }} />
              {t(`kanban.stageLabels.${s.replace(/ /g, "")}`, s)}
            </span>
          }
          selected={filterStatus.includes(s)}
          onClick={() => onToggleFilterStatus(s)}
        />
      ))}
      </MobileMenuGroup>
      {realTags.length > 0 && (
        <MobileMenuGroup label={t("detail.sections.tags", "Tags")} count={filterTags.length}>
          {realTags.map((tag) => (
            <MobileDrawerOption
              key={tag.name}
              label={
                <span className="row" style={{ alignItems: "center", gap: 7 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: resolveColor(tag.color), flexShrink: 0 }} />
                  {tag.name}
                </span>
              }
              selected={filterTags.includes(tag.name)}
              onClick={() => onToggleFilterTag(tag.name)}
            />
          ))}
        </MobileMenuGroup>
      )}
      {availableAccounts.length > 0 && (
        <MobileMenuGroup label={t("detail.fields.account", "Account")} count={filterAccount ? 1 : 0}>
          <MobileDrawerOption
            label={t("filters.allAccounts", "All Accounts")}
            selected={!filterAccount}
            onClick={() => { setFilterAccount(""); setFilterCampaign(""); }}
          />
          {availableAccounts.map((a) => (
            <MobileDrawerOption
              key={a.id}
              label={a.name}
              selected={filterAccount === a.id}
              onClick={() => { if (filterAccount === a.id) { setFilterAccount(""); } else { setFilterAccount(a.id); setFilterCampaign(""); } }}
            />
          ))}
        </MobileMenuGroup>
      )}
      {availableCampaigns.length > 0 && (
        <MobileMenuGroup label={t("detailView.campaign", "Campaign")} count={filterCampaign ? 1 : 0}>
          <MobileDrawerOption
            label={t("filters.allCampaigns", "All Campaigns")}
            selected={!filterCampaign}
            onClick={() => setFilterCampaign("")}
          />
          {availableCampaigns.map((c) => (
            <MobileDrawerOption
              key={c.id}
              label={c.name}
              selected={filterCampaign === c.id}
              onClick={() => setFilterCampaign(filterCampaign === c.id ? "" : c.id)}
            />
          ))}
        </MobileMenuGroup>
      )}
    </>
  );

  const leadsSortPanel = (
    <>
      {sortOptions.map((opt) => (
        <MobileDrawerOption key={opt.value} label={opt.label} selected={sortBy === opt.value} onClick={() => onSortByChange(opt.value)} />
      ))}
    </>
  );

  const leadsGroupPanel = (
    <>
      {groupOptions.map((opt) => (
        <MobileDrawerOption key={opt.value} label={opt.label} selected={groupBy === opt.value} onClick={() => onGroupByChange(opt.value)} />
      ))}
    </>
  );

  // Desktop Chats: every group is its own card with a big title, tabs and totals sit on the ground.
  const splitGroups = !!isConversationsMode && !isNarrow && !isCompact;
  const selectedId = selectedLead ? getLeadId(selectedLead) : null;
  const leadRow = (item: any, i: number) => {
    const lid = getLeadId(item.lead);
    return (
      <div key={lid} data-lead-id={lid} className={i < 15 ? "animate-card-enter" : undefined} style={{ scrollMarginTop: 44, ...(i < 15 ? { animationDelay: `${Math.min(i, 15) * 30}ms` } : {}) }}>
      <LeadListCard
        lead={item.lead}
        isActive={selectedId === getLeadId(item.lead)}
        onClick={() => { onSelectLead(item.lead); onMobileViewChange?.("detail"); }}
        leadTags={item.tags}
        campaignsById={campaignsById}
        showPeek={peekOn}
        showChannelBadge={showChannelBadge}
        onOpenConversation={() => handleOpenConversation(getLeadId(item.lead))}
        onQuickChangeStatus={() => openQuickAction(item.lead, "status")}
        onQuickAddNote={() => openQuickAction(item.lead, "note")}
        onQuickDelete={() => openQuickAction(item.lead, "delete")}
        selected={selectedLeadIds.has(getLeadId(item.lead))}
        onToggleSelect={() => toggleLeadSelection(getLeadId(item.lead))}
      />
      </div>
    );
  };

  return (
    <div
      className={cn(
        "la-list-panel",
        splitGroups && "la-list-panel--split",
        "flex flex-col bg-panel-list-bg overflow-hidden h-full min-h-0",
        isCompact
          ? "w-[65px] shrink-0"
          // Chats: the width is set inline below (exactly the Calls list panel), not by a breakpoint class.
          : isConversationsMode && !isNarrow ? "shrink-0" : "w-full lg:w-[var(--toolbar-w)] lg:shrink-0"
      )}
      // Chats on a desktop: exactly the Calls list panel (VoiceCallsInbox / CallersInbox: --toolbar-w, border-box, no shrink),
      // driven by the same JS breakpoint as the two-pane layout so the width can never fall back to full width.
      // Chats: the Calls panel's own ground (--surface), on every width.
      style={{ borderRight: "1px solid var(--line)", ...(isConversationsMode ? { background: "var(--surface)" } : {}), ...(isConversationsMode && !isNarrow && !isCompact ? { width: CHATS_LIST_WIDTH, minWidth: CHATS_LIST_WIDTH, maxWidth: CHATS_LIST_WIDTH, flexShrink: 0 } : {}) }}
    >

      {isCompact && (
        <>
          {/* Minimized rail: ONLY the vertical strip of stage-colored avatar
              tiles. All tools (tab-switch, search, filter/sort/group, +Add) now
              live in the always-visible top bar. */}
          <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto" style={{ overflowX: "hidden" }}>
            {loading ? (
              <ListSkeleton compact />
            ) : flatItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-2">
                <Users className="h-5 w-5 text-muted-foreground/40" />
              </div>
            ) : (
              <div className="flex flex-col items-center" style={{ gap: 9, padding: "12px 0 20px" }}>
                {flatItems.map((item) => {
                  if (item.kind === "header") return null;
                  const lid = getLeadId(item.lead);
                  const selectedId = selectedLead ? getLeadId(selectedLead) : null;
                  return (
                    <div key={lid} data-lead-id={lid} className="shrink-0" style={{ contentVisibility: "auto", containIntrinsicSize: "38px" }}>
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
                <LoadMoreSentinel rootRef={scrollContainerRef} hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} compact />
              </div>
            )}
          </div>
          {/* Fold button on the panel it folds (desktop): centred at the bottom of the rail. */}
          <ListPanelFooter compact />
        </>
      )}

      {!isCompact && <>

      {/* ── Mobile list chrome (isNarrow only) — desktop uses the full-width top bar ── */}
      {isNarrow && (
        <>
          {/* True mobile (<768): shared two-row header (switcher+search+bell / title+filter+actions) */}
          <MobileListHeader
            title={isConversationsMode ? t("page.chatsTitle") : t("page.title")}
            tabSwitcher={isConversationsMode ? <>{mobileScopeSwitch}{mobilePageTabs}</> : (
              <MobileTabSeg
                // Mobile: List + Pipeline only (no Table). The tab drives the
                // existing mobile bodies directly via mobileListMode.
                tabs={viewTabs.filter((tab) => tab.id !== "table")}
                activeId={mobileListMode === "kanban" ? "pipeline" : "list"}
                onChange={(id) => setMobileListMode(id === "pipeline" ? "kanban" : "list")}
              />
            )}
            searchValue={listSearch}
            onSearchChange={onListSearchChange}
            searchPlaceholder={t(isConversationsMode ? "toolbar.searchConversationsPlaceholder" : "toolbar.searchPlaceholder")}
            filterPanel={leadsFilterPanel}
            filterActive={filterOn}
            filterLabel={t("toolbar.filter")}
            sortPanel={leadsSortPanel}
            sortActive={isSortNonDefault}
            sortLabel={t("toolbar.sort")}
            groupPanel={leadsGroupPanel}
            groupActive={isGroupNonDefault}
            groupLabel={t("toolbar.group")}
            leftActions={(
              <DrawerMainButton
                label={t("toolbar.chats", "Conversations")}
                icon={MessageSquare}
                active={peekOn}
                variant="solid"
                onClick={() => setPeekOn((p) => !p)}
              />
            )}
            mainRowTrailing={(
              <MobileHeaderIconBtn
                onClick={() => setMobileAddOpen(true)}
                aria-label={t("toolbar.add", "Add Lead")}
                data-testid="mobile-add-lead-button"
              >
                <Plus className="h-4 w-4" />
              </MobileHeaderIconBtn>
            )}
            morePanel={(
              <>
                {!hasSelection && (
                  <MobileDrawerSubheading>{t("selection.selectLeadsFirst", "Select leads to enable actions")}</MobileDrawerSubheading>
                )}
                <MobileDrawerOption
                  label={t("selection.exportPdfSelected", "Export selected as PDF")}
                  icon={FileText}
                  onClick={hasSelection ? handleExportSelectedPdf : undefined}
                />
                <MobileDrawerOption
                  label={bulkBusy ? "…" : moreDeleteConfirm ? t("common.confirm", "Confirm") : `${deleteLabel} (${selectedLeadIds.size})`}
                  icon={Trash2}
                  danger
                  onClick={hasSelection ? () => {
                    if (!moreDeleteConfirm) { setMoreDeleteConfirm(true); return; }
                    handleListBulkDelete();
                    setMoreDeleteConfirm(false);
                  } : undefined}
                />
              </>
            )}
            onMoreClose={() => setMoreDeleteConfirm(false)}
            extraActions={isConversationsMode && canPresent ? <ChatsPresentingToggle variant="drawer" /> : undefined}
          />

          {/* Tablet chrome (768–1023): legacy header (title + view tabs + actions + search) */}
          <div className="hidden md:flex pl-[17px] pr-[17px] pt-3 pb-1 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-[20px] font-bold font-heading text-foreground leading-tight tracking-[-0.01em]">{isConversationsMode ? t("page.chatsTitle") : t("page.title")}</h2>
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
                  placeholder={t(isConversationsMode ? "toolbar.searchConversationsPlaceholder" : "toolbar.searchPlaceholder")}
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
      {mobileListMode !== "kanban" && (splitGroups ? (
        // Desktop Chats: the channel tabs head the panel.
        channelTabs && <div className="la-list-head">{channelTabs}</div>
      ) : (
        <>
          {tabletScopeSwitch && <div className="hidden md:flex justify-center" style={{ padding: "6px 12px 0" }}>{tabletScopeSwitch}</div>}
          {channelTabs}
        </>
      ))}
      {/* Lead list — card list (pagination inside scroll area, below last card) */}
      <div ref={scrollContainerRef} className={cn("la-list-area", splitGroups && "la-split-scroll", mobileListMode === "kanban" && "hidden lg:flex lg:flex-col")} style={{ padding: "6px 8px 8px" }}>
        {/* Pull-to-refresh indicator — mobile only */}
        <PullToRefreshIndicator pullDistance={leadsPullDistance} isRefreshing={leadsIsRefreshing} />
        {loading ? (
          splitGroups ? <SplitListSkeleton /> : <ListSkeleton peek={peekOn} />
        ) : flatItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {listSearch || isFilterActive ? t("emptyState.noMatch") : t("emptyState.noLeads")}
            </p>
          </div>
        ) : (
          <>
            {splitGroups ? groupSections(flatItems).map((sec) => (
              <ListSection key={`${cardAnimKey}-${sec.label ?? "all"}`} label={sec.label} count={sec.count}>
                <div className="la-cards la-cards--flat">{sec.rows.map(({ item, i }) => leadRow(item, i))}</div>
              </ListSection>
            )) : (
              /* la-cards--flat: WhatsApp-style flat rows; drop the modifier for the raised cards. */
              <div key={`anim-${cardAnimKey}`} className="la-cards la-cards--flat">
                {flatItems.map((item, i) => (item.kind === "header"
                  ? <GroupHeader key={`h-${item.label}-${i}`} label={item.label} count={item.count} isFirst={i === 0} />
                  : leadRow(item, i)))}
              </div>
            )}

            {/* Infinite scroll: the next page loads as this nears the viewport */}
            <LoadMoreSentinel rootRef={scrollContainerRef} hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
          </>
        )}
      </div>
      {/* Desktop list panel footer: the fold button at its right end. */}
      {!isNarrow && <ListPanelFooter />}
      </>}

      {/* Hidden printable sheet for the "..." → Export selected as PDF action.
          Shown only inside @media print via handleExportSelectedPdf (see top of file). */}
      <div ref={pdfPrintRef} style={{ display: "none" }}>
        <h1 style={{ fontSize: 18, marginBottom: 16 }}>{t("page.title")} — {selectedLeads.length}</h1>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Name", "Phone", "Email", t("group.status", "Status"), t("detailView.campaign", "Campaign"), t("detail.fields.account", "Account")].map((h) => (
                <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "6px 8px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedLeads.map((lead) => {
              const cId = Number(lead.Campaigns_id || lead.campaigns_id || lead.campaignsId || 0);
              const aId = Number(lead.Accounts_id || lead.account_id || lead.accounts_id || 0);
              const campaignName = lead.Campaign || lead.campaign || lead.campaign_name || (cId && campaignsById?.get(cId)?.name) || "";
              const accountName = (aId && accountsById?.get(aId)) || "";
              return (
                <tr key={getLeadId(lead)}>
                  <td style={{ borderBottom: "1px solid #eee", padding: "6px 8px" }}>{getFullName(lead)}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "6px 8px" }}>{getPhone(lead)}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "6px 8px" }}>{lead.email || lead.Email || ""}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "6px 8px" }}>{getStatus(lead)}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "6px 8px" }}>{campaignName}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: "6px 8px" }}>{accountName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
