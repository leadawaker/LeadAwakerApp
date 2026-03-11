import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Calendar, Trash2, Copy, Plus, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import type { Task } from "@shared/schema";
import { useTheme } from "@/hooks/useTheme";
import { useUpdateTask, useDeleteTask, useCreateTask } from "../api/tasksApi";
import {
  PRIORITY_OPTIONS,
  PRIORITY_BADGE,
  TASK_TAG_PRESETS,
  TAG_COLORS,
  TAG_COLORS_DARK,
  parseTags,
  type TaskStatus,
  type TaskPriority,
} from "../types";

// ── Data-as-labels: priority i18n keys ──────────────────────────────
const PRIORITY_I18N_KEY: Record<TaskPriority, string> = {
  low: "priority.low",
  medium: "priority.medium",
  high: "priority.high",
  urgent: "priority.urgent",
};

// ── Status-based title colors ────────────────────────────────────────
const STATUS_TITLE_COLOR: Record<TaskStatus, { light: string; dark: string }> = {
  todo:        { light: "#1a1a1a", dark: "#e5e5e5" },
  in_progress: { light: "#2563EB", dark: "#60A5FA" },
  done:        { light: "#16A34A", dark: "#4ADE80" },
  cancelled:   { light: "#9CA3AF", dark: "#6B7280" },
};

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  const { t } = useTranslation("tasks");
  const { isDark } = useTheme();
  const priority = (task.priority ?? "medium") as TaskPriority;
  const status = (task.status ?? "todo") as TaskStatus;
  const pBadge = PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.medium;
  const tags = parseTags((task as any).tags);

  // ── Edit state ──────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(task.title ?? "");
  const [editDescription, setEditDescription] = useState(
    task.description ?? ""
  );
  const [editDueDate, setEditDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
  );
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const createMutation = useCreateTask();
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  // Sync from task prop when not editing
  useEffect(() => {
    if (editingField !== "title") setEditTitle(task.title ?? "");
    if (editingField !== "description")
      setEditDescription(task.description ?? "");
    if (editingField !== "dueDate")
      setEditDueDate(
        task.dueDate
          ? new Date(task.dueDate).toISOString().slice(0, 10)
          : ""
      );
  }, [task, editingField]);

  // Auto-focus on edit
  useEffect(() => {
    if (editingField === "title")
      setTimeout(() => titleRef.current?.focus(), 30);
    if (editingField === "description")
      setTimeout(() => descRef.current?.focus(), 30);
    if (editingField === "dueDate")
      setTimeout(() => {
        dateRef.current?.showPicker?.();
        dateRef.current?.focus();
      }, 30);
  }, [editingField]);

  // ── Save helpers (auto-save on blur) ────────────────────────────────
  const saveField = (field: string, value: unknown) => {
    updateMutation.mutate({ id: task.id, data: { [field]: value } });
  };

  const handleTitleBlur = () => {
    setEditingField(null);
    const trimmed = editTitle.trim() || t("card.newTask");
    if (trimmed !== (task.title ?? "")) saveField("title", trimmed);
  };

  const handleDescBlur = () => {
    setEditingField(null);
    const val = editDescription.trim() || null;
    if (val !== (task.description ?? null)) saveField("description", val);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditDueDate(val);
    saveField("dueDate", val ? new Date(val) : null);
    setEditingField(null);
  };

  const handlePriorityChange = (p: string) => {
    saveField("priority", p);
    setPriorityOpen(false);
  };

  const toggleTag = (tag: string) => {
    const current = parseTags((task as any).tags);
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    saveField("tags", next.length > 0 ? JSON.stringify(next) : null);
  };

  // Double-click delete: first click arms, second click confirms
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteArmed) {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      deleteMutation.mutate(task.id);
      setDeleteArmed(false);
    } else {
      setDeleteArmed(true);
      deleteTimer.current = setTimeout(() => setDeleteArmed(false), 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    };
  }, []);

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    createMutation.mutate({
      title: (task.title ?? t("card.newTask")) + " " + t("card.copy"),
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

  // Prevent DnD when interacting with editable areas
  const stopDnd = (e: React.PointerEvent) => e.stopPropagation();

  // ── Derived data ────────────────────────────────────────────────────
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    status !== "done" &&
    status !== "cancelled";

  const dueDateStr = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const createdStr = task.createdAt
    ? new Date(task.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const assigneeInitials = task.assigneeName
    ? task.assigneeName
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  const colorMap = isDark ? TAG_COLORS_DARK : TAG_COLORS;
  const fallbackTag = {
    bg: isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9",
    text: isDark ? "#94A3B8" : "#475569",
  };

  // Status-based title color
  const titleColor = STATUS_TITLE_COLOR[status]?.[isDark ? "dark" : "light"];

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "group/card relative rounded-2xl cursor-grab",
        "p-[17px] flex flex-col gap-2.5",
        "bg-popover dark:bg-[hsl(220,15%,14%)]",
        "hover:bg-white dark:hover:bg-[hsl(220,15%,16%)]",
        "transition-colors duration-150"
      )}
    >
      {/* Row 1: Title + Trash (hover) + Priority pill */}
      <div className="flex items-start gap-1 min-w-0">
        <div className="flex-1 min-w-0" onPointerDown={stopDnd}>
          {editingField === "title" ? (
            <input
              ref={titleRef}
              className="w-full bg-transparent text-[16px] font-semibold outline-none"
              style={{ color: titleColor }}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleBlur();
                if (e.key === "Escape") {
                  setEditTitle(task.title ?? "");
                  setEditingField(null);
                }
              }}
            />
          ) : (
            <p
              onClick={() => setEditingField("title")}
              className="text-[16px] font-semibold leading-snug cursor-text truncate"
              style={{
                color: task.title && task.title !== "New Task"
                  ? titleColor
                  : undefined,
              }}
            >
              {task.title || t("card.newTask")}
            </p>
          )}
        </div>

        {/* Delete — hover-visible, double-click to confirm */}
        <button
          onClick={handleDelete}
          onPointerDown={stopDnd}
          className={cn(
            "shrink-0 p-1 rounded-md transition-all duration-150",
            deleteArmed
              ? "opacity-100 text-red-500 bg-red-50 dark:bg-red-500/10"
              : "opacity-0 group-hover/card:opacity-100 text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          )}
          title={deleteArmed ? t("card.clickAgainToDelete") : t("detail.delete")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {/* Duplicate */}
        <button
          onClick={handleDuplicate}
          onPointerDown={stopDnd}
          className="shrink-0 p-1 rounded-md opacity-0 group-hover/card:opacity-100 text-muted-foreground/30 hover:text-brand-indigo hover:bg-brand-indigo/5 dark:hover:bg-brand-indigo/10 transition-all duration-150"
          title={t("card.duplicate")}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>

        {/* Priority — clickable popover */}
        <div className="shrink-0" onPointerDown={stopDnd}>
          <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
            <PopoverTrigger asChild>
              <button
                className="inline-flex items-center gap-0.5 rounded-full px-2.5 py-[4px] text-[13px] font-semibold capitalize cursor-pointer hover:opacity-80 transition-opacity duration-150"
                style={{
                  backgroundColor: isDark ? pBadge.bgDark : pBadge.bg,
                  color: isDark ? pBadge.textDark : pBadge.text,
                }}
              >
                {t(PRIORITY_I18N_KEY[priority] ?? "priority.medium")}
                <ChevronDown className="h-2.5 w-2.5 opacity-0 group-hover/card:opacity-60 transition-opacity duration-150" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={4}
              className="w-auto p-1.5 bg-white dark:bg-popover rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-md"
            >
              {PRIORITY_OPTIONS.map((o) => {
                const b = PRIORITY_BADGE[o.value];
                return (
                  <button
                    key={o.value}
                    onClick={() => handlePriorityChange(o.value)}
                    className={cn(
                      "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150",
                      priority === o.value
                        ? "bg-muted"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: isDark ? b.textDark : b.text,
                      }}
                    />
                    {t(PRIORITY_I18N_KEY[o.value])}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Description — click to edit */}
      <div onPointerDown={stopDnd}>
        {editingField === "description" ? (
          <textarea
            ref={descRef}
            className="w-full bg-transparent text-[15px] text-foreground outline-none resize-none min-h-[40px] leading-relaxed"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onBlur={handleDescBlur}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditDescription(task.description ?? "");
                setEditingField(null);
              }
            }}
          />
        ) : (
          <p
            onClick={() => setEditingField("description")}
            className={cn(
              "text-[15px] leading-relaxed cursor-text",
              task.description
                ? "text-muted-foreground line-clamp-2"
                : "text-muted-foreground/35 italic"
            )}
          >
            {task.description || t("fields.addDescription")}
          </p>
        )}
      </div>

      {/* Row 3: Tags + Due date (same line) */}
      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
        <div
          className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0"
          onPointerDown={stopDnd}
        >
          {tags.map((tag) => {
            const c = colorMap[tag] ?? fallbackTag;
            return (
              <span
                key={tag}
                onClick={() => setTagPickerOpen(true)}
                className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[13px] font-medium cursor-pointer hover:opacity-80 transition-opacity duration-150"
                style={{ backgroundColor: c.bg, color: c.text }}
              >
                {tag}
              </span>
            );
          })}

          <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center justify-center h-6 w-6 rounded-full transition-all duration-150",
                  "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted",
                  tags.length === 0
                    ? "opacity-0 group-hover/card:opacity-100"
                    : ""
                )}
              >
                <Plus className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={4}
              className="w-[240px] p-2.5 bg-white dark:bg-popover rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-md"
            >
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {t("fields.tags")}
              </p>
              <div className="flex flex-wrap gap-1">
                {TASK_TAG_PRESETS.map((tag) => {
                  const isSelected = tags.includes(tag);
                  const c = colorMap[tag] ?? fallbackTag;
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-medium transition-opacity duration-150",
                        isSelected
                          ? "ring-1 ring-brand-indigo/40"
                          : "opacity-50 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c.bg, color: c.text }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Dates: created → due */}
        <div className="shrink-0 flex items-center gap-1" onPointerDown={stopDnd}>
          {createdStr && (
            <span className="text-[13px] text-muted-foreground/40 font-medium tabular-nums">
              {createdStr}
            </span>
          )}
          {(createdStr && (dueDateStr || editingField === "dueDate")) && (
            <span className="text-[13px] text-muted-foreground/25">→</span>
          )}
          {editingField === "dueDate" ? (
            <input
              ref={dateRef}
              type="date"
              className="h-6 w-[120px] text-[13px] bg-transparent outline-none text-foreground"
              value={editDueDate}
              onChange={handleDateChange}
              onBlur={() => setEditingField(null)}
            />
          ) : (
            <button
              onClick={() => setEditingField("dueDate")}
              className={cn(
                "inline-flex items-center gap-1 text-[13px] cursor-pointer transition-opacity duration-150",
                isOverdue
                  ? "text-red-500 font-semibold"
                  : dueDateStr
                    ? "text-muted-foreground/60 hover:text-foreground"
                    : "text-muted-foreground/25 opacity-0 group-hover/card:opacity-100"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              {dueDateStr || t("fields.due")}
            </button>
          )}
        </div>
      </div>

      {/* Row 4: Account · Assignee */}
      {(task.accountName || assigneeInitials) && (
        <div className="flex items-center gap-2 mt-0.5 min-w-0">
          {task.accountName && (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium truncate max-w-[120px]"
              style={{
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
                color: isDark
                  ? "rgba(255,255,255,0.5)"
                  : "rgba(0,0,0,0.45)",
              }}
            >
              {task.accountName}
            </span>
          )}

          {assigneeInitials && (
            <span
              className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 bg-muted text-muted-foreground"
              title={task.assigneeName ?? ""}
            >
              {assigneeInitials}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
