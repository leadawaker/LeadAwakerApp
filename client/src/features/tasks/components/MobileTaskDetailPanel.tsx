import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import { ChevronLeft, Check, Trash2, Plus, ChevronUp, ChevronDown, Smile } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import { useTasks, useUpdateTask, useDeleteTask, useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, useReorderSubtasks, useTaskCategories } from "../api/tasksApi";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS, STATUS_COLORS, type TaskStatus } from "../types";
import { hapticSave, hapticDelete } from "@/lib/haptics";
import { MTAvatar, MTStatusPill } from "./MobileTaskListCard";
import type { TaskSubtask } from "@shared/schema";

const EMOJI_OPTIONS = [
  "📋", "📁", "📌", "⭐", "🎯", "🔥", "💡", "🚀",
  "📊", "🎨", "🔧", "📝", "💬", "📅", "🏷️", "✅",
  "🐛", "🔒", "📦", "🏠", "💰", "📞", "🎉", "⚡",
  "🌐", "🛠️", "📱", "🖥️", "👤", "🤝", "📈", "🔔",
];

// ── i18n key maps for status/priority/type options ───────────────────────────
const STATUS_KEY: Record<string, string> = {
  todo: "status.todo", in_progress: "status.inProgress", waiting: "status.waiting", done: "status.done", cancelled: "status.cancelled",
};
const PRIORITY_KEY: Record<string, string> = {
  low: "priority.low", medium: "priority.medium", high: "priority.high", urgent: "priority.urgent",
};
const TYPE_KEY: Record<string, string> = {
  follow_up: "taskType.followUp", call: "taskType.call", review: "taskType.review", admin: "taskType.admin", custom: "taskType.custom",
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
  const { data: subtasks = [] } = useSubtasks(taskId);
  const createSubtaskMutation = useCreateSubtask();
  const updateSubtaskMutation = useUpdateSubtask();
  const deleteSubtaskMutation = useDeleteSubtask();
  const reorderMutation = useReorderSubtasks();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const task = useMemo(
    () => (tasks as any[])?.find((tk: any) => tk.id === taskId),
    [tasks, taskId],
  );

  // ── Local form state ─────────────────────────────────────────────────────────
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
  const [estimateHours, setEstimateHours] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState("");

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
    const te = task.timeEstimate ?? 0;
    setEstimateHours(te >= 60 ? String(Math.floor(te / 60)) : "");
    setEstimateMinutes(te % 60 > 0 ? String(te % 60) : "");
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
      dueDate !== origDue ||
      categoryId !== (task.categoryId ?? null) ||
      parentTaskId !== (task.parentTaskId ?? null) ||
      emoji !== (task.emoji ?? "") ||
      (parseInt(estimateHours || "0") * 60 + parseInt(estimateMinutes || "0")) !== (task.timeEstimate ?? 0)
    );
  }, [task, title, description, status, priority, taskType, dueDate, categoryId, parentTaskId, emoji, estimateHours, estimateMinutes]);

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
        categoryId,
        parentTaskId,
        emoji: emoji || null,
        timeEstimate: (parseInt(estimateHours || "0") * 60 + parseInt(estimateMinutes || "0")) || null,
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

  // ── Shared field styles (design tokens) ──────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, padding: "0 12px", borderRadius: "var(--r-surface)",
    background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)",
    fontSize: 14, outline: "none",
  };
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider";

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
          <button
            onClick={onBack}
            style={{
              width: 38, height: 38, borderRadius: "var(--r-pill)", flexShrink: 0, border: "none", cursor: "pointer",
              background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label={t("detail.back", "Back")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
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
          {task?.emoji ? `${task.emoji} ` : ""}
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

            {/* Emoji picker */}
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.emoji")}</label>
              <div className="flex items-center gap-2">
                <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                  <PopoverTrigger asChild>
                    <button type="button" style={{ ...inputStyle, width: "auto", display: "flex", alignItems: "center", gap: 8, color: emoji ? "var(--ink)" : "var(--mute)" }} data-testid="mobile-task-edit-emoji-trigger">
                      {emoji ? <span className="text-xl">{emoji}</span> : <Smile className="h-5 w-5" />}
                      <span>{emoji ? t("fields.changeEmoji") : t("fields.pickEmoji")}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-2 bg-white" side="bottom" align="start">
                    <div className="grid grid-cols-8 gap-1" data-testid="mobile-task-emoji-grid">
                      {EMOJI_OPTIONS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => { setEmoji(e); setEmojiPickerOpen(false); }}
                          className={cn(
                            "h-9 w-9 rounded-lg flex items-center justify-center text-xl hover:bg-foreground/[0.06] transition-colors",
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
                    className="h-10 px-2 rounded-xl text-[13px] active:scale-95"
                    style={{ color: "var(--mute)" }}
                    data-testid="mobile-task-edit-emoji-clear"
                  >
                    {t("fields.clearEmoji")}
                  </button>
                )}
              </div>
            </div>

            {/* Status — quick-update pill buttons */}
            <div className="space-y-2">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.status")}</label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((o) => {
                  const on = status === o.value;
                  return (
                    <button
                      key={o.value}
                      onClick={() => { setStatus(o.value); hapticSave(); updateMutation.mutate({ id: task.id, data: { status: o.value } }); }}
                      style={{
                        height: 40, borderRadius: "var(--r-surface)", fontSize: 13, fontWeight: 500, cursor: "pointer",
                        border: "1px solid " + (on ? "transparent" : "var(--line)"),
                        background: on ? (STATUS_COLORS[o.value as TaskStatus] ?? "var(--wine)") : "var(--surface)",
                        color: on ? "#fff" : "var(--mute)",
                      }}
                    >
                      {t(STATUS_KEY[o.value] ?? o.value)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority + Type */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.priority")}</label>
                <select style={inputStyle} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{t(PRIORITY_KEY[o.value] ?? o.label)}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.type")}</label>
                <select style={inputStyle} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{t(TYPE_KEY[o.value] ?? o.label)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.dueDate")}</label>
              <input type="datetime-local" style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            {/* Time estimate */}
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.timeEstimate")}</label>
              <div className="flex gap-2 items-center">
                <input type="number" min="0" style={{ ...inputStyle, width: 80 }} value={estimateHours}
                  onChange={(e) => setEstimateHours(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" data-testid="mobile-task-edit-estimate-hours" />
                <span className="text-[13px]" style={{ color: "var(--mute)" }}>{t("fields.hours")}</span>
                <input type="number" min="0" max="59" style={{ ...inputStyle, width: 80 }} value={estimateMinutes}
                  onChange={(e) => setEstimateMinutes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" data-testid="mobile-task-edit-estimate-minutes" />
                <span className="text-[13px]" style={{ color: "var(--mute)" }}>{t("fields.minutes")}</span>
              </div>
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

            {/* Parent task */}
            <div className="space-y-1.5">
              <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.parentTask")}</label>
              <select style={inputStyle} value={parentTaskId ?? ""} onChange={(e) => setParentTaskId(e.target.value ? Number(e.target.value) : null)} data-testid="mobile-task-edit-parent">
                <option value="">{t("fields.noParent")}</option>
                {(tasks as any[])?.filter((tk: any) => tk.id !== taskId).map((tk: any) => (
                  <option key={tk.id} value={tk.id}>{tk.title}</option>
                ))}
              </select>
            </div>

            {/* Assignee (read-only) */}
            {task.assigneeName && (
              <div className="space-y-1.5">
                <label className={labelCls} style={{ color: "var(--mute-2)" }}>{t("fields.assignee")}</label>
                <div className="flex items-center gap-2.5">
                  <MTAvatar name={task.assigneeName} size={28} />
                  <span className="text-[14px]" style={{ color: "var(--ink-soft)" }}>{task.assigneeName}</span>
                </div>
              </div>
            )}

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

            {/* Sub-tasks checklist */}
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

            {/* Activity log */}
            <div className="pt-4 space-y-1 text-[12px]" style={{ borderTop: "1px solid var(--line)", color: "var(--mute)" }}>
              <p>{t("detail.created")} {relativeTime(task.createdAt as unknown as string)}</p>
              <p>{t("detail.updated")} {relativeTime(task.updatedAt as unknown as string)}</p>
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
