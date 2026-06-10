import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthJob } from "../hooks/useAutomationLogs";

const STATUS_STYLES: Record<HealthJob["status"], { dot: string; badge: string; icon: React.ElementType }> = {
  healthy: {
    dot: "bg-emerald-500",
    badge: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800/50",
    icon: CheckCircle2,
  },
  overdue: {
    dot: "bg-amber-500",
    badge: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800/50",
    icon: AlertTriangle,
  },
  error: {
    dot: "bg-rose-500",
    badge: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50",
    icon: XCircle,
  },
};

function relativeTime(iso: string | null, t: (k: string, o?: any) => string): string {
  if (!iso) return t("automation:health.neverRun");
  const diffSec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diffSec < 60) return t("automation:time.justNow");
  if (diffSec < 3600) return t("automation:time.minutesAgo", { count: Math.floor(diffSec / 60) });
  if (diffSec < 86400) return t("automation:time.hoursAgo", { count: Math.floor(diffSec / 3600) });
  return t("automation:time.daysAgo", { count: Math.floor(diffSec / 86400) });
}

interface Props {
  job: HealthJob;
}

export function JobHealthCard({ job }: Props) {
  const { t } = useTranslation();
  const style = STATUS_STYLES[job.status];
  const Icon = style.icon;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
      {/* status dot */}
      <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", style.dot)} />

      {/* job name + cadence */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{job.name}</p>
        <p className="text-xs text-muted-foreground">{job.cadenceLabel}</p>
      </div>

      {/* last run */}
      <div className="hidden sm:flex flex-col items-end min-w-[120px]">
        <span className="text-xs text-muted-foreground">{t("automation:health.lastRun")}</span>
        <span className="text-xs font-medium text-foreground">{relativeTime(job.lastRunAt, t)}</span>
      </div>

      {/* next run */}
      <div className="hidden md:flex flex-col items-end min-w-[120px]">
        <span className="text-xs text-muted-foreground">{t("automation:health.nextRun")}</span>
        <span className="text-xs font-medium text-foreground">
          {job.nextRunAt ? relativeTime(job.nextRunAt, t) : "—"}
        </span>
      </div>

      {/* errors badge */}
      {job.errors24h > 0 && (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded border bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/50 flex-shrink-0">
          {job.errors24h}e
        </span>
      )}

      {/* status badge */}
      <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0", style.badge)}>
        <Icon className="w-3 h-3" />
        {t(`automation:health.status.${job.status}`)}
      </span>
    </div>
  );
}
