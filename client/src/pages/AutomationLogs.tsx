import React from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useAutomationHealth } from "@/features/automation/hooks/useAutomationLogs";
import { AutomationHealthGrid } from "@/features/automation/components/AutomationHealthGrid";
import { RefreshCw } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { cn } from "@/lib/utils";

// ── Skeleton ─────────────────────────────────────────────────────────────────
function HealthSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-[60px] bg-card/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AutomationLogsPage() {
  const { t } = useTranslation("automation");
  const healthQuery = useAutomationHealth();

  const error = healthQuery.error as Error | null;

  return (
    <CrmShell>
      <div className="pt-4 px-4 pb-8 max-w-3xl" data-testid="page-automation-logs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-lg font-semibold text-foreground">{t("health.pageTitle")}</h1>
          <IconBtn
            onClick={() => healthQuery.refetch()}
            title={t("toolbar.refreshLogs")}
          >
            <RefreshCw className={cn("w-4 h-4", healthQuery.isFetching && "animate-spin")} />
          </IconBtn>
        </div>

        {error ? (
          <ApiErrorFallback error={error} onRetry={() => healthQuery.refetch()} />
        ) : healthQuery.isLoading ? (
          <HealthSkeleton />
        ) : healthQuery.data ? (
          <AutomationHealthGrid data={healthQuery.data} />
        ) : null}
      </div>
    </CrmShell>
  );
}
