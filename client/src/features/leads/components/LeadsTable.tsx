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
  getLeadId as getLeadIdHelper,
  getFullName as getFullNameHelper,
  type GroupByOption,
  type SortByOption,
} from "./LeadsCardView";
import { LeadsInlineTable } from "./LeadsInlineTable";
import { CsvImportWizard } from "./CsvImportWizard";
import { createLead, bulkDeleteLeads } from "../api/leadsApi";
import { apiFetch } from "@/lib/apiUtils";
import {
  Table2, List,
  Plus, Trash2, Copy, ArrowUpDown, Filter, Layers,
  FileSpreadsheet, Eye, Check, Upload, Download,
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
import type { VirtualListItem } from "./LeadsCardView";

type ViewMode = "list" | "table";
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
  { id: "list",   label: "List",   icon: List       },
  { id: "table",  label: "Table",  icon: Table2     },
];

/* ── Status group ordering ── */
const STATUS_GROUP_ORDER = [
  "New", "Contacted", "Responded", "Multiple Responses",
  "Qualified", "Booked", "Closed", "Lost", "DND",
];

const STATUS_OPTIONS = STATUS_GROUP_ORDER;

const STATUS_DOT: Record<string, string> = {
  New:                  "bg-gray-400",
  Contacted:            "bg-blue-500",
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
      <div className="h-10 flex items-center gap-1 rounded-full border border-border/30 bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{label}?</span>
        <button
          className="px-2 py-0.5 rounded-full bg-brand-blue text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50"
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

export function LeadsTable() {
  const { currentAccountId, isAgencyView } = useWorkspace();
  const filterAccountId = (isAgencyView && currentAccountId === 1) ? undefined : currentAccountId;
  const { leads, loading, error, handleRefresh } = useLeadsData(filterAccountId);

  /* ── View mode (persisted) ─────────────────────────────────────────────── */
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored && ["list", "table"].includes(stored)) return stored as ViewMode;
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

  /* ── Lifted list-view controls ───────────────────────────────────────────── */
  const [listSearch,   setListSearch]   = useState("");
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [groupBy,      setGroupBy]      = useState<GroupByOption>("date");
  const [sortBy,       setSortBy]       = useState<SortByOption>("recent");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterTags,   setFilterTags]   = useState<string[]>([]);

  /* ── Table toolbar state ─────────────────────────────────────────────────── */
  const [tableSearch,         setTableSearch]         = useState("");
  const [tableSearchOpen,     setTableSearchOpen]     = useState(true); // always expanded
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
    const fetchLeadTags = async () => {
      if (leads.length === 0) return;
      try {
        const batchSize = 10;
        const batches: Promise<{ leadId: number; tagIds: number[] }[]>[] = [];
        for (let i = 0; i < leads.length; i += batchSize) {
          const batch = leads.slice(i, i + batchSize);
          batches.push(
            Promise.allSettled(
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
            ).then((results) =>
              results
                .filter((r): r is PromiseFulfilledResult<{ leadId: number; tagIds: number[] }> => r.status === "fulfilled")
                .map((r) => r.value)
            )
          );
        }
        const allBatchResults = await Promise.all(batches);
        const tagMap = new Map<number, number[]>();
        allBatchResults.flat().forEach(({ leadId, tagIds }) => {
          tagMap.set(leadId, tagIds);
        });
        setLeadTagMap(tagMap);
      } catch (err) { console.error("Failed to fetch lead tags for filtering", err); }
    };
    fetchLeadTags();
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

  /* ── Table toolbar (rendered inline with tabs) ──────────────────────────── */
  const tableToolbar = (
    <>
      <div className="w-px h-4 bg-border/25 mx-0.5 shrink-0" />

      {/* Search — always expanded, before Add */}
      <div className="flex items-center gap-1.5 h-10 rounded-full border border-border/30 bg-card/60 px-2.5 shrink-0">
        <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
          placeholder="Search leads..."
          className="text-[12px] bg-transparent outline-none w-28 min-w-0 text-foreground placeholder:text-muted-foreground/60"
        />
        {tableSearch && (
          <button type="button" onClick={() => setTableSearch("")}>
            <svg className="h-3 w-3 text-muted-foreground hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* +Add with confirmation */}
      <ConfirmToolbarButton icon={Plus} label="Add" onConfirm={handleAddLead} />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={ArrowUpDown} label="Sort" active={tableSortBy !== "recent"} activeValue={tableSortBy !== "recent" ? TABLE_SORT_LABELS[tableSortBy].split(" ")[0] : undefined} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Sort by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(["recent", "name_asc", "name_desc", "score_desc", "score_asc"] as TableSortByOption[]).map((opt) => (
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
          <ToolbarPill icon={Filter} label="Filter" active={isTableFilterActive} activeValue={isTableFilterActive ? tableActiveFilterCount : undefined} />
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

          {availableCampaigns.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Campaign</DropdownMenuLabel>
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setTableFilterCampaign(""); }} className={cn("text-[12px]", !tableFilterCampaign && "font-semibold text-brand-blue")}>
                All Campaigns {!tableFilterCampaign && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableCampaigns.map((c) => (
                <DropdownMenuItem key={c} onClick={(e) => { e.preventDefault(); setTableFilterCampaign((p) => p === c ? "" : c); }} className={cn("text-[12px]", tableFilterCampaign === c && "font-semibold text-brand-blue")}>
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
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setTableFilterAccount(""); }} className={cn("text-[12px]", !tableFilterAccount && "font-semibold text-brand-blue")}>
                All Accounts {!tableFilterAccount && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
              {availableAccounts.map((a) => (
                <DropdownMenuItem key={a.id} onClick={(e) => { e.preventDefault(); setTableFilterAccount((p) => p === a.id ? "" : a.id); }} className={cn("text-[12px]", tableFilterAccount === a.id && "font-semibold text-brand-blue")}>
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

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill icon={Layers} label="Group" active={tableGroupBy !== "status"} activeValue={tableGroupBy !== "status" ? TABLE_GROUP_LABELS[tableGroupBy] : undefined} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(["status", "campaign", "account", "none"] as TableGroupByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableGroupBy(opt)} className={cn("text-[12px]", tableGroupBy === opt && "font-semibold text-brand-blue")}>
              {TABLE_GROUP_LABELS[opt]}
              {tableGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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

            {/* Title */}
            <div className="px-3.5 pt-5 pb-1 shrink-0 flex items-center justify-between">
              <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">My Leads</h2>
            </div>

            {/* Controls row: tabs + table toolbar (inline, no count badge) */}
            <div className="px-3 pt-1.5 pb-2.5 shrink-0 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
              <ViewTabBar tabs={VIEW_TABS} activeId={viewMode} onTabChange={(id) => handleViewSwitch(id as ViewMode)} />

              {/* Inline toolbar — table view only */}
              {viewMode === "table" && tableToolbar}
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
