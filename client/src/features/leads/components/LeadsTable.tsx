import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useLeadsData } from "../hooks/useLeadsData";
import { useWorkspace } from "@/hooks/useWorkspace";
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
  Search, X, SlidersHorizontal, Flame, Phone, Mail, Columns3, Tag,
} from "lucide-react";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { ToolbarPill } from "@/components/ui/toolbar-pill";
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
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { VirtualListItem } from "./LeadsCardView";

type ViewMode = "list" | "table" | "pipeline";
type TableSortByOption  = "recent" | "name_asc" | "name_desc" | "score_desc" | "score_asc";
type TableGroupByOption = "status" | "campaign" | "account" | "none";

const VIEW_MODE_KEY    = "leads-view-mode";
const VISIBLE_COLS_KEY = "leads-table-visible-cols";

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

/* ── Tab definitions ── */
const VIEW_TABS: TabDef[] = [
  { id: "list",     label: "List",     icon: List   },
  { id: "table",    label: "Table",    icon: Table2 },
  { id: "pipeline", label: "Pipeline", icon: Kanban },
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
  Booked:               "bg-amber-400",
  Closed:               "bg-emerald-500",
  Lost:                 "bg-red-500",
  DND:                  "bg-zinc-500",
};

const TABLE_SORT_LABELS: Record<TableSortByOption, string> = {
  recent:     "Most Recent",
  name_asc:   "Name A → Z",
  name_desc:  "Name Z → A",
  score_desc: "Score ↓",
  score_asc:  "Score ↑",
};

const TABLE_GROUP_LABELS: Record<TableGroupByOption, string> = {
  status:   "Status",
  campaign: "Campaign",
  account:  "Account",
  none:     "None",
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
  const { currentAccountId, isAgencyView } = useWorkspace();
  const filterAccountId = (isAgencyView && currentAccountId === 1) ? undefined : currentAccountId;
  const { leads, loading, error, handleRefresh } = useLeadsData(filterAccountId);

  /* ── Toolbar button constants ───────────────────────────────────────────── */
  const tbBase = "h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 select-none";
  const tbDefault = "border border-black/[0.125] text-foreground/60 hover:text-foreground hover:bg-card";

  /* ── View mode (persisted) ─────────────────────────────────────────────── */
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
  const [leadTagMap,   setLeadTagMap]   = useState<Map<number, number[]>>(new Map());
  const [leadTagsInfo, setLeadTagsInfo] = useState<Map<number, { name: string; color: string }[]>>(new Map());
  const [allTagsById,  setAllTagsById]  = useState<Map<number, { name: string; color: string }>>(new Map());

  /* ── Pipeline-specific state ────────────────────────────────────────────── */
  const [showTagsAlways, setShowTagsAlways] = useState<boolean>(() => {
    try { return localStorage.getItem("kanban_tags_always_show") === "true"; } catch { /* noop */ } return false;
  });
  const [kanbanSearchQuery, setKanbanSearchQuery] = useState("");
  const [kanbanSearchOpen, setKanbanSearchOpen] = useState(false);
  const [showHighScore, setShowHighScore] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [pipelineSortBy, setPipelineSortBy] = useState<"score-desc" | "recency" | "alpha" | null>(null);
  const [foldAction, setFoldAction] = useState<{ type: "expand-all" | "fold-threshold"; threshold?: number; seq: number }>({ type: "expand-all", seq: 0 });
  const [hasAnyCollapsed, setHasAnyCollapsed] = useState(false);
  const [foldThresholdInput, setFoldThresholdInput] = useState("0");
  const [foldPopoverOpen, setFoldPopoverOpen] = useState(false);
  const [selectedKanbanLead, setSelectedKanbanLead] = useState<Record<string, any> | null>(null);
  const [fullProfileLead, setFullProfileLead] = useState<Record<string, any> | null>(null);

  /* ── Lifted list-view controls ───────────────────────────────────────────── */
  const [listSearch,   setListSearch]   = useState("");
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [groupBy,      setGroupBy]      = useState<GroupByOption>("date");
  const [sortBy,       setSortBy]       = useState<SortByOption>("recent");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterTags,   setFilterTags]   = useState<string[]>([]);

  /* ── Table toolbar state ─────────────────────────────────────────────────── */
  const [tableSearch,         setTableSearch]         = useState("");
  const [tableSortBy,         setTableSortBy]         = useState<TableSortByOption>("recent");
  const [tableFilterStatus,   setTableFilterStatus]   = useState<string[]>([]);
  const [tableFilterCampaign, setTableFilterCampaign] = useState<string>("");
  const [tableFilterAccount,  setTableFilterAccount]  = useState<string>("");
  const [tableGroupBy,        setTableGroupBy]        = useState<TableGroupByOption>("status");

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

  /* ── Accounts (agency view) ──────────────────────────────────────────────── */
  const [accountsById, setAccountsById] = useState<Map<number, string>>(new Map());

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

  /* ── Fetch lead-tag mappings ────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const fetchLeadTags = async () => {
      if (leads.length === 0) return;
      try {
        const batchSize = 10;
        const tagMap = new Map<number, number[]>();
        // Process batches sequentially to avoid flooding the browser with
        // hundreds of concurrent requests (which triggers Chrome's
        // "multiple file download" permission prompt).
        for (let i = 0; i < leads.length; i += batchSize) {
          if (cancelled) return;
          const batch = leads.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map(async (lead) => {
              const leadId = lead.Id || lead.id;
              const res = await apiFetch(`/api/leads/${leadId}/tags`);
              if (res.ok) {
                const data = await res.json();
                const tagIds = Array.isArray(data)
                  ? data.map((t: any) => t.Tags_id || t.tags_id || t.id)
                  : [];
                return { leadId, tagIds };
              }
              return { leadId, tagIds: [] as number[] };
            })
          );
          results
            .filter((r): r is PromiseFulfilledResult<{ leadId: number; tagIds: number[] }> => r.status === "fulfilled")
            .forEach((r) => tagMap.set(r.value.leadId, r.value.tagIds));
        }
        if (!cancelled) setLeadTagMap(tagMap);
      } catch (err) { console.error("Failed to fetch lead tags for filtering", err); }
    };
    fetchLeadTags();
    return () => { cancelled = true; };
  }, [leads]);

  /* ── Build leadTagsInfo ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (allTagsById.size === 0) return;
    const info = new Map<number, { name: string; color: string }[]>();
    leadTagMap.forEach((tagIds, leadId) => {
      const tagDetails = tagIds
        .map((id) => allTagsById.get(id))
        .filter((t): t is { name: string; color: string } => !!t);
      info.set(leadId, tagDetails);
    });
    setLeadTagsInfo(info);
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

  /* ── Pipeline helpers ──────────────────────────────────────────────────── */
  const applyFold = useCallback(() => {
    const threshold = parseInt(foldThresholdInput, 10);
    if (isNaN(threshold) || threshold < 0) return;
    setFoldAction((prev) => ({ type: "fold-threshold", threshold, seq: prev.seq + 1 }));
    setFoldPopoverOpen(false);
  }, [foldThresholdInput]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem("kanban_tags_always_show", String(showTagsAlways)); } catch { /* noop */ } }, [showTagsAlways]);

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
  const availableCampaigns = useMemo(() => {
    const set = new Set<string>();
    filteredLeads.forEach((l) => {
      const c = l.Campaign || l.campaign || l.campaign_name || "";
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [filteredLeads]);

  const availableAccounts = useMemo(() => {
    if (!isAgencyView) return [];
    const result: { id: string; name: string }[] = [];
    const seen = new Set<string>();
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

  /* ── Table flat items — filtered, sorted, grouped ───────────────────────── */
  const tableFlatItems = useMemo((): VirtualListItem[] => {
    let source = filteredLeads;

    if (tableFilterStatus.length > 0) {
      source = source.filter((l) =>
        tableFilterStatus.includes(l.conversion_status || l.Conversion_Status || "")
      );
    }
    if (tableFilterCampaign) {
      source = source.filter((l) =>
        (l.Campaign || l.campaign || l.campaign_name || "") === tableFilterCampaign
      );
    }
    if (tableFilterAccount) {
      source = source.filter((l) =>
        String(l.Accounts_id || l.account_id || "") === tableFilterAccount
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
        case "campaign":
          groupKey = l.Campaign || l.campaign || l.campaign_name || "No Campaign";
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
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((l) =>
        result.push({ kind: "lead", lead: l, tags: leadTagsInfo.get(l.Id || l.id) || [] })
      );
    });
    return result;
  }, [filteredLeads, leadTagsInfo, tableFilterStatus, tableFilterCampaign, tableFilterAccount, tableSortBy, tableGroupBy, accountsById]);

  const handleViewSwitch = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setSelectedLead(null);
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
    const headers = ["Name", "Status", "Score", "Phone", "Email", "Campaign", "Tags", "Last Activity", "Notes"];
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
            if (diffDays === 0) lastActivity = "Today";
            else if (diffDays === 1) lastActivity = "Yesterday";
            else if (diffDays < 7)  lastActivity = `${diffDays}d ago`;
            else                    lastActivity = `${Math.floor(diffDays / 7)}w ago`;
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
  if (error && leads.length === 0 && !loading) {
    return <ApiErrorFallback error={error} onRetry={handleRefresh} isRetrying={loading} />;
  }

  /* ── Table toolbar (rendered inline below title) ────────────────────────── */
  const tableToolbar = (
    <>
      {/* +Add */}
      <ToolbarPill icon={Plus} label="Add" onClick={handleAddLead} />

      {/* Search — always visible */}
      <div className="h-10 flex items-center gap-1.5 rounded-full border border-black/[0.125] bg-card px-3 shrink-0">
        <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        <input
          className="h-full bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/40 w-32 min-w-0"
          placeholder="Search leads…"
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
        />
        {tableSearch && (
          <button onClick={() => setTableSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={Layers} label="Group" active={tableGroupBy !== "status"} activeValue={tableGroupBy !== "status" ? TABLE_GROUP_LABELS[tableGroupBy] : undefined} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(["status", "campaign", "account", "none"] as TableGroupByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableGroupBy(opt)} className={cn("text-[12px]", tableGroupBy === opt && "font-semibold text-brand-indigo")}>
              {TABLE_GROUP_LABELS[opt]}
              {tableGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={ArrowUpDown} label="Sort" active={tableSortBy !== "recent"} activeValue={tableSortBy !== "recent" ? TABLE_SORT_LABELS[tableSortBy].split(" ")[0] : undefined} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(["recent", "name_asc", "name_desc", "score_desc", "score_asc"] as TableSortByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableSortBy(opt)} className={cn("text-[12px]", tableSortBy === opt && "font-semibold text-brand-indigo")}>
              {TABLE_SORT_LABELS[opt]}
              {tableSortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={Filter} label="Filter" active={isTableFilterActive} activeValue={isTableFilterActive ? tableActiveFilterCount : undefined} />
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

          {availableCampaigns.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Campaign</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setTableFilterCampaign(""); }} className={cn("text-[12px]", !tableFilterCampaign && "font-semibold text-brand-indigo")}>
                All Campaigns {!tableFilterCampaign && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableCampaigns.map((c) => (
                <DropdownMenuItem key={c} onClick={(e) => { e.preventDefault(); setTableFilterCampaign((p) => p === c ? "" : c); }} className={cn("text-[12px]", tableFilterCampaign === c && "font-semibold text-brand-indigo")}>
                  <span className="flex-1 truncate">{c}</span>
                  {tableFilterCampaign === c && <Check className="h-3 w-3 ml-1 shrink-0" />}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {availableAccounts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Account</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setTableFilterAccount(""); }} className={cn("text-[12px]", !tableFilterAccount && "font-semibold text-brand-indigo")}>
                All Accounts {!tableFilterAccount && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableAccounts.map((a) => (
                <DropdownMenuItem key={a.id} onClick={(e) => { e.preventDefault(); setTableFilterAccount((p) => p === a.id ? "" : a.id); }} className={cn("text-[12px]", tableFilterAccount === a.id && "font-semibold text-brand-indigo")}>
                  <span className="flex-1 truncate">{a.name}</span>
                  {tableFilterAccount === a.id && <Check className="h-3 w-3 ml-1 shrink-0" />}
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

      <div className="w-px h-4 bg-border/25 mx-1.5 shrink-0" />

      {/* Fields (Visibility) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={Eye} label="Fields" active={visibleCols.size !== DEFAULT_VISIBLE_COLS.length} />
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
          <DropdownMenuItem onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE_COLS))} className="text-[12px] text-muted-foreground">
            Reset to default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* CSV */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={FileSpreadsheet} label="CSV" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={() => setImportWizardOpen(true)} className="text-[12px]">
            <Upload className="h-3.5 w-3.5 mr-2" /> Import CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportCsv} className="text-[12px]">
            <Download className="h-3.5 w-3.5 mr-2" /> Export CSV
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
                  Change Stage
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Move to</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleBulkStageChange(s)} className="text-[12px]">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mr-2", STATUS_DOT[s] ?? "bg-zinc-400")} />
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmToolbarButton
              icon={Copy}
              label="Duplicate"
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
    <div className="flex flex-col h-full">

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
          />
        </div>
      )}

      {/* ── Table view ── */}
      {viewMode === "table" && (
        <div className="flex-1 min-h-0 flex gap-[3px] overflow-hidden">

          {/* Left panel */}
          <div className="flex flex-col bg-muted rounded-lg overflow-hidden flex-1 min-w-0">

            {/* Title + controls row */}
            <div className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
              <div className="flex items-center justify-between w-[309px] shrink-0">
                <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Leads</h2>
                <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => handleViewSwitch(id as ViewMode)} />
              </div>
              <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
              {tableToolbar}
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
          <div className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
            <div className="flex items-center justify-between w-[309px] shrink-0">
              <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Leads</h2>
              <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => handleViewSwitch(id as ViewMode)} />
            </div>
            <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />

            {/* Search — toggle pill */}
            {kanbanSearchOpen ? (
              <div className="h-9 flex items-center gap-1.5 px-3 rounded-full border border-brand-indigo/50 bg-brand-indigo/5">
                <Search className="h-3.5 w-3.5 text-brand-indigo shrink-0" />
                <input
                  type="text"
                  value={kanbanSearchQuery}
                  onChange={(e) => setKanbanSearchQuery(e.target.value)}
                  placeholder="Search…"
                  autoFocus
                  onBlur={() => { if (!kanbanSearchQuery) setKanbanSearchOpen(false); }}
                  onKeyDown={(e) => { if (e.key === "Escape") { setKanbanSearchQuery(""); setKanbanSearchOpen(false); } }}
                  className="bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/60 w-[120px]"
                />
                <button onClick={() => { setKanbanSearchQuery(""); setKanbanSearchOpen(false); }} className="text-muted-foreground/60 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <ToolbarPill icon={Search} label="Search" active={!!kanbanSearchQuery} onClick={() => setKanbanSearchOpen(true)} />
            )}

            {/* Filter button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarPill icon={Filter} label="Filter" active={isPipelineFilterActive} activeValue={isPipelineFilterActive ? pipelineActiveFilterCount : undefined} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60 rounded-2xl">
                <DropdownMenuItem onClick={() => setShowHighScore((v) => !v)} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <Flame className={cn("h-4 w-4 shrink-0", showHighScore ? "text-[#FCB803]" : "text-muted-foreground")} />
                  <span className={cn("text-sm flex-1", showHighScore && "font-semibold")}>High Score (70+)</span>
                  {showHighScore && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterHasPhone((v) => !v)} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <Phone className={cn("h-4 w-4 shrink-0", filterHasPhone ? "text-brand-indigo" : "text-muted-foreground")} />
                  <span className={cn("text-sm flex-1", filterHasPhone && "font-semibold")}>Has Phone</span>
                  {filterHasPhone && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterHasEmail((v) => !v)} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <Mail className={cn("h-4 w-4 shrink-0", filterHasEmail ? "text-brand-indigo" : "text-muted-foreground")} />
                  <span className={cn("text-sm flex-1", filterHasEmail && "font-semibold")}>Has Email</span>
                  {filterHasEmail && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                {isPipelineFilterActive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearPipelineFilters} className="flex items-center gap-2 cursor-pointer rounded-xl text-muted-foreground">
                      <X className="h-4 w-4 shrink-0" /><span className="text-sm">Clear all</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarPill icon={ArrowUpDown} label="Sort" active={isPipelineSortActive} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-2xl">
                <DropdownMenuItem onClick={() => setPipelineSortBy(null)} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <span className={cn("text-sm flex-1", pipelineSortBy === null && "font-semibold")}>Default</span>
                  {pipelineSortBy === null && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPipelineSortBy("score-desc")} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <span className={cn("text-sm flex-1", pipelineSortBy === "score-desc" && "font-semibold")}>Score (High to Low)</span>
                  {pipelineSortBy === "score-desc" && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPipelineSortBy("recency")} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <span className={cn("text-sm flex-1", pipelineSortBy === "recency" && "font-semibold")}>Recency (Newest first)</span>
                  {pipelineSortBy === "recency" && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPipelineSortBy("alpha")} className="flex items-center gap-2 cursor-pointer rounded-xl">
                  <span className={cn("text-sm flex-1", pipelineSortBy === "alpha" && "font-semibold")}>Alphabetical (A to Z)</span>
                  {pipelineSortBy === "alpha" && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Fold / Unfold button */}
            {hasAnyCollapsed ? (
              <button onClick={() => setFoldAction((prev) => ({ type: "expand-all", seq: prev.seq + 1 }))} className="h-9 px-3 rounded-full flex items-center gap-1.5 text-[12px] font-medium bg-white text-foreground border border-black/[0.125] hover:bg-muted/50 transition-colors">
                <Columns3 className="h-4 w-4 shrink-0" /><span>Unfold</span>
              </button>
            ) : (
              <Popover open={foldPopoverOpen} onOpenChange={setFoldPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className={cn("h-9 px-3 rounded-full flex items-center gap-1.5 text-[12px] font-medium transition-colors", foldPopoverOpen ? "bg-white text-foreground border border-black/[0.125]" : "border border-black/[0.125] text-muted-foreground hover:bg-card hover:text-foreground")}>
                    <Columns3 className="h-4 w-4 shrink-0" /><span>Fold</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 rounded-2xl p-4">
                  <p className="text-sm font-semibold mb-1">Fold columns</p>
                  <p className="text-xs text-muted-foreground mb-3">Fold columns with this many leads or fewer.</p>
                  <div className="flex items-center gap-2">
                    <input type="number" value={foldThresholdInput} onChange={(e) => setFoldThresholdInput(e.target.value)} min="0" autoFocus onKeyDown={(e) => { if (e.key === "Enter") applyFold(); }} className="h-9 w-20 rounded-xl border border-border bg-input-bg px-3 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-brand-indigo/30" />
                    <span className="text-sm text-muted-foreground flex-1">leads</span>
                    <button onClick={applyFold} className="h-9 px-4 rounded-xl bg-brand-indigo text-white text-sm font-semibold hover:bg-brand-indigo/90 transition-colors">Apply</button>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Tags always-show toggle */}
            <button onClick={() => setShowTagsAlways((v) => !v)} title={showTagsAlways ? "Tags always visible -- click to hover-only" : "Show tags on hover only -- click to always show"} className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors", showTagsAlways ? "bg-white text-foreground border border-black/[0.125] hover:bg-muted/50" : "border border-black/[0.125] text-muted-foreground hover:bg-card hover:text-foreground")}>
              <Tag className="h-4 w-4" />
            </button>

          </div>

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
