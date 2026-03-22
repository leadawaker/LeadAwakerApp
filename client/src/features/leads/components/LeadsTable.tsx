import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useLeadsData } from "../hooks/useLeadsData";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import {
  applyLeadFilters,
  EMPTY_FILTERS,
  type LeadFilterState,
} from "./LeadFilters";
import {
  LeadsCardView,
  KanbanDetailPanel,
  getLeadId as getLeadIdHelper,
  getFullName as getFullNameHelper,
  type GroupByOption,
  type SortByOption,
} from "./LeadsCardView";
import { LeadsInlineTable } from "./LeadsInlineTable";
import { LeadsKanban } from "./LeadsKanban";
import { LeadDetailPanel } from "./LeadDetailPanel";
import { CsvImportWizard } from "./CsvImportWizard";
import { createLead, bulkDeleteLeads, bulkUpdateLeads, updateLead } from "../api/leadsApi";
import { apiFetch } from "@/lib/apiUtils";
import {
  Table2, List, Kanban,
  Plus, Trash2, Copy, ArrowUpDown, Filter, Layers, Pencil,
  FileSpreadsheet, Eye, Check, Upload, Download,
  Search, X, SlidersHorizontal, Flame, Phone, Mail, Columns3, Tag, Settings, Rows3, Shrink, Expand,
} from "lucide-react";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { SearchPill } from "@/components/ui/search-pill";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import type { VirtualListItem } from "./LeadsCardView";

type ViewMode = "list" | "table" | "pipeline";
type TableSortByOption  = "recent" | "name_asc" | "name_desc" | "score_desc" | "score_asc";
type TableGroupByOption = "status" | "campaign" | "account" | "none";

const VIEW_MODE_KEY    = "leads-view-mode";
const VISIBLE_COLS_KEY = "leads-table-visible-cols";
const LIST_PREFS_KEY   = "leads-list-prefs";
const TABLE_PREFS_KEY  = "leads-table-prefs";
const PIPE_PREFS_KEY   = "leads-pipe-prefs";
const COL_ORDER_KEY    = "leads-column-order";
const COL_WIDTHS_KEY   = "leads-column-widths";

/* ── Column metadata for the visibility dropdown ── */
const TABLE_COL_META = [
  { key: "name",         label: "Name",          defaultVisible: true  },
  { key: "status",       label: "Status",        defaultVisible: true  },
  { key: "score",        label: "Score",         defaultVisible: true  },
  { key: "phone",        label: "Phone",         defaultVisible: true  },
  { key: "email",        label: "Email",         defaultVisible: true  },
  { key: "campaign",     label: "Campaign",      defaultVisible: true  },
  { key: "tags",         label: "Tags",          defaultVisible: true  },
  { key: "lastActivity", label: "Last Activity", defaultVisible: true  },
  { key: "notes",        label: "Notes",         defaultVisible: true  },
  { key: "account",      label: "Account",       defaultVisible: false },
  { key: "source",       label: "Source",        defaultVisible: false },
  { key: "company",      label: "Company",       defaultVisible: false },
  { key: "bumpStage",    label: "Bump Stage",    defaultVisible: false },
  { key: "createdAt",    label: "Created",       defaultVisible: false },
  { key: "assignedTo",   label: "Assigned To",   defaultVisible: false },
];

const DEFAULT_VISIBLE_COLS = TABLE_COL_META
  .filter((c) => c.defaultVisible)
  .map((c) => c.key);

/* ── Tab definitions (labels resolved via t() inside component) ── */
const VIEW_TAB_KEYS: { id: string; tKey: string; icon: typeof List }[] = [
  { id: "list",     tKey: "viewTabs.list",     icon: List   },
  { id: "table",    tKey: "viewTabs.table",    icon: Table2 },
  { id: "pipeline", tKey: "viewTabs.pipeline", icon: Kanban },
];

/* ── Status group ordering ── */
const STATUS_GROUP_ORDER = [
  "New", "Contacted", "Responded", "Multiple Responses",
  "Qualified", "Booked", "Closed", "Lost", "DND",
];

const STATUS_OPTIONS = STATUS_GROUP_ORDER;

const STATUS_DOT: Record<string, string> = {
  New:                  "bg-gray-500",
  Contacted:            "bg-indigo-600",
  Responded:            "bg-teal-500",
  "Multiple Responses": "bg-green-500",
  Qualified:            "bg-lime-500",
  Booked:               "bg-amber-500",
  Closed:               "bg-emerald-500",
  Lost:                 "bg-red-500",
  DND:                  "bg-zinc-500",
};

const TABLE_SORT_TKEYS: Record<TableSortByOption, string> = {
  recent:     "sort.mostRecent",
  name_asc:   "sort.nameAZ",
  name_desc:  "sort.nameZA",
  score_desc: "sort.scoreDown",
  score_asc:  "sort.scoreUp",
};

const TABLE_GROUP_TKEYS: Record<TableGroupByOption, string> = {
  status:   "group.status",
  campaign: "group.campaign",
  account:  "group.account",
  none:     "group.none",
};

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
      <div className="h-9 flex items-center gap-1 rounded-full border border-black/[0.125] bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{label}?</span>
        <button
          className="px-2 py-0.5 rounded-full bg-brand-indigo text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
          onClick={async () => { setLoading(true); try { await onConfirm(); } finally { setLoading(false); setConfirming(false); } }}
          disabled={loading}
        >
          {loading ? "…" : "Yes"}
        </button>
        <button
          className="px-2 py-0.5 rounded-full text-muted-foreground text-[11px] hover:text-foreground"
          onClick={() => setConfirming(false)}
        >
          No
        </button>
      </div>
    );
  }
  return (
    <button
      className={cn(
        "h-9 inline-flex items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium shrink-0",
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

export function LeadsTable() {
  const { t } = useTranslation("leads");
  const VIEW_TABS: TabDef[] = useMemo(() => VIEW_TAB_KEYS.map((k) => ({ id: k.id, label: t(k.tKey), icon: k.icon })), [t]);
  const { currentAccountId, isAgencyView } = useWorkspace();
  const filterAccountId = currentAccountId > 0 ? currentAccountId : undefined;
  const { leads, loading, error, handleRefresh } = useLeadsData(filterAccountId);

  // Publish leads list entity data for AI agent context ("what leads are here")
  const publishEntity = usePublishEntityData();
  useEffect(() => {
    if (leads.length > 0) {
      const statusCounts: Record<string, number> = {};
      leads.forEach((l: any) => {
        const s = l.conversion_status || "unknown";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });
      publishEntity({
        entityType: "list",
        entityName: "Leads List",
        summary: {
          totalLeads: leads.length,
          statusBreakdown: statusCounts,
          recentLeads: leads.slice(0, 10).map((l: any) => ({
            id: l.id,
            name: l.full_name || `${l.first_name || ""} ${l.last_name || ""}`.trim(),
            status: l.conversion_status,
            source: l.source,
          })),
        },
        updatedAt: Date.now(),
      });
    }
  }, [leads, publishEntity]);

  /* ── Toolbar button constants ───────────────────────────────────────────── */
  const tbBase = "h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 select-none";

  /* ── Expand-on-hover icon-circle button helpers ─────────────────────────── */
  const xBase = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
  const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
  const xActive  = "border-brand-indigo text-brand-indigo";
  const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";
  const tbDefault = "border border-black/[0.125] text-foreground/60 hover:text-foreground hover:bg-card";

  /* ── View mode (persisted) ─────────────────────────────────────────────── */
  // If navigating from an external page (e.g. calendar event popup), open detail automatically
  const [mobileView, setMobileView] = useState<"list" | "detail">(() => {
    try {
      const returnTo = localStorage.getItem("leadawaker-returnto");
      const storedLeadId = localStorage.getItem("selected-lead-id");
      if (returnTo && storedLeadId) return "detail";
    } catch {}
    return "list";
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored && ["list", "table", "pipeline"].includes(stored)) return stored as ViewMode;
    } catch {}
    return "list";
  });

  const [selectedLead,   setSelectedLead]   = usePersistedSelection<Record<string, any>>(
    "selected-lead-id",
    (l) => l.Id ?? l.id,
    leads,
  );
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  // ── Lifted multi-select state ─────────────────────────────────────────────
  const [tableSelectedIds, setTableSelectedIds] = useState<Set<number>>(new Set());
  const [leadFilters]    = useState<LeadFilterState>({ ...EMPTY_FILTERS });

  /* ── Tag data ────────────────────────────────────────────────────────────── */
  const [allTagsById,  setAllTagsById]  = useState<Map<number, { name: string; color: string }>>(new Map());

  /* ── Pipeline-specific state ────────────────────────────────────────────── */
  const [showTagsAlways, setShowTagsAlways] = useState<boolean>(() => {
    try { return localStorage.getItem("kanban_tags_always_show") === "true"; } catch { /* noop */ } return false;
  });
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    try { return localStorage.getItem("kanban_compact_mode") === "true"; } catch { /* noop */ } return false;
  });
  const [kanbanSearchQuery, setKanbanSearchQuery] = useState("");
  const [kanbanSearchOpen, setKanbanSearchOpen] = useState(true);
  const [pipePrefs, setPipePrefs] = usePersistedState(PIPE_PREFS_KEY, {
    showHighScore: false,
    filterHasPhone: false,
    filterHasEmail: false,
    sortBy: null as "score-desc" | "recency" | "alpha" | null,
  });
  const showHighScore = pipePrefs.showHighScore;
  const filterHasPhone = pipePrefs.filterHasPhone;
  const filterHasEmail = pipePrefs.filterHasEmail;
  const pipelineSortBy = pipePrefs.sortBy;
  const setShowHighScore = useCallback((v: boolean) => setPipePrefs(p => ({ ...p, showHighScore: v })), [setPipePrefs]);
  const setFilterHasPhone = useCallback((v: boolean) => setPipePrefs(p => ({ ...p, filterHasPhone: v })), [setPipePrefs]);
  const setFilterHasEmail = useCallback((v: boolean) => setPipePrefs(p => ({ ...p, filterHasEmail: v })), [setPipePrefs]);
  const setPipelineSortBy = useCallback((v: "score-desc" | "recency" | "alpha" | null) => setPipePrefs(p => ({ ...p, sortBy: v })), [setPipePrefs]);
  const [foldAction, setFoldAction] = useState<{ type: "expand-all" | "fold-empty" | "fold-threshold"; threshold?: number; seq: number }>({ type: "expand-all", seq: 0 });
  const [hasAnyCollapsed, setHasAnyCollapsed] = useState(false);
  const [selectedKanbanLead, setSelectedKanbanLead] = useState<Record<string, any> | null>(null);
  const [fullProfileLead, setFullProfileLead] = useState<Record<string, any> | null>(null);

  /* ── Lifted list-view controls (persisted) ───────────────────────────────── */
  const [listSearch,   setListSearch]   = useState("");
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [listPrefs, setListPrefs]       = usePersistedState(LIST_PREFS_KEY, {
    groupBy: "date" as GroupByOption,
    sortBy: "recent" as SortByOption,
    filterStatus: [] as string[],
    filterTags: [] as string[],
  });
  const groupBy = listPrefs.groupBy;
  const sortBy = listPrefs.sortBy;
  const filterStatus = listPrefs.filterStatus;
  const filterTags = listPrefs.filterTags;
  const setGroupBy = useCallback((v: GroupByOption) => setListPrefs(p => ({ ...p, groupBy: v })), [setListPrefs]);
  const setSortBy = useCallback((v: SortByOption) => setListPrefs(p => ({ ...p, sortBy: v })), [setListPrefs]);
  const setFilterStatus = useCallback((v: string[] | ((p: string[]) => string[])) => setListPrefs(p => ({ ...p, filterStatus: typeof v === "function" ? v(p.filterStatus) : v })), [setListPrefs]);
  const setFilterTags = useCallback((v: string[] | ((p: string[]) => string[])) => setListPrefs(p => ({ ...p, filterTags: typeof v === "function" ? v(p.filterTags) : v })), [setListPrefs]);

  /* ── Table toolbar state (persisted) ─────────────────────────────────────── */
  const [tableSearch,         setTableSearch]         = useState("");
  const [tablePrefs, setTablePrefs] = usePersistedState(TABLE_PREFS_KEY, {
    sortBy: "recent" as TableSortByOption,
    filterStatus: [] as string[],
    filterCampaign: "",
    filterAccount: "",
    groupBy: "status" as TableGroupByOption,
  });
  const tableSortBy = tablePrefs.sortBy;
  const tableFilterStatus = tablePrefs.filterStatus;
  const tableFilterCampaign = tablePrefs.filterCampaign;
  const tableFilterAccount = tablePrefs.filterAccount;
  const tableGroupBy = tablePrefs.groupBy;
  const setTableSortBy = useCallback((v: TableSortByOption) => setTablePrefs(p => ({ ...p, sortBy: v })), [setTablePrefs]);
  const setTableFilterStatus = useCallback((v: string[] | ((p: string[]) => string[])) => setTablePrefs(p => ({ ...p, filterStatus: typeof v === "function" ? v(p.filterStatus) : v })), [setTablePrefs]);
  const setTableFilterCampaign = useCallback((v: string) => setTablePrefs(p => ({ ...p, filterCampaign: v })), [setTablePrefs]);
  const setTableFilterAccount = useCallback((v: string) => setTablePrefs(p => ({ ...p, filterAccount: v })), [setTablePrefs]);
  const setTableGroupBy = useCallback((v: TableGroupByOption) => setTablePrefs(p => ({ ...p, groupBy: v })), [setTablePrefs]);

  /* ── Column visibility (persisted) ──────────────────────────────────────── */
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(VISIBLE_COLS_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr) && arr.length > 0) return new Set(arr);
      }
    } catch {}
    return new Set(DEFAULT_VISIBLE_COLS);
  });

  /* ── Column order persistence ────────────────────────────────────────────── */
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(COL_ORDER_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  useEffect(() => {
    try { localStorage.setItem(COL_ORDER_KEY, JSON.stringify(columnOrder)); } catch {}
  }, [columnOrder]);

  /* ── Column widths persistence ─────────────────────────────────────────── */
  const [columnWidths, setColumnWidths] = usePersistedState<Record<string, number>>(COL_WIDTHS_KEY, {});

  /* ── Settings toggles (persisted) ──────────────────────────────────────── */
  const [showVerticalLines, setShowVerticalLines] = useState(() => {
    try { return localStorage.getItem("leads-vertical-lines") === "true"; } catch { return false; }
  });
  const [fullWidthTable, setFullWidthTable] = useState(() => {
    try { return localStorage.getItem("leads-full-width") === "true"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("leads-vertical-lines", String(showVerticalLines)); } catch {} }, [showVerticalLines]);
  useEffect(() => {
    try { localStorage.setItem("leads-full-width", String(fullWidthTable)); } catch {}
    window.dispatchEvent(new Event("leads-fullwidth-change"));
    // Direct DOM fallback: toggle classes on CrmShell content wrapper
    const el = document.getElementById("crm-content-wrapper");
    if (el) {
      if (fullWidthTable) {
        el.classList.remove("px-3", "md:pl-0", "md:pr-5", "max-w-[1729px]");
        el.classList.add("px-1", "md:px-1");
      } else {
        el.classList.remove("px-1", "md:px-1");
        el.classList.add("px-3", "md:pl-0", "md:pr-5", "max-w-[1729px]");
      }
    }
  }, [fullWidthTable]);
  // Clean up full-width on unmount (navigating away from leads)
  useEffect(() => {
    return () => {
      const el = document.getElementById("crm-content-wrapper");
      if (el) {
        el.classList.remove("px-1", "md:px-1");
        el.classList.add("px-3", "md:pl-0", "md:pr-5", "max-w-[1729px]");
      }
    };
  }, []);

  /* ── Accounts (agency view) ──────────────────────────────────────────────── */
  const [accountsById, setAccountsById] = useState<Map<number, string>>(new Map());
  /* ── Campaigns (id → { name, accountId }) ──────────────────────────────── */
  const [campaignsById, setCampaignsById] = useState<Map<number, { name: string; accountId: number | null; bookingMode: string | null }>>(new Map());

  /* ── Persist view mode ───────────────────────────────────────────────────── */
  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch {}
  }, [viewMode]);

  /* ── Persist visible columns ────────────────────────────────────────────── */
  useEffect(() => {
    try { localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify(Array.from(visibleCols))); } catch {}
  }, [visibleCols]);

  /* ── Clear topbar actions ───────────────────────────────────────────────── */
  const { clearTopbarActions } = useTopbarActions();
  useEffect(() => { clearTopbarActions(); }, [clearTopbarActions]);

  /* ── Fetch all tags ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const fetchAllTags = async () => {
      try {
        const res = await apiFetch("/api/tags");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.list || [];
          const byId = new Map<number, { name: string; color: string }>();
          list.forEach((t: any) => {
            byId.set(t.id, { name: t.name || `Tag ${t.id}`, color: t.color || "gray" });
          });
          setAllTagsById(byId);
        }
      } catch (err) { console.error("Failed to fetch all tags", err); }
    };
    fetchAllTags();
  }, []);

  /* ── Fetch accounts (agency view) ───────────────────────────────────────── */
  useEffect(() => {
    if (!isAgencyView) return;
    const fetchAccountData = async () => {
      try {
        const res = await apiFetch("/api/accounts");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.list || [];
          const byId = new Map<number, string>();
          list.forEach((a: any) => {
            const id = a.id ?? a.Id;
            byId.set(Number(id), a.name || a.Name || `Account ${id}`);
          });
          setAccountsById(byId);
        }
      } catch (err) { console.error("Failed to fetch accounts", err); }
    };
    fetchAccountData();
  }, [isAgencyView]);

  /* ── Fetch campaigns ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const fetchCampaignData = async () => {
      try {
        const res = await apiFetch("/api/campaigns");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.list || [];
          const byId = new Map<number, { name: string; accountId: number | null; bookingMode: string | null }>();
          list.forEach((c: any) => {
            const id = c.id ?? c.Id;
            byId.set(Number(id), {
              name: c.name || c.Name || c.campaign_name || `Campaign ${id}`,
              accountId: c.Accounts_id ?? c.accounts_id ?? c.accountsId ?? null,
              bookingMode: c.booking_mode_override ?? c.bookingModeOverride ?? null,
            });
          });
          setCampaignsById(byId);
        }
      } catch (err) { console.error("Failed to fetch campaigns", err); }
    };
    fetchCampaignData();
  }, []);

  /* ── Derive leadTagMap from tag_ids embedded in lead objects ────────────── */
  const leadTagMap = useMemo((): Map<number, number[]> => {
    const m = new Map<number, number[]>();
    leads.forEach((l: any) => {
      const ids: number[] = Array.isArray(l.tag_ids) ? l.tag_ids : [];
      if (ids.length > 0) m.set(l.Id ?? l.id, ids);
    });
    return m;
  }, [leads]);

  /* ── Derive leadTagsInfo from leadTagMap + allTagsById ───────────────────── */
  const leadTagsInfo = useMemo((): Map<number, { name: string; color: string }[]> => {
    const info = new Map<number, { name: string; color: string }[]>();
    leadTagMap.forEach((tagIds, leadId) => {
      const tagDetails = tagIds
        .map((id) => allTagsById.get(id))
        .filter((t): t is { name: string; color: string } => !!t);
      if (tagDetails.length > 0) info.set(leadId, tagDetails);
    });
    return info;
  }, [leadTagMap, allTagsById]);

  /* ── Filtered leads (applies list-view structured filters) ──────────────── */
  const filteredLeads = useMemo(() => {
    let result = applyLeadFilters(leads, leadFilters, leadTagMap);
    result = result.map((l) => {
      const tags = leadTagsInfo.get(l.Id);
      const primaryTag = tags && tags.length > 0 ? tags[0].name : "Untagged";
      return { ...l, _primary_tag: primaryTag };
    });
    return result;
  }, [leads, leadFilters, leadTagMap, leadTagsInfo]);

  /* ── Pipeline-filtered leads (applies kanban-specific filters) ────────── */
  const filteredPipelineLeads = useMemo(() => {
    let filtered = filteredLeads;
    if (showHighScore) filtered = filtered.filter((l: any) => Number(l.lead_score ?? l.leadScore ?? l.Lead_Score ?? 0) >= 70);
    if (filterHasPhone) filtered = filtered.filter((l: any) => Boolean(l.phone || l.Phone));
    if (filterHasEmail) filtered = filtered.filter((l: any) => Boolean(l.email || l.Email));
    if (kanbanSearchQuery.trim()) {
      const q = kanbanSearchQuery.toLowerCase();
      filtered = filtered.filter((l: any) => {
        const name = (l.full_name || [l.first_name, l.last_name].filter(Boolean).join(" ") || "").toLowerCase();
        return name.includes(q) || (l.phone || "").includes(q) || (l.email || "").includes(q);
      });
    }
    if (pipelineSortBy === "score-desc") {
      filtered = [...filtered].sort((a, b) => Number(b.lead_score ?? b.leadScore ?? b.Lead_Score ?? 0) - Number(a.lead_score ?? a.leadScore ?? a.Lead_Score ?? 0));
    } else if (pipelineSortBy === "recency") {
      filtered = [...filtered].sort((a, b) => {
        const aDate = new Date(a.last_interaction_at || a.last_message_received_at || a.created_at || 0).getTime();
        const bDate = new Date(b.last_interaction_at || b.last_message_received_at || b.created_at || 0).getTime();
        return bDate - aDate;
      });
    } else if (pipelineSortBy === "alpha") {
      filtered = [...filtered].sort((a, b) => {
        const na = (a.full_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || "").toLowerCase();
        const nb = (b.full_name || [b.first_name, b.last_name].filter(Boolean).join(" ") || "").toLowerCase();
        return na.localeCompare(nb);
      });
    }
    return filtered;
  }, [filteredLeads, showHighScore, filterHasPhone, filterHasEmail, kanbanSearchQuery, pipelineSortBy]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem("kanban_tags_always_show", String(showTagsAlways)); } catch { /* noop */ } }, [showTagsAlways]);
  useEffect(() => { try { localStorage.setItem("kanban_compact_mode", String(compactMode)); } catch { /* noop */ } }, [compactMode]);

  const pipelineActiveFilterCount = (showHighScore ? 1 : 0) + (filterHasPhone ? 1 : 0) + (filterHasEmail ? 1 : 0);
  const isPipelineFilterActive = pipelineActiveFilterCount > 0;
  const isPipelineSortActive = pipelineSortBy !== null;
  const clearPipelineFilters = useCallback(() => { setShowHighScore(false); setFilterHasPhone(false); setFilterHasEmail(false); }, []);

  const handleKanbanLeadMove = useCallback(
    async (leadId: number | string, newStage: string) => {
      try {
        await updateLead(leadId, { Conversion_Status: newStage });
        handleRefresh();
      } catch (err) {
        console.error("Failed to move lead to new stage", err);
        handleRefresh();
        throw err;
      }
    },
    [handleRefresh]
  );

  const handleCloseKanbanPanel = useCallback(() => { setSelectedKanbanLead(null); }, []);

  /* ── Derived data for table filter dropdowns ─────────────────────────────── */
  const availableAccounts = useMemo(() => {
    if (!isAgencyView) return [];
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    filteredLeads.forEach((l) => {
      const accountId = String(l.Accounts_id || l.account_id || "");
      if (accountId && !seen.has(accountId)) {
        seen.add(accountId);
        const name = accountsById.get(Number(accountId)) || `Account ${accountId}`;
        result.push({ id: accountId, name });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredLeads, isAgencyView, accountsById]);

  const availableCampaigns = useMemo(() => {
    // Collect campaign IDs present in leads (optionally scoped to selected account)
    const campaignIds = new Set<number>();
    filteredLeads.forEach((l) => {
      if (tableFilterAccount && String(l.Accounts_id || l.account_id || "") !== tableFilterAccount) return;
      const cId = Number(l.Campaigns_id || l.campaigns_id || l.campaignsId || 0);
      if (cId) campaignIds.add(cId);
    });
    const result: { id: string; name: string }[] = [];
    campaignIds.forEach((cId) => {
      const info = campaignsById.get(cId);
      result.push({ id: String(cId), name: info?.name || `Campaign ${cId}` });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredLeads, campaignsById, tableFilterAccount]);

  /* ── Table flat items — filtered, sorted, grouped ───────────────────────── */
  const tableFlatItems = useMemo((): VirtualListItem[] => {
    let source = filteredLeads;

    if (tableFilterStatus.length > 0) {
      source = source.filter((l) =>
        tableFilterStatus.includes(l.conversion_status || l.Conversion_Status || "")
      );
    }
    if (tableFilterAccount) {
      source = source.filter((l) =>
        String(l.Accounts_id || l.account_id || "") === tableFilterAccount
      );
    }
    if (tableFilterCampaign) {
      source = source.filter((l) =>
        String(l.Campaigns_id || l.campaigns_id || l.campaignsId || "") === tableFilterCampaign
      );
    }
    if (tableSortBy !== "recent") {
      source = [...source].sort((a, b) => {
        switch (tableSortBy) {
          case "name_asc":   return getFullNameHelper(a).localeCompare(getFullNameHelper(b));
          case "name_desc":  return getFullNameHelper(b).localeCompare(getFullNameHelper(a));
          case "score_desc": return Number(b.lead_score ?? b.leadScore ?? 0) - Number(a.lead_score ?? a.leadScore ?? 0);
          case "score_asc":  return Number(a.lead_score ?? a.leadScore ?? 0) - Number(b.lead_score ?? b.leadScore ?? 0);
          default: return 0;
        }
      });
    }

    if (tableGroupBy === "none") {
      const result: VirtualListItem[] = [];
      source.forEach((l) =>
        result.push({ kind: "lead", lead: l, tags: leadTagsInfo.get(l.Id || l.id) || [] })
      );
      return result;
    }

    const buckets = new Map<string, Record<string, any>[]>();
    source.forEach((l) => {
      let groupKey: string;
      switch (tableGroupBy) {
        case "campaign": {
          const cId = Number(l.Campaigns_id || l.campaigns_id || l.campaignsId || 0);
          groupKey = (cId && campaignsById.get(cId)?.name) || l.Campaign || l.campaign || l.campaign_name || "No Campaign";
        }
          break;
        case "account":
          groupKey = accountsById.get(Number(l.Accounts_id || l.account_id)) ||
            (l.Accounts_id || l.account_id ? `Account ${l.Accounts_id || l.account_id}` : "No Account");
          break;
        default: // status
          groupKey = l.conversion_status || l.Conversion_Status || "Unknown";
      }
      if (!buckets.has(groupKey)) buckets.set(groupKey, []);
      buckets.get(groupKey)!.push(l);
    });

    const orderedKeys =
      tableGroupBy === "status"
        ? STATUS_GROUP_ORDER.filter((k) => buckets.has(k))
            .concat(Array.from(buckets.keys()).filter((k) => !STATUS_GROUP_ORDER.includes(k)))
        : Array.from(buckets.keys()).sort();

    const result: VirtualListItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      const headerLabel = tableGroupBy === "status"
        ? t(`kanban.stageLabels.${key.replace(/ /g, "")}`, key)
        : key;
      result.push({ kind: "header", label: headerLabel, count: group.length });
      group.forEach((l) =>
        result.push({ kind: "lead", lead: l, tags: leadTagsInfo.get(l.Id || l.id) || [] })
      );
    });
    return result;
  }, [filteredLeads, leadTagsInfo, tableFilterStatus, tableFilterCampaign, tableFilterAccount, tableSortBy, tableGroupBy, accountsById, campaignsById]);

  const handleViewSwitch = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setSelectedLead(null);
    setMobileView("list");
  }, []);

  const handleClosePanel = useCallback(() => { setSelectedLead(null); }, []);

  /* ── Auto-select first lead (list view) ─────────────────────────────────── */
  /* Only fires when there is no persisted selection to restore. If a stored ID
     exists AND that lead is present in the current list, defer to
     usePersistedSelection to restore it instead of clobbering it. */
  useEffect(() => {
    if (!selectedLead && filteredLeads.length > 0 && viewMode === "list") {
      const storedId = localStorage.getItem("selected-lead-id");
      const storedLeadExists =
        storedId &&
        filteredLeads.some((l) => String(l.Id ?? l.id) === storedId);
      if (!storedLeadExists) {
        setSelectedLead(filteredLeads[0]);
      }
    }
  }, [filteredLeads, selectedLead, viewMode]);

  /* ── Breadcrumb ─────────────────────────────────────────────────────────── */
  const { setCrumb } = useBreadcrumb();
  useEffect(() => {
    setCrumb(selectedLead ? getFullNameHelper(selectedLead) : null);
    return () => setCrumb(null);
  }, [selectedLead, setCrumb]);

  /* ── List-view helpers ──────────────────────────────────────────────────── */
  const allTags = useMemo(() => {
    const seen = new Map<string, { name: string; color: string }>();
    leadTagsInfo.forEach((tags) => tags.forEach((t) => { if (!seen.has(t.name)) seen.set(t.name, t); }));
    return Array.from(seen.values());
  }, [leadTagsInfo]);

  const isGroupNonDefault     = groupBy !== "date";
  const isSortNonDefault      = sortBy !== "recent";
  const isFilterActive        = filterStatus.length > 0 || filterTags.length > 0;
  const hasNonDefaultControls = isGroupNonDefault || isSortNonDefault || isFilterActive;

  const toggleFilterStatus  = useCallback((s: string) =>
    setFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]), []);
  const toggleFilterTag     = useCallback((t: string) =>
    setFilterTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]), []);
  const handleResetControls = useCallback(() => {
    setFilterStatus([]); setFilterTags([]); setGroupBy("date"); setSortBy("recent");
  }, []);

  /* ── Table toolbar helpers ──────────────────────────────────────────────── */
  const toggleTableFilterStatus = useCallback((s: string) =>
    setTableFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]), []);
  const clearTableFilters = useCallback(() => {
    setTableFilterStatus([]); setTableFilterCampaign(""); setTableFilterAccount("");
  }, []);
  const isTableFilterActive    = tableFilterStatus.length > 0 || !!tableFilterCampaign || !!tableFilterAccount;
  const tableActiveFilterCount = tableFilterStatus.length + (tableFilterCampaign ? 1 : 0) + (tableFilterAccount ? 1 : 0);

  const handleAddLead = useCallback(async () => {
    try {
      const newLead = await createLead({ first_name: "New", last_name: "Lead", phone: "" });
      await handleRefresh();
      if (newLead?.id || newLead?.Id) {
        setSelectedLead(newLead);
        setTableSelectedIds(new Set([newLead.id ?? newLead.Id]));
      }
    } catch (err) { console.error("Create lead failed", err); }
  }, [handleRefresh, setSelectedLead]);

  const handleBulkDeleteLeads = useCallback(async () => {
    if (tableSelectedIds.size === 0) return;
    try {
      await bulkDeleteLeads(Array.from(tableSelectedIds));
      setTableSelectedIds(new Set());
      setSelectedLead(null);
      handleRefresh();
    } catch (err) { console.error("Bulk delete failed", err); }
  }, [tableSelectedIds, handleRefresh, setSelectedLead]);

  const handleDuplicateLeads = useCallback(async () => {
    if (tableSelectedIds.size === 0) return;
    try {
      const leadsToClone = leads.filter((l) => tableSelectedIds.has(l.Id ?? l.id ?? 0));
      for (const lead of leadsToClone) {
        await createLead({
          first_name: lead.first_name || lead.full_name || "Copy",
          last_name: lead.last_name || "",
          phone: lead.phone || lead.Phone || "",
          email: lead.email || lead.Email || "",
          Conversion_Status: lead.conversion_status || lead.Conversion_Status || "New",
          notes: lead.notes || lead.Notes || "",
        });
      }
      setTableSelectedIds(new Set());
      handleRefresh();
    } catch (err) { console.error("Duplicate leads failed", err); }
  }, [tableSelectedIds, leads, handleRefresh]);

  const handleBulkStageChange = useCallback(async (stage: string) => {
    if (tableSelectedIds.size === 0) return;
    try {
      await bulkUpdateLeads(Array.from(tableSelectedIds), { Conversion_Status: stage });
      setTableSelectedIds(new Set());
      handleRefresh();
    } catch (err) { console.error("Bulk stage change failed", err); }
  }, [tableSelectedIds, handleRefresh]);

  const handleExportCsv = useCallback(() => {
    const headers = [t("table.columns.name"), t("table.columns.status"), t("table.columns.score"), t("table.columns.phone"), t("table.columns.email"), t("table.columns.campaign"), t("table.columns.tags"), t("table.columns.lastActivity"), t("table.columns.notes")];
    const rows = tableFlatItems
      .filter((i): i is Extract<VirtualListItem, { kind: "lead" }> => i.kind === "lead")
      .map((item) => {
        const l = item.lead;
        const tags = leadTagsInfo.get(l.Id ?? l.id ?? 0) || [];
        const name = getFullNameHelper(l);
        const d    = l.last_interaction_at || l.last_message_received_at || l.last_message_sent_at || "";
        let lastActivity = "";
        if (d) {
          try {
            const diffDays = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
            if (diffDays === 0) lastActivity = t("time.today");
            else if (diffDays === 1) lastActivity = t("relativeTime.yesterday");
            else if (diffDays < 7)  lastActivity = t("relativeTime.daysAgo", { count: diffDays });
            else                    lastActivity = t("relativeTime.weeksAgo", { count: Math.floor(diffDays / 7) });
          } catch {}
        }
        const row = [
          name,
          l.conversion_status || l.Conversion_Status || "",
          String(l.lead_score || l.leadScore || 0),
          l.phone || l.Phone || "",
          l.email || l.Email || "",
          l.Campaign || l.campaign || l.campaign_name || "",
          tags.map((t) => t.name).join("; "),
          lastActivity,
          l.notes || l.Notes || "",
        ];
        return row.map((v) =>
          v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v
        ).join(",");
      });
    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tableFlatItems, leadTagsInfo]);

  /* ── Error fallback ─────────────────────────────────────────────────────── */
  if (error && !loading) {
    return <ApiErrorFallback error={error} onRetry={handleRefresh} isRetrying={loading} />;
  }

  /* ── Table toolbar (rendered inline below title) ────────────────────────── */
  const tableToolbar = (
    <>
      {/* +Add */}
      <button onClick={handleAddLead} className={cn(xBase, "hover:max-w-[90px]", xDefault)}>
        <Plus className="h-4 w-4 shrink-0" />
        <span className={xSpan}>{t("toolbar.add")}</span>
      </button>

      {/* Search — always extended, no fill */}
      <SearchPill
        value={tableSearch}
        onChange={setTableSearch}
        open={true}
        onOpenChange={() => {}}
        placeholder={t("toolbar.searchPlaceholder")}
      />

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[115px]", tableGroupBy !== "status" ? xActive : xDefault)}>
            <Layers className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.group")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(["status", "campaign", "account", "none"] as TableGroupByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableGroupBy(opt)} className={cn("text-[12px]", tableGroupBy === opt && "font-semibold text-brand-indigo")}>
              {t(TABLE_GROUP_TKEYS[opt])}
              {tableGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[100px]", tableSortBy !== "recent" ? xActive : xDefault)}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("sort.sortBy")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(["recent", "name_asc", "name_desc", "score_desc", "score_asc"] as TableSortByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableSortBy(opt)} className={cn("text-[12px]", tableSortBy === opt && "font-semibold text-brand-indigo")}>
              {t(TABLE_SORT_TKEYS[opt])}
              {tableSortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[110px]", isTableFilterActive ? xActive : xDefault)}>
            <Filter className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.filter")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("group.status")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); toggleTableFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[s] ?? "bg-zinc-400")} />
              <span className="flex-1">{t(`kanban.stageLabels.${s.replace(/ /g, "")}`, s)}</span>
              {tableFilterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}

          {availableAccounts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("group.account")}</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setTableFilterAccount(""); setTableFilterCampaign(""); }} className={cn("text-[12px]", !tableFilterAccount && "font-semibold text-brand-indigo")}>
                {t("filters.allAccounts")} {!tableFilterAccount && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableAccounts.map((a) => (
                <DropdownMenuItem key={a.id} onClick={(e) => { e.preventDefault(); if (tableFilterAccount === a.id) { setTableFilterAccount(""); } else { setTableFilterAccount(a.id); setTableFilterCampaign(""); } }} className={cn("text-[12px]", tableFilterAccount === a.id && "font-semibold text-brand-indigo")}>
                  <span className="flex-1 truncate">{a.name}</span>
                  {tableFilterAccount === a.id && <Check className="h-3 w-3 ml-1 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {availableCampaigns.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("group.campaign")}{tableFilterAccount ? ` (${accountsById.get(Number(tableFilterAccount)) || t("group.account")})` : ""}</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setTableFilterCampaign(""); }} className={cn("text-[12px]", !tableFilterCampaign && "font-semibold text-brand-indigo")}>
                {t("filters.allCampaigns")} {!tableFilterCampaign && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableCampaigns.map((c) => (
                <DropdownMenuItem key={c.id} onClick={(e) => { e.preventDefault(); setTableFilterCampaign(tableFilterCampaign === c.id ? "" : c.id); }} className={cn("text-[12px]", tableFilterCampaign === c.id && "font-semibold text-brand-indigo")}>
                  <span className="flex-1 truncate">{c.name}</span>
                  {tableFilterCampaign === c.id && <Check className="h-3 w-3 ml-1 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {isTableFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearTableFilters} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-4 bg-border/25 mx-1.5 shrink-0" />

      {/* Fields (Visibility) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[115px]", visibleCols.size !== DEFAULT_VISIBLE_COLS.length ? xActive : xDefault)}>
            <Eye className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.fields")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.showHideColumns")}</DropdownMenuLabel>
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
                <span className="flex-1">{t(`table.columns.${col.key}`)}</span>
                {!col.defaultVisible && (
                  <span className="text-[9px] text-muted-foreground/40 px-1 bg-muted rounded font-medium">+</span>
                )}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE_COLS))} className="text-[12px] text-muted-foreground">
            {t("toolbar.resetToDefault")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* CSV */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[90px]", xDefault)} data-onboarding="import-leads-btn">
            <FileSpreadsheet className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.csv")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={() => setImportWizardOpen(true)} className="text-[12px]">
            <Upload className="h-3.5 w-3.5 mr-2" /> {t("toolbar.importCsv")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportCsv} className="text-[12px]">
            <Download className="h-3.5 w-3.5 mr-2" /> {t("toolbar.exportCsv")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, xDefault, "hover:max-w-[100px]")}>
            <Settings className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.settings")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.display")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setShowVerticalLines(!showVerticalLines); }} className="flex items-center gap-2 text-[12px]">
            <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0", showVerticalLines ? "bg-brand-indigo border-brand-indigo" : "border-border/50")}>
              {showVerticalLines && <Check className="h-2 w-2 text-white" />}
            </div>
            <span className="flex-1">{t("toolbar.verticalLines")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setFullWidthTable(!fullWidthTable); }} className="flex items-center gap-2 text-[12px]">
            <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0", fullWidthTable ? "bg-brand-indigo border-brand-indigo" : "border-border/50")}>
              {fullWidthTable && <Check className="h-2 w-2 text-white" />}
            </div>
            <span className="flex-1">{t("toolbar.fullWidth")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setColumnOrder([])} className="text-[12px] text-muted-foreground">
            {t("toolbar.resetColumnOrder")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setColumnWidths({})} className="text-[12px] text-muted-foreground">
            {t("toolbar.resetColumnWidths")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Selection actions — far right, visible when rows selected ── */}
      {tableSelectedIds.size > 0 && (
        <>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-1 shrink-0">
            {/* Change Stage dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(tbBase, tbDefault)}>
                  <Pencil className="h-4 w-4" />
                  {t("toolbar.changeStage")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("filters.moveTo")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleBulkStageChange(s)} className="text-[12px]">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mr-2", STATUS_DOT[s] ?? "bg-zinc-400")} />
                    {t(`kanban.stageLabels.${s.replace(/ /g, "")}`, s)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmToolbarButton
              icon={Copy}
              label={t("toolbar.duplicate")}
              onConfirm={handleDuplicateLeads}
            />
            <ConfirmToolbarButton
              icon={Trash2}
              label="Delete"
              onConfirm={handleBulkDeleteLeads}
              variant="danger"
            />

            {/* Count badge with dismiss */}
            <button
              className={cn(tbBase, tbDefault, "cursor-default ml-1")}
              onClick={() => setTableSelectedIds(new Set())}
            >
              <span className="tabular-nums">{tableSelectedIds.size}</span>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full" data-onboarding="leads-table">

      {/* ── List view ── */}
      {viewMode === "list" && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <LeadsCardView
            leads={filteredLeads}
            loading={loading}
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
            searchOpen={searchOpen}
            onSearchOpenChange={setSearchOpen}
            onListSearchChange={setListSearch}
            onGroupByChange={setGroupBy}
            onSortByChange={setSortBy}
            onToggleFilterStatus={toggleFilterStatus}
            onToggleFilterTag={toggleFilterTag}
            allTags={allTags}
            hasNonDefaultControls={hasNonDefaultControls}
            isGroupNonDefault={isGroupNonDefault}
            isSortNonDefault={isSortNonDefault}
            onResetControls={handleResetControls}
            onCreateLead={handleAddLead}
            mobileView={mobileView}
            onMobileViewChange={setMobileView}
            accountsById={accountsById}
            campaignsById={campaignsById}
          />
        </div>
      )}

      {/* ── Table view ── */}
      {viewMode === "table" && (
        <div className="flex-1 min-h-0 flex gap-[3px] overflow-hidden">

          {/* Left panel */}
          <div className="flex flex-col bg-muted rounded-lg overflow-hidden flex-1 min-w-0">

            {/* Title + controls row */}
            <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-1 md:pb-3 shrink-0 flex flex-col md:flex-row md:items-center md:gap-3 md:overflow-x-auto md:[scrollbar-width:none]">
              {/* Title row: title left, tabs right (desktop only inline) */}
              <div className="flex items-center justify-between w-full md:w-[309px] md:shrink-0">
                <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
                <span className="hidden md:block">
                  <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => handleViewSwitch(id as ViewMode)} variant="segment" />
                </span>
              </div>
              {/* Second row on mobile: tabs + divider + toolbar */}
              <div className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] pb-2 md:pb-0 md:contents">
                <div className="md:hidden">
                  <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => handleViewSwitch(id as ViewMode)} variant="segment" />
                </div>
                <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
                {tableToolbar}
              </div>
            </div>

            {/* Table content */}
            {viewMode === "table" && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <LeadsInlineTable
                  flatItems={tableFlatItems}
                  loading={loading}
                  selectedLeadId={selectedLead ? (selectedLead.Id ?? selectedLead.id ?? null) : null}
                  onSelectLead={setSelectedLead}
                  onRefresh={handleRefresh}
                  visibleCols={visibleCols}
                  tableSearch={tableSearch}
                  selectedIds={tableSelectedIds}
                  onSelectionChange={setTableSelectedIds}
                  showVerticalLines={showVerticalLines}
                  fullWidthTable={fullWidthTable}
                  groupBy={tableGroupBy}
                  columnOrder={columnOrder}
                  onColumnOrderChange={setColumnOrder}
                  columnWidths={columnWidths}
                  onColumnWidthsChange={setColumnWidths}
                />
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Pipeline view (Kanban) ── */}
      {viewMode === "pipeline" && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-muted rounded-lg">

          {/* Pipeline title + controls row */}
          <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-1 md:pb-3 shrink-0 flex flex-col md:flex-row md:items-center md:gap-3 md:overflow-x-auto md:[scrollbar-width:none]">
            {/* Title row */}
            <div className="flex items-center justify-between w-full md:w-[309px] md:shrink-0">
              <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
              <span className="hidden md:block">
                <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => handleViewSwitch(id as ViewMode)} variant="segment" />
              </span>
            </div>
            {/* Second row on mobile: tabs + divider + toolbar */}
            <div className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] pb-2 md:pb-0 md:contents">
              <div className="md:hidden">
                <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => handleViewSwitch(id as ViewMode)} variant="segment" />
              </div>
              <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />

            {/* Search — always extended, no fill */}
            <SearchPill
              value={kanbanSearchQuery}
              onChange={setKanbanSearchQuery}
              open={kanbanSearchOpen}
              onOpenChange={setKanbanSearchOpen}
              placeholder={t("toolbar.searchPlaceholder")}
            />

            {/* Filter button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(xBase, "hover:max-w-[110px]", isPipelineFilterActive ? xActive : xDefault)}>
                  <Filter className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("toolbar.filter")}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60 rounded-2xl">
                <DropdownMenuItem onClick={() => setShowHighScore(!showHighScore)} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <Flame className={cn("h-4 w-4 shrink-0", showHighScore ? "text-[#FCB803]" : "text-muted-foreground")} />
                  <span className={cn("text-sm flex-1", showHighScore && "font-semibold")}>{t("filters.highScore")}</span>
                  {showHighScore && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterHasPhone(!filterHasPhone)} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <Phone className={cn("h-4 w-4 shrink-0", filterHasPhone ? "text-brand-indigo" : "text-muted-foreground")} />
                  <span className={cn("text-sm flex-1", filterHasPhone && "font-semibold")}>{t("filters.hasPhone")}</span>
                  {filterHasPhone && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterHasEmail(!filterHasEmail)} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <Mail className={cn("h-4 w-4 shrink-0", filterHasEmail ? "text-brand-indigo" : "text-muted-foreground")} />
                  <span className={cn("text-sm flex-1", filterHasEmail && "font-semibold")}>{t("filters.hasEmail")}</span>
                  {filterHasEmail && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                {isPipelineFilterActive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearPipelineFilters} className="flex items-center gap-2 cursor-pointer rounded-xl text-muted-foreground">
                      <X className="h-4 w-4 shrink-0" /><span className="text-sm">{t("toolbar.clearAll")}</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(xBase, "hover:max-w-[100px]", isPipelineSortActive ? xActive : xDefault)}>
                  <ArrowUpDown className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("toolbar.sort")}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-2xl">
                <DropdownMenuItem onClick={() => setPipelineSortBy(null)} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <span className={cn("text-sm flex-1", pipelineSortBy === null && "font-semibold")}>{t("sort.default")}</span>
                  {pipelineSortBy === null && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPipelineSortBy("score-desc")} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <span className={cn("text-sm flex-1", pipelineSortBy === "score-desc" && "font-semibold")}>{t("sort.scoreHighToLow")}</span>
                  {pipelineSortBy === "score-desc" && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPipelineSortBy("recency")} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <span className={cn("text-sm flex-1", pipelineSortBy === "recency" && "font-semibold")}>{t("sort.recency")}</span>
                  {pipelineSortBy === "recency" && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPipelineSortBy("alpha")} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <span className={cn("text-sm flex-1", pipelineSortBy === "alpha" && "font-semibold")}>{t("sort.alphaAZ")}</span>
                  {pipelineSortBy === "alpha" && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Compact mode toggle — hidden on mobile */}
            <button onClick={() => setCompactMode((v) => !v)} title={compactMode ? t("toolbar.normalView") : t("toolbar.compactView")} className={cn(xBase, "hidden md:inline-flex hover:max-w-[110px]", compactMode ? xActive : xDefault)}>
              {compactMode ? <Expand className="h-4 w-4 shrink-0" /> : <Shrink className="h-4 w-4 shrink-0" />}
              <span className={xSpan}>{compactMode ? t("toolbar.normalView") : t("toolbar.compactView")}</span>
            </button>

            {/* Fold / Unfold empty columns — right next to compact, hidden on mobile */}
            <button
              onClick={() => {
                if (hasAnyCollapsed) {
                  setFoldAction((prev) => ({ type: "expand-all", seq: prev.seq + 1 }));
                } else {
                  setFoldAction((prev) => ({ type: "fold-empty", seq: prev.seq + 1 }));
                }
              }}
              className={cn(xBase, "hidden md:inline-flex hover:max-w-[115px]", hasAnyCollapsed ? xActive : xDefault)}
              title={hasAnyCollapsed ? t("toolbar.unfold") : t("toolbar.fold")}
            >
              <Rows3 className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{hasAnyCollapsed ? t("toolbar.unfold") : t("toolbar.fold")}</span>
            </button>

            {/* Tags always-show toggle — hidden on mobile */}
            <button onClick={() => setShowTagsAlways((v) => !v)} title={showTagsAlways ? t("tagsToggle.alwaysVisible") : t("tagsToggle.hoverOnly")} className={cn(xBase, "hidden md:inline-flex hover:max-w-[100px]", showTagsAlways ? xActive : xDefault)}>
              <Tag className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.tags")}</span>
            </button>

            </div>{/* end second row wrapper */}
          </div>{/* end pipeline header */}

          {/* Kanban board + detail panel */}
          <div className="flex-1 min-h-0 flex gap-[3px] overflow-hidden">
            <div className="flex-1 min-w-0 overflow-hidden p-[6px] pt-0">
              <LeadsKanban
                leads={filteredPipelineLeads}
                loading={loading}
                leadTagsMap={leadTagsInfo}
                onLeadMove={handleKanbanLeadMove}
                onCardClick={setSelectedKanbanLead}
                selectedLeadId={selectedKanbanLead?.Id ?? selectedKanbanLead?.id}
                foldAction={foldAction}
                onCollapsedChange={setHasAnyCollapsed}
                showTagsAlways={showTagsAlways}
                compactMode={compactMode}
              />
            </div>
            {selectedKanbanLead && (
              <div className="w-[380px] flex-shrink-0 flex flex-col min-w-0 overflow-hidden bg-card rounded-lg">
                <KanbanDetailPanel
                  lead={selectedKanbanLead}
                  onClose={handleCloseKanbanPanel}
                  leadTags={leadTagsInfo.get(getLeadIdHelper(selectedKanbanLead)) || []}
                  onOpenFullProfile={() => setFullProfileLead(selectedKanbanLead)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full lead profile sheet (for pipeline view) */}
      <LeadDetailPanel
        lead={fullProfileLead ?? {}}
        open={!!fullProfileLead}
        onClose={() => setFullProfileLead(null)}
      />

      {/* CSV Import Wizard */}
      <CsvImportWizard
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onImportComplete={handleRefresh}
        defaultAccountId={filterAccountId}
      />
    </div>
  );
}
