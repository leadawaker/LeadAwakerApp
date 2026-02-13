import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  Activity,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Eye,
  FileText,
  Filter,
  Globe,
  Hash,
  LayoutGrid,
  Link as LinkIcon,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Tag,
  User,
  Zap,
} from "lucide-react";

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

interface LabeledOption {
  value: string;
  label: string;
}

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
  groupOptions?: LabeledOption[];

  colWidths: Record<string, number>;
  onColWidthsChange: (next: Record<string, number>) => void;

  rowSpacing: RowSpacing;
  onRowSpacingChange?: (next: RowSpacing) => void;
  showVerticalLines: boolean;
  onShowVerticalLinesChange?: (next: boolean) => void;

  onUpdate: (rowId: number, col: string, value: any) => void;

  statusOptions: string[];
  typeOptions: string[];
  timezoneOptions: string[];

  hiddenFields: string[];
  nonEditableFields: string[];
  smallWidthCols?: string[];

  onUndoRedoReady?: (api: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }) => void;

  filterConfig?: Record<string, string>;
  onFilterConfigChange?: (next: Record<string, string>) => void;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;

  workspaceViewOptions?: LabeledOption[];
  activeWorkspaceView?: string;
  onWorkspaceViewChange?: (value: string) => void;

  onAdd?: () => void;
  addLabel?: string;

  onViewSelected?: () => void;
  canViewSelected?: boolean;

  onImportCSV?: (file: File) => void;
  onExportCSV?: () => void;
}

const defaultRowPadding: Record<RowSpacing, string> = {
  tight: "py-2",
  medium: "py-4",
  spacious: "py-8",
};

const initialsColors = [
  { text: "text-[#1a3a6f]", bg: "bg-[#1a3a6f]/10", dot: "bg-[#1a3a6f]" },
  { text: "text-[#2d5aa8]", bg: "bg-[#2d5aa8]/10", dot: "bg-[#2d5aa8]" },
  { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", dot: "bg-[#1E90FF]" },
  { text: "text-[#17A398]", bg: "bg-[#17A398]/10", dot: "bg-[#17A398]" },
  { text: "text-[#10b981]", bg: "bg-[#10b981]/10", dot: "bg-[#10b981]" },
  { text: "text-[#ca8a04]", bg: "bg-[#facc15]/20", dot: "bg-[#facc15]" },
];

const normalizeCol = (col: string) =>
  col.toLowerCase().replace(/\s+/g, " ").trim();

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.split(" ");
  if (parts.length >= 2)
    return (
      (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1] || "")).toUpperCase()
    );
  return (name[0] + (name[1] || name[0])).toUpperCase().slice(0, 2);
};

const getAccountColor = (id: number) => initialsColors[id % initialsColors.length];

const statusColors: Record<
  string,
  { text: string; bg: string; border: string; dot: string }
> = {
  Active: {
    text: "text-[#10b981]",
    bg: "bg-[#10b981]/10",
    border: "border-[#10b981]/20",
    dot: "bg-[#10b981]",
  },
  Inactive: {
    text: "text-[#ef4444]",
    bg: "bg-[#ef4444]/10",
    border: "border-[#ef4444]/20",
    dot: "bg-[#ef4444]",
  },
  Trial: {
    text: "text-[#1E90FF]",
    bg: "bg-[#1E90FF]/10",
    border: "border-[#1E90FF]/20",
    dot: "bg-[#1E90FF]",
  },
  Suspended: {
    text: "text-[#ef4444]",
    bg: "bg-[#ef4444]/10",
    border: "border-[#ef4444]/20",
    dot: "bg-[#ef4444]",
  },
  Unknown: {
    text: "text-muted-foreground",
    bg: "bg-muted/10",
    border: "border-border",
    dot: "bg-slate-400",
  },
};

const timezoneColors: Record<string, { text: string; bg: string; border: string }> = {
  UTC: { text: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" },
  "Europe/London": { text: "text-blue-700", bg: "bg-blue-100", border: "border-blue-200" },
  "Europe/Paris": { text: "text-indigo-700", bg: "bg-indigo-100", border: "border-indigo-200" },
  "Europe/Berlin": { text: "text-purple-700", bg: "bg-purple-100", border: "border-purple-200" },
  "Europe/Amsterdam": { text: "text-orange-700", bg: "bg-orange-100", border: "border-orange-200" },
  "America/New_York": { text: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-200" },
  "America/Los_Angeles": { text: "text-rose-700", bg: "bg-rose-100", border: "border-rose-200" },
  "America/Sao_Paulo": { text: "text-green-700", bg: "bg-green-100", border: "border-green-200" },
  "Asia/Tokyo": { text: "text-red-700", bg: "bg-red-100", border: "border-red-200" },
  "Asia/Dubai": { text: "text-amber-700", bg: "bg-amber-100", border: "border-amber-200" },
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
  if (c.includes("twilio") || c.includes("twillio"))
    return <Zap className="h-3.5 w-3.5" />;
  if (c.includes("webhook")) return <LinkIcon className="h-3.5 w-3.5" />;
  if (c.includes("user")) return <User className="h-3.5 w-3.5" />;
  if (c.includes("tag")) return <Tag className="h-3.5 w-3.5" />;
  if (c.includes("id")) return <Hash className="h-3.5 w-3.5" />;
  if (c.includes("time") || c.includes("at")) return <Clock className="h-3.5 w-3.5" />;
  return <Database className="h-3.5 w-3.5" />;
};

const formatHeaderTitle = (col: string) => {
  if (col === "name") return "Company Name";
  if (col === "Account ID") return "ID";
  return col
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const formatDateTimeParts = (value: any) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, "0");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mon = months[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date: `${day}/${mon}/${yr}`, time: `${hh}:${mm}`, d };
};

const formatDateTime = (value: any) => {
  const parts = formatDateTimeParts(value);
  if (!parts) return value ? String(value) : "-";
  return `${parts.date}   ${parts.time}`;
};

const formatHHmm = (value: any) => {
  if (!value) return "-";
  if (typeof value === "string" && value.includes(":")) {
    const parts = value.split(":");
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return String(value);
};

const DATE_COLS = new Set([
  "created time",
  "last modified time",
  "createdat",
  "updatedat",
  "created_at",
  "updated_at",
]);

const TIME_COLS = new Set(["business_hours_open", "business_hours_closed"]);

const ROLLUP_COLS_ORDER = [
  "Leads",
  "Campaigns",
  "Automation Logs",
  "Prompt Libraries",
  "Users",
  "Interactions",
  "Tags",
];

const isDateCol = (col: string) => DATE_COLS.has(normalizeCol(col));
const isTimeCol = (col: string) => TIME_COLS.has(normalizeCol(col));
const isRollupCol = (col: string) =>
  ROLLUP_COLS_ORDER.some((c) => normalizeCol(c) === normalizeCol(col));

const ALWAYS_VISIBLE_MATCH = [
  "id",
  "account id",
  "image",
  "acc",
  "name",
  "company name",
  "email",
  "phone",
  "last modified time",
  "updatedat",
  "updated_at",
];

const VIEW_PRESETS = [
  { key: "all", label: "All Fields" },
  { key: "rollups", label: "Roll ups" },
  { key: "twilio", label: "Twilio" },
  { key: "basic", label: "Basic View" },
  { key: "automation", label: "Automation" },
];

const matchesAny = (col: string, list: string[]) => {
  const n = normalizeCol(col);
  return list.some((item) => n === normalizeCol(item));
};

const includesAny = (col: string, list: string[]) => {
  const n = normalizeCol(col);
  return list.some((item) => n.includes(normalizeCol(item)));
};

/* -------------------- helper cells/components -------------------- */

const DateTimeCell = ({ value }: { value: any }) => {
  const parts = formatDateTimeParts(value);
  if (!parts) return <span className="text-slate-400">-</span>;

  const now = new Date();
  const isToday =
    parts.d.getFullYear() === now.getFullYear() &&
    parts.d.getMonth() === now.getMonth() &&
    parts.d.getDate() === now.getDate();

  return (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <span className={cn(isToday ? "text-blue-600 font-semibold" : "")}>
        {parts.date}
      </span>
      <span className="text-slate-500">{parts.time}</span>
    </div>
  );
};

const TruncatedCell = ({
  value,
  title,
  onUpdate,
  rowId,
  col,
}: {
  value: any;
  title?: string;
  onUpdate?: (rowId: number, col: string, next: any) => void;
  rowId?: number;
  col?: string;
}) => {
  const text = value === null || value === undefined ? "" : String(value);
  const tooltipTitle = title || text;

  const ref = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const truncated = el.scrollWidth > el.clientWidth;
      setIsTruncated(truncated);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  if (isEditing && onUpdate && rowId && col) {
    const widthCh = Math.max(12, text.length + 2);
    return (
      <Input
        autoFocus
        className="h-8 w-auto min-w-[200px] max-w-none bg-white shadow-lg border-blue-400 focus:ring-2 focus:ring-blue-100 relative z-30"
        style={{ width: `${widthCh}ch` }}
        value={text}
        onChange={(e) => onUpdate(rowId, col, e.target.value)}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") {
            setIsEditing(false);
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  const content = (
    <div
      ref={ref}
      className="w-full overflow-hidden whitespace-nowrap text-ellipsis cursor-text"
      onClick={() => setIsEditing(true)}
    >
      {text}
    </div>
  );

  return (
    <Popover open={isTruncated ? undefined : false}>
      <PopoverTrigger asChild>{content}</PopoverTrigger>
      <PopoverContent className="w-fit max-w-[420px] p-2 text-xs break-words shadow-xl border border-slate-200 bg-white z-[100]">
        {tooltipTitle}
      </PopoverContent>
    </Popover>
  );
};

const RollupCell = ({ value, type }: { value: any; type: string }) => {
  const list = useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return value
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    }
    return [String(value)];
  }, [value]);

  const count = list.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity bg-slate-50/50 p-1 rounded border border-transparent hover:border-slate-200">
          <Badge
            variant="secondary"
            className="bg-slate-100 text-slate-600 border-slate-200 font-bold px-1.5 h-5 min-w-[24px] justify-center"
          >
            {count}
          </Badge>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold whitespace-nowrap">
            {type}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 shadow-2xl border border-slate-200 bg-white z-[100]">
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-500">
              {type}
            </h4>
            <Badge className="bg-blue-50 text-blue-600 border-blue-100">
              {count}
            </Badge>
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {list.length > 0 ? (
                list.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="text-xs py-1 px-2 rounded hover:bg-slate-50 text-slate-600 border border-transparent hover:border-slate-100"
                  >
                    {typeof item === "object"
                      ? item.name || item.title || JSON.stringify(item)
                      : String(item)}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 italic p-2">No items</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const SortableTableHead = ({
  col,
  idx,
  style,
  className,
  children,
  handleResize,
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
      className={cn(className, isDragging && "bg-slate-100 shadow-inner")}
    >
      {children({ attributes, listeners })}
      <div
        className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500 z-20"
        onMouseDown={(e) => handleResize(col, e)}
      />
    </TableHead>
  );
};

/* ---------------------------------------------------------------- */

type HistoryEntry = { rowId: number; col: string; prev: any; next: any };

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
    workspaceViewOptions,
    activeWorkspaceView,
    onWorkspaceViewChange,
    onAdd,
    addLabel = "Add",
    onViewSelected,
    canViewSelected = false,
    onImportCSV,
    onExportCSV,
  } = props;

  const [viewLabel, setViewLabel] = useState("Default View");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filterValues = filterConfig ?? {};
  const filterCount = Object.values(filterValues).filter(Boolean).length;

  const workspaceOptions = workspaceViewOptions ?? [];
  const workspaceActive = workspaceOptions.find(
    (option) => option.value === activeWorkspaceView,
  );

  useEffect(() => {
    if (workspaceActive) {
      setViewLabel(workspaceActive.label);
    }
  }, [workspaceActive]);

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

  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });

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
    onUndoRedoReady?.({
      undo,
      redo,
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
    });
  }, [historyState.canUndo, historyState.canRedo, onUndoRedoReady]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = visibleColumns.indexOf(active.id as string);
      const newIndex = visibleColumns.indexOf(over.id as string);
      onVisibleColumnsChange(arrayMove(visibleColumns, oldIndex, newIndex));
    }
  };

  const rowPadding = defaultRowPadding[rowSpacing];

  const sortedRows = useMemo(() => {
    if (!sortConfig.direction || !sortConfig.key) return [...rows];

    return [...rows].sort((a: any, b: any) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;

      let comparison = 0;
      const isDate =
        isDateCol(sortConfig.key) || sortConfig.key.toLowerCase().includes("time");

      if (isDate) {
        comparison =
          new Date(aVal || 0).getTime() - new Date(bVal || 0).getTime();
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal || "").localeCompare(String(bVal || ""));
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [rows, sortConfig]);

  const groupedRows = useMemo(() => {
    if (groupBy === "None") return { All: sortedRows } as Record<string, TRow[]>;
    const groups: Record<string, TRow[]> = {};
    const field = groupBy.toLowerCase();
    sortedRows.forEach((row: any) => {
      const val = row[field] || "Unknown";
      if (!groups[val]) groups[val] = [];
      groups[val].push(row);
    });
    return groups;
  }, [sortedRows, groupBy]);

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedRows.length) onSelectedIdsChange([]);
    else onSelectedIdsChange(sortedRows.map((r) => r.Id));
  };

  const toggleSelect = (id: number) => {
    onSelectedIdsChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id],
    );
  };

  const handleSortClick = (key: string) => {
    const prev = sortConfig;
    let direction: SortDirection = "asc";
    if (prev.key === key) {
      if (prev.direction === "asc") direction = "desc";
      else if (prev.direction === "desc") direction = null;
    }
    onSortChange({ key, direction });
  };

  const handleResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.pageX;
    const startWidth = colWidths[col] || 180;

    const onMouseUp = () => {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
          document.body.style.cursor = "default";
        };

        document.body.style.cursor = "col-resize";
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      };

      const renderHeader = (
        col: string,
        drag: {
          attributes: DraggableAttributes;
          listeners: DraggableSyntheticListeners;
        },
      ) => {
        const title = formatHeaderTitle(col);

        return (
          <div
            className="flex items-center gap-2 group cursor-pointer h-full"
            onClick={() => handleSortClick(col)}
          >
            <span
              {...drag.attributes}
              {...drag.listeners}
              className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0 cursor-grab active:cursor-grabbing"
            >
              {getIconForField(col)}
            </span>

            <Popover>
              <PopoverTrigger asChild>
                <div className="truncate cursor-help font-black uppercase text-[10px] tracking-wider text-slate-500">
                  {title}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-fit p-2 text-xs shadow-xl border border-slate-200 bg-white z-[100]">
                {title}
              </PopoverContent>
            </Popover>

            {sortConfig.key === col && sortConfig.direction && (
              <span className="text-blue-500 ml-auto shrink-0">
                {sortConfig.direction === "asc" ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </span>
            )}
          </div>
        );
      };

      const orderedVisible = useMemo(
        () => visibleColumns.filter((c) => columns.includes(c)),
        [visibleColumns, columns],
      );

      const visibleCols = useMemo(() => {
        const rollupsInVisible = orderedVisible.filter((c) => isRollupCol(c));
        if (rollupsInVisible.length === 0) return orderedVisible;

        const orderedRollups = ROLLUP_COLS_ORDER.map((r) =>
          orderedVisible.find((c) => normalizeCol(c) === normalizeCol(r)),
        ).filter(Boolean) as string[];

        const firstRollupIndex = orderedVisible.findIndex((c) => isRollupCol(c));
        const nonRollup = orderedVisible.filter((c) => !isRollupCol(c));
        const before = nonRollup.slice(0, firstRollupIndex);
        const after = nonRollup.slice(firstRollupIndex);
        return [...before, ...orderedRollups, ...after];
      }, [orderedVisible]);

      const applyView = (key: string) => {
        if (!onVisibleColumnsChange) return;

        if (key === "all") {
          onVisibleColumnsChange(columns);
          return;
        }

        const alwaysCols = columns.filter((c) => matchesAny(c, ALWAYS_VISIBLE_MATCH));
        let viewCols: string[] = [];

        if (key === "rollups") {
          viewCols = columns.filter((c) => isRollupCol(c));
        } else if (key === "twilio") {
          viewCols = columns.filter((c) => includesAny(c, ["twilio", "twillio"]));
        } else if (key === "basic") {
          viewCols = columns.filter((c) =>
            matchesAny(c, [
              "email",
              "phone",
              "business_hours_open",
              "business_hours_closed",
              "last modified time",
              "updatedat",
              "updated_at",
            ]),
          );
        } else if (key === "automation") {
          viewCols = columns.filter((c) =>
            includesAny(c, [
              "automation",
              "ai",
              "prompt",
              "assistant",
              "model",
              "max messages",
              "max_messages",
              "workflow",
              "trigger",
            ]),
          );
        }

        const combined = Array.from(new Set([...alwaysCols, ...viewCols]));
        const ordered = columns.filter((c) => combined.includes(c));
        onVisibleColumnsChange(ordered.length ? ordered : columns);
      };

      const viewMenuGroups: { label: string; options: ViewMenuOption[] }[] = [];
      if (workspaceOptions.length > 0) {
        viewMenuGroups.push({
          label: "Workspace Views",
          options: workspaceOptions.map((option) => ({
            type: "workspace" as const,
            value: option.value,
            label: option.label,
          })),
        });
      }
      viewMenuGroups.push({
        label: "Column Presets",
        options: VIEW_PRESETS.map((preset) => ({
          type: "preset" as const,
          value: preset.key,
          label: preset.label,
          presetKey: preset.key,
        })),
      });

      const handleViewMenuSelect = (option: ViewMenuOption) => {
        if (option.type === "workspace") {
          onWorkspaceViewChange?.(option.value);
        } else if (option.type === "preset") {
          applyView(option.presetKey);
        }
        setViewLabel(option.label);
      };

      const effectiveGroupOptions =
        groupOptions ??
        [
          { value: "None", label: "No Grouping" },
          { value: "Type", label: "By Type" },
          { value: "Status", label: "By Status" },
          { value: "Timezone", label: "By Time Zone" },
        ];

      const handleFilterInputChange = (col: string, value: string) => {
        if (!onFilterConfigChange) return;
        const next = { ...filterValues };
        if (value) next[col] = value;
        else delete next[col];
        onFilterConfigChange(next);
      };

      const handleImportClick = () => {
        if (!onImportCSV) return;
        fileInputRef.current?.click();
      };

      const toolbarHasControls =
        onRefresh ||
        onViewSelected ||
        onSearchValueChange ||
        onFilterConfigChange ||
        viewMenuGroups.length > 0 ||
        effectiveGroupOptions.length > 0 ||
        onAdd ||
        onImportCSV ||
        onExportCSV;

      return (
        <div className="space-y-6">
          {toolbarHasControls && (
            <div className="flex flex-wrap items-center gap-3">
              {onRefresh && (
                <Button
                  variant="outline"
                  className="h-10 w-10 p-0 rounded-xl bg-white border-slate-200 shadow-none"
                  onClick={onRefresh}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                  />
                </Button>
              )}

              {onViewSelected && (
                <Button
                  variant="outline"
                  className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none"
                  disabled={!canViewSelected}
                  onClick={onViewSelected}
                >
                  <Eye className="h-4 w-4" /> View
                </Button>
              )}

              {onSearchValueChange && (
                <Input
                  ref={searchInputRef}
                  placeholder="Search records (Ctrl+K)"
                  className="w-[240px] h-10 rounded-xl bg-white shadow-none border-slate-200"
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchValueChange(e.target.value)}
                />
              )}

              {onFilterConfigChange && (
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none relative"
                    >
                      <Filter className="h-4 w-4" />
                      <span>Filter</span>
                      {filterCount > 0 && (
                        <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-blue-600">
                          {filterCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Filters</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onFilterConfigChange?.({})}
                          className="h-8 text-xs"
                        >
                          Clear all
                        </Button>
                      </div>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {columns.map((col) => (
                          <div key={col} className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-slate-500">
                              {col}
                            </label>
                            <Input
                              placeholder={`Filter ${col}...`}
                              className="h-8 text-sm"
                              value={filterValues[col] || ""}
                              onChange={(e) =>
                                handleFilterInputChange(col, e.target.value)
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {viewMenuGroups.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="w-[180px] h-10 rounded-xl bg-white shadow-none border-slate-200 font-bold flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4" />
                      <span>{viewLabel}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {viewMenuGroups.map((group, idx) => (
                      <div key={group.label}>
                        <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                        {group.options.map((option) => (
                          <DropdownMenuItem
                            key={`${group.label}-${option.value}`}
                            onClick={() => handleViewMenuSelect(option)}
                          >
                            {option.label}
                          </DropdownMenuItem>
                        ))}
                        {idx < viewMenuGroups.length - 1 && (
                          <DropdownMenuSeparator />
                        )}
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {effectiveGroupOptions.length > 0 && (
                <Select
                  value={groupBy}
                  onValueChange={(value) => onGroupByChange?.(value)}
                  disabled={!onGroupByChange}
                >
                  <SelectTrigger className="w-[160px] h-10 rounded-xl bg-white shadow-none border-slate-200 font-bold">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      <span>Group: {groupBy}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {effectiveGroupOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex-1" />

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none"
                  >
                    Fields
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2">
                  <ScrollArea className="h-72">
                    <div className="space-y-1">
                      {columns.map((col) => (
                        <div
                          key={col}
                          className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                          onClick={() => {
                            if (visibleColumns.includes(col)) {
                              onVisibleColumnsChange(
                                visibleColumns.filter((c) => c !== col),
                              );
                            } else {
                              onVisibleColumnsChange([...visibleColumns, col]);
                            }
                          }}
                        >
                          <Checkbox checked={visibleColumns.includes(col)} />
                          <span className="text-sm font-medium">{col}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {onAdd && (
                <Button
                  className="h-10 px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold gap-2 shadow-none border-none"
                  onClick={onAdd}
                >
                  <Plus className="h-4 w-4" /> {addLabel}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 w-10 p-0 rounded-xl bg-white border-slate-200 shadow-none"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Settings</DropdownMenuLabel>
                  {onImportCSV && (
                    <DropdownMenuItem onClick={handleImportClick}>
                      <Plus className="h-4 w-4 mr-2" /> Import CSV
                    </DropdownMenuItem>
                  )}
                  {onExportCSV && (
                    <DropdownMenuItem onClick={onExportCSV}>
                      <FileText className="h-4 w-4 mr-2" /> Export CSV
                    </DropdownMenuItem>
                  )}
                  {(onImportCSV || onExportCSV) && <DropdownMenuSeparator />}
                  <DropdownMenuCheckboxItem
                    checked={showVerticalLines}
                    disabled={!onShowVerticalLinesChange}
                    onCheckedChange={(checked) =>
                      onShowVerticalLinesChange?.(!!checked)
                    }
                  >
                    Show Vertical Lines
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Row Spacing</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={rowSpacing}
                    onValueChange={(value) =>
                      onRowSpacingChange?.(value as RowSpacing)
                    }
                  >
                    <DropdownMenuRadioItem value="tight" disabled={!onRowSpacingChange}>
                      Tight
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="medium" disabled={!onRowSpacingChange}>
                      Medium
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="spacious" disabled={!onRowSpacingChange}>
                      Spacious
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <input
                type="file"
                accept=".csv"
                className="hidden"
                ref={fileInputRef}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  if (file && onImportCSV) onImportCSV(file);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
            </div>
          )}

          {Object.entries(groupedRows).map(([groupName, groupRows]) => (
            <div key={groupName} className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                  {groupBy === "None"
                    ? `ALL ROWS - ${groupRows.length}`
                    : `${groupName.toUpperCase()} - ${groupRows.length}`}
                </h2>
              </div>

              <div
                className={cn(
                  "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden",
                  loading && "opacity-70",
                )}
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <Table className="table-fixed w-full">
                    <TableHeader className="bg-slate-50/50">
                      <TableRow className="hover:bg-transparent border-b border-slate-200">
                        <TableHead className="w-[40px] px-4">
                          <Checkbox
                            checked={
                              selectedIds.length === sortedRows.length &&
                              sortedRows.length > 0
                            }
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>

                        <SortableContext
                          items={visibleCols}
                          strategy={horizontalListSortingStrategy}
                        >
                          {visibleCols.map((col, idx) => (
                            <SortableTableHead
                              key={col}
                              col={col}
                              idx={idx}
                              style={{ width: colWidths[col] }}
                              className={cn(
                                "relative px-4 overflow-visible whitespace-nowrap",
                                showVerticalLines &&
                                  idx < visibleCols.length - 1 &&
                                  "border-r border-slate-100",
                              )}
                              handleResize={handleResize}
                            >
                              {(drag) => renderHeader(col, drag)}
                            </SortableTableHead>
                          ))}
                        </SortableContext>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {groupRows.map((row: any) => (
                        <TableRow
                          key={row.Id}
                          id={`row-${row.Id}`}
                          className={cn(
                            "group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0",
                            selectedIds.includes(row.Id) &&
                              "bg-blue-50/30 hover:bg-blue-50/50",
                          )}
                        >
                          <TableCell className="px-4">
                            <Checkbox
                              checked={selectedIds.includes(row.Id)}
                              onCheckedChange={() => toggleSelect(row.Id)}
                            />
                          </TableCell>

                          {visibleCols.map((col, idx) => (
                            <TableCell
                              key={col}
                              style={{ width: colWidths[col] }}
                              className={cn(
                                "px-4 font-medium text-slate-600 transition-all overflow-visible",
                                rowPadding,
                                showVerticalLines &&
                                  idx < visibleCols.length - 1 &&
                                  "border-r border-slate-50",
                              )}
                            >
                              {col === "Image" || col === "ACC" ? (
                                <Sheet>
                                  <SheetTrigger asChild>
                                    <div
                                      className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110",
                                        getAccountColor(row.Id).bg,
                                        getAccountColor(row.Id).text,
                                      )}
                                    >
                                      {getInitials(row.name)}
                                    </div>
                                  </SheetTrigger>
                                  <SheetContent className="sm:max-w-lg w-[400px]">
                                    <SheetHeader className="border-b pb-6">
                                      <div className="flex items-center gap-4">
                                        <div
                                          className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
                                            getAccountColor(row.Id).bg,
                                            getAccountColor(row.Id).text,
                                          )}
                                        >
                                          {getInitials(row.name)}
                                        </div>
                                        <div>
                                          <SheetTitle className="text-xl">
                                            {row.name || "Record Details"}
                                          </SheetTitle>
                                          <SheetDescription>
                                            View and edit information
                                          </SheetDescription>
                                        </div>
                                      </div>
                                    </SheetHeader>
                                    <ScrollArea className="h-[calc(100vh-140px)] py-6 pr-4">
                                      <div className="space-y-6">
                                        {columns
                                          .filter((c) => !hiddenFields.includes(c))
                                          .map((c) => (
                                            <div key={c} className="space-y-1.5">
                                              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                                {getIconForField(c)}
                                                <span>{c.replace(/_/g, " ")}</span>
                                              </div>
                                              {nonEditableFields.includes(c) ? (
                                                <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-500 border border-slate-100">
                                                  {isDateCol(c)
                                                    ? formatDateTime(row[c])
                                                    : isTimeCol(c)
                                                      ? formatHHmm(row[c])
                                                      : row[c] || "-"}
                                                </div>
                                              ) : c === "status" ? (
                                                <Select
                                                  value={row[c] || ""}
                                                  onValueChange={(v) =>
                                                    handleUpdate(row.Id, c, v)
                                                  }
                                                >
                                                  <SelectTrigger className="w-full bg-white border-slate-200">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {statusOptions.map((o) => (
                                                      <SelectItem key={o} value={o}>
                                                        {o}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              ) : c === "type" ? (
                                                <Select
                                                  value={row[c] || ""}
                                                  onValueChange={(v) =>
                                                    handleUpdate(row.Id, c, v)
                                                  }
                                                >
                                                  <SelectTrigger className="w-full bg-white border-slate-200">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {typeOptions.map((o) => (
                                                      <SelectItem key={o} value={o}>
                                                        {o}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              ) : c === "timezone" ? (
                                                <Select
                                                  value={row[c] || ""}
                                                  onValueChange={(v) =>
                                                    handleUpdate(row.Id, c, v)
                                                  }
                                                >
                                                  <SelectTrigger className="w-full bg-white border-slate-200">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {timezoneOptions.map((o) => (
                                                      <SelectItem key={o} value={o}>
                                                        {o}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              ) : (
                                                <Input
                                                  value={row[c] || ""}
                                                  onChange={(e) =>
                                                    handleUpdate(
                                                      row.Id,
                                                      c,
                                                      e.target.value,
                                                    )
                                                  }
                                                  className="bg-white border-slate-200 focus:ring-blue-500"
                                                />
                                              )}
                                            </div>
                                          ))}
                                      </div>
                                    </ScrollArea>
                                  </SheetContent>
                                </Sheet>
                              ) : col === "status" ? (
                                <Select
                                  value={row[col] || ""}
                                  onValueChange={(v) =>
                                    handleUpdate(row.Id, col, v)
                                  }
                                >
                                  <SelectTrigger
                                    className={cn(
                                      "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
                                      statusColors[row[col]]?.bg,
                                      statusColors[row[col]]?.text,
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <div
                                        className={cn(
                                          "w-1.5 h-1.5 rounded-full",
                                          statusColors[row[col]]?.dot,
                                        )}
                                      />
                                      <SelectValue />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {statusOptions.map((o) => (
                                      <SelectItem
                                        key={o}
                                        value={o}
                                        className="text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        {o}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : isRollupCol(col) ? (
                                <RollupCell value={row[col]} type={col} />
                              ) : isDateCol(col) ? (
                                <DateTimeCell value={row[col]} />
                              ) : isTimeCol(col) ? (
                                <TruncatedCell value={formatHHmm(row[col])} />
                              ) : col === "type" ? (
                                <Select
                                  value={row[col] || ""}
                                  onValueChange={(v) =>
                                    handleUpdate(row.Id, col, v)
                                  }
                                >
                                  <SelectTrigger
                                    className={cn(
                                      "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
                                      row[col]?.toLowerCase() === "agency"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-blue-100 text-blue-700",
                                    )}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {typeOptions.map((o) => (
                                      <SelectItem
                                        key={o}
                                        value={o}
                                        className="text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        {o}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : col === "timezone" ? (
                                <Select
                                  value={row[col] || ""}
                                  onValueChange={(v) =>
                                    handleUpdate(row.Id, col, v)
                                  }
                                >
                                  <SelectTrigger
                                    className={cn(
                                      "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
                                      timezoneColors[row[col]]?.bg || "bg-slate-100",
                                      timezoneColors[row[col]]?.text ||
                                        "text-slate-700",
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="h-3 w-3" />
                                      <SelectValue />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {timezoneOptions.map((o) => (
                                      <SelectItem
                                        key={o}
                                        value={o}
                                        className="text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        {o}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <TruncatedCell
                                  value={row[col]}
                                  onUpdate={handleUpdate}
                                  rowId={row.Id}
                                  col={col}
                                />
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DndContext>
              </div>
            </div>
          ))}
        </div>
      );
    }