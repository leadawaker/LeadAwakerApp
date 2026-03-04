import { useState, useEffect, useMemo } from "react";
import { X, Trash2, Check } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, relativeTime } from "@/lib/utils";
import { useTasks, useUpdateTask, useDeleteTask } from "../api/tasksApi";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS } from "../types";

// ── Props ──────────────────────────────────────────────────────────────────────

interface TaskDetailPanelProps {
  taskId: number;
  onClose: () => void;
}

// ── Expand-on-hover button classes (§28) ──────────────────────────────────────
const xBase = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xSpan = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// ── Component ──────────────────────────────────────────────────────────────────

export default function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const { data: tasks } = useTasks();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

  const task = useMemo(
    () => (tasks as any[])?.find((t: any) => t.id === taskId),
    [tasks, taskId],
  );

  // ── Local form state ────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("admin");
  const [dueDate, setDueDate] = useState("");

  // Initialize form from task data
  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setDescription(task.description ?? "");
    setStatus(task.status ?? "todo");
    setPriority(task.priority ?? "medium");
    setTaskType(task.taskType ?? "admin");
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
  }, [task]);

  // ── Dirty tracking ──────────────────────────────────────────────────────────
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

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!task) return;
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

  const handleDelete = () => {
    if (!task) return;
    deleteMutation.mutate(task.id, { onSuccess: onClose });
  };

  // ── Loading / not found ─────────────────────────────────────────────────────

  if (!task) {
    return (
      <div className="relative flex flex-col h-full overflow-hidden">
        <div className="absolute inset-0 bg-popover dark:bg-background" />
        <div className="relative flex items-center gap-1 px-4 pt-6 pb-4 shrink-0">
          <div className="flex-1" />
          <IconBtn onClick={onClose}><X className="h-4 w-4" /></IconBtn>
        </div>
        <div className="relative flex-1 flex items-center justify-center text-[13px] text-muted-foreground">
          Task not found
        </div>
      </div>
    );
  }

  // ── Shared field styles ─────────────────────────────────────────────────────
  const inputCls = "w-full h-9 px-3 rounded-lg bg-white/60 dark:bg-white/[0.10] border border-border/30 text-[13px] outline-none focus:border-brand-indigo/50 transition-colors";
  const selectCls = inputCls;
  const labelCls = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="task-detail-panel">

      {/* Warm gradient background (matches AccountDetailView) */}
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_180%_123%_at_78%_83%,rgba(219,234,254,0.7)_0%,transparent_69%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_2%_2%,rgba(224,231,255,0.6)_5%,transparent_30%)] dark:opacity-[0.08]" />

      {/* ── Header ── */}
      <div className="relative shrink-0">
        <div className="px-4 pt-6 pb-4 space-y-3">
          {/* Toolbar row */}
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0" />
            {/* Delete */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(xBase, "hover:max-w-[100px]", "border-red-300/60 text-red-400 hover:border-red-400 hover:text-red-600")} title="Delete">
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>Delete</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" side="bottom">
                <p className="text-[12px] mb-2">Delete this task?</p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="px-3 h-8 rounded-lg bg-red-500 text-white text-[12px] font-medium">Delete</button>
                </div>
              </PopoverContent>
            </Popover>
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={cn(xBase, "hover:max-w-[80px]", isDirty ? "border-brand-indigo text-brand-indigo" : "border-black/[0.125] text-foreground/30 cursor-not-allowed")}
              title="Save"
            >
              <Check className="h-4 w-4 shrink-0" />
              <span className={xSpan}>Save</span>
            </button>
            {/* Close */}
            <IconBtn onClick={onClose}><X className="h-4 w-4" /></IconBtn>
          </div>

          {/* Title — large, editable */}
          <input
            className="w-full text-xl font-semibold font-heading text-foreground bg-transparent outline-none placeholder:text-foreground/30"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
          />
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="relative flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col gap-4">

          {/* Description */}
          <div className="space-y-1.5">
            <label className={labelCls}>Description</label>
            <textarea
              className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-white/60 dark:bg-white/[0.10] border border-border/30 text-[13px] resize-none outline-none focus:border-brand-indigo/50 transition-colors"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
            />
          </div>

          {/* Status + Priority — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Status</label>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Priority</label>
              <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Type + Due Date — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Type</label>
              <select className={selectCls} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>Due Date</label>
              <input
                type="datetime-local"
                className={inputCls}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Assignee (read-only) */}
          {task.assigneeName && (
            <div className="space-y-1.5">
              <label className={labelCls}>Assignee</label>
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20">
                  {task.assigneeName.split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="text-[13px] text-foreground/80">{task.assigneeName}</span>
              </div>
            </div>
          )}

          {/* Linked entities */}
          {(task.accountName || task.campaignName || task.leadName) && (
            <div className="space-y-1.5">
              <label className={labelCls}>Linked To</label>
              <div className="flex flex-wrap gap-1.5">
                {task.accountName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-foreground/[0.04] border border-foreground/[0.06]">
                    Account: {task.accountName}
                  </span>
                )}
                {task.campaignName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-foreground/[0.04] border border-foreground/[0.06]">
                    Campaign: {task.campaignName}
                  </span>
                )}
                {task.leadName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-foreground/[0.04] border border-foreground/[0.06]">
                    Lead: {task.leadName}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-[11px] text-muted-foreground pt-4 space-y-1 border-t border-border/20 mt-2">
            <p>Created {relativeTime(task.createdAt as unknown as string)}</p>
            <p>Updated {relativeTime(task.updatedAt as unknown as string)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
