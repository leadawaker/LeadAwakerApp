import { Calendar } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { Task } from "@shared/schema";
import { PRIORITY_BADGE, type TaskPriority, type TaskStatus } from "../types";

// ── Status badge colors ───────────────────────────────────────────────
const STATUS_BADGE: Record<TaskStatus, { bg: string; text: string; dot: string }> = {
  todo:        { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8" },
  in_progress: { bg: "#EFF6FF", text: "#2563EB", dot: "#3B82F6" },
  done:        { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
  cancelled:   { bg: "#F9FAFB", text: "#9CA3AF", dot: "#D1D5DB" },
};

const STATUS_BADGE_DARK: Record<TaskStatus, { bg: string; text: string; dot: string }> = {
  todo:        { bg: "rgba(100,116,139,0.12)", text: "#94A3B8", dot: "#94A3B8" },
  in_progress: { bg: "rgba(59,130,246,0.12)",  text: "#93C5FD", dot: "#60A5FA" },
  done:        { bg: "rgba(34,197,94,0.12)",   text: "#86EFAC", dot: "#4ADE80" },
  cancelled:   { bg: "rgba(156,163,175,0.12)", text: "#6B7280", dot: "#9CA3AF" },
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

interface Props {
  task: Task;
  onClick: () => void;
}

export default function MobileTaskListCard({ task, onClick }: Props) {
  const { isDark } = useTheme();
  const priority = (task.priority ?? "medium") as TaskPriority;
  const status = (task.status ?? "todo") as TaskStatus;
  const pBadge = PRIORITY_BADGE[priority] ?? PRIORITY_BADGE.medium;
  const sBadge = (isDark ? STATUS_BADGE_DARK : STATUS_BADGE)[status] ?? STATUS_BADGE.todo;

  const assigneeInitials = task.assigneeName
    ? task.assigneeName
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

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

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card rounded-2xl px-4 py-3.5 min-h-[56px] flex flex-col gap-2.5 active:scale-[0.98] transition-transform duration-100 border border-border/20 shadow-sm"
      data-testid="mobile-task-card"
    >
      {/* Row 1: Title + Assignee avatar */}
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[15px] font-semibold leading-snug text-foreground">
          {task.title || "New Task"}
        </p>
        {assigneeInitials && (
          <span
            className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20 mt-0.5"
            title={task.assigneeName ?? ""}
          >
            {assigneeInitials}
          </span>
        )}
      </div>

      {/* Row 2: Status badge + Priority badge + Due date */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Status badge */}
        <span
          className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[11px] font-medium"
          style={{ backgroundColor: sBadge.bg, color: sBadge.text }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: sBadge.dot }}
          />
          {STATUS_LABELS[status]}
        </span>

        {/* Priority badge */}
        <span
          className="inline-flex items-center px-2 py-[3px] rounded-full text-[11px] font-semibold capitalize"
          style={{
            backgroundColor: isDark ? pBadge.bgDark : pBadge.bg,
            color: isDark ? pBadge.textDark : pBadge.text,
          }}
        >
          {PRIORITY_LABELS[priority]}
        </span>

        {/* Due date */}
        {dueDateStr && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
              isOverdue ? "text-red-500" : "text-muted-foreground/60"
            }`}
          >
            <Calendar className="h-3 w-3" />
            {dueDateStr}
          </span>
        )}
      </div>
    </button>
  );
}
