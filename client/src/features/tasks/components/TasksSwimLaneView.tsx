import { useMemo } from "react";
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
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { memo, useState, useCallback } from "react";
import type { Task } from "@shared/schema";
import { useUpdateTask } from "../api/tasksApi";
import { sortTasks, STATUS_COLORS, type SortOption, type TaskStatus } from "../types";
import TaskCard from "./TaskCard";

const STATUS_I18N_KEY: Record<string, string> = {
  todo: "status.todo",
  in_progress: "status.inProgress",
  done: "status.done",
};

const ACTIVE_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

const SortableTaskCard = memo(function SortableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `swim-${task.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <TaskCard task={task} />
    </div>
  );
});

function SwimLaneStatusCol({
  assignee,
  status,
  label,
  color,
  tasks,
}: {
  assignee: string;
  status: TaskStatus;
  label: string;
  color: string;
  tasks: Task[];
}) {
  const { t } = useTranslation("tasks");
  const droppableId = `swim-${assignee}-${status}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, data: { type: "swim-col", status, assignee } });

  return (
    <div
      ref={setNodeRef}
      className={cn("flex flex-col min-h-[80px] rounded-lg p-2 transition-colors duration-150", isOver && "bg-brand-indigo/5 ring-1 ring-brand-indigo/20")}
    >
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground/50 ml-auto">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => `swim-${t.id}`)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {tasks.length === 0 ? (
            <div className="text-[11px] text-muted-foreground/30 text-center py-4">{t("page.noTasks")}</div>
          ) : (
            tasks.map((task) => <SortableTaskCard key={task.id} task={task} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface TasksSwimLaneViewProps {
  tasks: Task[];
  searchQuery: string;
  sort: SortOption;
}

export default function TasksSwimLaneView({ tasks, searchQuery, sort }: TasksSwimLaneViewProps) {
  const { t } = useTranslation("tasks");
  const updateMutation = useUpdateTask();
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  const { rows, taskMap } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? tasks.filter((t) => [t.title, t.description, t.leadName, t.accountName].filter(Boolean).join(" ").toLowerCase().includes(q))
      : tasks;
    const sorted = sortTasks(filtered, sort);

    const assigneeSet = new Set<string>();
    for (const t of sorted) {
      assigneeSet.add(t.assigneeName ?? "__unassigned__");
    }

    const map = new Map<string, Map<TaskStatus, Task[]>>();
    for (const assignee of assigneeSet) {
      const statusMap = new Map<TaskStatus, Task[]>();
      for (const s of ACTIVE_STATUSES) statusMap.set(s, []);
      map.set(assignee, statusMap);
    }
    for (const t of sorted) {
      const assignee = t.assigneeName ?? "__unassigned__";
      const status = (t.status ?? "todo") as TaskStatus;
      const target = ACTIVE_STATUSES.includes(status) ? status : "todo";
      map.get(assignee)?.get(target)?.push(t);
    }

    const taskById = new Map<number, Task>();
    for (const t of sorted) taskById.set(t.id, t);

    // Sort rows: named assignees first, unassigned last
    const rowKeys = Array.from(assigneeSet).sort((a, b) => {
      if (a === "__unassigned__") return 1;
      if (b === "__unassigned__") return -1;
      return a.localeCompare(b);
    });

    return { rows: rowKeys.map((k) => ({ assignee: k, statusMap: map.get(k)! })), taskMap: taskById };
  }, [tasks, searchQuery, sort]);

  const activeTask = activeId ? taskMap.get(activeId) ?? null : null;

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const rawId = String(e.active.id).replace("swim-", "");
    setActiveId(Number(rawId));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = Number(String(active.id).replace("swim-", ""));
    const overId = String(over.id);
    let targetStatus: TaskStatus | null = null;
    if (overId.startsWith("swim-") && over.data.current?.type === "swim-col") {
      targetStatus = over.data.current.status as TaskStatus;
    } else {
      const overTaskId = Number(overId.replace("swim-", ""));
      const overTask = taskMap.get(overTaskId);
      if (overTask) targetStatus = (overTask.status ?? "todo") as TaskStatus;
    }
    if (!targetStatus) return;
    const task = taskMap.get(taskId);
    if (!task || task.status === targetStatus) return;
    updateMutation.mutate({ id: taskId, data: { status: targetStatus } });
  }, [taskMap, updateMutation]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4 overflow-y-auto h-full px-1 py-1">
        {rows.map(({ assignee, statusMap }) => {
          const displayName = assignee === "__unassigned__" ? "Unassigned" : assignee;
          const initials = assignee === "__unassigned__"
            ? "?"
            : assignee.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

          return (
            <div key={assignee} className="rounded-xl border border-border/30 bg-card overflow-hidden">
              {/* Row header */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/20 bg-muted/30">
                <span className="h-7 w-7 rounded-full bg-brand-indigo/10 text-brand-indigo text-[11px] font-bold flex items-center justify-center shrink-0">
                  {initials}
                </span>
                <span className="text-[13px] font-semibold text-foreground">{displayName}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground/50">
                  {ACTIVE_STATUSES.reduce((acc, s) => acc + (statusMap.get(s)?.length ?? 0), 0)}
                </span>
              </div>
              {/* 3-column mini kanban */}
              <div className="grid grid-cols-3 gap-3 p-3">
                {ACTIVE_STATUSES.map((status) => (
                  <SwimLaneStatusCol
                    key={status}
                    assignee={assignee}
                    status={status}
                    label={t(STATUS_I18N_KEY[status] ?? status)}
                    color={STATUS_COLORS[status]}
                    tasks={statusMap.get(status) ?? []}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="flex items-center justify-center py-20 text-[13px] text-muted-foreground/50">
            {t("page.noTasks")}
          </div>
        )}
      </div>
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
