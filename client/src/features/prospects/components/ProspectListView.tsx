import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpDown, ArrowUp, ArrowDown, Filter, Plus, Check,
  Clock, Layers, MapPin, Building2, MoreVertical, Search, X,
} from "lucide-react";
import {
  useCompactPanelState,
  useCompactHoverCard,
  CompactTabPopover,
  CompactHoverCardPortal,
} from "@/components/crm/CompactEntityRail";
import { GradientTester, GradientControlPoints, layerToStyle, type GradientLayer } from "@/components/ui/gradient-tester";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ViewTabBar } from "@/components/ui/view-tab-bar";
import { SearchPill } from "@/components/ui/search-pill";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useListPanelState } from "@/hooks/useListPanelState";
import { ProspectDetailViewEmpty } from "./ProspectDetailView";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import { ProspectCreatePanel } from "./ProspectCreatePanel";
import { SkeletonAccountPanel } from "@/components/ui/skeleton";
import { useInlineEditing } from "./useInlineEditing";
import { useProspectListFiltering } from "./useProspectListFiltering";
import { useProspectsPaginated } from "../hooks/useProspectsPaginated";
import { useQuery } from "@tanstack/react-query";
import { fetchProspectsFilterOptions } from "../api/prospectsApi";
import { ProspectListCard, CompactProspectCard, CompactGroupDivider, GroupHeader, ListSkeleton, FilterAccordionSection, SignalBars } from "./ProspectListCards";
import { ProspectDetailHeader } from "./ProspectDetailHeader";
import { ProspectDetailPanels } from "./ProspectDetailPanels";

import {
  ProspectRow, NewProspectForm, ProspectViewMode, ProspectGroupBy, ProspectSortBy,
  VirtualListItem, PROSPECT_STATUS_HEX, INLINE_PRIORITY_OPTIONS,
  GROUP_TKEYS, STATUS_FILTER_OPTIONS, VIEW_TABS_CONFIG, getProspectId,
} from "./prospectTypes";

export type { ProspectRow, NewProspectForm, ProspectViewMode, ProspectGroupBy, ProspectSortBy };

/** Matches the hardcoded CSS fallback gradients for this page */
const PAGE_DEFAULT_LAYERS: GradientLayer[] = [
  { id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff", ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [] },
  { id: 1, label: "Pink-Yellow sweep", enabled: true, type: "linear", angle: 157, ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [
    { color: "#fc3eff", opacity: 0.12, position: 0 },
    { color: "#f2e19b", opacity: 0.55, position: 100 },
  ]},
  { id: 2, label: "Warm corner BR", enabled: true, type: "radial", ellipseW: 148, ellipseH: 200, posX: 100, posY: 100, colorStops: [
    { color: "#ffc886", opacity: 0.4, position: 0 },
    { color: "#ffc886", opacity: 0, position: 80 },
  ]},
  { id: 3, label: "Purple corner TL", enabled: true, type: "radial", ellipseW: 200, ellipseH: 200, posX: 0, posY: 0, colorStops: [
    { color: "#9e8fff", opacity: 0.1, position: 0 },
    { color: "#9e8fff", opacity: 0, position: 80 },
  ]},
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProspectListViewProps {
  prospects: ProspectRow[];
  loading: boolean;
  selectedProspect: ProspectRow | null;
  onSelectProspect: (prospect: ProspectRow | null) => void;
  onAddProspect: () => void;
  onCreate: (data: NewProspectForm) => Promise<ProspectRow | void>;
  onSave: (field: string, value: string) => Promise<void>;
  onDelete: () => void;
  onToggleStatus: (prospect: ProspectRow) => void;
  viewMode: ProspectViewMode;
  onViewModeChange: (v: ProspectViewMode) => void;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (v: boolean) => void;
  groupBy: ProspectGroupBy;
  onGroupByChange: (v: ProspectGroupBy) => void;
  sortBy: ProspectSortBy;
  onSortByChange: (v: ProspectSortBy) => void;
  filterNiche: string[];
  onToggleFilterNiche: (s: string) => void;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  filterCountry: string[];
  onToggleFilterCountry: (s: string) => void;
  filterPriority: string[];
  onToggleFilterPriority: (s: string) => void;
  filterSource: string[];
  onToggleFilterSource: (s: string) => void;
  hasNonDefaultControls: boolean;
  isGroupNonDefault: boolean;
  isSortNonDefault: boolean;
  onResetControls: () => void;
  onRefreshProspect?: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProspectListView({
  prospects,
  loading,
  selectedProspect,
  onSelectProspect,
  onAddProspect,
  onCreate,
  onSave,
  onDelete,
  onToggleStatus,
  viewMode,
  onViewModeChange,
  listSearch,
  onListSearchChange,
  searchOpen,
  onSearchOpenChange,
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  filterNiche,
  onToggleFilterNiche,
  filterStatus,
  onToggleFilterStatus,
  filterCountry,
  onToggleFilterCountry,
  filterPriority,
  onToggleFilterPriority,
  filterSource,
  onToggleFilterSource,
  hasNonDefaultControls,
  isGroupNonDefault,
  isSortNonDefault,
  onResetControls,
  onRefreshProspect,
}: ProspectListViewProps) {
  const { t } = useTranslation("prospects");
  const isNarrow = useIsMobile(1024);

  // Compact mode driven by right-panel width (hysteresis handled in hook).
  const { ref: rightPanelRef, narrow: rightPanelNarrow } = useCompactPanelState(isNarrow);

  const viewTabs = useMemo(
    () => VIEW_TABS_CONFIG.map((tab) => ({ ...tab, label: t(tab.tKey) })),
    [t]
  );

  // ── UI state ───────────────────────────────────────────────────────────────
  const [panelMode, setPanelMode] = useState<"view" | "create">("view");
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [groupDirection, setGroupDirection] = useState<"asc" | "desc">("asc");
  // Shared global list-panel state (Prospects/Leads/Campaigns/Chats all cycle together).
  const { state: leftPanelState, setState: setLeftPanelState } = useListPanelState();

  // Auto-squeeze to compact when right panel is narrow (only if user hasn't explicitly hidden).
  const isCompact = !isNarrow && (leftPanelState === "compact" || (leftPanelState === "full" && rightPanelNarrow));
  const isHidden = !isNarrow && leftPanelState === "hidden";

  // Compact hover card state (shared hook). scrollContainerRef is declared below;
  // findEl is memoized so it captures the ref by closure, read lazily at hover time.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const findProspectEl = useCallback(
    (id: string | number) =>
      scrollContainerRef.current?.querySelector(`[data-prospect-id="${id}"]`) as HTMLElement | null,
    [],
  );
  const {
    hovered: hoveredProspect,
    rect: hoveredRect,
    onHover: handleCompactHover,
    onHoverEnd: handleCompactHoverEnd,
    cancelHoverEnd: cancelHoveredEnd,
    close: closeHoveredProspect,
  } = useCompactHoverCard<ProspectRow>(getProspectId, findProspectEl);

  // ── Inline editing ─────────────────────────────────────────────────────────
  const { editableField, editableMultiline } = useInlineEditing(onSave);

  // ── Convert to Account ─────────────────────────────────────────────────────
  const [converting, setConverting] = useState(false);
  const handleConvertToAccount = useCallback(async () => {
    if (!selectedProspect || converting) return;
    const pid = selectedProspect.Id ?? selectedProspect.id ?? 0;
    setConverting(true);
    try {
      const { convertProspectToAccount } = await import("../api/prospectsApi");
      const result = await convertProspectToAccount(pid);
      await onSave("status", "Converted");
      await onSave("Accounts_id", String(result.account.id));
    } catch (err) {
      console.error("Convert to account failed", err);
    } finally {
      setConverting(false);
    }
  }, [selectedProspect, converting, onSave]);

  // ── Gradient tester ────────────────────────────────────────────────────────
  const GRADIENT_KEY = "la:gradient:prospects";
  const [savedGradient, setSavedGradient] = useState<GradientLayer[] | null>(() => {
    try { const raw = localStorage.getItem(GRADIENT_KEY); return raw ? JSON.parse(raw) as GradientLayer[] : null; } catch { return null; }
  });
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(savedGradient ?? PAGE_DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);

  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if (id === -2) { setGradientLayers(prev => prev.filter(l => l.id !== (patch as GradientLayer).id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);
  const handleSaveGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
  }, [gradientLayers]);
  const handleApplyGradient = useCallback(() => {
    handleSaveGradient();
    setGradientTesterOpen(false);
  }, [handleSaveGradient]);
  const toggleGradientTester = useCallback(() => {
    if (!gradientTesterOpen) {
      try {
        const raw = localStorage.getItem(GRADIENT_KEY);
        if (raw) setGradientLayers(JSON.parse(raw) as GradientLayer[]);
        else setGradientLayers(PAGE_DEFAULT_LAYERS);
      } catch { /* keep current layers */ }
    }
    setGradientTesterOpen(prev => !prev);
  }, [gradientTesterOpen]);

  // ── Server-side paginated list ────────────────────────────────────────────
  const paginated = useProspectsPaginated({
    niche: filterNiche.length ? filterNiche : undefined,
    status: filterStatus.length ? filterStatus : undefined,
    country: filterCountry.length ? filterCountry : undefined,
    priority: filterPriority.length ? filterPriority : undefined,
    source: filterSource.length ? filterSource : undefined,
    overdue: filterOverdue,
    sortBy,
    groupBy: groupBy !== "none" ? groupBy : undefined,
    groupDirection,
  });
  const rawListItems = paginated.items;
  const listItems = useMemo(() => {
    if (!listSearch) return rawListItems;
    const q = listSearch.toLowerCase();
    return rawListItems.filter((p: any) =>
      [p.name, p.company, p.niche, p.status, p.country, p.city, p.email, p.contact_name]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [rawListItems, listSearch]);
  const totalProspects = listSearch ? listItems.length : paginated.total;
  const listLoading = paginated.isLoading && rawListItems.length === 0;

  // SSE: refetch list on prospect changes (debounced)
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => paginated.refetch(), 400);
    };
    window.addEventListener("crm-data-changed", handler);
    return () => {
      window.removeEventListener("crm-data-changed", handler);
      if (debounce) clearTimeout(debounce);
    };
  }, [paginated]);

  // Filter options (distinct niches/countries/sources across entire dataset)
  const filterOptionsQuery = useQuery({
    queryKey: ["/api/prospects/filter-options"],
    queryFn: fetchProspectsFilterOptions,
    staleTime: 5 * 60 * 1000,
  });

  const {
    flatItems: paginatedItems,
    getNicheColor,
    availableNiches,
    availableCountries,
    availableSources,
  } = useProspectListFiltering({
    prospects: listItems,
    groupBy,
    groupDirection,
    availableNiches: filterOptionsQuery.data?.niches,
    availableCountries: filterOptionsQuery.data?.countries,
    availableSources: filterOptionsQuery.data?.sources,
  });

  // ── Publish selected prospect to AI chat context ────────────────────────────
  const publishEntity = usePublishEntityData();
  useEffect(() => {
    if (!selectedProspect) return;
    const pid = selectedProspect.Id ?? selectedProspect.id ?? 0;
    publishEntity({
      entityType: "prospect",
      entityId: pid,
      entityName: selectedProspect.company || selectedProspect.name || "Unknown Prospect",
      summary: {
        id: pid,
        company: selectedProspect.company,
        name: selectedProspect.name,
        contactName: selectedProspect.contact_name,
        contactRole: selectedProspect.contact_role,
        contactEmail: selectedProspect.contact_email,
        contactPhone: selectedProspect.contact_phone,
        email: selectedProspect.email,
        phone: selectedProspect.phone,
        website: selectedProspect.website,
        linkedin: selectedProspect.linkedin,
        niche: selectedProspect.niche,
        city: selectedProspect.city,
        country: selectedProspect.country,
        status: selectedProspect.status,
        priority: selectedProspect.priority,
        source: selectedProspect.source,
        notes: selectedProspect.notes,
        nextAction: selectedProspect.next_action,
        aiSummary: selectedProspect.ai_summary,
        headline: selectedProspect.headline,
      },
      updatedAt: Date.now(),
    });
  }, [selectedProspect, publishEntity]);

  // ── Auto-select first prospect ─────────────────────────────────────────────
  const flatItemsForAutoSelect = paginatedItems;
  useEffect(() => {
    if (!selectedProspect && listItems.length > 0) {
      const first = flatItemsForAutoSelect.find((i) => i.kind === "prospect") as { kind: "prospect"; prospect: ProspectRow } | undefined;
      if (first) onSelectProspect(first.prospect);
    }
  }, [flatItemsForAutoSelect, selectedProspect, listItems.length, onSelectProspect]);

  // ── Smooth scroll to selected card ────────────────────────────────────────
  const lastScrolledSelectionRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (!selectedProspect || !scrollContainerRef.current) return;
    const id = getProspectId(selectedProspect);
    if (lastScrolledSelectionRef.current === id) return;
    lastScrolledSelectionRef.current = id;
    const container = scrollContainerRef.current;
    let rafId: number | null = null;
    let attempts = 0;
    const run = () => {
      const el = container.querySelector(`[data-prospect-id="${id}"]`) as HTMLElement | null;
      if (!el) {
        if (attempts++ < 30) { rafId = requestAnimationFrame(run); }
        return;
      }
      const containerTop = container.getBoundingClientRect().top;
      const cardTop = el.getBoundingClientRect().top;
      const relativeTop = cardTop - containerTop + container.scrollTop;
      container.scrollTo({ top: Math.max(0, relativeTop - 48), behavior: "smooth" });
    };
    rafId = requestAnimationFrame(run);
    return () => { if (rafId !== null) cancelAnimationFrame(rafId); };
  }, [selectedProspect]);

  // ── F shortcut: scroll selected prospect into view ───────────────────────
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement | null)?.isContentEditable) return;
      if (!selectedProspect || !scrollContainerRef.current) return;
      e.preventDefault();
      const id = getProspectId(selectedProspect);
      let card = scrollContainerRef.current.querySelector(`[data-prospect-id="${id}"]`) as HTMLElement | null;
      if (!card) {
        // Fetch additional pages until the selected prospect is in the DOM
        await paginated.ensureProspectLoaded(id);
        // Give React one frame to render
        await new Promise(requestAnimationFrame);
        card = scrollContainerRef.current.querySelector(`[data-prospect-id="${id}"]`) as HTMLElement | null;
      }
      if (card) card.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedProspect, paginated]);

  const isFilterActive = filterNiche.length > 0 || filterStatus.length > 0 || filterCountry.length > 0 || filterPriority.length > 0 || filterSource.length > 0;

  // ── Expand-on-hover button classes ────────────────────────────────────────
  const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
  const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
  const xActive  = "border-brand-indigo text-brand-indigo";
  const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  // ── Search pill ───────────────────────────────────────────────────────────
  const searchPill = (
    <SearchPill
      value={listSearch}
      onChange={onListSearchChange}
      open={searchOpen}
      onOpenChange={onSearchOpenChange}
      placeholder={t("page.searchPlaceholder")}
      className="ml-[9px] max-w-[171px]"
    />
  );

  // ── Toolbar (filter / sort / group / add) ─────────────────────────────────
  const toolbarPrefix = (
    <>
      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isFilterActive ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Filter className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.filter")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-[400px] overflow-y-auto">
          <FilterAccordionSection label={t("group.niche")} activeCount={filterNiche.length} defaultOpen={filterNiche.length > 0}>
            {availableNiches.map((s) => (
              <DropdownMenuItem key={`niche-${s}`} onClick={(e) => { e.preventDefault(); onToggleFilterNiche(s); }} className="flex items-center gap-2 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getNicheColor(s).hex }} />
                <span className="flex-1">{s}</span>
                {filterNiche.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </FilterAccordionSection>
          <FilterAccordionSection label={t("filter.status")} activeCount={filterStatus.length} defaultOpen={filterStatus.length > 0}>
            {STATUS_FILTER_OPTIONS.map((s) => (
              <DropdownMenuItem key={`status-${s}`} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PROSPECT_STATUS_HEX[s] || "#94A3B8" }} />
                <span className="flex-1">{s}</span>
                {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </FilterAccordionSection>
          {availableCountries.length > 0 && (
            <FilterAccordionSection label={t("filter.country")} activeCount={filterCountry.length} defaultOpen={filterCountry.length > 0}>
              {availableCountries.map((s) => (
                <DropdownMenuItem key={`country-${s}`} onClick={(e) => { e.preventDefault(); onToggleFilterCountry(s); }} className="flex items-center gap-2 text-[12px]">
                  <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="flex-1">{s}</span>
                  {filterCountry.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </FilterAccordionSection>
          )}
          <FilterAccordionSection label={t("filter.priority")} activeCount={filterPriority.length} defaultOpen={filterPriority.length > 0}>
            {INLINE_PRIORITY_OPTIONS.map((s) => (
              <DropdownMenuItem key={`priority-${s}`} onClick={(e) => { e.preventDefault(); onToggleFilterPriority(s); }} className="flex items-center gap-2 text-[12px]">
                <SignalBars priority={s} />
                <span className="flex-1 capitalize">{s}</span>
                {filterPriority.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </FilterAccordionSection>
          {availableSources.length > 0 && (
            <FilterAccordionSection label={t("filter.source")} activeCount={filterSource.length} defaultOpen={filterSource.length > 0}>
              {availableSources.map((s) => (
                <DropdownMenuItem key={`source-${s}`} onClick={(e) => { e.preventDefault(); onToggleFilterSource(s); }} className="flex items-center gap-2 text-[12px]">
                  <span className="flex-1">{s}</span>
                  {filterSource.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </FilterAccordionSection>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setFilterOverdue((v) => !v); }} className="flex items-center gap-2 text-[12px]">
            <Clock className="h-3 w-3 text-red-500/60 shrink-0" />
            <span className="flex-1">{t("toolbar.overdue")}</span>
            {filterOverdue && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
          </DropdownMenuItem>
          {isFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { onResetControls(); setFilterOverdue(false); }} className="text-[12px] text-muted-foreground">
                {t("toolbar.clearAllFilters")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isSortNonDefault ? xActive : xDefault, "hover:max-w-[100px]")}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {([
            { key: "recent", label: t("sort.mostRecent"), asc: null, desc: null },
            { key: "name", label: t("sort.name"), asc: "name_asc" as ProspectSortBy, desc: "name_desc" as ProspectSortBy },
            { key: "priority", label: t("sort.priority"), asc: null, desc: null },
          ] as { key: string; label: string; asc: ProspectSortBy | null; desc: ProspectSortBy | null }[]).map((group) => {
            const isActive = group.asc && group.desc
              ? sortBy === group.asc || sortBy === group.desc
              : sortBy === (group.key as ProspectSortBy);
            const activeDir: "asc" | "desc" = sortBy === group.asc ? "asc" : "desc";
            return (
              <DropdownMenuItem
                key={group.key}
                onSelect={(e) => { e.preventDefault(); if (!isActive) onSortByChange(group.desc ?? (group.key as ProspectSortBy)); }}
                className="text-[12px] flex items-center gap-2"
              >
                <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>{group.label}</span>
                {isActive && group.asc && group.desc && (
                  <>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange(group.asc!); }}
                      className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "asc" ? "text-brand-indigo" : "text-foreground/30")} title="Ascending">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange(group.desc!); }}
                      className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "desc" ? "text-brand-indigo" : "text-foreground/30")} title="Descending">
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
          <button className={cn(xBase, isGroupNonDefault ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Layers className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.group")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {(Object.keys(GROUP_TKEYS) as ProspectGroupBy[]).map((opt) => (
            <DropdownMenuItem key={opt} onSelect={(e) => { e.preventDefault(); onGroupByChange(opt); }} className="text-[12px] flex items-center gap-2">
              <span className={cn("flex-1", groupBy === opt && "font-semibold !text-brand-indigo")}>{t(GROUP_TKEYS[opt])}</span>
              {groupBy === opt && opt !== "none" && (
                <>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGroupDirection("asc"); }}
                    className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")} title="Ascending">
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGroupDirection("desc"); }}
                    className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "desc" ? "text-brand-indigo" : "text-foreground/30")} title="Descending">
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </>
              )}
              {groupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* +Add */}
      <button className={cn(xBase, xDefault, "hover:max-w-[80px]")} onClick={() => setPanelMode("create")}>
        <Plus className="h-4 w-4 shrink-0" />
        <span className={xSpan}>{t("toolbar.add")}</span>
      </button>
    </>
  );

  // ── Compact toolbar ("..." menu with sub-menus) ────────────────────────────
  const compactToolbar = isCompact ? (
    <div className="flex flex-col items-center gap-1 px-1.5 pb-2 shrink-0">
      {/* "..." menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center transition-colors",
              (isFilterActive || isSortNonDefault || isGroupNonDefault || listSearch)
                ? "bg-brand-indigo/10 text-brand-indigo"
                : "text-foreground/50 hover:text-foreground hover:bg-black/[0.04]"
            )}
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
                placeholder={t("page.searchPlaceholder")}
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
          {/* Filter sub-menu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{t("toolbar.filter")}</span>
              {isFilterActive && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                  {filterNiche.length + filterStatus.length + filterCountry.length + filterPriority.length + filterSource.length}
                </span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 max-h-[400px] overflow-y-auto">
              <FilterAccordionSection label={t("group.niche")} activeCount={filterNiche.length} defaultOpen={filterNiche.length > 0}>
                {availableNiches.map((s) => (
                  <DropdownMenuItem key={`niche-${s}`} onClick={(e) => { e.preventDefault(); onToggleFilterNiche(s); }} className="flex items-center gap-2 text-[12px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getNicheColor(s).hex }} />
                    <span className="flex-1">{s}</span>
                    {filterNiche.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </FilterAccordionSection>
              <FilterAccordionSection label={t("filter.status")} activeCount={filterStatus.length} defaultOpen={filterStatus.length > 0}>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <DropdownMenuItem key={`status-${s}`} onClick={(e) => { e.preventDefault(); onToggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PROSPECT_STATUS_HEX[s] || "#94A3B8" }} />
                    <span className="flex-1">{s}</span>
                    {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </FilterAccordionSection>
              {availableCountries.length > 0 && (
                <FilterAccordionSection label={t("filter.country")} activeCount={filterCountry.length} defaultOpen={filterCountry.length > 0}>
                  {availableCountries.map((s) => (
                    <DropdownMenuItem key={`country-${s}`} onClick={(e) => { e.preventDefault(); onToggleFilterCountry(s); }} className="flex items-center gap-2 text-[12px]">
                      <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <span className="flex-1">{s}</span>
                      {filterCountry.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </FilterAccordionSection>
              )}
              <FilterAccordionSection label={t("filter.priority")} activeCount={filterPriority.length} defaultOpen={filterPriority.length > 0}>
                {INLINE_PRIORITY_OPTIONS.map((s) => (
                  <DropdownMenuItem key={`priority-${s}`} onClick={(e) => { e.preventDefault(); onToggleFilterPriority(s); }} className="flex items-center gap-2 text-[12px]">
                    <SignalBars priority={s} />
                    <span className="flex-1 capitalize">{s}</span>
                    {filterPriority.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </FilterAccordionSection>
              {availableSources.length > 0 && (
                <FilterAccordionSection label={t("filter.source")} activeCount={filterSource.length} defaultOpen={filterSource.length > 0}>
                  {availableSources.map((s) => (
                    <DropdownMenuItem key={`source-${s}`} onClick={(e) => { e.preventDefault(); onToggleFilterSource(s); }} className="flex items-center gap-2 text-[12px]">
                      <span className="flex-1">{s}</span>
                      {filterSource.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                </FilterAccordionSection>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setFilterOverdue((v) => !v); }} className="flex items-center gap-2 text-[12px]">
                <Clock className="h-3 w-3 text-red-500/60 shrink-0" />
                <span className="flex-1">{t("toolbar.overdue")}</span>
                {filterOverdue && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
              {isFilterActive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { onResetControls(); setFilterOverdue(false); }} className="text-[12px] text-muted-foreground">
                    {t("toolbar.clearAllFilters")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Sort sub-menu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
              <span className={cn("flex-1", isSortNonDefault && "text-brand-indigo font-semibold")}>{t("toolbar.sort")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {([
                { key: "recent", label: t("sort.mostRecent"), asc: null, desc: null },
                { key: "name", label: t("sort.name"), asc: "name_asc" as ProspectSortBy, desc: "name_desc" as ProspectSortBy },
                { key: "priority", label: t("sort.priority"), asc: null, desc: null },
              ] as { key: string; label: string; asc: ProspectSortBy | null; desc: ProspectSortBy | null }[]).map((group) => {
                const isActive = group.asc && group.desc
                  ? sortBy === group.asc || sortBy === group.desc
                  : sortBy === (group.key as ProspectSortBy);
                const activeDir: "asc" | "desc" = sortBy === group.asc ? "asc" : "desc";
                return (
                  <DropdownMenuItem
                    key={group.key}
                    onSelect={(e) => { e.preventDefault(); if (!isActive) onSortByChange(group.desc ?? (group.key as ProspectSortBy)); }}
                    className="text-[12px] flex items-center gap-2"
                  >
                    <span className={cn("flex-1", isActive && "font-semibold !text-brand-indigo")}>{group.label}</span>
                    {isActive && group.asc && group.desc && (
                      <>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange(group.asc!); }}
                          className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "asc" ? "text-brand-indigo" : "text-foreground/30")} title="Ascending">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSortByChange(group.desc!); }}
                          className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "desc" ? "text-brand-indigo" : "text-foreground/30")} title="Descending">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Group sub-menu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 text-[12px]">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span className={cn("flex-1", isGroupNonDefault && "text-brand-indigo font-semibold")}>{t("toolbar.group")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {(Object.keys(GROUP_TKEYS) as ProspectGroupBy[]).map((opt) => (
                <DropdownMenuItem key={opt} onSelect={(e) => { e.preventDefault(); onGroupByChange(opt); }} className="text-[12px] flex items-center gap-2">
                  <span className={cn("flex-1", groupBy === opt && "font-semibold !text-brand-indigo")}>{t(GROUP_TKEYS[opt])}</span>
                  {groupBy === opt && opt !== "none" && (
                    <>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGroupDirection("asc"); }}
                        className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")} title="Ascending">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGroupDirection("desc"); }}
                        className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "desc" ? "text-brand-indigo" : "text-foreground/30")} title="Descending">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </>
                  )}
                  {groupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {/* +Add */}
          <DropdownMenuItem onClick={() => setPanelMode("create")} className="flex items-center gap-2 text-[12px]">
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>{t("toolbar.add")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full gap-[3px]" data-testid="prospect-list-view">

      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className={cn(
        "flex-col bg-muted rounded-lg overflow-hidden",
        isHidden
          ? cn(isNarrow && selectedProspect ? "hidden" : "flex", "lg:hidden")
          : isCompact
            ? cn("w-[65px] shrink-0", isNarrow && selectedProspect ? "hidden" : "flex")
            : cn("w-full lg:w-[340px] lg:shrink-0", isNarrow && selectedProspect ? "hidden" : "flex")
      )}>

        {isCompact ? (
          /* ── COMPACT HEADER: vertical tabs + compact toolbar ─── */
          <>
            <CompactTabPopover
              tabs={viewTabs}
              activeId={viewMode}
              onChange={(id) => onViewModeChange(id as ProspectViewMode)}
            />
            {compactToolbar}
          </>
        ) : (
          /* ── FULL HEADER ─── */
          <>
            <div className="pl-[17px] pr-[17px] pt-3 md:pt-10 pb-3 flex items-center shrink-0">
              <div className="flex items-center justify-between w-full md:w-[306px] md:shrink-0">
                <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
                <ViewTabBar
                  tabs={viewTabs}
                  activeId={viewMode}
                  onTabChange={(id) => onViewModeChange(id as ProspectViewMode)}
                  variant="segment"
                />
              </div>
            </div>
            <div className="pl-2 pr-[17px] pb-2 flex items-center gap-1 shrink-0">
              {searchPill}
              {toolbarPrefix}
            </div>
          </>
        )}

        {/* Scrollable prospect list */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-[3px]">
          {listLoading ? (
            <ListSkeleton compact={isCompact} />
          ) : paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Building2 className={cn("text-muted-foreground/30 mb-3", isCompact ? "w-5 h-5" : "w-8 h-8")} />
              {!isCompact && (
                <>
                  <p className="text-sm font-medium text-muted-foreground">{t("page.noProspectsFound")}</p>
                  {listSearch && <p className="text-xs text-muted-foreground/70 mt-1">{t("page.tryDifferentSearch")}</p>}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              {(() => {
                const sections: { header?: VirtualListItem; items: { item: VirtualListItem; idx: number }[] }[] = [];
                let currentSection: { header?: VirtualListItem; items: { item: VirtualListItem; idx: number }[] } = { items: [] };
                paginatedItems.forEach((item, idx) => {
                  if (item.kind === "header") {
                    if (currentSection.header || currentSection.items.length > 0) sections.push(currentSection);
                    currentSection = { header: item, items: [] };
                  } else {
                    currentSection.items.push({ item, idx });
                  }
                });
                if (currentSection.header || currentSection.items.length > 0) sections.push(currentSection);

                return sections.map((section, si) => (
                  <div key={section.header && section.header.kind === "header" ? `g-${section.header.label}` : `g-${si}`}>
                    {section.header && section.header.kind === "header" && (
                      isCompact ? <CompactGroupDivider label={section.header.label} count={section.header.count} /> : <GroupHeader label={section.header.label} count={section.header.count} />
                    )}
                    <div className={cn("flex flex-col px-0", isCompact ? "gap-0 items-center" : "gap-[3px]")}>
                      {section.items.map(({ item, idx }) => {
                        if (item.kind !== "prospect") return null;
                        const pid = getProspectId(item.prospect);
                        const isSelected = selectedProspect ? getProspectId(selectedProspect) === pid : false;
                        return (
                          <div key={pid || idx} data-prospect-id={pid} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
                            {isCompact ? (
                              <CompactProspectCard
                                prospect={item.prospect}
                                isActive={isSelected}
                                onClick={() => onSelectProspect(item.prospect)}
                                nicheColor={getNicheColor(String(item.prospect.niche || ""))}
                                onHover={handleCompactHover}
                                onHoverEnd={handleCompactHoverEnd}
                              />
                            ) : (
                              <ProspectListCard
                                prospect={item.prospect}
                                isActive={isSelected}
                                onClick={() => onSelectProspect(item.prospect)}
                                nicheColor={getNicheColor(String(item.prospect.niche || ""))}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}

              {/* Load more / end-of-list indicator */}
              {paginated.hasMore ? (
                <div className={cn("flex justify-center", isCompact ? "py-2" : "py-3")}>
                  <button
                    onClick={() => paginated.fetchNextPage()}
                    disabled={paginated.isFetchingNextPage}
                    className={cn(
                      "rounded-full border border-black/[0.125] bg-white dark:bg-card text-foreground/70 hover:text-foreground hover:bg-card-hover transition-colors disabled:opacity-50",
                      isCompact ? "h-8 w-8 flex items-center justify-center" : "h-8 px-4 text-[12px] font-medium"
                    )}
                    title={isCompact ? "Load more" : undefined}
                  >
                    {isCompact
                      ? <Plus className="h-4 w-4" />
                      : paginated.isFetchingNextPage ? "Loading…" : `Load more (${totalProspects - listItems.length})`}
                  </button>
                </div>
              ) : listItems.length > 0 && !isCompact && totalProspects > 0 ? (
                <div className="py-2 text-center text-[10px] text-muted-foreground/60 tabular-nums">
                  {totalProspects} total
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ── COMPACT HOVER CARD OVERLAY ───────────── */}
      {isCompact && hoveredProspect && (
        <CompactHoverCardPortal
          rect={hoveredRect}
          onMouseEnter={cancelHoveredEnd}
          onMouseLeave={handleCompactHoverEnd}
        >
          <ProspectListCard
            prospect={hoveredProspect}
            isActive={selectedProspect ? getProspectId(selectedProspect) === getProspectId(hoveredProspect) : false}
            onClick={() => { onSelectProspect(hoveredProspect); closeHoveredProspect(); }}
            nicheColor={getNicheColor(String(hoveredProspect.niche || ""))}
            hideAvatar
          />
        </CompactHoverCardPortal>
      )}

      {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
      <div ref={rightPanelRef} className={cn(
        "flex-1 flex-col overflow-hidden rounded-lg",
        isNarrow && !selectedProspect ? "hidden" : "flex"
      )}>
        {panelMode === "create" ? (
          <ProspectCreatePanel
            onCreate={async (data) => {
              const created = await onCreate(data);
              setPanelMode("view");
              if (created) {
                await paginated.refetch();
                onSelectProspect(created);
              }
            }}
            onClose={() => setPanelMode("view")}
          />
        ) : loading && !selectedProspect ? (
          <SkeletonAccountPanel />
        ) : selectedProspect ? (
          <div className="relative flex flex-col h-full overflow-hidden rounded-lg">

            {/* Gradient background */}
            {gradientTesterOpen ? (
              <>
                {gradientLayers.map(layer => {
                  const style = layerToStyle(layer);
                  return style ? <div key={layer.id} className="absolute inset-0 dark:opacity-[0.08]" style={style} /> : null;
                })}
                {gradientDragMode && (
                  <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
                )}
              </>
            ) : savedGradient ? (
              <>
                {savedGradient.map((layer: GradientLayer) => {
                  const style = layerToStyle(layer);
                  return style ? <div key={layer.id} className="absolute inset-0 dark:opacity-[0.08]" style={style} /> : null;
                })}
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-white dark:bg-background" />
                <div className="absolute inset-0 dark:opacity-[0.08] bg-[linear-gradient(157deg,rgba(252,62,255,0.12)_0%,rgba(242,225,155,0.55)_100%)]" />
                <div className="absolute inset-0 dark:opacity-[0.08] bg-[radial-gradient(ellipse_148%_200%_at_100%_100%,rgba(255,200,134,0.4)_0%,transparent_80%)]" />
                <div className="absolute inset-0 dark:opacity-[0.08] bg-[radial-gradient(ellipse_200%_200%_at_0%_0%,rgba(158,143,255,0.1)_0%,transparent_80%)]" />
              </>
            )}

            <ProspectDetailHeader
              selectedProspect={selectedProspect}
              onSave={onSave}
              onToggleFilterNiche={onToggleFilterNiche}
              getNicheColor={getNicheColor}
              isNarrow={isNarrow}
              onSelectProspect={onSelectProspect}
              gradientTesterOpen={gradientTesterOpen}
              toggleGradientTester={toggleGradientTester}
            />

            <ProspectDetailPanels
              selectedProspect={selectedProspect}
              onSave={onSave}
              onRefreshProspect={onRefreshProspect}
              onToggleFilterNiche={onToggleFilterNiche}
              editableField={editableField}
              editableMultiline={editableMultiline}
              converting={converting}
              handleConvertToAccount={handleConvertToAccount}
            />

          </div>
        ) : (
          <ProspectDetailViewEmpty />
        )}
      </div>

      {/* Gradient Tester floating panel */}
      <GradientTester
        open={gradientTesterOpen}
        onClose={() => setGradientTesterOpen(false)}
        layers={gradientLayers}
        onUpdateLayer={updateGradientLayer}
        onResetLayers={() => setGradientLayers(PAGE_DEFAULT_LAYERS)}
        dragMode={gradientDragMode}
        onToggleDragMode={() => setGradientDragMode(prev => !prev)}
        onSave={handleSaveGradient}
        onApply={handleApplyGradient}
      />
    </div>
  );
}
