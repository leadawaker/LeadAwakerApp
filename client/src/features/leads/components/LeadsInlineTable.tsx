import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Tag as TagIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateLead, bulkUpdateLeads } from "../api/leadsApi";
import { resolveColor } from "@/features/tags/types";
import type { VirtualListItem } from "./LeadsCardView";
import { getStatusAvatarColor, PIPELINE_HEX, ListScoreRing } from "./LeadsCardView";

// ── Column definitions ─────────────────────────────────────────────────────────
type ColKey =
  | "name" | "status" | "score" | "phone" | "email" | "campaign"
  | "tags" | "lastActivity" | "notes"
  | "account" | "source" | "company" | "bumpStage" | "createdAt" | "assignedTo";

interface ColumnDef {
  key: ColKey;
  label: string;
  width: number;
  editable: boolean;
  type: "text" | "select";
}

const ALL_TABLE_COLUMNS: ColumnDef[] = [
  { key: "name",         label: "Name",          width: 200, editable: false, type: "text"   },
  { key: "status",       label: "Status",        width: 140, editable: true,  type: "select" },
  { key: "score",        label: "Score",         width: 70,  editable: false, type: "text"   },
  { key: "phone",        label: "Phone",         width: 140, editable: true,  type: "text"   },
  { key: "email",        label: "Email",         width: 180, editable: true,  type: "text"   },
  { key: "campaign",     label: "Campaign",      width: 130, editable: false, type: "text"   },
  { key: "tags",         label: "Tags",          width: 160, editable: false, type: "text"   },
  { key: "lastActivity", label: "Last Activity", width: 110, editable: false, type: "text"   },
  { key: "notes",        label: "Notes",         width: 200, editable: true,  type: "text"   },
  // Extended (hidden by default — toggled via Fields button)
  { key: "account",      label: "Account",       width: 130, editable: false, type: "text"   },
  { key: "source",       label: "Source",        width: 110, editable: false, type: "text"   },
  { key: "company",      label: "Company",       width: 130, editable: false, type: "text"   },
  { key: "bumpStage",    label: "Bump Stage",    width: 100, editable: false, type: "text"   },
  { key: "createdAt",    label: "Created",       width: 110, editable: false, type: "text"   },
  { key: "assignedTo",   label: "Assigned To",   width: 130, editable: false, type: "text"   },
];

const STATUS_OPTIONS = [
  "New", "Contacted", "Responded", "Multiple Responses",
  "Qualified", "Booked", "Lost", "DND",
];

const DB_FIELD_MAP: Partial<Record<ColKey, string>> = {
  status: "Conversion_Status",
  phone:  "phone",
  email:  "email",
  notes:  "notes",
};

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLeadId(lead: Record<string, any>): number {
  return lead.Id ?? lead.id ?? 0;
}
function getFullName(lead: Record<string, any>): string {
  return lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}
function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}
function getScore(lead: Record<string, any>): number {
  return Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0);
}
function getStatus(lead: Record<string, any>): string {
  return lead.conversion_status || lead.Conversion_Status || "";
}
function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs   = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "Just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)  return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch { return ""; }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] bg-[#F1F1F1]/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ── Editable cell ─────────────────────────────────────────────────────────────
interface EditableCellProps {
  value: string;
  type: "text" | "select";
  isEditing: boolean;
  editValue: string;
  isSaving: boolean;
  hasError: boolean;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onSave: (v: string) => void;
  onCancel: () => void;
}

function EditableCell({
  value, type, isEditing, editValue, isSaving, hasError,
  onStartEdit, onEditChange, onSave, onCancel,
}: EditableCellProps) {
  if (isEditing && type === "select") {
    return (
      <select
        autoFocus
        value={editValue}
        onChange={(e) => onSave(e.target.value)}
        onBlur={() => onSave(editValue)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        className="w-full h-[28px] text-[11px] bg-white rounded px-1.5 ring-1 ring-brand-indigo/40 outline-none cursor-pointer"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    );
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        type="text"
        value={editValue}
        onChange={(e) => onEditChange(e.target.value)}
        onBlur={() => onSave(editValue)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") onCancel();
        }}
        className="w-full h-[28px] text-[11px] bg-white px-1.5 rounded ring-1 ring-brand-indigo/40 outline-none"
      />
    );
  }

  return (
    <div
      className={cn(
        "w-full h-[28px] px-1.5 flex items-center text-[11px] truncate rounded cursor-text select-none",
        hasError && "ring-1 ring-red-400/60 bg-red-50/30",
        isSaving && "opacity-50",
      )}
      onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      title={hasError ? "Save failed — click to retry" : value}
    >
      <span className="truncate flex-1">
        {value || <span className="text-muted-foreground/35 italic not-italic">—</span>}
      </span>
      {isSaving && (
        <div className="h-2.5 w-2.5 border border-brand-indigo/40 border-t-brand-indigo rounded-full animate-spin ml-1 shrink-0" />
      )}
      {hasError && !isSaving && (
        <span className="text-red-500 ml-1 shrink-0 text-[9px] font-bold">!</span>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface LeadsInlineTableProps {
  flatItems: VirtualListItem[];
  loading: boolean;
  selectedLeadId: number | null;
  onSelectLead: (lead: Record<string, any>) => void;
  onRefresh?: () => void;
  /** Visible column keys — managed by parent (persistent via localStorage) */
  visibleCols: Set<string>;
  /** Text search — managed by parent (rendered inline with tabs) */
  tableSearch: string;
  /** Multi-select state — lifted to parent */
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LeadsInlineTable({
  flatItems,
  loading,
  selectedLeadId,
  onSelectLead,
  onRefresh,
  visibleCols,
  tableSearch,
  selectedIds,
  onSelectionChange,
}: LeadsInlineTableProps) {

  // ── Editing state ─────────────────────────────────────────────────────────
  const [editingCell,    setEditingCell]    = useState<{ leadId: number; field: ColKey } | null>(null);
  const [editValue,      setEditValue]      = useState<string>("");
  const [savingCell,     setSavingCell]     = useState<{ leadId: number; field: ColKey } | null>(null);
  const [saveError,      setSaveError]      = useState<{ leadId: number; field: ColKey } | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Map<number, Partial<Record<ColKey, string>>>>(new Map());

  // ── Shift-click ref ────────────────────────────────────────────────────────
  const lastClickedIndexRef = useRef<number>(-1);

  // ── Table pagination ─────────────────────────────────────────────────────
  const TABLE_PAGE_SIZE = 50;
  const [tablePage, setTablePage] = useState(0);

  // ── Bulk stage change (still in inline table) ──────────────────────────────
  const [bulkStageOpen, setBulkStageOpen] = useState(false);

  // ── Group collapse ─────────────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (label: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  // ── Compute visible columns from prop ─────────────────────────────────────
  const visibleColumns = useMemo(
    () => ALL_TABLE_COLUMNS.filter((c) => visibleCols.has(c.key)),
    [visibleCols]
  );
  const colSpan = visibleColumns.length + 1; // +1 for select-all checkbox column

  // ── Filter by text search (parent manages sort/filter; we only do text) ───
  const displayItems = useMemo(() => {
    if (!tableSearch.trim()) return flatItems;
    const q = tableSearch.toLowerCase();
    return flatItems.filter((item) => {
      if (item.kind === "header") return false;
      const name  = getFullName(item.lead).toLowerCase();
      const email = (item.lead.email || item.lead.Email || "").toLowerCase();
      const phone = (item.lead.phone || item.lead.Phone || "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [flatItems, tableSearch]);

  // ── Flat lead-only list (for shift-click range selection) ─────────────────
  const leadIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    let idx = 0;
    displayItems.forEach((item) => {
      if (item.kind === "lead") { map.set(getLeadId(item.lead), idx); idx++; }
    });
    return map;
  }, [displayItems]);

  const leadOnlyItems = useMemo(
    () => displayItems.filter((i): i is Extract<VirtualListItem, { kind: "lead" }> => i.kind === "lead"),
    [displayItems],
  );

  const leadCount = leadOnlyItems.length;

  // ── getCellValue ──────────────────────────────────────────────────────────
  function getCellValue(lead: Record<string, any>, field: ColKey): string {
    const overrides = localOverrides.get(getLeadId(lead));
    if (overrides?.[field] !== undefined) return overrides[field]!;
    switch (field) {
      case "status":       return getStatus(lead);
      case "score":        return String(getScore(lead) || "");
      case "phone":        return lead.phone || lead.Phone || "";
      case "email":        return lead.email || lead.Email || "";
      case "campaign":     return lead.Campaign || lead.campaign || lead.campaign_name || "";
      case "lastActivity": {
        const d = lead.last_interaction_at || lead.last_message_received_at || lead.last_message_sent_at || "";
        return formatRelativeTime(d);
      }
      case "notes":        return lead.notes || lead.Notes || "";
      // Extended fields
      case "account":      return lead.account_name || lead.Account || String(lead.Accounts_id || "");
      case "source":       return lead.source || lead.Source || "";
      case "company":      return lead.company || lead.Company || "";
      case "bumpStage":    return lead.bump_stage || lead.Bump_Stage || String(lead.bump_count || "");
      case "createdAt": {
        const d = lead.createdAt || lead.created_at || lead.CreatedAt || "";
        return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
      }
      case "assignedTo":   return lead.assigned_to || lead.AssignedTo || "";
      default:             return "";
    }
  }

  // ── Editing helpers ────────────────────────────────────────────────────────
  const startEdit = useCallback((leadId: number, field: ColKey, currentValue: string) => {
    setEditingCell({ leadId, field });
    setEditValue(currentValue);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  const handleSave = useCallback(async (leadId: number, field: ColKey, newValue: string, originalValue: string) => {
    setEditingCell(null);
    if (newValue === originalValue) return;
    const dbField = DB_FIELD_MAP[field];
    if (!dbField) return;

    setLocalOverrides((prev) => {
      const next = new Map(prev);
      next.set(leadId, { ...next.get(leadId), [field]: newValue });
      return next;
    });
    setSavingCell({ leadId, field });
    setSaveError(null);

    try {
      await updateLead(leadId, { [dbField]: newValue });
    } catch {
      setLocalOverrides((prev) => {
        const next = new Map(prev);
        next.set(leadId, { ...next.get(leadId), [field]: originalValue });
        return next;
      });
      setSaveError({ leadId, field });
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setSavingCell(null);
    }
  }, []);

  // ── Row click handler ──────────────────────────────────────────────────────
  // Simple click = single select + open detail (checkbox checked)
  // Ctrl+Click = toggle selection (multi-select)
  // Shift+Click = range select
  const handleRowClick = useCallback((lead: Record<string, any>, e: React.MouseEvent) => {
    const leadId = getLeadId(lead);
    const idx    = leadIndexMap.get(leadId) ?? -1;

    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      const lo = Math.min(lastClickedIndexRef.current, idx);
      const hi = Math.max(lastClickedIndexRef.current, idx);
      const rangeIds = leadOnlyItems.slice(lo, hi + 1).map((item) => getLeadId(item.lead));
      const next = new Set(selectedIds);
      rangeIds.forEach((id) => next.add(id));
      onSelectionChange(next);
      if (next.size === 1) {
        const only = leadOnlyItems.find((i) => getLeadId(i.lead) === Array.from(next)[0]);
        if (only) onSelectLead(only.lead);
      }
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(leadId)) next.delete(leadId); else next.add(leadId);
      onSelectionChange(next);
      if (next.size === 1) {
        const only = leadOnlyItems.find((i) => getLeadId(i.lead) === Array.from(next)[0]);
        if (only) onSelectLead(only.lead);
      }
      lastClickedIndexRef.current = idx;
    } else {
      // Simple click: single select + open detail
      onSelectionChange(new Set([leadId]));
      onSelectLead(lead);
      lastClickedIndexRef.current = idx;
    }
  }, [leadIndexMap, leadOnlyItems, onSelectLead, onSelectionChange, selectedIds]);

  // ── Bulk stage change (still useful as inline action) ──────────────────────
  const handleBulkStageChange = useCallback(async (stage: string) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkUpdateLeads(Array.from(selectedIds), { Conversion_Status: stage });
      onSelectionChange(new Set());
      setBulkStageOpen(false);
      onRefresh?.();
    } catch (err) { console.error("Bulk stage change failed", err); }
  }, [selectedIds, onRefresh, onSelectionChange]);

  // ── Select-all toggle ───────────────────────────────────────────────────
  const allLeadIds = useMemo(() => leadOnlyItems.map((i) => getLeadId(i.lead)), [leadOnlyItems]);
  const allSelected = leadCount > 0 && allLeadIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && allLeadIds.some((id) => selectedIds.has(id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(allLeadIds));
    }
  }, [allSelected, allLeadIds, onSelectionChange]);

  const getGroupLeadIds = useCallback((groupLabel: string): number[] => {
    const ids: number[] = [];
    let inGroup = false;
    for (const item of displayItems) {
      if (item.kind === "header") {
        inGroup = item.label === groupLabel;
        continue;
      }
      if (inGroup && item.kind === "lead") {
        ids.push(getLeadId(item.lead));
      }
    }
    return ids;
  }, [displayItems]);

  const handleGroupCheckbox = useCallback((groupLabel: string) => {
    const groupIds = getGroupLeadIds(groupLabel);
    const allInGroupSelected = groupIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allInGroupSelected) {
      groupIds.forEach((id) => next.delete(id));
    } else {
      groupIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  }, [getGroupLeadIds, selectedIds, onSelectionChange]);

  // ── Paginated display items ────────────────────────────────────────────
  // Reset page when data changes
  useEffect(() => { setTablePage(0); }, [displayItems.length]);

  const totalPages = Math.ceil(leadCount / TABLE_PAGE_SIZE);
  const paginatedItems = useMemo(() => {
    if (leadCount <= TABLE_PAGE_SIZE) return displayItems;
    // We need to keep headers and paginate lead items
    let leadIdx = 0;
    const startIdx = tablePage * TABLE_PAGE_SIZE;
    const endIdx = startIdx + TABLE_PAGE_SIZE;
    const result: typeof displayItems = [];
    let lastHeader: typeof displayItems[0] | null = null;
    for (const item of displayItems) {
      if (item.kind === "header") {
        lastHeader = item;
        continue;
      }
      if (leadIdx >= startIdx && leadIdx < endIdx) {
        if (lastHeader) { result.push(lastHeader); lastHeader = null; }
        result.push(item);
      }
      leadIdx++;
      if (leadIdx >= endIdx) break;
    }
    return result;
  }, [displayItems, tablePage, leadCount]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">

      {/* ── Change Stage bar (only when multi-selection active) ── */}
      {selectedIds.size > 1 && (
        <div className="shrink-0 px-3 py-1.5 flex items-center gap-1.5 border-b border-border/20">
          <span className="text-[11px] font-semibold text-foreground tabular-nums mr-1">
            {selectedIds.size} selected
          </span>

          <DropdownMenu open={bulkStageOpen} onOpenChange={setBulkStageOpen}>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-border/30 bg-transparent text-muted-foreground hover:bg-card hover:text-foreground">
                <Pencil className="h-3 w-3" />
                Change Stage
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
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

          <button
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => onSelectionChange(new Set())}
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 600 }}>

            {/* Sticky header with select-all checkbox */}
            <thead className="sticky top-0 z-20">
              <tr>
                {/* Select-all checkbox */}
                <th
                  className="px-2 py-2 bg-muted border-b border-border/20 sticky left-0 z-30"
                  style={{ width: 36, minWidth: 36 }}
                >
                  <button
                    onClick={handleSelectAll}
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                      allSelected
                        ? "bg-brand-indigo border-brand-indigo text-white"
                        : someSelected
                          ? "bg-brand-indigo/30 border-brand-indigo/50"
                          : "border-border/50 hover:border-foreground/30"
                    )}
                    title={allSelected ? "Deselect all" : "Select all"}
                  >
                    {allSelected && <Check className="h-2.5 w-2.5" />}
                    {someSelected && !allSelected && <div className="h-1.5 w-1.5 bg-brand-indigo rounded-sm" />}
                  </button>
                </th>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20"
                    style={{
                      width:    col.key === "notes" ? undefined : col.width,
                      minWidth: col.width,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Empty state */}
              {leadCount === 0 && (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center text-xs text-muted-foreground">
                    {tableSearch ? "No leads match your search" : "No leads found"}
                  </td>
                </tr>
              )}

              {(() => {
                let currentGroup: string | null = null;
                return paginatedItems.map((item, index) => {
                  if (item.kind === "header") {
                    currentGroup = item.label;
                    const isCollapsed = collapsedGroups.has(item.label);
                    const hexColor    = PIPELINE_HEX[item.label] || "#6B7280";
                    const groupIds = getGroupLeadIds(item.label);
                    const isGroupFullySelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
                    return (
                      <tr
                        key={`h-${item.label}-${index}`}
                        className="cursor-pointer select-none"
                        onClick={() => toggleGroupCollapse(item.label)}
                      >
                        <td
                          colSpan={colSpan}
                          className="px-4 pt-4 pb-1.5 sticky left-0 z-30"
                          style={{ backgroundColor: `${hexColor}12` }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                                isGroupFullySelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGroupCheckbox(item.label);
                              }}
                            >
                              {isGroupFullySelected && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hexColor }} />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/55">{item.label}</span>
                            <span className="text-[10px] text-muted-foreground/40 font-medium tabular-nums">{item.count}</span>
                            <div className="ml-auto text-muted-foreground/40">
                              {isCollapsed
                                ? <ChevronRight className="h-3.5 w-3.5" />
                                : <ChevronDown  className="h-3.5 w-3.5" />}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  if (currentGroup && collapsedGroups.has(currentGroup)) return null;

                  const { lead, tags } = item;
                  const leadId         = getLeadId(lead);
                  const isDetailSelected = selectedLeadId === leadId;
                  const isMultiSelected  = selectedIds.has(leadId);
                  const isHighlighted    = isMultiSelected || isDetailSelected;
                  const name             = getFullName(lead);
                  const score            = getScore(lead);
                  const leadStatus       = getStatus(lead);
                  const avatarColor      = getStatusAvatarColor(leadStatus);

                  return (
                    <tr
                      key={leadId}
                      className={cn(
                        "group/row cursor-pointer h-[52px] border-b border-border/15",
                        isHighlighted ? "bg-[#FFF1C8]" : "bg-[#F1F1F1] hover:bg-[#F8F8F8]",
                      )}
                      onClick={(e) => handleRowClick(lead, e)}
                    >
                      {visibleColumns.map((col, ci) => {
                        const isFirst = ci === 0;
                        const tdClass = cn(
                          isFirst && "sticky left-0 z-10",
                          isFirst && (isHighlighted ? "bg-[#FFF1C8]" : "bg-[#F1F1F1] group-hover/row:bg-[#F8F8F8]"),
                        );

                        // ── Name ──
                        if (col.key === "name") {
                          return (
                            <td key="name" className={cn("px-2.5", tdClass)} style={{ width: 200, minWidth: 200 }}>
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Checkbox — always visible */}
                                <div
                                  className={cn(
                                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                                    isMultiSelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = new Set(selectedIds);
                                    if (next.has(leadId)) {
                                      next.delete(leadId);
                                      // If deselecting and something remains, keep selection
                                    } else {
                                      next.add(leadId);
                                    }
                                    onSelectionChange(next);
                                    if (next.size === 1) {
                                      const only = leadOnlyItems.find((i) => getLeadId(i.lead) === Array.from(next)[0]);
                                      if (only) onSelectLead(only.lead);
                                    }
                                  }}
                                >
                                  {isMultiSelected && <Check className="h-2.5 w-2.5 text-white" />}
                                </div>
                                <div
                                  className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                                  style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                                >
                                  {getInitials(name)}
                                </div>
                                <span className="text-[12px] font-medium truncate text-foreground">{name}</span>
                              </div>
                            </td>
                          );
                        }

                        // ── Status (editable select) ──
                        if (col.key === "status") {
                          const cellVal = getCellValue(lead, "status");
                          const isEdit  = editingCell?.leadId === leadId && editingCell?.field === "status";
                          return (
                            <td key="status" className={cn("px-1", tdClass)} style={{ width: 140, minWidth: 140 }}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {!isEdit && (
                                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[cellVal] ?? "bg-zinc-400")} />
                                )}
                                <EditableCell
                                  value={cellVal}
                                  type="select"
                                  isEditing={isEdit}
                                  editValue={isEdit ? editValue : ""}
                                  isSaving={savingCell?.leadId === leadId && savingCell?.field === "status"}
                                  hasError={saveError?.leadId === leadId && saveError?.field === "status"}
                                  onStartEdit={() => startEdit(leadId, "status", cellVal)}
                                  onEditChange={setEditValue}
                                  onSave={(v) => handleSave(leadId, "status", v, cellVal)}
                                  onCancel={cancelEdit}
                                />
                              </div>
                            </td>
                          );
                        }

                        // ── Score (read-only) ──
                        if (col.key === "score") {
                          return (
                            <td key="score" className={cn("px-2.5", tdClass)} style={{ width: 70, minWidth: 70 }}>
                              {score > 0 ? (
                                <ListScoreRing score={score} status={leadStatus} />
                              ) : (
                                <span className="text-muted-foreground/30 text-[11px]">—</span>
                              )}
                            </td>
                          );
                        }

                        // ── Campaign (read-only) ──
                        if (col.key === "campaign") {
                          return (
                            <td key="campaign" className={cn("px-2.5", tdClass)} style={{ width: 130, minWidth: 130 }}>
                              <span className="text-[11px] text-muted-foreground truncate block">
                                {getCellValue(lead, "campaign") || <span className="text-muted-foreground/30">—</span>}
                              </span>
                            </td>
                          );
                        }

                        // ── Tags (read-only pills) ──
                        if (col.key === "tags") {
                          return (
                            <td key="tags" className={cn("px-2", tdClass)} style={{ width: 160, minWidth: 160 }}>
                              <div className="flex items-center gap-1 overflow-hidden">
                                {tags.slice(0, 2).map((t) => {
                                  const hex = resolveColor(t.color);
                                  return (
                                    <span
                                      key={t.name}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap shrink-0"
                                      style={{ backgroundColor: `${hex}20`, color: hex }}
                                    >
                                      <TagIcon className="h-2 w-2" />{t.name}
                                    </span>
                                  );
                                })}
                                {tags.length > 2 && (
                                  <span className="text-[9px] text-muted-foreground/40 shrink-0">+{tags.length - 2}</span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        // ── Last Activity (read-only) ──
                        if (col.key === "lastActivity") {
                          return (
                            <td key="lastActivity" className={cn("px-2.5 tabular-nums", tdClass)} style={{ width: 110, minWidth: 110 }}>
                              <span className="text-[11px] text-muted-foreground">
                                {getCellValue(lead, "lastActivity") || <span className="text-muted-foreground/30">—</span>}
                              </span>
                            </td>
                          );
                        }

                        // ── Editable text columns ──
                        const colDef = ALL_TABLE_COLUMNS.find((c) => c.key === col.key)!;
                        if (colDef?.editable && colDef.type === "text") {
                          const cellVal = getCellValue(lead, col.key);
                          const isEdit  = editingCell?.leadId === leadId && editingCell?.field === col.key;
                          return (
                            <td
                              key={col.key}
                              className={cn("px-1", tdClass)}
                              style={col.key === "notes" ? { minWidth: col.width } : { width: col.width, minWidth: col.width }}
                            >
                              <EditableCell
                                value={cellVal}
                                type="text"
                                isEditing={isEdit}
                                editValue={isEdit ? editValue : ""}
                                isSaving={savingCell?.leadId === leadId && savingCell?.field === col.key}
                                hasError={saveError?.leadId === leadId && saveError?.field === col.key}
                                onStartEdit={() => startEdit(leadId, col.key, cellVal)}
                                onEditChange={setEditValue}
                                onSave={(v) => handleSave(leadId, col.key, v, cellVal)}
                                onCancel={cancelEdit}
                              />
                            </td>
                          );
                        }

                        // ── Read-only text fallback (extended columns) ──
                        return (
                          <td key={col.key} className={cn("px-2.5", tdClass)} style={{ width: col.width, minWidth: col.width }}>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {getCellValue(lead, col.key) || <span className="text-muted-foreground/30">—</span>}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination footer (when >50 leads) ── */}
      {totalPages > 1 && (
        <div className="shrink-0 px-3 py-2 flex items-center justify-between gap-2 border-t border-border/20 bg-muted">
          <button
            onClick={() => setTablePage((p) => Math.max(0, p - 1))}
            disabled={tablePage === 0}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-border/30 text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronDown className="h-3 w-3 rotate-90" /> Prev
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setTablePage(i)}
                className={cn(
                  "h-6 min-w-[24px] rounded-full text-[10px] font-bold tabular-nums transition-colors",
                  tablePage === i
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setTablePage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={tablePage >= totalPages - 1}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-border/30 text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:pointer-events-none"
          >
            Next <ChevronDown className="h-3 w-3 -rotate-90" />
          </button>
        </div>
      )}

    </div>
  );
}
