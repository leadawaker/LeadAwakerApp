import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  List, Table2, Plus, Trash2, Copy, Filter, Layers, Eye, Check, Search, X,
  PanelRightClose, PanelRightOpen, Loader2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CrmShell } from "@/components/crm/CrmShell";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { CampaignListView } from "../components/CampaignListView";
import { CampaignDetailPanel } from "../components/CampaignDetailPanel";
import { CampaignDetailView, CampaignDetailViewEmpty } from "../components/CampaignDetailView";
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
import { createCampaign, deleteCampaign, updateCampaign } from "../api/campaignsApi";
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

/* ── Table group / filter types ── */
type TableGroupByOption = "status" | "account" | "type" | "none";

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

// ── Inline confirmation button ────────────────────────────────────────────────
function ConfirmToolbarButton({
  icon: Icon, label, onConfirm, variant = "default",
}: {
  icon: React.ElementType; label: string;
  onConfirm: () => Promise<void> | void;
  variant?: "default" | "danger";
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  if (confirming) {
    return (
      <div className="h-10 flex items-center gap-1 rounded-full border border-border/30 bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{label}?</span>
        <button
          className="px-2 py-0.5 rounded-full bg-brand-indigo text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
          onClick={async () => { setLoading(true); try { await onConfirm(); } finally { setLoading(false); setConfirming(false); } }}
          disabled={loading}
        >
          {loading ? "…" : "Yes"}
        </button>
        <button className="px-2 py-0.5 rounded-full text-muted-foreground text-[11px] hover:text-foreground" onClick={() => setConfirming(false)}>No</button>
      </div>
    );
  }
  return (
    <button
      className={cn(
        "h-10 inline-flex items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium shrink-0",
        variant === "danger"
          ? "border-red-300/50 text-red-600 hover:bg-red-50/60"
          : "border-border/30 text-foreground/70 hover:bg-card hover:text-foreground",
      )}
      onClick={() => setConfirming(true)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
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

  // ── Right panel open/close (table view) ───────────────────────────────────
  const [rightPanelOpen, setRightPanelOpen] = useState(() => {
    try { return localStorage.getItem("campaigns-right-panel-open") !== "false"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("campaigns-right-panel-open", String(rightPanelOpen)); } catch {}
  }, [rightPanelOpen]);

  // ── Lifted list-view controls ──────────────────────────────────────────────
  const [listSearch, setListSearch]           = useState("");
  const [searchOpen, setSearchOpen]           = useState(false);
  const [groupBy, setGroupBy]                 = useState<CampaignGroupBy>("status");
  const [sortBy, setSortBy]                   = useState<CampaignSortBy>("recent");
  const [filterStatus, setFilterStatus]       = useState<string[]>([]);
  const [listFilterAccount, setListFilterAccount] = useState("");

  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);

  const [filterAccountId] = useState<number | "all">("all");

  // ── Table toolbar state ────────────────────────────────────────────────────
  const [tableSearch,        setTableSearch]        = useState("");
  const [tableSearchOpen,    setTableSearchOpen]    = useState(false);
  const [tableSortCol,       setTableSortCol]       = useState<string>("lastModified");
  const [tableSortDir,       setTableSortDir]       = useState<"asc" | "desc">("desc");
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

  // ── Responsive toolbar ──────────────────────────────────────────────────────
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setIsNarrow(entry.contentRect.width < 920);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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

  // ── Persisted selection (after data hook) ─────────────────────────────────
  const [selectedCampaign, setSelectedCampaign] = usePersistedSelection<Campaign>(
    "selected-campaign-id",
    (c) => (c as any).Id ?? (c as any).id ?? 0,
    campaigns,
  );

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

  const handleSaveCampaign = useCallback(async (id: number, patch: Record<string, unknown>) => {
    await updateCampaign(id, patch);
    handleRefresh();
  }, [handleRefresh]);

  // ── List-view control helpers ──────────────────────────────────────────────
  const isGroupNonDefault     = groupBy !== "status";
  const isSortNonDefault      = sortBy !== "recent";
  const isFilterActive        = filterStatus.length > 0 || !!listFilterAccount;
  const hasNonDefaultControls = isGroupNonDefault || isSortNonDefault || isFilterActive;

  const toggleFilterStatus = useCallback((s: string) =>
    setFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const handleResetControls = useCallback(() => {
    setFilterStatus([]);
    setGroupBy("status");
    setSortBy("recent");
    setListFilterAccount("");
  }, []);

  // ── Table toolbar helpers ──────────────────────────────────────────────────
  const toggleTableFilterStatus = useCallback((s: string) =>
    setTableFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const clearTableFilters = useCallback(() => {
    setTableFilterStatus([]);
    setTableFilterAccount("");
  }, []);
  const handleTableSortChange = useCallback((col: string) => {
    setTableSortCol((prev) => {
      if (prev === col) {
        setTableSortDir((d) => d === "asc" ? "desc" : "asc");
        return col;
      }
      setTableSortDir("asc");
      return col;
    });
  }, []);

  const isTableFilterActive    = tableFilterStatus.length > 0 || !!tableFilterAccount;
  const tableActiveFilterCount = tableFilterStatus.length + (tableFilterAccount ? 1 : 0);

  // ── Lifted multi-select state ──────────────────────────────────────────────
  const [tableSelectedIds, setTableSelectedIds] = useState<Set<number>>(new Set());

  const handleDeleteCampaign = useCallback(async (id: number) => {
    try {
      await deleteCampaign(id);
      setSelectedCampaign(null);
      handleRefresh();
    } catch (err) { console.error("Delete campaign failed", err); }
  }, [handleRefresh, setSelectedCampaign]);

  const handleAddCampaign = useCallback(async () => {
    try {
      const newCampaign = await createCampaign({ name: "New Campaign", status: "Draft", type: "Re-engagement", description: "", start_date: new Date().toISOString().slice(0, 10) });
      await handleRefresh();
      if (newCampaign?.id || newCampaign?.Id) {
        setSelectedCampaign(newCampaign);
        setTableSelectedIds(new Set([newCampaign.id ?? newCampaign.Id]));
      }
    } catch (err) { console.error("Create campaign failed", err); }
  }, [handleRefresh, setSelectedCampaign]);

  const handleBulkDeleteCampaigns = useCallback(async () => {
    if (tableSelectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(tableSelectedIds).map((id) => deleteCampaign(id)));
      setTableSelectedIds(new Set());
      setSelectedCampaign(null);
      handleRefresh();
    } catch (err) { console.error("Bulk delete campaigns failed", err); }
  }, [tableSelectedIds, handleRefresh, setSelectedCampaign]);

  const handleDuplicateCampaigns = useCallback(async () => {
    if (tableSelectedIds.size === 0) return;
    try {
      const toClone = campaigns.filter((c) => tableSelectedIds.has((c.id || (c as any).Id) ?? 0));
      for (const c of toClone) {
        await createCampaign({
          name: `${c.name || "Campaign"} (Copy)`,
          status: "Draft",
          description: c.description || "",
        });
      }
      setTableSelectedIds(new Set());
      handleRefresh();
    } catch (err) { console.error("Duplicate campaigns failed", err); }
  }, [tableSelectedIds, campaigns, handleRefresh]);

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
    // Sort by column
    if (tableSortCol) {
      const dir = tableSortDir === "asc" ? 1 : -1;
      source.sort((a, b) => {
        let va: any, vb: any;
        switch (tableSortCol) {
          case "name":
            return dir * getCampaignName(a).localeCompare(getCampaignName(b));
          case "status":
            return dir * String(a.status || "").localeCompare(String(b.status || ""));
          case "account":
            return dir * String(a.account_name || "").localeCompare(String(b.account_name || ""));
          case "type":
            return dir * String(a.type || "").localeCompare(String(b.type || ""));
          case "leads":
            va = Number(a.total_leads_targeted ?? 0);
            vb = Number(b.total_leads_targeted ?? 0);
            return dir * (va - vb);
          case "responseRate":
            va = Number(a.response_rate_percent ?? 0);
            vb = Number(b.response_rate_percent ?? 0);
            return dir * (va - vb);
          case "bookingRate":
            va = Number(a.booking_rate_percent ?? 0);
            vb = Number(b.booking_rate_percent ?? 0);
            return dir * (va - vb);
          case "cost":
            va = Number(a.total_cost ?? 0);
            vb = Number(b.total_cost ?? 0);
            return dir * (va - vb);
          case "roi":
            va = Number(a.roi_percent ?? 0);
            vb = Number(b.roi_percent ?? 0);
            return dir * (va - vb);
          case "startDate":
            return dir * (new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime());
          case "endDate":
            return dir * (new Date(a.end_date || 0).getTime() - new Date(b.end_date || 0).getTime());
          case "lastModified":
            va = new Date((a as any).updated_at || (a as any).nc_updated_at || 0).getTime();
            vb = new Date((b as any).updated_at || (b as any).nc_updated_at || 0).getTime();
            return dir * (va - vb);
          case "description":
            return dir * String(a.description || "").localeCompare(String(b.description || ""));
          default:
            return 0;
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
  }, [campaigns, tableFilterStatus, tableFilterAccount, tableSortCol, tableSortDir, tableGroupBy]);

  // ── Responsive toolbar class tokens ─────────────────────────────────────────
  const tbBase = "h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 select-none";
  const tbDefault = "border border-border/55 text-foreground/60 hover:text-foreground hover:bg-card";
  const tbActive  = "bg-card border border-border/55 text-foreground";

  // ── Table toolbar (rendered inline with tab buttons) ───────────────────────
  const tableToolbar = (
    <>
      <div className="w-px h-4 bg-border/25 mx-0.5 shrink-0" />

      {/* Search — responsive: expanded when wide, popover when narrow */}
      {isNarrow ? (
        <Popover open={tableSearchOpen} onOpenChange={setTableSearchOpen}>
          <PopoverTrigger asChild>
            <button className={cn(tbBase, "w-10 px-0 justify-center", tableSearch ? tbActive : tbDefault)}>
              <Search className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-56 p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search campaigns..."
                className="w-full pl-7 pr-7 py-1.5 text-[12px] rounded-md border border-border bg-popover placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <div className="flex items-center gap-1.5 h-10 rounded-full border border-border/30 bg-card/60 px-2.5 shrink-0">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="text-[12px] bg-transparent outline-none w-28 min-w-0 text-foreground placeholder:text-muted-foreground/60"
          />
          {tableSearch && (
            <button type="button" onClick={() => setTableSearch("")}>
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
      )}

      {/* +Add with confirmation (agency only) */}
      {isAgencyUser && (
        <ConfirmToolbarButton icon={Plus} label="Add" onConfirm={handleAddCampaign} />
      )}

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(tbBase, isTableFilterActive ? tbActive : tbDefault)}>
            <Filter className="h-4 w-4" />
            {!isNarrow && <>Filter{isTableFilterActive ? ` \u00b7 ${tableActiveFilterCount}` : ""}</>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); toggleTableFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[s] ?? "bg-zinc-400")} />
              <span className="flex-1">{s}</span>
              {tableFilterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}

          {availableAccounts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Account</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setTableFilterAccount(""); }} className={cn("text-[12px]", !tableFilterAccount && "font-semibold text-brand-indigo")}>
                All Accounts {!tableFilterAccount && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableAccounts.map((a) => (
                <DropdownMenuItem key={a} onClick={(e) => { e.preventDefault(); setTableFilterAccount((p) => p === a ? "" : a); }} className={cn("text-[12px]", tableFilterAccount === a && "font-semibold text-brand-indigo")}>
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
          <button className={cn(tbBase, tableGroupBy !== "status" ? tbActive : tbDefault)}>
            <Layers className="h-4 w-4" />
            {!isNarrow && <>Group{tableGroupBy !== "status" ? ` \u00b7 ${TABLE_GROUP_LABELS[tableGroupBy]}` : ""}</>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(Object.keys(TABLE_GROUP_LABELS) as TableGroupByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableGroupBy(opt)} className={cn("text-[12px]", tableGroupBy === opt && "font-semibold text-brand-indigo")}>
              {TABLE_GROUP_LABELS[opt]}
              {tableGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Fields (Column Visibility) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(tbBase, visibleCols.size !== DEFAULT_VISIBLE.length ? tbActive : tbDefault)}>
            <Eye className="h-4 w-4" />
            {!isNarrow && "Fields"}
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
                  isVisible ? "bg-brand-indigo border-brand-indigo" : "border-border/50"
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

      {/* ── Selection actions -- far right, visible when rows selected (agency only) ── */}
      {isAgencyUser && tableSelectedIds.size > 0 && (
        <>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-1 shrink-0">
            <ConfirmToolbarButton icon={Copy} label="Duplicate" onConfirm={handleDuplicateCampaigns} />
            <ConfirmToolbarButton icon={Trash2} label="Delete" onConfirm={handleBulkDeleteCampaigns} variant="danger" />
          </div>
        </>
      )}
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
              onEditCampaign={isAgencyUser ? handleEditCampaign : () => {}}
              onToggleStatus={isAgencyUser ? handleToggleStatus : () => {}}
              onSave={isAgencyUser ? handleSaveCampaign : async () => {}}
              onCreateCampaign={isAgencyUser ? handleAddCampaign : () => {}}
              onRefresh={handleRefresh}
              onDelete={isAgencyUser ? handleDeleteCampaign : undefined}
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
              filterAccount={listFilterAccount}
              onFilterAccountChange={setListFilterAccount}
              availableAccounts={availableAccounts}
              hasNonDefaultControls={hasNonDefaultControls}
              isGroupNonDefault={isGroupNonDefault}
              isSortNonDefault={isSortNonDefault}
              onResetControls={handleResetControls}
            />
          ) : (
            <div className="h-full flex gap-[3px] overflow-hidden min-h-0">
              <div className="flex flex-col bg-muted rounded-lg overflow-hidden flex-1 min-w-0">
                {/* Title */}
                <div className="px-3.5 pt-5 pb-1 shrink-0 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">Campaigns</h2>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium text-muted-foreground tabular-nums">{campaigns.length}</span>
                    <button
                      onClick={() => setRightPanelOpen((p) => !p)}
                      title={rightPanelOpen ? "Hide detail panel" : "Show detail panel"}
                      className="icon-circle-lg icon-circle-base"
                    >
                      {rightPanelOpen
                        ? <PanelRightClose className="h-4 w-4" />
                        : <PanelRightOpen className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {/* Controls row: tabs + inline toolbar */}
                <div ref={toolbarRef} className="px-3 pt-1.5 pb-3 shrink-0 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
                  {VIEW_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = viewMode === tab.id;
                    return isActive ? (
                      <button
                        key={tab.id}
                        onClick={() => handleViewSwitch(tab.id)}
                        className="h-10 inline-flex items-center gap-1.5 px-3 rounded-full bg-[#FFE35B] text-foreground text-[12px] font-semibold shrink-0"
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    ) : (
                      <button
                        key={tab.id}
                        onClick={() => handleViewSwitch(tab.id)}
                        title={tab.label}
                        className="icon-circle-lg icon-circle-base shrink-0"
                      >
                        <Icon className="h-4 w-4" />
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
                    selectedIds={tableSelectedIds}
                    onSelectionChange={setTableSelectedIds}
                    sortCol={tableSortCol}
                    sortDir={tableSortDir}
                    onSortChange={handleTableSortChange}
                    allCampaigns={campaigns}
                  />
                </div>
              </div>

              {/* Right panel: campaign detail view (single-column layout) */}
              {rightPanelOpen && (
                <div className="w-[480px] shrink-0 overflow-hidden rounded-lg">
                  {selectedCampaign ? (
                    <CampaignDetailView
                      campaign={selectedCampaign}
                      metrics={metrics}
                      allCampaigns={campaigns}
                      onToggleStatus={isAgencyUser ? handleToggleStatus : () => {}}
                      onSave={isAgencyUser ? handleSaveCampaign : async () => {}}
                      onRefresh={handleRefresh}
                      onDelete={isAgencyUser ? handleDeleteCampaign : undefined}
                      compact
                    />
                  ) : (
                    <CampaignDetailViewEmpty />
                  )}
                </div>
              )}
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
