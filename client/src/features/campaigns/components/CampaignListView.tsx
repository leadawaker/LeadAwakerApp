import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Megaphone,
  Filter,
  Check,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  LayoutDashboard,
  Settings2,
  Plus,
  Layers,
  EyeOff,
  PanelLeft,
  PanelLeftClose,
  FileText,
  FlaskConical,
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
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { CampaignDetailView, CampaignDetailViewEmpty } from "./CampaignDetailView";
import { MobileCampaignDetailPanel } from "./MobileCampaignDetailPanel";
import { MobileRecede } from "@/components/crm/mobile/MobileSheet";
import { MobileListHeader, MobileHeaderIconBtn } from "@/components/crm/mobile/MobileListHeader";
import { SkeletonCampaignPanel } from "@/components/ui/skeleton";
import { CAMPAIGN_STATUS_HEX } from "@/lib/avatarUtils";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { TabDef } from "@/components/ui/view-tab-bar";
import { Search } from "lucide-react";
import {
  useCompactPanelState,
  useCompactHoverCard,
  CompactHoverCardPortal,
} from "@/components/crm/CompactEntityRail";
import { CompactCampaignCard } from "./CompactCampaignCard";
import { CampaignListCard, GroupHeader, ListSkeleton, CompactListSkeleton } from "./CampaignListCard";
import { CampaignFilterSheet } from "./CampaignFilterSheet";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ShareButton } from "./detailView/atoms";
import {
  DETAIL_SORT_LABEL_KEYS,
  DETAIL_GROUP_LABEL_KEYS,
  DETAIL_STATUS_FILTER_OPTIONS,
  DETAIL_STATUS_HEX,
} from "./detailView/constants";
import type {
  CampaignDetailTab,
  CampaignGroupBy,
  CampaignSortBy,
} from "../pages/CampaignsPage";

// ── Helpers ──────────────────────────────────────────────────────────────────
function getCampaignId(c: Campaign): number {
  return c.id || (c as any).Id || 0;
}

function getLeadCount(c: Campaign): number {
  return Number(c.total_leads_targeted ?? (c as any).Leads ?? 0);
}

function getResponseRate(c: Campaign): number {
  return Number(c.response_rate_percent ?? 0);
}

const STATUS_GROUP_ORDER = ["Active", "Paused", "Completed", "Finished", "Draft", "Inactive", "Archived"];

// ── Detail tab definitions (keys resolved at render time via t()) ────────────
const DETAIL_TAB_DEFS = [
  { id: "summary",        labelKey: "tabs.summary",        icon: LayoutDashboard },
  { id: "configurations", labelKey: "tabs.configurations", icon: Settings2 },
];

// ── Virtual list item types ──────────────────────────────────────────────────
type VirtualListItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "campaign"; campaign: Campaign };

// ── Props ────────────────────────────────────────────────────────────────────
interface CampaignListViewProps {
  campaigns: Campaign[];
  metrics: CampaignMetricsHistory[];
  loading: boolean;
  selectedCampaign: Campaign | null;
  onSelectCampaign: (campaign: Campaign) => void;
  onEditCampaign: (campaign: Campaign) => void;
  onToggleStatus: (campaign: Campaign) => void;
  onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
  onCreateCampaign: () => void;
  onDuplicate?: (campaign: Campaign) => Promise<void>;
  // Detail tab (controls right panel content)
  detailTab: CampaignDetailTab;
  onDetailTabChange: (tab: CampaignDetailTab) => void;
  // Lifted controls
  listSearch: string;
  onListSearchChange: (v: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (v: boolean) => void;
  groupBy: CampaignGroupBy;
  onGroupByChange: (v: CampaignGroupBy) => void;
  groupDirection: "asc" | "desc";
  onGroupDirectionChange: (v: "asc" | "desc") => void;
  sortBy: CampaignSortBy;
  onSortByChange: (v: CampaignSortBy) => void;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  onFilterStatusSet?: (v: string[]) => void;
  filterAccount?: string;
  onFilterAccountChange?: (a: string) => void;
  availableAccounts?: string[];
  showDemoCampaigns?: boolean | null;
  onShowDemoCampaignsChange?: (v: boolean | null) => void;
  hasNonDefaultControls: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;
  onResetControls: () => void;
  onRefresh?: () => void;
  onDelete?: (id: number) => Promise<void>;
}

// ── Main component ──────────────────────────────────────────────────────────
export function CampaignListView({
  campaigns,
  metrics,
  loading,
  selectedCampaign,
  onSelectCampaign,
  onEditCampaign,
  onToggleStatus,
  onSave,
  onCreateCampaign,
  onDuplicate,
  detailTab,
  onDetailTabChange,
  listSearch,
  onListSearchChange,
  searchOpen,
  onSearchOpenChange,
  groupBy,
  onGroupByChange,
  groupDirection,
  onGroupDirectionChange,
  sortBy,
  onSortByChange,
  filterStatus,
  onToggleFilterStatus,
  onFilterStatusSet,
  filterAccount = "",
  onFilterAccountChange,
  availableAccounts = [],
  showDemoCampaigns = null,
  onShowDemoCampaignsChange,
  hasNonDefaultControls,
  isGroupNonDefault,
  isSortNonDefault,
  onResetControls,
  onRefresh,
  onDelete,
}: CampaignListViewProps) {
  const { t } = useTranslation("campaigns");
  const { isAgencyUser } = useWorkspace();
  const isMobile768 = useIsMobile(768);
  const isNarrow = useIsMobile(1024);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const DETAIL_TABS: TabDef[] = useMemo(() =>
    DETAIL_TAB_DEFS
      .filter((tab) => isAgencyUser || tab.id !== "configurations")
      .map((tab) => ({ ...tab, label: t(tab.labelKey) })),
  [t, isAgencyUser]);

  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const { state: leftPanelState, cycle } = useListPanelState();
  const [promptPanelOpen, setPromptPanelOpen] = useState(() => {
    try { return localStorage.getItem("campaigns-prompt-panel-open") === "true"; } catch { return false; }
  });
  const togglePromptPanel = useCallback(() => {
    setPromptPanelOpen(prev => {
      const next = !prev;
      try { localStorage.setItem("campaigns-prompt-panel-open", String(next)); } catch {}
      return next;
    });
  }, []);

  // Active filter state
  const isFilterActive = filterStatus.length > 0 || !!filterAccount;

  // Responsive toolbar collapse at < 1200px
  const [toolbarCollapsed, setToolbarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1200);
  useEffect(() => {
    const onResize = () => setToolbarCollapsed(window.innerWidth < 1200);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Build flat grouped list
  const flatItems = useMemo((): VirtualListItem[] => {
    // 1. Text search
    let filtered = campaigns;
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      filtered = filtered.filter((c) =>
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.description || "").toLowerCase().includes(q) ||
        String(c.account_name || "").toLowerCase().includes(q)
      );
    }

    // 2. Status filter
    if (filterStatus.length > 0) {
      filtered = filtered.filter((c) => {
        const s = String(c.status || "");
        return filterStatus.includes(s) || (filterStatus.includes("Completed") && s === "Finished");
      });
    }

    // 2b. Account filter
    if (filterAccount) {
      filtered = filtered.filter((c) => String(c.account_name || "") === filterAccount);
    }

    // 2c. Demo filter — null means show all; true = demos only; false = hide demos
    if (showDemoCampaigns !== null) {
      filtered = filtered.filter((c) => showDemoCampaigns ? c.is_demo : !c.is_demo);
    }

    // 3. Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":      return String(a.name || "").localeCompare(String(b.name || ""));
        case "name_desc":     return String(b.name || "").localeCompare(String(a.name || ""));
        case "leads_desc":    return getLeadCount(b) - getLeadCount(a);
        case "response_desc": return getResponseRate(b) - getResponseRate(a);
        default: { // recent
          const da = (a as any).updated_at || (a as any).nc_updated_at || (a as any).created_at || "";
          const db = (b as any).updated_at || (b as any).nc_updated_at || (b as any).created_at || "";
          return db.localeCompare(da);
        }
      }
    });

    // 4. Group
    if (groupBy === "none") {
      return filtered.map((c) => ({ kind: "campaign" as const, campaign: c }));
    }

    const buckets = new Map<string, Campaign[]>();
    filtered.forEach((c) => {
      let key: string;
      if (groupBy === "status") {
        const s = String(c.status || "");
        key = s === "Finished" ? "Completed" : s || "Unknown";
      } else if (groupBy === "account") {
        key = String(c.account_name || "No Account");
      } else {
        key = String(c.type || "No Type");
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(c);
    });

    // Order groups
    let orderedKeys: string[];
    if (groupBy === "status") {
      orderedKeys = STATUS_GROUP_ORDER.filter((k) => buckets.has(k))
        .concat(Array.from(buckets.keys()).filter((k) => !STATUS_GROUP_ORDER.includes(k)));
    } else {
      orderedKeys = Array.from(buckets.keys()).sort();
    }
    if (groupDirection === "desc") {
      orderedKeys = [...orderedKeys].reverse();
    }

    const result: VirtualListItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      const headerLabel = groupBy === "status" ? t(`statusLabels.${key}`, key) : key;
      result.push({ kind: "header", label: headerLabel, count: group.length });
      group.forEach((c) => result.push({ kind: "campaign", campaign: c }));
    });

    return result;
  }, [campaigns, listSearch, filterStatus, filterAccount, showDemoCampaigns, sortBy, groupBy, groupDirection]);

  // Paginate
  const totalCampaigns = flatItems.filter((i) => i.kind === "campaign").length;
  const maxPage = Math.max(0, Math.ceil(totalCampaigns / PAGE_SIZE) - 1);

  const paginatedItems = useMemo(() => {
    if (totalCampaigns <= PAGE_SIZE) return flatItems;

    let campaignCount = 0;
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const result: VirtualListItem[] = [];
    let currentHeader: VirtualListItem | null = null;
    let headerCount = 0;

    for (const item of flatItems) {
      if (item.kind === "header") {
        currentHeader = item;
        headerCount = 0;
        continue;
      }
      if (campaignCount >= start && campaignCount < end) {
        if (currentHeader && headerCount === 0) {
          result.push(currentHeader);
        }
        result.push(item);
        headerCount++;
      }
      campaignCount++;
      if (campaignCount >= end) break;
    }
    return result;
  }, [flatItems, currentPage, totalCampaigns]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(0); }, [listSearch, filterStatus, filterAccount, showDemoCampaigns, groupBy, sortBy]);

  // ── Responsive compact layout for right panel ─────────────────────────────
  // Right panel is flex-1. Compact (stacked) when < 700px wide.
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const [isDetailCompact, setIsDetailCompact] = useState(false);

  useEffect(() => {
    const el = rightPanelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setIsDetailCompact(entry.contentRect.width < 500);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compact list rail: auto-squeeze when main campaign panel is narrow, or user override.
  // Observer is attached to the main column inside CampaignDetailView (excludes prompt panel).
  const { ref: compactObserverRef, narrow: rightPanelNarrow } = useCompactPanelState(isNarrow, { activateBelow: 900, deactivateAbove: 1250 });
  const isListCompact = !isNarrow && (leftPanelState === "compact" || (leftPanelState === "full" && rightPanelNarrow));
  const isListHidden = !isNarrow && leftPanelState === "hidden";

  // Auto-select: handled by CampaignsPage — do NOT auto-select here (causes override)

  // ── Smooth scroll to selected card (§29) ────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Track which campaign IDs have been rendered before — only animate genuinely new cards
  const seenCardIds = useRef<Set<number>>(new Set());

  // Compact hover card state.
  const findCampaignEl = useCallback(
    (id: string | number) =>
      scrollContainerRef.current?.querySelector(`[data-campaign-id="${id}"]`) as HTMLElement | null,
    [],
  );
  const {
    hovered: hoveredCampaign,
    rect: hoveredRect,
    onHover: handleCompactHover,
    onHoverEnd: handleCompactHoverEnd,
    cancelHoverEnd: cancelHoveredEnd,
    close: closeHoveredCampaign,
  } = useCompactHoverCard<Campaign>((c) => getCampaignId(c), findCampaignEl);

  // ── Pull-to-refresh (mobile) ─────────────────────────────────────────────
  const { pullDistance, isRefreshing } = usePullToRefresh({
    containerRef: scrollContainerRef,
    onRefresh: async () => { onRefresh?.(); },
    enabled: isMobile768,
  });
  useEffect(() => {
    if (!selectedCampaign || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const run = () => {
      const id = getCampaignId(selectedCampaign);
      const el = container.querySelector(`[data-campaign-id="${id}"]`) as HTMLElement | null;
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
      container.scrollTo({ top: cardTop - headerHeight - 3, behavior: "smooth" });
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [selectedCampaign]);

  // F shortcut: scroll selected campaign into view, jumping pages if needed.
  useFKeyScrollToSelected({
    containerRef: scrollContainerRef,
    selectedId: selectedCampaign ? getCampaignId(selectedCampaign) : null,
    getSelector: (id) => `[data-campaign-id="${id}"]`,
    ensureLoaded: async (id) => {
      const campaignItems = flatItems.filter((i) => i.kind === "campaign");
      const idx = campaignItems.findIndex((i: any) => getCampaignId(i.campaign) === id);
      if (idx >= 0 && totalCampaigns > PAGE_SIZE) {
        const page = Math.floor(idx / PAGE_SIZE);
        if (page !== currentPage) setCurrentPage(page);
      }
    },
  });

  // Filter + sort menu bodies — shared between the desktop toolbar and the
  // mobile MobileListHeader so the two stay in sync.
  const filterMenuContent = (
    <DropdownMenuContent align="end" className="w-44 bg-white">
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="text-[12px]">
          <span className="flex-1">{t("filter.status")}</span>
          {filterStatus.length > 0 && <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center">{filterStatus.length}</span>}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-44 bg-white">
          {DETAIL_STATUS_FILTER_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: DETAIL_STATUS_HEX[s] || "var(--mute-2)" }} />
              <span className={cn("flex-1", filterStatus.includes(s) && "font-bold text-brand-indigo")}>{t(`statusLabels.${s}`, s)}</span>
              {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {availableAccounts.length > 0 && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-[12px]">
            <span className="flex-1">{t("filter.account", "Account")}</span>
            {filterAccount && <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center">1</span>}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44 bg-white">
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); onFilterAccountChange?.(""); }} className={cn("flex items-center gap-2 text-[12px]", !filterAccount && "font-bold text-brand-indigo")}>
              <span className="flex-1">{t("filter.allAccounts", "All accounts")}</span>
              {!filterAccount && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {availableAccounts.map((a) => (
              <DropdownMenuItem key={a} onClick={(e) => { e.preventDefault(); onFilterAccountChange?.(filterAccount === a ? "" : a); }} className={cn("flex items-center gap-2 text-[12px]", filterAccount === a && "font-bold text-brand-indigo")}>
                <span className="flex-1 truncate">{a}</span>
                {filterAccount === a && <Check className="h-3 w-3 ml-auto text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
      {onShowDemoCampaignsChange && (
        <DropdownMenuItem onClick={(e) => { e.preventDefault(); onShowDemoCampaignsChange(showDemoCampaigns === null ? true : showDemoCampaigns === true ? false : null); }} className="flex items-center gap-2 text-[12px]">
          <span className={cn("flex-1", showDemoCampaigns !== null && "text-brand-indigo font-semibold")}>
            {showDemoCampaigns === true ? "Demo only" : showDemoCampaigns === false ? "Hide demos" : t("config.showDemoCampaigns")}
          </span>
          {showDemoCampaigns === true && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
          {showDemoCampaigns === false && <EyeOff className="h-3 w-3 text-brand-indigo shrink-0" />}
        </DropdownMenuItem>
      )}
      {isFilterActive && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onResetControls} className="text-[12px] text-destructive">{t("filter.clearAllFilters", "Clear all filters")}</DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  );

  const sortMenuContent = (
    <DropdownMenuContent align="end" className="w-52">
      {(() => {
        const isActive = sortBy === "name_asc" || sortBy === "name_desc";
        const activeDir: "asc" | "desc" = sortBy === "name_asc" ? "asc" : "desc";
        return (
          <DropdownMenuItem key="name" onSelect={(e) => { e.preventDefault(); onSortByChange(isActive ? sortBy : "name_desc"); }} className="text-[12px] flex items-center gap-2">
            <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>{t("sortOptions.name", "Name")}</span>
            {isActive && (
              <>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange("name_asc"); }} className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "asc" ? "text-brand-indigo" : "text-foreground/30")} title="Ascending"><ArrowUp className="h-3 w-3" /></button>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange("name_desc"); }} className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "desc" ? "text-brand-indigo" : "text-foreground/30")} title="Descending"><ArrowDown className="h-3 w-3" /></button>
              </>
            )}
          </DropdownMenuItem>
        );
      })()}
      {(["recent", "leads_desc", "response_desc"] as CampaignSortBy[]).map((s) => (
        <DropdownMenuItem key={s} onSelect={(e) => { e.preventDefault(); onSortByChange(s); }} className="text-[12px] flex items-center gap-2">
          <span className={cn("flex-1", sortBy === s && "font-semibold !text-brand-indigo")}>{t(DETAIL_SORT_LABEL_KEYS[s])}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );

  return (
    <div className="flex flex-col h-full w-full" data-testid="campaign-list-view">

      {/* ── MOBILE HEADER (< 768px) ─────────────────────────────────────── */}
      <MobileListHeader
        title={t("title")}
        searchValue={listSearch}
        onSearchChange={onListSearchChange}
        searchPlaceholder={t("toolbar.searchPlaceholder", "Search...")}
        filterControl={(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <MobileHeaderIconBtn dot={isFilterActive} active={isFilterActive} aria-label={t("filter.title", "Filter")} data-testid="mobile-header-filter">
                <Filter className="h-4 w-4" />
              </MobileHeaderIconBtn>
            </DropdownMenuTrigger>
            {filterMenuContent}
          </DropdownMenu>
        )}
        sortControl={(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <MobileHeaderIconBtn active={isSortNonDefault} aria-label={t("sort.title", "Sort")} data-testid="mobile-header-sort">
                <ArrowUpDown className="h-4 w-4" />
              </MobileHeaderIconBtn>
            </DropdownMenuTrigger>
            {sortMenuContent}
          </DropdownMenu>
        )}
        extraActions={isAgencyUser ? (
          <MobileHeaderIconBtn onClick={onCreateCampaign} aria-label={t("toolbar.add", "New campaign")} data-testid="mobile-header-add">
            <Plus className="h-4 w-4" />
          </MobileHeaderIconBtn>
        ) : undefined}
      />

      {/* ── FULL-WIDTH TOP BAR (desktop only) — always visible ──────────── */}
      <div className="shrink-0 hidden md:flex items-center gap-2 px-[17px]" style={{ height: 60, borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
          {/* Left: title + count + tabs */}
          <span className="serif" style={{ fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t("title")}</span>
          <span className="eyebrow eyebrow-sm" style={{ color: 'var(--mute-2)', marginLeft: 4 }}>#{totalCampaigns}</span>
          <div className="la-seg la-seg--fill shrink-0" style={{ marginLeft: 10 }}>
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onDetailTabChange(tab.id as CampaignDetailTab)}
                className={`la-seg-btn${detailTab === tab.id ? ' on' : ''}`}
                style={{ padding: '8px 12px', fontSize: 11, letterSpacing: '0.13em' }}
              >
                {tab.icon && <span className="flex items-center"><tab.icon size={13} /></span>}
                {tab.label}
              </button>
            ))}
          </div>
          {/* Fold/expand left panel */}
          <button
            className="la-btn la-btn--soft la-btn--icon"
            onClick={cycle}
            title={leftPanelState === "full" ? "Compact panel" : leftPanelState === "compact" ? "Hide panel" : "Show panel"}
          >
            {leftPanelState === "hidden" ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <div className="flex-1" />
          {/* Share — demo campaigns only */}
          {selectedCampaign?.is_demo && <ShareButton campaign={selectedCampaign} />}
          {/* Prompt panel — agency only */}
          {isAgencyUser && (
            <button
              className={cn("la-btn la-btn--soft la-btn--icon", promptPanelOpen && "!text-brand-indigo !bg-brand-indigo/10")}
              onClick={togglePromptPanel}
              title="Prompt panel"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}
          {/* Search */}
          <div className="relative shrink-0" style={{ width: 180 }}>
            <input
              value={listSearch}
              onChange={(e) => onListSearchChange(e.target.value)}
              placeholder={t("toolbar.searchPlaceholder", "Search...")}
              className="neu-input"
              style={{ paddingLeft: 28, paddingTop: 0, paddingBottom: 0, paddingRight: 10, height: 32, fontSize: 12 }}
            />
            <span className="absolute left-[9px] top-1/2 -translate-y-1/2 text-[var(--mute-2)] flex pointer-events-none">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></svg>
            </span>
          </div>
          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon" style={{ position: 'relative' }}>
                <Filter className="h-4 w-4 shrink-0" />
                {isFilterActive && <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--wine)' }} />}
              </button>
            </DropdownMenuTrigger>
            {filterMenuContent}
          </DropdownMenu>
          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon" style={{ position: 'relative' }}>
                <ArrowUpDown className="h-4 w-4 shrink-0" />
                {isSortNonDefault && <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--wine)' }} />}
              </button>
            </DropdownMenuTrigger>
            {sortMenuContent}
          </DropdownMenu>
          {/* Group */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="la-btn la-btn--soft la-btn--icon" style={{ position: 'relative' }}>
                <Layers className="h-4 w-4 shrink-0" />
                {isGroupNonDefault && <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--wine)' }} />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {(Object.keys(DETAIL_GROUP_LABEL_KEYS) as CampaignGroupBy[]).map((g) => (
                <DropdownMenuItem key={g} onSelect={(e) => { e.preventDefault(); onGroupByChange(g); }} className="text-[12px] flex items-center gap-2">
                  <span className={cn("flex-1", groupBy === g && "font-semibold !text-brand-indigo")}>{t(DETAIL_GROUP_LABEL_KEYS[g])}</span>
                  {groupBy === g && g !== "none" && (
                    <>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onGroupDirectionChange("asc"); }} className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")} title="Ascending"><ArrowUp className="h-3 w-3" /></button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onGroupDirectionChange("desc"); }} className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "desc" ? "text-brand-indigo" : "text-foreground/30")} title="Descending"><ArrowDown className="h-3 w-3" /></button>
                    </>
                  )}
                  {groupBy === g && g === "none" && <Check className="h-3 w-3" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* + New */}
          <button className="la-btn la-btn--wine la-btn--icon" onClick={onCreateCampaign} title={t("toolbar.add", "New campaign")}>
            <Plus className="h-4 w-4" />
          </button>
        </div>

      {/* ── CONTENT ROW: left panel + right panel ─────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── LEFT PANEL: campaign list ─────────────────────────────────── */}
      {/* On true mobile (<768px) the list stays mounted (receded behind the bottom-sheet);
          on narrow-but-not-mobile (tablet, 768–1024px) it still collapses to the classic split-panel. */}
      <MobileRecede open={isMobile768 && mobilePanelOpen} fill={isMobile768}>
      <div className={cn(
        "flex-col bg-panel-list-bg overflow-hidden border-r border-[var(--line)] min-h-0",
        isListHidden
          ? cn((isNarrow && !isMobile768) && selectedCampaign ? "hidden" : "flex", "lg:hidden")
          : isListCompact
            ? cn("w-[65px] shrink-0", (isNarrow && !isMobile768) && selectedCampaign ? "hidden" : "flex")
            : cn("w-full lg:w-[var(--toolbar-w)] lg:shrink-0", (isNarrow && !isMobile768) && selectedCampaign ? "hidden" : "flex")
      )} data-onboarding="campaigns-sidebar">

        {isListCompact && (
          <>
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto la-list-area">
              {loading ? (
                <CompactListSkeleton />
              ) : flatItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-2">
                  <Megaphone className="h-5 w-5 text-muted-foreground/40" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0">
                  {flatItems.map((item) => {
                    if (item.kind === "header") return null;
                    const cid = getCampaignId(item.campaign);
                    const isSelected = selectedCampaign ? getCampaignId(selectedCampaign) === cid : false;
                    return (
                      <div key={cid} data-campaign-id={cid}>
                        <CompactCampaignCard
                          campaign={item.campaign}
                          isActive={isSelected}
                          onClick={() => onSelectCampaign(item.campaign)}
                          onHover={handleCompactHover as (c: Record<string, any>, r: DOMRect) => void}
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


        {!isListCompact && <>


        {/* Campaign list */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto la-list-area">
          {/* Pull-to-refresh indicator — mobile only */}
          <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
          {loading ? (
            <ListSkeleton />
          ) : paginatedItems.length === 0 ? (
            <div />
          ) : (
            <div
              key={`page-${currentPage}`}
              className="la-cards"
            >
              {paginatedItems.map((item, idx) => {
                if (item.kind === "header") {
                  const isFirstHeader = paginatedItems.findIndex((i) => i.kind === "header") === idx;
                  return (
                    <div key={`h-${item.label}`}>
                      <GroupHeader label={item.label} count={item.count} isFirst={isFirstHeader} />
                    </div>
                  );
                }
                const cid = getCampaignId(item.campaign);
                const isSelected = selectedCampaign
                  ? getCampaignId(selectedCampaign) === cid
                  : false;
                return (
                  <div key={cid || idx} data-campaign-id={cid} className={idx < 15 ? "animate-card-enter" : undefined} style={idx < 15 ? { animationDelay: `${Math.min(idx, 15) * 30}ms` } : undefined}>
                    <CampaignListCard
                      campaign={item.campaign}
                      isActive={isSelected}
                      onClick={() => {
                        onSelectCampaign(item.campaign);
                        if (isMobile768) {
                          setMobilePanelOpen(true);
                        } else {
                          setMobileView("detail");
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {totalCampaigns > PAGE_SIZE && (
          <div className="h-9 md:h-[18px] px-3 py-1 border-t border-border/20 flex items-center justify-between shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 touch-target"
            >
              {t("pagination.previous")}
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {t("pagination.rangeOf", { start: currentPage * PAGE_SIZE + 1, end: Math.min((currentPage + 1) * PAGE_SIZE, totalCampaigns), total: totalCampaigns })}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))}
              disabled={currentPage >= maxPage}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 touch-target"
            >
              {t("pagination.next")}
            </button>
          </div>
        )}
        </>}
      </div>
      </MobileRecede>

      {/* ── MOBILE FULL-SCREEN DETAIL PANEL (< 768px) ──────────────── */}
      <MobileCampaignDetailPanel
        campaign={selectedCampaign}
        metrics={metrics}
        open={mobilePanelOpen}
        onBack={() => setMobilePanelOpen(false)}
        onSave={onSave}
      />

      {/* ── MOBILE FILTER BOTTOM SHEET (< 768px) ────────────────────── */}
      <CampaignFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        sortBy={sortBy}
        onSortByChange={onSortByChange}
        filterStatus={filterStatus}
        onFilterStatusSet={onFilterStatusSet ?? ((v) => {
          const toAdd = v.filter((s) => !filterStatus.includes(s));
          const toRemove = filterStatus.filter((s) => !v.includes(s));
          toAdd.forEach((s) => onToggleFilterStatus(s));
          toRemove.forEach((s) => onToggleFilterStatus(s));
        })}
        onReset={onResetControls}
      />

      {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
      <div ref={rightPanelRef} className={cn(
        "flex-1 flex-col overflow-hidden",
        mobileView === "list" ? "hidden md:flex" : "flex mobile-panel-enter"
      )}>

        {/* Detail view */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading && !selectedCampaign ? (
            <SkeletonCampaignPanel tab={detailTab} />
          ) : selectedCampaign ? (
            <CampaignDetailView
              campaign={selectedCampaign}
              metrics={metrics}
              allCampaigns={campaigns}
              onToggleStatus={onToggleStatus}
              onSave={onSave}
              onRefresh={onRefresh}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              compact={isDetailCompact}
              onCreateCampaign={onCreateCampaign}
              activeTab={detailTab}
              onActiveTabChange={onDetailTabChange}
              listSearch={listSearch}
              onListSearchChange={onListSearchChange}
              searchOpen={searchOpen}
              onSearchOpenChange={onSearchOpenChange}
              sortBy={sortBy}
              onSortByChange={onSortByChange}
              isSortNonDefault={isSortNonDefault}
              filterStatus={filterStatus}
              onToggleFilterStatus={onToggleFilterStatus}
              filterAccount={filterAccount}
              onFilterAccountChange={onFilterAccountChange}
              isFilterActive={isFilterActive}
              showDemoCampaigns={showDemoCampaigns}
              onShowDemoCampaignsChange={onShowDemoCampaignsChange}
              groupBy={groupBy}
              onGroupByChange={onGroupByChange}
              isGroupNonDefault={isGroupNonDefault}
              availableAccounts={availableAccounts}
              onResetControls={onResetControls}
              onBack={() => setMobileView("list")}
              promptPanelOpen={promptPanelOpen}
              onTogglePromptPanel={togglePromptPanel}
              mainColumnRef={compactObserverRef}
            />
          ) : (
            <CampaignDetailViewEmpty showNoCampaigns={totalCampaigns === 0} />
          )}
        </div>
      </div>

      {/* ── Compact mode hover card overlay ─────────────────────────── */}
      {isListCompact && hoveredCampaign && (
        <CompactHoverCardPortal
          rect={hoveredRect}
          onMouseEnter={cancelHoveredEnd}
          onMouseLeave={handleCompactHoverEnd}
        >
          <CampaignListCard
            campaign={hoveredCampaign}
            isActive={selectedCampaign ? getCampaignId(selectedCampaign) === getCampaignId(hoveredCampaign) : false}
            onClick={() => { onSelectCampaign(hoveredCampaign); closeHoveredCampaign(); }}
          />
        </CompactHoverCardPortal>
      )}
      </div> {/* end content row */}
    </div>
  );
}

