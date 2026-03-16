import { useMemo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { Task } from "@shared/schema";
import { useUpdateTask } from "../api/tasksApi";
import {
  sortTasks,
  TASK_STATUSES,
  STATUS_COLORS,
  type SortOption,
  type TaskStatus,
} from "../types";
import TaskCard from "./TaskCard";

// Data-as-labels pattern: map raw status values → i18n keys
const STATUS_I18N_KEY: Record<string, string> = {
  todo: "status.todo",
  in_progress: "status.inProgress",
  done: "status.done",
  cancelled: "status.cancelled",
};

// ── Column theming (Notion-style) ──────────────────────────────────────
const COLUMN_THEME: Record<TaskStatus, {
  bg: string;
  border: string;
  headerText: string;
  countBg: string;
  countText: string;
}> = {
  todo: {
    bg: "bg-card",
    border: "border-border/30",
    headerText: "text-foreground",
    countBg: "bg-muted",
    countText: "text-muted-foreground",
  },
  in_progress: {
    bg: "bg-blue-50/50 dark:bg-blue-950/15",
    border: "border-blue-200/50 dark:border-blue-800/25",
    headerText: "text-blue-700 dark:text-blue-300",
    countBg: "bg-blue-100/80 dark:bg-blue-900/30",
    countText: "text-blue-600 dark:text-blue-400",
  },
  done: {
    bg: "bg-emerald-50/50 dark:bg-emerald-950/15",
    border: "border-emerald-200/50 dark:border-emerald-800/25",
    headerText: "text-emerald-700 dark:text-emerald-300",
    countBg: "bg-emerald-100/80 dark:bg-emerald-900/30",
    countText: "text-emerald-600 dark:text-emerald-400",
  },
  cancelled: {
    bg: "bg-card",
    border: "border-border/30",
    headerText: "text-muted-foreground",
    countBg: "bg-muted",
    countText: "text-muted-foreground",
  },
};

interface TasksKanbanViewProps {
  tasks: Task[];
  searchQuery: string;
  sort: SortOption;
}

// ── Sortable card wrapper ──────────────────────────────────────────────

function SortableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <TaskCard task={task} />
    </div>
  );
}

// ── Droppable column ───────────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  color,
  tasks,
}: {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: Task[];
}) {
  const { t } = useTranslation("tasks");
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });

  const theme = COLUMN_THEME[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-2xl min-h-0 h-full",
        "border transition-shadow duration-150",
        theme.bg,
        theme.border,
        isOver && "ring-2 ring-brand-indigo/20"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2.5 p-4 pb-3 shrink-0">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className={cn("text-[13px] font-semibold", theme.headerText)}>
          {label}
        </span>
        <span
          className={cn(
            "text-[12px] font-medium tabular-nums ml-auto rounded-full px-2 py-0.5",
            theme.countBg,
            theme.countText
          )}
        >
          {tasks.length}
        </span>
      </div>

      {/* Column body */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-0">
          <div className="flex flex-col gap-3">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <SortableTaskCard key={task.id} task={task} />
              ))
            ) : (
              <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground/50">
                {t("page.noTasks")}
              </div>
            )}
          </div>
        </div>
      </SortableContext>
    </div>
  );
}

// ── Main kanban view ───────────────────────────────────────────────────

export default function TasksKanbanView({
  tasks,
  searchQuery,
  sort,
}: TasksKanbanViewProps) {
  const { t } = useTranslation("tasks");
  const updateMutation = useUpdateTask();
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? tasks.filter((t) => {
          const haystack = [t.title, t.description, t.leadName, t.accountName]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        })
      : tasks;

    const sorted = sortTasks(filtered, sort);

    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const task of sorted) {
      const s = (task.status ?? "todo") as TaskStatus;
      if (grouped[s]) grouped[s].push(task);
      else grouped.todo.push(task);
    }

    return TASK_STATUSES.filter((s) => s !== "cancelled").map((s) => ({
      status: s,
      label: t(STATUS_I18N_KEY[s] ?? s),
      color: STATUS_COLORS[s],
      tasks: grouped[s],
    }));
  }, [tasks, searchQuery, sort, t]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as number;
      let targetStatus: TaskStatus | null = null;

      const overId = String(over.id);
      if (overId.startsWith("column-")) {
        targetStatus = overId.replace("column-", "") as TaskStatus;
      } else {
        const overTaskId = over.id as number;
        for (const col of columns) {
          if (col.tasks.some((t) => t.id === overTaskId)) {
            targetStatus = col.status;
            break;
          }
        }
      }

      if (!targetStatus) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === targetStatus) return;

      updateMutation.mutate({ id: taskId, data: { status: targetStatus } });
    },
    [tasks, columns, updateMutation]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Grid: 3 equal columns filling the full panel width */}
      <div
        className="grid grid-cols-3 grid-rows-[minmax(0,1fr)] gap-4 min-h-0 h-full p-1 w-full overflow-hidden"
        data-testid="tasks-kanban-board"
      >
        {columns.map((col) => (
          <KanbanColumn
            key={col.status}
            status={col.status}
            label={col.label}
            color={col.color}
            tasks={col.tasks}
          />
        ))}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="opacity-80 rotate-2 scale-105">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
