import { useMemo, useCallback, useState, memo } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
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

const STATUS_I18N_KEY: Record<string, string> = {
  todo: "status.todo",
  in_progress: "status.inProgress",
  done: "status.done",
  cancelled: "status.cancelled",
};

const STATUS_ACCENT: Record<TaskStatus, string> = {
  todo: "#6B7280",
  in_progress: "#3B82F6",
  done: "#10B981",
  cancelled: "#9CA3AF",
};

interface TasksKanbanViewProps {
  tasks: Task[];
  searchQuery: string;
  sort: SortOption;
  selectedIds?: Set<number>;
  onSelect?: (id: number) => void;
  onCardClick?: (id: number) => void;
}

// ── Draggable card wrapper (no within-column sorting) ──────────────────

const DraggableTaskCard = memo(function DraggableTaskCard({
  task,
  selected,
  onSelect,
  onCardClick,
}: {
  task: Task;
  selected?: boolean;
  onSelect?: (id: number) => void;
  onCardClick?: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("cursor-grab active:cursor-grabbing touch-none", isDragging && "opacity-40")}
    >
      <TaskCard task={task} selected={selected} onSelect={onSelect} onCardClick={onCardClick} />
    </div>
  );
});

// ── Droppable column ───────────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  color,
  tasks,
  selectedIds,
  onSelect,
  onCardClick,
}: {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: Task[];
  selectedIds?: Set<number>;
  onSelect?: (id: number) => void;
  onCardClick?: (id: number) => void;
}) {
  const { t } = useTranslation("tasks");
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });

  const accentColor = STATUS_ACCENT[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-h-0 h-full transition-shadow duration-150",
        isOver && "ring-2 ring-brand-indigo/20 rounded-lg"
      )}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2.5 px-0.5 pb-3 shrink-0"
        style={{ borderBottom: `1px solid ${accentColor}4D` }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[13px] font-semibold text-foreground">
          {label}
        </span>
        <span className="text-[12px] font-medium tabular-nums ml-auto rounded-full px-2 py-0.5 bg-foreground/[0.06] text-foreground/50">
          {tasks.length}
        </span>
      </div>

      {/* Column body — drop zone for entire column */}
      <div className="flex flex-col gap-3 overflow-y-auto flex-1 pb-3 px-0.5 pt-3 min-h-[80px]">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground/50">
            {t("page.noTasks")}
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              selected={selectedIds?.has(task.id)}
              onSelect={onSelect}
              onCardClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main kanban view ───────────────────────────────────────────────────

export default function TasksKanbanView({
  tasks,
  searchQuery,
  sort,
  selectedIds,
  onSelect,
  onCardClick,
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
      const overId = String(over.id);

      // Only accept drops on column droppables
      if (!overId.startsWith("column-")) return;
      const targetStatus = overId.replace("column-", "") as TaskStatus;

      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === targetStatus) return;

      updateMutation.mutate({ id: taskId, data: { status: targetStatus } });
    },
    [tasks, updateMutation]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
            selectedIds={selectedIds}
            onSelect={onSelect}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="opacity-80 rotate-1 scale-105">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
