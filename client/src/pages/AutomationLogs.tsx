import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
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
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Filter,
  CalendarDays,
  Megaphone,
  RefreshCw,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { SearchPill } from "@/components/ui/search-pill";
import { ToolbarPill } from "@/components/ui/toolbar-pill";
import { IconBtn } from "@/components/ui/icon-btn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  success:  { color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800/50", icon: CheckCircle2 },
  failed:   { color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50", icon: XCircle },
  skipped:  { color: "text-muted-foreground bg-muted/50 border-border", icon: AlertCircle },
  waiting:  { color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800/50", icon: Clock },
  retrying: { color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-800/50", icon: RotateCcw },
  started:  { color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800/50", icon: PlayCircle },
  error:    { color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50", icon: XCircle },
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
];

// ── Column definitions ───────────────────────────────────────────────────────
interface LogColumn { key: string; label: string; width: number; align?: "left" | "right" }

const COLUMNS: LogColumn[] = [
  { key: "expand",    label: "",           width: 36  },
  { key: "workflow",  label: "Workflow",    width: 160 },
  { key: "step",      label: "Step",       width: 130 },
  { key: "status",    label: "Status",     width: 125 },
  { key: "lead",      label: "Lead",       width: 140 },
  { key: "account",   label: "Account",    width: 130 },
  { key: "campaign",  label: "Campaign",   width: 130 },
  { key: "execTime",  label: "Exec Time",  width: 95,  align: "right" },
  { key: "duration",  label: "Duration",   width: 85,  align: "right" },
  { key: "createdAt", label: "Created At", width: 140, align: "right" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
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

function formatJson(raw: string | null | undefined): string {
  if (!raw) return "";
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function LogsTableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] bg-[#F1F1F1]/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AutomationLogsPage() {
  const { currentAccountId, isAgencyView } = useWorkspace();

  // ── Toolbar constants ─────────────────────────────────────────────────────
  const tbBase    = "h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 select-none";
  const tbDefault = "border border-border/55 text-foreground/60 hover:text-foreground hover:bg-card";
  const tbActive  = "bg-card border border-border/55 text-foreground";

  // ── Responsive collapse ───────────────────────────────────────────────────
  const [isNarrow, setIsNarrow] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setIsNarrow(e.contentRect.width < 920));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Data state ───────────────────────────────────────────────────────────
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

  const toggleRow = (id: string | number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Fetch ────────────────────────────────────────────────────────────────
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

      if (!logsRes.ok) throw new Error(`${logsRes.status}: Failed to fetch automation logs`);

      const logsData      = await logsRes.json();
      const leadsData     = leadsRes.ok ? await leadsRes.json() : [];
      const accountsData  = accountsRes.ok ? await accountsRes.json() : [];
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

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filter + sort ────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    return automationLogs
      .filter((r: any) => campaignId === "all" || (r.campaign_id || r.campaigns_id || r.Campaigns_id) === campaignId)
      .filter((r: any) => {
        if (statusFilter === "all") return true;
        const raw = r.status || "";
        const norm = raw === "error" ? "failed" : raw;
        if (statusFilter === "success") return norm === "success";
        if (statusFilter === "failed") return norm === "failed" || raw === "error";
        return true;
      })
      .filter((r: any) => {
        if (!workflowFilter.trim()) return true;
        const name = (r.workflowName || r.workflow_name || "").toLowerCase();
        return name.includes(workflowFilter.trim().toLowerCase());
      })
      .filter((r: any) => {
        const rawDate = r.created_at || r.CreatedAt;
        if (!rawDate) return true;
        const logDate = new Date(rawDate);
        if (dateFrom) { const from = new Date(dateFrom + "T00:00:00"); if (logDate < from) return false; }
        if (dateTo) { const to = new Date(dateTo + "T23:59:59.999"); if (logDate > to) return false; }
        return true;
      })
      .map((log: any) => {
        const leadId    = log.lead_id || log.leads_id || log.Leads_id;
        const accountId = log.account_id || log.accounts_id || log.Accounts_id;
        const campId    = log.campaign_id || log.campaigns_id || log.Campaigns_id;
        return {
          ...log,
          lead:     allLeads.find((l: any) => (l.id || l.Id) === leadId),
          account:  allAccounts.find((a: any) => (a.id || a.Id) === accountId),
          campaign: allCampaigns.find((c: any) => (c.id || c.Id) === campId),
        };
      })
      .sort((a: any, b: any) => {
        const aDate = a.created_at || a.CreatedAt || "";
        const bDate = b.created_at || b.CreatedAt || "";
        return bDate.localeCompare(aDate);
      });
  }, [automationLogs, allLeads, allAccounts, allCampaigns, campaignId, statusFilter, workflowFilter, dateFrom, dateTo]);

  const pageSize = 100;
  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(rows.length / pageSize);

  // ── Active filter count (for badge) ──────────────────────────────────────
  const activeFilterCount = [
    campaignId !== "all",
    statusFilter !== "all",
    !!dateFrom || !!dateTo,
    !!workflowFilter,
  ].filter(Boolean).length;

  // ── Campaign label for pill ──────────────────────────────────────────────
  const activeCampaignLabel = campaignId !== "all"
    ? (allCampaigns.find((c: any) => (c.id || c.Id) === campaignId)?.name || `#${campaignId}`)
    : undefined;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <CrmShell>
      <div className="flex flex-col h-full" data-testid="page-automation-logs">
        <div className="flex-1 min-h-0 flex gap-[3px] overflow-hidden">
          <div className="flex flex-col bg-muted rounded-lg overflow-hidden flex-1 min-w-0">

            {/* ── Title ── */}
            <div className="px-3.5 pt-5 pb-1 shrink-0">
              <div className="flex items-center gap-2 min-h-[40px]">
                <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                  Automation Logs
                </h2>
                <span className="h-5 px-1.5 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-semibold tabular-nums text-muted-foreground shrink-0">
                  {rows.length}
                </span>
                {activeFilterCount > 0 && (
                  <span className="h-5 px-1.5 rounded-full bg-brand-blue/15 flex items-center justify-center text-[10px] font-semibold text-brand-blue shrink-0">
                    {activeFilterCount} filter{activeFilterCount !== 1 && "s"}
                  </span>
                )}
              </div>
            </div>

            {/* ── Toolbar ── */}
            <div ref={toolbarRef} className="px-3 pt-1.5 pb-3 shrink-0 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
              {/* Search */}
              <SearchPill
                value={workflowFilter}
                onChange={(v) => { setWorkflowFilter(v); setPage(0); }}
                open={searchOpen}
                onOpenChange={setSearchOpen}
                placeholder="Search workflows..."
              />

              {/* Campaign filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {isNarrow ? (
                    <button className={cn("icon-circle-lg icon-circle-base shrink-0", campaignId !== "all" && tbActive)} title="Campaign filter">
                      <Megaphone className="h-4 w-4" />
                    </button>
                  ) : (
                    <ToolbarPill
                      icon={Megaphone}
                      label="Campaign"
                      active={campaignId !== "all"}
                      activeValue={activeCampaignLabel}
                    />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Campaign
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { setCampaignId("all"); setPage(0); }}
                    className={cn("text-[12px]", campaignId === "all" && "font-semibold text-brand-blue")}
                  >
                    All Campaigns
                    {campaignId === "all" && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                  {allCampaigns.map((c: any) => {
                    const cId = c.id || c.Id;
                    return (
                      <DropdownMenuItem
                        key={cId}
                        onClick={() => { setCampaignId(cId); setPage(0); }}
                        className={cn("text-[12px]", campaignId === cId && "font-semibold text-brand-blue")}
                      >
                        {c.name || `Campaign ${cId}`}
                        {campaignId === cId && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Status filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {isNarrow ? (
                    <button className={cn("icon-circle-lg icon-circle-base shrink-0", statusFilter !== "all" && tbActive)} title="Status filter">
                      <Filter className="h-4 w-4" />
                    </button>
                  ) : (
                    <ToolbarPill
                      icon={Filter}
                      label="Status"
                      active={statusFilter !== "all"}
                      activeValue={statusFilter !== "all" ? STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label : undefined}
                    />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Status
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {STATUS_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => { setStatusFilter(opt.value); setPage(0); }}
                      className={cn("text-[12px]", statusFilter === opt.value && "font-semibold text-brand-blue")}
                    >
                      {opt.label}
                      {statusFilter === opt.value && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Date range filter */}
              <Popover>
                <PopoverTrigger asChild>
                  {isNarrow ? (
                    <button className={cn("icon-circle-lg icon-circle-base shrink-0", !!(dateFrom || dateTo) && tbActive)} title="Date range filter">
                      <CalendarDays className="h-4 w-4" />
                    </button>
                  ) : (
                    <ToolbarPill
                      icon={CalendarDays}
                      label="Date"
                      active={!!(dateFrom || dateTo)}
                      activeValue={dateFrom || dateTo ? "Active" : undefined}
                    />
                  )}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-3 space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Date Range
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">From</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                        className="w-full h-10 rounded-lg border border-border bg-card px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-blue/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">To</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                        className="w-full h-10 rounded-lg border border-border bg-card px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-blue/30"
                      />
                    </div>
                  </div>
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
                      className="text-[11px] font-medium text-destructive hover:underline"
                    >
                      Clear date filter
                    </button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Spacer */}
              <div className="flex-1 min-w-0" />

              {/* Refresh */}
              <IconBtn onClick={fetchData} title="Refresh logs">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </IconBtn>
            </div>

            {/* ── Content ── */}
            {error && automationLogs.length === 0 && !loading ? (
              <div className="flex-1 min-h-0 flex items-center justify-center p-6">
                <ApiErrorFallback error={error} onRetry={fetchData} isRetrying={loading} />
              </div>
            ) : loading ? (
              <LogsTableSkeleton />
            ) : (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 overflow-auto" data-testid="table-logs">
                  <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 1100 }}>

                    {/* ── Sticky header ── */}
                    <thead className="sticky top-0 z-20">
                      <tr>
                        {COLUMNS.map((col) => (
                          <th
                            key={col.key}
                            className={cn(
                              "px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20",
                              col.align === "right" ? "text-right" : "text-left",
                            )}
                            style={{ width: col.width, minWidth: col.width }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {/* Empty state */}
                      {paginatedRows.length === 0 && (
                        <tr>
                          <td colSpan={COLUMNS.length} className="py-12">
                            <DataEmptyState variant="automation" compact />
                          </td>
                        </tr>
                      )}

                      {paginatedRows.map((r: any, idx: number) => {
                        const status = r.status === "error" ? "failed" : r.status;
                        const config = STATUS_CONFIG[status] || STATUS_CONFIG.success;
                        const StatusIcon = config.icon;
                        const isCritical = r.is_critical_error === true || r.is_critical_error === 1 || r.is_critical_error === "true";
                        const isFailed = status === "failed";
                        const rowId: string | number = r.id ?? r.Id ?? idx;
                        const isExpanded = expandedRows.has(rowId);

                        const errorCode: string | null = r.error_code || null;
                        const inputData: string | null = r.input_data || null;
                        const outputData: string | null = r.output_data || null;

                        return (
                          <React.Fragment key={rowId}>
                            {/* ── Data row ── */}
                            <tr
                              data-testid={isCritical ? "row-critical-error" : "row-log"}
                              className={cn(
                                "h-[52px] border-b border-border/15",
                                isCritical
                                  ? "bg-red-500/5 hover:bg-red-500/10 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                                  : "bg-[#F1F1F1] hover:bg-[#F8F8F8]",
                              )}
                            >
                              {/* Expand toggle */}
                              <td className="px-1" style={{ width: 36 }}>
                                {isFailed && (
                                  <button
                                    onClick={() => toggleRow(rowId)}
                                    className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    data-testid="btn-expand-log"
                                    aria-label={isExpanded ? "Collapse error details" : "Expand error details"}
                                    aria-expanded={isExpanded}
                                  >
                                    {isExpanded
                                      ? <ChevronDown className="h-4 w-4" />
                                      : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                )}
                              </td>

                              {/* Workflow */}
                              <td className="px-3" style={{ width: 160, minWidth: 160 }}>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {isCritical && (
                                    <AlertTriangle
                                      className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0"
                                      data-testid="icon-critical-error"
                                      aria-label="Critical error"
                                    />
                                  )}
                                  <span
                                    className="text-[13px] font-medium text-foreground truncate"
                                    title={r.workflowName || r.workflow_name || "N/A"}
                                  >
                                    {r.workflowName || r.workflow_name || "N/A"}
                                  </span>
                                </div>
                              </td>

                              {/* Step */}
                              <td className="px-3" style={{ width: 130, minWidth: 130 }}>
                                <span
                                  className="text-[11px] text-muted-foreground truncate block"
                                  title={r.stepName || r.step_name || "N/A"}
                                >
                                  {r.stepName || r.step_name || "N/A"}
                                </span>
                              </td>

                              {/* Status badge */}
                              <td className="px-3" style={{ width: 125, minWidth: 125 }}>
                                <div
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase w-fit",
                                    config.color,
                                  )}
                                >
                                  <StatusIcon className="h-3.5 w-3.5" />
                                  {status}
                                </div>
                              </td>

                              {/* Lead */}
                              <td className="px-3" style={{ width: 140, minWidth: 140 }}>
                                <Link
                                  href={`${isAgencyView ? "/agency" : "/subaccount"}/contacts/${r.lead?.id || r.lead?.Id}`}
                                  className="text-[13px] font-semibold text-primary hover:underline truncate block"
                                >
                                  {r.lead?.full_name || r.lead?.name || "Unknown"}
                                </Link>
                              </td>

                              {/* Account */}
                              <td className="px-3" style={{ width: 130, minWidth: 130 }}>
                                <span className="text-[11px] text-muted-foreground truncate block">
                                  {r.account?.name || "N/A"}
                                </span>
                              </td>

                              {/* Campaign */}
                              <td className="px-3" style={{ width: 130, minWidth: 130 }}>
                                <span className="text-[11px] text-muted-foreground truncate block">
                                  {r.campaign?.name || "N/A"}
                                </span>
                              </td>

                              {/* Exec Time */}
                              <td className="px-3 text-right tabular-nums" style={{ width: 95 }} data-testid="cell-exec-time">
                                <span className={cn(
                                  "text-[11px] font-mono",
                                  r.execution_time_ms != null ? "text-foreground" : "text-muted-foreground/50",
                                )}>
                                  {formatExecutionTime(r.execution_time_ms)}
                                </span>
                              </td>

                              {/* Duration */}
                              <td className="px-3 text-right tabular-nums" style={{ width: 85 }} data-testid="cell-duration">
                                <span className={cn(
                                  "text-[11px] font-mono",
                                  r.duration_seconds != null ? "text-foreground" : "text-muted-foreground/50",
                                )}>
                                  {formatDuration(r.duration_seconds) ?? "—"}
                                </span>
                              </td>

                              {/* Created At */}
                              <td className="px-3 text-right" style={{ width: 140 }}>
                                <span className="text-[11px] text-muted-foreground">
                                  {(r.created_at || r.CreatedAt)
                                    ? new Date(r.created_at || r.CreatedAt).toLocaleString([], {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      })
                                    : "N/A"}
                                </span>
                              </td>
                            </tr>

                            {/* ── Error expansion row ── */}
                            {isFailed && isExpanded && (
                              <tr>
                                <td
                                  colSpan={COLUMNS.length}
                                  className="bg-muted/40 border-b border-border/30"
                                  data-testid="log-error-detail"
                                >
                                  <div className="px-8 py-4 space-y-3">
                                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                      Error Details
                                    </div>

                                    {errorCode && (
                                      <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                          Error Code
                                        </div>
                                        <div
                                          data-testid="error-code"
                                          className="inline-flex items-center gap-1.5 text-sm font-mono text-rose-600 dark:text-rose-400 bg-rose-500/8 px-3 py-1.5 rounded-lg border border-rose-500/20"
                                        >
                                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                                          {errorCode}
                                        </div>
                                      </div>
                                    )}

                                    {inputData && (
                                      <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                          Input Data
                                        </div>
                                        <pre
                                          data-testid="input-data"
                                          className="text-xs font-mono bg-muted/60 text-foreground/80 p-3 rounded-lg overflow-auto max-h-48 border border-border whitespace-pre-wrap break-all"
                                        >
                                          {formatJson(inputData)}
                                        </pre>
                                      </div>
                                    )}

                                    {outputData && (
                                      <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                          Output Data
                                        </div>
                                        <pre
                                          data-testid="output-data"
                                          className="text-xs font-mono bg-muted/60 text-foreground/80 p-3 rounded-lg overflow-auto max-h-48 border border-border whitespace-pre-wrap break-all"
                                        >
                                          {formatJson(outputData)}
                                        </pre>
                                      </div>
                                    )}

                                    {!errorCode && !inputData && !outputData && (
                                      <div className="text-sm text-muted-foreground italic">
                                        No error details available for this log entry.
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                  <div className="shrink-0 border-t border-border/20 bg-muted px-3 py-2 flex items-center justify-center gap-1">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={cn(
                          "h-8 min-w-[32px] px-2 rounded-full text-[12px] font-semibold",
                          page === i
                            ? "bg-brand-blue text-white"
                            : "text-muted-foreground hover:bg-card hover:text-foreground",
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </CrmShell>
  );
}
