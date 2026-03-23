/**
 * DataTable — core table shell.
 * Handles: state management, sorting, pagination, virtualization, DnD column ordering,
 * undo/redo, grouping computations, and table structure.
 *
 * Delegates rendering to:
 *   DataTableToolbar   — search, filters, bulk actions, view presets, fields panel
 *   DataTableRowComponent — individual row renderer (all cell variants)
 *   dataTableUtils     — shared color maps, formatters, helpers
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataEmptyState } from "@/components/crm/DataEmptyState";

import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  LayoutGrid,
  ListFilter,
  Settings,
  Zap,
} from "lucide-react";

import {
  Activity,
  Briefcase,
  Building2,
  Clock,
  Database,
  FileText,
  Globe,
  Hash,
  Link as LinkIcon,
  Mail,
  Phone,
  Tag,
  User,
} from "lucide-react";

import { DataTableToolbar, VIEW_PRESETS } from "./DataTableToolbar";
import { DataTableRowComponent } from "./DataTableRow";
import {
  ALWAYS_VISIBLE_MATCH,
  AUTOMATION_MATCH,
  automationStatusColors,
  conversionColors,
  formatHeaderTitle,
  includesAny,
  matchesAny,
  isRollupCol,
  normalizeCol,
} from "./dataTableUtils";

// ─── Public types (re-exported so callers importing from "./DataTable" still work) ───

export interface DataTableRow {
  Id: number;
  [key: string]: any;
}

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export type RowSpacing = "tight" | "medium" | "spacious";

type ViewMenuOption =
  | { type: "workspace"; value: string; label: string }
  | { type: "preset"; value: string; label: string; presetKey: string };

export interface DataTableProps<TRow extends DataTableRow = DataTableRow> {
  loading?: boolean;

  rows: TRow[];
  columns: string[];

  visibleColumns: string[];
  onVisibleColumnsChange: (next: string[]) => void;

  selectedIds: number[];
  onSelectedIdsChange: (next: number[]) => void;

  sortConfig: SortConfig;
  onSortChange: (next: SortConfig) => void;

  groupBy: string;
  onGroupByChange?: (next: string) => void;
  groupOptions?: { value: string; label: string }[];

  colWidths: Record<string, number>;
  onColWidthsChange: (next: Record<string, number>) => void;

  rowSpacing: RowSpacing;
  onRowSpacingChange?: (next: RowSpacing) => void;
  showVerticalLines: boolean;
  onShowVerticalLinesChange?: (next: boolean) => void;

  onUpdate: (rowId: number, col: string, value: any) => void;
  onDelete?: (ids: number[]) => void;

  statusOptions: string[];
  typeOptions: string[];
  timezoneOptions: string[];

  automationStatusOptions?: string[];
  hiddenFields: string[];
  nonEditableFields: string[];
  smallWidthCols?: string[];
  /** Override column header labels: e.g. { name: "Account Name" } */
  columnLabelOverrides?: Record<string, string>;
  /** Columns that cannot be resized (no drag handle) */
  nonResizableCols?: string[];

  onUndoRedoReady?: (api: {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  }) => void;

  // ─────────────────────
  // Toolbar-related props
  // ─────────────────────
  filterConfig?: Record<string, string>;
  onFilterConfigChange?: (next: Record<string, string>) => void;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;

  workspaceViewOptions?: { value: string; label: string }[];
  activeWorkspaceView?: string;
  onWorkspaceViewChange?: (value: string) => void;

  onAdd?: () => void;
  addLabel?: string;
  onViewSelected?: () => void;
  canViewSelected?: boolean;

  /** Called when a data row is clicked (not the checkbox column) */
  onRowClick?: (row: TRow) => void;

  onImportCSV?: (file: File) => void;
  onExportCSV?: () => void;

  /** Slot rendered adjacent to the Group By selector (e.g. a custom filter button) */
  filterSlot?: React.ReactNode;
  /** Slot rendered adjacent to the Export button (e.g. an Import CSV button) */
  importSlot?: React.ReactNode;

  /** Enable self-contained CSV export with field-selection dialog */
  exportable?: boolean;
  /** Filename (without extension) for the exported CSV — defaults to "export" */
  exportFilename?: string;

  // ─────────────────────
  // Empty state
  // ─────────────────────
  /** Variant for the empty state design when no rows exist */
  emptyStateVariant?: import("@/components/crm/DataEmptyState").EmptyStateVariant;
  /** Override empty state title */
  emptyStateTitle?: string;
  /** Override empty state description */
  emptyStateDescription?: string;
  /** Label for the empty state action button (e.g. "Clear filters") */
  emptyStateActionLabel?: string;
  /** Handler for the empty state action button */
  emptyStateOnAction?: () => void;

  // ─────────────────────
  // Pagination
  // ─────────────────────
  pageSize?: number;
  /** If provided, shows a page-size selector with these options (e.g. [25, 50, 100]) */
  pageSizeOptions?: number[];

  // ─────────────────────
  // Virtualization
  // ─────────────────────
  /** When true, uses TanStack Virtual for efficient rendering of 1000+ rows */
  virtualized?: boolean;
  /** Height of the virtualized scroll container (default: "calc(100dvh - 320px)") */
  virtualizedContainerHeight?: string;

  // ─────────────────────
  // Bulk actions slot
  // ─────────────────────
  /** Render custom bulk action buttons when rows are selected */
  renderBulkActions?: (selectedIds: number[], clearSelection: () => void) => React.ReactNode;
}

// ─── Internal constants ────────────────────────────────────────────────────

const defaultRowPadding: Record<RowSpacing, string> = {
  tight: "py-2",
  medium: "py-4",
  spacious: "py-8",
};

const getIconForField = (col: string) => {
  const c = col.toLowerCase();
  if (c === "name") return <Building2 className="h-3.5 w-3.5" />;
  if (c.includes("email")) return <Mail className="h-3.5 w-3.5" />;
  if (c.includes("phone")) return <Phone className="h-3.5 w-3.5" />;
  if (c.includes("status")) return <Activity className="h-3.5 w-3.5" />;
  if (c.includes("type")) return <Briefcase className="h-3.5 w-3.5" />;
  if (c.includes("website")) return <Globe className="h-3.5 w-3.5" />;
  if (c.includes("notes")) return <FileText className="h-3.5 w-3.5" />;
  if (c.includes("timezone")) return <Clock className="h-3.5 w-3.5" />;
  if (c.includes("account_id") || c.includes("campaign_id")) return <Hash className="h-3.5 w-3.5" />;
  if (c.includes("twilio") || c.includes("twillio")) return <Zap className="h-3.5 w-3.5" />;
  if (c.includes("webhook")) return <LinkIcon className="h-3.5 w-3.5" />;
  if (c.includes("user")) return <User className="h-3.5 w-3.5" />;
  if (c.includes("tag")) return <Tag className="h-3.5 w-3.5" />;
  if (c.includes("id")) return <Hash className="h-3.5 w-3.5" />;
  if (c.includes("time") || c.includes("at")) return <Clock className="h-3.5 w-3.5" />;
  return <Database className="h-3.5 w-3.5" />;
};

// ─── SortableTableHead ──────────────────────────────────────────────────────

const SortableTableHead = ({
  col,
  idx,
  style,
  className,
  children,
  handleResize,
  nonResizable,
}: {
  col: string;
  idx: number;
  style: React.CSSProperties;
  className: string;
  children: (drag: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  }) => React.ReactNode;
  handleResize: (col: string, e: React.MouseEvent) => void;
  nonResizable?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col });

  const combinedStyle = {
    ...style,
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={combinedStyle}
      className={cn(className, isDragging && "bg-muted shadow-inner")}
    >
      {children({ attributes, listeners })}
      {!nonResizable && (
        <div
          className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize hover:bg-brand-indigo/50 active:bg-brand-indigo z-20"
          onMouseDown={(e) => handleResize(col, e)}
        />
      )}
    </TableHead>
  );
};

// ─── History type ────────────────────────────────────────────────────────────

type HistoryEntry = { rowId: number; col: string; prev: any; next: any };

// ─── Main component ──────────────────────────────────────────────────────────

export default function DataTable<TRow extends DataTableRow = DataTableRow>(
  props: DataTableProps<TRow>,
) {
  const {
    loading,
    rows,
    columns,
    visibleColumns,
    onVisibleColumnsChange,
    selectedIds,
    onSelectedIdsChange,
    sortConfig,
    onSortChange,
    groupBy,
    onGroupByChange,
    groupOptions,
    colWidths,
    onColWidthsChange,
    rowSpacing,
    onRowSpacingChange,
    showVerticalLines,
    onShowVerticalLinesChange,
    onUpdate,
    statusOptions,
    typeOptions,
    timezoneOptions,
    hiddenFields,
    nonEditableFields,
    onUndoRedoReady,
    filterConfig,
    onFilterConfigChange,
    searchValue,
    onSearchValueChange,
    onRefresh,
    isRefreshing,
    onAdd,
    addLabel = "Add",
    onDelete,
    onImportCSV,
    onExportCSV,
    emptyStateVariant = "generic",
    emptyStateTitle,
    emptyStateDescription,
    emptyStateActionLabel,
    emptyStateOnAction,
    pageSize,
    pageSizeOptions,
    renderBulkActions,
    onRowClick,
    columnLabelOverrides,
    nonResizableCols,
    filterSlot,
    importSlot,
  } = props;

  const exportable = props.exportable ?? false;
  const exportFilename = props.exportFilename ?? "export";
  const virtualized = props.virtualized ?? false;
  const virtualizedContainerHeight = props.virtualizedContainerHeight ?? "calc(100dvh - 320px)";

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Pagination ──────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState<number>(
    pageSizeOptions?.[0] ?? pageSize ?? 50,
  );
  useEffect(() => { setCurrentPage(1); }, [rows.length, searchValue, internalPageSize]);

  // ── Grouping UI state ───────────────────────────────────────────────────
  const [groupColoring, setGroupColoring] = useState(true);
  const [groupSortOrder, setGroupSortOrder] = useState<"asc" | "desc">("asc");
  const [hideEmptyGroups, setHideEmptyGroups] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // ── CSV Export state ────────────────────────────────────────────────────
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSelectedFields, setExportSelectedFields] = useState<string[]>([]);

  const handleOpenExportDialog = () => {
    setExportSelectedFields([...visibleColumns]);
    setExportDialogOpen(true);
  };

  const toggleExportField = (col: string) => {
    setExportSelectedFields((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const generateAndDownloadCSV = () => {
    const fields = exportSelectedFields.length > 0 ? exportSelectedFields : visibleColumns;
    const header = fields
      .map((f) => {
        const title = formatHeaderTitle(f);
        return title.includes(",") || title.includes('"')
          ? `"${title.replace(/"/g, '""')}"`
          : title;
      })
      .join(",");
    const lines = rows.map((row) =>
      fields
        .map((f) => {
          const val = (row as Record<string, any>)[f];
          const str = val === null || val === undefined ? "" : String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(","),
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
  };

  // ── View preset state ───────────────────────────────────────────────────
  const [viewLabel, setViewLabel] = useState(() => {
    return localStorage.getItem("dataTable_viewLabel") || "Default View";
  });
  const [viewKey, setViewKey] = useState(() => {
    return localStorage.getItem("dataTable_viewKey") || "all";
  });

  useEffect(() => {
    localStorage.setItem("dataTable_viewLabel", viewLabel);
    localStorage.setItem("dataTable_viewKey", viewKey);
  }, [viewLabel, viewKey]);

  const applyView = (key: string) => {
    let next: string[] = [];
    if (key === "all") {
      next = columns;
    } else if (key === "rollups") {
      next = columns.filter((c) => matchesAny(c, ALWAYS_VISIBLE_MATCH) || isRollupCol(c));
    } else if (key === "twilio") {
      next = columns.filter(
        (c) => matchesAny(c, ALWAYS_VISIBLE_MATCH) || includesAny(c, ["twilio", "twillio", "webhook"]),
      );
    } else if (key === "basic") {
      const BASIC_MATCH = ["status", "type", "timezone", "tags", "full_name", "full name", "conversion_status", "leads_tags"];
      next = columns.filter(
        (c) => matchesAny(c, ALWAYS_VISIBLE_MATCH) || matchesAny(c, BASIC_MATCH),
      );
    } else if (key === "automation") {
      next = columns.filter(
        (c) => matchesAny(c, ALWAYS_VISIBLE_MATCH) || includesAny(c, AUTOMATION_MATCH),
      );
    }
    if (next.length > 0) onVisibleColumnsChange(next);
  };

  useEffect(() => {
    if (viewKey) applyView(viewKey);
  }, [rows, viewKey]);

  const viewMenuGroups = useMemo(() => {
    const presets = VIEW_PRESETS.map((p) => ({
      type: "preset" as const,
      value: p.label,
      label: p.label,
      presetKey: p.key,
    }));
    const groups: { label: string; options: ViewMenuOption[] }[] = [];
    if (presets.length > 0) groups.push({ label: "", options: presets });
    return groups;
  }, []);

  const handleViewMenuSelect = (option: ViewMenuOption) => {
    if (option.type === "preset") {
      setViewKey(option.presetKey);
      applyView(option.presetKey);
    }
    setViewLabel(option.label);
    localStorage.setItem("dataTable_viewLabel", option.label);
  };

  // ── Search keyboard shortcut ────────────────────────────────────────────
  useEffect(() => {
    if (!onSearchValueChange) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSearchValueChange]);

  // ── Undo / Redo ─────────────────────────────────────────────────────────
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const updateHistoryState = () => {
    setHistoryState({
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
    });
  };

  const handleUpdate = (rowId: number, col: string, value: any) => {
    const row = rows.find((r) => r.Id === rowId);
    const prev = row ? row[col] : undefined;
    if (prev === value) return;
    const last = undoStack.current[undoStack.current.length - 1];
    if (last && last.rowId === rowId && last.col === col) {
      last.next = value;
    } else {
      undoStack.current.push({ rowId, col, prev, next: value });
    }
    redoStack.current = [];
    updateHistoryState();
    onUpdate(rowId, col, value);
  };

  const undo = () => {
    const last = undoStack.current.pop();
    if (!last) return;
    redoStack.current.push(last);
    updateHistoryState();
    onUpdate(last.rowId, last.col, last.prev);
  };

  const redo = () => {
    const last = redoStack.current.pop();
    if (!last) return;
    undoStack.current.push(last);
    updateHistoryState();
    onUpdate(last.rowId, last.col, last.next);
  };

  useEffect(() => {
    onUndoRedoReady?.({ undo, redo, canUndo: historyState.canUndo, canRedo: historyState.canRedo });
  }, [historyState]);

  // ── Selection helpers ───────────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === rows.length) {
      onSelectedIdsChange([]);
    } else {
      onSelectedIdsChange(rows.map((r) => r.Id));
    }
  };

  // ── Column resize ───────────────────────────────────────────────────────
  const handleResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startW = colWidths[col] || 150;
    const onMove = (me: MouseEvent) => {
      const nextW = Math.max(50, startW + (me.pageX - startX));
      onColWidthsChange({ ...colWidths, [col]: nextW });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── DnD column reorder ──────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = visibleColumns.indexOf(active.id as string);
      const newIdx = visibleColumns.indexOf(over.id as string);
      onVisibleColumnsChange(arrayMove(visibleColumns, oldIdx, newIdx));
    }
  };

  // ── Sorting / pagination / grouping ─────────────────────────────────────
  const sortedRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return rows;
    const key = sortConfig.key;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }, [rows, sortConfig]);

  const effectivePageSize: number | null =
    pageSizeOptions && pageSizeOptions.length > 0
      ? internalPageSize
      : pageSize ?? null;

  const totalRows = sortedRows.length;
  const totalPages = effectivePageSize ? Math.max(1, Math.ceil(totalRows / effectivePageSize)) : 1;
  const safePage = Math.min(currentPage, totalPages);

  const displayRows = useMemo(() => {
    if (!effectivePageSize) return sortedRows;
    const start = (safePage - 1) * effectivePageSize;
    return sortedRows.slice(start, start + effectivePageSize);
  }, [sortedRows, effectivePageSize, safePage]);

  const estimatedRowHeight = rowSpacing === "tight" ? 40 : rowSpacing === "medium" ? 56 : 88;

  const groupedRows = useMemo(() => {
    if (groupBy === "None") return { "All Records": displayRows };
    const groups: Record<string, TRow[]> = {};
    let order: string[] = [];
    const g = groupBy.toLowerCase();
    if (g === "conversion_status") order = statusOptions;
    else if (g === "automation_status") order = props.automationStatusOptions || [];
    else if (g === "type") order = typeOptions;
    if (order.length > 0) order.forEach((opt) => { groups[opt] = []; });
    displayRows.forEach((r) => {
      const rawVal =
        (r as any)[groupBy] !== undefined ? (r as any)[groupBy] : (r as any)[groupBy.toLowerCase()];
      const key = String(rawVal ?? "") || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    if (order.length > 0)
      Object.keys(groups).forEach((k) => {
        if (groups[k].length === 0 && !order.includes(k)) delete groups[k];
      });
    return groups;
  }, [displayRows, groupBy, statusOptions, props.automationStatusOptions, typeOptions]);

  const sortedGroupNames = useMemo(() => {
    let keys = Object.keys(groupedRows);
    if (hideEmptyGroups && groupBy !== "None") keys = keys.filter((key) => groupedRows[key].length > 0);
    const conversionOrder = ["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "DND", "Lost"];
    return keys.sort((a, b) => {
      const g = groupBy.toLowerCase();
      const dir = groupSortOrder === "asc" ? 1 : -1;
      if (g === "conversion_status" || g === "conversion") {
        const ia = conversionOrder.indexOf(a);
        const ib = conversionOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return (ia - ib) * dir;
      }
      return a.localeCompare(b) * dir;
    });
  }, [groupedRows, groupSortOrder, hideEmptyGroups, groupBy]);

  const flatDisplayRows = useMemo<any[]>(() => {
    if (!virtualized || groupBy === "None") return displayRows as any[];
    const result: any[] = [];
    sortedGroupNames.forEach((groupName) => {
      const groupRows = groupedRows[groupName] || [];
      result.push({
        _isGroupHeader: true,
        _groupName: groupName,
        _groupCount: groupRows.length,
        Id: `grp-${groupName}`,
      });
      if (!collapsedGroups[groupName]) {
        groupRows.forEach((row, rowIdx) => result.push({ ...(row as any), _rowIdx: rowIdx }));
      }
    });
    return result;
  }, [virtualized, groupBy, sortedGroupNames, groupedRows, collapsedGroups, displayRows]);

  // ── Virtualizer ─────────────────────────────────────────────────────────
  const rowVirtualizer = useVirtualizer({
    count: virtualized ? flatDisplayRows.length : 0,
    getScrollElement: () => (virtualized ? scrollContainerRef.current : null),
    estimateSize: () => estimatedRowHeight,
    overscan: 10,
    measureElement: (el) => {
      if (el && el instanceof HTMLElement) return el.getBoundingClientRect().height;
      return estimatedRowHeight;
    },
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalVirtualSize = rowVirtualizer.getTotalSize();
  const virtualPaddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const virtualPaddingBottom =
    virtualItems.length > 0 ? totalVirtualSize - virtualItems[virtualItems.length - 1].end : 0;

  // ── Layout ───────────────────────────────────────────────────────────────
  const visibleCols = visibleColumns.filter((c) => !hiddenFields.includes(c));
  const rowPadding = defaultRowPadding[rowSpacing];
  const totalTableMinWidth = 40 + visibleCols.reduce((sum, col) => sum + (colWidths[col] ?? 150), 0);

  // ── Header renderer ──────────────────────────────────────────────────────
  const renderHeader = (col: string, drag: { attributes: any; listeners: any }) => {
    const isSorted = sortConfig.key === col && sortConfig.direction !== null;
    const title = columnLabelOverrides?.[col] ?? formatHeaderTitle(col);

    return (
      <div className="flex items-center gap-2 group/h">
        <div
          {...drag.attributes}
          {...drag.listeners}
          className="cursor-grab active:cursor-grabbing hover:text-brand-indigo transition-colors"
        >
          {getIconForField(col)}
        </div>
        <span
          className={cn(
            "flex-1 cursor-pointer select-none truncate transition-colors",
            isSorted ? "text-brand-indigo font-semibold" : "hover:text-brand-indigo/70",
          )}
          onClick={() => {
            const nextDir =
              sortConfig.key === col
                ? sortConfig.direction === "asc"
                  ? "desc"
                  : sortConfig.direction === "desc"
                  ? null
                  : "asc"
                : "asc";
            onSortChange({ key: col, direction: nextDir });
          }}
          title={
            isSorted
              ? `Sorted ${sortConfig.direction === "asc" ? "ascending" : "descending"} — click to ${sortConfig.direction === "asc" ? "reverse" : "clear"} sort`
              : `Click to sort by ${title}`
          }
          data-testid={`sort-header-${col}`}
          aria-sort={isSorted ? (sortConfig.direction === "asc" ? "ascending" : "descending") : "none"}
        >
          {title}
        </span>
        {isSorted ? (
          <span className="text-brand-indigo font-bold shrink-0" data-testid={`sort-indicator-${col}`} aria-hidden="true">
            {sortConfig.direction === "asc" ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </span>
        ) : (
          <span className="opacity-0 group-hover/h:opacity-30 transition-opacity shrink-0 text-muted-foreground" aria-hidden="true">
            <ChevronUp className="h-3 w-3" />
          </span>
        )}
      </div>
    );
  };

  // ── Toolbar visibility ───────────────────────────────────────────────────
  const toolbarHasControls =
    onRefresh ||
    onSearchValueChange ||
    onFilterConfigChange ||
    viewMenuGroups.length > 0 ||
    (groupOptions ?? []).length > 0 ||
    onAdd ||
    onImportCSV ||
    onExportCSV ||
    exportable ||
    filterSlot ||
    importSlot;

  // ── Shared cell context for row renderer ──────────────────────────────────
  const cellContext = {
    columns,
    hiddenFields,
    nonEditableFields,
    statusOptions,
    typeOptions,
    timezoneOptions,
    automationStatusOptions: props.automationStatusOptions,
    handleUpdate,
  };

  // ── Group header helper ──────────────────────────────────────────────────
  const renderGroupHeader = (groupName: string, groupCount: number, isVirtualized: boolean, dataIndex?: number, virtualRef?: any) => {
    const g = groupBy.toLowerCase();
    const color = groupColoring
      ? g === "conversion_status" || g === "conversion"
        ? (conversionColors as any)[groupName]
        : g === "automation_status"
        ? (automationStatusColors as any)[groupName]
        : g === "type"
        ? groupName.toLowerCase() === "agency"
          ? { bg: "bg-brand-yellow/20", text: "text-brand-yellow" }
          : { bg: "bg-brand-indigo/20", text: "text-brand-indigo" }
        : null
      : null;

    return (
      <TableRow
        key={`grp-${groupName}`}
        data-index={dataIndex}
        ref={virtualRef}
        className="bg-muted/20 hover:bg-muted/30 border-y border-border/60 cursor-pointer"
        tabIndex={0}
        role="button"
        aria-label={`Toggle group ${groupName}`}
        aria-expanded={!collapsedGroups[groupName]}
        data-testid={`group-header-${groupName}`}
        onClick={() => toggleGroupCollapse(groupName)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleGroupCollapse(groupName);
          }
        }}
      >
        <TableCell colSpan={visibleCols.length + 1} className="py-2 px-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              data-testid={`group-label-${groupName}`}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                color ? cn(color.bg, color.text) : "bg-muted text-muted-foreground",
              )}
            >
              {groupName}
            </Badge>
            <Badge
              variant="secondary"
              data-testid={`group-count-${groupName}`}
              className="bg-muted/50 text-muted-foreground h-6 px-2.5 text-xs font-bold border-none shadow-none"
            >
              {groupCount}
            </Badge>
            <div className="flex-1" />
            {collapsedGroups[groupName] ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-0">
      {toolbarHasControls && (
        <DataTableToolbar
          columns={columns}
          visibleColumns={visibleColumns}
          onVisibleColumnsChange={onVisibleColumnsChange}
          hiddenFields={hiddenFields}
          selectedIds={selectedIds}
          onSelectedIdsChange={onSelectedIdsChange}
          onDelete={onDelete}
          renderBulkActions={renderBulkActions}
          searchValue={searchValue}
          onSearchValueChange={onSearchValueChange}
          searchInputRef={searchInputRef}
          filterConfig={filterConfig}
          onFilterConfigChange={onFilterConfigChange}
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
          groupOptions={groupOptions}
          groupSortOrder={groupSortOrder}
          onGroupSortOrderChange={setGroupSortOrder}
          hideEmptyGroups={hideEmptyGroups}
          onHideEmptyGroupsChange={setHideEmptyGroups}
          viewLabel={viewLabel}
          viewKey={viewKey}
          onViewMenuSelect={handleViewMenuSelect}
          viewMenuGroups={viewMenuGroups}
          rowSpacing={rowSpacing}
          onRowSpacingChange={onRowSpacingChange}
          showVerticalLines={showVerticalLines}
          onShowVerticalLinesChange={onShowVerticalLinesChange}
          groupColoring={groupColoring}
          onGroupColoringChange={setGroupColoring}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          onAdd={onAdd}
          addLabel={addLabel}
          onImportCSV={onImportCSV}
          onExportCSV={onExportCSV}
          exportable={exportable}
          onOpenExportDialog={exportable ? handleOpenExportDialog : undefined}
          fileInputRef={fileInputRef}
          filterSlot={filterSlot}
          importSlot={importSlot}
        />
      )}

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto"
          style={virtualized ? { overflowY: "auto", height: virtualizedContainerHeight } : undefined}
          data-virtualized={virtualized}
          data-testid="table-scroll-container"
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Table
              className="table-fixed"
              style={{ width: "100%", minWidth: totalTableMinWidth }}
              data-testid="data-table"
            >
              <TableHeader
                data-testid="table-header"
                className={cn(
                  "bg-muted/50 dark:bg-muted/30",
                  virtualized && "sticky top-0 z-10 shadow-sm",
                )}
              >
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="w-[40px] px-4 sticky left-0 z-30 bg-muted/50">
                    <Checkbox
                      checked={selectedIds.length === sortedRows.length && sortedRows.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>

                  <SortableContext items={visibleCols} strategy={horizontalListSortingStrategy}>
                    {visibleCols.map((col, idx) => (
                      <SortableTableHead
                        key={col}
                        col={col}
                        idx={idx}
                        style={{ width: colWidths[col] }}
                        className={cn(
                          "relative px-4 overflow-visible whitespace-nowrap",
                          showVerticalLines && idx < visibleCols.length - 1 && "border-r border-border/50",
                          idx === 0 && "sticky left-[40px] z-20 bg-muted/50 shadow-[2px_0_4px_rgba(0,0,0,0.05)]",
                        )}
                        handleResize={handleResize}
                        nonResizable={nonResizableCols?.includes(col)}
                      >
                        {(drag) => renderHeader(col, drag)}
                      </SortableTableHead>
                    ))}
                  </SortableContext>
                </TableRow>
              </TableHeader>

              <TableBody>
                {/* Skeleton loading rows */}
                {loading && rows.length === 0 && (
                  <>
                    {Array.from({ length: 8 }).map((_, rowIdx) => {
                      const widths = ["w-3/4", "w-1/2", "w-2/3", "w-1/3", "w-4/5", "w-2/5", "w-3/5"];
                      return (
                        <TableRow
                          key={`skeleton-${rowIdx}`}
                          data-testid="skeleton-row"
                          className="hover:bg-transparent border-b border-border/40 animate-in fade-in-0 duration-300"
                          style={{ animationDelay: `${rowIdx * 30}ms`, animationFillMode: "both" }}
                        >
                          <TableCell className="w-[40px] px-4 sticky left-0 z-20 bg-card">
                            <Skeleton className="h-4 w-4 rounded" />
                          </TableCell>
                          {visibleCols.map((col, colIdx) => (
                            <TableCell
                              key={col}
                              style={{ width: colWidths[col] }}
                              className={cn(
                                "px-4",
                                colIdx === 0 && "sticky left-[40px] z-10 bg-card shadow-[2px_0_4px_rgba(0,0,0,0.04)]",
                              )}
                            >
                              <Skeleton className={cn("h-3.5 rounded", widths[(rowIdx + colIdx) % widths.length])} />
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </>
                )}

                {/* Empty state */}
                {!loading && rows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={visibleCols.length + 1} className="p-0 border-b-0">
                      <DataEmptyState
                        variant={emptyStateVariant}
                        title={emptyStateTitle}
                        description={emptyStateDescription}
                        actionLabel={emptyStateActionLabel}
                        onAction={emptyStateOnAction}
                        compact
                      />
                    </TableCell>
                  </TableRow>
                )}

                {/* Virtualized rows */}
                {virtualized && !loading && rows.length > 0 && (
                  <>
                    {virtualPaddingTop > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={visibleCols.length + 1} style={{ height: virtualPaddingTop }} />
                      </tr>
                    )}
                    {virtualItems.map((virtualRow) => {
                      const row = flatDisplayRows[virtualRow.index] as any;
                      if (!row) return null;

                      if (row._isGroupHeader) {
                        return renderGroupHeader(
                          row._groupName,
                          row._groupCount,
                          true,
                          virtualRow.index,
                          rowVirtualizer.measureElement,
                        );
                      }

                      const stripeIdx = row._rowIdx ?? virtualRow.index;
                      return (
                        <DataTableRowComponent
                          key={row.Id}
                          row={row}
                          rowIdx={stripeIdx}
                          visibleCols={visibleCols}
                          colWidths={colWidths}
                          rowPadding={rowPadding}
                          showVerticalLines={showVerticalLines}
                          selectedIds={selectedIds}
                          onToggleSelect={toggleSelect}
                          onRowClick={onRowClick as any}
                          virtualRef={rowVirtualizer.measureElement}
                          dataIndex={virtualRow.index}
                          {...cellContext}
                        />
                      );
                    })}
                    {virtualPaddingBottom > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={visibleCols.length + 1} style={{ height: virtualPaddingBottom }} />
                      </tr>
                    )}
                  </>
                )}

                {/* Non-virtualized grouped/paginated rows */}
                {!virtualized &&
                  sortedGroupNames.map((groupName) => {
                    const groupRows = groupedRows[groupName];
                    return (
                      <React.Fragment key={groupName}>
                        {groupBy !== "None" && renderGroupHeader(groupName, groupRows.length, false)}
                        {!collapsedGroups[groupName] &&
                          groupRows.map((row: any, rowIdx: number) => (
                            <DataTableRowComponent
                              key={row.Id}
                              row={row}
                              rowIdx={rowIdx}
                              visibleCols={visibleCols}
                              colWidths={colWidths}
                              rowPadding={rowPadding}
                              showVerticalLines={showVerticalLines}
                              selectedIds={selectedIds}
                              onToggleSelect={toggleSelect}
                              onRowClick={onRowClick as any}
                              {...cellContext}
                            />
                          ))}
                      </React.Fragment>
                    );
                  })}
              </TableBody>
            </Table>
          </DndContext>
        </div>
      </div>

      {/* Pagination footer */}
      {!loading &&
        rows.length > 0 &&
        (pageSizeOptions?.length || (effectivePageSize && !virtualized && totalPages > 1)) && (
          <div
            className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/10 text-sm"
            data-testid="pagination-footer"
          >
            <div className="text-muted-foreground" data-testid="pagination-row-info">
              {effectivePageSize ? (
                <>
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {((safePage - 1) * effectivePageSize + 1).toLocaleString()}
                    –
                    {Math.min(safePage * effectivePageSize, totalRows).toLocaleString()}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground" data-testid="virtual-row-count">
                    {totalRows.toLocaleString()}
                  </span>{" "}
                  rows
                </>
              ) : (
                <span data-testid="virtual-row-count">{totalRows.toLocaleString()} rows</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {pageSizeOptions && pageSizeOptions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-xs">Rows per page:</span>
                  <Select
                    value={String(internalPageSize)}
                    onValueChange={(val) => {
                      setInternalPageSize(Number(val));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 w-[72px] text-xs" data-testid="page-size-selector">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pageSizeOptions.map((opt) => (
                        <SelectItem key={opt} value={String(opt)} data-testid={`page-size-option-${opt}`}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center gap-1" data-testid="pagination-nav">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(1)}
                    data-testid="pagination-first"
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    data-testid="pagination-prev"
                  >
                    Prev
                  </Button>
                  <span className="px-2 font-medium text-xs" data-testid="pagination-page-info">
                    Page {safePage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    data-testid="pagination-next"
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    data-testid="pagination-last"
                  >
                    Last
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

      {/* CSV Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md" data-testid="export-csv-dialog">
          <DialogHeader>
            <DialogTitle>Export CSV</DialogTitle>
            <DialogDescription>
              Choose which fields to include in the exported file.{" "}
              <span className="font-medium text-foreground">
                {rows.length} row{rows.length !== 1 ? "s" : ""}
              </span>{" "}
              will be exported.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                Fields ({exportSelectedFields.length}/{columns.length} selected)
              </span>
              <div className="flex gap-2">
                <button
                  data-testid="export-select-all"
                  className="text-[11px] text-brand-indigo hover:text-brand-indigo/80 font-medium px-1.5 py-0.5 rounded hover:bg-brand-indigo/10 transition-colors"
                  onClick={() => setExportSelectedFields([...columns])}
                >
                  All
                </button>
                <span className="text-border">·</span>
                <button
                  data-testid="export-select-visible"
                  className="text-[11px] text-green-600 hover:text-green-700 font-medium px-1.5 py-0.5 rounded hover:bg-green-50 transition-colors"
                  onClick={() => setExportSelectedFields([...visibleColumns])}
                >
                  Visible
                </button>
                <span className="text-border">·</span>
                <button
                  data-testid="export-deselect-all"
                  className="text-[11px] text-muted-foreground hover:text-foreground font-medium px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                  onClick={() => setExportSelectedFields([])}
                >
                  None
                </button>
              </div>
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-0.5 pr-2">
                {columns.map((col) => {
                  const isSelected = exportSelectedFields.includes(col);
                  return (
                    <div
                      key={col}
                      data-testid={`export-field-${col}`}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors select-none",
                        isSelected ? "hover:bg-muted/60" : "hover:bg-muted/40 opacity-60 hover:opacity-80",
                      )}
                      onClick={() => toggleExportField(col)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="pointer-events-none"
                        data-testid={`export-checkbox-${col}`}
                      />
                      <span
                        className={cn(
                          "text-sm flex-1 truncate",
                          isSelected ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {formatHeaderTitle(col)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)} data-testid="export-cancel">
              Cancel
            </Button>
            <Button
              onClick={generateAndDownloadCSV}
              disabled={exportSelectedFields.length === 0}
              data-testid="export-confirm"
              className="bg-brand-indigo text-brand-indigo-foreground hover:bg-brand-indigo/90 gap-2"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
