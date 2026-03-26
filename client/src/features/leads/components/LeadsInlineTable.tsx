import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Tag as TagIcon,
} from "lucide-react";
import { updateLead } from "../api/leadsApi";
import { resolveColor } from "@/features/tags/types";
import type { VirtualListItem } from "./LeadsCardView";
import { PIPELINE_HEX, ListScoreRing } from "./LeadsCardView";
import { getLeadStatusAvatarColor, getInitials } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** Convert hex to a desaturated opaque tint (for group header backgrounds).
 *  Reduces saturation by 70%, then blends at 18% over white. */
function opaqueTint(hex: string): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  // Desaturate: blend each channel 70% toward its luminance gray
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  r = Math.round(r + (gray - r) * 0.7);
  g = Math.round(g + (gray - g) * 0.7);
  b = Math.round(b + (gray - b) * 0.7);
  // Blend at 18% alpha over white
  const blend = (c: number) => Math.round(c * 0.18 + 255 * 0.82);
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

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
  Booked:               "bg-amber-500",
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
// getInitials moved to @/lib/avatarUtils
function getScore(lead: Record<string, any>): number {
  return Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0);
}
function getStatus(lead: Record<string, any>): string {
  return lead.conversion_status || lead.Conversion_Status || "";
}
function formatRelativeTime(dateStr: string | null | undefined, t: (key: string, opts?: Record<string, any>) => string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs   = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? t("relativeTime.justNow") : t("relativeTime.hoursAgo", { count: h });
    }
    if (diffDays === 1) return t("relativeTime.yesterday");
    if (diffDays < 7)  return t("relativeTime.daysAgo", { count: diffDays });
    if (diffDays < 30) return t("relativeTime.weeksAgo", { count: Math.floor(diffDays / 7) });
    return t("relativeTime.monthsAgo", { count: Math.floor(diffDays / 30) });
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
          className="h-[52px] bg-card/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ── Editable cell (textarea overlay pattern from Prospects) ──────────────────
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
  const { t } = useTranslation("leads");
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
          <option key={s} value={s}>{t(`kanban.stageLabels.${s.replace(/ /g, "")}`, s)}</option>
        ))}
      </select>
    );
  }

  if (isEditing) {
    return (
      <div style={{ position: "relative" }}>
        {/* Invisible spacer keeps the row height stable */}
        <div className="h-[26px]" />
        <textarea
          autoFocus
          value={editValue}
          onChange={(e) => {
            onEditChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.max(32, e.target.scrollHeight) + "px";
          }}
          onBlur={() => onSave(editValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === "Escape") onCancel();
          }}
          ref={(ta) => {
            if (!ta) return;
            ta.style.height = "auto";
            ta.style.height = Math.max(32, ta.scrollHeight) + "px";
            ta.selectionStart = ta.selectionEnd = ta.value.length;
          }}
          className="absolute top-0 left-0 w-full min-h-[32px] max-h-[300px] text-[12px] leading-relaxed bg-white px-2.5 py-1.5 ring-2 ring-brand-indigo/50 shadow-[0_4px_24px_rgba(0,0,0,0.12)] outline-none resize-none rounded-none"
          style={{ zIndex: 9999, minWidth: 240, borderRadius: 0 }}
        />
      </div>
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
      title={hasError ? t("table.saveFailed") : value}
    >
      <span className="truncate flex-1">
        {value
          ? (type === "select" ? t(`kanban.stageLabels.${value.replace(/ /g, "")}`, value) : value)
          : <span className="text-muted-foreground/35 italic not-italic">&mdash;</span>}
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

// ── Sortable header cell for drag-to-reorder ────────────────────────────────
function SortableHeaderCell({ col, isFirst, t, onResizeStart }: { col: ColumnDef; isFirst: boolean; t: any; onResizeStart: (colKey: string, e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(isFirst ? {} : { position: "relative" as const }),
  };
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        "px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20",
        isFirst && "sticky left-[36px] z-30",
      )}
    >
      {/* Drag handle = the label area only */}
      <div className="flex items-center gap-1 cursor-grab" {...attributes} {...listeners}>
        {t(`table.columns.${col.key}`)}
      </div>
      {/* Resize handle — isolated from DnD listeners */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[6px] cursor-col-resize hover:bg-brand-indigo/30"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(col.key, e); }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
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
  /** Column order/width props for DnD reorder + resize */
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  columnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  showVerticalLines?: boolean;
  fullWidthTable?: boolean;
  groupBy?: string;
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
  columnOrder,
  onColumnOrderChange,
  columnWidths,
  onColumnWidthsChange,
  showVerticalLines,
  fullWidthTable,
  groupBy,
}: LeadsInlineTableProps) {
  const { t } = useTranslation("leads");

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

  // ── Group collapse ─────────────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (label: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  // ── Compute visible columns from prop (with column order) ──────────────────
  const visibleColumns = useMemo(() => {
    const base = ALL_TABLE_COLUMNS.filter((c) => visibleCols.has(c.key));

    // Apply custom column order if set
    if (columnOrder && columnOrder.length > 0) {
      const orderMap = new Map(columnOrder.map((key, idx) => [key, idx]));
      base.sort((a, b) => {
        const ai = orderMap.get(a.key) ?? 999;
        const bi = orderMap.get(b.key) ?? 999;
        return ai - bi;
      });
    }

    return base;
  }, [visibleCols, columnOrder]);

  const colSpan = visibleColumns.length + 1; // +1 for select-all checkbox column

  // ── Column resize (live widths for instant visual feedback) ─────────────
  const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});

  const getColWidth = useCallback((col: ColumnDef) => {
    if (liveWidths[col.key]) return liveWidths[col.key];
    return columnWidths?.[col.key] ?? col.width;
  }, [columnWidths, liveWidths]);

  const handleResizeStart = useCallback((colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const col = visibleColumns.find(c => c.key === colKey);
    if (!col) return;
    const startWidth = columnWidths?.[colKey] ?? col.width;
    const startX = e.clientX;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      setLiveWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };
    const onMouseUp = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      const updated = { ...columnWidths, [colKey]: newWidth };
      onColumnWidthsChange?.(updated);
      setLiveWidths({});
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [columnWidths, visibleColumns, onColumnWidthsChange]);

  // ── DnD column reorder ──────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleColumns.findIndex((c) => c.key === active.id);
    const newIndex = visibleColumns.findIndex((c) => c.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    // First column (name/avatar) excluded from reorder — always stays first
    if (oldIndex === 0 || newIndex === 0) return;
    const newOrder = arrayMove(visibleColumns.map((c) => c.key), oldIndex, newIndex);
    onColumnOrderChange?.(newOrder);
  }, [visibleColumns, onColumnOrderChange]);

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
        return formatRelativeTime(d, t);
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

  // Scroll selected row into view (e.g. from search)
  useEffect(() => {
    if (!selectedLeadId) return;
    const raf = requestAnimationFrame(() => {
      const row = document.querySelector(`tr[data-lead-id="${selectedLeadId}"]`) as HTMLElement | null;
      if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedLeadId]);

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

      {/* ── Table ── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table
            className={cn("min-w-full w-full", showVerticalLines && "[&_td]:border-r [&_td]:border-border/10 [&_th]:border-r [&_th]:border-border/10")}
            style={{ borderCollapse: "separate", borderSpacing: "0 2px", tableLayout: "fixed" }}
          >

            {/* Enforce column widths + trailing fill column */}
            <colgroup>
              <col style={{ width: 36 }} />
              {visibleColumns.map((col) => (
                <col key={col.key} style={{ width: getColWidth(col) }} />
              ))}
              <col />
            </colgroup>

            {/* Sticky header with select-all checkbox + boxShadow */}
            <thead className="sticky top-0 z-40 bg-muted" style={{ boxShadow: "0 2px 0 0 hsl(var(--muted))" }}>
              <tr>
                {/* Select-all checkbox */}
                <th
                  className="sticky left-0 z-30 w-[36px] px-2 py-2 bg-muted border-b border-border/20"
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
                    title={allSelected ? t("table.deselectAll") : t("table.selectAll")}
                  >
                    {allSelected && <Check className="h-2.5 w-2.5" />}
                    {someSelected && !allSelected && <div className="h-1.5 w-1.5 bg-brand-indigo rounded-sm" />}
                  </button>
                </th>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={visibleColumns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
                    {visibleColumns.map((col, ci) => (
                      <SortableHeaderCell key={col.key} col={col} isFirst={ci === 0} t={t} onResizeStart={handleResizeStart} />
                    ))}
                  </SortableContext>
                </DndContext>
                {/* Trailing fill header cell */}
                <th className="bg-muted border-b border-border/20" />
              </tr>
            </thead>

            <tbody>
              {/* Empty state */}
              {leadCount === 0 && (
                <tr>
                  <td colSpan={colSpan + 1} className="py-12 text-center text-xs text-muted-foreground">
                    {tableSearch ? t("table.empty.noResults") : t("table.empty.noLeads")}
                  </td>
                </tr>
              )}

              {(() => {
                let currentGroup: string | null = null;
                let rowIdx = 0;
                return paginatedItems.map((item, index) => {
                  if (item.kind === "header") {
                    currentGroup = item.label;
                    const isCollapsed = collapsedGroups.has(item.label);
                    const hexColor    = PIPELINE_HEX[item.label] || "#6B7280";
                    const groupBg     = opaqueTint(hexColor);
                    const groupIds = getGroupLeadIds(item.label);
                    const isGroupFullySelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
                    return (
                      <tr
                        key={`h-${item.label}-${index}`}
                        className="cursor-pointer select-none h-[44px]"
                        onClick={() => toggleGroupCollapse(item.label)}
                      >
                        {/* Cell 1: Checkbox */}
                        <td
                          className="sticky left-0 z-30 w-[36px] px-0"
                          style={{ backgroundColor: groupBg }}
                        >
                          <div className="flex items-center justify-center h-full">
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
                          </div>
                        </td>

                        {/* Cell 2: Label (arrow + name + count) */}
                        <td
                          className="sticky left-[36px] z-30 pl-1 pr-3"
                          style={{ backgroundColor: groupBg }}
                        >
                          <div className="flex items-center gap-2">
                            {isCollapsed
                              ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
                            <span className="text-[11px] font-bold text-foreground/70">{item.label}</span>
                            <span className="text-[10px] text-muted-foreground/50 font-medium tabular-nums">{item.count}</span>
                          </div>
                        </td>

                        {/* Cell 3: Spacer */}
                        <td
                          colSpan={visibleColumns.length}
                          style={{ backgroundColor: groupBg }}
                        />
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
                  const avatarColor      = getLeadStatusAvatarColor(leadStatus);
                  const bgClass          = isHighlighted ? "bg-highlight-selected" : "bg-card group-hover/row:bg-card-hover";

                  const isRowEditing = editingCell?.leadId === leadId;
                  const currentRowIdx = rowIdx++;
                  return (
                    <tr
                      key={leadId}
                      data-lead-id={leadId}
                      className={cn(
                        "group/row cursor-pointer h-[52px] animate-card-enter",
                        isHighlighted ? "bg-highlight-selected" : "bg-card hover:bg-card-hover",
                      )}
                      style={{
                        animationDelay: `${Math.min(currentRowIdx, 15) * 30}ms`,
                        ...(isRowEditing ? { position: "relative" as const, zIndex: 50 } : {}),
                      }}
                      onClick={(e) => handleRowClick(lead, e)}
                    >
                      {/* Checkbox cell — opaque sticky background */}
                      <td
                        className={cn(
                          "sticky left-0 z-10 w-[36px] px-0",
                          bgClass,
                        )}
                      >
                        <div className="flex items-center justify-center h-full">
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                              isMultiSelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = new Set(selectedIds);
                              if (next.has(leadId)) next.delete(leadId);
                              else next.add(leadId);
                              onSelectionChange(next);
                              if (next.size === 1) {
                                const only = leadOnlyItems.find((i) => getLeadId(i.lead) === Array.from(next)[0]);
                                if (only) onSelectLead(only.lead);
                              }
                            }}
                          >
                            {isMultiSelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        </div>
                      </td>
                      {visibleColumns.map((col, ci) => {
                        const isFirst = ci === 0;
                        const tdClass = cn(
                          isFirst && "sticky left-[36px] z-10",
                          isFirst && bgClass,
                        );

                        // ── Name ──
                        if (col.key === "name") {
                          return (
                            <td key="name" className={cn("px-2.5", tdClass)}>
                              <div className="flex items-center gap-2 min-w-0">
                                <EntityAvatar
                                  name={name}
                                  bgColor={avatarColor.bg}
                                  textColor={avatarColor.text}
                                />
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
                            <td key="status" className={cn("px-1", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
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
                            <td key="score" className={cn("px-2.5", tdClass)}>
                              {score > 0 ? (
                                <ListScoreRing score={score} status={leadStatus} lead={lead} />
                              ) : (
                                <span className="text-muted-foreground/30 text-[11px]">&mdash;</span>
                              )}
                            </td>
                          );
                        }

                        // ── Campaign (read-only) ──
                        if (col.key === "campaign") {
                          return (
                            <td key="campaign" className={cn("px-2.5", tdClass)}>
                              <span className="text-[11px] text-muted-foreground truncate block">
                                {getCellValue(lead, "campaign") || <span className="text-muted-foreground/30">&mdash;</span>}
                              </span>
                            </td>
                          );
                        }

                        // ── Tags (read-only pills) ──
                        if (col.key === "tags") {
                          return (
                            <td key="tags" className={cn("px-2", tdClass)}>
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
                            <td key="lastActivity" className={cn("px-2.5 tabular-nums", tdClass)}>
                              <span className="text-[11px] text-muted-foreground">
                                {getCellValue(lead, "lastActivity") || <span className="text-muted-foreground/30">&mdash;</span>}
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
                              style={isEdit ? { overflow: "visible" } : undefined}
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
                          <td key={col.key} className={cn("px-2.5", tdClass)}>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {getCellValue(lead, col.key) || <span className="text-muted-foreground/30">&mdash;</span>}
                            </span>
                          </td>
                        );
                      })}
                      {/* Trailing fill cell — opaque background */}
                      <td className={bgClass} />
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
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-black/[0.125] text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronDown className="h-3 w-3 rotate-90" /> {t("table.pagination.prev")}
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
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-black/[0.125] text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:pointer-events-none"
          >
            {t("table.pagination.next")} <ChevronDown className="h-3 w-3 -rotate-90" />
          </button>
        </div>
      )}

    </div>
  );
}
