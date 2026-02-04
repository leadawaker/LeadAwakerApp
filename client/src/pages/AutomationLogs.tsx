import { useMemo, useState } from "react";
import { Link } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { automationLogs, leads, accounts, campaigns } from "@/data/mocks";
import { useWorkspace } from "@/hooks/useWorkspace";
import { CheckCircle2, XCircle, AlertCircle, Clock, RotateCcw, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  success: { color: "text-emerald-500 bg-emerald-50 border-emerald-100", icon: CheckCircle2 },
  failed: { color: "text-rose-500 bg-rose-50 border-rose-100", icon: XCircle },
  skipped: { color: "text-slate-500 bg-slate-50 border-slate-100", icon: AlertCircle },
  waiting: { color: "text-amber-500 bg-amber-50 border-amber-100", icon: Clock },
  retrying: { color: "text-indigo-500 bg-indigo-50 border-indigo-100", icon: RotateCcw },
  started: { color: "text-blue-500 bg-blue-50 border-blue-100", icon: PlayCircle },
  error: { color: "text-rose-500 bg-rose-50 border-rose-100", icon: XCircle }, // Fallback for existing mock data
};

export default function AutomationLogsPage() {
  const { currentAccountId, isAgencyView } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const baseRows = automationLogs
      .filter((r) => r.account_id === currentAccountId)
      .filter((r) => (campaignId === "all" ? true : r.campaign_id === campaignId))
      .map(log => {
        const lead = leads.find(l => l.id === log.lead_id);
        const account = accounts.find(a => a.id === log.account_id);
        const campaign = campaigns.find(c => c.id === log.campaign_id);
        return { ...log, lead, account, campaign };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    // Duplicate data to create 2 pages
    const doubled = [...baseRows, ...baseRows.map(r => ({ ...r, id: r.id + 10000 }))];
    return doubled;
  }, [currentAccountId, campaignId]);

  const pageSize = 50;
  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <CrmShell>
      <div className="h-full flex flex-col -mt-10" data-testid="page-automation-logs">
        <div className="flex items-center justify-between mb-4">
          <FiltersBar selectedCampaignId={campaignId} setSelectedCampaignId={setCampaignId} />
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(0)} 
              className={cn("px-3 py-1 rounded-lg text-xs font-bold", page === 0 ? "bg-primary text-white" : "bg-white border border-border")}
            >1</button>
            <button 
              onClick={() => setPage(1)} 
              className={cn("px-3 py-1 rounded-lg text-xs font-bold", page === 1 ? "bg-primary text-white" : "bg-white border border-border")}
            >2</button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-border flex flex-col overflow-hidden mb-6" data-testid="table-logs">
          <div className="shrink-0 grid grid-cols-[100px_160px_1fr_1fr_1fr_180px] gap-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-white border-b border-border/50 px-6 py-4 sticky top-0 z-10">
            <div>Execution</div>
            <div>Status</div>
            <div>Lead</div>
            <div>Account</div>
            <div>Campaign</div>
            <div className="text-right">Created At</div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {paginatedRows.map((r) => {
              const status = r.status === 'error' ? 'failed' : r.status;
              const config = STATUS_CONFIG[status] || STATUS_CONFIG.success;
              const StatusIcon = config.icon;

              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[100px_160px_1fr_1fr_1fr_180px] gap-4 px-6 py-4 text-sm items-center hover:bg-muted/5 transition-colors bg-white"
                  data-testid={`row-log-${r.id}`}
                >
                  <div className="font-mono text-xs text-muted-foreground" data-testid={`text-log-ms-${r.id}`}>
                    #{r.execution_time_ms}
                  </div>
                  
                  <div className="flex" data-testid={`text-log-status-${r.id}`}>
                    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase", config.color)}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <Link 
                      href={`${isAgencyView ? '/agency' : '/subaccount'}/contacts/${r.lead?.id}`}
                      className="font-semibold text-primary hover:underline truncate block"
                      data-testid={`text-log-lead-${r.id}`}
                    >
                      {r.lead?.full_name || 'Unknown'}
                    </Link>
                  </div>

                  <div className="text-muted-foreground truncate" data-testid={`text-log-account-${r.id}`}>
                    {r.account?.name || 'N/A'}
                  </div>

                  <div className="text-muted-foreground truncate" data-testid={`text-log-campaign-${r.id}`}>
                    {r.campaign?.name || 'N/A'}
                  </div>

                  <div className="text-[11px] text-muted-foreground text-right" data-testid={`text-log-at-${r.id}`}>
                    {new Date(r.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </CrmShell>
  );
}
