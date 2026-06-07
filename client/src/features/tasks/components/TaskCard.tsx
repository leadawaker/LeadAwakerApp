import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Calendar, ListChecks, Clock, User, ChevronDown, Copy, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import type { Task } from "@shared/schema";
import { useTheme } from "@/hooks/useTheme";
import { useUpdateTask, useDeleteTask, useCreateTask, useSubtaskCounts, useTaskCategories, useAccountUsers } from "../api/tasksApi";
import {
  PRIORITY_OPTIONS,
  PRIORITY_BADGE,
  type TaskStatus,
  type TaskPriority,
} from "../types";

const PRIORITY_I18N_KEY: Record<TaskPriority, string> = {
  low: "priority.low",
  medium: "priority.medium",
  high: "priority.high",
  urgent: "priority.urgent",
};

const STATUS_TITLE_COLOR: Record<TaskStatus, { light: string; dark: string }> = {
  todo:        { light: "#1a1a1a", dark: "#e5e5e5" },
  in_progress: { light: "#1a1a1a", dark: "#e5e5e5" },
  done:        { light: "#1a1a1a", dark: "#e5e5e5" },
  cancelled:   { light: "#1a1a1a", dark: "#e5e5e5" },
};

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
  selected?: boolean;
  onSelect?: (id: number) => void;
  onCardClick?: (id: number) => void;
}

export default function TaskCard({ task, selected, onSelect, onCardClick }: TaskCardProps) {
  const { t } = useTranslation("tasks");
  const { isDark } = useTheme();
  const priority = (task.priority ?? "medium") as TaskPriority;
  const status = (task.status ?? "todo") as TaskStatus;

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const createMutation = useCreateTask();
  const { data: subtaskCounts } = useSubtaskCounts();
  const { data: categories } = useTaskCategories();
  const { data: users = [] } = useAccountUsers();

  const category = useMemo(() => {
    if (!task.categoryId || !categories) return null;
    return categories.find((c) => c.id === task.categoryId) ?? null;
  }, [task.categoryId, categories]);

  const subtaskCount = useMemo(() => subtaskCounts?.find((c) => c.taskId === task.id), [subtaskCounts, task.id]);

  const saveField = (field: string, value: unknown) => {
    updateMutation.mutate({ id: task.id, data: { [field]: value } });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate(task.id);
  };

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

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    status !== "done" &&
    status !== "cancelled";

  const dueDateStr = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  const titleColor = STATUS_TITLE_COLOR[status]?.[isDark ? "dark" : "light"];

  const assigneeInitials = task.assigneeName
    ? task.assigneeName.split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
    : null;

  return (
    <div
      className={cn(
        "group/card relative rounded-2xl",
        "p-[14px] flex flex-col gap-2",
        "border transition-colors duration-150",
        CARD_BG[status],
        CARD_BORDER[status],
        selected && "ring-2 ring-brand-indigo",
        onCardClick && "cursor-pointer"
      )}
      onClick={onCardClick ? () => onCardClick(task.id) : undefined}
    >
      {/* Row 1: checkbox + title + ID (hover) + priority bars */}
      <div className="flex items-start gap-1.5 min-w-0">
        {/* Bulk checkbox — always visible */}
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={() => onSelect?.(task.id)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 shrink-0 mt-1 accent-brand-indigo cursor-pointer"
        />

        {/* Title */}
        <div className="flex-1 min-w-0 flex items-start gap-1.5">
          <p
            className="text-[15px] font-semibold leading-snug select-none flex-1 min-w-0"
            style={{ color: titleColor }}
          >
            {(task as any).emoji && <span className="mr-1">{(task as any).emoji}</span>}
            {task.title || t("card.newTask")}
          </p>
          {/* Task ID — fades in on hover */}
          <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0 mt-[3px] opacity-0 group-hover/card:opacity-100 transition-opacity">
            #{task.id}
          </span>
        </div>

        {/* Priority signal bars */}
        <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); setPriorityOpen(true); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="shrink-0 mt-0.5 hover:opacity-70 transition-opacity cursor-pointer"
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
                  onClick={(e) => { e.stopPropagation(); saveField("priority", o.value); setPriorityOpen(false); }}
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
      </div>

      {/* Bottom row: assignee · category · time estimate · subtasks · date */}
      <div className="flex items-center gap-1 min-w-0 flex-wrap">

        {/* Assignee avatar + name — popover to assign */}
        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); setAssigneeOpen(true); }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-medium shrink-0 transition-opacity",
                task.assigneeName
                  ? "bg-muted text-muted-foreground hover:bg-foreground/10"
                  : "bg-transparent text-muted-foreground/30 opacity-0 group-hover/card:opacity-100"
              )}
            >
              {assigneeInitials ? (
                <span className="h-3.5 w-3.5 rounded-full flex items-center justify-center text-[7px] font-bold bg-brand-indigo/15 text-brand-indigo border border-brand-indigo/25 shrink-0">
                  {assigneeInitials}
                </span>
              ) : (
                <User className="h-2.5 w-2.5 shrink-0" />
              )}
              {task.assigneeName ?? "Assign"}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-48 p-1 bg-white dark:bg-popover rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-md"
            side="bottom"
            align="start"
            sideOffset={4}
          >
            <button
              onClick={(e) => { e.stopPropagation(); saveField("assigneeName", null); setAssigneeOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors",
                !task.assigneeName ? "bg-muted font-medium" : "hover:bg-muted/50"
              )}
            >
              <User className="h-3 w-3 text-muted-foreground" />
              Unassigned
            </button>
            {users.map((u) => {
              const name = u.fullName1 || u.email || "";
              if (!name) return null;
              const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
              return (
                <button
                  key={u.id}
                  onClick={(e) => { e.stopPropagation(); saveField("assigneeName", name); setAssigneeOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors",
                    task.assigneeName === name ? "bg-muted font-medium" : "hover:bg-muted/50"
                  )}
                >
                  <span className="h-4 w-4 rounded-full flex items-center justify-center text-[7px] font-bold bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20 shrink-0">
                    {initials}
                  </span>
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        {/* Category badge */}
        {category && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-medium shrink-0 bg-foreground/[0.05] text-muted-foreground"
          >
            {category.color && (
              <span className="inline-block h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: category.color }} />
            )}
            {category.icon && <span className="text-[10px]">{category.icon}</span>}
            {category.name}
          </span>
        )}

        {/* Time estimate */}
        {(task as any).timeEstimate != null && (task as any).timeEstimate > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-[1px] text-[10px] font-medium shrink-0 bg-foreground/[0.05] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {(() => {
              const mins = (task as any).timeEstimate as number;
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              if (h > 0 && m > 0) return `${h}h ${m}m`;
              if (h > 0) return `${h}h`;
              return `${m}m`;
            })()}
          </span>
        )}

        {/* Subtask count */}
        {subtaskCount && subtaskCount.total > 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-medium shrink-0",
              subtaskCount.completed === subtaskCount.total
                ? "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-foreground/[0.05] text-muted-foreground"
            )}
          >
            <ListChecks className="h-3 w-3" />
            {subtaskCount.completed}/{subtaskCount.total}
          </span>
        )}

        {/* Spacer + Date */}
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); }}
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
      </div>

      {/* Clone / Delete bar — visible when selected */}
      {selected && (
        <div
          className="flex items-center gap-2 pt-1.5 mt-0.5 border-t border-border/20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleDuplicate}
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-foreground/[0.06] transition-colors"
          >
            <Copy className="h-3 w-3" />
            Clone
          </button>
          <button
            onClick={handleDelete}
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 px-2 py-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
