import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Check, Trash2, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import { useTasks, useUpdateTask, useDeleteTask, useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, useReorderSubtasks } from "../api/tasksApi";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS } from "../types";
import { hapticSave, hapticDelete } from "@/lib/haptics";
import type { TaskSubtask } from "@shared/schema";

// ── i18n label maps (standalone — no module-level hooks) ─────────────────────
const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const TYPE_LABELS: Record<string, string> = {
  follow_up: "Follow Up",
  call: "Call",
  review: "Review",
  admin: "Admin",
  custom: "Custom",
};

interface Props {
  taskId: number;
  onBack: () => void;
}

export default function MobileTaskDetailPanel({ taskId, onBack }: Props) {
  const { data: tasks } = useTasks();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const { data: subtasks = [] } = useSubtasks(taskId);
  const createSubtaskMutation = useCreateSubtask();
  const updateSubtaskMutation = useUpdateSubtask();
  const deleteSubtaskMutation = useDeleteSubtask();
  const reorderMutation = useReorderSubtasks();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const task = useMemo(
    () => (tasks as any[])?.find((t: any) => t.id === taskId),
    [tasks, taskId],
  );

  // ── Local form state ─────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("admin");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setDescription(task.description ?? "");
    setStatus(task.status ?? "todo");
    setPriority(task.priority ?? "medium");
    setTaskType(task.taskType ?? "admin");
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
  }, [task]);

  // ── Dirty tracking ───────────────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (!task) return false;
    const origDue = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "";
    return (
      title !== (task.title ?? "") ||
      description !== (task.description ?? "") ||
      status !== (task.status ?? "todo") ||
      priority !== (task.priority ?? "medium") ||
      taskType !== (task.taskType ?? "admin") ||
      dueDate !== origDue
    );
  }, [task, title, description, status, priority, taskType, dueDate]);

  // ── Subtask handlers ────────────────────────────────────────────────────────
  const handleAddSubtask = useCallback(() => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed || !task) return;
    createSubtaskMutation.mutate({ taskId: task.id, data: { title: trimmed } });
    setNewSubtaskTitle("");
  }, [newSubtaskTitle, task, createSubtaskMutation]);

  const handleToggleSubtask = useCallback((sub: TaskSubtask) => {
    updateSubtaskMutation.mutate({ id: sub.id, taskId, data: { isCompleted: !sub.isCompleted } });
  }, [taskId, updateSubtaskMutation]);

  const handleDeleteSubtask = useCallback((subId: number) => {
    deleteSubtaskMutation.mutate({ id: subId, taskId });
  }, [taskId, deleteSubtaskMutation]);

  const handleMoveSubtask = useCallback((index: number, direction: "up" | "down") => {
    if (!subtasks.length) return;
    const ids = subtasks.map((s) => s.id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate({ taskId, subtaskIds: ids });
  }, [subtasks, taskId, reorderMutation]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!task) return;
    hapticSave();
    updateMutation.mutate({
      id: task.id,
      data: {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        taskType,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });
  };

  // Quick status update — saves immediately without requiring Save button
  const handleStatusUpdate = (newStatus: string) => {
    if (!task) return;
    setStatus(newStatus);
    hapticSave();
    updateMutation.mutate({ id: task.id, data: { status: newStatus } });
  };

  const handleDelete = () => {
    if (!task) return;
    hapticDelete();
    deleteMutation.mutate(task.id, { onSuccess: onBack });
  };

  const assigneeInitials = task?.assigneeName
    ? task.assigneeName
        .split(" ")
        .map((w: string) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  // ── Shared field styles ──────────────────────────────────────────────────────
  const inputCls =
    "w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/30 text-[14px] outline-none focus:border-brand-indigo/50 transition-colors";
  const selectCls = inputCls;
  const labelCls = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-background animate-in slide-in-from-right duration-250 ease-out"
      style={{ height: "100dvh" }}
      data-testid="mobile-task-detail-panel"
    >
      {/* ── Sticky header: back + title + save ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 border-b border-border/20 bg-background/95 backdrop-blur-sm"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px), 12px)",
          paddingBottom: "12px",
        }}
      >
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-full border border-border/50 bg-card grid place-items-center shrink-0 active:scale-95 transition-transform"
          aria-label="Back to tasks list"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h2 className="flex-1 text-[17px] font-semibold font-heading truncate min-w-0">
          {task?.title || "Task"}
        </h2>

        {isDirty && (
          <button
            onClick={handleSave}
            className="h-8 px-3 rounded-full bg-brand-indigo text-white text-[12px] font-semibold flex items-center gap-1 shrink-0"
          >
            <Check className="h-3.5 w-3.5" />
            Save
          </button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 24px)" }}
      >
        {!task ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-[14px]">
            Task not found
          </div>
        ) : (
          <div className="px-4 py-5 flex flex-col gap-5">

            {/* Title */}
            <div className="space-y-1.5">
              <label className={labelCls}>Title</label>
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className={labelCls}>Description</label>
              <textarea
                className="w-full min-h-[80px] px-3 py-2.5 rounded-xl bg-muted/50 border border-border/30 text-[14px] resize-none outline-none focus:border-brand-indigo/50 transition-colors"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description..."
              />
            </div>

            {/* Status — quick-update pill buttons */}
            <div className="space-y-2">
              <label className={labelCls}>Status</label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => handleStatusUpdate(o.value)}
                    className={cn(
                      "h-10 rounded-xl text-[13px] font-medium border transition-colors",
                      status === o.value
                        ? "bg-brand-indigo text-white border-brand-indigo"
                        : "bg-muted/50 border-border/30 text-muted-foreground active:scale-[0.97]"
                    )}
                  >
                    {STATUS_LABELS[o.value] ?? o.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority + Type — side by side */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className={labelCls}>Priority</label>
                <select
                  className={selectCls}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {PRIORITY_LABELS[o.value] ?? o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className={labelCls}>Type</label>
                <select
                  className={selectCls}
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {TYPE_LABELS[o.value] ?? o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <label className={labelCls}>Due Date</label>
              <input
                type="datetime-local"
                className={inputCls}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Assignee (read-only) */}
            {task.assigneeName && (
              <div className="space-y-1.5">
                <label className={labelCls}>Assignee</label>
                <div className="flex items-center gap-2.5">
                  <span className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20 shrink-0">
                    {assigneeInitials}
                  </span>
                  <span className="text-[14px] text-foreground/80">{task.assigneeName}</span>
                </div>
              </div>
            )}

            {/* Linked entities (account, campaign, lead) */}
            {(task.accountName || task.campaignName || task.leadName) && (
              <div className="space-y-1.5">
                <label className={labelCls}>Linked To</label>
                <div className="flex flex-wrap gap-2">
                  {task.accountName && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium bg-foreground/[0.04] border border-foreground/[0.08]">
                      Account: {task.accountName}
                    </span>
                  )}
                  {task.campaignName && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium bg-foreground/[0.04] border border-foreground/[0.08]">
                      Campaign: {task.campaignName}
                    </span>
                  )}
                  {task.leadName && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium bg-foreground/[0.04] border border-foreground/[0.08]">
                      Lead: {task.leadName}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Sub-tasks checklist */}
            <div className="space-y-2">
              <label className={labelCls}>Sub-tasks</label>
              {subtasks.length > 0 && (
                <ul className="space-y-1">
                  {subtasks.map((sub, idx) => (
                    <li
                      key={sub.id}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 bg-muted/30"
                    >
                      <button
                        onClick={() => handleToggleSubtask(sub)}
                        className={cn(
                          "h-5 w-5 rounded border shrink-0 flex items-center justify-center transition-colors",
                          sub.isCompleted
                            ? "bg-brand-indigo border-brand-indigo text-white"
                            : "border-foreground/20"
                        )}
                      >
                        {sub.isCompleted && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <span className={cn(
                        "flex-1 text-[14px] min-w-0 truncate",
                        sub.isCompleted && "line-through text-muted-foreground"
                      )}>
                        {sub.title}
                      </span>
                      <button
                        onClick={() => handleMoveSubtask(idx, "up")}
                        disabled={idx === 0}
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                          idx === 0 ? "text-muted-foreground/30" : "text-muted-foreground active:scale-95"
                        )}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveSubtask(idx, "down")}
                        disabled={idx === subtasks.length - 1}
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                          idx === subtasks.length - 1 ? "text-muted-foreground/30" : "text-muted-foreground active:scale-95"
                        )}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubtask(sub.id)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-red-400 active:scale-95"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 h-10 px-3 rounded-xl bg-muted/50 border border-border/30 text-[14px] outline-none focus:border-brand-indigo/50 transition-colors"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); }}
                  placeholder="Add a sub-task..."
                />
                <button
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                    newSubtaskTitle.trim()
                      ? "bg-brand-indigo text-white active:scale-95"
                      : "bg-foreground/[0.04] text-foreground/20"
                  )}
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              {subtasks.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
                    <div
                      className="h-full bg-brand-indigo rounded-full transition-all duration-300"
                      style={{ width: `${(subtasks.filter((s) => s.isCompleted).length / subtasks.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-[12px] text-muted-foreground shrink-0">
                    {subtasks.filter((s) => s.isCompleted).length}/{subtasks.length}
                  </span>
                </div>
              )}
            </div>

            {/* Activity log — timestamps */}
            <div className="pt-4 border-t border-border/20 space-y-1 text-[12px] text-muted-foreground">
              <p>Created {relativeTime(task.createdAt as unknown as string)}</p>
              <p>Updated {relativeTime(task.updatedAt as unknown as string)}</p>
            </div>

            {/* Delete task */}
            <button
              onClick={handleDelete}
              className="w-full h-11 rounded-xl border border-red-300/60 text-red-500 text-[14px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Trash2 className="h-4 w-4" />
              Delete Task
            </button>

          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
