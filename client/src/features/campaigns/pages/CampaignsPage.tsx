import { useState, useMemo, useCallback, useEffect } from "react";
import {
  List, Table2, Search, X, ArrowUpDown, Filter, Layers, Eye, Check,
} from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { CampaignListView } from "../components/CampaignListView";
import { CampaignDetailPanel } from "../components/CampaignDetailPanel";
import { CampaignsInlineTable } from "../components/CampaignsInlineTable";
import type { CampaignTableItem } from "../components/CampaignsInlineTable";
import { useCampaignsData } from "../hooks/useCampaignsData";
import { useCampaignMetrics } from "@/hooks/useApiData";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Campaign } from "@/types/models";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type CampaignViewMode = "list" | "table";
export type CampaignGroupBy = "status" | "account" | "type" | "none";
export type CampaignSortBy = "recent" | "name_asc" | "name_desc" | "leads_desc" | "response_desc";

const VIEW_MODE_KEY = "campaigns-view-mode";
const VISIBLE_COLS_KEY = "campaigns-table-visible-cols";

/* ── Table column metadata for Fields dropdown ── */
const TABLE_COL_META = [
  { key: "name",         label: "Name",          defaultVisible: true  },
  { key: "status",       label: "Status",        defaultVisible: true  },
  { key: "account",      label: "Account",       defaultVisible: true  },
  { key: "type",         label: "Type",          defaultVisible: true  },
  { key: "leads",        label: "Leads",         defaultVisible: true  },
  { key: "responseRate", label: "Response %",     defaultVisible: true  },
  { key: "bookingRate",  label: "Booking %",      defaultVisible: true  },
  { key: "description",  label: "Description",    defaultVisible: true  },
  { key: "cost",         label: "Cost",           defaultVisible: false },
  { key: "roi",          label: "ROI %",          defaultVisible: false },
  { key: "startDate",    label: "Start Date",     defaultVisible: false },
  { key: "endDate",      label: "End Date",       defaultVisible: false },
  { key: "lastModified", label: "Last Modified",  defaultVisible: false },
];

const DEFAULT_VISIBLE = TABLE_COL_META.filter((c) => c.defaultVisible).map((c) => c.key);

/* ── Table sort / group / filter types ── */
type TableSortByOption  = "recent" | "name_asc" | "name_desc" | "leads_desc" | "response_desc";
type TableGroupByOption = "status" | "account" | "type" | "none";

const TABLE_SORT_LABELS: Record<TableSortByOption, string> = {
  recent:        "Most Recent",
  name_asc:      "Name A → Z",
  name_desc:     "Name Z → A",
  leads_desc:    "Most Leads",
  response_desc: "Highest Response",
};

const TABLE_GROUP_LABELS: Record<TableGroupByOption, string> = {
  status:  "Status",
  account: "Account",
  type:    "Type",
  none:    "None",
};

const STATUS_OPTIONS = ["Active", "Paused", "Draft", "Completed", "Inactive"];

const STATUS_DOT: Record<string, string> = {
  Active:    "bg-green-500",
  Paused:    "bg-amber-500",
  Completed: "bg-blue-500",
  Finished:  "bg-blue-500",
  Inactive:  "bg-slate-400",
  Archived:  "bg-slate-400",
  Draft:     "bg-gray-400",
};

const CAMPAIGN_STATUS_ORDER = ["Active", "Paused", "Draft", "Completed", "Finished", "Inactive", "Archived"];

/* ── Tab definitions ── */
const VIEW_TABS: { id: CampaignViewMode; label: string; icon: typeof List }[] = [
  { id: "list",  label: "List",  icon: List   },
  { id: "table", label: "Table", icon: Table2 },
];

function getCampaignName(c: Campaign): string {
  return String(c.name || "Unnamed");
}

function CampaignsContent() {
  // ── View mode (persisted) ──────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<CampaignViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored && ["list", "table"].includes(stored)) return stored as CampaignViewMode;
    } catch {}
    return "list";
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch {}
  }, [viewMode]);

  // Clear topbar actions (tabs are now inline)
  const { clearTopbarActions } = useTopbarActions();
  useEffect(() => { clearTopbarActions(); }, [clearTopbarActions]);

  // ── Lifted list-view controls ──────────────────────────────────────────────
  const [listSearch, setListSearch]     = useState("");
  const [searchOpen, setSearchOpen]     = useState(false);
  const [groupBy, setGroupBy]           = useState<CampaignGroupBy>("status");
  const [sortBy, setSortBy]             = useState<CampaignSortBy>("recent");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);

  const [filterAccountId] = useState<number | "all">("all");

  // ── Table toolbar state ────────────────────────────────────────────────────
  const [tableSearch,        setTableSearch]        = useState("");
  const [tableSearchOpen,    setTableSearchOpen]    = useState(false);
  const [tableSortBy,        setTableSortBy]        = useState<TableSortByOption>("recent");
  const [tableGroupBy,       setTableGroupBy]       = useState<TableGroupByOption>("status");
  const [tableFilterStatus,  setTableFilterStatus]  = useState<string[]>([]);
  const [tableFilterAccount, setTableFilterAccount] = useState<string>("");

  // ── Column visibility (persisted) ──────────────────────────────────────────
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(VISIBLE_COLS_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr) && arr.length > 0) return new Set(arr);
      }
    } catch {}
    return new Set(DEFAULT_VISIBLE);
  });

  useEffect(() => {
    try { localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify(Array.from(visibleCols))); } catch {}
  }, [visibleCols]);

  // ── Workspace & data ───────────────────────────────────────────────────────
  const { currentAccountId, isAgencyUser } = useWorkspace();

  const effectiveAccountId = useMemo(() => {
    if (!isAgencyUser) return currentAccountId;
    if (filterAccountId === "all") return undefined;
    return filterAccountId as number;
  }, [isAgencyUser, filterAccountId, currentAccountId]);

  const { campaigns, loading: campaignsLoading, handleRefresh, updateCampaignRow } = useCampaignsData(effectiveAccountId);
  const { metrics, loading: metricsLoading } = useCampaignMetrics();

  const loading = campaignsLoading || metricsLoading;

  // Auto-select first campaign when data arrives
  useEffect(() => {
    if (!selectedCampaign && campaigns.length > 0) {
      setSelectedCampaign(campaigns[0]);
    }
  }, [campaigns, selectedCampaign]);

  // Keep selectedCampaign in sync if the campaigns list refreshes
  useEffect(() => {
    if (selectedCampaign && campaigns.length > 0) {
      const cid = selectedCampaign.id || selectedCampaign.Id;
      const refreshed = campaigns.find((c) => (c.id || c.Id) === cid);
      if (refreshed) setSelectedCampaign(refreshed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns]);

  // ── View switch ────────────────────────────────────────────────────────────
  const handleViewSwitch = useCallback((mode: CampaignViewMode) => {
    setViewMode(mode);
    setSelectedCampaign(null);
  }, []);

  const handleSelectCampaign = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
  }, []);

  const handleEditCampaign = useCallback((campaign: Campaign) => {
    setEditCampaign(campaign);
    setEditPanelOpen(true);
  }, []);

  const handleCloseEditPanel = useCallback(() => {
    setEditPanelOpen(false);
    setEditCampaign(null);
  }, []);

  const handleToggleStatus = useCallback((campaign: Campaign) => {
    const cid = campaign.id || campaign.Id;
    const newStatus = String(campaign.status) === "Active" ? "Paused" : "Active";
    updateCampaignRow(cid, "status", newStatus);
    setSelectedCampaign((prev) =>
      prev && (prev.id || prev.Id) === cid ? { ...prev, status: newStatus } : prev
    );
  }, [updateCampaignRow]);

  // ── List-view control helpers ──────────────────────────────────────────────
  const isGroupNonDefault     = groupBy !== "status";
  const isSortNonDefault      = sortBy !== "recent";
  const isFilterActive        = filterStatus.length > 0;
  const hasNonDefaultControls = isGroupNonDefault || isSortNonDefault || isFilterActive;

  const toggleFilterStatus = useCallback((s: string) =>
    setFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const handleResetControls = useCallback(() => {
    setFilterStatus([]);
    setGroupBy("status");
    setSortBy("recent");
  }, []);

  // ── Table toolbar helpers ──────────────────────────────────────────────────
  const toggleTableFilterStatus = useCallback((s: string) =>
    setTableFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const clearTableFilters = useCallback(() => {
    setTableFilterStatus([]);
    setTableFilterAccount("");
  }, []);
  const isTableFilterActive    = tableFilterStatus.length > 0 || !!tableFilterAccount;
  const tableActiveFilterCount = tableFilterStatus.length + (tableFilterAccount ? 1 : 0);

  // ── Available accounts (for table filter dropdown) ─────────────────────────
  const availableAccounts = useMemo(() => {
    if (!isAgencyUser) return [];
    const seen = new Set<string>();
    campaigns.forEach((c) => {
      const acctName = String(c.account_name || "");
      if (acctName) seen.add(acctName);
    });
    return Array.from(seen).sort();
  }, [campaigns, isAgencyUser]);

  // ── Table flat items (filtered, sorted, grouped) ───────────────────────────
  const tableFlatItems = useMemo((): CampaignTableItem[] => {
    let source = [...campaigns];

    // Filter by status
    if (tableFilterStatus.length > 0) {
      source = source.filter((c) => tableFilterStatus.includes(String(c.status || "")));
    }
    // Filter by account
    if (tableFilterAccount) {
      source = source.filter((c) => String(c.account_name || "") === tableFilterAccount);
    }
    // Sort
    if (tableSortBy !== "recent") {
      source.sort((a, b) => {
        switch (tableSortBy) {
          case "name_asc":      return getCampaignName(a).localeCompare(getCampaignName(b));
          case "name_desc":     return getCampaignName(b).localeCompare(getCampaignName(a));
          case "leads_desc":    return Number(b.total_leads_targeted ?? 0) - Number(a.total_leads_targeted ?? 0);
          case "response_desc": return Number(b.response_rate_percent ?? 0) - Number(a.response_rate_percent ?? 0);
          default: return 0;
        }
      });
    }

    // No grouping
    if (tableGroupBy === "none") {
      return source.map((c) => ({ kind: "campaign" as const, campaign: c }));
    }

    // Group
    const buckets = new Map<string, Campaign[]>();
    source.forEach((c) => {
      let groupKey: string;
      switch (tableGroupBy) {
        case "account": groupKey = String(c.account_name || "No Account"); break;
        case "type":    groupKey = String(c.type || "No Type"); break;
        default:        groupKey = String(c.status || "Unknown");
      }
      if (!buckets.has(groupKey)) buckets.set(groupKey, []);
      buckets.get(groupKey)!.push(c);
    });

    const orderedKeys =
      tableGroupBy === "status"
        ? CAMPAIGN_STATUS_ORDER.filter((k) => buckets.has(k))
            .concat(Array.from(buckets.keys()).filter((k) => !CAMPAIGN_STATUS_ORDER.includes(k)))
        : Array.from(buckets.keys()).sort();

    const result: CampaignTableItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((c) => result.push({ kind: "campaign", campaign: c }));
    });
    return result;
  }, [campaigns, tableFilterStatus, tableFilterAccount, tableSortBy, tableGroupBy]);

  // ── Table toolbar (rendered inline with tab buttons) ───────────────────────
  const tableToolbar = (
    <>
      <div className="w-px h-4 bg-border/25 mx-0.5 shrink-0" />

      {/* Search */}
      {tableSearchOpen ? (
        <div className="flex items-center gap-1.5 rounded-full border border-border/30 bg-card/60 px-2.5 py-1 shrink-0">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Search..."
            onBlur={() => { if (!tableSearch) setTableSearchOpen(false); }}
            className="text-[12px] bg-transparent outline-none w-24 min-w-0 text-foreground placeholder:text-muted-foreground/60"
          />
          <button onClick={() => { setTableSearch(""); setTableSearchOpen(false); }}>
            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setTableSearchOpen(true)}
          className={cn(
            "h-7 w-7 rounded-full border flex items-center justify-center shrink-0 transition-colors",
            tableSearch
              ? "border-brand-blue/40 text-brand-blue"
              : "border-border/30 text-muted-foreground hover:text-foreground hover:bg-card"
          )}
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium border bg-transparent hover:bg-card hover:text-foreground shrink-0 transition-colors",
            tableSortBy !== "recent" ? "border-brand-blue/40 text-brand-blue" : "border-border/30 text-muted-foreground"
          )}>
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort{tableSortBy !== "recent" ? ` · ${TABLE_SORT_LABELS[tableSortBy].split(" ")[0]}` : ""}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(TABLE_SORT_LABELS) as TableSortByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableSortBy(opt)} className={cn("text-[12px]", tableSortBy === opt && "font-semibold text-brand-blue")}>
              {TABLE_SORT_LABELS[opt]}
              {tableSortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium border bg-transparent hover:bg-card hover:text-foreground shrink-0 transition-colors",
            isTableFilterActive ? "border-brand-blue/40 text-brand-blue" : "border-border/30 text-muted-foreground"
          )}>
            <Filter className="h-3.5 w-3.5" />
            Filter{isTableFilterActive ? ` · ${tableActiveFilterCount}` : ""}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); toggleTableFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[s] ?? "bg-zinc-400")} />
              <span className="flex-1">{s}</span>
              {tableFilterStatus.includes(s) && <Check className="h-3 w-3 text-brand-blue shrink-0" />}
            </DropdownMenuItem>
          ))}

          {availableAccounts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Account</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setTableFilterAccount(""); }} className={cn("text-[12px]", !tableFilterAccount && "font-semibold text-brand-blue")}>
                All Accounts {!tableFilterAccount && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableAccounts.map((a) => (
                <DropdownMenuItem key={a} onClick={(e) => { e.preventDefault(); setTableFilterAccount((p) => p === a ? "" : a); }} className={cn("text-[12px]", tableFilterAccount === a && "font-semibold text-brand-blue")}>
                  <span className="flex-1 truncate">{a}</span>
                  {tableFilterAccount === a && <Check className="h-3 w-3 ml-1 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {isTableFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearTableFilters} className="text-[12px] text-destructive">Clear all filters</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium border bg-transparent hover:bg-card hover:text-foreground shrink-0 transition-colors",
            tableGroupBy !== "status" ? "border-brand-blue/40 text-brand-blue" : "border-border/30 text-muted-foreground"
          )}>
            <Layers className="h-3.5 w-3.5" />
            Group{tableGroupBy !== "status" ? ` · ${TABLE_GROUP_LABELS[tableGroupBy]}` : ""}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(Object.keys(TABLE_GROUP_LABELS) as TableGroupByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableGroupBy(opt)} className={cn("text-[12px]", tableGroupBy === opt && "font-semibold text-brand-blue")}>
              {TABLE_GROUP_LABELS[opt]}
              {tableGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Fields (Column Visibility) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium border bg-transparent hover:bg-card hover:text-foreground shrink-0 transition-colors",
            visibleCols.size !== DEFAULT_VISIBLE.length ? "border-brand-blue/40 text-brand-blue" : "border-border/30 text-muted-foreground"
          )}>
            <Eye className="h-3.5 w-3.5" />
            Fields
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Show / Hide Columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TABLE_COL_META.map((col) => {
            const isVisible = visibleCols.has(col.key);
            return (
              <DropdownMenuItem
                key={col.key}
                onClick={(e) => {
                  e.preventDefault();
                  setVisibleCols((prev) => {
                    const next = new Set(prev);
                    if (next.has(col.key)) { if (next.size > 1) next.delete(col.key); }
                    else next.add(col.key);
                    return next;
                  });
                }}
                className="flex items-center gap-2 text-[12px]"
              >
                <div className={cn(
                  "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                  isVisible ? "bg-brand-blue border-brand-blue" : "border-border/50"
                )}>
                  {isVisible && <Check className="h-2 w-2 text-white" />}
                </div>
                <span className="flex-1">{col.label}</span>
                {!col.defaultVisible && (
                  <span className="text-[9px] text-muted-foreground/40 px-1 bg-muted rounded font-medium">+</span>
                )}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE))} className="text-[12px] text-muted-foreground">
            Reset to default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden">
          {viewMode === "list" ? (
            <CampaignListView
              campaigns={campaigns}
              metrics={metrics}
              loading={loading}
              selectedCampaign={selectedCampaign}
              onSelectCampaign={handleSelectCampaign}
              onEditCampaign={handleEditCampaign}
              onToggleStatus={handleToggleStatus}
              // Lifted controls
              viewMode={viewMode}
              onViewModeChange={handleViewSwitch}
              listSearch={listSearch}
              onListSearchChange={setListSearch}
              searchOpen={searchOpen}
              onSearchOpenChange={setSearchOpen}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              filterStatus={filterStatus}
              onToggleFilterStatus={toggleFilterStatus}
              hasNonDefaultControls={hasNonDefaultControls}
              isGroupNonDefault={isGroupNonDefault}
              isSortNonDefault={isSortNonDefault}
              onResetControls={handleResetControls}
            />
          ) : (
            <div className="flex-1 min-h-0 flex gap-[3px] overflow-hidden">
              <div className="flex flex-col bg-muted rounded-lg overflow-hidden flex-1 min-w-0">
                {/* Title */}
                <div className="px-3.5 pt-7 pb-1 shrink-0">
                  <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Campaigns</h2>
                </div>
                {/* Controls row: tabs + inline toolbar */}
                <div className="px-3 pt-1.5 pb-2.5 shrink-0 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
                  {VIEW_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = viewMode === tab.id;
                    return isActive ? (
                      <button
                        key={tab.id}
                        onClick={() => handleViewSwitch(tab.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF375] text-foreground text-[12px] font-semibold shrink-0"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    ) : (
                      <button
                        key={tab.id}
                        onClick={() => handleViewSwitch(tab.id)}
                        title={tab.label}
                        className="h-6 w-6 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
                      >
                        <Icon className="h-3 w-3" />
                      </button>
                    );
                  })}

                  {/* Inline table toolbar */}
                  {tableToolbar}
                </div>
                {/* Table content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <CampaignsInlineTable
                    flatItems={tableFlatItems}
                    loading={loading}
                    selectedCampaignId={selectedCampaign ? (selectedCampaign.id || (selectedCampaign as any).Id || null) : null}
                    onSelectCampaign={handleSelectCampaign}
                    onRefresh={handleRefresh}
                    visibleCols={visibleCols}
                    tableSearch={tableSearch}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit slide-over */}
      <CampaignDetailPanel
        campaign={editCampaign}
        metrics={metrics}
        open={editPanelOpen}
        onClose={handleCloseEditPanel}
      />
    </>
  );
}

export function CampaignsPage() {
  return (
    <CrmShell>
      <CampaignsContent />
    </CrmShell>
  );
}
