import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { automationLogs } from "@/data/mocks";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function AutomationLogsPage() {
  const { currentAccountId } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");

  const rows = useMemo(() => {
    return automationLogs
      .filter((r) => r.account_id === currentAccountId)
      .filter((r) => (campaignId === "all" ? true : r.campaign_id === campaignId))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [currentAccountId, campaignId]);

  return (
    <CrmShell>
      <div className="py-6" data-testid="page-automation-logs">
        <div className="flex items-center gap-4 mb-6">
          <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden" data-testid="table-logs">
          <div className="grid grid-cols-[120px_1fr_140px_160px_200px] gap-0 text-xs font-semibold text-muted-foreground bg-muted/20 border-b border-border px-4 py-3">
            <div>lead_id</div>
            <div>status / error_message</div>
            <div>execution_ms</div>
            <div>stage</div>
            <div>created_at</div>
          </div>
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[120px_1fr_140px_160px_200px] gap-0 px-4 py-3 text-sm"
                data-testid={`row-log-${r.id}`}
              >
                <div data-testid={`text-log-lead-${r.id}`}>{r.lead_id}</div>
                <div className="min-w-0">
                  <div className="font-semibold" data-testid={`text-log-status-${r.id}`}>{r.status}</div>
                  <div className="text-xs text-muted-foreground truncate" data-testid={`text-log-error-${r.id}`}>{r.error_message || "—"}</div>
                </div>
                <div className="text-muted-foreground" data-testid={`text-log-ms-${r.id}`}>{r.execution_time_ms}</div>
                <div className="text-muted-foreground" data-testid={`text-log-stage-${r.id}`}>{r.stage}</div>
                <div className="text-muted-foreground" data-testid={`text-log-at-${r.id}`}>{new Date(r.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </CrmShell>
  );
}
