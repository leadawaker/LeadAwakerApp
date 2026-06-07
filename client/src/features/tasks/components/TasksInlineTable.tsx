import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useUpdateTask, useTaskCategories } from "../api/tasksApi";
import {
  sortTasks, groupTasks,
  STATUS_OPTIONS as STATUS_OPTS,
  PRIORITY_OPTIONS, TYPE_OPTIONS, TASK_STATUSES,
} from "../types";
import type { Task, SortOption, GroupOption, TaskStatus, TaskPriority } from "../types";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import {
  opaqueTint, STATUS_HEX, PRIORITY_HEX,
  ALL_TABLE_COLUMNS, STATUS_DOT, PRIORITY_DOT,
  SignalBars, isOverdue, formatDueDate, formatTimeEstimate,
  formatRelativeTime, getNextStatus, TableSkeleton,
  EditableCell, SortableHeaderCell,
  type ColKey, type ColumnDef, type FlatRow,
} from "./TasksTableHelpers";

const STATUS_OPTIONS = TASK_STATUSES.map(s => s);
const PRIORITY_OPTIONS_LIST = PRIORITY_OPTIONS.map(o => o.value);

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
      case "timeEstimate": return formatTimeEstimate((task as any).timeEstimate);
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

    // Don't trigger selection if clicking on an editable cell or the checkbox
    const target = e.target as HTMLElement;
    if (target.closest("input, select, textarea")) return;

    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      const lo = Math.min(lastClickedIndexRef.current, idx);
      const hi = Math.max(lastClickedIndexRef.current, idx);
      const rangeIds = taskOnlyItems.slice(lo, hi + 1).map((item) => item.task.id);
      const next = new Set(selectedIds);
      rangeIds.forEach((id) => next.add(id));
      onSelectionChange(next);
    } else {
      // Any click toggles the row selection
      const next = new Set(selectedIds);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      onSelectionChange(next);
      if (next.size === 1) onSelectTask(Array.from(next)[0]);
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                            <td key="title" className={cn("px-2.5 align-middle", tdClass)}>
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
                            <td key="status" className={cn("px-1 align-middle", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
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
                            <td key="priority" className={cn("px-1 align-middle", tdClass)} style={isEdit ? { overflow: "visible" } : undefined}>
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

                        // ── Category (read-only with icon) ──
                        if (col.key === "category") {
                          const cat = (task as any).categoryId ? categoryMap.get((task as any).categoryId) : null;
                          return (
                            <td key="category" className={cn("px-2.5 align-middle", tdClass)}>
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

                        // ── Due date ──
                        if (col.key === "dueDate") {
                          return (
                            <td key="dueDate" className={cn("px-2.5 align-middle", tdClass)}>
                              <span className={cn("text-[11px]", overdue ? "text-red-500 font-medium" : "text-foreground")}>
                                {getCellValue(task, "dueDate") || <span className="text-muted-foreground/30">&mdash;</span>}
                              </span>
                            </td>
                          );
                        }

                        // ── Read-only text fallback ──
                        return (
                          <td key={col.key} className={cn("px-2.5 align-middle", tdClass)}>
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
        </DndContext>
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
