import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import { ChevronLeft, ChevronRight, Check, Trash2, Plus, ChevronUp, ChevronDown, User } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import { useTasks, useUpdateTask, useDeleteTask, useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, useReorderSubtasks, useTaskCategories, useAccountUsers } from "../api/tasksApi";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, STATUS_COLORS, PRIORITY_COLORS, type TaskStatus, type TaskPriority } from "../types";
import { hapticSave, hapticDelete } from "@/lib/haptics";
import { MTAvatar, MTStatusPill } from "./MobileTaskListCard";
import { CommentsSection } from "./TaskDetailSections";
import type { TaskSubtask } from "@shared/schema";

// ── Priority bars icon (matches TasksWeekCalendar) ──────────────────────────
const PRIORITY_LEVEL: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
function PriorityBars({ priority }: { priority: string }) {
  const level = PRIORITY_LEVEL[priority] ?? 2;
  const color = PRIORITY_COLORS[priority as TaskPriority] ?? PRIORITY_COLORS.medium;
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, flexShrink: 0 }} title={priority}>
      {[1, 2, 3, 4].map(i => (
        <span key={i} style={{ width: 2.5, height: 3 + i * 2.5, borderRadius: 1, background: i <= level ? color : "var(--line)", flexShrink: 0 }} />
      ))}
    </span>
  );
}

// ── i18n key maps for status/priority options ────────────────────────────────
const STATUS_KEY: Record<string, string> = {
  todo: "status.todo", in_progress: "status.inProgress", waiting: "status.waiting", done: "status.done", cancelled: "status.cancelled",
};
const PRIORITY_KEY: Record<string, string> = {
  low: "priority.low", medium: "priority.medium", high: "priority.high", urgent: "priority.urgent",
};

interface Props {
  taskId: number;
  open: boolean;
  onBack: () => void;
}

export default function MobileTaskDetailPanel({ taskId, open, onBack }: Props) {
  const { t } = useTranslation("tasks");
  const { data: tasks } = useTasks();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const { data: categories = [] } = useTaskCategories();
  const { data: users = [] } = useAccountUsers();
  const { data: subtasks = [] } = useSubtasks(taskId);
  const createSubtaskMutation = useCreateSubtask();
  const updateSubtaskMutation = useUpdateSubtask();
  const deleteSubtaskMutation = useDeleteSubtask();
  const reorderMutation = useReorderSubtasks();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const currentUserName = useMemo(() => {
    const id = Number(localStorage.getItem("leadawaker_user_id") || 0);
    const u = (users as any[]).find((u: any) => u.id === id);
    return u?.fullName1 || localStorage.getItem("leadawaker_user_name") || "";
  }, [users]);

  const task = useMemo(
    () => (tasks as any[])?.find((tk: any) => tk.id === taskId),
    [tasks, taskId],
  );

  // ── Local form state ─────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assigneeName, setAssigneeName] = useState<string | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priorityOpen, setPriorityOpen] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setDescription(task.description ?? "");
    setStatus(task.status ?? "todo");
    setPriority(task.priority ?? "medium");
    setAssigneeName(task.assigneeName ?? null);
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
    setCategoryId(task.categoryId ?? null);
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
      assigneeName !== (task.assigneeName ?? null) ||
      dueDate !== origDue ||
      categoryId !== (task.categoryId ?? null)
    );
  }, [task, title, description, status, priority, assigneeName, dueDate, categoryId]);

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
        assigneeName,
        dueDate: dueDate ? new Date(dueDate) : null,
        categoryId,
      },
    });
  };

  const handleToggleComplete = () => {
    if (!task) return;
    const next = status === "done" ? "todo" : "done";
    setStatus(next);
    hapticSave();
    updateMutation.mutate({ id: task.id, data: { status: next } });
  };

  const handleDelete = () => {
    if (!task) return;
    hapticDelete();
    deleteMutation.mutate(task.id, { onSuccess: onBack });
  };

  const category = task?.categoryId ? (categories as any[]).find(c => c.id === task.categoryId) : null;
  const catColor = category?.color || "var(--mute-2)";
  const done = status === "done";

  // ── Shared field styles (neumorphic inset) ───────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, padding: "0 12px", borderRadius: "var(--r-button)",
    background: "hsl(var(--background))", boxShadow: "var(--sh-inset-crisp)",
    border: "none", color: "var(--ink)", fontSize: 14, outline: "none",
  };
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider";

  // ── Status slider helpers ─────────────────────────────────────────────────────
  const statusIdx = STATUS_OPTIONS.findIndex(o => o.value === status);
  const handleStatusPrev = () => {
    const next = STATUS_OPTIONS[(statusIdx - 1 + STATUS_OPTIONS.length) % STATUS_OPTIONS.length];
    setStatus(next.value);
    hapticSave();
    if (task) updateMutation.mutate({ id: task.id, data: { status: next.value } });
  };
  const handleStatusNext = () => {
    const next = STATUS_OPTIONS[(statusIdx + 1) % STATUS_OPTIONS.length];
    setStatus(next.value);
    hapticSave();
    if (task) updateMutation.mutate({ id: task.id, data: { status: next.value } });
  };

  return (
    <MobileSheet open={open} onClose={onBack} data-testid="mobile-task-detail-panel">
      {/* ── Header ── */}
      <div
        className="shrink-0"
        style={{
          background: "var(--bg)", borderBottom: "1px solid var(--line)",
          paddingTop: 8,
          paddingLeft: 16, paddingRight: 16, paddingBottom: 16,
        }}
      >
        <div className="row" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 9, flex: 1, minWidth: 0 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: catColor, flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {category?.name || t("fields.noCategory")}
            </span>
          </div>
          <MTStatusPill status={status as TaskStatus} label={t(STATUS_KEY[status] ?? status)} />
          {isDirty && (
            <button
              onClick={handleSave}
              style={{
                height: 32, padding: "0 12px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer",
                background: "var(--wine-grad)", color: "var(--paper)", boxShadow: "var(--sh-raised-crisp)",
                display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, flexShrink: 0,
              }}
            >
              <Check className="h-3.5 w-3.5" />
              {t("detail.save")}
            </button>
          )}
        </div>
        <div
          className="serif"
          style={{
            fontFamily: "var(--serif)", fontSize: 25, lineHeight: 1.2, marginTop: 12,
            color: "var(--ink)", letterSpacing: "-0.01em",
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {task?.title || t("page.title")}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 24px)" }}
      >
        {!task ? (
          <div className="flex items-center justify-center h-full text-[14px]" style={{ color: "var(--mute)" }}>
            {t("page.taskNotFound")}
          </div>
        ) : (
          <div className="px-4 py-5 flex flex-col gap-5">

            {/* Title */}
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.title", "Title")}</label>
              <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("create.taskTitle")} />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.description")}</label>
              <textarea
                style={{ ...inputStyle, height: "auto", minHeight: 80, padding: "10px 12px", resize: "none" }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("fields.addDescription")}
              />
            </div>

            {/* Sub-tasks checklist — directly below description */}
            <div className="space-y-2">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.subtasks")}</label>
              {subtasks.length > 0 && (
                <ul className="space-y-1">
                  {subtasks.map((sub, idx) => (
                    <li key={sub.id} className="flex items-center gap-2.5 px-2.5 py-2" style={{ borderRadius: "var(--r-surface)", background: "var(--surface)" }}>
                      <button
                        onClick={() => handleToggleSubtask(sub)}
                        style={{
                          width: 20, height: 20, borderRadius: "var(--r-flush)", flexShrink: 0, cursor: "pointer",
                          border: "1px solid " + (sub.isCompleted ? "transparent" : "var(--line)"),
                          background: sub.isCompleted ? "var(--good)" : "transparent", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {sub.isCompleted && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <span className={cn("flex-1 text-[14px] min-w-0 truncate", sub.isCompleted && "line-through")} style={{ color: sub.isCompleted ? "var(--mute)" : "var(--ink)" }}>
                        {sub.title}
                      </span>
                      <button onClick={() => handleMoveSubtask(idx, "up")} disabled={idx === 0} className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ color: idx === 0 ? "var(--mute-2)" : "var(--mute)" }} aria-label={t("subtask.moveUp")}>
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleMoveSubtask(idx, "down")} disabled={idx === subtasks.length - 1} className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ color: idx === subtasks.length - 1 ? "var(--mute-2)" : "var(--mute)" }} aria-label={t("subtask.moveDown")}>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteSubtask(sub.id)} className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ color: "var(--stage-lost)" }} aria-label={t("subtask.delete")}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  style={inputStyle}
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); }}
                  placeholder={t("subtask.addPlaceholder")}
                />
                <button
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  style={{
                    width: 40, height: 40, borderRadius: "var(--r-surface)", flexShrink: 0, border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: newSubtaskTitle.trim() ? "var(--wine)" : "var(--bg-2)",
                    color: newSubtaskTitle.trim() ? "#fff" : "var(--mute-2)",
                  }}
                  aria-label={t("subtask.add")}
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              {subtasks.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-2)" }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ background: "var(--good)", width: `${(subtasks.filter((s) => s.isCompleted).length / subtasks.length) * 100}%` }} />
                  </div>
                  <span className="text-[12px] shrink-0" style={{ color: "var(--mute)" }}>
                    {subtasks.filter((s) => s.isCompleted).length}/{subtasks.length}
                  </span>
                </div>
              )}
            </div>

            {/* Assignee — editable user picker */}
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.assignee")}</label>
              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <button type="button" style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }} data-testid="mobile-task-edit-assignee">
                    {assigneeName ? (
                      <>
                        <MTAvatar name={assigneeName} size={22} />
                        <span style={{ flex: 1, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{assigneeName}</span>
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 shrink-0" style={{ color: "var(--mute)" }} />
                        <span style={{ flex: 1, fontSize: 13, color: "var(--mute)" }}>{t("fields.assigneePlaceholder", "Unassigned")}</span>
                      </>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--mute-2)" }} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" style={{ background: "var(--surface)", border: "none", boxShadow: "var(--sh-raised-crisp)" }} side="bottom" align="start">
                  <button
                    onClick={() => { setAssigneeName(null); setAssigneeOpen(false); }}
                    className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[12px] transition-colors", !assigneeName ? "bg-muted font-medium" : "hover:bg-muted/50")}
                  >
                    <User className="h-3.5 w-3.5" style={{ color: "var(--mute)" }} />
                    <span>{t("fields.assigneePlaceholder", "Unassigned")}</span>
                  </button>
                  {(users as any[]).map((u: any) => {
                    const name = u.fullName1 || u.email || "";
                    if (!name) return null;
                    return (
                      <button
                        key={u.id}
                        onClick={() => { setAssigneeName(name); setAssigneeOpen(false); }}
                        className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[5px] text-[12px] transition-colors", assigneeName === name ? "bg-muted font-medium" : "hover:bg-muted/50")}
                      >
                        <MTAvatar name={name} size={20} />
                        <span className="truncate">{name}</span>
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            </div>

            {/* Status — slider/stepper */}
            <div className="space-y-2">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.status")}</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStatusPrev}
                  aria-label={t("status.prev", "Previous status")}
                  className="neu-raised-crisp"
                  style={{ width: 36, height: 36, borderRadius: "var(--r-button)", flexShrink: 0, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute)" }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex-1 flex items-center justify-center gap-2 neu-inset-crisp" style={{ height: 40 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[status as TaskStatus] ?? "var(--mute)", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t(STATUS_KEY[status] ?? status)}</span>
                </div>
                <button
                  onClick={handleStatusNext}
                  aria-label={t("status.next", "Next status")}
                  className="neu-raised-crisp"
                  style={{ width: 36, height: 36, borderRadius: "var(--r-button)", flexShrink: 0, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute)" }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.priority")}</label>
              <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}
                  >
                    <PriorityBars priority={priority} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{t(PRIORITY_KEY[priority] ?? priority)}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1 bg-white" side="bottom" align="start">
                  {PRIORITY_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => { setPriority(o.value); setPriorityOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] text-[13px] transition-colors",
                        priority === o.value ? "bg-muted font-medium" : "hover:bg-muted/50"
                      )}
                    >
                      <PriorityBars priority={o.value} />
                      <span>{t(PRIORITY_KEY[o.value] ?? o.label)}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.dueDate")}</label>
              <input type="datetime-local" style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.category")}</label>
              <select style={inputStyle} value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)} data-testid="mobile-task-edit-category">
                <option value="">{t("fields.noCategory", "No Category")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
                ))}
              </select>
            </div>

            {/* Linked entities */}
            {(task.accountName || task.campaignName || task.leadName) && (
              <div className="space-y-1.5">
                <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.linkedTo")}</label>
                <div className="flex flex-wrap gap-2">
                  {task.accountName && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--ink-soft)" }}>
                      {t("linked.account")} {task.accountName}
                    </span>
                  )}
                  {task.campaignName && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--ink-soft)" }}>
                      {t("linked.campaign")} {task.campaignName}
                    </span>
                  )}
                  {task.leadName && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--ink-soft)" }}>
                      {t("linked.lead")} {task.leadName}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Activity log */}
            <div className="pt-4 space-y-1 text-[12px]" style={{ borderTop: "1px solid var(--line)", color: "var(--mute)" }}>
              <p>{t("detail.created")} {relativeTime(task.createdAt as unknown as string)}</p>
              <p>{t("detail.updated")} {relativeTime(task.updatedAt as unknown as string)}</p>
            </div>

            {/* Comments — at the very bottom */}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <CommentsSection taskId={taskId} currentUserName={currentUserName} users={users as any[]} />
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky actions ── */}
      {task && (
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--line)", padding: "14px 18px", display: "flex", gap: 10, background: "var(--bg)" }}>
          <button
            onClick={handleToggleComplete}
            style={{
              flex: 1, height: 48, borderRadius: "var(--r-surface)", border: "none", cursor: "pointer",
              background: done ? "var(--surface)" : "linear-gradient(145deg, #2F7A52, #1F5C3C)",
              boxShadow: done ? "var(--sh-raised-crisp)" : "var(--sh-raised-medium)",
              color: done ? "var(--ink-soft)" : "var(--paper)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
              fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
            }}
          >
            <Check className="h-4 w-4" />
            {done ? t("detail.reopen") : t("detail.markComplete")}
          </button>
          <button
            onClick={handleDelete}
            style={{
              width: 48, height: 48, borderRadius: "var(--r-surface)", border: "none", cursor: "pointer",
              background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--stage-lost)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label={t("detail.delete")}
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}
    </MobileSheet>
  );
}
