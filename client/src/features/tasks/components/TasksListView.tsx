import { useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ClipboardList } from "lucide-react";
import type { Task } from "@shared/schema";
import TaskCard from "./TaskCard";
import { sortTasks, groupTasks, type SortOption, type GroupOption } from "../types";

// ── Row types for flat list ──────────────────────────────────────────
type HeaderRow = { type: "header"; label: string; count: number };
type TaskRow = { type: "task"; task: Task };
type FlatRow = HeaderRow | TaskRow;

interface TasksListViewProps {
  tasks: Task[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  searchQuery: string;
  sort: SortOption;
  groupBy: GroupOption;
}

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

export default function TasksListView({
  tasks,
  selectedId,
  onSelect,
  searchQuery,
  sort,
  groupBy,
}: TasksListViewProps) {
  const { t } = useTranslation("tasks");
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Translate a raw group label based on the current groupBy field */
  const translateGroupLabel = useCallback(
    (label: string): string => {
      if (label === "All") return t("groupBy.all");
      if (label === "Unassigned") return t("groupBy.unassigned");

      // For status/priority/type grouping, map raw DB values to i18n keys
      if (groupBy === "status" && STATUS_KEY_MAP[label]) {
        return t(STATUS_KEY_MAP[label]);
      }
      if (groupBy === "priority" && PRIORITY_KEY_MAP[label]) {
        return t(PRIORITY_KEY_MAP[label]);
      }
      if (groupBy === "taskType" && TYPE_KEY_MAP[label]) {
        return t(TYPE_KEY_MAP[label]);
      }

      // Assignee/account names are user data — return as-is
      return label;
    },
    [groupBy, t]
  );

  const flatRows = useMemo<FlatRow[]>(() => {
    // 1. Search filter
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

    // 2. Sort
    const sorted = sortTasks(filtered, sort);

    // 3. Group
    const grouped = groupTasks(sorted, groupBy);

    // 4. Flatten
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
    estimateSize: (i) => (flatRows[i].type === "header" ? 36 : 72),
    gap: 3,
  });

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
          return (
            <div
              key={row.task.id}
              className="absolute left-0 right-0"
              style={{
                height: vi.size,
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <TaskCard task={row.task} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
