import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeads, useCampaigns, useAccounts, useCampaignMetrics, useDashboardTrends } from "@/hooks/useApiData";
import { useDashboardRefreshInterval } from "@/hooks/useDashboardRefreshInterval";
import { useDashboardWidgetPrefs } from "@/hooks/useDashboardWidgetPrefs";
import type { Lead, Campaign, Account, CampaignMetricsHistory, DashboardTrend } from "@/types/models";
import { KpiSparkline, TrendIndicator, TrendRangeToggle } from "@/components/crm/KpiSparkline";
import type { SparklineDataPoint } from "@/components/crm/KpiSparkline";
import { CampaignPerformanceCards } from "@/components/crm/CampaignPerformanceCards";
import { LeadScoreDistributionChart } from "@/components/crm/LeadScoreDistributionChart";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import {
  DateRangeFilter,
  getDefaultDateRange,
  isWithinDateRange,
  type DateRangeValue,
} from "@/components/crm/DateRangeFilter";
import {
  Users,
  MessageSquare,
  TrendingUp,
  Calendar as CalendarIcon,
  CheckCircle2,
  ArrowUpRight,
  Target,
  Clock,
  Megaphone,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { HotLeadsWidget } from "@/components/crm/HotLeadsWidget";

const TAG_CATEGORIES = [
  {
    type: "Status",
    tags: [
      { name: "bump 1 reply", color: "#3B82F6" },
      { name: "bump 2 reply", color: "#3B82F6" },
      { name: "bump 3 reply", color: "#3B82F6" },
      { name: "bump response", color: "#3B82F6" },
      { name: "first message", color: "#EAB308" },
      { name: "follow-up", color: "#F97316" },
      { name: "lead", color: "#3B82F6" },
      { name: "multiple messages", color: "#3B82F6" },
      { name: "qualify", color: "#22C55E" },
      { name: "responded", color: "#22C55E" },
      { name: "second message", color: "#EAB308" }
    ]
  },
  {
    type: "Outcome",
    tags: [
      { name: "appointment booked", color: "#FCB803" },
      { name: "goodbye", color: "#64748B" },
      { name: "no response", color: "#64748B" },
      { name: "schedule", color: "#22C55E" }
    ]
  },
  {
    type: "Automation",
    tags: [
      { name: "ai stop", color: "#EF4444" },
      { name: "bump 1.1", color: "#3B82F6" },
      { name: "bump 2.1", color: "#3B82F6" },
      { name: "bump 3.1", color: "#3B82F6" },
      { name: "no bump", color: "#64748B" },
      { name: "reply generating", color: "#EAB308" }
    ]
  }
];


// Avatar pastel palette for account/campaign acronym circles (hash-stable, matches LeadsCardView)
const DASH_AVATAR_PASTELS = [
  { bg: "#C8D8FF", text: "#3B5BDB" },
  { bg: "#FFD9C0", text: "#C05621" },
  { bg: "#C8F2C2", text: "#276749" },
  { bg: "#FFF3B0", text: "#92400E" },
  { bg: "#E9D5FF", text: "#5B21B6" },
  { bg: "#FECDD3", text: "#9F1239" },
  { bg: "#BAE6FD", text: "#0369A1" },
];

function getDashAvatarPastel(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return DASH_AVATAR_PASTELS[Math.abs(hash) % DASH_AVATAR_PASTELS.length];
}

function getDashInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

// Account status dot colors
const ACCOUNT_STATUS_HEX: Record<string, string> = {
  Active: "#10B981",
  Trial: "#F59E0B",
  Inactive: "#94A3B8",
  Suspended: "#F43F5E",
  Paused: "#F59E0B",
};

function getCampaignStatusColor(status: string): string {
  switch (status) {
    case "Active": return "#22C55E";
    case "Draft": return "#64748B";
    case "Paused": return "#F59E0B";
    case "Completed":
    case "Finished": return "#3B82F6";
    default: return "#64748B";
  }
}

export default function AppDashboard() {
  const { currentAccountId, isAgencyView, isAgencyUser } = useWorkspace();

  // Date + trend range
  const [dateRange, setDateRange] = useState<DateRangeValue>(getDefaultDateRange);
  const [trendRange, setTrendRange] = useState<7 | 30>(7);

  // Agency: status filters (replaces per-account dropdown)
  const [accountStatusFilter, setAccountStatusFilter] = useState<"active" | "paused" | "all">("active");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<"active" | "paused" | "completed" | "all">("all");

  // Agency: selected account from left panel (null = all accounts)
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  // Subaccount: filter by specific campaign
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "all">("all");
  const [campaignDropdownOpen, setCampaignDropdownOpen] = useState(false);
  const campaignDropdownRef = useRef<HTMLDivElement>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const customizeRef = useRef<HTMLDivElement>(null);

  // Refresh state
  const { intervalSeconds } = useDashboardRefreshInterval();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Close campaign dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (campaignDropdownRef.current && !campaignDropdownRef.current.contains(e.target as Node)) {
        setCampaignDropdownOpen(false);
      }
    }
    if (campaignDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [campaignDropdownOpen]);

  // Close customize popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customizeRef.current && !customizeRef.current.contains(e.target as Node)) {
        setCustomizeOpen(false);
      }
    }
    if (customizeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [customizeOpen]);

  // Fetch real data from API
  const { leads, loading: leadsLoading, refresh: refreshLeads } = useLeads();
  const { campaigns, loading: campaignsLoading, refresh: refreshCampaigns } = useCampaigns();
  const { accounts, loading: accountsLoading, refresh: refreshAccounts } = useAccounts({ enabled: isAgencyUser });
  const { metrics: campaignMetrics, loading: metricsLoading, refresh: refreshMetrics } = useCampaignMetrics();

  // Agency trends are always aggregate (no specific account filter)
  const trendAccountId = isAgencyView ? undefined : currentAccountId;
  const { trends: dashboardTrends, loading: trendsLoading, refresh: refreshTrends } = useDashboardTrends(trendRange, trendAccountId);

  // Refresh all dashboard data sources at once
  const refreshAllData = useCallback(() => {
    refreshLeads();
    refreshCampaigns();
    refreshAccounts();
    refreshMetrics();
    refreshTrends();
    setLastRefreshedAt(new Date());
  }, [refreshLeads, refreshCampaigns, refreshAccounts, refreshMetrics, refreshTrends]);

  // Set up auto-refresh interval
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (intervalSeconds <= 0) {
      setCountdown(0);
      return;
    }

    setCountdown(intervalSeconds);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refreshAllData();
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [intervalSeconds, refreshAllData]);

  // Widget prefs
  const agencyWidgetPrefs = useDashboardWidgetPrefs("agency");
  const subaccountWidgetPrefs = useDashboardWidgetPrefs("subaccount");

  // Date-filtered leads + metrics
  const filteredLeads = useMemo(() => {
    return leads.filter((l: any) => {
      const dateField = l.created_at || l.updated_at || l.last_interaction_at;
      return isWithinDateRange(dateField, dateRange);
    });
  }, [leads, dateRange]);

  const filteredMetrics = useMemo(() => {
    return campaignMetrics.filter((m: any) =>
      isWithinDateRange(m.metric_date || m.created_at, dateRange)
    );
  }, [campaignMetrics, dateRange]);

  // Agency: filter accounts by status
  const statusFilteredAccounts = useMemo(() => {
    const all = accounts.filter((a: any) => (a.id || a.Id) !== 1);
    if (accountStatusFilter === "all") return all;
    return all.filter((a: any) => (a.status || "").toLowerCase() === accountStatusFilter);
  }, [accounts, accountStatusFilter]);

  // Agency: filter campaigns by account status, then campaign status, then selected account
  const agencyFilteredCampaigns = useMemo(() => {
    const accountIds = new Set(statusFilteredAccounts.map((a: any) => a.id || a.Id));
    let filtered = campaigns.filter((c: any) =>
      accountIds.has(c.account_id || c.accounts_id || c.Accounts_id)
    );
    if (campaignStatusFilter !== "all") {
      filtered = filtered.filter((c: any) => (c.status || "").toLowerCase() === campaignStatusFilter);
    }
    if (selectedAccountId !== null) {
      filtered = filtered.filter((c: any) =>
        (c.account_id || c.accounts_id || c.Accounts_id) === selectedAccountId
      );
    }
    return filtered;
  }, [campaigns, statusFilteredAccounts, campaignStatusFilter, selectedAccountId]);

  // Agency: filter leads by campaigns in scope
  const agencyFilteredLeads = useMemo(() => {
    if (!isAgencyView) return filteredLeads;
    const campaignIds = new Set(agencyFilteredCampaigns.map((c: any) => c.id || c.Id));
    return filteredLeads.filter((l: any) =>
      campaignIds.has(l.campaign_id || l.campaigns_id || l.Campaigns_id)
    );
  }, [filteredLeads, agencyFilteredCampaigns, isAgencyView]);

  const agencyFilteredMetrics = useMemo(() => {
    if (!isAgencyView) return filteredMetrics;
    const campaignIds = new Set(agencyFilteredCampaigns.map((c: any) => c.id || c.Id));
    return filteredMetrics.filter((m: any) =>
      campaignIds.has(m.campaigns_id || (m as any).campaignsId)
    );
  }, [filteredMetrics, agencyFilteredCampaigns, isAgencyView]);

  // Subaccount data
  const campaignOptions = useMemo(() => {
    return campaigns.filter((c: any) => (c.account_id || c.accounts_id) === currentAccountId);
  }, [campaigns, currentAccountId]);

  const stagePalette = useMemo(() => [
    { id: "New" as const, label: "New", icon: <Zap className="w-5 h-5" />, fill: "#1a3a6f", textColor: "white" as const },
    { id: "Contacted" as const, label: "Contacted", icon: <MessageSquare className="w-5 h-5" />, fill: "#2d5aa8", textColor: "white" as const },
    { id: "Responded" as const, label: "Responded", icon: <TrendingUp className="w-5 h-5" />, fill: "#1E90FF", textColor: "white" as const },
    { id: "Multiple Responses" as const, label: "Multiple", icon: <ArrowUpRight className="w-5 h-5" />, fill: "#17A398", textColor: "white" as const },
    { id: "Qualified" as const, label: "Qualified", icon: <CheckCircle2 className="w-5 h-5" />, fill: "#10b981", textColor: "white" as const },
    { id: "Booked" as const, label: "Booked", icon: <CalendarIcon className="w-5 h-5" />, fill: "#FCB803", textColor: "#131B49" as const },
    { id: "DND" as const, label: "DND", icon: <Target className="w-5 h-5" />, fill: "#ef4444", textColor: "white" as const },
  ], []);

  const funnel = useMemo(() => {
    const accountLeads = filteredLeads
      .filter((l: any) => (l.account_id || l.accounts_id) === currentAccountId)
      .filter((l: any) => (selectedCampaignId === "all" ? true : (l.campaign_id || l.campaigns_id) === selectedCampaignId));

    const counts: Record<string, number> = {
      New: accountLeads.filter((l: any) => l.conversion_status === "New").length,
      Contacted: accountLeads.filter((l: any) => l.conversion_status === "Contacted").length,
      Responded: accountLeads.filter((l: any) => l.conversion_status === "Responded").length,
      "Multiple Responses": accountLeads.filter((l: any) => l.conversion_status === "Multiple Responses").length,
      Qualified: accountLeads.filter((l: any) => l.conversion_status === "Qualified").length,
      Booked: accountLeads.filter((l: any) => l.conversion_status === "Booked").length,
      DND: accountLeads.filter((l: any) => l.conversion_status === "DND").length,
    };

    return stagePalette
      .map((s) => ({ name: s.label, value: counts[s.id] || 0, fill: s.fill }));
  }, [filteredLeads, currentAccountId, selectedCampaignId, stagePalette]);

  const stats = useMemo(() => {
    const accountLeads = filteredLeads
      .filter((l: any) => (l.account_id || l.accounts_id) === currentAccountId)
      .filter((l: any) => (selectedCampaignId === "all" ? true : (l.campaign_id || l.campaigns_id) === selectedCampaignId));

    const accountCampaigns = campaigns.filter((c: any) => (c.account_id || c.accounts_id) === currentAccountId);
    const callsBooked = accountLeads.filter((l: any) => Boolean(l.booked_call_date)).length;
    const aiCost = accountCampaigns.reduce((sum: number, c: any) => sum + (Number(c.total_cost) || 0), 0);
    const messagesSent = accountLeads.reduce((sum: number, l: any) => sum + (Number(l.message_count_sent) || 0), 0);
    const leadsContacted = accountLeads.filter((l: any) => (Number(l.message_count_sent) || 0) > 0).length;
    const leadsResponded = accountLeads.filter((l: any) => (Number(l.message_count_received) || 0) > 0).length;
    const responseRate = leadsContacted > 0 ? Math.round((leadsResponded / leadsContacted) * 100) : 0;
    return {
      totalLeads: accountLeads.length,
      activeCampaigns: accountCampaigns.filter((c: any) => c.status === "Active").length,
      callsBooked,
      aiCost,
      messagesSent,
      responseRate,
    };
  }, [filteredLeads, campaigns, currentAccountId, selectedCampaignId]);

  const isLoading = leadsLoading || campaignsLoading || accountsLoading;
  const isRefreshing = leadsLoading || campaignsLoading || metricsLoading || trendsLoading;

  // Format last refreshed time as relative string
  const lastRefreshedLabel = useMemo(() => {
    if (!lastRefreshedAt) return null;
    const diffSeconds = Math.round((Date.now() - lastRefreshedAt.getTime()) / 1000);
    if (diffSeconds < 5) return "just now";
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const mins = Math.floor(diffSeconds / 60);
    return `${mins}m ago`;
  }, [lastRefreshedAt, countdown]);

  // Agency filter bar
  const agencyFilterBar = (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {/* Date range */}
      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      {/* Right side: refresh + customize */}
      <div className="ml-auto flex items-center gap-2">
        {/* Customize button (popover) */}
        <div className="relative" ref={customizeRef}>
          <button type="button"
            onClick={() => setCustomizeOpen(!customizeOpen)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="text-xs">Customize</span>
          </button>
          {customizeOpen && (
            <div className="absolute top-full right-0 mt-1 w-52 rounded-2xl border border-border bg-popover shadow-xl z-50 p-3">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Visible Widgets</div>
              <div className="space-y-1">
                {agencyWidgetPrefs.widgetList.map((w) => (
                  <button key={w.id} type="button"
                    onClick={() => agencyWidgetPrefs.toggleWidget(w.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-xs font-medium text-foreground">{w.label}</span>
                    <div className={cn("w-8 h-4 rounded-full transition-all relative flex-shrink-0",
                      w.visible ? "bg-brand-blue" : "bg-muted"
                    )}>
                      <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all",
                        w.visible ? "left-4" : "left-0.5"
                      )} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Refresh button */}
        <button type="button" onClick={refreshAllData} disabled={isRefreshing}
          className={cn("inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all",
            isRefreshing && "opacity-60 cursor-not-allowed"
          )}
          data-testid="dashboard-refresh-now-btn"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
          {lastRefreshedLabel && <span className="text-xs hidden sm:inline">{lastRefreshedLabel}</span>}
        </button>
        {intervalSeconds > 0 && (
          <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground"
            data-testid="auto-refresh-countdown"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{countdown}s</span>
          </div>
        )}
      </div>
    </div>
  );

  // Subaccount filter bar
  const subaccountFilterBar = (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      {/* Campaign dropdown */}
      <div className="relative" ref={campaignDropdownRef}>
        <button type="button" onClick={() => setCampaignDropdownOpen(!campaignDropdownOpen)}
          className={cn("inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-semibold transition-all",
            selectedCampaignId === "all"
              ? "border-border bg-card text-foreground hover:bg-muted/50"
              : "border-brand-yellow/50 bg-brand-yellow/10 text-foreground hover:bg-brand-yellow/20"
          )}
        >
          <Megaphone className="w-4 h-4 text-muted-foreground" />
          <span className="max-w-[160px] truncate">{selectedCampaignId === "all" ? "All Campaigns" : campaigns.find((c: any) => (c.id || c.Id) === selectedCampaignId)?.name || "Campaign"}</span>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", campaignDropdownOpen && "rotate-180")} />
        </button>
        {campaignDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-border bg-card shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
            <button type="button" onClick={() => { setSelectedCampaignId("all"); setCampaignDropdownOpen(false); }}
              className={cn("w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50",
                selectedCampaignId === "all" ? "text-brand-yellow font-bold" : "text-foreground"
              )}
            >All Campaigns</button>
            {campaignOptions.map((c: any) => {
              const cId = c.id || c.Id;
              return (
                <button key={cId} type="button" onClick={() => { setSelectedCampaignId(cId); setCampaignDropdownOpen(false); }}
                  className={cn("w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50",
                    selectedCampaignId === cId ? "text-brand-yellow font-bold" : "text-foreground"
                  )}
                >
                  <div className="truncate">{c.name || c.Name}</div>
                  {c.status && <div className="text-[10px] text-muted-foreground">{c.status}</div>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: customize + refresh */}
      <div className="ml-auto flex items-center gap-2">
        {/* Customize popover */}
        <div className="relative" ref={!isAgencyView ? customizeRef : undefined}>
          <button type="button" onClick={() => setCustomizeOpen(!customizeOpen)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="text-xs">Customize</span>
          </button>
          {customizeOpen && (
            <div className="absolute top-full right-0 mt-1 w-52 rounded-2xl border border-border bg-popover shadow-xl z-50 p-3">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Visible Widgets</div>
              <div className="space-y-1">
                {subaccountWidgetPrefs.widgetList.map((w) => (
                  <button key={w.id} type="button" onClick={() => subaccountWidgetPrefs.toggleWidget(w.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-xs font-medium text-foreground">{w.label}</span>
                    <div className={cn("w-8 h-4 rounded-full transition-all relative flex-shrink-0", w.visible ? "bg-brand-blue" : "bg-muted")}>
                      <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all", w.visible ? "left-4" : "left-0.5")} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Refresh */}
        <button type="button" onClick={refreshAllData} disabled={isRefreshing}
          className={cn("inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-all",
            isRefreshing && "opacity-60 cursor-not-allowed"
          )}
          data-testid="dashboard-refresh-now-btn"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
          {lastRefreshedLabel && <span className="text-xs hidden sm:inline">{lastRefreshedLabel}</span>}
        </button>
        {intervalSeconds > 0 && (
          <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground"
            data-testid="auto-refresh-countdown"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{countdown}s</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <CrmShell>
      <div className="pt-5 px-0" data-testid="page-dashboard">
        <div className="p-0">
          {isLoading ? (
            <SkeletonDashboard />
          ) : isAgencyView ? (
            <>
              {agencyFilterBar}
              <AgencyDashboard
                accounts={statusFilteredAccounts}
                allAccounts={accounts.filter((a: any) => (a.id || a.Id) !== 1)}
                campaigns={agencyFilteredCampaigns}
                allCampaigns={campaigns}
                leads={agencyFilteredLeads}
                campaignMetrics={agencyFilteredMetrics}
                metricsLoading={metricsLoading}
                trends={dashboardTrends}
                trendRange={trendRange}
                setTrendRange={setTrendRange}
                widgetPrefs={agencyWidgetPrefs}
                selectedAccountId={selectedAccountId}
                setSelectedAccountId={setSelectedAccountId}
                accountStatusFilter={accountStatusFilter}
                setAccountStatusFilter={setAccountStatusFilter}
                campaignStatusFilter={campaignStatusFilter}
                setCampaignStatusFilter={setCampaignStatusFilter}
              />
            </>
          ) : (
            <>
              {subaccountFilterBar}
              <SubaccountDashboard
                accountId={currentAccountId}
                selectedCampaignId={selectedCampaignId}
                setSelectedCampaignId={setSelectedCampaignId}
                campaignOptions={campaignOptions}
                stats={stats}
                funnel={funnel}
                stagePalette={stagePalette}
                leads={filteredLeads}
                campaigns={campaigns}
                campaignMetrics={filteredMetrics}
                metricsLoading={metricsLoading}
                trends={dashboardTrends}
                trendRange={trendRange}
                setTrendRange={setTrendRange}
                widgetPrefs={subaccountWidgetPrefs}
              />
            </>
          )}
        </div>
      </div>
    </CrmShell>
  );
}

// KpiTile: flat tile used in the 4-tile KPI row
function KpiTile({
  label, value, testId, icon, sparklineData, sparklineColor, accent
}: {
  label: string; value: string; testId: string; icon?: React.ReactNode;
  sparklineData?: SparklineDataPoint[]; sparklineColor?: string; accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between relative overflow-hidden"
      style={accent ? { borderLeft: "3px solid #FCB803" } : undefined}
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="flex items-end gap-2 mb-1">
        <div className="text-2xl font-black tracking-tight text-foreground" data-testid={`${testId}-value`}>{value}</div>
        {sparklineData && sparklineData.length >= 2 && (
          <TrendIndicator data={sparklineData} />
        )}
      </div>
      {sparklineData && sparklineData.length >= 2 && (
        <div className="mt-1">
          <KpiSparkline data={sparklineData} color={sparklineColor || "#3b82f6"} height={28} gradientId={`tile-spark-${testId}`} />
        </div>
      )}
    </div>
  );
}

// Legacy Stat component kept for backward compatibility
function Stat({
  label,
  value,
  testId,
  icon,
  sparklineData,
  sparklineColor,
}: {
  label: string;
  value: string;
  testId: string;
  icon?: React.ReactNode;
  sparklineData?: SparklineDataPoint[];
  sparklineColor?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between" data-testid={testId}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" data-testid={`${testId}-label`}>{label}</div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="flex items-end gap-2 mb-1">
        <div className="text-2xl font-black tracking-tight text-foreground" data-testid={`${testId}-value`}>{value}</div>
        {sparklineData && sparklineData.length >= 2 && (
          <TrendIndicator data={sparklineData} />
        )}
      </div>
      {sparklineData && sparklineData.length >= 2 && (
        <div className="mt-1">
          <KpiSparkline
            data={sparklineData}
            color={sparklineColor || "#3b82f6"}
            height={28}
            gradientId={`stat-spark-${testId}`}
          />
        </div>
      )}
    </div>
  );
}

function AgencyDashboard({
  accounts, allAccounts, campaigns, allCampaigns, leads, campaignMetrics, metricsLoading,
  trends, trendRange, setTrendRange, widgetPrefs,
  selectedAccountId, setSelectedAccountId,
  accountStatusFilter, setAccountStatusFilter,
  campaignStatusFilter, setCampaignStatusFilter,
}: {
  accounts: Account[];
  allAccounts: Account[];
  campaigns: Campaign[];
  allCampaigns: Campaign[];
  leads: Lead[];
  campaignMetrics: CampaignMetricsHistory[];
  metricsLoading: boolean;
  trends: DashboardTrend[];
  trendRange: 7 | 30;
  setTrendRange: (v: 7 | 30) => void;
  widgetPrefs: ReturnType<typeof useDashboardWidgetPrefs>;
  selectedAccountId: number | null;
  setSelectedAccountId: (id: number | null) => void;
  accountStatusFilter: "active" | "paused" | "all";
  setAccountStatusFilter: (v: "active" | "paused" | "all") => void;
  campaignStatusFilter: "active" | "paused" | "completed" | "all";
  setCampaignStatusFilter: (v: "active" | "paused" | "completed" | "all") => void;
}) {
  // Compute KPI stats (always from filtered scope)
  const totalCallsBooked = useMemo(() => leads.filter((l: any) => Boolean(l.booked_call_date)).length, [leads]);
  const agencyStats = useMemo(() => {
    const totalLeads = leads.length;
    const messagesSent = leads.reduce((sum: number, l: any) => sum + (Number(l.message_count_sent) || 0), 0);
    const leadsContacted = leads.filter((l: any) => (Number(l.message_count_sent) || 0) > 0).length;
    const leadsResponded = leads.filter((l: any) => (Number(l.message_count_received) || 0) > 0).length;
    const responseRate = leadsContacted > 0 ? Math.round((leadsResponded / leadsContacted) * 100) : 0;
    return { totalLeads, messagesSent, responseRate };
  }, [leads]);

  // Sparkline data from trends
  const bookingsSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.bookings })), [trends]);
  const responseRateSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.responseRate })), [trends]);
  const leadsSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.leadsTargeted })), [trends]);
  const messagesSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.messagesSent })), [trends]);

  // Build accounts name lookup from allAccounts (not just status-filtered) for campaign rows
  const accountsMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const a of allAccounts) {
      const id = (a as any).id || (a as any).Id;
      map[id] = (a as any).name || (a as any).Name || `Account ${id}`;
    }
    return map;
  }, [allAccounts]);

  // Per-account campaign counts from allCampaigns (unaffected by campaign status filter)
  const campaignCountByAccount = useMemo(() => {
    const map: Record<number, number> = {};
    for (const c of allCampaigns) {
      const aid = (c as any).account_id || (c as any).accounts_id || (c as any).Accounts_id;
      if (aid) map[aid] = (map[aid] || 0) + 1;
    }
    return map;
  }, [allCampaigns]);

  return (
    <div className="space-y-6" data-testid="agency-dashboard">
      {/* KPI Strip */}
      {widgetPrefs.isVisible("kpi-strip") && (
        <section data-testid="kpi-strip">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Portfolio Overview</h3>
            <TrendRangeToggle value={trendRange} onChange={setTrendRange} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="secondary-kpi-cards">
            <KpiTile label="Calls Booked" value={String(totalCallsBooked)} testId="stat-bookings" icon={<CalendarIcon className="w-4 h-4" />} sparklineData={bookingsSparkline} sparklineColor="#FCB803" accent />
            <KpiTile label="Response Rate" value={`${agencyStats.responseRate}%`} testId="stat-response-rate" icon={<TrendingUp className="w-4 h-4" />} sparklineData={responseRateSparkline} sparklineColor="#10b981" />
            <KpiTile label="Total Leads" value={String(agencyStats.totalLeads)} testId="stat-total-leads" icon={<Users className="w-4 h-4" />} sparklineData={leadsSparkline} sparklineColor="#3b82f6" />
            <KpiTile label="Messages Sent" value={String(agencyStats.messagesSent)} testId="stat-messages-sent" icon={<MessageSquare className="w-4 h-4" />} sparklineData={messagesSparkline} sparklineColor="#8b5cf6" />
          </div>
        </section>
      )}

      {/* 2-panel: Accounts (left) + Campaigns (right) */}
      {widgetPrefs.isVisible("campaign-performance") && (
        <div className="flex gap-[3px]" style={{ minHeight: 520 }} data-testid="agency-two-panel">
          <AgencyAccountsPanel
            accounts={accounts}
            accountStatusFilter={accountStatusFilter}
            setAccountStatusFilter={setAccountStatusFilter}
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
            campaignCountByAccount={campaignCountByAccount}
          />
          <AgencyCampaignList
            campaigns={campaigns}
            metrics={campaignMetrics}
            accountsMap={accountsMap}
            loading={metricsLoading}
            campaignStatusFilter={campaignStatusFilter}
            setCampaignStatusFilter={setCampaignStatusFilter}
          />
        </div>
      )}
    </div>
  );
}

// Left panel: scrollable accounts list with status filter tabs
function AgencyAccountsPanel({
  accounts,
  accountStatusFilter,
  setAccountStatusFilter,
  selectedAccountId,
  setSelectedAccountId,
  campaignCountByAccount,
}: {
  accounts: Account[];
  accountStatusFilter: "active" | "paused" | "all";
  setAccountStatusFilter: (v: "active" | "paused" | "all") => void;
  selectedAccountId: number | null;
  setSelectedAccountId: (id: number | null) => void;
  campaignCountByAccount: Record<number, number>;
}) {
  return (
    <div
      className="w-[272px] shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden"
      data-testid="agency-accounts-panel"
    >
      {/* Header */}
      <div className="px-3.5 pt-4 pb-0 shrink-0 flex items-center justify-between">
        <h3 className="text-base font-semibold font-heading text-foreground leading-tight">Accounts</h3>
        <span className="h-[26px] w-[26px] rounded-full border border-border/50 flex items-center justify-center text-[10px] font-semibold tabular-nums text-muted-foreground shrink-0">
          {accounts.length}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="px-3 pt-2.5 pb-2 shrink-0">
        <div className="flex items-center gap-1">
          {(["active", "paused", "all"] as const).map((s) => {
            const isActive = accountStatusFilter === s;
            const label = s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1);
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setAccountStatusFilter(s);
                  setSelectedAccountId(null);
                }}
                className={cn(
                  "h-[26px] px-2.5 rounded-full text-[11px] font-semibold transition-colors",
                  isActive
                    ? "bg-[#FFE35B] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable account list */}
      <div className="flex-1 overflow-y-auto pb-2">
        {/* All Accounts row (always first) */}
        <div
          role="button"
          tabIndex={0}
          className={cn(
            "relative mx-[3px] my-0.5 rounded-xl cursor-pointer px-2.5 py-2.5 flex items-center gap-2.5",
            selectedAccountId === null
              ? "bg-[#FFF1C8]"
              : "bg-[#F1F1F1] hover:bg-[#FAFAFA]"
          )}
          onClick={() => setSelectedAccountId(null)}
          onKeyDown={(e) => e.key === "Enter" && setSelectedAccountId(null)}
          data-testid="agency-account-row-all"
        >
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#E5E7EB", color: "#374151" }}
          >
            <Users className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">All Accounts</p>
            <p className="text-[11px] text-muted-foreground">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Individual account rows */}
        {accounts.map((account) => {
          const id = (account as any).id || (account as any).Id;
          const name = String((account as any).name || (account as any).Name || `Account ${id}`);
          const status = String((account as any).status || "");
          const pastel = getDashAvatarPastel(name);
          const statusHex = ACCOUNT_STATUS_HEX[status] || "#94A3B8";
          const campaignCount = campaignCountByAccount[id] || 0;
          const isSelected = selectedAccountId === id;

          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              className={cn(
                "relative mx-[3px] my-0.5 rounded-xl cursor-pointer px-2.5 py-2.5 flex items-center gap-2.5",
                isSelected ? "bg-[#FFF1C8]" : "bg-[#F1F1F1] hover:bg-[#FAFAFA]"
              )}
              onClick={() => setSelectedAccountId(isSelected ? null : id)}
              onKeyDown={(e) => e.key === "Enter" && setSelectedAccountId(isSelected ? null : id)}
              data-testid={`agency-account-row-${id}`}
            >
              {/* Acronym circle */}
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ backgroundColor: pastel.bg, color: pastel.text }}
              >
                {getDashInitials(name)}
              </div>

              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: statusHex }} />
                  <span className="text-[11px] text-muted-foreground">{status || "Unknown"}</span>
                  {campaignCount > 0 && (
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                      · {campaignCount} cmp
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="flex items-center justify-center py-10 px-4 text-center">
            <p className="text-xs text-muted-foreground">No accounts match this filter</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Right panel: campaign list with account acronym circles
function AgencyCampaignList({
  campaigns, metrics, accountsMap, loading,
  campaignStatusFilter, setCampaignStatusFilter,
}: {
  campaigns: Campaign[];
  metrics: CampaignMetricsHistory[];
  accountsMap: Record<number, string>;
  loading?: boolean;
  campaignStatusFilter: "active" | "paused" | "completed" | "all";
  setCampaignStatusFilter: (v: "active" | "paused" | "completed" | "all") => void;
}) {
  const metricsByCampaign = useMemo(() => {
    const map: Record<number, CampaignMetricsHistory[]> = {};
    for (const m of metrics) {
      const cid = (m as any).campaigns_id || (m as any).campaignsId || 0;
      if (!map[cid]) map[cid] = [];
      map[cid].push(m);
    }
    for (const cid of Object.keys(map)) {
      map[Number(cid)].sort((a, b) => (a.metric_date || "").localeCompare(b.metric_date || ""));
    }
    return map;
  }, [metrics]);

  return (
    <div
      className="flex-1 min-w-0 flex flex-col bg-card rounded-lg overflow-hidden"
      data-testid="agency-campaigns-panel"
    >
      {/* Panel header */}
      <div className="px-4 pt-4 pb-3 shrink-0 flex items-center justify-between gap-2 border-b border-border/30">
        {/* Left: title + count */}
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold font-heading text-foreground leading-tight">Campaigns</h3>
          <span className="h-[26px] w-[26px] rounded-full border border-border/50 flex items-center justify-center text-[10px] font-semibold tabular-nums text-muted-foreground shrink-0">
            {campaigns.length}
          </span>
        </div>

        {/* Right: campaign status filter pills */}
        <div className="flex items-center gap-1">
          {(["active", "paused", "completed", "all"] as const).map((s) => {
            const isActive = campaignStatusFilter === s;
            const label = s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1);
            return (
              <button
                key={s}
                type="button"
                onClick={() => setCampaignStatusFilter(s)}
                className={cn(
                  "h-[26px] px-2.5 rounded-full text-[11px] font-semibold transition-colors",
                  isActive
                    ? "bg-[#FFE35B] text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Column headers — desktop only */}
      <div className="hidden md:grid grid-cols-[36px_2fr_90px_72px_72px_72px_72px] gap-3 px-4 pt-3 pb-1 shrink-0">
        <div />
        {["Campaign", "Status", "Response", "Booking", "Messages", "Booked"].map((h) => (
          <div key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</div>
        ))}
      </div>

      {/* Scrollable campaign rows */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {loading && (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl bg-muted/50 animate-pulse h-14" />
            ))}
          </>
        )}

        {!loading && campaigns.length === 0 && (
          <div className="flex items-center justify-center py-16 px-4">
            <DataEmptyState
              variant="campaigns"
              title="No campaigns"
              description="No campaigns match the current filters."
            />
          </div>
        )}

        {!loading && campaigns.map((campaign) => {
          const cMetrics = metricsByCampaign[campaign.id] || [];
          const latest = cMetrics.length > 0 ? cMetrics[cMetrics.length - 1] : null;
          const responseRate = latest ? Number(latest.response_rate_percent) || 0 : 0;
          const bookingRate = latest ? Number(latest.booking_rate_percent) || 0 : 0;
          const totalMessages = cMetrics.reduce((s, m) => s + m.total_messages_sent, 0);
          const totalBookings = cMetrics.reduce((s, m) => s + m.bookings_generated, 0);
          const needsAttention = cMetrics.length > 0 && responseRate < 10 && bookingRate < 5;
          const statusColor = getCampaignStatusColor(campaign.status);
          const accountId = (campaign as any).account_id || (campaign as any).accounts_id || (campaign as any).Accounts_id;
          const accountName = accountsMap[accountId] || `Account ${accountId}`;
          const pastel = getDashAvatarPastel(accountName);

          return (
            <div
              key={campaign.id}
              className={cn(
                "rounded-xl px-3 py-2.5",
                "grid grid-cols-1 md:grid-cols-[36px_2fr_90px_72px_72px_72px_72px] gap-2 md:gap-3 items-center",
                "hover:bg-muted/40 transition-colors duration-150",
                needsAttention && "border-l-2 border-l-amber-400 pl-2.5 md:pl-2.5"
              )}
              data-testid={`campaign-row-${campaign.id}`}
            >
              {/* Account acronym circle */}
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 hidden md:flex"
                style={{ backgroundColor: pastel.bg, color: pastel.text }}
                title={accountName}
              >
                {getDashInitials(accountName)}
              </div>

              {/* Campaign name + account sub-label */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-foreground truncate leading-snug">{campaign.name}</div>
                  <div className="text-[11px] text-muted-foreground/70 truncate">{accountName}</div>
                </div>
                {needsAttention && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/10 text-amber-500 border border-amber-400/20 hidden md:inline-flex">
                    Needs Attention
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="hidden md:flex items-center">
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                >
                  {campaign.status}
                </span>
              </div>

              {/* Response rate */}
              <div className="hidden md:block">
                <div className="text-sm font-black text-foreground tabular-nums">{responseRate}%</div>
                <div className="text-[9px] text-muted-foreground">resp.</div>
              </div>

              {/* Booking rate */}
              <div className="hidden md:block">
                <div className="text-sm font-black text-foreground tabular-nums">{bookingRate}%</div>
                <div className="text-[9px] text-muted-foreground">booking</div>
              </div>

              {/* Messages sent */}
              <div className="hidden md:block">
                <div className="text-sm font-black text-foreground tabular-nums">{totalMessages}</div>
                <div className="text-[9px] text-muted-foreground">msgs</div>
              </div>

              {/* Bookings generated */}
              <div className="hidden md:block">
                <div
                  className="text-sm font-black tabular-nums"
                  style={{ color: totalBookings > 0 ? "#FCB803" : undefined }}
                >
                  {totalBookings}
                </div>
                <div className="text-[9px] text-muted-foreground">booked</div>
              </div>

              {/* Mobile: compact row */}
              <div className="flex items-center gap-3 md:hidden text-xs text-muted-foreground">
                {/* Mobile acronym circle */}
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{ backgroundColor: pastel.bg, color: pastel.text }}
                >
                  {getDashInitials(accountName)}
                </div>
                <span><span className="font-bold text-foreground">{responseRate}%</span> resp</span>
                <span><span className="font-bold text-foreground">{bookingRate}%</span> book</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                >
                  {campaign.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubaccountDashboard({
  accountId,
  selectedCampaignId,
  setSelectedCampaignId,
  campaignOptions,
  stats,
  funnel,
  stagePalette,
  leads,
  campaigns,
  campaignMetrics,
  metricsLoading,
  trends,
  trendRange,
  setTrendRange,
  widgetPrefs,
}: {
  accountId: number;
  selectedCampaignId: number | "all";
  setSelectedCampaignId: (v: number | "all") => void;
  campaignOptions: any[];
  stats: any;
  funnel: any[];
  stagePalette: any[];
  leads: Lead[];
  campaigns: Campaign[];
  campaignMetrics: CampaignMetricsHistory[];
  metricsLoading: boolean;
  trends: DashboardTrend[];
  trendRange: 7 | 30;
  setTrendRange: (v: 7 | 30) => void;
  widgetPrefs: ReturnType<typeof useDashboardWidgetPrefs>;
}) {
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 350;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Build performance-over-time data from real trend data
  const leadGrowthData = useMemo(() => {
    if (!trends || trends.length === 0) return [];
    return trends.map((t) => ({
      name: t.date ? t.date.substring(5) : "",
      leads: t.leadsTargeted || 0,
      messages: t.messagesSent || 0,
      bookings: t.bookings || 0,
    }));
  }, [trends]);

  // Extract sparkline data series from trends
  const bookingsSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.bookings })), [trends]);
  const responseRateSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.responseRate })), [trends]);
  const leadsSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.leadsTargeted })), [trends]);
  const messagesSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.messagesSent })), [trends]);

  const anyMiddleWidgetVisible =
    widgetPrefs.isVisible("performance-chart") ||
    widgetPrefs.isVisible("sales-funnel") ||
    widgetPrefs.isVisible("hot-leads") ||
    widgetPrefs.isVisible("score-distribution");

  return (
    <div className="space-y-8" data-testid="subaccount-dashboard">
      {/* 1. KPI Strip */}
      {widgetPrefs.isVisible("kpi-strip") && (
        <section data-testid="kpi-strip">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Overview</h3>
            <TrendRangeToggle value={trendRange} onChange={setTrendRange} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="secondary-kpi-cards">
            <KpiTile label="Calls Booked" value={String(stats.callsBooked)} testId="stat-bookings" icon={<CalendarIcon className="w-4 h-4" />} sparklineData={bookingsSparkline} sparklineColor="#FCB803" accent />
            <KpiTile label="Response Rate" value={`${stats.responseRate}%`} testId="stat-response-rate" icon={<TrendingUp className="w-4 h-4" />} sparklineData={responseRateSparkline} sparklineColor="#10b981" />
            <KpiTile label="Total Leads" value={String(stats.totalLeads)} testId="stat-total-leads" icon={<Users className="w-4 h-4" />} sparklineData={leadsSparkline} sparklineColor="#3b82f6" />
            <KpiTile label="Messages Sent" value={String(stats.messagesSent)} testId="stat-messages-sent" icon={<MessageSquare className="w-4 h-4" />} sparklineData={messagesSparkline} sparklineColor="#8b5cf6" />
          </div>
        </section>
      )}

      {/* 2. Main 2-column: chart+funnel left, hot-leads+distribution right */}
      {anyMiddleWidgetVisible && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: performance chart + sales funnel */}
          {(widgetPrefs.isVisible("performance-chart") || widgetPrefs.isVisible("sales-funnel")) && (
            <div className="lg:col-span-2 space-y-4">
              {widgetPrefs.isVisible("performance-chart") && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col" data-testid="performance-chart">
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Performance Over Time</h3>
                    <div className="flex items-center gap-2 px-3 py-1 bg-brand-blue/10 text-brand-blue rounded-full text-[10px] font-bold">
                      <TrendingUp className="w-3 h-3" />
                      {trendRange === 7 ? "Last 7 days" : "Last 30 days"}
                    </div>
                  </div>
                  <div className="h-[200px]">
                    {leadGrowthData.length === 0 ? (
                      <div className="h-full flex items-center justify-center" data-testid="performance-chart-empty">
                        <DataEmptyState
                          variant="dashboard"
                          compact
                          title="No performance data"
                          description="Trend data will appear here once leads start receiving messages."
                        />
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={leadGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&_line]:stroke-border" stroke="currentColor" opacity={0.15} />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            dy={5}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                            formatter={(value: number, name: string) => [value, name === "leads" ? "Leads Targeted" : name === "messages" ? "Messages Sent" : "Bookings"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="messages"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorLeads)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              )}

              {widgetPrefs.isVisible("sales-funnel") && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col" data-testid="pipeline-funnel">
                  <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Sales Funnel</h3>
                  {(() => {
                    const totalLeads = funnel.reduce((sum: number, s: any) => sum + s.value, 0);
                    const stageCount = funnel.length;
                    const minWidth = 40;

                    if (totalLeads === 0) {
                      return (
                        <div className="flex items-center justify-center py-8" data-testid="funnel-empty-state">
                          <DataEmptyState
                            variant="leads"
                            compact
                            title="No pipeline data"
                            description="Add leads to this account to see the sales funnel breakdown."
                          />
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col justify-center gap-1 py-2">
                        {funnel.map((stage: any, idx: number) => {
                          const pct = totalLeads > 0 ? (stage.value / totalLeads) * 100 : 0;
                          const taperWidth = 100 - ((100 - minWidth) * idx / Math.max(stageCount - 1, 1));
                          return (
                            <div
                              key={stage.name}
                              className="flex flex-col items-center"
                              data-testid={`funnel-stage-${stage.name.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              <div
                                className="relative flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-700 ease-out group/stage cursor-default"
                                style={{
                                  width: `${taperWidth}%`,
                                  backgroundColor: `${stage.fill}18`,
                                  borderLeft: `3px solid ${stage.fill}`,
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[12px] font-bold text-muted-foreground truncate">{stage.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className="text-[11px] font-bold rounded-full px-2 py-0.5"
                                    style={{ color: stage.fill, backgroundColor: `${stage.fill}15` }}
                                    data-testid={`funnel-count-${stage.name.toLowerCase().replace(/\s+/g, '-')}`}
                                  >
                                    {stage.value}
                                  </span>
                                  <span
                                    className="text-[10px] font-bold text-muted-foreground tabular-nums"
                                    data-testid={`funnel-pct-${stage.name.toLowerCase().replace(/\s+/g, '-')}`}
                                  >
                                    {pct.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                              {idx < stageCount - 1 && (
                                <div className="h-1 w-px bg-border" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Right: hot leads + lead score distribution */}
          {(widgetPrefs.isVisible("hot-leads") || widgetPrefs.isVisible("score-distribution")) && (
            <div className="space-y-4">
              {widgetPrefs.isVisible("hot-leads") && <HotLeadsWidget leads={leads} />}
              {widgetPrefs.isVisible("score-distribution") && (
                <LeadScoreDistributionChart leads={leads.filter((l: any) => (l.account_id || l.accounts_id) === accountId)} />
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Campaign Performance */}
      {widgetPrefs.isVisible("campaign-performance") && (
        <CampaignPerformanceCards
          campaigns={campaigns.filter((c: any) => (c.account_id || c.accounts_id || c.Accounts_id) === accountId)}
          metrics={campaignMetrics}
          loading={metricsLoading}
        />
      )}

      {/* 4. Sales Pipeline (full width at bottom) */}
      {widgetPrefs.isVisible("sales-pipeline") && (
        <section
          className="p-0 flex flex-col -mb-3 relative"
          data-testid="section-pipeline"
        >
          <div className="flex items-center justify-between mb-4 px-1 md:px-0">
            <h2 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sales Pipeline</h2>
          </div>

          <div className="relative group/pipeline">
            {showLeftArrow && (
              <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-0 bottom-0 z-20 w-12 flex items-center justify-start pl-2 text-muted-foreground hover:text-foreground transition-all pointer-events-auto"
              >
                <div className="p-4 rounded-full bg-card shadow-2xl border border-border ml-6 hover:scale-110 transition-transform">
                  <ChevronLeft className="w-8 h-8" />
                </div>
              </button>
            )}

            {showRightArrow && (
              <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-0 bottom-0 z-20 w-12 flex items-center justify-end pr-2 text-muted-foreground hover:text-foreground transition-all pointer-events-auto"
              >
                <div className="p-4 rounded-full bg-card shadow-2xl border border-border mr-6 hover:scale-110 transition-transform">
                  <ChevronRight className="w-8 h-8" />
                </div>
              </button>
            )}

            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide -mx-10 px-10"
              data-testid="scroll-pipeline"
            >
              <div className="min-w-[1610px] grid grid-cols-7 gap-3 h-[calc(100vh-170px)]" data-testid="grid-pipeline">
                {stagePalette.map((s) => (
                  <PipelineCol key={s.id} stage={s} accountId={accountId} campaignId={selectedCampaignId} leads={leads} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function PipelineCol({
  stage,
  accountId,
  campaignId,
  leads,
}: {
  stage: { id: string; label: string; icon?: React.ReactNode; fill: string; textColor: "black" | "white" };
  accountId: number;
  campaignId: number | "all";
  leads: Lead[];
}) {
  const items = useMemo(() => {
    const filtered = leads
      .filter((l: any) => (l.account_id || l.accounts_id) === accountId)
      .filter((l: any) => (campaignId === "all" ? true : (l.campaign_id || l.campaigns_id) === campaignId));

    const isMatch = (s: string) => s === stage.id;

    return filtered.filter((l: any) => isMatch(l.conversion_status));
  }, [leads, accountId, campaignId, stage.id]);

  const formatTimeAgo = (timestamp: string | number) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    const elapsedMs = (Date.now() - date);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(elapsedSeconds / 3600);
    if (hours > 24) return `${Math.floor(hours / 24)}d ago`;
    return `${hours}h ago`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getTagColor = (tagName: string) => {
    const normalized = tagName.toLowerCase();
    for (const cat of TAG_CATEGORIES) {
      const tag = cat.tags.find(t => t.name.toLowerCase() === normalized);
      if (tag) return tag.color;
    }
    if (normalized.includes('booked')) return "#FCB803";
    if (normalized.includes('qualified')) return "#22C55E";
    if (normalized.includes('follow')) return "#F97316";
    if (normalized.includes('lead')) return "#3B82F6";
    if (normalized.includes('ai')) return "#EF4444";
    return "#64748b";
  };

  return (
    <div className="w-full bg-card flex flex-col h-full rounded-2xl overflow-hidden shadow-sm border border-border" data-testid={`col-${stage.id}`}>
      {/* COLUMN HEADER */}
      <div className="p-4 border-b border-border bg-card/80 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: `${stage.fill}15`, color: stage.fill }}
            >
              {stage.icon && React.cloneElement(stage.icon as React.ReactElement<any>, { size: 14, strokeWidth: 2.5 })}
            </div>
            <h3 className="text-[15px] font-bold text-foreground tracking-tight">{stage.label}</h3>
          </div>
          <div
            className="px-2.5 py-1 rounded-full text-[12px] font-black"
            style={{ backgroundColor: `${stage.fill}10`, color: stage.fill }}
          >
            {items.length}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
        {items.map((l: any) => (
          <div
            key={l.id}
            className={cn(
              "rounded-xl cursor-pointer relative group",
              "transition-all duration-300 ease-in-out",
              "min-h-10 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20",
              "overflow-hidden",
              "p-2"
            )}
            style={{
              backgroundColor: `${stage.fill}0D`,
            }}
            onClick={() => {
              window.history.pushState({}, "", `/app/contacts/${l.id}`);
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            data-testid={`pill-contact-${stage.id}-${l.id}`}
          >
            {/* HOVER OVERLAY */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                backgroundColor: `${stage.fill}1A`,
              }}
            />

            {/* CARD CONTENT */}
            <div className="relative z-10">
              <div className="flex items-center gap-2" data-testid={`row-pill-header-${stage.id}-${l.id}`}>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 opacity-60"
                  style={{
                    backgroundColor: `${stage.fill}15`,
                    color: stage.id === 'Booked' ? '#131B49' : stage.fill,
                    border: `1px solid ${stage.fill}30`
                  }}
                >
                  {getInitials(l.full_name || "")}
                </div>
                <div
                  className="font-semibold text-xs truncate flex-grow"
                  style={{ color: stage.id === 'Booked' ? '#131B49' : stage.fill }}
                >
                  {l.full_name}
                </div>
                <span className="text-[9px] text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap opacity-30 group-hover:opacity-100 font-bold uppercase">
                  {l.created_at ? formatTimeAgo(l.created_at) : ""}
                </span>
              </div>

              <div className="max-h-0 group-hover:max-h-[500px] opacity-0 group-hover:opacity-100 transition-all duration-500 ease-in-out overflow-hidden">
                <div className="mt-3 space-y-2.5 pb-1">
                  <div className="space-y-1">
                    {l.email && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium bg-card/40 px-2 py-1 rounded-md border border-border/20">
                        <span className="opacity-50">@</span>
                        <span className="truncate">{l.email}</span>
                      </div>
                    )}
                    {l.phone && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium bg-card/40 px-2 py-1 rounded-md border border-border/20">
                        <span className="opacity-50">#</span>
                        <span>{l.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(l.tags || []).map((tag: string, idx: number) => {
                      const color = getTagColor(tag);
                      return (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[9px] font-bold border"
                          style={{
                            backgroundColor: color,
                            color: "#fff",
                            borderColor: color
                          }}
                        >
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <DataEmptyState variant="leads" compact title="No contacts" description="No leads in this pipeline stage." />
        ) : null}
      </div>
    </div>
  );
}
