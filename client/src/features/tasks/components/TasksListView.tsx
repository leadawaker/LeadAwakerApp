import { useMemo, useRef } from "react";
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

export default function TasksListView({
  tasks,
  selectedId,
  onSelect,
  searchQuery,
  sort,
  groupBy,
}: TasksListViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
        <p className="text-sm font-medium">No tasks found</p>
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
                  {row.label}{" "}
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
