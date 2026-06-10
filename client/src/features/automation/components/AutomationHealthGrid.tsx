import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobHealthCard } from "./JobHealthCard";
import type { AutomationHealthResponse } from "../hooks/useAutomationLogs";

interface Props {
  data: AutomationHealthResponse;
}

export function AutomationHealthGrid({ data }: Props) {
  const { t } = useTranslation();
  const hasIssues = !data.engineHealthy || data.jobs.some(j => j.status !== "healthy");

  return (
    <div className="space-y-3">
      {/* Attention strip */}
      {!data.engineHealthy && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-400">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">{t("automation:health.engineDown")}</span>
        </div>
      )}
      {data.engineHealthy && hasIssues && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">
            {t("automation:health.attentionRequired", {
              count: data.jobs.filter(j => j.status !== "healthy").length,
            })}
          </span>
        </div>
      )}

      {/* Job rows */}
      <div className="space-y-1.5">
        {data.jobs.map(job => (
          <JobHealthCard key={job.id} job={job} />
        ))}
      </div>

      {/* Footer timestamp */}
      <p className="text-xs text-muted-foreground text-right px-1">
        {t("automation:health.generatedAt", {
          time: new Date(data.generatedAt).toLocaleTimeString(),
        })}
      </p>
    </div>
  );
}
