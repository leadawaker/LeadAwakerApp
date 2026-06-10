import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, ChevronDown, ChevronRight } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { useTaskActivity } from "../api/tasksApi";
import type { TaskActivity } from "@shared/schema";

type ActivityUser = { id: number; fullName1: string | null; email: string | null; avatarUrl: string | null };

export function ActivitySection({ taskId, users = [] }: { taskId: number; users?: ActivityUser[] }) {
  const { t } = useTranslation("tasks");
  const { data: activity = [] } = useTaskActivity(taskId);
  const [expanded, setExpanded] = useState(false);

  function describe(entry: TaskActivity): string {
    const oldValue = entry.oldValue ?? t("activity.empty");
    const newValue = entry.newValue ?? t("activity.empty");
    switch (entry.action) {
      case "created":
        return t("activity.created");
      case "cloned":
        return t("activity.cloned");
      case "status_changed":
        return t("activity.statusChanged", { old: oldValue, new: newValue });
      case "priority_changed":
        return t("activity.priorityChanged", { old: oldValue, new: newValue });
      case "assignee_changed":
        return t("activity.assigneeChanged", { old: oldValue, new: newValue });
      case "due_date_changed":
        return t("activity.dueDateChanged", { old: oldValue, new: newValue });
      case "category_changed":
        return t("activity.categoryChanged", { old: oldValue, new: newValue });
      case "title_changed":
        return t("activity.titleChanged", { old: oldValue, new: newValue });
      default:
        return t("activity.changed", { field: entry.field ?? "" });
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 mb-2 group"
      >
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[12px] font-medium text-foreground/70 group-hover:text-foreground/90">
          {t("activity.title")} ({activity.length})
        </span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-3">
          {activity.map((entry) => {
            const name = entry.actorName ?? "?";
            const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
            const matchedUser = users.find((u) => u.fullName1 === name || u.email === name);
            const avatarUrl = matchedUser?.avatarUrl || "";
            return (
              <div key={entry.id} className="flex gap-2.5 text-[12px]">
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20 mt-0.5 overflow-hidden">
                  {avatarUrl
                    ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground/80 leading-relaxed">
                    <span className="font-medium text-foreground/90">{name}</span>{" "}
                    {describe(entry)}
                  </p>
                  <span className="text-muted-foreground text-[11px]">
                    {relativeTime(entry.createdAt as unknown as string)}
                  </span>
                </div>
              </div>
            );
          })}
          {activity.length === 0 && (
            <p className="text-[11px] text-muted-foreground">{t("activity.none")}</p>
          )}
        </div>
      )}
    </div>
  );
}
