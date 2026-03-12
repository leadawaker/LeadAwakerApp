import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateTask } from "../api/tasksApi";
import { CheckCircle2, Circle, AlertTriangle, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "../types";

interface SimpleDailyViewProps {
  tasks: Task[];
}

export default function SimpleDailyView({ tasks }: SimpleDailyViewProps) {
  const { t } = useTranslation("tasks");
  const updateTask = useUpdateTask();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  // Overdue: past due date, not completed or cancelled
  const overdueTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === "done" || t.status === "cancelled") return false;
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        return due < today;
      }),
    [tasks, today]
  );

  // Today's tasks: due today, not cancelled
  const todayTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === "cancelled") return false;
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        due.setHours(0, 0, 0, 0);
        return due >= today && due < tomorrow;
      }),
    [tasks, today, tomorrow]
  );

  // No-date tasks that are todo or in_progress (show as "unscheduled")
  const unscheduledTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === "done" || t.status === "cancelled") return false;
        return !t.dueDate;
      }),
    [tasks]
  );

  const toggleDone = (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    updateTask.mutate({
      id: task.id,
      data: {
        status: newStatus,
        ...(newStatus === "done" ? { completedAt: new Date() } : { completedAt: null }),
      },
    });
  };

  const renderItem = (task: Task) => {
    const isDone = task.status === "done";
    return (
      <button
        key={task.id}
        onClick={() => toggleDone(task)}
        className={cn(
          "flex items-center gap-3 w-full text-left py-2 px-3 rounded-lg transition-colors duration-150",
          "hover:bg-muted/60 dark:hover:bg-white/5",
          isDone && "opacity-50"
        )}
        data-testid={`simple-task-${task.id}`}
      >
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
        )}
        <span
          className={cn(
            "text-sm font-medium truncate",
            isDone && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </span>
      </button>
    );
  };

  const hasContent = overdueTasks.length > 0 || todayTasks.length > 0 || unscheduledTasks.length > 0;

  return (
    <div className="h-full overflow-y-auto px-4 py-3" data-testid="simple-daily-view">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Overdue section */}
        {overdueTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 px-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {t("views.overdue")} ({overdueTasks.length})
              </h3>
            </div>
            <div className="space-y-0.5">
              {overdueTasks.map(renderItem)}
            </div>
          </section>
        )}

        {/* Today's tasks */}
        {todayTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 px-3">
              <Sun className="h-4 w-4 text-brand-indigo" />
              <h3 className="text-sm font-semibold text-foreground">
                {t("views.today")} ({todayTasks.length})
              </h3>
            </div>
            <div className="space-y-0.5">
              {todayTasks.map(renderItem)}
            </div>
          </section>
        )}

        {/* Unscheduled */}
        {unscheduledTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 px-3">
              <Circle className="h-4 w-4 text-muted-foreground/50" />
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t("views.unscheduled")} ({unscheduledTasks.length})
              </h3>
            </div>
            <div className="space-y-0.5">
              {unscheduledTasks.map(renderItem)}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!hasContent && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Sun className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">{t("views.noDailyTasks")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
