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
  Search,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight,
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
import { Input } from "@/components/ui/input";

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  success: { color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800/50", icon: CheckCircle2 },
  failed: { color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50", icon: XCircle },
  skipped: { color: "text-muted-foreground bg-muted/50 border-border", icon: AlertCircle },
  waiting: { color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800/50", icon: Clock },
  retrying: { color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-800/50", icon: RotateCcw },
  started: { color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800/50", icon: PlayCircle },
  error: { color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50", icon: XCircle },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
];

function formatExecutionTime(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const num = Number(ms);
  if (isNaN(num)) return "—";
  if (num < 1000) return `${Math.round(num)}ms`;
  return `${(num / 1000).toFixed(2)}s`;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null) return null;
  const num = Number(seconds);
  if (isNaN(num)) return null;
  return `${num.toFixed(1)}s`;
}

/** Attempt to pretty-print a JSON string; fall back to raw text on parse error */
function formatJson(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function AutomationLogsPage() {
  const { currentAccountId, isAgencyView } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
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
      .filter((r: any) => {
        if (!workflowFilter.trim()) return true;
        const name = (r.workflowName || r.workflow_name || "").toLowerCase();
        return name.includes(workflowFilter.trim().toLowerCase());
      })
      .filter((r: any) => {
        const rawDate = r.created_at || r.CreatedAt;
        if (!rawDate) return true; // no date → always show
        const logDate = new Date(rawDate);
        if (dateFrom) {
          // dateFrom is "YYYY-MM-DD"; compare start of day
          const from = new Date(dateFrom + "T00:00:00");
          if (logDate < from) return false;
        }
        if (dateTo) {
          // dateTo is "YYYY-MM-DD"; compare end of day
          const to = new Date(dateTo + "T23:59:59.999");
          if (logDate > to) return false;
        }
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
  }, [automationLogs, allLeads, allAccounts, allCampaigns, campaignId, statusFilter, workflowFilter, dateFrom, dateTo]);

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
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Filter by workflow..."
                value={workflowFilter}
                onChange={(e) => { setWorkflowFilter(e.target.value); setPage(0); }}
                className="h-9 w-[200px] pl-8 text-sm"
                data-testid="input-workflow-filter"
              />
            </div>
            {/* Date range filter */}
            <div className="flex items-center gap-1.5" data-testid="date-range-filter">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                className="h-9 w-[150px] text-sm cursor-pointer"
                data-testid="input-date-from"
                title="From date"
              />
              <span className="text-xs text-muted-foreground select-none">–</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                className="h-9 w-[150px] text-sm cursor-pointer"
                data-testid="input-date-to"
                title="To date"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
                  className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="btn-clear-date-filter"
                  title="Clear date filter"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
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
            <div className="shrink-0 grid grid-cols-[140px_140px_140px_1fr_1fr_1fr_1fr_110px_140px] min-w-[1040px] gap-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-card border-b border-border px-6 py-4 sticky top-0 z-10">
              <div>Workflow</div>
              <div>Step</div>
              <div>Status</div>
              <div>Lead</div>
              <div>Account</div>
              <div>Campaign</div>
              <div className="text-right">Exec Time</div>
              <div className="text-right">Duration</div>
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
                const isCritical = r.is_critical_error === true || r.is_critical_error === 1 || r.is_critical_error === "true";

                return (
                  <div
                    key={r.id || r.Id || idx}
                    data-testid={isCritical ? "row-critical-error" : "row-log"}
                    className={cn(
                      "grid grid-cols-[140px_140px_140px_1fr_1fr_1fr_1fr_110px_140px] min-w-[1040px] gap-4 px-6 py-4 text-sm items-center transition-colors",
                      isCritical
                        ? "bg-red-500/5 border-l-2 border-l-red-500 hover:bg-red-500/10 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                        : "bg-card hover:bg-muted/30"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isCritical && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-red-500 dark:text-red-400 shrink-0"
                            data-testid="icon-critical-error"
                            aria-label="Critical error"
                          />
                        )}
                        <div className="font-medium text-foreground truncate" title={r.workflowName || r.workflow_name || "N/A"}>
                          {r.workflowName || r.workflow_name || "N/A"}
                        </div>
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

                    <div
                      className="text-[11px] text-muted-foreground text-right"
                      data-testid="cell-exec-time"
                    >
                      <span className={cn(
                        "font-mono",
                        r.execution_time_ms != null ? "text-foreground" : "text-muted-foreground/50"
                      )}>
                        {formatExecutionTime(r.execution_time_ms)}
                      </span>
                    </div>

                    <div
                      className="text-[11px] text-muted-foreground text-right"
                      data-testid="cell-duration"
                    >
                      <span className={cn(
                        "font-mono",
                        r.duration_seconds != null ? "text-foreground" : "text-muted-foreground/50"
                      )}>
                        {formatDuration(r.duration_seconds) ?? "—"}
                      </span>
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
