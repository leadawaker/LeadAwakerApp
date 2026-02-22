import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonTable } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  success: { color: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20", icon: CheckCircle2 },
  failed: { color: "text-[#f43f5e] bg-[#f43f5e]/10 border-[#f43f5e]/20", icon: XCircle },
  skipped: { color: "text-muted-foreground bg-muted/50 border-border", icon: AlertCircle },
  waiting: { color: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20", icon: Clock },
  retrying: { color: "text-[#6366f1] bg-[#6366f1]/10 border-[#6366f1]/20", icon: RotateCcw },
  started: { color: "text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20", icon: PlayCircle },
  error: { color: "text-[#f43f5e] bg-[#f43f5e]/10 border-[#f43f5e]/20", icon: XCircle },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
];

export default function AutomationLogsPage() {
  const { currentAccountId, isAgencyView } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (currentAccountId) params.set("accountId", String(currentAccountId));
      const qs = params.toString();

      const [logsRes, leadsRes, accountsRes, campaignsRes] = await Promise.all([
        apiFetch(qs ? `/api/automation-logs?${qs}` : "/api/automation-logs"),
        apiFetch(qs ? `/api/leads?${qs}` : "/api/leads"),
        apiFetch("/api/accounts"),
        apiFetch(qs ? `/api/campaigns?${qs}` : "/api/campaigns"),
      ]);

      // If the primary data source (logs) fails, throw an error
      if (!logsRes.ok) {
        throw new Error(`${logsRes.status}: Failed to fetch automation logs`);
      }

      const logsData = await logsRes.json();
      const leadsData = leadsRes.ok ? await leadsRes.json() : [];
      const accountsData = accountsRes.ok ? await accountsRes.json() : [];
      const campaignsData = campaignsRes.ok ? await campaignsRes.json() : [];

      setAutomationLogs(Array.isArray(logsData) ? logsData : []);
      setAllLeads(Array.isArray(leadsData) ? leadsData : []);
      setAllAccounts(Array.isArray(accountsData) ? accountsData : []);
      setAllCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
    } catch (err) {
      console.error("Failed to fetch automation logs data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [currentAccountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = useMemo(() => {
    const baseRows = automationLogs
      .filter((r: any) => (campaignId === "all" ? true : (r.campaign_id || r.campaigns_id || r.Campaigns_id) === campaignId))
      .filter((r: any) => {
        if (statusFilter === "all") return true;
        const rawStatus = r.status || "";
        // Normalize: "error" maps to "failed" for display/filtering purposes
        const normalizedStatus = rawStatus === "error" ? "failed" : rawStatus;
        if (statusFilter === "success") return normalizedStatus === "success";
        if (statusFilter === "failed") return normalizedStatus === "failed" || rawStatus === "error";
        return true;
      })
      .map((log: any) => {
        const leadId = log.lead_id || log.leads_id || log.Leads_id;
        const accountId = log.account_id || log.accounts_id || log.Accounts_id;
        const campId = log.campaign_id || log.campaigns_id || log.Campaigns_id;
        const lead = allLeads.find((l: any) => (l.id || l.Id) === leadId);
        const account = allAccounts.find((a: any) => (a.id || a.Id) === accountId);
        const campaign = allCampaigns.find((c: any) => (c.id || c.Id) === campId);
        return { ...log, lead, account, campaign };
      })
      .sort((a: any, b: any) => {
        const aDate = a.created_at || a.CreatedAt || "";
        const bDate = b.created_at || b.CreatedAt || "";
        return bDate.localeCompare(aDate);
      });

    return baseRows;
  }, [automationLogs, allLeads, allAccounts, allCampaigns, campaignId, statusFilter]);

  const pageSize = 100;
  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(rows.length / pageSize);

  return (
    <CrmShell>
      <div
        className="h-full flex flex-col px-0 py-0 overflow-hidden bg-transparent pb-4"
        data-testid="page-automation-logs"
      >
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <FiltersBar
            selectedCampaignId={campaignId}
            setSelectedCampaignId={setCampaignId}
          />
          <div className="flex items-center gap-2">
            <Select
              value={String(campaignId)}
              onValueChange={(v) => { setCampaignId(v === "all" ? "all" : Number(v)); setPage(0); }}
            >
              <SelectTrigger
                className="h-9 w-[200px] text-sm"
                data-testid="select-campaign-filter"
              >
                <SelectValue placeholder="All Campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-campaign-all">
                  All Campaigns
                </SelectItem>
                {allCampaigns.map((c: any) => (
                  <SelectItem
                    key={c.id || c.Id}
                    value={String(c.id || c.Id)}
                    data-testid={`option-campaign-${c.id || c.Id}`}
                  >
                    {c.name || `Campaign ${c.id || c.Id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => { setStatusFilter(v); setPage(0); }}
            >
              <SelectTrigger
                className="h-9 w-[160px] text-sm"
                data-testid="select-status-filter"
              >
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    data-testid={`option-status-${opt.value}`}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && automationLogs.length === 0 && !loading ? (
          <ApiErrorFallback
            error={error}
            onRetry={fetchData}
            isRetrying={loading}
          />
        ) : loading ? (
          <SkeletonTable rows={8} columns={7} className="flex-1" />
        ) : (
          <div
            className="flex-1 min-h-0 bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden relative"
            data-testid="table-logs"
          >
            <div className="overflow-x-auto flex-1 min-h-0 flex flex-col">
            {/* Header */}
            <div className="shrink-0 grid grid-cols-[140px_140px_140px_1fr_1fr_1fr_1fr_180px] min-w-[940px] gap-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
              <div>Workflow</div>
              <div>Step</div>
              <div>Status</div>
              <div>Lead</div>
              <div>Account</div>
              <div>Campaign</div>
              <div className="text-right">Created At</div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/30">
              {paginatedRows.length === 0 && (
                <DataEmptyState variant="automation" compact />
              )}
              {paginatedRows.map((r: any, idx: number) => {
                const status = r.status === "error" ? "failed" : r.status;
                const config = STATUS_CONFIG[status] || STATUS_CONFIG.success;
                const StatusIcon = config.icon;

                return (
                  <div
                    key={r.id || r.Id || idx}
                    className="grid grid-cols-[140px_140px_140px_1fr_1fr_1fr_1fr_180px] min-w-[940px] gap-4 px-6 py-4 text-sm items-center hover:bg-muted/30 transition-colors bg-card"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate" title={r.workflowName || r.workflow_name || "N/A"}>
                        {r.workflowName || r.workflow_name || "N/A"}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-muted-foreground truncate text-xs" title={r.stepName || r.step_name || "N/A"}>
                        {r.stepName || r.step_name || "N/A"}
                      </div>
                    </div>

                    <div>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase w-fit",
                          config.color
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <Link
                        href={`${isAgencyView ? "/agency" : "/subaccount"}/contacts/${r.lead?.id || r.lead?.Id}`}
                        className="font-semibold text-primary hover:underline truncate block"
                      >
                        {r.lead?.full_name || r.lead?.name || "Unknown"}
                      </Link>
                    </div>

                    <div className="text-muted-foreground truncate">
                      {r.account?.name || "N/A"}
                    </div>

                    <div className="text-muted-foreground truncate">
                      {r.campaign?.name || "N/A"}
                    </div>

                    <div className="text-[11px] text-muted-foreground text-right">
                      {(r.created_at || r.CreatedAt) ? new Date(r.created_at || r.CreatedAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }) : "N/A"}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>

            {/* Pagination (attached to card bottom) */}
            {totalPages > 1 && (
              <div className="shrink-0 border-t border-border bg-card rounded-b-2xl">
                <div className="flex items-center justify-center gap-3 py-2">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={cn(
                        "text-xs font-bold transition-colors",
                        page === i
                          ? "text-brand-blue"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CrmShell>
  );
}
