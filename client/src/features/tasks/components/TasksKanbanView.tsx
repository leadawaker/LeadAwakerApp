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

// Data-as-labels pattern: map raw status values → i18n keys (translate only at render time)
const STATUS_I18N_KEY: Record<string, string> = {
  todo: "status.todo",
  in_progress: "status.inProgress",
  done: "status.done",
  cancelled: "status.cancelled",
};

interface TasksKanbanViewProps {
  tasks: Task[];
  searchQuery: string;
  sort: SortOption;
}

// ── Sortable card wrapper ──────────────────────────────────────────────

function SortableTaskCard({
  task,
}: {
  task: Task;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
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
  status: string;
  label: string;
  color: string;
  tasks: Task[];
}) {
  const { t } = useTranslation("tasks");
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-2xl flex-shrink-0 h-full min-w-[260px] flex-1",
        "bg-card border border-border/30 transition-shadow duration-150",
        isOver && "ring-2 ring-brand-indigo/20"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2.5 p-4 pb-3 shrink-0">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[13px] font-semibold text-foreground">
          {label}
        </span>
        <span className="text-[12px] font-medium tabular-nums ml-auto bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {/* Column body */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-0">
          <div className="flex flex-col gap-3">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                />
              ))
            ) : (
              <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground">
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

    return TASK_STATUSES.map((s) => ({
      status: s,
      label: t(STATUS_I18N_KEY[s] ?? s),
      color: STATUS_COLORS[s],
      tasks: grouped[s],
    }));
  }, [tasks, searchQuery, sort, t]);

  const activeTask = activeId
    ? tasks.find((t) => t.id === activeId) ?? null
    : null;

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

      updateMutation.mutate({
        id: taskId,
        data: { status: targetStatus },
      });
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
      <div
        className="flex flex-1 gap-4 overflow-x-auto scroll-smooth min-h-0 h-full p-1 max-w-[1386px] w-full mr-auto"
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

      {/* Drag overlay — ghost card while dragging */}
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
