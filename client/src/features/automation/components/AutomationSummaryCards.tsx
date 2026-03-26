import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { AutomationSummary } from "../hooks/useAutomationLogs";

function formatDurationMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeTime(dateStr: string | null, t: (key: string, opts?: any) => string): string {
  if (!dateStr) return t("summary.neverRun");
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });
  return t("time.daysAgo", { count: Math.floor(hours / 24) });
}

interface Props {
  summary: AutomationSummary | undefined;
  isLoading: boolean;
}

export function AutomationSummaryCards({ summary, isLoading }: Props) {
  const { t } = useTranslation("automation");

  if (isLoading || !summary) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-7 w-16 rounded-full bg-foreground/5 animate-pulse shrink-0" />
        ))}
      </>
    );
  }

  const rate = summary.successRate != null ? Number(summary.successRate) : null;
  const rateColor = rate == null ? "text-muted-foreground" : rate >= 95 ? "text-emerald-600" : rate >= 80 ? "text-amber-600" : "text-rose-600";
  const errorsColor = (summary.errors_today ?? 0) > 0 ? "text-rose-600" : "text-muted-foreground";
  const lastRunMs = summary.last_run_at ? Date.now() - new Date(summary.last_run_at).getTime() : null;
  const lastRunColor = lastRunMs != null && lastRunMs > 10 * 60_000 ? "text-rose-600" : "text-muted-foreground";

  const pills = [
    { label: t("summary.successRate"), value: rate != null ? `${rate.toFixed(0)}%` : "—", color: rateColor },
    { label: t("summary.errorsToday"), value: String(summary.errors_today ?? 0), color: errorsColor },
    { label: t("summary.avgDuration"), value: formatDurationMs(summary.avg_execution_time_ms), color: "text-muted-foreground" },
    { label: t("summary.lastRun"), value: formatRelativeTime(summary.last_run_at, t), color: lastRunColor },
  ];

  return (
    <>
      {pills.map((pill) => (
        <div
          key={pill.label}
          className="hidden md:flex items-center gap-1.5 h-7 px-2 rounded-full bg-foreground/[0.04] shrink-0"
        >
          <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            {pill.label}
          </span>
          <span className={cn("text-[12px] font-semibold tabular-nums", pill.color)}>
            {pill.value}
          </span>
        </div>
      ))}
    </>
  );
}
