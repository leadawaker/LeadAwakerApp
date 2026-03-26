import React, { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useAutomationLogs, useAutomationSummary } from "@/features/automation/hooks/useAutomationLogs";
import { AutomationSummaryCards } from "@/features/automation/components/AutomationSummaryCards";
import { MobileExecutionCard } from "@/features/automation/components/ExecutionMobileCards";
import { ExecutionTableRows } from "@/features/automation/components/ExecutionTableRows";
import { StepsTableRows } from "@/features/automation/components/StepsTableRows";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  Filter,
  CalendarDays,
  Megaphone,
  RefreshCw,
  Check,
  Layers,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { SearchPill } from "@/components/ui/search-pill";
import { ViewTabBar } from "@/components/ui/view-tab-bar";
import { IconBtn } from "@/components/ui/icon-btn";
import { useExecutionGroups } from "@/features/automation/hooks/useExecutionGroups";
import {
  STATUS_OPTIONS,
  COLUMNS_STEPS,
  COLUMNS_EXECUTIONS,
} from "@/features/automation/automationConstants";
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

// ── Skeleton ─────────────────────────────────────────────────────────────────
function LogsTableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] bg-card/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AutomationLogsPage() {
  const { t } = useTranslation("automation");
  const { currentAccountId, isAgencyView } = useWorkspace();
  const [, navigate] = useLocation();
  const base = isAgencyView ? "/agency" : "/subaccount";

  // ── Expand-on-hover button constants ─────────────────────────────────────
  const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
  const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
  const xActive  = "border-brand-indigo text-brand-indigo";
  const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  const toolbarRef = useRef<HTMLDivElement>(null);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [desktopViewMode, setDesktopViewMode] = useState<"steps" | "executions">("executions");

  // ── Data hooks ──────────────────────────────────────────────────────────
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

  const toggleRow = (id: string | number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pageSize = 50;
  const logsQuery = useAutomationLogs({
    page,
    limit: pageSize,
    accountId: currentAccountId || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    workflowName: workflowFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const summaryQuery = useAutomationSummary(currentAccountId || undefined);

  // Campaigns list (for filter dropdown only)
  const campaignsQuery = useQuery({
    queryKey: ["/api/campaigns", currentAccountId],
    queryFn: async () => {
      const qs = currentAccountId ? `?accountId=${currentAccountId}` : "";
      const res = await apiFetch(`/api/campaigns${qs}`);
      if (!res.ok) return [];
      return res.json();
    },
  });
  const allCampaigns = campaignsQuery.data ?? [];

  const loading = logsQuery.isLoading;
  const error = logsQuery.error as Error | null;
  const refetch = () => { logsQuery.refetch(); summaryQuery.refetch(); };

  // ── Rows from server (already filtered, sorted, paginated) ─────────────
  const rows = useMemo(() => {
    const data = logsQuery.data?.data ?? [];
    if (campaignId === "all") return data;
    return data.filter((r: any) =>
      (r.campaignId || r.campaignsId || r.campaign_id || r.campaigns_id || r.Campaigns_id) === campaignId
    );
  }, [logsQuery.data, campaignId]);

  const totalPages = Math.ceil((logsQuery.data?.total ?? 0) / pageSize);
  const paginatedRows = rows;

  // ── Execution groups ───────────────────────────────────────────────────
  const executionGroups = useExecutionGroups(rows);

  const executionByRow = useMemo(() => {
    const map = new Map<string | number, typeof executionGroups[0]>();
    for (const group of executionGroups) {
      for (const step of group.steps) {
        map.set(step.id, group);
      }
    }
    return map;
  }, [executionGroups]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [campaignId, statusFilter, workflowFilter, dateFrom, dateTo]);
  useEffect(() => { setPage(0); }, [desktopViewMode]);

  // ── Active filter count (for badge) ──────────────────────────────────────
  const activeFilterCount = [
    campaignId !== "all",
    statusFilter !== "all",
    !!dateFrom || !!dateTo,
    !!workflowFilter,
  ].filter(Boolean).length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <CrmShell>
      <div className="flex flex-col h-full" data-testid="page-automation-logs">
        <div className="flex-1 min-h-0 flex gap-[3px] overflow-hidden">
          <div className="flex flex-col bg-muted rounded-lg overflow-hidden flex-1 min-w-0">

            {/* ── Title + Toolbar (single row) ── */}
            <div ref={toolbarRef} className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
              <div className="flex items-center gap-2 shrink-0">
                <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                  {t("page.title")}
                </h2>
                <span className="h-5 px-1.5 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-semibold tabular-nums text-muted-foreground shrink-0">
                  {logsQuery.data?.total ?? 0}
                </span>
                {activeFilterCount > 0 && (
                  <span className="h-5 px-1.5 rounded-full bg-brand-indigo/15 flex items-center justify-center text-[10px] font-semibold text-brand-indigo shrink-0">
                    {t("toolbar.filterCount", { count: activeFilterCount })}
                  </span>
                )}
              </div>

              <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />

              <ViewTabBar
                variant="segment"
                tabs={[
                  { id: "executions", label: t("views.executions"), icon: Layers },
                  { id: "steps",      label: t("views.steps"),      icon: List  },
                ]}
                activeId={desktopViewMode}
                onTabChange={(id) => setDesktopViewMode(id as "steps" | "executions")}
              />

              <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />

              {/* Search */}
              <SearchPill
                value={workflowFilter}
                onChange={(v) => { setWorkflowFilter(v); setPage(0); }}
                open={searchOpen}
                onOpenChange={setSearchOpen}
                placeholder={t("toolbar.searchPlaceholder")}
              />

              {/* Campaign filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(xBase, "hover:max-w-[120px]", campaignId !== "all" ? xActive : xDefault)}>
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{t("filters.campaign")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t("filters.campaign")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { setCampaignId("all"); setPage(0); }}
                    className={cn("text-[12px]", campaignId === "all" && "font-semibold text-brand-indigo")}
                  >
                    {t("filters.allCampaigns")}
                    {campaignId === "all" && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                  {allCampaigns.map((c: any) => {
                    const cId = c.id || c.Id;
                    return (
                      <DropdownMenuItem
                        key={cId}
                        onClick={() => { setCampaignId(cId); setPage(0); }}
                        className={cn("text-[12px]", campaignId === cId && "font-semibold text-brand-indigo")}
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
                  <button className={cn(xBase, "hover:max-w-[100px]", statusFilter !== "all" ? xActive : xDefault)}>
                    <Filter className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{t("filters.status")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t("filters.status")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {STATUS_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => { setStatusFilter(opt.value); setPage(0); }}
                      className={cn("text-[12px]", statusFilter === opt.value && "font-semibold text-brand-indigo")}
                    >
                      {t(opt.labelKey)}
                      {statusFilter === opt.value && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Date range filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(xBase, "hover:max-w-[80px]", !!(dateFrom || dateTo) ? xActive : xDefault)}>
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{t("filters.date")}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-3 space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t("filters.dateRange")}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">{t("filters.from")}</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                        className="w-full h-10 rounded-lg border border-border bg-card px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">{t("filters.to")}</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                        className="w-full h-10 rounded-lg border border-border bg-card px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo/30"
                      />
                    </div>
                  </div>
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
                      className="text-[11px] font-medium text-destructive hover:underline"
                    >
                      {t("filters.clearDateFilter")}
                    </button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Spacer */}
              <div className="flex-1 min-w-0" />

              {/* Summary stats (inline, right-aligned) */}
              <AutomationSummaryCards summary={summaryQuery.data} isLoading={summaryQuery.isLoading} />

              {/* Refresh */}
              <IconBtn onClick={refetch} title={t("toolbar.refreshLogs")}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </IconBtn>
            </div>

            {/* ── Content ── */}
            {error && rows.length === 0 && !loading ? (
              <div className="flex-1 min-h-0 flex items-center justify-center p-6">
                <ApiErrorFallback error={error} onRetry={refetch} isRetrying={loading} />
              </div>
            ) : loading ? (
              <LogsTableSkeleton />
            ) : (
              <>
                {/* ── Mobile execution groups (< 768px) ── */}
                <div className="md:hidden flex-1 min-h-0 overflow-y-auto p-3 space-y-2" data-testid="mobile-logs-list">
                  {executionGroups.length === 0 ? (
                    <div className="py-12 flex items-center justify-center">
                      <DataEmptyState variant="automation" compact />
                    </div>
                  ) : (
                    <>
                      {executionGroups.map((group, idx) => (
                        <MobileExecutionCard
                          key={group.executionId}
                          group={group}
                          idx={idx}
                          isAgencyView={isAgencyView}
                        />
                      ))}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="h-8 px-3 rounded-full text-[12px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
                          >
                            {t("pagination.prev")}
                          </button>
                          <span className="text-[12px] text-muted-foreground tabular-nums">
                            {t("pagination.page", { current: page + 1, total: totalPages })}
                          </span>
                          <button
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="h-8 px-3 rounded-full text-[12px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
                          >
                            {t("pagination.next")}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Desktop table (>= 768px) ── */}
                <div className="hidden md:flex flex-1 min-h-0 overflow-hidden flex-col">
                <div className="flex-1 min-h-0 overflow-auto" data-testid="table-logs">
                  <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 1260 }}>

                    {/* ── Sticky header ── */}
                    <thead className="sticky top-0 z-20">
                      <tr>
                        {(desktopViewMode === "steps" ? COLUMNS_STEPS : COLUMNS_EXECUTIONS).map((col) => (
                          <th
                            key={col.key}
                            className={cn(
                              "px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20",
                              col.align === "right" ? "text-right" : "text-left",
                            )}
                            style={{ width: col.width, minWidth: col.width }}
                          >
                            {col.label ? t(col.label) : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {desktopViewMode === "executions" ? (
                        <ExecutionTableRows
                          groups={executionGroups}
                          page={page}
                          pageSize={pageSize}
                          isAgencyView={isAgencyView}
                        />
                      ) : (
                        <StepsTableRows
                          rows={paginatedRows}
                          page={page}
                          pageSize={pageSize}
                          expandedRows={expandedRows}
                          toggleRow={toggleRow}
                          executionByRow={executionByRow}
                          isAgencyView={isAgencyView}
                        />
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                  <div className="shrink-0 border-t border-border/20 bg-muted px-3 py-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="h-8 px-3 rounded-full text-[12px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
                    >
                      {t("pagination.prev")}
                    </button>
                    <span className="text-[12px] text-muted-foreground tabular-nums">
                      {t("pagination.page", { current: page + 1, total: totalPages })}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="h-8 px-3 rounded-full text-[12px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
                    >
                      {t("pagination.next")}
                    </button>
                  </div>
                )}
                </div>{/* end desktop table wrapper */}
              </>
            )}

          </div>
        </div>
      </div>
    </CrmShell>
  );
}
