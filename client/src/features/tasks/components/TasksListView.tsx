import { useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ClipboardList } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import type { Task } from "@shared/schema";
import { useTagVisibility } from "../context/TagVisibilityContext";
import { useTaskCategories } from "../api/tasksApi";
import {
  sortTasks,
  groupTasks,
  parseTags,
  STATUS_COLORS,
  PRIORITY_COLORS,
  TAG_COLORS,
  TAG_COLORS_DARK,
  type SortOption,
  type GroupOption,
  type TaskStatus,
  type TaskPriority,
} from "../types";

// ── Row types for flat list ──────────────────────────────────────────
type HeaderRow = { type: "header"; label: string; count: number };
type TaskRow = { type: "task"; task: Task };
type FlatRow = HeaderRow | TaskRow;

// ── Status-based row styling ─────────────────────────────────────────
const STATUS_ROW_BG: Record<string, string> = {
  todo: "",
  in_progress: "bg-blue-50/30 dark:bg-blue-500/5",
  done: "bg-emerald-50/30 dark:bg-emerald-500/5",
  cancelled: "bg-gray-50/30 dark:bg-gray-500/5 opacity-60",
};

const STATUS_LEFT_BORDER: Record<string, string> = {
  todo: "border-l-transparent",
  in_progress: "border-l-blue-400 dark:border-l-blue-500",
  done: "border-l-emerald-400 dark:border-l-emerald-500",
  cancelled: "border-l-gray-400 dark:border-l-gray-500",
};

/** Map raw DB values (used as group keys) to i18n translation keys */
const STATUS_KEY_MAP: Record<string, string> = {
  todo: "status.todo",
  in_progress: "status.inProgress",
  done: "status.done",
  cancelled: "status.cancelled",
};

const PRIORITY_KEY_MAP: Record<string, string> = {
  low: "priority.low",
  medium: "priority.medium",
  high: "priority.high",
  urgent: "priority.urgent",
};

const TYPE_KEY_MAP: Record<string, string> = {
  follow_up: "taskType.followUp",
  call: "taskType.call",
  review: "taskType.review",
  admin: "taskType.admin",
  custom: "taskType.custom",
};

interface TasksListViewProps {
  tasks: Task[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  searchQuery: string;
  sort: SortOption;
  groupBy: GroupOption;
}

export default function TasksListView({
  tasks,
  selectedId,
  onSelect,
  searchQuery,
  sort,
  groupBy,
}: TasksListViewProps) {
  const { t } = useTranslation("tasks");
  const { isDark } = useTheme();
  const showTags = useTagVisibility();
  const { data: categories } = useTaskCategories();
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Translate a raw group label based on the current groupBy field */
  const translateGroupLabel = useCallback(
    (label: string): string => {
      if (label === "All") return t("groupBy.all");
      if (label === "Unassigned") return t("groupBy.unassigned");

      if (groupBy === "status" && STATUS_KEY_MAP[label]) {
        return t(STATUS_KEY_MAP[label]);
      }
      if (groupBy === "priority" && PRIORITY_KEY_MAP[label]) {
        return t(PRIORITY_KEY_MAP[label]);
      }
      if (groupBy === "taskType" && TYPE_KEY_MAP[label]) {
        return t(TYPE_KEY_MAP[label]);
      }
      if (groupBy === "category" && categories) {
        const cat = categories.find((c) => String(c.id) === label);
        if (cat) return cat.name;
        if (label === "Unassigned" || label === "null" || label === "undefined") return t("groupBy.unassigned");
      }

      return label;
    },
    [groupBy, t, categories]
  );

  const flatRows = useMemo<FlatRow[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? tasks.filter(
          (t) =>
            t.title?.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.leadName?.toLowerCase().includes(q) ||
            t.accountName?.toLowerCase().includes(q)
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
    estimateSize: (i) => (flatRows[i].type === "header" ? 36 : 40),
    gap: 3,
  });

  // Category lookup helper
  const getCategoryInfo = useCallback(
    (categoryId: number | null | undefined) => {
      if (!categoryId || !categories) return null;
      return categories.find((c) => c.id === categoryId) ?? null;
    },
    [categories]
  );

  const colorMap = isDark ? TAG_COLORS_DARK : TAG_COLORS;
  const fallbackTag = {
    bg: isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9",
    text: isDark ? "#94A3B8" : "#475569",
  };

  if (flatRows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <ClipboardList className="h-8 w-8 opacity-30" />
        <p className="text-sm font-medium">{t("page.noTasksFound")}</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-[3px]">
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const row = flatRows[vi.index];

          if (row.type === "header") {
            return (
              <div
                key={`h-${row.label}`}
                className="absolute left-0 right-0"
                style={{
                  height: vi.size,
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-3 pb-1">
                  {translateGroupLabel(row.label)}{" "}
                  <span className="text-muted-foreground/60 font-medium normal-case tracking-normal">
                    ({row.count})
                  </span>
                </div>
              </div>
            );
          }

          const task = row.task;
          const status = (task.status ?? "todo") as TaskStatus;
          const priority = (task.priority ?? "medium") as TaskPriority;
          const tags = parseTags((task as any).tags);
          const category = getCategoryInfo((task as any).categoryId);
          const isSelected = selectedId === task.id;
          const isDone = status === "done" || status === "cancelled";

          // Due date
          const isOverdue =
            task.dueDate &&
            new Date(task.dueDate) < new Date() &&
            !isDone;
          const dueDateStr = task.dueDate
            ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : null;

          // Created date
          const createdStr = task.createdAt ? relativeTime(typeof task.createdAt === "string" ? task.createdAt : new Date(task.createdAt).toISOString()) : null;

          // Tags to show (max 2 + overflow)
          const visibleTags = tags.slice(0, 2);
          const overflowCount = tags.length - 2;

          return (
            <div
              key={task.id}
              className="absolute left-0 right-0 group/row"
              style={{
                height: vi.size,
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <div
                className={cn(
                  "h-full rounded-lg border-l-[3px] px-3 flex items-center cursor-pointer transition-colors duration-100 relative",
                  "border border-border/20 dark:border-white/[0.06]",
                  STATUS_LEFT_BORDER[status],
                  STATUS_ROW_BG[status],
                  isSelected && "ring-1 ring-brand-indigo/40 bg-brand-indigo/5 dark:bg-brand-indigo/10",
                  !isSelected && "hover:bg-foreground/[0.03] dark:hover:bg-white/[0.03]",
                )}
                onClick={() => onSelect(task.id)}
              >
                {/* Main row */}
                <div className="flex items-center gap-2 min-w-0 w-full">
                  {/* Task ID */}
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0 w-[38px]">
                    #{task.id}
                  </span>

                  {/* Status dot */}
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  />

                  {/* Priority dot */}
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: PRIORITY_COLORS[priority] }}
                  />

                  {/* Emoji */}
                  {(task as any).emoji && (
                    <span className="text-[13px] shrink-0">{(task as any).emoji}</span>
                  )}

                  {/* Title */}
                  <span
                    className={cn(
                      "text-[13px] font-medium truncate min-w-0",
                      isDone && "line-through text-muted-foreground/60",
                      !isDone && "text-foreground",
                    )}
                  >
                    {task.title || t("card.newTask")}
                  </span>

                  {/* Tags */}
                  {showTags && visibleTags.length > 0 && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {visibleTags.map((tag) => {
                        const c = colorMap[tag] ?? fallbackTag;
                        return (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full px-1.5 py-[0.5px] text-[9px] font-medium shrink-0"
                            style={{ backgroundColor: c.bg, color: c.text }}
                          >
                            {tag}
                          </span>
                        );
                      })}
                      {overflowCount > 0 && (
                        <span className="text-[9px] text-muted-foreground/50 shrink-0">
                          +{overflowCount}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Category badge */}
                  {category && (
                    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-[0.5px] text-[9px] font-medium shrink-0 bg-foreground/[0.04] text-muted-foreground/70">
                      {category.color && (
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-sm shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      {category.name}
                    </span>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Due date */}
                  {dueDateStr && (
                    <span
                      className={cn(
                        "text-[11px] shrink-0",
                        isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground/50",
                      )}
                    >
                      {dueDateStr}
                    </span>
                  )}

                  {/* Created date */}
                  {createdStr && (
                    <span className="text-[10px] text-muted-foreground/40 shrink-0 w-[40px] text-right">
                      {createdStr}
                    </span>
                  )}
                </div>

                {/* Description tooltip — appears on hover below the row */}
                {task.description && (
                  <div className="absolute left-0 right-0 top-full z-10 hidden group-hover/row:block pointer-events-none">
                    <div className="mx-3 mt-0.5 px-3 py-1.5 rounded-md bg-popover border border-border/30 shadow-sm">
                      <p className="text-[11px] text-muted-foreground/70 line-clamp-2">
                        {task.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
