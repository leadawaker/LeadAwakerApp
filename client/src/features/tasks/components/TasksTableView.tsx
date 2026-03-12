import { useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn, relativeTime } from "@/lib/utils";
import { useUpdateTask, useTaskCategories } from "../api/tasksApi";
import { useTheme } from "@/hooks/useTheme";
import { useTagVisibility } from "../context/TagVisibilityContext";
import {
  sortTasks,
  groupTasks,
  PRIORITY_COLORS,
  STATUS_COLORS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  TYPE_ICONS,
  TASK_STATUSES,
  parseTags,
  TAG_COLORS,
  TAG_COLORS_DARK,
} from "../types";
import type { Task, SortOption, GroupOption, TaskStatus } from "../types";

// ─── Column definitions ──────────────────────────────────────────────
// tKey stores the i18n translation key; empty string = no header label (priority dot column)
const COLUMNS = [
  { key: "priority", tKey: "", width: 40 },
  { key: "title", tKey: "columns.title", width: 260, sortable: true },
  { key: "category", tKey: "columns.category", width: 130 },
  { key: "tags", tKey: "columns.tags", width: 150 },
  { key: "taskType", tKey: "columns.type", width: 100 },
  { key: "status", tKey: "columns.status", width: 120 },
  { key: "timeEstimate", tKey: "columns.timeEstimate", width: 90 },
  { key: "parentTask", tKey: "columns.parentTask", width: 150 },
  { key: "assigneeName", tKey: "columns.assignee", width: 130 },
  { key: "accountName", tKey: "columns.account", width: 130 },
  { key: "dueDate", tKey: "columns.due", width: 100 },
  { key: "createdAt", tKey: "columns.created", width: 100 },
] as const;

const TABLE_MIN_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);
const ROW_HEIGHT = 52;
const HEADER_ROW_HEIGHT = 32;

// ─── Props ───────────────────────────────────────────────────────────
interface TasksTableViewProps {
  tasks: Task[];
  searchQuery: string;
  sort: SortOption;
  groupBy: GroupOption;
  onSelectTask: (id: number) => void;
  selectedTaskId: number | null;
}

// ─── Flat row type ───────────────────────────────────────────────────
type FlatRow =
  | { type: "header"; label: string; count: number }
  | { type: "task"; task: Task };

// ─── Helpers ─────────────────────────────────────────────────────────
function getNextStatus(current: TaskStatus): TaskStatus {
  const idx = TASK_STATUSES.indexOf(current);
  return TASK_STATUSES[(idx + 1) % TASK_STATUSES.length];
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  return new Date(task.dueDate) < new Date();
}

function formatDueDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getStatusLabel(status: string): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function getTypeLabel(taskType: string): string {
  return TYPE_OPTIONS.find((o) => o.value === taskType)?.label ?? taskType;
}

function formatTimeEstimate(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ─── Component ───────────────────────────────────────────────────────
export default function TasksTableView({
  tasks,
  searchQuery,
  sort,
  groupBy,
  onSelectTask,
  selectedTaskId,
}: TasksTableViewProps) {
  const { t } = useTranslation("tasks");
  const scrollRef = useRef<HTMLDivElement>(null);
  const updateTask = useUpdateTask();
  const { data: categories } = useTaskCategories();
  const showTags = useTagVisibility();
  const { isDark } = useTheme();

  // Build lookup maps
  const categoryMap = useMemo(() => {
    const map = new Map<number, { name: string; color: string | null; icon: string | null }>();
    if (categories) {
      for (const cat of categories) {
        map.set(cat.id, { name: cat.name, color: cat.color, icon: cat.icon });
      }
    }
    return map;
  }, [categories]);

  const parentTaskMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const task of tasks) {
      map.set(task.id, task.title);
    }
    return map;
  }, [tasks]);

  // 1. Filter → 2. Sort → 3. Group → 4. Flatten
  const flatRows = useMemo<FlatRow[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? tasks.filter(
          (t) =>
            t.title?.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.leadName?.toLowerCase().includes(q) ||
            t.accountName?.toLowerCase().includes(q),
        )
      : tasks;

    const sorted = sortTasks(filtered, sort);
    const grouped = groupTasks(sorted, groupBy);

    const rows: FlatRow[] = [];
    for (const [label, items] of Array.from(grouped.entries())) {
      if (groupBy !== "none") {
        rows.push({ type: "header", label, count: items.length });
      }
      for (const task of items) {
        rows.push({ type: "task", task });
      }
    }
    return rows;
  }, [tasks, searchQuery, sort, groupBy]);

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (idx) =>
      flatRows[idx].type === "header" ? HEADER_ROW_HEIGHT : ROW_HEIGHT,
    overscan: 10,
  });

  const handleStatusClick = useCallback(
    (e: React.MouseEvent, task: Task) => {
      e.stopPropagation();
      const nextStatus = getNextStatus(task.status as TaskStatus);
      updateTask.mutate({
        id: task.id,
        data: {
          status: nextStatus,
          ...(nextStatus === "done" ? { completedAt: new Date() } : {}),
        },
      });
    },
    [updateTask],
  );

  // ─── Empty state ────────────────────────────────────────────────────
  if (flatRows.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        <p className="text-[13px]">{t("page.noTasks")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sticky header */}
      <div
        className="shrink-0 h-[36px] flex items-center border-b border-border/20 bg-muted"
        style={{ minWidth: TABLE_MIN_WIDTH }}
      >
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground select-none whitespace-nowrap"
            style={{ width: col.width, minWidth: col.width }}
          >
            {col.tKey ? t(col.tKey) : ""}
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            minWidth: TABLE_MIN_WIDTH,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = flatRows[vItem.index];

            // ── Group header row ──
            if (row.type === "header") {
              return (
                <div
                  key={`header-${row.label}`}
                  className="absolute left-0 w-full flex items-center px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50"
                  style={{
                    top: vItem.start,
                    height: HEADER_ROW_HEIGHT,
                  }}
                >
                  {row.label}
                  <span className="ml-1.5 text-muted-foreground/50">
                    ({row.count})
                  </span>
                </div>
              );
            }

            // ── Task row ──
            const task = row.task;
            const isSelected = task.id === selectedTaskId;
            const priorityColor =
              PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] ?? "#9CA3AF";
            const statusColor =
              STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] ?? "#6B7280";
            const TypeIcon =
              TYPE_ICONS[task.taskType as keyof typeof TYPE_ICONS] ?? TYPE_ICONS.custom;
            const overdue = isOverdue(task);
            const category = (task as any).categoryId ? categoryMap.get((task as any).categoryId) : null;
            const parentTitle = (task as any).parentTaskId ? parentTaskMap.get((task as any).parentTaskId) : null;

            return (
              <div
                key={task.id}
                className={cn(
                  "absolute left-0 w-full flex items-center cursor-pointer border-b border-border/10 transition-colors",
                  isSelected
                    ? "bg-highlight-selected"
                    : "bg-card hover:bg-card-hover",
                )}
                style={{
                  top: vItem.start,
                  height: ROW_HEIGHT,
                }}
                onClick={() => onSelectTask(task.id)}
              >
                {/* Priority dot */}
                <div
                  className="flex items-center justify-center"
                  style={{ width: 40, minWidth: 40 }}
                >
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: priorityColor }}
                    title={task.priority}
                  />
                </div>

                {/* Title (with emoji if present) */}
                <div
                  className="px-3 min-w-0"
                  style={{ width: 260, minWidth: 260 }}
                >
                  <span className="text-[13px] font-medium truncate block">
                    {(task as any).emoji ? <span className="mr-1">{(task as any).emoji}</span> : null}
                    {task.title}
                  </span>
                </div>

                {/* Category */}
                <div
                  className="px-3 min-w-0 flex items-center gap-1.5"
                  style={{ width: 130, minWidth: 130 }}
                >
                  {category ? (
                    <>
                      {category.color && (
                        <div
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      {category.icon && (
                        <span className="text-[12px] shrink-0">{category.icon}</span>
                      )}
                      <span className="text-[12px] truncate">{category.name}</span>
                    </>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">—</span>
                  )}
                </div>

                {/* Tags (respects tag visibility toggle) */}
                <div
                  className="px-3 min-w-0 flex items-center gap-1 overflow-hidden"
                  style={{ width: 150, minWidth: 150 }}
                >
                  {showTags ? (() => {
                    const tags = parseTags((task as any).tags);
                    const colorMap = isDark ? TAG_COLORS_DARK : TAG_COLORS;
                    const fallback = { bg: isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9", text: isDark ? "#94A3B8" : "#475569" };
                    return tags.length > 0 ? tags.map((tag) => {
                      const c = colorMap[tag] ?? fallback;
                      return (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full px-1.5 py-[1px] text-[10px] font-medium shrink-0"
                          style={{ backgroundColor: c.bg, color: c.text }}
                        >
                          {tag}
                        </span>
                      );
                    }) : <span className="text-[12px] text-muted-foreground">—</span>;
                  })() : <span className="text-[12px] text-muted-foreground/40">—</span>}
                </div>

                {/* Type */}
                <div
                  className="px-3 flex items-center gap-1.5 min-w-0"
                  style={{ width: 100, minWidth: 100 }}
                >
                  <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-[12px] text-muted-foreground truncate">
                    {getTypeLabel(task.taskType)}
                  </span>
                </div>

                {/* Status pill (clickable to cycle) */}
                <div
                  className="px-3"
                  style={{ width: 120, minWidth: 120 }}
                >
                  <button
                    type="button"
                    onClick={(e) => handleStatusClick(e, task)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-muted/60 hover:bg-muted transition-colors"
                    title={t("clickToChangeStatus")}
                  >
                    <div
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: statusColor }}
                    />
                    {getStatusLabel(task.status)}
                  </button>
                </div>

                {/* Time Estimate */}
                <div
                  className="px-3"
                  style={{ width: 90, minWidth: 90 }}
                >
                  <span className="text-[12px] text-muted-foreground">
                    {formatTimeEstimate((task as any).timeEstimate)}
                  </span>
                </div>

                {/* Parent Task */}
                <div
                  className="px-3 min-w-0"
                  style={{ width: 150, minWidth: 150 }}
                >
                  <span className="text-[12px] text-muted-foreground truncate block">
                    {parentTitle ?? "—"}
                  </span>
                </div>

                {/* Assignee */}
                <div
                  className="px-3 min-w-0"
                  style={{ width: 130, minWidth: 130 }}
                >
                  <span className="text-[12px] truncate block">
                    {task.assigneeName ?? "—"}
                  </span>
                </div>

                {/* Account */}
                <div
                  className="px-3 min-w-0"
                  style={{ width: 130, minWidth: 130 }}
                >
                  <span className="text-[12px] truncate block">
                    {task.accountName ?? "—"}
                  </span>
                </div>

                {/* Due date */}
                <div
                  className="px-3"
                  style={{ width: 100, minWidth: 100 }}
                >
                  <span
                    className={cn(
                      "text-[12px]",
                      overdue ? "text-red-500 font-medium" : "text-foreground",
                    )}
                  >
                    {formatDueDate(task.dueDate)}
                  </span>
                </div>

                {/* Created */}
                <div
                  className="px-3"
                  style={{ width: 100, minWidth: 100 }}
                >
                  <span className="text-[12px] text-muted-foreground">
                    {relativeTime(task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
