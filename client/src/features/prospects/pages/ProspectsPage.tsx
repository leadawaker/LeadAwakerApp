// src/features/prospects/pages/ProspectsPage.tsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import {
  Plus, Trash2, Copy, ArrowUpDown, Filter, Layers, Eye, Check, Pencil, X, Search, Settings,
  List, Table2, Kanban, Clock, FileText, SlidersHorizontal, Phone, Mail, Columns3, Rows3,
  ChevronDown, ChevronRight, MapPin, ArrowUp, ArrowDown,
} from "lucide-react";
import OutreachPipelineView from "../components/OutreachPipelineView";
import OutreachTemplatesView, { TemplatesToolbar, type TemplatesViewHandle } from "../components/OutreachTemplatesView";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { ToolbarPill } from "@/components/ui/toolbar-pill";
import { IconBtn } from "@/components/ui/icon-btn";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ProspectsInlineTable } from "../components/ProspectsInlineTable";
import type { ProspectTableItem } from "../components/ProspectsInlineTable";
import { ProspectListView } from "../components/ProspectListView";
import type { ProspectRow, NewProspectForm } from "../components/ProspectListView";
import { useProspectsData } from "../hooks/useProspectsData";
import { deleteProspect } from "../api/prospectsApi";
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
import { createProspect, updateProspect } from "../api/prospectsApi";

type ViewMode = "list" | "table" | "pipeline" | "followups" | "templates";

const VISIBLE_COLS_KEY = "prospects-table-visible-cols";
const TABLE_PREFS_KEY  = "prospects-table-prefs";
const COL_WIDTHS_KEY   = "prospects-column-widths";
const VIEW_MODE_KEY    = "prospects-view-mode";

/* -- Table column metadata for Fields dropdown -- */
const TABLE_COL_META_KEYS = [
  { key: "company",     labelKey: "columns.company",    defaultVisible: true  },
  { key: "status",      labelKey: "columns.status",     defaultVisible: true  },
  { key: "priority",    labelKey: "columns.priority",   defaultVisible: true  },
  { key: "niche",       labelKey: "columns.niche",      defaultVisible: true  },
  { key: "country",     labelKey: "columns.country",    defaultVisible: false },
  { key: "city",        labelKey: "columns.city",       defaultVisible: true  },
  { key: "website",     labelKey: "columns.website",    defaultVisible: false },
  { key: "notes",            labelKey: "columns.notes",           defaultVisible: false },
  { key: "next_action", labelKey: "columns.nextAction", defaultVisible: true  },
  { key: "source",           labelKey: "columns.source",          defaultVisible: false },
  { key: "phone",            labelKey: "columns.phone",           defaultVisible: false },
  { key: "email",            labelKey: "columns.email",           defaultVisible: false },
  { key: "company_linkedin",  labelKey: "columns.companyLinkedin",  defaultVisible: false },
  { key: "contact_name",     labelKey: "columns.contactName",     defaultVisible: false },
  { key: "contact_role",     labelKey: "columns.contactRole",     defaultVisible: false },
  { key: "contact_email",    labelKey: "columns.contactEmail",    defaultVisible: false },
  { key: "contact_phone",    labelKey: "columns.contactPhone",    defaultVisible: false },
  { key: "contact_linkedin", labelKey: "columns.contactLinkedin", defaultVisible: false },
  { key: "contact2_name",     labelKey: "columns.contact2Name",     defaultVisible: false },
  { key: "contact2_role",     labelKey: "columns.contact2Role",     defaultVisible: false },
  { key: "contact2_email",    labelKey: "columns.contact2Email",    defaultVisible: false },
  { key: "contact2_phone",    labelKey: "columns.contact2Phone",    defaultVisible: false },
  { key: "contact2_linkedin", labelKey: "columns.contact2Linkedin", defaultVisible: false },
  { key: "action",           labelKey: "columns.action",          defaultVisible: true  },
  { key: "outreach_status",  labelKey: "columns.outreachStatus",  defaultVisible: false },
  { key: "contact_method",   labelKey: "columns.contactMethod",   defaultVisible: false },
  { key: "follow_up_count",  labelKey: "columns.followUpCount",   defaultVisible: false },
  { key: "next_follow_up_date", labelKey: "columns.nextFollowUp", defaultVisible: false },
  { key: "enrichment_status", labelKey: "columns.enrichmentStatus", defaultVisible: false },
];

const DEFAULT_VISIBLE = TABLE_COL_META_KEYS.filter((c) => c.defaultVisible).map((c) => c.key);

/* -- Table sort / group types -- */
type TableSortByOption  = "recent" | "name_asc" | "name_desc" | "priority";
type TableGroupByOption = "status" | "outreach_status" | "niche" | "country" | "priority" | "date_created" | "date_updated" | "none";

const TABLE_SORT_KEYS: Record<TableSortByOption, string> = {
  recent:    "sort.mostRecent",
  name_asc:  "sort.nameAZ",
  name_desc: "sort.nameZA",
  priority:  "sort.priority",
};

const TABLE_GROUP_KEYS: Record<TableGroupByOption, string> = {
  status:          "group.status",
  outreach_status: "group.outreachStatus",
  niche:           "group.niche",
  country:         "group.country",
  priority:        "group.priority",
  date_created:    "group.dateCreated",
  date_updated:    "group.dateUpdated",
  none:            "group.none",
};

function getDateBucket(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  if (diffDays < 90) return "Last 3 Months";
  return "Older";
}

const DATE_BUCKET_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "Unknown"];

const STATUS_OPTIONS = ["New", "Contacted", "In Progress", "Converted", "Archived"];
const PROSPECT_STATUS_ORDER = ["New", "Contacted", "In Progress", "Converted", "Archived"];

const STATUS_DOT: Record<string, string> = {
  "New":         "bg-blue-500",
  "Contacted":   "bg-amber-500",
  "In Progress": "bg-indigo-500",
  "Converted":   "bg-emerald-500",
  "Archived":    "bg-slate-400",
};

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

/* -- Expand-on-hover button constants -- */
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive  = "border-brand-indigo text-brand-indigo";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// -- Inline confirmation button --
function ConfirmToolbarButton({
  icon: Icon, label, onConfirm, variant = "default", confirmYes = "Yes", confirmNo = "No",
}: {
  icon: React.ElementType; label: string;
  onConfirm: () => Promise<void> | void;
  variant?: "default" | "danger";
  confirmYes?: string; confirmNo?: string;
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
          {loading ? "\u2026" : confirmYes}
        </button>
        <button className="px-2 py-0.5 rounded-full text-muted-foreground text-[11px] hover:text-foreground" onClick={() => setConfirming(false)}>{confirmNo}</button>
      </div>
    );
  }
  const labelLen = label.length;
  const hoverMaxW = labelLen <= 4 ? "hover:max-w-[80px]" : labelLen <= 6 ? "hover:max-w-[100px]" : "hover:max-w-[120px]";
  return (
    <button
      className={cn(
        xBase, hoverMaxW,
        variant === "danger"
          ? "border-red-300/50 text-red-500 hover:text-red-600"
          : xDefault,
      )}
      onClick={() => setConfirming(true)}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={xSpan}>{label}</span>
    </button>
  );
}

// ── Follow-up card ───────────────────────────────────────────────────────────

function FollowUpCard({ prospect: p, onClick }: { prospect: ProspectRow; onClick: () => void }) {
  const isOverdue = new Date(p.next_follow_up_date) < new Date();
  const dueDate = new Date(p.next_follow_up_date);
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border bg-card p-3.5 cursor-pointer transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        isOverdue && "border-red-300/60 dark:border-red-800/40"
      )}
      onClick={onClick}
    >
      <div className={cn(
        "text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0",
        isOverdue
          ? "bg-red-50 text-red-600 dark:bg-red-950/30"
          : "bg-amber-50 text-amber-600 dark:bg-amber-950/30"
      )}>
        {isOverdue ? "OVERDUE" : dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground truncate">
          {p.name || p.company}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {p.contact_name} · {p.niche} · Follow-up #{p.follow_up_count || 1}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground/60 shrink-0">
        {p.contact_method || "email"}
      </div>
    </div>
  );
}

// ── Accordion filter section ──────────────────────────────────────────────────

function FilterAccordionSection({
  label,
  activeCount,
  defaultOpen = false,
  children,
}: {
  label: string;
  activeCount: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || activeCount > 0);
  return (
    <div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted/50 transition-colors duration-150"
      >
        {open
          ? <ChevronDown className="h-3 w-3 shrink-0" />
          : <ChevronRight className="h-3 w-3 shrink-0" />
        }
        <span className="flex-1 text-left font-medium">{label}</span>
        {activeCount > 0 && (
          <span className="h-4 min-w-4 px-1 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center shrink-0">
            {activeCount}
          </span>
        )}
      </button>
      {open && children}
    </div>
  );
}

export default function ProspectsPage() {
  const { t } = useTranslation("prospects");
  const { currentAccountId } = useWorkspace();

  const TABLE_COL_META = TABLE_COL_META_KEYS.map((c) => ({
    ...c,
    label: t(c.labelKey),
  }));

  /* -- View mode (persisted) -- */
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "table"; } catch { return "table"; }
  });
  useEffect(() => { try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch {} }, [viewMode]);

  /* -- Clear topbar actions -- */
  const { clearTopbarActions } = useTopbarActions();
  useEffect(() => { clearTopbarActions(); }, [clearTopbarActions]);

  /* -- Table toolbar state (persisted) -- */
  const [tableSearch,       setTableSearch]       = useState("");
  const [tablePrefs, setTablePrefs] = usePersistedState(TABLE_PREFS_KEY, {
    sortBy: "recent" as TableSortByOption,
    groupBy: "status" as TableGroupByOption,
    filterStatus: [] as string[],
    filterNiche: [] as string[],
    filterCountry: [] as string[],
    filterPriority: [] as string[],
    filterSource: [] as string[],
  });
  const tableSortBy = tablePrefs.sortBy;
  // Backward-compat: old persisted "date" maps to date_updated
  const tableGroupBy: TableGroupByOption = (tablePrefs.groupBy as string) === "date" ? "date_updated" : tablePrefs.groupBy;
  const tableFilterStatus = tablePrefs.filterStatus;
  const tableFilterNiche = tablePrefs.filterNiche;
  const tableFilterCountry = tablePrefs.filterCountry;
  const tableFilterPriority = tablePrefs.filterPriority;
  const tableFilterSource = tablePrefs.filterSource ?? [];
  const setTableSortBy = useCallback((v: TableSortByOption) => setTablePrefs(p => ({ ...p, sortBy: v })), [setTablePrefs]);
  const setTableGroupBy = useCallback((v: TableGroupByOption) => setTablePrefs(p => ({ ...p, groupBy: v })), [setTablePrefs]);
  const setTableFilterStatus = useCallback((v: string[] | ((p: string[]) => string[])) => setTablePrefs(p => ({ ...p, filterStatus: typeof v === "function" ? v(p.filterStatus) : v })), [setTablePrefs]);
  const setTableFilterNiche = useCallback((v: string[] | ((p: string[]) => string[])) => setTablePrefs(p => ({ ...p, filterNiche: typeof v === "function" ? v(p.filterNiche) : v })), [setTablePrefs]);
  const setTableFilterCountry = useCallback((v: string[] | ((p: string[]) => string[])) => setTablePrefs(p => ({ ...p, filterCountry: typeof v === "function" ? v(p.filterCountry) : v })), [setTablePrefs]);
  const setTableFilterPriority = useCallback((v: string[] | ((p: string[]) => string[])) => setTablePrefs(p => ({ ...p, filterPriority: typeof v === "function" ? v(p.filterPriority) : v })), [setTablePrefs]);
  const setTableFilterSource = useCallback((v: string[] | ((p: string[]) => string[])) => setTablePrefs(p => ({ ...p, filterSource: typeof v === "function" ? v(p.filterSource ?? []) : v })), [setTablePrefs]);
  const [tableSelectedIds,  setTableSelectedIds]  = useState<Set<number>>(new Set());
  const [tableFilterOverdue, setTableFilterOverdue] = useState(false);
  const [tableGroupDirection, setTableGroupDirection] = useState<"asc" | "desc">("asc");

  /* -- Column visibility (persisted) -- */
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

  /* -- Settings toggles (persisted) -- */
  const [showVerticalLines, setShowVerticalLines] = useState(() => {
    try { return localStorage.getItem("prospects-vertical-lines") === "true"; } catch { return false; }
  });
  const [fullWidthTable, setFullWidthTable] = useState(() => {
    try { return localStorage.getItem("prospects-full-width") === "true"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("prospects-vertical-lines", String(showVerticalLines)); } catch {} }, [showVerticalLines]);
  useEffect(() => {
    try { localStorage.setItem("prospects-full-width", String(fullWidthTable)); } catch {}
    window.dispatchEvent(new Event("prospects-fullwidth-change"));
  }, [fullWidthTable]);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("prospects-column-order");
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  useEffect(() => {
    try { localStorage.setItem("prospects-column-order", JSON.stringify(columnOrder)); } catch {}
  }, [columnOrder]);

  const [columnWidths, setColumnWidths] = usePersistedState<Record<string, number>>(COL_WIDTHS_KEY, {});

  const csvInputRef = useRef<HTMLInputElement>(null);

  /* -- Data -- */
  const { rows: allRows, loading, fetchData, handleInlineUpdate, handleCreateRow } = useProspectsData(undefined);
  const rows = useMemo(
    () => currentAccountId > 0 ? allRows.filter(r => (r.id ?? r.Id) === currentAccountId) : allRows,
    [allRows, currentAccountId],
  );

  /* -- Persisted selection (after data hook) -- */
  const [selectedProspect, setSelectedProspect] = usePersistedSelection<ProspectRow>(
    "selected-prospect-id",
    (p) => p.Id ?? p.id ?? 0,
    rows as ProspectRow[],
  );

  const handleSelectProspect = useCallback((prospect: ProspectRow) => {
    setSelectedProspect(prospect);
  }, []);

  // -- Breadcrumb --
  const { setCrumb } = useBreadcrumb();
  useEffect(() => {
    setCrumb(selectedProspect?.name ?? null);
    return () => setCrumb(null);
  }, [selectedProspect, setCrumb]);

  async function handleDetailSave(prospectId: number, patch: Partial<ProspectRow>) {
    for (const [col, value] of Object.entries(patch)) {
      await handleInlineUpdate(prospectId, col, value, [prospectId]);
    }
    const updated = rows.find((r) => (r.Id ?? r.id) === prospectId);
    if (updated) {
      const merged = { ...updated, ...patch } as ProspectRow;
      setSelectedProspect((prev: ProspectRow | null) => (prev && (prev.Id ?? prev.id) === prospectId ? merged : prev));
    }
  }

  const handleFieldSave = useCallback(async (field: string, value: string) => {
    if (!selectedProspect) return;
    const pid = selectedProspect.Id ?? selectedProspect.id ?? 0;
    await handleDetailSave(pid, { [field]: value });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProspect]);

  const handleDeleteProspect = useCallback(async () => {
    if (!selectedProspect) return;
    const pid = selectedProspect.Id ?? selectedProspect.id ?? 0;
    try {
      await deleteProspect(pid);
      setSelectedProspect(null);
      fetchData();
    } catch (err) {
      console.error("Delete prospect failed", err);
    }
  }, [selectedProspect, fetchData]);


  /* -- Table toolbar helpers -- */
  const toggleTableFilterStatus = useCallback((s: string) =>
    setTableFilterStatus((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const toggleTableFilterNiche = useCallback((s: string) =>
    setTableFilterNiche((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const toggleTableFilterCountry = useCallback((s: string) =>
    setTableFilterCountry((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const toggleTableFilterPriority = useCallback((s: string) =>
    setTableFilterPriority((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const toggleTableFilterSource = useCallback((s: string) =>
    setTableFilterSource((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]),
  []);
  const clearTableFilters = useCallback(() => {
    setTableFilterStatus([]);
    setTableFilterNiche([]);
    setTableFilterCountry([]);
    setTableFilterPriority([]);
    setTableFilterSource([]);
    setTableFilterOverdue(false);
  }, []);
  const isTableFilterActive    = tableFilterStatus.length > 0 || tableFilterNiche.length > 0 || tableFilterCountry.length > 0 || tableFilterPriority.length > 0 || tableFilterSource.length > 0 || tableFilterOverdue;
  const tableActiveFilterCount = tableFilterStatus.length + tableFilterNiche.length + tableFilterCountry.length + tableFilterPriority.length + tableFilterSource.length;

  /* -- Table bulk handlers -- */
  const handleAddProspect = useCallback(async () => {
    try {
      const created = await createProspect({ name: "New Prospect", status: "New" });
      setTableSelectedIds(new Set([created.Id ?? created.id ?? 0]));
      fetchData();
    } catch (err) { console.error("Add prospect failed", err); }
  }, [fetchData]);

  const handleBulkDeleteProspects = useCallback(async () => {
    if (tableSelectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(tableSelectedIds).map((id) => deleteProspect(id)));
      setTableSelectedIds(new Set());
      fetchData();
    } catch (err) { console.error("Bulk delete prospects failed", err); }
  }, [tableSelectedIds, fetchData]);

  const handleDuplicateProspects = useCallback(async () => {
    if (tableSelectedIds.size === 0) return;
    try {
      const toDup = rows.filter((r) => {
        const id = (r as any).Id ?? (r as any).id ?? 0;
        return tableSelectedIds.has(id);
      });
      await Promise.all(toDup.map((r) =>
        createProspect({ name: `${(r as any).name || "Prospect"} (Copy)`, status: (r as any).status || "New" })
      ));
      fetchData();
    } catch (err) { console.error("Duplicate prospects failed", err); }
  }, [tableSelectedIds, rows, fetchData]);

  const handleBulkStatusChange = useCallback(async (status: string) => {
    if (tableSelectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(tableSelectedIds).map((id) => updateProspect(id, { status })));
      setTableSelectedIds(new Set());
      fetchData();
    } catch (err) { console.error("Bulk status change failed", err); }
  }, [tableSelectedIds, fetchData]);

  /* -- CSV export/import -- */
  const handleExportCSV = useCallback(() => {
    const headers = ["company","status","priority","niche","country","city","website","notes","next_action","source","phone","email","company_linkedin","contact_name","contact_role","contact_email","contact_phone","contact_linkedin","contact2_name","contact2_role","contact2_email","contact2_phone","contact2_linkedin","action"];
    const csvRows = [headers.join(",")];
    rows.forEach((r: any) => {
      csvRows.push(headers.map(h => {
        const val = String(r[h] || "").replace(/"/g, '""');
        return `"${val}"`;
      }).join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospects-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const handleImportCSV = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) || [];
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
      try {
        await createProspect({ name: row.company || "Import", company: row.company, niche: row.niche, status: row.status || "New", ...row });
      } catch {}
    }
    fetchData();
    if (csvInputRef.current) csvInputRef.current.value = "";
  }, [fetchData]);

  /* -- Available dynamic filter values -- */
  const availableNiches = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => { const v = String(r.niche || ""); if (v) seen.add(v); });
    return Array.from(seen).sort();
  }, [rows]);

  const availableCountries = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => { const v = String(r.country || ""); if (v) seen.add(v); });
    return Array.from(seen).sort();
  }, [rows]);

  const availablePriorities = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => { const v = String(r.priority || ""); if (v) seen.add(v); });
    return Array.from(seen).sort();
  }, [rows]);

  const availableSources = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => { const v = String(r.source || ""); if (v) seen.add(v); });
    return Array.from(seen).sort();
  }, [rows]);

  /* -- Pipeline toolbar state -- */
  const [pipelineCompactMode, setPipelineCompactMode] = useState(false);
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineSearchOpen, setPipelineSearchOpen] = useState(false);
  const [pipelineSortBy, setPipelineSortBy] = useState<"name-asc" | "name-desc" | "priority" | null>(null);
  const [pipelineFilterHasPhone, setPipelineFilterHasPhone] = useState(false);
  const [pipelineFilterHasEmail, setPipelineFilterHasEmail] = useState(false);
  const [pipelineFilterNiche, setPipelineFilterNiche] = useState<string[]>([]);
  const [pipelineFilterCountry, setPipelineFilterCountry] = useState<string[]>([]);
  const [pipelineHasCollapsed, setPipelineHasCollapsed] = useState(false);
  const pipelineExpandAllRef = useRef<(() => void) | null>(null);
  const pipelineFoldThresholdRef = useRef<((n: number) => void) | null>(null);

  const pipelineActiveFilterCount = (pipelineFilterHasPhone ? 1 : 0) + (pipelineFilterHasEmail ? 1 : 0) + pipelineFilterNiche.length + pipelineFilterCountry.length;
  const isPipelineFilterActive = pipelineActiveFilterCount > 0;
  const isPipelineSortActive = pipelineSortBy !== null;

  const clearPipelineFilters = useCallback(() => {
    setPipelineFilterHasPhone(false);
    setPipelineFilterHasEmail(false);
    setPipelineFilterNiche([]);
    setPipelineFilterCountry([]);
  }, []);

  /* -- List view toolbar state (persisted) -- */
  type ListGroupBy = import("../components/ProspectListView").ProspectGroupBy;
  type ListSortBy = import("../components/ProspectListView").ProspectSortBy;
  const [listPrefs, setListPrefs] = usePersistedState("prospects-list-prefs", {
    groupBy: "niche" as ListGroupBy,
    sortBy: "recent" as ListSortBy,
    filterNiche: [] as string[],
    filterStatus: [] as string[],
    filterCountry: [] as string[],
    filterPriority: [] as string[],
    filterSource: [] as string[],
  });
  const listGroupBy = listPrefs.groupBy;
  const listSortBy = listPrefs.sortBy;
  const listFilterNiche = listPrefs.filterNiche ?? [];
  const listFilterStatus = listPrefs.filterStatus ?? [];
  const listFilterCountry = listPrefs.filterCountry ?? [];
  const listFilterPriority = listPrefs.filterPriority ?? [];
  const listFilterSource = listPrefs.filterSource ?? [];
  const setListGroupBy = useCallback((v: ListGroupBy) => setListPrefs(p => ({ ...p, groupBy: v })), [setListPrefs]);
  const setListSortBy = useCallback((v: ListSortBy) => setListPrefs(p => ({ ...p, sortBy: v })), [setListPrefs]);
  const isListGroupNonDefault = listGroupBy !== "niche";
  const isListSortNonDefault = listSortBy !== "recent";
  const isListFilterActive = listFilterNiche.length > 0 || listFilterStatus.length > 0 || listFilterCountry.length > 0 || listFilterPriority.length > 0 || listFilterSource.length > 0;
  const hasListNonDefaultControls = isListGroupNonDefault || isListSortNonDefault || isListFilterActive;
  const toggleInArray = (arr: string[], s: string) => arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s];
  const toggleListFilterNiche = useCallback((s: string) => {
    setListPrefs(p => ({ ...p, filterNiche: toggleInArray(p.filterNiche ?? [], s) }));
  }, [setListPrefs]);
  const toggleListFilterStatus = useCallback((s: string) => {
    setListPrefs(p => ({ ...p, filterStatus: toggleInArray(p.filterStatus ?? [], s) }));
  }, [setListPrefs]);
  const toggleListFilterCountry = useCallback((s: string) => {
    setListPrefs(p => ({ ...p, filterCountry: toggleInArray(p.filterCountry ?? [], s) }));
  }, [setListPrefs]);
  const toggleListFilterPriority = useCallback((s: string) => {
    setListPrefs(p => ({ ...p, filterPriority: toggleInArray(p.filterPriority ?? [], s) }));
  }, [setListPrefs]);
  const toggleListFilterSource = useCallback((s: string) => {
    setListPrefs(p => ({ ...p, filterSource: toggleInArray(p.filterSource ?? [], s) }));
  }, [setListPrefs]);
  const clearListFilters = useCallback(() => {
    setListPrefs(p => ({ ...p, filterNiche: [], filterStatus: [], filterCountry: [], filterPriority: [], filterSource: [] }));
  }, [setListPrefs]);

  /* -- Follow-ups state -- */
  type FollowUpGroupBy = "none" | "niche" | "country" | "priority" | "contact_method";
  type FollowUpSortBy = "date_asc" | "date_desc" | "priority" | "name_asc";
  const CONTACT_METHOD_OPTIONS = ["email", "phone", "whatsapp"];
  const [followUpSearch, setFollowUpSearch] = useState("");
  const [followUpSortBy, setFollowUpSortBy] = useState<FollowUpSortBy>("date_asc");
  const [followUpFilterNiche, setFollowUpFilterNiche] = useState<string[]>([]);
  const [followUpFilterCountry, setFollowUpFilterCountry] = useState<string[]>([]);
  const [followUpFilterPriority, setFollowUpFilterPriority] = useState<string[]>([]);
  const [followUpFilterContactMethod, setFollowUpFilterContactMethod] = useState<string[]>([]);
  const [followUpGroupBy, setFollowUpGroupBy] = useState<FollowUpGroupBy>("none");
  const isFollowUpFilterActive = followUpFilterNiche.length > 0 || followUpFilterCountry.length > 0 || followUpFilterPriority.length > 0 || followUpFilterContactMethod.length > 0;

  // Templates toolbar state
  const [tplSearch, setTplSearch] = useState("");
  const [tplFilterType, setTplFilterType] = useState("all");
  const tplViewRef = useRef<TemplatesViewHandle>(null);
  const followUpActiveFilterCount = followUpFilterNiche.length + followUpFilterCountry.length + followUpFilterPriority.length + followUpFilterContactMethod.length;
  const toggleFollowUpFilterNiche = useCallback((s: string) => setFollowUpFilterNiche((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]), []);
  const toggleFollowUpFilterCountry = useCallback((s: string) => setFollowUpFilterCountry((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]), []);
  const toggleFollowUpFilterPriority = useCallback((s: string) => setFollowUpFilterPriority((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]), []);
  const toggleFollowUpFilterContactMethod = useCallback((s: string) => setFollowUpFilterContactMethod((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]), []);
  const clearFollowUpFilters = useCallback(() => { setFollowUpFilterNiche([]); setFollowUpFilterCountry([]); setFollowUpFilterPriority([]); setFollowUpFilterContactMethod([]); }, []);

  /* -- Follow-ups due (for followups view) -- */
  const followUpRows = useMemo(() => {
    const now = new Date();
    let source = (rows as ProspectRow[])
      .filter((p) => p.next_follow_up_date && new Date(p.next_follow_up_date) <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    // Search
    if (followUpSearch) {
      const q = followUpSearch.toLowerCase();
      source = source.filter((p) =>
        [p.name, p.company, p.niche, p.contact_name]
          .some((v) => String(v || "").toLowerCase().includes(q))
      );
    }
    // Filters
    if (followUpFilterNiche.length > 0) source = source.filter((p) => followUpFilterNiche.includes(String(p.niche || "")));
    if (followUpFilterCountry.length > 0) source = source.filter((p) => followUpFilterCountry.includes(String(p.country || "")));
    if (followUpFilterPriority.length > 0) source = source.filter((p) => followUpFilterPriority.includes(String(p.priority || "")));
    if (followUpFilterContactMethod.length > 0) source = source.filter((p) => followUpFilterContactMethod.includes(String(p.contact_method || "email")));
    // Sort
    switch (followUpSortBy) {
      case "date_desc":
        source.sort((a, b) => new Date(b.next_follow_up_date).getTime() - new Date(a.next_follow_up_date).getTime());
        break;
      case "priority":
        source.sort((a, b) => (PRIORITY_ORDER[String(a.priority || "")] ?? 99) - (PRIORITY_ORDER[String(b.priority || "")] ?? 99));
        break;
      case "name_asc":
        source.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        break;
      default: // date_asc
        source.sort((a, b) => new Date(a.next_follow_up_date).getTime() - new Date(b.next_follow_up_date).getTime());
    }
    return source;
  }, [rows, followUpSearch, followUpFilterNiche, followUpFilterCountry, followUpFilterPriority, followUpFilterContactMethod, followUpSortBy]);

  /* -- View tabs (segment style) -- */
  const viewTabs: TabDef[] = useMemo(() => [
    { id: "list",      label: "List",      icon: List },
    { id: "table",     label: "Table",     icon: Table2 },
    { id: "pipeline",  label: "Pipeline",  icon: Kanban },
    { id: "templates", label: "Templates", icon: FileText },
  ], []);

  /* -- Table flat items (filtered, sorted, grouped) -- */
  const tableFlatItems = useMemo((): ProspectTableItem[] => {
    let source = [...rows] as ProspectRow[];

    // Search across key fields
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      source = source.filter((p) =>
        [p.name, p.company, p.niche, p.status, p.country, p.city, p.email]
          .some((v) => String(v || "").toLowerCase().includes(q))
      );
    }

    // Filter by status
    if (tableFilterStatus.length > 0) {
      source = source.filter((p) => tableFilterStatus.includes(String(p.status || "")));
    }
    // Filter by niche
    if (tableFilterNiche.length > 0) {
      source = source.filter((p) => tableFilterNiche.includes(String(p.niche || "")));
    }
    // Filter by country
    if (tableFilterCountry.length > 0) {
      source = source.filter((p) => tableFilterCountry.includes(String(p.country || "")));
    }
    // Filter by priority
    if (tableFilterPriority.length > 0) {
      source = source.filter((p) => tableFilterPriority.includes(String(p.priority || "")));
    }
    // Filter by source
    if (tableFilterSource.length > 0) {
      source = source.filter((p) => tableFilterSource.includes(String(p.source || "")));
    }
    if (tableFilterOverdue) {
      const now = Date.now();
      source = source.filter((p) => p.next_follow_up_date && new Date(p.next_follow_up_date).getTime() < now);
    }

    // Sort
    if (tableSortBy === "priority") {
      source.sort((a, b) => {
        const pa = PRIORITY_ORDER[String(a.priority || "")] ?? 99;
        const pb = PRIORITY_ORDER[String(b.priority || "")] ?? 99;
        return pa - pb;
      });
    } else if (tableSortBy !== "recent") {
      source.sort((a, b) => {
        switch (tableSortBy) {
          case "name_asc":  return String(a.name || "").localeCompare(String(b.name || ""));
          case "name_desc": return String(b.name || "").localeCompare(String(a.name || ""));
          default: return 0;
        }
      });
    } else {
      source.sort((a, b) => {
        const da = a.updated_at || a.created_at || "";
        const db = b.updated_at || b.created_at || "";
        return db.localeCompare(da);
      });
    }

    // No grouping
    if (tableGroupBy === "none") {
      return source.map((p) => ({ kind: "prospect" as const, prospect: p }));
    }

    // Group
    const buckets = new Map<string, ProspectRow[]>();
    source.forEach((p) => {
      let groupKey: string;
      switch (tableGroupBy) {
        case "outreach_status": groupKey = String(p.outreach_status || "new"); break;
        case "niche":    groupKey = String(p.niche || "Unknown"); break;
        case "country":  groupKey = String(p.country || "Unknown"); break;
        case "priority": groupKey = String(p.priority || "Unknown"); break;
        case "date_created": groupKey = getDateBucket(p.created_at); break;
        case "date_updated": groupKey = getDateBucket(p.updated_at || p.created_at); break;
        default:         groupKey = String(p.status || "Unknown"); break;
      }
      if (!buckets.has(groupKey)) buckets.set(groupKey, []);
      buckets.get(groupKey)!.push(p);
    });

    let orderedKeys: string[];
    if (tableGroupBy === "status") {
      orderedKeys = PROSPECT_STATUS_ORDER.filter((k) => buckets.has(k))
        .concat(Array.from(buckets.keys()).filter((k) => !PROSPECT_STATUS_ORDER.includes(k)));
    } else if (tableGroupBy === "date_created" || tableGroupBy === "date_updated") {
      orderedKeys = DATE_BUCKET_ORDER.filter((k) => buckets.has(k));
    } else {
      orderedKeys = Array.from(buckets.keys()).sort();
    }

    if (tableGroupDirection === "desc") {
      orderedKeys = [...orderedKeys].reverse();
    }

    const result: ProspectTableItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      result.push({ kind: "header", label: key, count: group.length });
      group.forEach((p) => result.push({ kind: "prospect", prospect: p }));
    });
    return result;
  }, [rows, tableSearch, tableFilterStatus, tableFilterNiche, tableFilterCountry, tableFilterPriority, tableFilterSource, tableFilterOverdue, tableSortBy, tableGroupBy, tableGroupDirection]);

  /* -- Table toolbar (rendered inline with tab buttons) -- */
  const tableToolbar = (
    <>
      {/* Search */}
      <div className="inline-flex items-center h-9 px-2.5 rounded-full border border-black/[0.125] gap-1.5 shrink-0">
        <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        <input
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
          placeholder={t("page.searchPlaceholder")}
          className="bg-transparent outline-none text-[12px] text-foreground placeholder:text-muted-foreground/60 w-[140px]"
        />
        {tableSearch && (
          <button onClick={() => setTableSearch("")} className="shrink-0">
            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* +Add */}
      <ConfirmToolbarButton icon={Plus} label={t("toolbar.add")} onConfirm={handleAddProspect} confirmYes={t("toolbar.yes")} confirmNo={t("toolbar.no")} />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, tableSortBy !== "recent" ? xActive : xDefault, "hover:max-w-[100px]")}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.sortBy")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(TABLE_SORT_KEYS) as TableSortByOption[]).map((opt) => (
            <DropdownMenuItem key={opt} onClick={() => setTableSortBy(opt)} className={cn("text-[12px]", tableSortBy === opt && "font-semibold text-brand-indigo")}>
              {t(TABLE_SORT_KEYS[opt])}
              {tableSortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, isTableFilterActive ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Filter className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.filter")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-[400px] overflow-y-auto">
          <FilterAccordionSection label={t("filter.status")} activeCount={tableFilterStatus.length} defaultOpen={tableFilterStatus.length > 0}>
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); toggleTableFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[s] ?? "bg-zinc-400")} />
                <span className="flex-1">{s}</span>
                {tableFilterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
              </DropdownMenuItem>
            ))}
          </FilterAccordionSection>
          {availableNiches.length > 0 && (
            <FilterAccordionSection label={t("filter.niche")} activeCount={tableFilterNiche.length} defaultOpen={tableFilterNiche.length > 0}>
              {availableNiches.map((n) => (
                <DropdownMenuItem key={n} onClick={(e) => { e.preventDefault(); toggleTableFilterNiche(n); }} className="flex items-center gap-2 text-[12px]">
                  <span className="flex-1 truncate">{n}</span>
                  {tableFilterNiche.includes(n) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </FilterAccordionSection>
          )}
          {availableCountries.length > 0 && (
            <FilterAccordionSection label={t("filter.country")} activeCount={tableFilterCountry.length} defaultOpen={tableFilterCountry.length > 0}>
              {availableCountries.map((c) => (
                <DropdownMenuItem key={c} onClick={(e) => { e.preventDefault(); toggleTableFilterCountry(c); }} className="flex items-center gap-2 text-[12px]">
                  <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="flex-1 truncate">{c}</span>
                  {tableFilterCountry.includes(c) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </FilterAccordionSection>
          )}
          {availablePriorities.length > 0 && (
            <FilterAccordionSection label={t("filter.priority")} activeCount={tableFilterPriority.length} defaultOpen={tableFilterPriority.length > 0}>
              {availablePriorities.map((p) => (
                <DropdownMenuItem key={p} onClick={(e) => { e.preventDefault(); toggleTableFilterPriority(p); }} className="flex items-center gap-2 text-[12px]">
                  <span className="flex-1 truncate">{p}</span>
                  {tableFilterPriority.includes(p) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </FilterAccordionSection>
          )}
          {availableSources.length > 0 && (
            <FilterAccordionSection label="Source" activeCount={tableFilterSource.length} defaultOpen={tableFilterSource.length > 0}>
              {availableSources.map((s) => (
                <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); toggleTableFilterSource(s); }} className="flex items-center gap-2 text-[12px]">
                  <span className="flex-1 truncate">{s}</span>
                  {tableFilterSource.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </FilterAccordionSection>
          )}
          {isTableFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearTableFilters} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, tableGroupBy !== "status" ? xActive : xDefault, "hover:max-w-[100px]")}>
            <Layers className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.group")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(Object.keys(TABLE_GROUP_KEYS) as TableGroupByOption[]).map((opt) => (
            <DropdownMenuItem
              key={opt}
              onSelect={(e) => { e.preventDefault(); setTableGroupBy(opt); }}
              className="text-[12px] flex items-center gap-2"
            >
              <span className={cn("flex-1", tableGroupBy === opt && "font-semibold !text-brand-indigo")}>{t(TABLE_GROUP_KEYS[opt])}</span>
              {tableGroupBy === opt && opt !== "none" && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTableGroupDirection("asc"); }}
                    className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", tableGroupDirection === "asc" ? "text-brand-indigo" : "text-foreground/30")}
                    title="Ascending"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTableGroupDirection("desc"); }}
                    className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", tableGroupDirection === "desc" ? "text-brand-indigo" : "text-foreground/30")}
                    title="Descending"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </>
              )}
              {tableGroupBy === opt && opt === "none" && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Overdue toggle */}
      <button
        onClick={() => setTableFilterOverdue((v) => !v)}
        className={cn(xBase, tableFilterOverdue ? xActive : xDefault, "hover:max-w-[100px]")}
        title={t("toolbar.overdue")}
      >
        <Clock className="h-4 w-4 shrink-0" />
        <span className={xSpan}>{t("toolbar.overdue")}</span>
      </button>

      {/* Fields (Column Visibility) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, visibleCols.size !== DEFAULT_VISIBLE.length ? xActive : xDefault, "hover:max-w-[100px]")}>
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
                <span className="flex-1">{col.label}</span>
                {!col.defaultVisible && (
                  <span className="text-[9px] text-muted-foreground/40 px-1 bg-muted rounded font-medium">+</span>
                )}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE))} className="text-[12px] text-muted-foreground">
            {t("toolbar.resetToDefault")}
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
            Reset column order
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setColumnWidths({})} className="text-[12px] text-muted-foreground">
            Reset column widths
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.data")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportCSV} className="text-[12px]">{t("toolbar.exportCSV")}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => csvInputRef.current?.click()} className="text-[12px]">{t("toolbar.importCSV")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selection actions -- far right, when rows selected */}
      {tableSelectedIds.size > 0 && (
        <>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-1 shrink-0">
            {/* Change Status dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(xBase, xDefault, "hover:max-w-[140px]")}>
                  <Pencil className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("toolbar.changeStatus")}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleBulkStatusChange(s)} className="text-[12px]">
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmToolbarButton icon={Copy} label={t("toolbar.duplicate")} onConfirm={handleDuplicateProspects} confirmYes={t("toolbar.yes")} confirmNo={t("toolbar.no")} />
            <ConfirmToolbarButton icon={Trash2} label={t("toolbar.delete")} onConfirm={handleBulkDeleteProspects} variant="danger" confirmYes={t("toolbar.yes")} confirmNo={t("toolbar.no")} />

            {/* Count badge with dismiss */}
            <button
              className="h-9 inline-flex items-center gap-1.5 rounded-full border border-black/[0.125] bg-card px-3 text-[12px] font-medium shrink-0 cursor-default ml-1 text-foreground/60"
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

  /* -- Pipeline toolbar (leads-style) -- */
  const pipelineToolbar = (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Search (expandable) */}
      {pipelineSearchOpen ? (
        <div className="flex items-center gap-1.5 h-10 rounded-full border border-black/[0.125] bg-card/60 px-2.5 shrink-0">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={pipelineSearch}
            onChange={(e) => setPipelineSearch(e.target.value)}
            placeholder={t("page.searchPlaceholder")}
            onBlur={() => { if (!pipelineSearch) setPipelineSearchOpen(false); }}
            className="text-[12px] bg-transparent outline-none w-28 min-w-0 text-foreground placeholder:text-muted-foreground/60"
          />
          <button type="button" onClick={() => { setPipelineSearch(""); setPipelineSearchOpen(false); }}>
            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      ) : (
        <IconBtn onClick={() => setPipelineSearchOpen(true)} active={!!pipelineSearch} title="Search prospects">
          <Search className="h-4 w-4" />
        </IconBtn>
      )}

      {/* Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn("toolbar-pill-base", isPipelineFilterActive && "toolbar-pill-active")}>
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            {t("toolbar.filter")}
            {isPipelineFilterActive && (
              <span className="h-4 w-4 rounded-full bg-brand-indigo text-white text-[9px] font-bold flex items-center justify-center shrink-0 ml-0.5">
                {pipelineActiveFilterCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 rounded-2xl max-h-[400px] overflow-y-auto">
          <FilterAccordionSection
            label={t("toolbar.contactInfo")}
            activeCount={(pipelineFilterHasPhone ? 1 : 0) + (pipelineFilterHasEmail ? 1 : 0)}
            defaultOpen={(pipelineFilterHasPhone || pipelineFilterHasEmail)}
          >
            <DropdownMenuItem
              onClick={() => setPipelineFilterHasPhone(!pipelineFilterHasPhone)}
              className="flex items-center gap-2 cursor-pointer rounded-xl"
            >
              <Phone className={cn("h-4 w-4 shrink-0", pipelineFilterHasPhone ? "text-brand-indigo" : "text-muted-foreground")} />
              <span className={cn("text-sm flex-1", pipelineFilterHasPhone && "font-semibold")}>Has Phone</span>
              {pipelineFilterHasPhone && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setPipelineFilterHasEmail(!pipelineFilterHasEmail)}
              className="flex items-center gap-2 cursor-pointer rounded-xl"
            >
              <Mail className={cn("h-4 w-4 shrink-0", pipelineFilterHasEmail ? "text-brand-indigo" : "text-muted-foreground")} />
              <span className={cn("text-sm flex-1", pipelineFilterHasEmail && "font-semibold")}>Has Email</span>
              {pipelineFilterHasEmail && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          </FilterAccordionSection>
          {availableNiches.length > 0 && (
            <FilterAccordionSection
              label={t("group.niche")}
              activeCount={pipelineFilterNiche.length}
              defaultOpen={pipelineFilterNiche.length > 0}
            >
              {availableNiches.map((n) => (
                <DropdownMenuItem
                  key={n}
                  onClick={(e) => { e.preventDefault(); setPipelineFilterNiche((prev) => prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]); }}
                  className="flex items-center gap-2 cursor-pointer rounded-xl"
                >
                  <span className={cn("text-sm flex-1", pipelineFilterNiche.includes(n) && "font-semibold")}>{n}</span>
                  {pipelineFilterNiche.includes(n) && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </FilterAccordionSection>
          )}
          {availableCountries.length > 0 && (
            <FilterAccordionSection
              label={t("filter.country")}
              activeCount={pipelineFilterCountry.length}
              defaultOpen={pipelineFilterCountry.length > 0}
            >
              {availableCountries.map((c) => (
                <DropdownMenuItem
                  key={c}
                  onClick={(e) => { e.preventDefault(); setPipelineFilterCountry((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]); }}
                  className="flex items-center gap-2 cursor-pointer rounded-xl"
                >
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <span className={cn("text-sm flex-1", pipelineFilterCountry.includes(c) && "font-semibold")}>{c}</span>
                  {pipelineFilterCountry.includes(c) && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              ))}
            </FilterAccordionSection>
          )}
          {isPipelineFilterActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearPipelineFilters} className="flex items-center gap-2 cursor-pointer rounded-xl text-muted-foreground">
                <X className="h-4 w-4 shrink-0" />
                <span className="text-sm">{t("toolbar.clearAllFilters")}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarPill
            icon={ArrowUpDown}
            label={t("toolbar.sort")}
            active={isPipelineSortActive}
            activeValue={isPipelineSortActive ? (pipelineSortBy === "name-asc" ? "A-Z" : pipelineSortBy === "name-desc" ? "Z-A" : "Priority") : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 rounded-2xl">
          {([
            { value: null, label: "Default" },
            { value: "name-asc" as const, label: "Name A → Z" },
            { value: "name-desc" as const, label: "Name Z → A" },
            { value: "priority" as const, label: "Priority" },
          ]).map((opt) => (
            <DropdownMenuItem
              key={String(opt.value)}
              onClick={() => setPipelineSortBy(opt.value)}
              className="flex items-center gap-2 cursor-pointer rounded-xl"
            >
              <span className={cn("text-sm flex-1", pipelineSortBy === opt.value && "font-semibold")}>{opt.label}</span>
              {pipelineSortBy === opt.value && <Check className="h-4 w-4 text-brand-indigo shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Compact mode toggle */}
      <button
        onClick={() => setPipelineCompactMode((v) => !v)}
        className={cn(
          "h-10 px-4 rounded-full flex items-center gap-2 text-sm font-medium transition-colors hidden md:inline-flex",
          pipelineCompactMode
            ? "bg-black text-[#FFE35B] border border-black hover:opacity-85"
            : "border border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
        )}
      >
        <Rows3 className="h-4 w-4 shrink-0" />
        <span>{pipelineCompactMode ? "Normal" : "Compact"}</span>
      </button>

      {/* Fold / Unfold — simple toggle: fold empty columns or unfold all */}
      <button
        onClick={() => {
          if (pipelineHasCollapsed) {
            pipelineExpandAllRef.current?.();
          } else {
            pipelineFoldThresholdRef.current?.(0);
          }
        }}
        className={cn(
          "h-10 px-4 rounded-full flex items-center gap-2 text-sm font-medium transition-colors",
          pipelineHasCollapsed
            ? "bg-black text-[#FFE35B] border border-black hover:opacity-85"
            : "border border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
        )}
      >
        <Columns3 className="h-4 w-4 shrink-0" />
        <span>{pipelineHasCollapsed ? t("toolbar.unfold") : t("toolbar.fold")}</span>
      </button>
    </div>
  );

  return (
    <>
      <div className="flex flex-col h-full" data-testid="page-prospects">
        <div className="flex-1 overflow-hidden">

          {/* ── List view gets full layout (own header + left/right panels) ── */}
          {viewMode === "list" ? (
              <ProspectListView
                prospects={rows as ProspectRow[]}
                loading={loading}
                selectedProspect={selectedProspect}
                onSelectProspect={(p) => { if (p) handleSelectProspect(p); }}
                onAddProspect={handleAddProspect}
                onCreate={async (form) => {
                  const created = await createProspect(form as unknown as Record<string, unknown>);
                  await fetchData();
                  if (created) setSelectedProspect(created as ProspectRow);
                  return created;
                }}
                onSave={handleFieldSave}
                onDelete={handleDeleteProspect}
                onToggleStatus={async (status) => {
                  if (!selectedProspect) return;
                  const pid = selectedProspect.Id ?? selectedProspect.id ?? 0;
                  await updateProspect(pid, { status });
                  fetchData();
                }}
                viewMode="list"
                onViewModeChange={(mode) => setViewMode(mode as ViewMode)}
                listSearch={tableSearch}
                onListSearchChange={setTableSearch}
                searchOpen={false}
                onSearchOpenChange={() => {}}
                groupBy={listGroupBy}
                onGroupByChange={setListGroupBy}
                sortBy={listSortBy}
                onSortByChange={setListSortBy}
                filterNiche={listFilterNiche}
                onToggleFilterNiche={toggleListFilterNiche}
                filterStatus={listFilterStatus}
                onToggleFilterStatus={toggleListFilterStatus}
                filterCountry={listFilterCountry}
                onToggleFilterCountry={toggleListFilterCountry}
                filterPriority={listFilterPriority}
                onToggleFilterPriority={toggleListFilterPriority}
                filterSource={listFilterSource}
                onToggleFilterSource={toggleListFilterSource}
                hasNonDefaultControls={hasListNonDefaultControls}
                isGroupNonDefault={isListGroupNonDefault}
                isSortNonDefault={isListSortNonDefault}
                onResetControls={clearListFilters}
                onRefreshProspect={fetchData}
              />
          ) : (

          <div className="flex-1 min-h-0 flex overflow-hidden h-full gap-[3px]">
            <div className="flex flex-col bg-muted overflow-hidden flex-1 min-w-0 rounded-lg">

              {/* Title + view tabs + toolbar */}
              <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-1 md:pb-3 shrink-0 flex flex-col md:flex-row md:items-center md:gap-3 md:overflow-x-auto md:[scrollbar-width:none]">
                <div className="flex items-center justify-between w-full md:w-auto md:shrink-0 md:gap-6">
                  <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
                  <span className="hidden md:block">
                    <ViewTabBar
                      tabs={viewTabs}
                      activeId={viewMode}
                      onTabChange={(id) => setViewMode(id as ViewMode)}
                      variant="segment"
                    />
                  </span>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] pb-2 md:pb-0 md:contents">
                  <div className="md:hidden">
                    <ViewTabBar
                      tabs={viewTabs}
                      activeId={viewMode}
                      onTabChange={(id) => setViewMode(id as ViewMode)}
                      variant="segment"
                    />
                  </div>
                  <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
                  {viewMode === "table" && tableToolbar}
                  {viewMode === "pipeline" && pipelineToolbar}
                  {viewMode === "followups" && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Search */}
                      <div className="inline-flex items-center h-9 px-2.5 rounded-full border border-black/[0.125] gap-1.5 shrink-0">
                        <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                        <input
                          value={followUpSearch}
                          onChange={(e) => setFollowUpSearch(e.target.value)}
                          placeholder={t("followups.searchPlaceholder")}
                          className="bg-transparent outline-none text-[12px] text-foreground placeholder:text-muted-foreground/60 w-[140px]"
                        />
                        {followUpSearch && (
                          <button onClick={() => setFollowUpSearch("")} className="shrink-0">
                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </button>
                        )}
                      </div>

                      {/* Sort */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn(xBase, followUpSortBy !== "date_asc" ? xActive : xDefault, "hover:max-w-[100px]")}>
                            <ArrowUpDown className="h-4 w-4 shrink-0" />
                            <span className={xSpan}>{t("toolbar.sort")}</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.sortBy")}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {([
                            { value: "date_asc" as const, labelKey: "sort.dateSoonest" },
                            { value: "date_desc" as const, labelKey: "sort.dateLatest" },
                            { value: "priority" as const, labelKey: "sort.priority" },
                            { value: "name_asc" as const, labelKey: "sort.nameAZ" },
                          ]).map((opt) => (
                            <DropdownMenuItem key={opt.value} onClick={() => setFollowUpSortBy(opt.value)} className={cn("text-[12px]", followUpSortBy === opt.value && "font-semibold text-brand-indigo")}>
                              {t(opt.labelKey)}
                              {followUpSortBy === opt.value && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Filter */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn(xBase, isFollowUpFilterActive ? xActive : xDefault, "hover:max-w-[100px]")}>
                            <Filter className="h-4 w-4 shrink-0" />
                            <span className={xSpan}>{t("toolbar.filter")}</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52 max-h-[400px] overflow-y-auto">
                          {availableNiches.length > 0 && (
                            <FilterAccordionSection
                              label={t("filter.niche")}
                              activeCount={followUpFilterNiche.length}
                              defaultOpen={followUpFilterNiche.length > 0}
                            >
                              {availableNiches.map((n) => (
                                <DropdownMenuItem
                                  key={n}
                                  onClick={(e) => { e.preventDefault(); toggleFollowUpFilterNiche(n); }}
                                  className="flex items-center gap-2 text-[12px]"
                                >
                                  <span className="flex-1">{n}</span>
                                  {followUpFilterNiche.includes(n) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                                </DropdownMenuItem>
                              ))}
                            </FilterAccordionSection>
                          )}
                          {availableCountries.length > 0 && (
                            <FilterAccordionSection
                              label={t("filter.country")}
                              activeCount={followUpFilterCountry.length}
                              defaultOpen={followUpFilterCountry.length > 0}
                            >
                              {availableCountries.map((c) => (
                                <DropdownMenuItem
                                  key={c}
                                  onClick={(e) => { e.preventDefault(); toggleFollowUpFilterCountry(c); }}
                                  className="flex items-center gap-2 text-[12px]"
                                >
                                  <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                  <span className="flex-1">{c}</span>
                                  {followUpFilterCountry.includes(c) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                                </DropdownMenuItem>
                              ))}
                            </FilterAccordionSection>
                          )}
                          {availablePriorities.length > 0 && (
                            <FilterAccordionSection
                              label={t("filter.priority")}
                              activeCount={followUpFilterPriority.length}
                              defaultOpen={followUpFilterPriority.length > 0}
                            >
                              {availablePriorities.map((p) => (
                                <DropdownMenuItem
                                  key={p}
                                  onClick={(e) => { e.preventDefault(); toggleFollowUpFilterPriority(p); }}
                                  className="flex items-center gap-2 text-[12px]"
                                >
                                  <span className="flex-1">{p}</span>
                                  {followUpFilterPriority.includes(p) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                                </DropdownMenuItem>
                              ))}
                            </FilterAccordionSection>
                          )}
                          <FilterAccordionSection
                            label={t("filter.contactMethod")}
                            activeCount={followUpFilterContactMethod.length}
                            defaultOpen={followUpFilterContactMethod.length > 0}
                          >
                            {CONTACT_METHOD_OPTIONS.map((m) => (
                              <DropdownMenuItem
                                key={m}
                                onClick={(e) => { e.preventDefault(); toggleFollowUpFilterContactMethod(m); }}
                                className="flex items-center gap-2 text-[12px]"
                              >
                                <span className="flex-1 capitalize">{m}</span>
                                {followUpFilterContactMethod.includes(m) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </FilterAccordionSection>
                          {isFollowUpFilterActive && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={clearFollowUpFilters} className="text-[12px] text-destructive">
                                {t("toolbar.clearAllFilters")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Group */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn(xBase, followUpGroupBy !== "none" ? xActive : xDefault, "hover:max-w-[100px]")}>
                            <Layers className="h-4 w-4 shrink-0" />
                            <span className={xSpan}>{t("toolbar.group")}</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          {(["none", "niche", "country", "priority", "contact_method"] as const).map((opt) => (
                            <DropdownMenuItem
                              key={opt}
                              onClick={() => setFollowUpGroupBy(opt)}
                              className={cn("text-[12px]", followUpGroupBy === opt && "font-semibold text-brand-indigo")}
                            >
                              {t(opt === "contact_method" ? "filter.contactMethod" : opt === "none" ? "group.none" : `group.${opt}`)}
                              {followUpGroupBy === opt && <Check className="h-3 w-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  {viewMode === "templates" && (
                    <TemplatesToolbar
                      search={tplSearch}
                      onSearchChange={setTplSearch}
                      filterType={tplFilterType}
                      onFilterTypeChange={setTplFilterType}
                      templateTypes={tplViewRef.current?.templateTypes ?? []}
                      count={tplViewRef.current?.filteredCount ?? 0}
                      total={tplViewRef.current?.totalCount ?? 0}
                      onNew={() => tplViewRef.current?.createNew()}
                    />
                  )}
                </div>
              </div>

                {/* Content area — switches based on view mode */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {viewMode === "table" && (
                    <ProspectsInlineTable
                      flatItems={tableFlatItems}
                      loading={loading}
                      selectedProspectId={selectedProspect ? (selectedProspect.Id ?? (selectedProspect as any).id ?? null) : null}
                      onSelectProspect={handleSelectProspect}
                      onRefresh={fetchData}
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
                  )}
                  {viewMode === "pipeline" && (
                    <OutreachPipelineView
                      prospects={rows as ProspectRow[]}
                      searchQuery={tableSearch}
                      onSelectProspect={handleSelectProspect}
                      onRefresh={fetchData}
                      pipelineSearch={pipelineSearch}
                      pipelineSortBy={pipelineSortBy}
                      pipelineFilterHasPhone={pipelineFilterHasPhone}
                      pipelineFilterHasEmail={pipelineFilterHasEmail}
                      pipelineFilterNiche={pipelineFilterNiche}
                      pipelineFilterCountry={pipelineFilterCountry}
                      compactMode={pipelineCompactMode}
                      onCollapsedChange={setPipelineHasCollapsed}
                      expandAllRef={pipelineExpandAllRef}
                      foldThresholdRef={pipelineFoldThresholdRef}
                    />
                  )}
                  {viewMode === "followups" && (
                    <div className="h-full overflow-y-auto p-4">
                      {followUpRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                          <Clock className="h-10 w-10 mb-3 text-muted-foreground/30" />
                          <p className="text-[14px] font-medium">{t("followups.noFollowUps")}</p>
                          <p className="text-[12px] text-muted-foreground/60 mt-1">{t("followups.noFollowUpsHint")}</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-w-2xl">
                          {(() => {
                            // Group if needed
                            if (followUpGroupBy === "none") {
                              return followUpRows.map((p) => <FollowUpCard key={p.Id ?? p.id} prospect={p} onClick={() => handleSelectProspect(p)} />);
                            }
                            const groups = new Map<string, ProspectRow[]>();
                            followUpRows.forEach((p) => {
                              const key = followUpGroupBy === "contact_method"
                                ? String(p.contact_method || "email")
                                : String((p as any)[followUpGroupBy] || "Unknown");
                              if (!groups.has(key)) groups.set(key, []);
                              groups.get(key)!.push(p);
                            });
                            return Array.from(groups.entries()).map(([groupLabel, items]) => (
                              <div key={groupLabel}>
                                <div className="flex items-center gap-2 py-2 mb-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{groupLabel}</span>
                                  <span className="text-[10px] text-muted-foreground/50 tabular-nums">({items.length})</span>
                                  <div className="flex-1 h-px bg-border/30" />
                                </div>
                                {items.map((p) => <FollowUpCard key={p.Id ?? p.id} prospect={p} onClick={() => handleSelectProspect(p)} />)}
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                  {viewMode === "templates" && (
                    <OutreachTemplatesView ref={tplViewRef} search={tplSearch} filterType={tplFilterType} />
                  )}
                </div>
            </div>
          </div>
          )}

        </div>
      </div>

      <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />

    </>
  );
}
