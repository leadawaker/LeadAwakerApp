import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useDeleteAction } from "@/hooks/useDeleteAction";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { usePersistedSelection, setPersistedSelection } from "@/hooks/usePersistedSelection";
import { useSearch } from "wouter";
import { readLeadParam } from "@/lib/leadLink";
import { apiFetch } from "@/lib/apiUtils";
import {
  LeadsCardView, LeadDetailView, getLeadId as getLeadIdHelper, getFullName as getFullNameHelper,
  type GroupByOption, type SortByOption, type VirtualListItem,
} from "./LeadsCardView";
import { LeadsInlineTable } from "./LeadsInlineTable";
import { LeadsKanban } from "./LeadsKanban";
import { PipelineLeadPanel } from "./cardView/PipelineLeadPanel";
import { isRealTag } from "./cardView/constants";
import { isStageTag } from "@/components/crm/status/statusPill";
import { exportLeadsCsv } from "./cardView/exportLeadsCsv";
import { CsvImportWizard } from "./CsvImportWizard";
import { createLead, bulkDeleteLeads, updateLead } from "../api/leadsApi";
import { usePagedLeads, fetchLeadsByIds, fetchAllLeads, useDebouncedValue, type PagedLeadsQuery } from "../hooks/usePagedLeads";
import { buildServerRows } from "../lib/serverRows";
import { ALL_STAGE_KEYS, RX_STAGES, RX_STAGE_DB_STATUS } from "../lib/leadDisplay";
import { CHAT_CHANNEL_TABS, type ChatChannelTab } from "./chatChannel";
import type { ConversationType } from "./conversationType";
import { LeadsTableTopbar, type TableFilters } from "./LeadsTableTopbar";
import { LeadsPipelineTopbar } from "./LeadsPipelineTopbar";
import { LeadsQuickControls, LeadsQuickFilters, QuickViewFilterGroup } from "./LeadsQuickFilters";
import { useLeadsLookups } from "./useLeadsLookups";
import { ChatsPageTabs, type ChatsTab } from "./cardView/ChatsPageTabs";
import { ChatsSideView } from "./cardView/ChatsSideView";
import { ChatsPresentingProvider } from "../presenting";
import { readSettingsParams } from "@/features/accounts/components/workspace/receptionist/settingsLink";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useHomeServices } from "@/features/home/api/homeApi";
import { useChatScope } from "../hooks/useChatScope";
import { ScopeSwitch } from "@/features/voiceCalls/components/ScopeSwitch";

import {
  VIEW_MODE_KEY, VISIBLE_COLS_KEY, LIST_PREFS_KEY, TABLE_PREFS_KEY, PIPE_PREFS_KEY, COL_ORDER_KEY, COL_WIDTHS_KEY,
  QUICK_PREFS_KEY, DEFAULT_VISIBLE_COLS, VIEW_TAB_KEYS, ALLOWED_VIEWS_BY_MODE, safeListSort, safeTableSort, normalizeLead,
  type ViewMode, type LeadsPageMode, type TableGroupByOption, type TableSortByOption, type QuickView, type ChannelFilter, type PipelineSort,
} from "./leadsTableConfig";

export type { LeadsPageMode };

/**
 * Leads workspace. Page mode (Conversations / Contacts split):
 *  - "conversations" → chat list only (the Chats page).
 *  - "contacts"      → directory: Table (default) + Pipeline (the Leads page).
 *  - "all"           → legacy combined page (all three views).
 * Data is paged from GET /api/leads/page: search, filters, sort and counts run
 * on the server; the list loads 50 at a time and fetches more on scroll.
 */
export function LeadsTable({ mode = "all" }: { mode?: LeadsPageMode } = {}) {
  // Chats: the Owner's Presenting switch masks names and numbers on the cards, the lead and the messages.
  return (
    <ChatsPresentingProvider enabled={mode === "conversations"}>
      <LeadsWorkspace mode={mode} />
    </ChatsPresentingProvider>
  );
}

function LeadsWorkspace({ mode }: { mode: LeadsPageMode }) {
  const { t } = useTranslation("leads");
  const { label: deleteLabel } = useDeleteAction("lead");
  const allowedViews = ALLOWED_VIEWS_BY_MODE[mode];
  const viewTabs = useMemo(() => VIEW_TAB_KEYS.filter((k) => allowedViews.includes(k.id)), [allowedViews]);
  const { currentAccountId, isAgencyView, isAgencyUser } = useWorkspace();
  const filterAccountId = currentAccountId > 0 ? currentAccountId : undefined;

  /* ── View mode (persisted per page mode) ── */
  const [mobileView, setMobileView] = useState<"list" | "detail">(() => {
    try { if (localStorage.getItem("leadawaker-returnto") && localStorage.getItem("selected-lead-id")) return "detail"; } catch {}
    // An "open this lead" link (?lead=) shows the lead, not the list.
    if (readLeadParam(window.location.search)) return "detail";
    return "list";
  });
  const viewModeKey = mode === "all" ? VIEW_MODE_KEY : `${VIEW_MODE_KEY}:${mode}`;
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (mode === "conversations") return "list";
    const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
    // Clients open in Table on a phone (the board is cramped at 390px), Pipeline on a desktop.
    if (role !== "Owner" && role !== "Admin") {
      const phone = typeof window !== "undefined" && window.innerWidth < 768;
      if (phone && allowedViews.includes("table")) return "table";
      if (allowedViews.includes("pipeline")) return "pipeline";
    }
    try {
      const stored = localStorage.getItem(viewModeKey);
      if (stored && allowedViews.includes(stored as ViewMode)) return stored as ViewMode;
    } catch {}
    return allowedViews[0];
  });
  useEffect(() => { if (isAgencyUser) try { localStorage.setItem(viewModeKey, viewMode); } catch {} }, [viewMode, isAgencyUser, viewModeKey]);

  /* ── List view prefs (Chats) ── */
  const [listSearch, setListSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [listPrefs, setListPrefs] = usePersistedState(mode === "conversations" ? `${LIST_PREFS_KEY}:conversations` : LIST_PREFS_KEY, {
    groupBy: "date" as GroupByOption, sortBy: "recent" as SortByOption, filterStatus: [] as string[], filterTags: [] as string[],
  });
  const groupBy = listPrefs.groupBy;
  const sortBy = safeListSort(listPrefs.sortBy) as SortByOption;
  const { filterStatus, filterTags } = listPrefs;
  const setGroupBy = useCallback((v: GroupByOption) => setListPrefs((p) => ({ ...p, groupBy: v })), [setListPrefs]);
  const setSortBy = useCallback((v: SortByOption) => setListPrefs((p) => ({ ...p, sortBy: v })), [setListPrefs]);
  const toggleFilterStatus = useCallback((s: string) => setListPrefs((p) => ({ ...p, filterStatus: p.filterStatus.includes(s) ? p.filterStatus.filter((x) => x !== s) : [...p.filterStatus, s] })), [setListPrefs]);
  const toggleFilterTag = useCallback((s: string) => setListPrefs((p) => ({ ...p, filterTags: p.filterTags.includes(s) ? p.filterTags.filter((x) => x !== s) : [...p.filterTags, s] })), [setListPrefs]);
  const [listFilterAccount, setListFilterAccount] = useState("");
  const [listFilterCampaign, setListFilterCampaign] = useState("");
  const [listFilterType, setListFilterType] = useState<ConversationType[]>([]);
  const toggleListFilterType = useCallback((v: ConversationType) => setListFilterType((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v])), []);
  const clearListFilterType = useCallback(() => setListFilterType([]), []);
  const [storedChannelTab, setChannelTab] = usePersistedState<ChatChannelTab>("chats-channel-tab", "all", (v) => CHAT_CHANNEL_TABS.includes(v as ChatChannelTab));
  // Chats page: the list, or its settings (the "Chat settings" button). It always opens on Chats; Settings only
  // from a link (?view=settings), never remembered between visits. A ?lead= link opens on Chats with that lead selected.
  const [chatsTab, setChatsTab] = useState<ChatsTab>(() => (
    mode === "conversations" && readSettingsParams(window.location.search).open ? "settings" : "chats"
  ));
  const isPhone = useIsMobile(768);
  // The All / Website / WhatsApp filter only exists when the account runs both channels.
  const { data: chatServices } = useHomeServices(currentAccountId);
  const showChannelFilter = !!(chatServices?.website && chatServices?.whatsapp) || (currentAccountId === 0 && !!isAgencyUser);
  const channelTab: ChatChannelTab = showChannelFilter ? storedChannelTab : "all";
  const chatScope = useChatScope();

  /* ── Table prefs ── */
  const [tableSearch, setTableSearch] = useState("");
  const [tableGroupDir, setTableGroupDir] = useState<"asc" | "desc">("asc");
  const [tablePrefs, setTablePrefs] = usePersistedState(TABLE_PREFS_KEY, {
    sortBy: "recent" as TableSortByOption, groupBy: "status" as TableGroupByOption,
    filterStatus: [] as string[], filterCampaign: "", filterAccount: "", filterService: [] as string[],
    filterSource: [] as string[], filterTags: [] as string[], filterHasPhone: false, filterHasEmail: false,
  });
  const tableSortBy = safeTableSort(tablePrefs.sortBy);
  const tableGroupBy = tablePrefs.groupBy;
  const tableFilters: TableFilters = {
    status: tablePrefs.filterStatus ?? [], campaign: tablePrefs.filterCampaign ?? "", account: tablePrefs.filterAccount ?? "",
    service: tablePrefs.filterService ?? [], source: tablePrefs.filterSource ?? [], tags: tablePrefs.filterTags ?? [],
    hasPhone: tablePrefs.filterHasPhone ?? false, hasEmail: tablePrefs.filterHasEmail ?? false,
  };
  const PREF_KEY: Record<keyof TableFilters, string> = {
    status: "filterStatus", campaign: "filterCampaign", account: "filterAccount", service: "filterService",
    source: "filterSource", tags: "filterTags", hasPhone: "filterHasPhone", hasEmail: "filterHasEmail",
  };
  const setTableFilter = useCallback(<K extends keyof TableFilters>(k: K, v: TableFilters[K]) => setTablePrefs((p) => ({ ...p, [PREF_KEY[k]]: v })), [setTablePrefs]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleTableFilter = useCallback((k: "status" | "service" | "source" | "tags", v: string) => setTablePrefs((p: any) => {
    const cur: string[] = p[PREF_KEY[k]] ?? [];
    return { ...p, [PREF_KEY[k]]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
  }), [setTablePrefs]); // eslint-disable-line react-hooks/exhaustive-deps
  const clearTableFilters = useCallback(() => setTablePrefs((p) => ({
    ...p, filterStatus: [], filterCampaign: "", filterAccount: "", filterService: [], filterSource: [], filterTags: [], filterHasPhone: false, filterHasEmail: false,
  })), [setTablePrefs]);
  // A switch in the nav bar's account picker wins over an account or campaign filter picked here
  // (both belong to the old account, and Chat settings would keep showing it).
  const seenWorkspace = useRef(currentAccountId);
  useEffect(() => {
    if (seenWorkspace.current === currentAccountId) return;
    seenWorkspace.current = currentAccountId;
    setListFilterAccount("");
    setListFilterCampaign("");
    setTablePrefs((p) => (p.filterAccount || p.filterCampaign ? { ...p, filterAccount: "", filterCampaign: "" } : p));
  }, [currentAccountId, setTablePrefs]);
  const isTableFilterActive = tableFilters.status.length > 0 || !!tableFilters.campaign || !!tableFilters.account || tableFilters.service.length > 0
    || tableFilters.source.length > 0 || tableFilters.tags.length > 0 || tableFilters.hasPhone || tableFilters.hasEmail;

  /* ── Pipeline prefs ── */
  const [kanbanSearch, setKanbanSearch] = useState("");
  const [pipePrefs, setPipePrefs] = usePersistedState(PIPE_PREFS_KEY, { filterHasPhone: false, filterHasEmail: false, sortBy: null as PipelineSort | "score-desc" });
  const pipelineSortBy: PipelineSort = pipePrefs.sortBy === "recency" || pipePrefs.sortBy === "alpha" ? pipePrefs.sortBy : null;
  const [compactMode, setCompactMode] = usePersistedState<boolean>("kanban_compact_mode", false);
  const [foldAction, setFoldAction] = useState<{ type: "expand-all" | "fold-empty" | "fold-threshold"; threshold?: number; seq: number }>({ type: "expand-all", seq: 0 });
  const [hasAnyCollapsed, setHasAnyCollapsed] = useState(false);
  const [selectedKanbanLead, setSelectedKanbanLead] = useState<Record<string, any> | null>(null);

  /* ── Quick filters (Leads page: views + channel) ── */
  const [quickPrefs, setQuickPrefs] = usePersistedState(QUICK_PREFS_KEY, { view: "all" as QuickView, channel: "all" as ChannelFilter });

  /* ── Table display prefs ── */
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(VISIBLE_COLS_KEY) || "null");
      if (Array.isArray(arr) && arr.length > 0) {
        const set = new Set<string>(arr);
        set.delete("score");
        // One-time: surface the new last-contact + appointment columns.
        if (localStorage.getItem("leads-table-contact-v1") !== "done") {
          set.add("lastContact"); set.add("appointment");
          try { localStorage.setItem("leads-table-contact-v1", "done"); } catch {}
        }
        return set;
      }
    } catch {}
    return new Set(DEFAULT_VISIBLE_COLS);
  });
  useEffect(() => { try { localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify(Array.from(visibleCols))); } catch {} }, [visibleCols]);
  const [columnOrder, setColumnOrder] = usePersistedState<string[]>(COL_ORDER_KEY, []);
  const [columnWidths, setColumnWidths] = usePersistedState<Record<string, number>>(COL_WIDTHS_KEY, {});
  const [showVerticalLines, setShowVerticalLines] = usePersistedState<boolean>("leads-vertical-lines", false);
  const [tableSelectedIds, setTableSelectedIds] = useState<Set<number>>(new Set());
  const [importWizardOpen, setImportWizardOpen] = useState(false);

  /* ── Full-width page (strip the shared content cap while mounted) ── */
  // Chats sits flush like Calls (list panel right after the nav bar); the Leads views keep the 4px side gutter.
  useEffect(() => {
    const el = document.getElementById("crm-content-wrapper");
    if (el) { el.classList.remove("px-3", "md:pl-0", "md:pr-5", "max-w-[1729px]"); if (mode !== "conversations") el.classList.add("px-1", "md:px-1"); el.style.overflow = "visible"; }
    return () => {
      const w = document.getElementById("crm-content-wrapper");
      if (w) { w.classList.remove("px-1", "md:px-1", "px-3", "md:pl-0", "md:pr-5", "max-w-[1729px]"); w.style.overflow = ""; }
    };
  }, [mode]);
  const { clearTopbarActions } = useTopbarActions();
  useEffect(() => { clearTopbarActions(); }, [clearTopbarActions]);

  /* ── Lookups: accounts, campaigns, tags ── */
  const { accountsById, campaignsById, allTagsById } = useLeadsLookups(isAgencyView);

  /* ── Server queries (one per view; only the active one fetches) ── */
  const dListSearch = useDebouncedValue(listSearch, 300);
  const dTableSearch = useDebouncedValue(tableSearch, 300);
  const dKanbanSearch = useDebouncedValue(kanbanSearch, 300);
  const quick: Partial<PagedLeadsQuery> = mode === "conversations" ? {} : {
    channel: quickPrefs.channel === "all" ? undefined : quickPrefs.channel,
    needsReply: quickPrefs.view === "needsReply",
    upcoming: quickPrefs.view === "upcoming",
  };
  const listQuery = useMemo<PagedLeadsQuery>(() => ({
    accountId: filterAccountId, search: dListSearch.trim(), sort: sortBy, groupBy,
    status: filterStatus, tags: filterTags, account: listFilterAccount, campaign: listFilterCampaign, type: listFilterType,
    chatChannel: mode === "conversations" && channelTab !== "all" ? channelTab : undefined,
    chatsOnly: mode === "conversations",
    scope: mode === "conversations" ? chatScope.scope : undefined,
  }), [filterAccountId, dListSearch, sortBy, groupBy, filterStatus, filterTags, listFilterAccount, listFilterCampaign, listFilterType, mode, channelTab, chatScope.scope]);
  const tableQuery = useMemo<PagedLeadsQuery>(() => ({
    accountId: filterAccountId, search: dTableSearch.trim(),
    sort: quickPrefs.view === "upcoming" ? "appointment" : tableSortBy,
    groupBy: quickPrefs.view === "upcoming" ? "none" : tableGroupBy, groupDir: tableGroupDir,
    ...tableFilters, ...quick,
  }), [filterAccountId, dTableSearch, tableSortBy, tableGroupBy, tableGroupDir, JSON.stringify(tableFilters), JSON.stringify(quick), quickPrefs.view]); // eslint-disable-line react-hooks/exhaustive-deps
  const pipeQuery = useMemo<PagedLeadsQuery>(() => ({
    accountId: filterAccountId, search: dKanbanSearch.trim(), groupBy: "status",
    sort: pipelineSortBy === "alpha" ? "name_asc" : "recent",
    hasPhone: pipePrefs.filterHasPhone, hasEmail: pipePrefs.filterHasEmail, ...quick,
  }), [filterAccountId, dKanbanSearch, pipelineSortBy, pipePrefs.filterHasPhone, pipePrefs.filterHasEmail, JSON.stringify(quick)]); // eslint-disable-line react-hooks/exhaustive-deps

  const listData = usePagedLeads(listQuery, { enabled: viewMode === "list" && !(mode === "conversations" && chatsTab !== "chats") });
  const tableData = usePagedLeads(tableQuery, { enabled: viewMode === "table" });
  const pipeData = usePagedLeads(pipeQuery, { enabled: viewMode === "pipeline", perGroup: 30 });
  const active = viewMode === "list" ? listData : viewMode === "table" ? tableData : pipeData;

  const maps = useMemo(() => ({ accountsById, campaignsById }), [accountsById, campaignsById]);
  const leads = useMemo(() => active.leads.map((l) => normalizeLead(l, maps)), [active.leads, maps]);

  /* ── Selection, including a lead that is not in the loaded page ── */
  const [selVersion, setSelVersion] = useState(0);
  useEffect(() => {
    const h = () => setSelVersion((v) => v + 1);
    window.addEventListener("persisted-selection", h);
    return () => window.removeEventListener("persisted-selection", h);
  }, []);
  // ?lead=<id> deep link: select it (overrides the stored selection).
  const deepLinkRef = useRef<string | null>(null);
  if (deepLinkRef.current === null) {
    deepLinkRef.current = readLeadParam(window.location.search);
    try { if (deepLinkRef.current) localStorage.setItem("selected-lead-id", deepLinkRef.current); } catch {}
  }
  // A later ?lead= while the page stays mounted (an "open lead" link clicked on Chats): show that lead too.
  const search = useSearch();
  useEffect(() => {
    const id = readLeadParam(search);
    if (!id || id === deepLinkRef.current) return;
    deepLinkRef.current = id;
    try { setPersistedSelection("selected-lead-id", id); } catch {}
    if (mode === "conversations") setChatsTabState("chats");
    setMobileView("detail");
  }, [search, mode]);
  const [pinned, setPinned] = useState<Record<string, any> | null>(null);
  const [pinnedMissing, setPinnedMissing] = useState(false);
  useEffect(() => {
    if (active.loading) return;
    let sid: string | null = null;
    try { sid = localStorage.getItem("selected-lead-id"); } catch {}
    if (!sid || leads.some((l) => String(l.id) === sid)) { setPinnedMissing(false); return; }
    let cancelled = false;
    fetchLeadsByIds([Number(sid)], filterAccountId)
      .then((r) => { if (cancelled) return; setPinned(r[0] ? normalizeLead(r[0], maps) : null); setPinnedMissing(!r[0]); })
      .catch(() => { if (!cancelled) setPinnedMissing(true); });
    return () => { cancelled = true; };
  }, [leads, selVersion, filterAccountId, active.loading, maps]);
  const items = useMemo(
    () => (pinned && !leads.some((l) => l.id === pinned.id) ? [...leads, pinned] : leads),
    [leads, pinned],
  );
  const [selectedLead, setSelectedLead] = usePersistedSelection<Record<string, any>>("selected-lead-id", (l) => l.Id ?? l.id, items);

  // Chats: land on the most recent conversation on open (per Gabriel), unless
  // arriving through a deep link (calendar "return to" or ?lead=).
  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    if (didAutoSelectRef.current || viewMode !== "list" || leads.length === 0) return;
    didAutoSelectRef.current = true;
    try { if ((localStorage.getItem("leadawaker-returnto") || deepLinkRef.current) && localStorage.getItem("selected-lead-id")) return; } catch {}
    const rec = (l: any) => new Date(l.recency_at || l.created_at || 0).getTime();
    setSelectedLead(leads.reduce((a, b) => (rec(b) > rec(a) ? b : a)));
  }, [leads, viewMode, setSelectedLead]);
  // No selection (or the stored one is gone): select the first row of the list.
  useEffect(() => {
    if (viewMode !== "list" || selectedLead || leads.length === 0) return;
    let sid: string | null = null;
    try { sid = localStorage.getItem("selected-lead-id"); } catch {}
    // Chats: the first row of the tab on screen (the rows of the tab just left stay until the new ones load).
    const first = mode === "conversations" ? leads.find((l) => !!l.is_demo === (chatScope.scope === "demo")) : leads[0];
    if (first && (!sid || pinnedMissing)) setSelectedLead(first);
  }, [leads, selectedLead, viewMode, pinnedMissing, setSelectedLead, mode, chatScope.scope]);

  // A lead opened by link that sits in the other tab (a live chat while on Demo, or the reverse): show its tab.
  useEffect(() => {
    if (mode !== "conversations" || !chatScope.canDemo || !pinned) return;
    const tab = pinned.is_demo ? "demo" : "live";
    if (tab !== chatScope.scope) chatScope.setScope(tab);
  }, [pinned]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Tags per lead ── */
  const leadTagsInfo = useMemo(() => {
    const info = new Map<number, { name: string; color: string }[]>();
    items.forEach((l: any) => {
      // Stage-named tags repeat the stage pill: hidden everywhere. Clients see no Lead Tags on
      // their lists; "Contact Later" stays because it drives the resume date.
      const tags = (Array.isArray(l.tag_ids) ? l.tag_ids : []).map((id: number) => allTagsById.get(id))
        .filter((tg: { name: string } | undefined) => !!tg && !isStageTag(tg.name) && (isAgencyUser || tg.name === "Contact Later"));
      if (tags.length) info.set(Number(l.Id ?? l.id), tags);
    });
    return info;
  }, [items, allTagsById, isAgencyUser]);
  const allTags = useMemo(() => Array.from(allTagsById.values()).filter((tg) => isRealTag(tg.name)), [allTagsById]);

  /* ── AI agent context ── */
  const publishEntity = usePublishEntityData();
  useEffect(() => {
    if (!leads.length) return;
    publishEntity({
      entityType: "list",
      entityName: "Leads List",
      summary: {
        totalLeads: active.total,
        recentLeads: leads.slice(0, 10).map((l: any) => ({ id: l.id, name: getFullNameHelper(l), status: l.conversion_status, source: l.Source ?? l.source })),
      },
      updatedAt: Date.now(),
    });
  }, [leads, active.total, publishEntity]);

  /* ── Breadcrumb ── */
  const { setCrumb } = useBreadcrumb();
  useEffect(() => { setCrumb(selectedLead ? getFullNameHelper(selectedLead) : null); return () => setCrumb(null); }, [selectedLead, setCrumb]);

  /* ── Actions ── */
  const handleRefresh = useCallback(() => { active.refresh(); setSelVersion((v) => v + 1); }, [active]);
  const handleViewSwitch = useCallback((next: ViewMode) => {
    if (!allowedViews.includes(next)) return;
    setViewMode(next); setSelectedLead(null); setMobileView("list");
  }, [allowedViews, setSelectedLead]);
  const handleChatScope = useCallback((s: string) => {
    chatScope.setScope(s === "demo" ? "demo" : "live");
    setSelectedLead(null); setPinned(null); setMobileView("list");
  }, [chatScope.setScope, setSelectedLead]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleClosePanel = useCallback(() => setSelectedLead(null), [setSelectedLead]);
  const handleAddLead = useCallback(async () => {
    try {
      const newLead = await createLead({ first_name: "New", last_name: "Lead", phone: "" });
      handleRefresh();
      if (newLead?.id || newLead?.Id) { setSelectedLead(newLead); setTableSelectedIds(new Set([newLead.id ?? newLead.Id])); }
    } catch (err) { console.error("Create lead failed", err); }
  }, [handleRefresh, setSelectedLead]);
  const handleBulkDelete = useCallback(async () => {
    if (!tableSelectedIds.size) return;
    try { await bulkDeleteLeads(Array.from(tableSelectedIds)); setTableSelectedIds(new Set()); setSelectedLead(null); handleRefresh(); }
    catch (err) { console.error("Bulk delete failed", err); }
  }, [tableSelectedIds, handleRefresh, setSelectedLead]);
  const handleDuplicate = useCallback(async () => {
    if (!tableSelectedIds.size) return;
    try {
      for (const lead of items.filter((l) => tableSelectedIds.has(Number(l.Id ?? l.id)))) {
        await createLead({
          first_name: lead.first_name || lead.full_name || "Copy", last_name: lead.last_name || "",
          phone: lead.phone || "", email: lead.email || "", Conversion_Status: lead.conversion_status || "New", notes: lead.notes || "",
        });
      }
      setTableSelectedIds(new Set()); handleRefresh();
    } catch (err) { console.error("Duplicate leads failed", err); }
  }, [tableSelectedIds, items, handleRefresh]);
  const handleExportTable = useCallback(async () => {
    try { exportLeadsCsv((await fetchAllLeads(tableQuery)).map((l) => normalizeLead(l, maps)), campaignsById, accountsById); }
    catch (err) { console.error("Export failed", err); }
  }, [tableQuery, maps, campaignsById, accountsById]);
  const handleKanbanLeadMove = useCallback(async (leadId: number | string, newStage: string) => {
    const status = RX_STAGE_DB_STATUS[newStage] ?? newStage;
    pipeData.patchLead(leadId, { Conversion_Status: status, conversion_status: status, stage_key: newStage, group_key: newStage });
    try { await updateLead(leadId, { Conversion_Status: status }); pipeData.refresh(); }
    catch (err) { console.error("Failed to move lead", err); pipeData.refresh(); throw err; }
  }, [pipeData]);

  // Pipeline: keep the side panel in sync with the shared selection.
  useEffect(() => {
    if (viewMode !== "pipeline" || !selectedLead) return;
    if ((selectedLead.Id ?? selectedLead.id) !== (selectedKanbanLead?.Id ?? selectedKanbanLead?.id)) setSelectedKanbanLead(selectedLead);
  }, [selectedLead, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clients never see the campaign or account columns (agency detail), nor Lead Tags.
  const tableCols = useMemo(() => {
    if (isAgencyUser) return visibleCols;
    const next = new Set(visibleCols);
    ["campaign", "account", "tags", "source", "bumpStage"].forEach((k) => next.delete(k));
    return next;
  }, [visibleCols, isAgencyUser]);
  // Phones: empty pipeline columns start folded (there is no Fold toggle there).
  const foldedOnPhoneRef = useRef(false);
  useEffect(() => {
    if (!isPhone || viewMode !== "pipeline" || pipeData.loading || foldedOnPhoneRef.current) return;
    foldedOnPhoneRef.current = true;
    setFoldAction((prev) => ({ type: "fold-empty", seq: prev.seq + 1 }));
  }, [isPhone, viewMode, pipeData.loading]);
  // Receptionist-only accounts see exactly New inquiry, Answered, Booked, Done.
  const receptionistOnly = !!chatServices && !chatServices.reactivation && currentAccountId > 0;

  /* ── Table rows (server-ordered, headers from server counts) ── */
  const tableFlatItems = useMemo((): VirtualListItem[] => buildServerRows(
    viewMode === "table" ? leads : [], quickPrefs.view === "upcoming" ? "none" : tableGroupBy, tableData.groups, leadTagsInfo, t,
  ), [viewMode, leads, quickPrefs.view, tableGroupBy, tableData.groups, leadTagsInfo, t]);

  const facets = active.facets;
  const accountOpts = useMemo(() => (isAgencyView ? (facets?.accounts ?? []).map((a) => ({ id: String(a.id), name: a.name })) : []), [facets, isAgencyView]);
  const campaignOpts = useMemo(() => (facets?.campaigns ?? [])
    .filter((c) => !tableFilters.account || String(c.accountId ?? "") === tableFilters.account)
    .map((c) => ({ id: String(c.id), name: c.name })), [facets, tableFilters.account]);

  if (active.error && !active.loading && !active.leads.length) {
    return <ApiErrorFallback error={active.error} onRetry={handleRefresh} isRetrying={active.fetching} />;
  }

  const quickFilters = mode !== "conversations" && (
    <LeadsQuickFilters
      view={quickPrefs.view}
      onViewChange={(v) => setQuickPrefs((p) => ({ ...p, view: v }))}
      channel={quickPrefs.channel}
      onChannelChange={(c) => setQuickPrefs((p) => ({ ...p, channel: c }))}
      total={active.total}
      viewCounts={active.viewCounts}
      channelCounts={active.channelCounts}
      stages={viewMode === "table" ? (receptionistOnly ? RX_STAGES : ALL_STAGE_KEYS) : undefined}
      selectedStages={tableFilters.status}
      onToggleStage={(st) => toggleTableFilter("status", st)}
    />
  );
  // Desktop: the channel tabs sit in the topbar; the view is the "Show" group of the Filter menu.
  const quickControls = mode !== "conversations" && (
    <LeadsQuickControls
      channel={quickPrefs.channel}
      onChannelChange={(c) => setQuickPrefs((p) => ({ ...p, channel: c }))}
      channelCounts={active.channelCounts}
    />
  );
  const viewFilter = mode !== "conversations" ? {
    group: (
      <QuickViewFilterGroup
        view={quickPrefs.view}
        onViewChange={(v) => setQuickPrefs((p) => ({ ...p, view: v }))}
        total={active.total}
        viewCounts={active.viewCounts}
      />
    ),
    active: quickPrefs.view !== "all",
    clear: () => setQuickPrefs((p) => ({ ...p, view: "all" as QuickView })),
  } : undefined;
  const sidePanelStyle: React.CSSProperties = { flex: "0 0 clamp(260px, 22vw, 400px)", minWidth: 0, borderLeft: "1px solid var(--line)", background: "var(--surface)" };

  if (mode === "conversations" && chatsTab !== "chats") {
    // Agency: Settings opens on the account the chat list is filtered to, else the nav bar's account.
    return <ChatsSideView tab={chatsTab} onTab={setChatsTab} fallbackAccountId={Number(listFilterAccount) || undefined} />;
  }

  return (
    <div className="flex flex-col h-full" data-onboarding="leads-table">
      {viewMode === "list" && (
        <div className="flex-1 min-h-0">
          <LeadsCardView
            leads={items}
            loading={listData.loading}
            selectedLead={selectedLead}
            onSelectLead={setSelectedLead}
            onClose={handleClosePanel}
            leadTagsInfo={leadTagsInfo}
            onRefresh={handleRefresh}
            listSearch={listSearch}
            groupBy={groupBy}
            sortBy={sortBy}
            filterStatus={filterStatus}
            filterTags={filterTags}
            viewMode={viewMode}
            onViewModeChange={handleViewSwitch}
            allowedViews={allowedViews}
            searchOpen={searchOpen}
            onSearchOpenChange={setSearchOpen}
            onListSearchChange={setListSearch}
            onGroupByChange={setGroupBy}
            onSortByChange={setSortBy}
            onToggleFilterStatus={toggleFilterStatus}
            onToggleFilterTag={toggleFilterTag}
            allTags={allTags}
            hasNonDefaultControls={groupBy !== "date" || sortBy !== "recent" || filterStatus.length > 0 || filterTags.length > 0}
            isGroupNonDefault={groupBy !== "date"}
            isSortNonDefault={sortBy !== "recent"}
            onResetControls={() => setListPrefs((p) => ({ ...p, filterStatus: [], filterTags: [], groupBy: "date", sortBy: "recent" }))}
            onCreateLead={handleAddLead}
            mobileView={mobileView}
            onMobileViewChange={setMobileView}
            accountsById={accountsById}
            campaignsById={campaignsById}
            isConversationsMode={mode === "conversations"}
            total={listData.total}
            groups={listData.groups}
            facets={listData.facets}
            hasMore={listData.hasMore}
            loadingMore={listData.loadingMore}
            onLoadMore={listData.loadMore}
            channelTab={channelTab}
            onChannelTabChange={setChannelTab}
            showChannelFilter={showChannelFilter}
            scopeSwitch={mode === "conversations" && chatScope.canDemo
              ? (compact, menu) => <ScopeSwitch scope={chatScope.scope} onScope={handleChatScope} canDemo canTest={false} compact={compact} menu={menu} />
              : undefined}
            pageTabs={mode === "conversations" ? <ChatsPageTabs active={chatsTab} onChange={setChatsTab} /> : undefined}
            mobilePageTabs={mode === "conversations" ? <ChatsPageTabs variant="mobile" active={chatsTab} onChange={setChatsTab} /> : undefined}
            chatChannelCounts={listData.chatChannelCounts}
            listFilters={{
              filterAccount: listFilterAccount, filterCampaign: listFilterCampaign, filterType: listFilterType,
              setFilterAccount: setListFilterAccount, setFilterCampaign: setListFilterCampaign,
              toggleFilterType: toggleListFilterType, clearFilterType: clearListFilterType,
            }}
          />
        </div>
      )}

      {viewMode === "table" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <LeadsTableTopbar
            total={tableData.total}
            viewTabs={viewTabs}
            viewMode={viewMode}
            onViewSwitch={handleViewSwitch}
            selectedCount={tableSelectedIds.size}
            onDuplicate={handleDuplicate}
            onBulkDelete={handleBulkDelete}
            onClearSelection={() => setTableSelectedIds(new Set())}
            deleteLabel={deleteLabel}
            search={tableSearch}
            onSearch={setTableSearch}
            filters={tableFilters}
            setFilter={setTableFilter}
            toggleIn={toggleTableFilter}
            clearFilters={clearTableFilters}
            isFilterActive={isTableFilterActive}
            accounts={accountOpts}
            campaigns={campaignOpts}
            services={facets?.services ?? []}
            sources={facets?.sources ?? []}
            allTags={allTags}
            sortBy={tableSortBy}
            setSortBy={(v) => setTablePrefs((p) => ({ ...p, sortBy: v }))}
            groupBy={tableGroupBy}
            setGroupBy={(v) => setTablePrefs((p) => ({ ...p, groupBy: v }))}
            groupDir={tableGroupDir}
            setGroupDir={setTableGroupDir}
            visibleCols={visibleCols}
            setVisibleCols={setVisibleCols}
            showVerticalLines={showVerticalLines}
            setShowVerticalLines={setShowVerticalLines}
            onImport={() => setImportWizardOpen(true)}
            onExport={handleExportTable}
            onResetColumnOrder={() => setColumnOrder([])}
            onResetColumnWidths={() => setColumnWidths({})}
            onAdd={handleAddLead}
            isAgency={!!isAgencyUser}
            quickControls={quickControls}
            viewFilter={viewFilter}
          />
          {quickFilters}
          <div className="flex-1 min-h-0 flex overflow-hidden" style={{ gap: "var(--panel-gap)", paddingRight: "var(--panel-gap)" }}>
            <div className="relative flex-1 min-w-0 overflow-hidden flex flex-col">
              <LeadsInlineTable
                flatItems={tableFlatItems}
                loading={tableData.loading}
                selectedLeadId={selectedLead ? (selectedLead.Id ?? selectedLead.id ?? null) : null}
                onSelectLead={setSelectedLead}
                onRefresh={handleRefresh}
                visibleCols={tableCols}
                tableSearch={tableSearch}
                selectedIds={tableSelectedIds}
                onSelectionChange={setTableSelectedIds}
                showVerticalLines={showVerticalLines}
                groupBy={tableGroupBy}
                columnOrder={columnOrder}
                onColumnOrderChange={setColumnOrder}
                columnWidths={columnWidths}
                onColumnWidthsChange={setColumnWidths}
                hasMore={tableData.hasMore}
                loadingMore={tableData.loadingMore}
                onLoadMore={tableData.loadMore}
              />
            </div>
            {/* CSV import: right-hand panel beside the table; takes the detail slot while open */}
            {importWizardOpen ? (
              <CsvImportWizard
                onClose={() => setImportWizardOpen(false)}
                onImportComplete={handleRefresh}
                defaultAccountId={filterAccountId}
                className="w-[640px] max-w-[55%]"
              />
            ) : selectedLead && tableSelectedIds.has(Number(selectedLead.Id ?? selectedLead.id)) && (
              <div className="shrink-0 overflow-hidden flex flex-col" style={sidePanelStyle}>
                <LeadDetailView
                  lead={selectedLead}
                  onClose={handleClosePanel}
                  leadTags={leadTagsInfo.get(getLeadIdHelper(selectedLead)) || []}
                  onRefresh={handleRefresh}
                  campaignsById={campaignsById}
                  mode={mode}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "pipeline" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <LeadsPipelineTopbar
            total={pipeData.total}
            showTabs
            viewTabs={viewTabs}
            viewMode={viewMode}
            onViewSwitch={handleViewSwitch}
            compactMode={compactMode}
            setCompactMode={(fn) => setCompactMode(fn(compactMode))}
            hasAnyCollapsed={hasAnyCollapsed}
            onFoldToggle={() => setFoldAction((prev) => ({ type: hasAnyCollapsed ? "expand-all" : "fold-empty", seq: prev.seq + 1 }))}
            search={kanbanSearch}
            onSearch={setKanbanSearch}
            hasPhone={pipePrefs.filterHasPhone}
            setHasPhone={(v) => setPipePrefs((p) => ({ ...p, filterHasPhone: v }))}
            hasEmail={pipePrefs.filterHasEmail}
            setHasEmail={(v) => setPipePrefs((p) => ({ ...p, filterHasEmail: v }))}
            sortBy={pipelineSortBy}
            setSortBy={(v) => setPipePrefs((p) => ({ ...p, sortBy: v }))}
            quickControls={quickControls}
            viewFilter={viewFilter}
          />
          {quickFilters}
          <div className="flex-1 min-h-0 flex overflow-hidden" style={{ gap: "var(--panel-gap)", paddingRight: "var(--panel-gap)" }}>
            <div className="flex-1 min-w-0 overflow-hidden p-[6px] pt-3">
              <LeadsKanban
                leads={viewMode === "pipeline" ? leads : []}
                loading={pipeData.loading}
                leadTagsMap={leadTagsInfo}
                onLeadMove={handleKanbanLeadMove}
                onCardClick={(l) => { setSelectedKanbanLead(l); setSelectedLead(l); }}
                selectedLeadId={selectedKanbanLead?.Id ?? selectedKanbanLead?.id}
                foldAction={foldAction}
                onCollapsedChange={setHasAnyCollapsed}
                showTagsAlways={false}
                compactMode={compactMode && !isPhone}
                receptionistOnly={receptionistOnly}
                stageCounts={Object.fromEntries(pipeData.groups.map((g) => [g.key, g.count]))}
                onLoadMoreStage={pipeData.loadMoreGroup}
              />
            </div>
            {selectedKanbanLead && (
              <div className="shrink-0 flex flex-col overflow-hidden" style={sidePanelStyle}>
                <PipelineLeadPanel lead={selectedKanbanLead} onRefresh={handleRefresh} onClose={() => setSelectedKanbanLead(null)} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
