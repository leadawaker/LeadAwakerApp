import { useRef, useMemo, useEffect, useCallback, useState } from "react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { Inbox, BellDot, UserSearch, Search, X, Plus, Mail, MessageCircle, MessageSquare, Linkedin, ArrowUpDown, Filter, Layers, Check, ArrowUp, ArrowDown, MoreVertical, Paintbrush, Radio } from "lucide-react";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import type {
  ChatGroupBy, ChatSortBy, GroupDirection, InboxTab,
  VirtualItem, InboxPanelProps, Thread, Lead, Interaction, ProspectThread,
} from "./inboxPanel/types";
import {
  PROSPECT_OUTREACH_STATUSES, STATUS_GROUP_ORDER, DATE_GROUP_ORDER,
  xBase, xDefault, xActive, xSpan, GROUP_LABELS, SORT_LABELS,
} from "./inboxPanel/constants";
import { getLeadTagNames, getLastMessageDisplay, getDateGroupLabel } from "./inboxPanel/helpers";
import { AgentInboxRow } from "./inboxPanel/AgentInboxRow";
import { ThreadList } from "./inboxPanel/ThreadList";
import {
  CompactTabPopover,
  CompactHoverCardPortal,
  useCompactHoverCard,
} from "@/components/crm/CompactEntityRail";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";

// Re-exports for backwards compat with Conversations.tsx and other consumers.
export type { ChatGroupBy, ChatSortBy, GroupDirection, InboxTab };
export { GROUP_LABELS, SORT_LABELS };
import {
  getStatus,
  getStatusAvatarColor,
  formatRelativeTime,
} from "../utils/conversationHelpers";
import { apiFetch } from "@/lib/apiUtils";
import { getInitials, getProspectAvatarColor } from "@/lib/avatarUtils";
import { useLocation } from "wouter";
import { SearchPill } from "@/components/ui/search-pill";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useChatDoodle, type ChatBgStyle } from "@/hooks/useChatDoodle";
import { CURATED_PATTERNS } from "@/components/ui/doodle-patterns";
import { BUBBLE_WIDTH_KEY, DEFAULT_BUBBLE_WIDTH } from "./chatView/constants";
import {
  PIPELINE_STATUSES,
  PIPELINE_HEX,
} from "../utils/conversationHelpers";
import { UncontactedProspectPicker } from "./UncontactedProspectPicker";


// ── Component ──────────────────────────────────────────────────────────────────
export function InboxPanel({
  threads,
  loading,
  selectedLeadId,
  scrollToLeadId,
  onSelectLead,
  tab,
  onTabChange,
  searchQuery,
  groupBy,
  sortBy,
  filterStatus,
  selectedCampaignId,
  selectedAccountId,
  isAgencyUser = false,
  onClearAll,
  className,
  onRefresh,
  onSearchChange,
  aiAgents = [],
  selectedAgentId,
  onSelectAgent,
  onSelectAgentChat,
  activeAgentSessionId,
  onAgentSettings,
  onDeselectAgent,
  campaignsMap,
  prospectThreads = [],
  selectedProspectId,
  onSelectProspect,
  clientAccounts = [],
  allCampaigns = [],
  onSetGroupBy,
  groupDirection = "asc",
  onSetGroupDirection,
  onSetSortBy,
  onToggleFilterStatus,
  onSetFilterAccountId,
  onSetCampaignId,
  searchOpen: searchOpenProp = true,
  onSearchOpenChange,
  filterOpen: filterOpenProp = false,
  onFilterOpenChange,
  listPanelState = "full",
}: InboxPanelProps) {
  const { t } = useTranslation("conversations");

  // Chat customization state (shared with ChatPanelMain via localStorage + custom events)
  const { config: doodleConfig, setConfig: setDoodleConfig } = useChatDoodle();
  const [bubbleWidth, setBubbleWidthState] = useState<number>(() => {
    const stored = localStorage.getItem(BUBBLE_WIDTH_KEY);
    const parsed = stored !== null ? parseInt(stored, 10) : NaN;
    return isNaN(parsed) ? DEFAULT_BUBBLE_WIDTH : Math.min(90, Math.max(40, parsed));
  });
  useEffect(() => {
    const readBubbleWidth = () => {
      const stored = localStorage.getItem(BUBBLE_WIDTH_KEY);
      const parsed = stored !== null ? parseInt(stored, 10) : NaN;
      if (!isNaN(parsed)) setBubbleWidthState(Math.min(90, Math.max(40, parsed)));
    };
    window.addEventListener("bubble-width-change", readBubbleWidth);
    return () => window.removeEventListener("bubble-width-change", readBubbleWidth);
  }, []);
  const setBubbleWidth = useCallback((val: number) => {
    const clamped = Math.min(90, Math.max(40, val));
    localStorage.setItem(BUBBLE_WIDTH_KEY, String(clamped));
    setBubbleWidthState(clamped);
    window.dispatchEvent(new Event("bubble-width-change"));
  }, []);

  const isCompact = listPanelState === "compact";

  // Compact hover card state (for both Inbox and Prospects tabs).
  const compactListRef = useRef<HTMLDivElement>(null);
  const findCompactEl = useCallback(
    (id: string | number) =>
      compactListRef.current?.querySelector(`[data-compact-id="${id}"]`) as HTMLElement | null,
    [],
  );
  const {
    hovered: hoveredItem,
    rect: hoveredRect,
    onHover: handleCompactHover,
    onHoverEnd: handleCompactHoverEnd,
    cancelHoverEnd: cancelHoveredEnd,
    close: closeHovered,
  } = useCompactHoverCard<{ kind: "thread" | "prospect"; data: any; id: number }>((i) => i.id, findCompactEl);

  // Toolbar: derived state
  const isGroupNonDefault = groupBy !== "date";
  const isSortNonDefault = sortBy !== "newest";
  const filterActive =
    filterOpenProp ||
    filterStatus.length > 0 ||
    selectedCampaignId !== "all" ||
    (isAgencyUser && selectedAccountId !== "all");

  // Prospects tab state
  const [prospectSearch, setProspectSearch] = useState("");
  const [prospectSearchOpen, setProspectSearchOpen] = useState(false);
  const [prospectGroupBy, setProspectGroupBy] = useState<"date" | "status" | "none">("date");
  const [prospectSortBy, setProspectSortBy] = useState<"newest" | "oldest" | "name_asc" | "name_desc">("newest");
  const [prospectFilterStatus, setProspectFilterStatus] = useState<string[]>([]);
  const [prospectFilterChannels, setProspectFilterChannels] = useState<string[]>([]);
  const [prospectPickerOpen, setProspectPickerOpen] = useState(false);
  const [, navigate] = useLocation();

  // Filter prospects by search query + status filter
  const filteredProspects = useMemo(() => {
    let result = prospectThreads;
    if (prospectFilterStatus.length > 0) {
      result = result.filter((pt) => prospectFilterStatus.includes(pt.outreach_status || "new"));
    }
    if (prospectFilterChannels.length > 0) {
      result = result.filter((pt) => {
        const ptChannels = (pt.channels || []).map((c) => c.toLowerCase());
        return prospectFilterChannels.some((fc) => {
          if (fc === "whatsapp") return ptChannels.some((c) => c === "whatsapp" || c === "whatsapp_cloud");
          return ptChannels.includes(fc);
        });
      });
    }
    if (prospectSearch.trim()) {
      const q = prospectSearch.trim().toLowerCase();
      result = result.filter((pt) => {
        const haystack = [pt.company, pt.contact_name, pt.contact_email, pt.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    // Sort
    result = [...result].sort((a, b) => {
      if (prospectSortBy === "newest") return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
      if (prospectSortBy === "oldest") return new Date(a.last_message_at || 0).getTime() - new Date(b.last_message_at || 0).getTime();
      if (prospectSortBy === "name_asc") return (a.company || a.name || "").localeCompare(b.company || b.name || "");
      return (b.company || b.name || "").localeCompare(a.company || a.name || "");
    });
    return result;
  }, [prospectThreads, prospectSearch, prospectFilterStatus, prospectFilterChannels, prospectSortBy]);

  // Group prospects by date or status
  const groupedProspects = useMemo(() => {
    if (prospectGroupBy === "none") {
      return [{ label: "All", threads: filteredProspects }];
    }

    const groups: { label: string; threads: ProspectThread[] }[] = [];
    const groupMap = new Map<string, ProspectThread[]>();

    for (const pt of filteredProspects) {
      const label = prospectGroupBy === "status"
        ? (pt.outreach_status || "new").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : getDateGroupLabel(pt.last_message_at);
      if (!groupMap.has(label)) groupMap.set(label, []);
      groupMap.get(label)!.push(pt);
    }

    if (prospectGroupBy === "date") {
      const dateOrder = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "No Activity"];
      for (const label of dateOrder) {
        const threads = groupMap.get(label);
        if (threads && threads.length > 0) groups.push({ label, threads });
      }
    } else {
      for (const [label, threads] of groupMap) {
        groups.push({ label, threads });
      }
    }

    return groups;
  }, [filteredProspects, prospectGroupBy]);

  const prospectsPagePath = isAgencyUser ? "/agency/prospects" : "/subaccount/prospects";

  const hasNonDefaultControls =
    groupBy !== "date" ||
    sortBy !== "newest" ||
    filterStatus.length > 0 ||
    selectedCampaignId !== "all" ||
    (isAgencyUser && selectedAccountId !== "all");

  // When in "unread" tab, show only threads the hook marked as unread
  const tabFiltered =
    tab === "unread"
      ? threads.filter((t) => t.unread)
      : threads;

  // Apply local status filter
  const statusFiltered = useMemo(() => {
    if (filterStatus.length === 0) return tabFiltered;
    return tabFiltered.filter((t) => filterStatus.includes(getStatus(t.lead)));
  }, [tabFiltered, filterStatus]);

  // Apply local sort
  const sorted = useMemo(() => {
    return [...statusFiltered].sort((a, b) => {
      switch (sortBy) {
        case "oldest": {
          const aT = a.last?.created_at ?? a.last?.createdAt ?? "";
          const bT = b.last?.created_at ?? b.last?.createdAt ?? "";
          return aT.localeCompare(bT);
        }
        case "name_asc": {
          const aName = a.lead.full_name || `${a.lead.first_name ?? ""} ${a.lead.last_name ?? ""}`;
          const bName = b.lead.full_name || `${b.lead.first_name ?? ""} ${b.lead.last_name ?? ""}`;
          return aName.localeCompare(bName);
        }
        case "name_desc": {
          const aName = a.lead.full_name || `${a.lead.first_name ?? ""} ${a.lead.last_name ?? ""}`;
          const bName = b.lead.full_name || `${b.lead.first_name ?? ""} ${b.lead.last_name ?? ""}`;
          return bName.localeCompare(aName);
        }
        case "status_asc":
        case "status_desc": {
          const aStatus = getStatus(a.lead) || "Unknown";
          const bStatus = getStatus(b.lead) || "Unknown";
          // Lost and DND always last regardless of direction
          const aPinned = aStatus === "Lost" || aStatus === "DND";
          const bPinned = bStatus === "Lost" || bStatus === "DND";
          if (aPinned && !bPinned) return 1;
          if (!aPinned && bPinned) return -1;
          const aIdx = STATUS_GROUP_ORDER.indexOf(aStatus);
          const bIdx = STATUS_GROUP_ORDER.indexOf(bStatus);
          const aVal = aIdx === -1 ? 999 : aIdx;
          const bVal = bIdx === -1 ? 999 : bIdx;
          return sortBy === "status_asc" ? aVal - bVal : bVal - aVal;
        }
        default: {
          const aT = a.last?.created_at ?? a.last?.createdAt ?? "";
          const bT = b.last?.created_at ?? b.last?.createdAt ?? "";
          return bT.localeCompare(aT);
        }
      }
    });
  }, [statusFiltered, sortBy]);

  // Build virtualised item list with group headers
  const virtualItems = useMemo((): VirtualItem[] => {
    if (sorted.length === 0) return [];

    if (groupBy === "none") {
      return sorted.map((t) => ({ type: "thread" as const, thread: t }));
    }

    const buckets = new Map<string, Thread[]>();
    for (const t of sorted) {
      let key: string;
      switch (groupBy) {
        case "date":
          key = getDateGroupLabel(t.last?.created_at ?? t.last?.createdAt);
          break;
        case "status":
          key = getStatus(t.lead) || "Unknown";
          break;
        case "campaign": {
          const cId = Number(t.lead.campaigns_id ?? t.lead.campaign_id ?? t.lead.Campaigns_id ?? 0);
          key = t.lead.Campaign ?? t.lead.campaign_name ?? t.lead.campaign
            ?? (cId && campaignsMap?.get(cId))
            ?? "No Campaign";
          break;
        }
        default:
          key = "Unknown";
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(t);
    }

    // Order bucket keys
    let orderedKeys: string[];
    if (groupBy === "date") {
      orderedKeys = DATE_GROUP_ORDER.filter((k) => buckets.has(k));
    } else if (groupBy === "status") {
      orderedKeys = STATUS_GROUP_ORDER.filter((k) => buckets.has(k)).concat(
        Array.from(buckets.keys()).filter((k) => !STATUS_GROUP_ORDER.includes(k))
      );
    } else {
      orderedKeys = Array.from(buckets.keys()).sort();
    }

    // Reverse if descending
    if (groupDirection === "desc") {
      orderedKeys = orderedKeys.slice().reverse();
    }

    const items: VirtualItem[] = [];
    for (const key of orderedKeys) {
      const group = buckets.get(key);
      if (!group?.length) continue;
      items.push({ type: "header", label: key, count: group.length });
      for (const t of group) {
        items.push({ type: "thread", thread: t });
      }
    }
    return items;
  }, [sorted, groupBy, groupDirection]);

  const listContainerRef = useRef<HTMLDivElement>(null);

  // ── Pull-to-refresh (mobile) ─────────────────────────────────────────────
  const { pullDistance: convoPullDistance, isRefreshing: convoIsRefreshing } = usePullToRefresh({
    containerRef: listContainerRef,
    onRefresh: async () => { onRefresh?.(); },
  });

  const threadVirtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: (i) => (virtualItems[i]?.type === "header" ? 38 : 95),
    overscan: 5,
  });

  // Scroll to selected lead once on initial load (when threads arrive from the API).
  // Does NOT scroll again on user card clicks.
  // Uses two rAFs: first lets React commit the new virtualizer count, second lets
  // the virtualizer measure and compute item offsets before scrollToIndex is called.
  const hasScrolledRef = useRef(false);
  const virtualizerRef = useRef(threadVirtualizer);
  virtualizerRef.current = threadVirtualizer;

  // Returns the pixel offset for a virtualizer index, accounting for the group header above it.
  const getScrollTopForIdx = useCallback((idx: number): number => {
    const cache = (virtualizerRef.current as any).measurementsCache as Array<{ start: number }> | undefined;
    let itemStart: number;
    if (cache && cache[idx]) {
      itemStart = cache[idx].start;
    } else {
      // Fallback: estimate from item sizes
      let offset = 0;
      for (let i = 0; i < idx; i++) {
        offset += virtualItems[i]?.type === "header" ? 35 : 91;
      }
      itemStart = offset;
    }
    // Subtract the preceding group header height so the card sits just below it
    let headerHeight = 0;
    for (let i = idx - 1; i >= 0; i--) {
      if (virtualItems[i]?.type === "header") {
        const hCache = cache && cache[i];
        headerHeight = hCache ? (cache![i + 1]!.start - hCache.start) : 35;
        break;
      }
    }
    return itemStart - headerHeight;
  }, [virtualItems]);

  // Initial load: scroll to the stored lead ID once data arrives
  useEffect(() => {
    const targetId = scrollToLeadId ?? null;
    if (targetId == null) return;
    if (hasScrolledRef.current) return;

    const idx = virtualItems.findIndex(
      (item) => item.type === "thread" && item.thread.lead.id === targetId
    );
    if (idx === -1) return;

    hasScrolledRef.current = true;
    window.setTimeout(() => {
      const container = listContainerRef.current;
      if (!container) return;
      container.scrollTop = getScrollTopForIdx(idx);
    }, 300);
  }, [scrollToLeadId, virtualItems, getScrollTopForIdx]);

  // On card selection: smooth-scroll the newly selected thread to the top.
  // Uses setTimeout (no cleanup) so re-renders don't cancel the scroll mid-flight.
  const prevScrolledIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (selectedLeadId == null) return;
    if (prevScrolledIdRef.current === null) { prevScrolledIdRef.current = selectedLeadId; return; }
    if (prevScrolledIdRef.current === selectedLeadId) return;
    prevScrolledIdRef.current = selectedLeadId;

    const capturedId = selectedLeadId;
    const capturedItems = virtualItems;
    window.setTimeout(() => {
      const idx = capturedItems.findIndex(
        (item) => item.type === "thread" && item.thread.lead.id === capturedId
      );
      if (idx === -1) return;
      const container = listContainerRef.current;
      if (!container) return;
      container.scrollTo({ top: getScrollTopForIdx(idx), behavior: "smooth" });
    }, 0);
  }, [selectedLeadId, virtualItems, getScrollTopForIdx]);

  // F shortcut: scroll selected thread into view (virtualizer-aware).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (active as HTMLElement | null)?.isContentEditable) return;
      if (selectedLeadId == null) return;
      const idx = virtualItems.findIndex((i) => i.type === "thread" && i.thread.lead.id === selectedLeadId);
      if (idx === -1) return;
      const container = listContainerRef.current;
      if (!container) return;
      e.preventDefault();
      if (active instanceof HTMLElement && active !== document.body) active.blur();
      container.scrollTo({ top: getScrollTopForIdx(idx), behavior: "smooth" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedLeadId, virtualItems, getScrollTopForIdx]);

  // Sticky group header — tracks the active group label as the user scrolls
  const [activeGroupLabel, setActiveGroupLabel] = useState<{ label: string; count: number } | null>(null);

  const updateStickyHeader = useCallback(() => {
    if (groupBy === "none") { setActiveGroupLabel(null); return; }
    const container = listContainerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;

    // Use virtualizer's offset cache (available for all items, not just rendered ones).
    // threadVirtualizer.measurementsCache[i].start gives the absolute top of each item.
    const cache = (threadVirtualizer as any).measurementsCache as Array<{ start: number; end: number }> | undefined;

    let activeLabel = "";
    let activeCount = 0;

    if (cache && cache.length === virtualItems.length) {
      // Fast path: use the measurements cache — available for all items regardless of render window
      for (let i = 0; i < virtualItems.length; i++) {
        const item = virtualItems[i];
        if (item.type !== "header") continue;
        const start = cache[i]?.start ?? 0;
        if (start <= scrollTop + 1) {
          activeLabel = item.label;
          activeCount = item.count;
        }
      }
    } else {
      // Fallback: DOM query — read positions directly from rendered header spacer elements
      const headerEls = container.querySelectorAll<HTMLElement>("[data-group-label]");
      headerEls.forEach((el) => {
        const elTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top + scrollTop;
        if (elTop <= scrollTop + 1) {
          const label = el.dataset.groupLabel ?? "";
          const count = parseInt(el.dataset.groupCount ?? "0", 10);
          if (label) { activeLabel = label; activeCount = count; }
        }
      });
    }

    // Fallback: use first header if none found above scroll
    if (!activeLabel) {
      const first = virtualItems.find((i) => i.type === "header");
      if (first?.type === "header") { activeLabel = first.label; activeCount = first.count; }
    }

    setActiveGroupLabel(activeLabel ? { label: activeLabel, count: activeCount } : null);
  }, [groupBy, virtualItems, threadVirtualizer]);

  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;
    updateStickyHeader();
    container.addEventListener("scroll", updateStickyHeader, { passive: true });
    return () => container.removeEventListener("scroll", updateStickyHeader);
  }, [updateStickyHeader]);

  const totalUnread = threads.filter((t) => t.unread).length;

  const prospectUnread = prospectThreads?.reduce((sum, t) => sum + t.unread_count, 0) || 0;

  const INBOX_TABS: TabDef[] = [
    { id: "all", label: "Inbox", icon: Inbox },
    {
      id: "unread",
      label: "Unread",
      icon: BellDot,
      badge: totalUnread > 0 ? (
        <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold leading-none">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      ) : undefined,
    },
    ...(isAgencyUser ? [{
      id: "prospects" as const,
      label: "Prospects",
      icon: UserSearch,
      badge: prospectUnread > 0 ? (
        <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold leading-none">
          {prospectUnread > 99 ? "99+" : prospectUnread}
        </span>
      ) : undefined,
    }] : []),
  ];

  return (
    <section
      className={cn(
        "flex flex-col bg-muted rounded-lg overflow-hidden h-full",
        className,
      )}
      data-testid="panel-inbox"
      data-onboarding="conversations-inbox"
    >
      {isCompact && (
        <>
          <CompactTabPopover
            tabs={INBOX_TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
            activeId={tab}
            onChange={(id) => onTabChange(id as InboxTab)}
          />
          <div className="flex flex-col items-center gap-1 px-1.5 pb-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
                    (filterActive || isSortNonDefault || isGroupNonDefault || searchQuery)
                      ? "bg-brand-indigo/10 text-brand-indigo"
                      : "text-foreground/50 hover:text-foreground hover:bg-black/[0.04]"
                  )}
                  title="More"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-56 max-h-[500px] overflow-y-auto">
                {/* Inline search */}
                {onSearchChange && (
                  <>
                    <div className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className={cn(
                        "flex items-center h-8 px-2.5 gap-1.5 rounded-full border",
                        searchQuery ? "border-brand-indigo/40 bg-brand-indigo/5" : "border-black/[0.08] bg-muted/40"
                      )}>
                        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <input
                          value={tab === "prospects" ? prospectSearch : searchQuery}
                          onChange={(e) => {
                            if (tab === "prospects") setProspectSearch(e.target.value);
                            else onSearchChange(e.target.value);
                          }}
                          placeholder="Search…"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              if (tab === "prospects") setProspectSearch("");
                              else onSearchChange("");
                            }
                          }}
                          className="flex-1 min-w-0 bg-transparent outline-none text-[12px] text-foreground placeholder:text-muted-foreground/60"
                        />
                        {((tab === "prospects" ? prospectSearch : searchQuery)) && (
                          <button type="button" onClick={() => {
                            if (tab === "prospects") setProspectSearch("");
                            else onSearchChange("");
                          }} className="shrink-0 text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Filter: status */}
                {tab !== "prospects" && onToggleFilterStatus && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                      <Filter className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">Filter</span>
                      {filterActive && (
                        <span className="h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                          {filterStatus.length}
                        </span>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48 max-h-[400px] overflow-y-auto">
                      {PIPELINE_STATUSES.map((s) => (
                        <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                          <span className="flex-1">{s}</span>
                          {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}

                {/* Sort */}
                {tab !== "prospects" && onSetSortBy && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                      <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                      <span className={cn("flex-1", isSortNonDefault && "text-brand-indigo font-semibold")}>Sort</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {(Object.keys(SORT_LABELS) as ChatSortBy[]).map((s) => (
                        <DropdownMenuItem key={s} onClick={() => onSetSortBy(s)} className={cn("text-[12px]", sortBy === s && "font-semibold text-brand-indigo")}>
                          {SORT_LABELS[s]}
                          {sortBy === s && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}

                {/* Group */}
                {tab !== "prospects" && onSetGroupBy && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
                      <Layers className="h-3.5 w-3.5 shrink-0" />
                      <span className={cn("flex-1", isGroupNonDefault && "text-brand-indigo font-semibold")}>Group</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {(Object.keys(GROUP_LABELS) as ChatGroupBy[]).map((g) => (
                        <DropdownMenuItem key={g} onClick={() => onSetGroupBy(g)} className={cn("text-[12px]", groupBy === g && "font-semibold text-brand-indigo")}>
                          {GROUP_LABELS[g]}
                          {groupBy === g && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}

                {/* Prospects: + New chat */}
                {tab === "prospects" && (
                  <DropdownMenuItem onClick={() => setProspectPickerOpen(true)} className="flex items-center gap-2 text-[12px]">
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>New chat</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div ref={compactListRef} className="flex-1 overflow-y-auto p-[3px]">
            {tab !== "prospects" ? (
              // Inbox / Unread: show thread avatars
              loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                </div>
              ) : sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-2">
                  <Inbox className="h-5 w-5 text-muted-foreground/40" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0">
                  {sorted.map((thread) => {
                    const { lead } = thread;
                    const active = selectedLeadId === lead.id;
                    const status = getStatus(lead);
                    const avatarColor = getStatusAvatarColor(status);
                    const name = `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "?";
                    return (
                      <div
                        key={lead.id}
                        data-compact-id={lead.id}
                        className="flex items-center justify-center py-1 mx-1 cursor-pointer"
                        onClick={() => onSelectLead(lead.id)}
                        onMouseEnter={(e) => handleCompactHover(
                          { kind: "thread", data: thread, id: lead.id },
                          (e.currentTarget as HTMLElement).getBoundingClientRect(),
                        )}
                        onMouseLeave={handleCompactHoverEnd}
                      >
                        <div
                          className="relative rounded-full"
                          style={active ? { boxShadow: "0 0 0 3px #ffffff, 0 0 0 4px rgba(0,0,0,0.9)" } : undefined}
                        >
                          <EntityAvatar
                            name={name}
                            bgColor={avatarColor.bg}
                            textColor={avatarColor.text}
                            size={40}
                          />
                          {thread.unread && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-[#FCB803] text-[#131B49] text-[8px] font-bold flex items-center justify-center px-0.5 shadow-[0_0_0_2px_var(--color-muted)]">
                              {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              // Prospects tab: show prospect avatars
              filteredProspects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-2">
                  <UserSearch className="h-5 w-5 text-muted-foreground/40" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0">
                  {filteredProspects.map((pt) => {
                    const active = selectedProspectId === pt.prospect_id;
                    const displayName = pt.company || pt.name || "Unknown";
                    const avatarColor = getProspectAvatarColor(pt.outreach_status);
                    const isDealClosed = pt.outreach_status === "deal_closed";
                    return (
                      <div
                        key={pt.prospect_id}
                        data-compact-id={pt.prospect_id}
                        className="flex items-center justify-center py-1 mx-1 cursor-pointer"
                        onClick={() => onSelectProspect?.(pt.prospect_id)}
                        onMouseEnter={(e) => handleCompactHover(
                          { kind: "prospect", data: pt, id: pt.prospect_id },
                          (e.currentTarget as HTMLElement).getBoundingClientRect(),
                        )}
                        onMouseLeave={handleCompactHoverEnd}
                      >
                        <div
                          className="relative rounded-full"
                          style={active ? { boxShadow: "0 0 0 3px #ffffff, 0 0 0 4px rgba(0,0,0,0.9)" } : undefined}
                        >
                          <EntityAvatar
                            name={displayName}
                            bgColor={isDealClosed ? "#1a1a1a" : avatarColor.bg}
                            textColor={isDealClosed ? "#ffffff" : avatarColor.text}
                            size={40}
                          />
                          {pt.unread_count > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-[#FCB803] text-[#131B49] text-[8px] font-bold flex items-center justify-center px-0.5 shadow-[0_0_0_2px_var(--color-muted)]">
                              {pt.unread_count > 9 ? "9+" : pt.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Hover card overlay */}
          {hoveredItem && (
            <CompactHoverCardPortal
              rect={hoveredRect}
              onMouseEnter={cancelHoveredEnd}
              onMouseLeave={handleCompactHoverEnd}
            >
              {hoveredItem.kind === "thread" ? (() => {
                const thread = hoveredItem.data;
                const { lead, last } = thread;
                const status = getStatus(lead);
                const avatarColor = getStatusAvatarColor(status);
                const lastContent = getLastMessageDisplay(last);
                const displayName = lead.full_name || `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Unknown";
                return (
                  <div
                    onClick={() => { onSelectLead(lead.id); closeHovered(); }}
                    className="p-3 cursor-pointer bg-card hover:bg-card-hover min-w-[280px]"
                  >
                    <div className="flex items-start gap-2.5">
                      <EntityAvatar name={displayName} bgColor={avatarColor.bg} textColor={avatarColor.text} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-foreground truncate">{displayName}</p>
                        {status && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: avatarColor.bg }} />
                            {status}
                          </p>
                        )}
                        {lastContent && (
                          <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">{lastContent}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })() : (() => {
                const pt = hoveredItem.data;
                const displayName = pt.company || pt.name || "Unknown";
                const avatarColor = getProspectAvatarColor(pt.outreach_status);
                return (
                  <div
                    onClick={() => { onSelectProspect?.(pt.prospect_id); closeHovered(); }}
                    className="p-3 cursor-pointer bg-card hover:bg-card-hover min-w-[280px]"
                  >
                    <div className="flex items-start gap-2.5">
                      <EntityAvatar name={displayName} bgColor={avatarColor.bg} textColor={avatarColor.text} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-foreground truncate">{displayName}</p>
                        {pt.contact_name && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{pt.contact_name}</p>
                        )}
                        {pt.last_message && (
                          <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">{pt.last_message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CompactHoverCardPortal>
          )}
        </>
      )}

      {!isCompact && <>
      {/* ── Header: title + Inbox/Unread tabs on same row ── */}
      <div className="pl-[17px] pr-[17px] pt-3 md:pt-10 pb-3 shrink-0 flex items-center" data-testid="panel-inbox-head">
        <div className="flex items-center justify-between w-full md:w-[306px] shrink-0">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">Chats</h2>
          <ViewTabBar
            tabs={INBOX_TABS}
            activeId={tab}
            onTabChange={(id) => onTabChange(id as InboxTab)}
            variant="segment"
          />
        </div>
      </div>

      {/* ── List toolbar: search + sort + filter + group ── */}
      {tab !== "prospects" && onSearchChange && onSetGroupBy && onSetSortBy && onToggleFilterStatus && (
        <div className="pl-2 pr-[17px] pb-2 flex items-center gap-1 shrink-0">
          <SearchPill
            value={searchQuery}
            onChange={onSearchChange}
            open={searchOpenProp}
            onOpenChange={onSearchOpenChange ?? (() => {})}
            placeholder="Search conversations…"
            className="ml-[9px] max-w-[149px]"
          />

          {/* Filter */}
          <DropdownMenu open={filterOpenProp} onOpenChange={onFilterOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[100px]", filterActive ? xActive : xDefault)}
                aria-label="Filter"
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Filter</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {/* Status */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-[12px]">
                  Status
                  {filterStatus.length > 0 && (
                    <span className="ml-auto text-[10px] text-brand-indigo font-medium">{filterStatus.length}</span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48 max-h-60 overflow-y-auto">
                  {PIPELINE_STATUSES.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }}
                      className="flex items-center gap-2 text-[12px]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PIPELINE_HEX[s] ?? "#6B7280" }} />
                      <span className="flex-1">{s}</span>
                      {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Account → Campaign drill-down (agency users only) */}
              {isAgencyUser && clientAccounts.length > 0 && onSetFilterAccountId && onSetCampaignId && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">
                    Account
                    {selectedAccountId !== "all" && (
                      <span className="ml-auto text-[10px] text-brand-indigo font-medium truncate max-w-[70px]">
                        {clientAccounts.find((a) => a.id === selectedAccountId)?.name ?? ""}
                      </span>
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48 max-h-60 overflow-y-auto">
                    <DropdownMenuItem
                      onClick={() => { onSetFilterAccountId("all"); onSetCampaignId("all"); }}
                      className={cn("text-[12px]", selectedAccountId === "all" && "font-semibold text-brand-indigo")}
                    >
                      All Accounts
                      {selectedAccountId === "all" && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                    {clientAccounts.map((account) => (
                      <DropdownMenuSub key={account.id}>
                        <DropdownMenuSubTrigger
                          className={cn("text-[12px]", selectedAccountId === account.id && "font-semibold text-brand-indigo")}
                          onClick={() => { onSetFilterAccountId(account.id); onSetCampaignId("all"); }}
                        >
                          {account.name}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-44 max-h-48 overflow-y-auto">
                          <DropdownMenuItem
                            onClick={() => { onSetFilterAccountId(account.id); onSetCampaignId("all"); }}
                            className={cn("text-[12px]", selectedAccountId === account.id && selectedCampaignId === "all" && "font-semibold text-brand-indigo")}
                          >
                            All Campaigns
                            {selectedAccountId === account.id && selectedCampaignId === "all" && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                          {allCampaigns
                            .filter((c) => c.account_id === account.id || c.accounts_id === account.id)
                            .map((c) => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={() => { onSetFilterAccountId(account.id); onSetCampaignId(c.id); }}
                                className={cn("text-[12px]", selectedAccountId === account.id && selectedCampaignId === c.id && "font-semibold text-brand-indigo")}
                              >
                                {c.name}
                                {selectedAccountId === account.id && selectedCampaignId === c.id && <Check className="h-3 w-3 ml-auto" />}
                              </DropdownMenuItem>
                            ))
                          }
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[80px]", isSortNonDefault ? xActive : xDefault)}
                aria-label="Sort"
              >
                <ArrowUpDown className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Sort</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {([
                { key: "recent", label: "Most Recent", asc: "oldest" as ChatSortBy, desc: "newest" as ChatSortBy },
                { key: "name", label: "Name", asc: "name_asc" as ChatSortBy, desc: "name_desc" as ChatSortBy },
                { key: "status", label: "Status", asc: "status_asc" as ChatSortBy, desc: "status_desc" as ChatSortBy },
              ]).map((group) => {
                const isActive = sortBy === group.asc || sortBy === group.desc;
                const activeDir: "asc" | "desc" = sortBy === group.asc ? "asc" : "desc";
                return (
                  <DropdownMenuItem
                    key={group.key}
                    onSelect={(e) => { e.preventDefault(); onSetSortBy?.(isActive ? sortBy : group.desc); }}
                    className="text-[12px] flex items-center gap-2"
                  >
                    <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>{group.label}</span>
                    {isActive && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetSortBy?.(group.asc); }}
                          className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                          title="Ascending"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetSortBy?.(group.desc); }}
                          className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                          title="Descending"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[90px]", isGroupNonDefault ? xActive : xDefault)}
                aria-label="Group"
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Group</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {(Object.keys(GROUP_LABELS) as ChatGroupBy[]).map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  onSelect={(e) => { e.preventDefault(); onSetGroupBy?.(opt); }}
                  className="text-[12px] flex items-center gap-2"
                >
                  <span className={cn("flex-1", groupBy === opt && "font-semibold !text-brand-indigo")}>{GROUP_LABELS[opt]}</span>
                  {groupBy === opt && opt !== "none" && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetGroupDirection?.("asc"); }}
                        className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                        title="Ascending"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetGroupDirection?.("desc"); }}
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

          {/* Customize */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[120px]", xDefault)}
                title={t("chat.customization.title")}
              >
                <MoreVertical className="h-4 w-4 shrink-0" />
                <span className={xSpan}>{t("chat.customization.title")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3 space-y-3">
              <span className="text-[13px] font-semibold">{t("chat.customization.title")}</span>

              {/* Chat bubble width slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{t("chat.customization.bubbleWidth")}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-foreground/70">{bubbleWidth}%</span>
                </div>
                <Slider
                  value={[bubbleWidth]}
                  onValueChange={([v]) => setBubbleWidth(v)}
                  min={40}
                  max={90}
                  step={1}
                />
              </div>

              {/* Hide avatars toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">{t("chat.customization.hideAvatars")}</span>
                <Switch
                  checked={doodleConfig.hideAvatars}
                  onCheckedChange={(hideAvatars) => setDoodleConfig({ hideAvatars })}
                />
              </div>

              {/* Background style picker */}
              <div className="space-y-1.5">
                <span className="text-[12px] font-semibold">{t("chat.background.title")}</span>
                <div className="grid grid-cols-5 gap-1">
                  {(["crm", "social1", "social2", "social3", "social4"] as ChatBgStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setDoodleConfig({ bgStyle: style })}
                      className={cn(
                        "h-8 rounded-md border text-[10px] font-medium transition-colors",
                        doodleConfig.bgStyle === style || (!doodleConfig.bgStyle && style === "social1")
                          ? "border-brand-indigo text-brand-indigo bg-brand-indigo/5"
                          : "border-black/[0.125] text-foreground/60 hover:text-foreground hover:border-black/[0.175]"
                      )}
                    >
                      {style === "crm" ? "CRM" : `#${style.replace("social", "")}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Doodle overlay toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">{t("chat.background.doodleOverlay")}</span>
                <Switch
                  checked={doodleConfig.enabled}
                  onCheckedChange={(enabled) => setDoodleConfig({ enabled })}
                />
              </div>
              {doodleConfig.enabled && (
                <>
                  {/* Pattern picker */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t("chat.background.pattern")}</span>
                      <span className="text-[11px] font-semibold tabular-nums text-foreground/70">
                        #{(CURATED_PATTERNS.findIndex(p => p.id === doodleConfig.patternId) + 1) || 1}
                      </span>
                    </div>
                    <Slider
                      value={[(CURATED_PATTERNS.findIndex(p => p.id === doodleConfig.patternId) + 1) || 1]}
                      onValueChange={([v]) => {
                        const entry = CURATED_PATTERNS[v - 1];
                        if (entry) setDoodleConfig({ patternId: entry.id, size: entry.size });
                      }}
                      min={1}
                      max={10}
                      step={1}
                    />
                  </div>
                  {/* Size slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t("chat.background.size")}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{doodleConfig.size}px</span>
                    </div>
                    <Slider
                      value={[doodleConfig.size]}
                      onValueChange={([v]) => setDoodleConfig({ size: v })}
                      min={200}
                      max={800}
                      step={25}
                    />
                  </div>
                  {/* Opacity slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t("chat.background.opacity")}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{doodleConfig.color}%</span>
                    </div>
                    <Slider
                      value={[doodleConfig.color]}
                      onValueChange={([v]) => setDoodleConfig({ color: v })}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                </>
              )}

              {/* Gradient tester button (embedded) */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("toggle-gradient-tester"))}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors border border-black/[0.08]"
              >
                <Paintbrush className="h-3.5 w-3.5" />
                {t("chat.background.gradientTester")}
              </button>
            </PopoverContent>
          </Popover>

        </div>
      )}

      {/* ── Prospects toolbar: search + sort + group + filter + customize + "+" ── */}
      {tab === "prospects" && (
        <div className="pl-2 pr-[17px] pb-2 flex items-center gap-1 shrink-0 flex-wrap">
          <SearchPill
            value={prospectSearch}
            onChange={setProspectSearch}
            open={prospectSearchOpen}
            onOpenChange={setProspectSearchOpen}
            placeholder="Search prospects…"
            className="ml-[9px] max-w-[149px]"
          />

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[80px]", prospectSortBy !== "newest" ? xActive : xDefault)}
                title="Sort"
              >
                <ArrowUpDown className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Sort</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {(["newest", "oldest", "name_asc", "name_desc"] as const).map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  onClick={() => setProspectSortBy(opt)}
                  className={cn("text-[12px]", prospectSortBy === opt && "font-semibold text-brand-indigo")}
                >
                  {{ newest: "Most Recent", oldest: "Oldest First", name_asc: "Name A → Z", name_desc: "Name Z → A" }[opt]}
                  {prospectSortBy === opt && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[90px]", prospectGroupBy !== "date" ? xActive : xDefault)}
                title="Group"
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Group</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {(["date", "status", "none"] as const).map((opt) => (
                <DropdownMenuItem
                  key={opt}
                  onClick={() => setProspectGroupBy(opt)}
                  className={cn("text-[12px]", prospectGroupBy === opt && "font-semibold text-brand-indigo")}
                >
                  {{ date: "Date", status: "Status", none: "None" }[opt]}
                  {prospectGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter by outreach status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[100px]", prospectFilterStatus.length > 0 ? xActive : xDefault)}
                title="Filter"
              >
                <Filter className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Filter{prospectFilterStatus.length > 0 ? ` (${prospectFilterStatus.length})` : ""}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {PROSPECT_OUTREACH_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={(e) => {
                    e.preventDefault();
                    setProspectFilterStatus((prev) =>
                      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                    );
                  }}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <span className="flex-1 capitalize">{s.replace(/_/g, " ")}</span>
                  {prospectFilterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
              {prospectFilterStatus.length > 0 && (
                <DropdownMenuItem onClick={() => setProspectFilterStatus([])} className="text-[12px] text-muted-foreground border-t mt-1 pt-1">
                  Clear filters
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>


          {/* Channel filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(xBase, "hover:max-w-[110px]", prospectFilterChannels.length > 0 ? xActive : xDefault)}
                title="Channel"
              >
                <Radio className="h-4 w-4 shrink-0" />
                <span className={xSpan}>Channel{prospectFilterChannels.length > 0 ? ` (${prospectFilterChannels.length})` : ""}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {([
                { key: "email", label: "Email", Icon: Mail },
                { key: "whatsapp", label: "WhatsApp", Icon: MessageSquare },
                { key: "linkedin", label: "LinkedIn", Icon: Linkedin },
              ] as const).map(({ key, label, Icon }) => (
                <DropdownMenuItem
                  key={key}
                  onClick={(e) => {
                    e.preventDefault();
                    setProspectFilterChannels((prev) =>
                      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
                    );
                  }}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{label}</span>
                  {prospectFilterChannels.includes(key) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
              {prospectFilterChannels.length > 0 && (
                <DropdownMenuItem onClick={() => setProspectFilterChannels([])} className="text-[12px] text-muted-foreground border-t mt-1 pt-1">
                  Clear channels
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* "+" — new chat with uncontacted prospect */}
          <button
            className={cn(xBase, "hover:max-w-[100px]", xDefault)}
            onClick={() => setProspectPickerOpen(true)}
            aria-label="Start new chat"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className={xSpan}>New chat</span>
          </button>
        </div>
      )}

      <UncontactedProspectPicker
        open={prospectPickerOpen}
        onClose={() => setProspectPickerOpen(false)}
        onSelect={(prospectId) => { setProspectPickerOpen(false); onSelectProspect?.(prospectId); }}
        existingProspectIds={prospectThreads.map((p) => p.prospect_id)}
      />

      {/* ── Mobile search bar (hidden on desktop) ── */}
      {tab !== "prospects" && onSearchChange && (
        <div
          className="md:hidden px-3 pb-2 shrink-0"
          data-testid="mobile-inbox-search"
        >
          <div
            className={cn(
              "flex items-center gap-2 h-9 px-3 rounded-full border bg-background transition-colors",
              searchQuery
                ? "border-brand-indigo/50"
                : "border-black/[0.125]"
            )}
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search conversations…"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground/60"
              data-testid="mobile-inbox-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="shrink-0 p-0.5 rounded-full hover:bg-muted"
                data-testid="mobile-inbox-search-clear"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Prospects tab: prospect conversation list ── */}
      {tab === "prospects" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-[3px]">
            {filteredProspects.length === 0 ? (
              <DataEmptyState
                variant="conversations"
                title={prospectSearch ? "No matching prospects" : "No prospect conversations"}
                description={prospectSearch ? "Try a different search term." : "Prospect conversations will appear here when you start outreach."}
                compact
              />
            ) : (
              <div className="flex flex-col gap-[3px]">
                {groupedProspects.map((group) => (
                  <div key={group.label}>
                    {/* Date group header */}
                    <div className="px-3 py-2">
                      <div className="flex items-center gap-[10px]">
                        <div className="flex-1 h-px bg-foreground/15" />
                        <span className="text-[12px] font-bold text-foreground tracking-wide">{group.label}</span>
                        <span className="text-foreground/20">-</span>
                        <span className="text-[12px] font-medium text-muted-foreground tabular-nums">{group.threads.length}</span>
                        <div className="flex-1 h-px bg-foreground/15" />
                      </div>
                    </div>

                    {/* Prospect cards in this group */}
                    <div className="flex flex-col gap-[3px]">
                    {group.threads.map((pt) => {
                      const active = selectedProspectId === pt.prospect_id;
                      const displayName = pt.company || pt.name || "Unknown";
                      const avatarColor = getProspectAvatarColor(pt.outreach_status);
                      const isDealClosed = pt.outreach_status === "deal_closed";
                      const lastTs = pt.last_message_at;
                      const timeAgo = lastTs ? formatRelativeTime(lastTs) : "";

                      return (
                        <div
                          key={pt.prospect_id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectProspect?.(pt.prospect_id)}
                          onKeyDown={(e) => e.key === "Enter" && onSelectProspect?.(pt.prospect_id)}
                          className={cn(
                            "group relative rounded-xl cursor-pointer transition-colors",
                            active ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
                          )}
                          data-testid={`button-prospect-${pt.prospect_id}`}
                        >
                          <div className="px-2.5 pt-2.5 pb-2 flex flex-col gap-[3px]">
                            <div className="flex items-start gap-2">
                              {/* Avatar with status-based colors */}
                              <div className="relative shrink-0">
                                <EntityAvatar
                                  name={displayName}
                                  bgColor={isDealClosed ? "#1a1a1a" : avatarColor.bg}
                                  textColor={isDealClosed ? "#ffffff" : avatarColor.text}
                                  size={36}
                                  className="shrink-0"
                                />
                                {pt.unread_count > 0 && (
                                  <span
                                    className={cn(
                                      "absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-[#FCB803] text-[#131B49] text-[8px] font-bold flex items-center justify-center px-0.5",
                                      active ? "shadow-[0_0_0_2px_var(--color-highlight-selected)]" : "shadow-[0_0_0_2px_var(--color-card)]"
                                    )}
                                  >
                                    {pt.unread_count > 99 ? "99+" : pt.unread_count}
                                  </span>
                                )}
                              </div>

                              {/* Company + contact */}
                              <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[16px] font-semibold font-heading leading-tight truncate text-foreground flex-1 min-w-0">
                                    {displayName}
                                  </p>
                                  <span className="flex items-center gap-1 shrink-0">
                                    {pt.last_message_type === "email" ? (
                                      <Mail className="h-3 w-3 text-muted-foreground/50" />
                                    ) : pt.last_message_type === "whatsapp" ? (
                                      <MessageCircle className="h-3 w-3 text-muted-foreground/50" />
                                    ) : null}
                                    {timeAgo && (
                                      <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                                        {timeAgo}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                {pt.contact_name && (
                                  <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                                    {pt.contact_name}
                                  </p>
                                )}

                                {/* Last message preview: hidden by default, shown on hover */}
                                {pt.last_message && (
                                  <p className="hidden group-hover:block text-[13px] text-muted-foreground truncate leading-snug mt-1">
                                    <span className="truncate">{pt.last_message}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Thread list (all / unread tabs) ── */}
      <ThreadList
        tab={tab}
        loading={loading}
        sorted={sorted}
        searchQuery={searchQuery}
        hasNonDefaultControls={hasNonDefaultControls}
        onClearAll={onClearAll}
        groupBy={groupBy}
        activeGroupLabel={activeGroupLabel}
        listContainerRef={listContainerRef}
        convoPullDistance={convoPullDistance}
        convoIsRefreshing={convoIsRefreshing}
        threadVirtualizer={threadVirtualizer}
        virtualItems={virtualItems}
        selectedLeadId={selectedLeadId}
        onSelectLead={onSelectLead}
      />
      </>}
    </section>
  );
}


