import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Tag as TagIcon,
} from "lucide-react";
import { useUpdateTask, useTaskCategories } from "../api/tasksApi";
import { useTheme } from "@/hooks/useTheme";
import { useTagVisibility } from "../context/TagVisibilityContext";
import {
  sortTasks,
  groupTasks,
  STATUS_COLORS,
  STATUS_OPTIONS as STATUS_OPTS,
  PRIORITY_OPTIONS,
  TYPE_OPTIONS,
  TYPE_ICONS,
  TASK_STATUSES,
  parseTags,
  TAG_COLORS,
  TAG_COLORS_DARK,
} from "../types";
import type { Task, SortOption, GroupOption, TaskStatus, TaskPriority } from "../types";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** Convert hex to a desaturated opaque tint (for group header backgrounds). */
function opaqueTint(hex: string): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  r = Math.round(r + (gray - r) * 0.7);
  g = Math.round(g + (gray - g) * 0.7);
  b = Math.round(b + (gray - b) * 0.7);
  const blend = (c: number) => Math.round(c * 0.18 + 255 * 0.82);
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

// ── Status hex colors for group headers ────────────────────────────────────
const STATUS_HEX: Record<string, string> = {
  todo: "#6B7280",
  in_progress: "#3B82F6",
  done: "#10B981",
  cancelled: "#9CA3AF",
};

const PRIORITY_HEX: Record<string, string> = {
  low: "#9CA3AF",
  medium: "#3B82F6",
  high: "#F59E0B",
  urgent: "#EF4444",
};

// ── Column definitions ─────────────────────────────────────────────────────
type ColKey =
  | "title" | "status" | "priority" | "category" | "tags"
  | "taskType" | "timeEstimate" | "parentTask" | "dueDate" | "createdAt"
  | "description" | "assignee" | "account";

interface ColumnDef {
  key: ColKey;
  label: string;
  width: number;
  editable: boolean;
  type: "text" | "select";
}

const ALL_TABLE_COLUMNS: ColumnDef[] = [
  { key: "title",        label: "Title",        width: 240, editable: false, type: "text"   },
  { key: "status",       label: "Status",       width: 130, editable: true,  type: "select" },
  { key: "priority",     label: "Priority",     width: 110, editable: true,  type: "select" },
  { key: "category",     label: "Category",     width: 130, editable: false, type: "text"   },
  { key: "tags",         label: "Tags",         width: 160, editable: false, type: "text"   },
  { key: "taskType",     label: "Type",         width: 110, editable: true,  type: "select" },
  { key: "timeEstimate", label: "Estimate",     width: 90,  editable: false, type: "text"   },
  { key: "parentTask",   label: "Parent Task",  width: 150, editable: false, type: "text"   },
  { key: "dueDate",      label: "Due",          width: 100, editable: false, type: "text"   },
  { key: "createdAt",    label: "Created",      width: 100, editable: false, type: "text"   },
  // Extended (hidden by default)
  { key: "description",  label: "Description",  width: 200, editable: false, type: "text"   },
  { key: "assignee",     label: "Assignee",     width: 130, editable: false, type: "text"   },
  { key: "account",      label: "Account",      width: 130, editable: false, type: "text"   },
];

const STATUS_OPTIONS = TASK_STATUSES.map(s => s);
const PRIORITY_OPTIONS_LIST = PRIORITY_OPTIONS.map(o => o.value);
const TYPE_OPTIONS_LIST = TYPE_OPTIONS.map(o => o.value);

const STATUS_DOT: Record<string, string> = {
  todo:        "bg-gray-500",
  in_progress: "bg-blue-500",
  done:        "bg-emerald-500",
  cancelled:   "bg-zinc-400",
};

const PRIORITY_DOT: Record<string, string> = {
  low:    "bg-gray-400",
  medium: "bg-blue-500",
  high:   "bg-amber-500",
  urgent: "bg-red-500",
};

// ── Signal bars for priority ────────────────────────────────────────
const SIGNAL_FILLED: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
const SIGNAL_COLOR: Record<string, string> = {
  low: "#3B82F6", medium: "#22C55E", high: "#F97316", urgent: "#EF4444",
};

function SignalBars({ priority }: { priority: string }) {
  const filled = SIGNAL_FILLED[priority] ?? 2;
  const color = SIGNAL_COLOR[priority] ?? "#9CA3AF";
  return (
    <div className="flex items-end gap-[2px]">
      {[5, 8, 11, 14].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{ height: `${h}px`, backgroundColor: i < filled ? color : "#D1D5DB" }}
        />
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  return new Date(task.dueDate) < new Date();
}

function formatDueDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimeEstimate(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? "just now" : `${h}h ago`;
    }
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7)  return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch { return ""; }
}

function getNextStatus(current: TaskStatus): TaskStatus {
  const idx = TASK_STATUSES.indexOf(current);
  return TASK_STATUSES[(idx + 1) % TASK_STATUSES.length];
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-[52px] bg-card/70 rounded-xl animate-pulse" style={{ animationDelay: `${i * 35}ms` }} />
      ))}
    </div>
  );
}

// ── Editable cell (textarea overlay pattern) ──────────────────────────────
interface EditableCellProps {
  value: string;
  type: "text" | "select";
  selectOptions?: string[];
  isEditing: boolean;
  editValue: string;
  isSaving: boolean;
  hasError: boolean;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onSave: (v: string) => void;
  onCancel: () => void;
  renderLabel?: (v: string) => React.ReactNode;
}

function EditableCell({
  value, type, selectOptions, isEditing, editValue, isSaving, hasError,
  onStartEdit, onEditChange, onSave, onCancel, renderLabel,
}: EditableCellProps) {
  if (isEditing && type === "select" && selectOptions) {
    return (
      <select
        autoFocus
        value={editValue}
        onChange={(e) => onSave(e.target.value)}
        onBlur={() => onSave(editValue)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        className="w-full h-[28px] text-[11px] bg-white rounded px-1.5 ring-1 ring-brand-indigo/40 outline-none cursor-pointer"
      >
        {selectOptions.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    );
  }

  if (isEditing) {
    return (
      <div style={{ position: "relative" }}>
        <div className="h-[26px]" />
        <textarea
          autoFocus
          value={editValue}
          onChange={(e) => { onEditChange(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.max(32, e.target.scrollHeight) + "px"; }}
          onBlur={() => onSave(editValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === "Escape") onCancel();
          }}
          ref={(ta) => { if (!ta) return; ta.style.height = "auto"; ta.style.height = Math.max(32, ta.scrollHeight) + "px"; ta.selectionStart = ta.selectionEnd = ta.value.length; }}
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
      title={hasError ? "Save failed" : value}
    >
      <span className="truncate flex-1">
        {value
          ? (renderLabel ? renderLabel(value) : value)
          : <span className="text-muted-foreground/35 italic not-italic">&mdash;</span>}
      </span>
      {isSaving && <div className="h-2.5 w-2.5 border border-brand-indigo/40 border-t-brand-indigo rounded-full animate-spin ml-1 shrink-0" />}
      {hasError && !isSaving && <span className="text-red-500 ml-1 shrink-0 text-[9px] font-bold">!</span>}
    </div>
  );
}

// ── Sortable header cell for drag-to-reorder ────────────────────────────
function SortableHeaderCell({ col, isFirst, label, onResizeStart }: { col: ColumnDef; isFirst: boolean; label: string; onResizeStart: (colKey: string, e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
  };
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        "px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20",
        isFirst && "sticky left-[36px] z-30",
      )}
    >
      <div className="flex items-center gap-1 cursor-grab" {...attributes} {...listeners}>
        {label}
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-[6px] cursor-col-resize hover:bg-brand-indigo/30"
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(col.key, e); }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
}

// ── Flat row type ──────────────────────────────────────────────────────────
type FlatRow =
  | { type: "header"; label: string; count: number }
  | { type: "task"; task: Task };

// ── Props ─────────────────────────────────────────────────────────────────
interface TasksInlineTableProps {
  tasks: Task[];
  searchQuery: string;
  sort: SortOption;
  groupBy: GroupOption;
  loading?: boolean;
  onSelectTask: (id: number) => void;
  selectedTaskId: number | null;
  visibleCols: Set<string>;
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  columnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  showVerticalLines?: boolean;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function TasksInlineTable({
  tasks,
  searchQuery,
  sort,
  groupBy,
  loading,
  onSelectTask,
  selectedTaskId,
  visibleCols,
  selectedIds,
  onSelectionChange,
  columnOrder,
  onColumnOrderChange,
  columnWidths,
  onColumnWidthsChange,
  showVerticalLines,
}: TasksInlineTableProps) {
  const { t } = useTranslation("tasks");
  const updateTask = useUpdateTask();
  const { data: categories } = useTaskCategories();
  const showTags = useTagVisibility();
  const { isDark } = useTheme();

  // ── Editing state ─────────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ taskId: number; field: ColKey } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingCell, setSavingCell] = useState<{ taskId: number; field: ColKey } | null>(null);
  const [saveError, setSaveError] = useState<{ taskId: number; field: ColKey } | null>(null);

  // ── Shift-click ref ────────────────────────────────────────────────────
  const lastClickedIndexRef = useRef<number>(-1);

  // ── Table pagination ─────────────────────────────────────────────────
  const TABLE_PAGE_SIZE = 50;
  const [tablePage, setTablePage] = useState(0);

  // ── Group collapse ─────────────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroupCollapse = (label: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  // ── Category map ──────────────────────────────────────────────────────
  const categoryMap = useMemo(() => {
    const map = new Map<number, { name: string; color: string | null; icon: string | null }>();
    if (categories) {
      for (const cat of categories) map.set(cat.id, { name: cat.name, color: cat.color, icon: cat.icon });
    }
    return map;
  }, [categories]);

  const parentTaskMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const task of tasks) map.set(task.id, task.title);
    return map;
  }, [tasks]);

  // ── Compute visible columns (with column order) ───────────────────────
  const visibleColumns = useMemo(() => {
    const base = ALL_TABLE_COLUMNS.filter((c) => visibleCols.has(c.key));
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

  const colSpan = visibleColumns.length + 1;

  // ── Column resize ────────────────────────────────────────────────────
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
      setLiveWidths(prev => ({ ...prev, [colKey]: Math.max(60, startWidth + delta) }));
    };
    const onMouseUp = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      onColumnWidthsChange?.({ ...columnWidths, [colKey]: newWidth });
      setLiveWidths({});
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [columnWidths, visibleColumns, onColumnWidthsChange]);

  // ── DnD column reorder ──────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleColumns.findIndex((c) => c.key === active.id);
    const newIndex = visibleColumns.findIndex((c) => c.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    if (oldIndex === 0 || newIndex === 0) return; // title stays first
    const newOrder = arrayMove(visibleColumns.map((c) => c.key), oldIndex, newIndex);
    onColumnOrderChange?.(newOrder);
  }, [visibleColumns, onColumnOrderChange]);

  // ── Build flat rows: filter → sort → group → flatten ──────────────────
  const flatRows = useMemo<FlatRow[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? tasks.filter((t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.leadName?.toLowerCase().includes(q) ||
          t.accountName?.toLowerCase().includes(q))
      : tasks;
    const sorted = sortTasks(filtered, sort);
    const grouped = groupTasks(sorted, groupBy);
    const rows: FlatRow[] = [];
    for (const [label, items] of Array.from(grouped.entries())) {
      if (groupBy !== "none") rows.push({ type: "header", label, count: items.length });
      for (const task of items) rows.push({ type: "task", task });
    }
    return rows;
  }, [tasks, searchQuery, sort, groupBy]);

  // ── Lead-only list (for selection math) ────────────────────────────────
  const taskOnlyItems = useMemo(
    () => flatRows.filter((r): r is Extract<FlatRow, { type: "task" }> => r.type === "task"),
    [flatRows],
  );

  const taskIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    taskOnlyItems.forEach((item, idx) => map.set(item.task.id, idx));
    return map;
  }, [taskOnlyItems]);

  const taskCount = taskOnlyItems.length;

  // ── getCellValue ──────────────────────────────────────────────────────
  function getCellValue(task: Task, field: ColKey): string {
    switch (field) {
      case "title":        return task.title || "";
      case "status":       return task.status || "";
      case "priority":     return task.priority || "";
      case "category": {
        const cat = (task as any).categoryId ? categoryMap.get((task as any).categoryId) : null;
        return cat?.name || "";
      }
      case "tags":         return (task as any).tags || "";
      case "taskType":     return task.taskType || "";
      case "timeEstimate": return formatTimeEstimate((task as any).timeEstimate);
      case "parentTask": {
        const pid = (task as any).parentTaskId;
        return pid ? `#${pid} — ${parentTaskMap.get(pid) ?? "?"}` : "";
      }
      case "dueDate":      return task.dueDate ? formatDueDate(task.dueDate) : "";
      case "createdAt":    return task.createdAt ? formatRelativeTime(task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt) : "";
      case "description":  return task.description || "";
      case "assignee":     return task.assigneeName || "";
      case "account":      return task.accountName || "";
      default:             return "";
    }
  }

  // ── Editing helpers ────────────────────────────────────────────────────
  const startEdit = useCallback((taskId: number, field: ColKey, currentValue: string) => {
    setEditingCell({ taskId, field });
    setEditValue(currentValue);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  const handleSave = useCallback(async (taskId: number, field: ColKey, newValue: string, originalValue: string) => {
    setEditingCell(null);
    if (newValue === originalValue) return;
    setSavingCell({ taskId, field });
    setSaveError(null);
    try {
      const data: Record<string, any> = {};
      if (field === "status") data.status = newValue;
      else if (field === "priority") data.priority = newValue;
      else if (field === "taskType") data.taskType = newValue;
      else return;
      if (field === "status" && newValue === "done") data.completedAt = new Date();
      await updateTask.mutateAsync({ id: taskId, data });
    } catch {
      setSaveError({ taskId, field });
      setTimeout(() => setSaveError(null), 3000);
    } finally {
      setSavingCell(null);
    }
  }, [updateTask]);

  // ── Row click handler ──────────────────────────────────────────────────
  const handleRowClick = useCallback((task: Task, e: React.MouseEvent) => {
    const taskId = task.id;
    const idx = taskIndexMap.get(taskId) ?? -1;

    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      const lo = Math.min(lastClickedIndexRef.current, idx);
      const hi = Math.max(lastClickedIndexRef.current, idx);
      const rangeIds = taskOnlyItems.slice(lo, hi + 1).map((item) => item.task.id);
      const next = new Set(selectedIds);
      rangeIds.forEach((id) => next.add(id));
      onSelectionChange(next);
      if (next.size === 1) onSelectTask(Array.from(next)[0]);
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      onSelectionChange(next);
      if (next.size === 1) onSelectTask(Array.from(next)[0]);
      lastClickedIndexRef.current = idx;
    } else {
      onSelectionChange(new Set([taskId]));
      onSelectTask(taskId);
      lastClickedIndexRef.current = idx;
    }
  }, [taskIndexMap, taskOnlyItems, onSelectTask, onSelectionChange, selectedIds]);

  // ── Select-all toggle ───────────────────────────────────────────────
  const allTaskIds = useMemo(() => taskOnlyItems.map((i) => i.task.id), [taskOnlyItems]);
  const allSelected = taskCount > 0 && allTaskIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && allTaskIds.some((id) => selectedIds.has(id));

  const handleSelectAll = useCallback(() => {
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(allTaskIds));
  }, [allSelected, allTaskIds, onSelectionChange]);

  const getGroupTaskIds = useCallback((groupLabel: string): number[] => {
    const ids: number[] = [];
    let inGroup = false;
    for (const item of flatRows) {
      if (item.type === "header") { inGroup = item.label === groupLabel; continue; }
      if (inGroup && item.type === "task") ids.push(item.task.id);
    }
    return ids;
  }, [flatRows]);

  const handleGroupCheckbox = useCallback((groupLabel: string) => {
    const groupIds = getGroupTaskIds(groupLabel);
    const allInGroupSelected = groupIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allInGroupSelected) groupIds.forEach((id) => next.delete(id));
    else groupIds.forEach((id) => next.add(id));
    onSelectionChange(next);
  }, [getGroupTaskIds, selectedIds, onSelectionChange]);

  // ── Paginated display items ────────────────────────────────────────
  useEffect(() => { setTablePage(0); }, [flatRows.length]);

  const totalPages = Math.ceil(taskCount / TABLE_PAGE_SIZE);
  const paginatedItems = useMemo(() => {
    if (taskCount <= TABLE_PAGE_SIZE) return flatRows;
    let taskIdx = 0;
    const startIdx = tablePage * TABLE_PAGE_SIZE;
    const endIdx = startIdx + TABLE_PAGE_SIZE;
    const result: typeof flatRows = [];
    let lastHeader: typeof flatRows[0] | null = null;
    for (const item of flatRows) {
      if (item.type === "header") { lastHeader = item; continue; }
      if (taskIdx >= startIdx && taskIdx < endIdx) {
        if (lastHeader) { result.push(lastHeader); lastHeader = null; }
        result.push(item);
      }
      taskIdx++;
      if (taskIdx >= endIdx) break;
    }
    return result;
  }, [flatRows, tablePage, taskCount]);

  // ── Group header color ──────────────────────────────────────────────
  const getGroupColor = useCallback((label: string): string => {
    if (STATUS_HEX[label]) return STATUS_HEX[label];
    if (PRIORITY_HEX[label]) return PRIORITY_HEX[label];
    // Category groups: label is categoryId string
    const catId = parseInt(label);
    if (!isNaN(catId)) {
      const cat = categoryMap.get(catId);
      if (cat?.color) return cat.color;
    }
    return "#6B7280";
  }, [categoryMap]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table
            className={cn("min-w-full w-full", showVerticalLines && "[&_td]:border-r [&_td]:border-border/10 [&_th]:border-r [&_th]:border-border/10")}
            style={{ borderCollapse: "separate", borderSpacing: "0 2px", tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: 36 }} />
              {visibleColumns.map((col) => (
                <col key={col.key} style={{ width: getColWidth(col) }} />
              ))}
              <col />
            </colgroup>

            <thead className="sticky top-0 z-20" style={{ boxShadow: "0 2px 0 0 hsl(var(--muted))" }}>
              <tr>
                <th className="sticky left-0 z-30 w-[36px] px-2 py-2 bg-muted border-b border-border/20">
                  <button
                    onClick={handleSelectAll}
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                      allSelected ? "bg-brand-indigo border-brand-indigo text-white"
                        : someSelected ? "bg-brand-indigo/30 border-brand-indigo/50"
                        : "border-border/50 hover:border-foreground/30",
                    )}
                    title={allSelected ? "Deselect all" : "Select all"}
                  >
                    {allSelected && <Check className="h-2.5 w-2.5" />}
                    {someSelected && !allSelected && <div className="h-1.5 w-1.5 bg-brand-indigo rounded-sm" />}
                  </button>
                </th>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={visibleColumns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
                    {visibleColumns.map((col, ci) => (
                      <SortableHeaderCell
                        key={col.key}
                        col={col}
                        isFirst={ci === 0}
                        label={t(`columns.${col.key}`, col.label)}
                        onResizeStart={handleResizeStart}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <th className="bg-muted border-b border-border/20" />
              </tr>
            </thead>

            <tbody>
              {taskCount === 0 && (
                <tr>
                  <td colSpan={colSpan + 1} className="py-12 text-center text-xs text-muted-foreground">
                    {searchQuery ? t("page.noTasksFound") : t("page.noTasks")}
                  </td>
                </tr>
              )}

              {(() => {
                let currentGroup: string | null = null;
                let rowIdx = 0;
                return paginatedItems.map((item, index) => {
                  if (item.type === "header") {
                    currentGroup = item.label;
                    const isCollapsed = collapsedGroups.has(item.label);
                    const hexColor = getGroupColor(item.label);
                    const groupBg = opaqueTint(hexColor);
                    const groupIds = getGroupTaskIds(item.label);
                    const isGroupFullySelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
                    return (
                      <tr
                        key={`h-${item.label}-${index}`}
                        className="cursor-pointer select-none h-[44px]"
                        onClick={() => toggleGroupCollapse(item.label)}
                      >
                        <td className="sticky left-0 z-30 w-[36px] px-0" style={{ backgroundColor: groupBg, borderLeft: `3px solid ${hexColor}` }}>
                          <div className="flex items-center justify-center h-full">
                            <div
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                                isGroupFullySelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40",
                              )}
                              onClick={(e) => { e.stopPropagation(); handleGroupCheckbox(item.label); }}
                            >
                              {isGroupFullySelected && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                          </div>
                        </td>
                        <td className="sticky left-[36px] z-30 pl-1 pr-3" style={{ backgroundColor: groupBg }}>
                          <div className="flex items-center gap-2">
                            {isCollapsed
                              ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
                            <span className="text-[11px] font-bold text-foreground/70">{(() => {
                              // Translate category IDs to names
                              const catId = parseInt(item.label);
                              if (!isNaN(catId)) {
                                const cat = categoryMap.get(catId);
                                if (cat) return <>{cat.icon && <span className="mr-1">{cat.icon}</span>}{cat.name}</>;
                              }
                              // Translate status/priority/type keys
                              const statusOpt = STATUS_OPTS.find(o => o.value === item.label);
                              if (statusOpt) return statusOpt.label;
                              const prioOpt = PRIORITY_OPTIONS.find(o => o.value === item.label);
                              if (prioOpt) return prioOpt.label;
                              const typeOpt = TYPE_OPTIONS.find(o => o.value === item.label);
                              if (typeOpt) return typeOpt.label;
                              return item.label;
                            })()}</span>
                            <span className="text-[10px] font-medium tabular-nums rounded-full px-1.5 py-0.5" style={{ color: hexColor, backgroundColor: `${hexColor}18` }}>{item.count}</span>
                          </div>
                        </td>
                        <td colSpan={visibleColumns.length} style={{ backgroundColor: groupBg }} />
                      </tr>
                    );
                  }

                  if (currentGroup && collapsedGroups.has(currentGroup)) return null;

                  const task = item.task;
                  const taskId = task.id;
                  const isDetailSelected = selectedTaskId === taskId;
                  const isMultiSelected = selectedIds.has(taskId);
                  const isHighlighted = isMultiSelected || isDetailSelected;
                  const overdue = isOverdue(task);
                  const bgClass = isHighlighted ? "bg-highlight-selected" : "bg-card group-hover/row:bg-card-hover";
                  const isRowEditing = editingCell?.taskId === taskId;
                  const currentRowIdx = rowIdx++;

                  return (
                    <tr
                      key={taskId}
                      className={cn(
                        "group/row cursor-pointer h-[52px] animate-card-enter",
                        isHighlighted ? "bg-highlight-selected" : "bg-card hover:bg-card-hover",
                      )}
                      style={{
                        animationDelay: `${Math.min(currentRowIdx, 15) * 30}ms`,
                        ...(isRowEditing ? { position: "relative" as const, zIndex: 50 } : {}),
                      }}
                      onClick={(e) => handleRowClick(task, e)}
                    >
                      {/* Checkbox cell */}
                      <td className={cn("sticky left-0 z-10 w-[36px] px-0", bgClass)}>
                        <div className="flex items-center justify-center h-full">
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                              isMultiSelected ? "border-brand-indigo bg-brand-indigo" : "border-border/40",
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = new Set(selectedIds);
                              if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
                              onSelectionChange(next);
                              if (next.size === 1) onSelectTask(Array.from(next)[0]);
                            }}
                          >
                            {isMultiSelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        </div>
                      </td>

                      {visibleColumns.map((col, ci) => {
                        const isFirst = ci === 0;
                        const tdClass = cn(isFirst && "sticky left-[36px] z-10", isFirst && bgClass);

                        // ── Title (with emoji) ──
                        if (col.key === "title") {
                          return (
                            <td key="title" className={cn("px-2.5", tdClass)}>
                              <div className="flex items-center gap-2 min-w-0">
                                {(task as any).emoji && <span className="text-[13px] shrink-0">{(task as any).emoji}</span>}
                                <span className="text-[12px] font-medium truncate text-foreground">{task.title}</span>
                              </div>
                            </td>
                          );
                        }

                        // ── Status (editable select) ──
                        if (col.key === "status") {
                          const cellVal = task.status;
                          const isEdit = editingCell?.taskId === taskId && editingCell?.field === "status";
                          return (
                            <td key="status" className={cn("px-1", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {!isEdit && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[cellVal] ?? "bg-zinc-400")} />}
                                <EditableCell
                                  value={cellVal}
                                  type="select"
                                  selectOptions={STATUS_OPTIONS}
                                  isEditing={isEdit}
                                  editValue={isEdit ? editValue : ""}
                                  isSaving={savingCell?.taskId === taskId && savingCell?.field === "status"}
                                  hasError={saveError?.taskId === taskId && saveError?.field === "status"}
                                  onStartEdit={() => startEdit(taskId, "status", cellVal)}
                                  onEditChange={setEditValue}
                                  onSave={(v) => handleSave(taskId, "status", v, cellVal)}
                                  onCancel={cancelEdit}
                                  renderLabel={(v) => {
                                    const opt = STATUS_OPTS.find(o => o.value === v);
                                    return opt?.label ?? v;
                                  }}
                                />
                              </div>
                            </td>
                          );
                        }

                        // ── Priority (editable select with signal bars) ──
                        if (col.key === "priority") {
                          const cellVal = task.priority;
                          const isEdit = editingCell?.taskId === taskId && editingCell?.field === "priority";
                          return (
                            <td key="priority" className={cn("px-1", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {!isEdit && <SignalBars priority={cellVal} />}
                                <EditableCell
                                  value={cellVal}
                                  type="select"
                                  selectOptions={PRIORITY_OPTIONS_LIST}
                                  isEditing={isEdit}
                                  editValue={isEdit ? editValue : ""}
                                  isSaving={savingCell?.taskId === taskId && savingCell?.field === "priority"}
                                  hasError={saveError?.taskId === taskId && saveError?.field === "priority"}
                                  onStartEdit={() => startEdit(taskId, "priority", cellVal)}
                                  onEditChange={setEditValue}
                                  onSave={(v) => handleSave(taskId, "priority", v, cellVal)}
                                  onCancel={cancelEdit}
                                  renderLabel={(v) => {
                                    const opt = PRIORITY_OPTIONS.find(o => o.value === v);
                                    return opt?.label ?? v;
                                  }}
                                />
                              </div>
                            </td>
                          );
                        }

                        // ── Task type (editable select) ──
                        if (col.key === "taskType") {
                          const cellVal = task.taskType;
                          const isEdit = editingCell?.taskId === taskId && editingCell?.field === "taskType";
                          const TypeIcon = TYPE_ICONS[cellVal as keyof typeof TYPE_ICONS] ?? TYPE_ICONS.custom;
                          return (
                            <td key="taskType" className={cn("px-1", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {!isEdit && <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                <EditableCell
                                  value={cellVal}
                                  type="select"
                                  selectOptions={TYPE_OPTIONS_LIST}
                                  isEditing={isEdit}
                                  editValue={isEdit ? editValue : ""}
                                  isSaving={savingCell?.taskId === taskId && savingCell?.field === "taskType"}
                                  hasError={saveError?.taskId === taskId && saveError?.field === "taskType"}
                                  onStartEdit={() => startEdit(taskId, "taskType", cellVal)}
                                  onEditChange={setEditValue}
                                  onSave={(v) => handleSave(taskId, "taskType", v, cellVal)}
                                  onCancel={cancelEdit}
                                  renderLabel={(v) => {
                                    const opt = TYPE_OPTIONS.find(o => o.value === v);
                                    return opt?.label ?? v;
                                  }}
                                />
                              </div>
                            </td>
                          );
                        }

                        // ── Category (read-only with icon) ──
                        if (col.key === "category") {
                          const cat = (task as any).categoryId ? categoryMap.get((task as any).categoryId) : null;
                          return (
                            <td key="category" className={cn("px-2.5", tdClass)}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                {cat ? (
                                  <>
                                    {cat.icon && <span className="text-[12px] shrink-0">{cat.icon}</span>}
                                    <span className="text-[12px] truncate">{cat.name}</span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground/30 text-[11px]">&mdash;</span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        // ── Tags (read-only pills) ──
                        if (col.key === "tags") {
                          const tags = parseTags((task as any).tags);
                          const colorMap = isDark ? TAG_COLORS_DARK : TAG_COLORS;
                          const fallback = { bg: isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9", text: isDark ? "#94A3B8" : "#475569" };
                          return (
                            <td key="tags" className={cn("px-2", tdClass)}>
                              <div className="flex items-center gap-1 overflow-hidden">
                                {showTags ? (
                                  tags.length > 0 ? (
                                    <>
                                      {tags.slice(0, 2).map((tag) => {
                                        const c = colorMap[tag] ?? fallback;
                                        return (
                                          <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap shrink-0"
                                            style={{ backgroundColor: c.bg, color: c.text }}
                                          >
                                            <TagIcon className="h-2 w-2" />{tag}
                                          </span>
                                        );
                                      })}
                                      {tags.length > 2 && <span className="text-[9px] text-muted-foreground/40 shrink-0">+{tags.length - 2}</span>}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground/30 text-[11px]">&mdash;</span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground/30 text-[11px]">&mdash;</span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        // ── Due date ──
                        if (col.key === "dueDate") {
                          return (
                            <td key="dueDate" className={cn("px-2.5", tdClass)}>
                              <span className={cn("text-[11px]", overdue ? "text-red-500 font-medium" : "text-foreground")}>
                                {getCellValue(task, "dueDate") || <span className="text-muted-foreground/30">&mdash;</span>}
                              </span>
                            </td>
                          );
                        }

                        // ── Read-only text fallback ──
                        return (
                          <td key={col.key} className={cn("px-2.5", tdClass)}>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {getCellValue(task, col.key) || <span className="text-muted-foreground/30">&mdash;</span>}
                            </span>
                          </td>
                        );
                      })}

                      {/* Trailing fill cell */}
                      <td className={bgClass} />
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="shrink-0 px-3 py-2 flex items-center justify-between gap-2 border-t border-border/20 bg-muted">
          <button
            onClick={() => setTablePage((p) => Math.max(0, p - 1))}
            disabled={tablePage === 0}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-black/[0.125] text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:pointer-events-none"
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
                  tablePage === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
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
            Next <ChevronDown className="h-3 w-3 -rotate-90" />
          </button>
        </div>
      )}
    </div>
  );
}
