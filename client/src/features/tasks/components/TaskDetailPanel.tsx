import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Trash2, Check, Plus, ChevronUp, ChevronDown, Smile } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, relativeTime } from "@/lib/utils";
import { useTasks, useUpdateTask, useDeleteTask, useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, useReorderSubtasks, useTaskCategories } from "../api/tasksApi";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS } from "../types";
import type { TaskSubtask } from "@shared/schema";

// ── i18n key maps for data-as-labels ──────────────────────────────────────────
const STATUS_I18N_KEY: Record<string, string> = {
  todo: "status.todo",
  in_progress: "status.inProgress",
  done: "status.done",
  cancelled: "status.cancelled",
};

const PRIORITY_I18N_KEY: Record<string, string> = {
  low: "priority.low",
  medium: "priority.medium",
  high: "priority.high",
  urgent: "priority.urgent",
};

const TYPE_I18N_KEY: Record<string, string> = {
  follow_up: "taskType.followUp",
  call: "taskType.call",
  review: "taskType.review",
  admin: "taskType.admin",
  custom: "taskType.custom",
};

const EMOJI_OPTIONS = [
  "📋", "📁", "📌", "⭐", "🎯", "🔥", "💡", "🚀",
  "📊", "🎨", "🔧", "📝", "💬", "📅", "🏷️", "✅",
  "🐛", "🔒", "📦", "🏠", "💰", "📞", "🎉", "⚡",
  "🌐", "🛠️", "📱", "🖥️", "👤", "🤝", "📈", "🔔",
];

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
  const { t } = useTranslation("tasks");
  const { data: tasks } = useTasks();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const { data: categories = [] } = useTaskCategories();
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

  // ── Local form state ────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("admin");
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [parentTaskId, setParentTaskId] = useState<number | null>(null);
  const [emoji, setEmoji] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // Initialize form from task data
  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setDescription(task.description ?? "");
    setStatus(task.status ?? "todo");
    setPriority(task.priority ?? "medium");
    setTaskType(task.taskType ?? "admin");
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
    setCategoryId(task.categoryId ?? null);
    setParentTaskId(task.parentTaskId ?? null);
    setEmoji(task.emoji ?? "");
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
      dueDate !== origDue ||
      categoryId !== (task.categoryId ?? null) ||
      parentTaskId !== (task.parentTaskId ?? null) ||
      emoji !== (task.emoji ?? "")
    );
  }, [task, title, description, status, priority, taskType, dueDate, categoryId, parentTaskId, emoji]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAddSubtask = useCallback(() => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed || !task) return;
    createSubtaskMutation.mutate({ taskId: task.id, data: { title: trimmed } });
    setNewSubtaskTitle("");
  }, [newSubtaskTitle, task, createSubtaskMutation]);

  const handleToggleSubtask = useCallback((sub: TaskSubtask) => {
    updateSubtaskMutation.mutate({
      id: sub.id, taskId, data: { isCompleted: !sub.isCompleted },
    });
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
        categoryId,
        parentTaskId,
        emoji: emoji || null,
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
          {t("page.taskNotFound")}
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
        <div className="px-4 pt-6 pb-4 space-y-3 max-w-[1386px] w-full mr-auto">
          {/* Toolbar row */}
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0" />
            {/* Delete */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(xBase, "hover:max-w-[100px]", "border-red-300/60 text-red-400 hover:border-red-400 hover:text-red-600")} title={t("detail.delete")}>
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("detail.delete")}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" side="bottom">
                <p className="text-[12px] mb-2">{t("detail.deleteConfirm")}</p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="px-3 h-8 rounded-lg bg-red-500 text-white text-[12px] font-medium">{t("detail.delete")}</button>
                </div>
              </PopoverContent>
            </Popover>
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={cn(xBase, "hover:max-w-[80px]", isDirty ? "border-brand-indigo text-brand-indigo" : "border-black/[0.125] text-foreground/30 cursor-not-allowed")}
              title={t("detail.save")}
            >
              <Check className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("detail.save")}</span>
            </button>
            {/* Close */}
            <IconBtn onClick={onClose}><X className="h-4 w-4" /></IconBtn>
          </div>

          {/* Title — large, editable */}
          <input
            className="w-full text-xl font-semibold font-heading text-foreground bg-transparent outline-none placeholder:text-foreground/30"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("create.taskTitle")}
          />
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="relative flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col gap-4 max-w-[1386px] w-full mr-auto">

          {/* Description */}
          <div className="space-y-1.5">
            <label className={labelCls}>{t("fields.description")}</label>
            <textarea
              className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-white/60 dark:bg-white/[0.10] border border-border/30 text-[13px] resize-none outline-none focus:border-brand-indigo/50 transition-colors"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("fields.descriptionPlaceholder")}
            />
          </div>

          {/* Emoji picker */}
          <div className="space-y-1.5">
            <label className={labelCls}>{t("fields.emoji")}</label>
            <div className="flex items-center gap-2">
              <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "h-9 px-3 rounded-lg border border-border/30 text-[13px] flex items-center gap-2 transition-colors hover:border-brand-indigo/50",
                      emoji ? "bg-white/60 dark:bg-white/[0.10]" : "bg-white/60 dark:bg-white/[0.10] text-muted-foreground"
                    )}
                    data-testid="task-edit-emoji-trigger"
                  >
                    {emoji ? <span className="text-lg">{emoji}</span> : <Smile className="h-4 w-4" />}
                    <span>{emoji ? t("fields.changeEmoji") : t("fields.pickEmoji")}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-2" side="bottom" align="start">
                  <div className="grid grid-cols-8 gap-1" data-testid="task-emoji-grid">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => { setEmoji(e); setEmojiPickerOpen(false); }}
                        className={cn(
                          "h-8 w-8 rounded-md flex items-center justify-center text-lg hover:bg-foreground/[0.06] transition-colors",
                          emoji === e && "bg-brand-indigo/10 ring-1 ring-brand-indigo/30"
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {emoji && (
                <button
                  type="button"
                  onClick={() => setEmoji("")}
                  className="h-9 px-2 rounded-lg text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="task-edit-emoji-clear"
                >
                  {t("fields.clearEmoji")}
                </button>
              )}
            </div>
          </div>

          {/* Status + Priority — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.status")}</label>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(STATUS_I18N_KEY[o.value] ?? o.value)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.priority")}</label>
              <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(PRIORITY_I18N_KEY[o.value] ?? o.value)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Type + Due Date — side by side */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.type")}</label>
              <select className={selectCls} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(TYPE_I18N_KEY[o.value] ?? o.value)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <label className={labelCls}>{t("fields.dueDate")}</label>
              <input
                type="datetime-local"
                className={inputCls}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className={labelCls}>{t("fields.category")}</label>
            <select
              className={selectCls}
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              data-testid="task-edit-category"
            >
              <option value="">{t("categories.noCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>

          {/* Parent task */}
          <div className="space-y-1.5">
            <label className={labelCls}>{t("fields.parentTask")}</label>
            <select
              className={selectCls}
              value={parentTaskId ?? ""}
              onChange={(e) => setParentTaskId(e.target.value ? Number(e.target.value) : null)}
              data-testid="task-edit-parent"
            >
              <option value="">{t("fields.noParent")}</option>
              {(tasks as any[])?.filter((tk: any) => tk.id !== taskId).map((tk: any) => (
                <option key={tk.id} value={tk.id}>{tk.title}</option>
              ))}
            </select>
          </div>

          {/* Assignee (read-only) */}
          {task.assigneeName && (
            <div className="space-y-1.5">
              <label className={labelCls}>{t("fields.assignee")}</label>
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
              <label className={labelCls}>{t("fields.linkedTo")}</label>
              <div className="flex flex-wrap gap-1.5">
                {task.accountName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-foreground/[0.04] border border-foreground/[0.06]">
                    {t("linked.account")} {task.accountName}
                  </span>
                )}
                {task.campaignName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-foreground/[0.04] border border-foreground/[0.06]">
                    {t("linked.campaign")} {task.campaignName}
                  </span>
                )}
                {task.leadName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-foreground/[0.04] border border-foreground/[0.06]">
                    {t("linked.lead")} {task.leadName}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sub-tasks checklist */}
          <div className="space-y-2">
            <label className={labelCls}>{t("fields.subtasks", "Sub-tasks")}</label>
            {subtasks.length > 0 && (
              <ul className="space-y-1" data-testid="subtask-list">
                {subtasks.map((sub, idx) => (
                  <li
                    key={sub.id}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.03] transition-colors"
                    data-testid={`subtask-${sub.id}`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleSubtask(sub)}
                      className={cn(
                        "h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors",
                        sub.isCompleted
                          ? "bg-brand-indigo border-brand-indigo text-white"
                          : "border-foreground/20 hover:border-brand-indigo/50"
                      )}
                      title={sub.isCompleted ? t("subtask.uncheck", "Uncheck") : t("subtask.check", "Check")}
                    >
                      {sub.isCompleted && <Check className="h-3 w-3" />}
                    </button>

                    {/* Title */}
                    <span className={cn(
                      "flex-1 text-[13px] min-w-0 truncate",
                      sub.isCompleted && "line-through text-muted-foreground"
                    )}>
                      {sub.title}
                    </span>

                    {/* Move up/down */}
                    <button
                      onClick={() => handleMoveSubtask(idx, "up")}
                      disabled={idx === 0}
                      className={cn(
                        "h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                        idx === 0 ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
                      )}
                      title={t("subtask.moveUp", "Move up")}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveSubtask(idx, "down")}
                      disabled={idx === subtasks.length - 1}
                      className={cn(
                        "h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                        idx === subtasks.length - 1 ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
                      )}
                      title={t("subtask.moveDown", "Move down")}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteSubtask(sub.id)}
                      className="h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title={t("subtask.delete", "Delete sub-task")}
                      data-testid={`delete-subtask-${sub.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add new subtask */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 h-8 px-3 rounded-lg bg-white/60 dark:bg-white/[0.10] border border-border/30 text-[13px] outline-none focus:border-brand-indigo/50 transition-colors placeholder:text-foreground/30"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); }}
                placeholder={t("subtask.addPlaceholder", "Add a sub-task...")}
                data-testid="add-subtask-input"
              />
              <button
                onClick={handleAddSubtask}
                disabled={!newSubtaskTitle.trim()}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  newSubtaskTitle.trim()
                    ? "bg-brand-indigo text-white hover:bg-brand-indigo/90"
                    : "bg-foreground/[0.04] text-foreground/20 cursor-not-allowed"
                )}
                title={t("subtask.add", "Add")}
                data-testid="add-subtask-btn"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Progress indicator */}
            {subtasks.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-brand-indigo rounded-full transition-all duration-300"
                    style={{ width: `${(subtasks.filter((s) => s.isCompleted).length / subtasks.length) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {subtasks.filter((s) => s.isCompleted).length}/{subtasks.length}
                </span>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="text-[11px] text-muted-foreground pt-4 space-y-1 border-t border-border/20 mt-2">
            <p>{t("detail.created")} {relativeTime(task.createdAt as unknown as string)}</p>
            <p>{t("detail.updated")} {relativeTime(task.updatedAt as unknown as string)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
