import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, Square, CalendarDays, ListChecks, Plus, Check, X, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ── Constants ────────────────────────────────────────────────────────────────

/** Pipeline grandparent task — all prospect tasks are children of this */
const PIPELINE_PARENT_ID = 177;

// ── Types ────────────────────────────────────────────────────────────────────

interface TaskItem {
  id: number;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  task_type: string | null;
}

interface ProspectTasksProps {
  prospectCompanyName: string;
  accountsId?: number;
  compact?: boolean;
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

// ── Task settings popover ────────────────────────────────────────────────────

const STATUS_OPTIONS = ["todo", "in_progress", "done"] as const;
const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;
const TYPE_OPTIONS = ["admin", "follow_up", "call", "review", "custom"] as const;

function TaskSettingsPopover({
  task,
  onUpdate,
}: {
  task: TaskItem;
  onUpdate: (patch: Partial<TaskItem>) => void;
}) {
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : "");

  async function patch(fields: Record<string, unknown>) {
    await apiFetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    onUpdate(fields as Partial<TaskItem>);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground transition-colors opacity-0 group-hover/task:opacity-100"
          title="Task settings"
        >
          <Settings2 className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-3 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Status</label>
          <select
            value={task.status}
            onChange={(e) => patch({ status: e.target.value })}
            className="text-[12px] rounded-md border border-border/60 bg-background px-2 py-1 outline-none focus:ring-2 focus:ring-brand-indigo/30"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Priority</label>
          <select
            value={task.priority}
            onChange={(e) => patch({ priority: e.target.value })}
            className="text-[12px] rounded-md border border-border/60 bg-background px-2 py-1 outline-none focus:ring-2 focus:ring-brand-indigo/30"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Type</label>
          <select
            value={task.task_type ?? "admin"}
            onChange={(e) => patch({ task_type: e.target.value })}
            className="text-[12px] rounded-md border border-border/60 bg-background px-2 py-1 outline-none focus:ring-2 focus:ring-brand-indigo/30"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
        </div>

        {/* Due date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Due date</label>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 text-[12px] rounded-md border border-border/60 bg-background px-2 py-1 outline-none focus:ring-2 focus:ring-brand-indigo/30"
            />
            {dueDate && (
              <button
                onClick={() => { setDueDate(""); patch({ due_date: null }); }}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {dueDate && dueDate !== (task.due_date?.slice(0, 10) ?? "") && (
            <button
              onClick={() => patch({ due_date: dueDate })}
              className="text-[11px] text-brand-indigo hover:underline self-end"
            >
              Save date
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProspectTasks({ prospectCompanyName, accountsId = 1, compact }: ProspectTasksProps) {
  const { t } = useTranslation("prospects");

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [saving, setSaving] = useState(false);

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

  const handleCreateTask = async () => {
    const title = newTaskTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status: "todo",
          priority: "medium",
          accountsId,
          accountName: prospectCompanyName || undefined,
          parentTaskId: PIPELINE_PARENT_ID,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTasks((prev) => [created, ...prev]);
        setNewTaskTitle("");
        setCreating(false);
      }
    } catch (err) {
      console.error("Failed to create task", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTask = (id: number, patch: Partial<TaskItem>) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleCreateTask(); }
    if (e.key === "Escape") { setCreating(false); setNewTaskTitle(""); }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center", compact ? "py-4" : "py-16")}>
        <div className="h-6 w-6 border-2 border-brand-indigo/30 border-t-brand-indigo rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", compact ? "py-1" : "px-5 py-3")}>
      {/* Add task button / inline input */}
      {creating ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("tasks.newTaskPlaceholder", "Task title...")}
            disabled={saving}
            className="flex-1 text-[12px] rounded-lg border border-border/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-brand-indigo/30 text-foreground placeholder:text-muted-foreground/40"
          />
          <button
            onClick={handleCreateTask}
            disabled={!newTaskTitle.trim() || saving}
            className="h-7 w-7 rounded-lg bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setCreating(false); setNewTaskTitle(""); }}
            className="h-7 w-7 rounded-lg border border-border/60 text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-brand-indigo transition-colors py-0.5 self-start"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("tasks.addTask", "Add task")}
        </button>
      )}

      {/* Task list */}
      {tasks.length === 0 && !creating && (
        <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-3 px-2" : "py-12 px-5")}>
          <ListChecks className={cn("text-muted-foreground/20", compact ? "h-5 w-5 mb-1" : "h-10 w-10 mb-3")} />
          <p className={cn("font-medium text-foreground/50", compact ? "text-[11px]" : "text-[13px]")}>
            {t("slidePanel.emptyTasks")}
          </p>
        </div>
      )}

      {tasks.map((task) => {
        const isDone = task.status === "done";
        return (
          <div
            key={task.id}
            className={cn(
              "group/task flex items-center gap-2 rounded-xl border bg-card transition-opacity duration-150",
              compact ? "p-2" : "p-3",
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

            {/* Settings */}
            <TaskSettingsPopover task={task} onUpdate={(patch) => handleUpdateTask(task.id, patch)} />
          </div>
        );
      })}
    </div>
  );
}
