import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, Square, Signal, CalendarDays, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskItem {
  id: number;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
}

interface ProspectTasksProps {
  prospectCompanyName: string;
}

// ── Priority signal bars ─────────────────────────────────────────────────────

function PriorityBars({ priority }: { priority: string }) {
  const level = priority === "high" || priority === "High" ? 3
    : priority === "medium" || priority === "Medium" ? 2
    : 1;
  const color = level === 3 ? "bg-red-500" : level === 2 ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600";

  return (
    <div className="flex items-end gap-0.5 h-3.5" title={priority}>
      {[1, 2, 3].map((bar) => (
        <div
          key={bar}
          className={cn(
            "w-1 rounded-full",
            bar <= level ? color : "bg-border/40",
          )}
          style={{ height: `${bar * 4 + 2}px` }}
        />
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProspectTasks({ prospectCompanyName }: ProspectTasksProps) {
  const { t } = useTranslation("prospects");

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!prospectCompanyName) {
      setTasks([]);
      return;
    }

    let cancelled = false;
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(
          `/api/tasks?search=${encodeURIComponent(prospectCompanyName)}`,
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setTasks(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch tasks for prospect", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTasks();
    return () => { cancelled = true; };
  }, [prospectCompanyName]);

  const handleToggle = async (task: TaskItem) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)),
      );
    } catch (err) {
      console.error("Failed to toggle task", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 border-2 border-brand-indigo/30 border-t-brand-indigo rounded-full animate-spin" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-5">
        <ListChecks className="h-10 w-10 text-muted-foreground/20 mb-3" />
        <p className="text-[13px] font-medium text-foreground/50">
          {t("slidePanel.emptyTasks")}
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-3 space-y-1.5">
      {tasks.map((task) => {
        const isDone = task.status === "done";
        return (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-3 transition-opacity duration-150",
              isDone && "opacity-50",
            )}
          >
            {/* Checkbox */}
            <button
              onClick={() => handleToggle(task)}
              className="shrink-0 text-foreground/50 hover:text-foreground transition-colors duration-150"
            >
              {isDone ? (
                <CheckSquare className="h-5 w-5 text-emerald-500" />
              ) : (
                <Square className="h-5 w-5" />
              )}
            </button>

            {/* Title */}
            <span
              className={cn(
                "flex-1 text-[13px] font-medium text-foreground leading-tight truncate",
                isDone && "line-through text-foreground/40",
              )}
            >
              {task.title}
            </span>

            {/* Priority */}
            <PriorityBars priority={task.priority || "low"} />

            {/* Due date */}
            {task.due_date && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                <CalendarDays className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
