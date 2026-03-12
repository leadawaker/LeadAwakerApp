import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Calendar, Trash2, Copy, Plus, Minus, ListChecks } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import type { Task } from "@shared/schema";
import { useTheme } from "@/hooks/useTheme";
import { useUpdateTask, useDeleteTask, useCreateTask, useSubtaskCounts, useTaskCategories } from "../api/tasksApi";
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
  in_progress: { light: "#1a1a1a", dark: "#e5e5e5" },
  done:        { light: "#1a1a1a", dark: "#e5e5e5" },
  cancelled:   { light: "#1a1a1a", dark: "#e5e5e5" },
};

// ── Status-based card bg (Tailwind classes) ──────────────────────────
const CARD_BG: Record<TaskStatus, string> = {
  todo:        "bg-white dark:bg-[hsl(220,15%,14%)] hover:bg-white dark:hover:bg-[hsl(220,15%,16%)]",
  in_progress: "bg-white dark:bg-[hsl(220,15%,14%)] hover:bg-white dark:hover:bg-[hsl(220,15%,16%)]",
  done:        "bg-white dark:bg-[hsl(220,15%,14%)] hover:bg-white dark:hover:bg-[hsl(220,15%,16%)]",
  cancelled:   "bg-white dark:bg-[hsl(220,15%,14%)] hover:bg-white dark:hover:bg-[hsl(220,15%,16%)]",
};

const CARD_BORDER: Record<TaskStatus, string> = {
  todo:        "border-border/30",
  in_progress: "border-blue-200/60 dark:border-blue-800/30",
  done:        "border-emerald-200/60 dark:border-emerald-800/30",
  cancelled:   "border-border/30",
};

// ── Priority signal bars ─────────────────────────────────────────────
const SIGNAL_FILLED: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
const SIGNAL_COLOR: Record<TaskPriority, string> = {
  low:    "#9CA3AF",
  medium: "#F59E0B",
  high:   "#F97316",
  urgent: "#EF4444",
};

function SignalBars({ priority }: { priority: TaskPriority }) {
  const filled = SIGNAL_FILLED[priority];
  const color = SIGNAL_COLOR[priority];
  return (
    <div className="flex items-end gap-[2px]">
      {[5, 8, 11, 14].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{
            height: `${h}px`,
            backgroundColor: i < filled ? color : "#D1D5DB",
          }}
        />
      ))}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  const { t } = useTranslation("tasks");
  const { isDark } = useTheme();
  const priority = (task.priority ?? "medium") as TaskPriority;
  const status = (task.status ?? "todo") as TaskStatus;
  const tags = parseTags((task as any).tags);

  // ── Pin (keep description visible even when not hovering) ────────────
  const [expanded, setExpanded] = useState(false);

  // ── Edit state ──────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(task.title ?? "");
  const [editDescription, setEditDescription] = useState(task.description ?? "");
  const [editDueDate, setEditDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
  );
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const createMutation = useCreateTask();
  const { data: subtaskCounts } = useSubtaskCounts();
  const { data: categories } = useTaskCategories();

  // Category color accent
  const categoryColor = useMemo(() => {
    if (!task.categoryId || !categories) return null;
    const cat = categories.find((c) => c.id === task.categoryId);
    return cat?.color ?? null;
  }, [task.categoryId, categories]);
  const subtaskCount = useMemo(() => subtaskCounts?.find((c) => c.taskId === task.id), [subtaskCounts, task.id]);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  // Sync from task prop when not editing
  useEffect(() => {
    if (editingField !== "title") setEditTitle(task.title ?? "");
    if (editingField !== "description") setEditDescription(task.description ?? "");
    if (editingField !== "dueDate")
      setEditDueDate(
        task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
      );
  }, [task, editingField]);

  // Auto-focus on edit
  useEffect(() => {
    if (editingField === "title") setTimeout(() => titleRef.current?.focus(), 30);
    if (editingField === "description") setTimeout(() => descRef.current?.focus(), 30);
    if (editingField === "dueDate")
      setTimeout(() => {
        dateRef.current?.showPicker?.();
        dateRef.current?.focus();
      }, 30);
  }, [editingField]);

  // ── Save helpers ────────────────────────────────────────────────────
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

  // Double-click delete
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
    return () => { if (deleteTimer.current) clearTimeout(deleteTimer.current); };
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

  // ── Derived data ────────────────────────────────────────────────────
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    status !== "done" &&
    status !== "cancelled";

  const dueDateStr = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  const colorMap = isDark ? TAG_COLORS_DARK : TAG_COLORS;
  const fallbackTag = {
    bg: isDark ? "rgba(100,116,139,0.15)" : "#F1F5F9",
    text: isDark ? "#94A3B8" : "#475569",
  };

  const titleColor = STATUS_TITLE_COLOR[status]?.[isDark ? "dark" : "light"];

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "group/card relative rounded-2xl",
        "p-[14px] flex flex-col gap-2",
        "border transition-colors duration-150",
        CARD_BG[status],
        CARD_BORDER[status],
      )}
      style={categoryColor ? { borderLeftWidth: "3px", borderLeftColor: categoryColor } : undefined}
    >
      {/* Row 1: title + priority bars + action buttons */}
      <div className="flex items-start gap-1 min-w-0">
        {/* Title */}
        <div className="flex-1 min-w-0">
          {editingField === "title" ? (
            <input
              ref={titleRef}
              className="w-full bg-transparent text-[15px] font-semibold outline-none cursor-text"
              style={{ color: titleColor }}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleBlur();
                if (e.key === "Escape") { setEditTitle(task.title ?? ""); setEditingField(null); }
              }}
            />
          ) : (
            <p
              onClick={() => setEditingField("title")}
              className="text-[15px] font-semibold leading-snug cursor-text select-none"
              style={{ color: titleColor }}
            >
              {(task as any).emoji && <span className="mr-1" data-testid="task-emoji">{(task as any).emoji}</span>}
              {task.title || t("card.newTask")}
            </p>
          )}
        </div>

        {/* Priority signal bars — always visible */}
        <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
          <PopoverTrigger asChild>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              className="shrink-0 mt-0.5 hover:opacity-70 transition-opacity duration-150 cursor-pointer"
              title={t(PRIORITY_I18N_KEY[priority] ?? "priority.medium")}
            >
              <SignalBars priority={priority} />
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
                    priority === o.value ? "bg-muted" : "hover:bg-muted/50"
                  )}
                >
                  <SignalBars priority={o.value as TaskPriority} />
                  <span style={{ color: isDark ? b.textDark : b.text }}>
                    {t(PRIORITY_I18N_KEY[o.value])}
                  </span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        {/* Pin description */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "shrink-0 h-5 w-5 rounded-full border flex items-center justify-center transition-all duration-150",
            expanded
              ? "border-brand-indigo/50 text-brand-indigo bg-brand-indigo/8 opacity-100"
              : "border-border/40 text-muted-foreground/40 opacity-0 group-hover/card:opacity-100 hover:border-brand-indigo/40 hover:text-brand-indigo"
          )}
          title={expanded ? "Unpin description" : "Pin description"}
        >
          {expanded ? <Minus className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          onPointerDown={(e) => e.stopPropagation()}
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
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0 p-1 rounded-md opacity-0 group-hover/card:opacity-100 text-muted-foreground/30 hover:text-brand-indigo hover:bg-brand-indigo/5 dark:hover:bg-brand-indigo/10 transition-all duration-150"
          title={t("card.duplicate")}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Description — expands on hover OR when pinned */}
      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-200 ease-in-out",
          expanded ? "max-h-40" : "max-h-0 group-hover/card:max-h-40"
        )}
      >
        {editingField === "description" ? (
          <textarea
            ref={descRef}
            className="w-full bg-transparent text-[13px] text-foreground outline-none resize-none min-h-[40px] leading-relaxed cursor-text"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onBlur={handleDescBlur}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setEditDescription(task.description ?? ""); setEditingField(null); }
            }}
          />
        ) : (
          <p
            onClick={() => setEditingField("description")}
            className={cn(
              "text-[13px] leading-relaxed cursor-text",
              task.description ? "text-muted-foreground" : "text-muted-foreground/35 italic"
            )}
          >
            {task.description || t("fields.addDescription")}
          </p>
        )}
      </div>

      {/* Bottom row: tags · date */}
      <div className="flex items-center gap-1 min-w-0 flex-wrap">
        {/* Tags */}
        {tags.map((tag) => {
          const c = colorMap[tag] ?? fallbackTag;
          return (
            <span
              key={tag}
              onClick={() => setTagPickerOpen(true)}
              className="inline-flex items-center rounded-full px-1.5 py-[1px] text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity duration-150 shrink-0"
              style={{ backgroundColor: c.bg, color: c.text }}
            >
              {tag}
            </span>
          );
        })}

        {/* Add tag */}
        <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center justify-center h-4 w-4 rounded-full transition-all duration-150",
                "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted",
                tags.length === 0 ? "opacity-0 group-hover/card:opacity-100" : ""
              )}
            >
              <Plus className="h-2 w-2" />
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
                      isSelected ? "ring-1 ring-brand-indigo/40" : "opacity-50 hover:opacity-100"
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

        {/* Subtask progress indicator */}
        {subtaskCount && subtaskCount.total > 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-medium shrink-0",
              subtaskCount.completed === subtaskCount.total
                ? "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-foreground/[0.05] text-muted-foreground"
            )}
            data-testid="subtask-progress"
          >
            <ListChecks className="h-3 w-3" />
            {subtaskCount.completed}/{subtaskCount.total}
          </span>
        )}

        {/* Date — pushed to end */}
        <div className="flex-1" />
        {editingField === "dueDate" ? (
          <input
            ref={dateRef}
            type="date"
            className="h-5 w-[120px] text-[11px] bg-transparent outline-none text-foreground cursor-text"
            value={editDueDate}
            onChange={handleDateChange}
            onBlur={() => setEditingField(null)}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={() => setEditingField("dueDate")}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] cursor-pointer transition-opacity duration-150 shrink-0",
              isOverdue
                ? "text-red-500 font-semibold"
                : dueDateStr
                  ? "text-muted-foreground/60 hover:text-foreground"
                  : "text-muted-foreground/25 opacity-0 group-hover/card:opacity-100"
            )}
          >
            <Calendar className="h-3 w-3" />
            {dueDateStr || t("fields.due")}
          </button>
        )}
      </div>

      {/* Account · Assignee — only when pinned */}
      {expanded && (task.accountName || task.assigneeName) && (
        <div className="flex items-center gap-2 mt-0.5 min-w-0">
          {task.accountName && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium truncate max-w-[120px]"
              style={{
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
              }}
            >
              {task.accountName}
            </span>
          )}
          {task.assigneeName && (
            <span
              className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-muted text-muted-foreground"
              title={task.assigneeName}
            >
              {task.assigneeName.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
