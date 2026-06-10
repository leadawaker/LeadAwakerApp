import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Trash2, Check, User, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, relativeTime } from "@/lib/utils";
import { useTasks, useUpdateTask, useDeleteTask, useTaskCategories, useAccountUsers, useCreateTask } from "../api/tasksApi";
import { CommentsSection, AttachmentsSection } from "./TaskDetailSections";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../types";
import { usePublishEntityData } from "@/contexts/PageEntityContext";

// ── i18n key maps ─────────────────────────────────────────────────────────────
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

interface TaskDetailPanelProps {
  taskId: number;
  onClose: () => void;
}

export default function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const { t } = useTranslation("tasks");
  const { data: tasks } = useTasks();
  const updateMutation = useUpdateTask();
  const currentUserId = Number(localStorage.getItem("leadawaker_user_id") || 0);
  const currentUserFromList = useMemo(() => users.find(u => u.id === currentUserId), [users, currentUserId]);
  const currentUserName = currentUserFromList?.fullName1 || localStorage.getItem("leadawaker_user_name") || "";
  const deleteMutation = useDeleteTask();
  const createMutation = useCreateTask();
  const { data: categories = [] } = useTaskCategories();
  const { data: users = [] } = useAccountUsers();

  const task = useMemo(
    () => (tasks as any[])?.find((t: any) => t.id === taskId),
    [tasks, taskId],
  );

  const publishEntity = usePublishEntityData();
  useEffect(() => {
    if (!task) return;
    publishEntity({
      entityType: "task",
      entityId: task.id,
      entityName: task.title || "Unknown Task",
      summary: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        taskType: task.task_type,
        dueDate: task.due_date,
        tags: task.tags,
      },
      updatedAt: Date.now(),
    });
  }, [publishEntity, task]);

  // ── Local form state ──────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [taskType, setTaskType] = useState("admin");
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [emoji, setEmoji] = useState("");
  const [assigneeName, setAssigneeName] = useState<string | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const descRef = useRef<HTMLTextAreaElement>(null);

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
    setEmoji(task.emoji ?? "");
    setAssigneeName(task.assigneeName ?? null);
  }, [task]);

  // Auto-resize description textarea
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(80, el.scrollHeight)}px`;
  }, [description]);

  // ── Dirty tracking ────────────────────────────────────────────────────────
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
      emoji !== (task.emoji ?? "") ||
      assigneeName !== (task.assigneeName ?? null)
    );
  }, [task, title, description, status, priority, taskType, dueDate, categoryId, emoji, assigneeName]);

  const handleSave = () => {
    if (!task) return;
    const selectedUser = users.find(u => (u.fullName1 || u.email) === assigneeName);
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
        emoji: emoji || null,
        assigneeName,
        assignedToUserId: selectedUser?.id ?? null,
      },
    }, { onSuccess: onClose });
  };

  const handleDelete = () => {
    if (!task) return;
    deleteMutation.mutate(task.id, { onSuccess: onClose });
  };

  const handleClone = () => {
    if (!task) return;
    createMutation.mutate({
      title: (task.title ?? t("card.newTask")) + " (copy)",
      description: task.description ?? null,
      accountsId: task.accountsId,
      accountName: task.accountName ?? "",
      campaignName: task.campaignName ?? null,
      leadName: task.leadName ?? null,
      status: task.status ?? "todo",
      priority: task.priority ?? "medium",
      taskType: task.taskType ?? "admin",
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
      assigneeName: task.assigneeName ?? null,
    });
  };

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!task) {
    return (
      <div className="relative flex flex-col h-full overflow-hidden">
        <div className="relative flex items-center gap-1 px-4 pt-6 pb-4 shrink-0">
          <div className="flex-1" />
          <button onClick={onClose} className="la-btn la-btn--soft la-btn--icon" style={{ width: 32, height: 32 }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="relative flex-1 flex items-center justify-center text-[13px] text-muted-foreground">
          {t("page.taskNotFound")}
        </div>
      </div>
    );
  }

  // Inset fields — recessed neumorphic, slightly square radius.
  const inputCls = "w-full h-9 px-3 rounded-[5px] bg-[var(--bg)] shadow-[var(--sh-inset-crisp)] border-none text-[13px] text-[var(--ink)] outline-none transition-shadow";
  const selectCls = inputCls;
  const labelCls = "text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--mute-2)]";

  // Assignee initials for display
  const assigneeInitials = assigneeName
    ? assigneeName.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
    : null;

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="task-detail-panel">

      {/* ── Header ── */}
      <div className="relative shrink-0">
        <div className="px-5 pt-5 pb-3">
          {/* Toolbar row */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <input
                className="w-full text-xl font-semibold font-heading text-foreground bg-transparent outline-none placeholder:text-foreground/30"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("create.taskTitle")}
              />
            </div>
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={!isDirty}
              title={t("detail.save")}
              className={cn("la-btn shrink-0", isDirty ? "la-btn--wine" : "la-btn--soft")}
              style={!isDirty ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              <Check className="h-3.5 w-3.5 shrink-0" />
              {t("detail.save")}
            </button>
            {/* Clone */}
            <button onClick={handleClone} title="Clone task" className="la-btn la-btn--soft shrink-0">
              Clone
            </button>
            {/* Delete */}
            <Popover open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <PopoverTrigger asChild>
                <button title={t("detail.delete")} className="la-btn la-btn--soft la-btn--icon shrink-0" style={{ color: "var(--stage-lost)" }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3 glass-strong border-none" side="bottom">
                <p className="text-[12px] mb-2 text-[var(--ink)]">{t("detail.deleteConfirm")}</p>
                <button onClick={handleDelete} className="la-btn la-btn--wine" style={{ background: "var(--stage-lost)" }}>{t("detail.delete")}</button>
              </PopoverContent>
            </Popover>
            {/* Close */}
            <button onClick={onClose} className="la-btn la-btn--soft la-btn--icon" title="Close" style={{ width: 32, height: 32 }}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="flex gap-0 min-h-full">

          {/* ── Left: description + comments + attachments ── */}
          <div className="flex-1 min-w-0 px-5 pb-6 flex flex-col gap-5 border-r border-border/20">
            {/* Description */}
            <div className="space-y-1.5">
              <label className={labelCls}>{t("fields.description")}</label>
              <textarea
                ref={descRef}
                className="w-full px-3 py-2.5 rounded-[5px] bg-[var(--bg)] shadow-[var(--sh-inset-crisp)] border-none text-[14px] text-[var(--ink)] resize-none outline-none transition-shadow overflow-hidden leading-relaxed"
                style={{ minHeight: "80px" }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("fields.descriptionPlaceholder")}
              />
            </div>

            {/* Comments */}
            <CommentsSection taskId={taskId} currentUserName={currentUserName} users={users} />

            {/* Attachments */}
            <AttachmentsSection taskId={taskId} />

            {/* Timestamps */}
            <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/20 flex items-center gap-4 flex-wrap">
              <span>{t("detail.created")} {relativeTime(task.createdAt as unknown as string)}</span>
              <span>{t("detail.updated")} {relativeTime(task.updatedAt as unknown as string)}</span>
            </div>
          </div>

          {/* ── Right: all controls ── */}
          <div className="w-64 shrink-0 px-4 pt-2 pb-6 flex flex-col gap-4">

            {/* Status */}
            <div className="space-y-1.5">
              <label className={labelCls}>{t("fields.status")}</label>
              <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(STATUS_I18N_KEY[o.value] ?? o.value)}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className={labelCls}>{t("fields.priority")}</label>
              <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(PRIORITY_I18N_KEY[o.value] ?? o.value)}</option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label className={labelCls}>{t("fields.dueDate")}</label>
              <input
                type="datetime-local"
                className={inputCls}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className={labelCls}>{t("fields.category")}</label>
              <select
                className={selectCls}
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{t("categories.noCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
                ))}
              </select>
            </div>

            {/* Assignee — user picker */}
            <div className="space-y-1.5">
              <label className={labelCls}>{t("fields.assignee")}</label>
              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <button className={cn(inputCls, "flex items-center gap-2 cursor-pointer text-left")}>
                    {assigneeName ? (
                      <>
                        {(() => {
                          const au = users.find(u => (u.fullName1 || u.email) === assigneeName);
                          return au?.avatarUrl
                            ? <img src={au.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover shrink-0" />
                            : <span className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-brand-indigo/10 text-brand-indigo shrink-0">{assigneeInitials}</span>;
                        })()}
                        <span className="flex-1 truncate text-[13px]">{assigneeName}</span>
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        <span className="text-muted-foreground/50 text-[13px]">Unassigned</span>
                      </>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 ml-auto shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1 glass-strong border-none" side="bottom" align="start">
                  <button
                    onClick={() => { setAssigneeName(null); setAssigneeOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[12px] transition-colors",
                      !assigneeName ? "bg-muted font-medium" : "hover:bg-muted/50"
                    )}
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Unassigned
                  </button>
                  {users.map((u) => {
                    const name = u.fullName1 || u.email || "";
                    if (!name) return null;
                    const inits = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
                    return (
                      <button
                        key={u.id}
                        onClick={() => { setAssigneeName(name); setAssigneeOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[12px] transition-colors",
                          assigneeName === name ? "bg-muted font-medium" : "hover:bg-muted/50"
                        )}
                      >
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover shrink-0" />
                          : <span className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-brand-indigo/10 text-brand-indigo shrink-0">{inits}</span>
                        }
                        <span className="truncate">{name}</span>
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            </div>

            {/* Recurring */}
            <div className="flex items-center gap-3 py-1">
              <span className="text-[12px] text-muted-foreground shrink-0">Recurring</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateMutation.mutate({ id: taskId, data: { isRecurring: !task.isRecurring } })}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                    task.isRecurring ? "bg-brand-indigo" : "bg-foreground/20"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-0.5",
                    task.isRecurring ? "translate-x-4" : "translate-x-0.5"
                  )} />
                </button>
                {task.isRecurring && (
                  <select
                    value={task.recurringPeriod ?? "weekly"}
                    onChange={(e) => updateMutation.mutate({ id: taskId, data: { recurringPeriod: e.target.value } })}
                    className="text-[12px] border-none rounded-md px-2 py-1.5 bg-[var(--bg)] shadow-[var(--sh-inset-crisp)] text-[var(--ink)] outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                )}
              </div>
            </div>

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
          </div>
        </div>
      </div>
    </div>
  );
}
