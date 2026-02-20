import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeads, useCampaigns, useAccounts, useCampaignMetrics, useDashboardTrends } from "@/hooks/useApiData";
import { useDashboardRefreshInterval } from "@/hooks/useDashboardRefreshInterval";
import type { Lead, Campaign, Account, CampaignMetricsHistory, DashboardTrend } from "@/types/models";
import { KpiSparkline, TrendIndicator, TrendRangeToggle } from "@/components/crm/KpiSparkline";
import type { SparklineDataPoint } from "@/components/crm/KpiSparkline";
import { CampaignPerformanceCards } from "@/components/crm/CampaignPerformanceCards";
import { LeadScoreDistributionChart } from "@/components/crm/LeadScoreDistributionChart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { FiltersBar } from "@/components/crm/FiltersBar";
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
  Zap,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Inbox,
  Loader2,
  Building2,
  ChevronDown,
  RefreshCw,
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

const CSV_TAGS = [
  { name: "New Lead", color: "#3B82F6" },
  { name: "Contacted", color: "#10B981" },
  { name: "Follow-up Required", color: "#F59E0B" },
  { name: "Nurturing", color: "#8B5CF6" },
  { name: "Qualified", color: "#EC4899" },
  { name: "High Intent", color: "#EF4444" },
  { name: "Ready to Book", color: "#14B8A6" },
  { name: "Appointment Scheduled", color: "#6366F1" },
  { name: "Post-Call Follow-up", color: "#F43F5E" },
  { name: "Closed - Won", color: "#059669" },
  { name: "Closed - Lost", color: "#4B5563" },
  { name: "DND / Opt-out", color: "#1F2937" },
  { name: "Re-engagement", color: "#D946EF" },
  { name: "Future Interest", color: "#84CC16" },
  { name: "Pricing Inquiry", color: "#0EA5E9" },
  { name: "Technical Question", color: "#64748B" },
  { name: "Referral", color: "#A855F7" },
  { name: "Partner Lead", color: "#F97316" }
];

type DashboardTab = "pipeline" | "funnel";

/* ------------------------------------------------------------------ */
/* Quick-Jump Shortcut Cards                                           */
/* ------------------------------------------------------------------ */
const QUICK_JUMP_ITEMS = [
  {
    label: "Leads",
    route: "/contacts",
    icon: Users,
    color: "#3b82f6",
    description: "Manage contacts",
    testId: "quick-jump-leads",
  },
  {
    label: "Campaigns",
    route: "/campaigns",
    icon: Megaphone,
    color: "#8b5cf6",
    description: "View campaigns",
    testId: "quick-jump-campaigns",
  },
  {
    label: "Inbox",
    route: "/conversations",
    icon: Inbox,
    color: "#10b981",
    description: "Conversations",
    testId: "quick-jump-inbox",
  },
  {
    label: "Calendar",
    route: "/calendar",
    icon: CalendarIcon,
    color: "#f59e0b",
    description: "Scheduled calls",
    testId: "quick-jump-calendar",
  },
];

function QuickJumpCards() {
  const [, setLocation] = useLocation();
  const { isAgencyView } = useWorkspace();
  const prefix = isAgencyView ? "/agency" : "/subaccount";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="quick-jump-cards">
      {QUICK_JUMP_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.route}
            type="button"
            data-testid={item.testId}
            onClick={() => setLocation(`${prefix}${item.route}`)}
            className={cn(
              "group relative flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm",
              "hover:shadow-md hover:border-border transition-all duration-200",
              "text-left cursor-pointer"
            )}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${item.color}15`, color: item.color }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">{item.label}</div>
              <div className="text-[11px] text-muted-foreground truncate">{item.description}</div>
            </div>
            <ArrowUpRight
              className="ml-auto h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0"
            />
          </button>
        );
      })}
    </div>
  );
}

export default function AppDashboard() {
  const { currentAccountId, isAgencyView, currentAccount } = useWorkspace();
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "all">("all");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("pipeline");
  const [isBookedReportOpen, setIsBookedReportOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>(getDefaultDateRange);
  const [trendRange, setTrendRange] = useState<7 | 30>(7);

  // Agency account filter — "all" = aggregate, or a specific account ID
  const [dashboardAccountFilter, setDashboardAccountFilter] = useState<number | "all">("all");
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  // Campaign filter dropdown state
  const [campaignDropdownOpen, setCampaignDropdownOpen] = useState(false);
  const campaignDropdownRef = useRef<HTMLDivElement>(null);

  // Close account dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    }
    if (accountDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [accountDropdownOpen]);

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

  // Auto-refresh interval setting (persisted in localStorage)
  const { intervalSeconds } = useDashboardRefreshInterval();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch real data from API
  const { leads, loading: leadsLoading, refresh: refreshLeads } = useLeads();
  const { campaigns, loading: campaignsLoading, refresh: refreshCampaigns } = useCampaigns();
  const { accounts, loading: accountsLoading, refresh: refreshAccounts } = useAccounts();
  const { metrics: campaignMetrics, loading: metricsLoading, refresh: refreshMetrics } = useCampaignMetrics();
  // For agency view with a specific account filter, pass accountId to trends
  const trendAccountId = isAgencyView
    ? (dashboardAccountFilter === "all" ? undefined : dashboardAccountFilter)
    : currentAccountId;
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
    // Clear any existing countdown timer
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (intervalSeconds <= 0) {
      setCountdown(0);
      return;
    }

    // Start countdown from interval
    setCountdown(intervalSeconds);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time to refresh — trigger data refresh
          refreshAllData();
          return intervalSeconds; // reset countdown
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

  // Filter leads by date range (uses created_at as the primary date field)
  const filteredLeads = useMemo(() => {
    return leads.filter((l: any) => {
      // Use created_at as the date to filter by; fall back to updated_at or last_interaction_at
      const dateField = l.created_at || l.updated_at || l.last_interaction_at;
      return isWithinDateRange(dateField, dateRange);
    });
  }, [leads, dateRange]);

  // Filter campaign metrics by date range
  const filteredMetrics = useMemo(() => {
    return campaignMetrics.filter((m: any) => {
      return isWithinDateRange(m.metric_date || m.created_at, dateRange);
    });
  }, [campaignMetrics, dateRange]);

  // Agency account-scoped data: filter leads, campaigns, and metrics when a specific account is selected
  const agencyFilteredLeads = useMemo(() => {
    if (!isAgencyView || dashboardAccountFilter === "all") return filteredLeads;
    return filteredLeads.filter((l: any) => (l.account_id || l.accounts_id) === dashboardAccountFilter);
  }, [filteredLeads, dashboardAccountFilter, isAgencyView]);

  const agencyFilteredCampaigns = useMemo(() => {
    if (!isAgencyView || dashboardAccountFilter === "all") return campaigns;
    return campaigns.filter((c: any) => (c.account_id || c.accounts_id || c.Accounts_id) === dashboardAccountFilter);
  }, [campaigns, dashboardAccountFilter, isAgencyView]);

  const agencyFilteredMetrics = useMemo(() => {
    if (!isAgencyView || dashboardAccountFilter === "all") return filteredMetrics;
    // Filter metrics by campaign IDs that belong to the selected account
    const accountCampaignIds = new Set(agencyFilteredCampaigns.map((c: any) => c.id || c.Id));
    return filteredMetrics.filter((m: any) => accountCampaignIds.has(m.campaigns_id || m.campaignsId));
  }, [filteredMetrics, dashboardAccountFilter, isAgencyView, agencyFilteredCampaigns]);

  // Selected account name for dropdown display
  const selectedAccountName = useMemo(() => {
    if (dashboardAccountFilter === "all") return "All Accounts";
    const acc = accounts.find((a: any) => (a.id || a.Id) === dashboardAccountFilter);
    return acc?.name || acc?.Name || `Account ${dashboardAccountFilter}`;
  }, [dashboardAccountFilter, accounts]);

  // Campaign options for dropdown — scoped by current view/account filter
  const dashboardCampaignOptions = useMemo(() => {
    if (isAgencyView) {
      // Agency view: if a specific account is selected, show only its campaigns; otherwise show all
      if (dashboardAccountFilter === "all") return campaigns;
      return campaigns.filter((c: any) => (c.account_id || c.accounts_id || c.Accounts_id) === dashboardAccountFilter);
    }
    // Subaccount view: show campaigns for the current account
    return campaigns.filter((c: any) => (c.account_id || c.accounts_id || c.Accounts_id) === currentAccountId);
  }, [campaigns, isAgencyView, dashboardAccountFilter, currentAccountId]);

  // When account filter changes in agency view, reset campaign filter if the selected campaign doesn't belong to the new account
  useEffect(() => {
    if (selectedCampaignId !== "all") {
      const campaignStillValid = dashboardCampaignOptions.some((c: any) => (c.id || c.Id) === selectedCampaignId);
      if (!campaignStillValid) {
        setSelectedCampaignId("all");
      }
    }
  }, [dashboardAccountFilter, dashboardCampaignOptions, selectedCampaignId]);

  // Selected campaign name for dropdown display
  const selectedCampaignName = useMemo(() => {
    if (selectedCampaignId === "all") return "All Campaigns";
    const c = campaigns.find((c: any) => (c.id || c.Id) === selectedCampaignId);
    return c?.name || c?.Name || `Campaign ${selectedCampaignId}`;
  }, [selectedCampaignId, campaigns]);

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
    // Count leads with actual booked_call_date (north star KPI)
    const callsBooked = accountLeads.filter((l: any) => Boolean(l.booked_call_date)).length;
    const aiCost = accountCampaigns.reduce((sum: number, c: any) => sum + (Number(c.total_cost) || 0), 0);
    // Messages sent: sum of message_count_sent across all account leads
    const messagesSent = accountLeads.reduce((sum: number, l: any) => sum + (Number(l.message_count_sent) || 0), 0);
    // Response rate: percentage of leads that received at least one response
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

  const campaignOptions = useMemo(() => {
    return campaigns.filter((c: any) => (c.account_id || c.accounts_id) === currentAccountId);
  }, [campaigns, currentAccountId]);

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
  }, [lastRefreshedAt, countdown]); // countdown dep to re-compute every second

  return (
    <CrmShell>
      <div className="py-4 px-0" data-testid="page-dashboard">
        <div className="p-0">
          <div className="px-1 md:px-0 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <DateRangeFilter value={dateRange} onChange={setDateRange} />
              {/* Account filter dropdown — agency view only */}
              {isAgencyView && (
                <div className="relative" ref={accountDropdownRef} data-testid="account-filter-wrapper">
                  <button
                    type="button"
                    onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                    className={cn(
                      "inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-semibold transition-all",
                      dashboardAccountFilter === "all"
                        ? "border-border bg-card text-foreground hover:bg-muted/50"
                        : "border-brand-yellow/50 bg-brand-yellow/10 text-foreground hover:bg-brand-yellow/20"
                    )}
                    data-testid="account-filter-dropdown"
                  >
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="max-w-[160px] truncate">{selectedAccountName}</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", accountDropdownOpen && "rotate-180")} />
                  </button>
                  {accountDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-border bg-card shadow-lg z-50 py-1 max-h-64 overflow-y-auto" data-testid="account-filter-options">
                      <button
                        type="button"
                        onClick={() => { setDashboardAccountFilter("all"); setAccountDropdownOpen(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50",
                          dashboardAccountFilter === "all" ? "text-brand-yellow font-bold bg-brand-yellow/5" : "text-foreground"
                        )}
                        data-testid="account-filter-option-all"
                      >
                        All Accounts
                      </button>
                      {accounts
                        .filter((a: any) => (a.id || a.Id) !== 1)
                        .map((acc: any) => {
                          const accId = acc.id || acc.Id;
                          return (
                            <button
                              key={accId}
                              type="button"
                              onClick={() => { setDashboardAccountFilter(accId); setAccountDropdownOpen(false); }}
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50",
                                dashboardAccountFilter === accId ? "text-brand-yellow font-bold bg-brand-yellow/5" : "text-foreground"
                              )}
                              data-testid={`account-filter-option-${accId}`}
                            >
                              {acc.name || acc.Name}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
              {/* Campaign filter dropdown — both views */}
              <div className="relative" ref={campaignDropdownRef} data-testid="campaign-filter-wrapper">
                <button
                  type="button"
                  onClick={() => setCampaignDropdownOpen(!campaignDropdownOpen)}
                  className={cn(
                    "inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-semibold transition-all",
                    selectedCampaignId === "all"
                      ? "border-border bg-card text-foreground hover:bg-muted/50"
                      : "border-brand-yellow/50 bg-brand-yellow/10 text-foreground hover:bg-brand-yellow/20"
                  )}
                  data-testid="campaign-filter-dropdown"
                >
                  <Megaphone className="w-4 h-4 text-muted-foreground" />
                  <span className="max-w-[160px] truncate">{selectedCampaignName}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", campaignDropdownOpen && "rotate-180")} />
                </button>
                {campaignDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-border bg-card shadow-lg z-50 py-1 max-h-64 overflow-y-auto" data-testid="campaign-filter-options">
                    <button
                      type="button"
                      onClick={() => { setSelectedCampaignId("all"); setCampaignDropdownOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50",
                        selectedCampaignId === "all" ? "text-brand-yellow font-bold bg-brand-yellow/5" : "text-foreground"
                      )}
                      data-testid="campaign-filter-option-all"
                    >
                      All Campaigns
                    </button>
                    {dashboardCampaignOptions.map((c: any) => {
                      const cId = c.id || c.Id;
                      return (
                        <button
                          key={cId}
                          type="button"
                          onClick={() => { setSelectedCampaignId(cId); setCampaignDropdownOpen(false); }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50",
                            selectedCampaignId === cId ? "text-brand-yellow font-bold bg-brand-yellow/5" : "text-foreground"
                          )}
                          data-testid={`campaign-filter-option-${cId}`}
                        >
                          <div className="truncate">{c.name || c.Name}</div>
                          {c.status && (
                            <div className="text-[10px] text-muted-foreground">{c.status}</div>
                          )}
                        </button>
                      );
                    })}
                    {dashboardCampaignOptions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground italic">No campaigns available</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <FiltersBar selectedCampaignId={selectedCampaignId} setSelectedCampaignId={setSelectedCampaignId} />
            {/* Auto-refresh status indicator */}
            <div className="flex items-center gap-2 ml-auto" data-testid="auto-refresh-indicator">
              <button
                type="button"
                onClick={refreshAllData}
                disabled={isRefreshing}
                title="Refresh data now"
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm font-semibold transition-all",
                  "border-border bg-card text-foreground hover:bg-muted/50",
                  isRefreshing && "opacity-60 cursor-not-allowed"
                )}
                data-testid="dashboard-refresh-now-btn"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", isRefreshing && "animate-spin")} />
                {lastRefreshedLabel && (
                  <span className="text-xs text-muted-foreground hidden sm:inline" data-testid="last-refreshed-label">
                    {lastRefreshedLabel}
                  </span>
                )}
              </button>
              {intervalSeconds > 0 && (
                <div
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground"
                  title={`Auto-refresh every ${intervalSeconds}s`}
                  data-testid="auto-refresh-countdown"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span data-testid="countdown-value">{countdown}s</span>
                </div>
              )}
            </div>
          </div>
          {isLoading ? (
            <SkeletonDashboard />
          ) : isAgencyView ? (
            <AgencyDashboard accounts={accounts} campaigns={agencyFilteredCampaigns} leads={agencyFilteredLeads} campaignMetrics={agencyFilteredMetrics} metricsLoading={metricsLoading} trends={dashboardTrends} trendRange={trendRange} setTrendRange={setTrendRange} dashboardAccountFilter={dashboardAccountFilter} selectedCampaignId={selectedCampaignId} />
          ) : (
            <SubaccountDashboard
              accountId={currentAccountId}
              selectedCampaignId={selectedCampaignId}
              setSelectedCampaignId={setSelectedCampaignId}
              campaignOptions={campaignOptions}
              stats={stats}
              funnel={funnel}
              stagePalette={stagePalette}
              isBookedReportOpen={isBookedReportOpen}
              setIsBookedReportOpen={setIsBookedReportOpen}
              dashboardTab={dashboardTab}
              leads={filteredLeads}
              campaigns={campaigns}
              campaignMetrics={filteredMetrics}
              metricsLoading={metricsLoading}
              trends={dashboardTrends}
              trendRange={trendRange}
              setTrendRange={setTrendRange}
            />
          )}
        </div>
      </div>
    </CrmShell>
  );
}

function AgencyDashboard({ accounts, campaigns, leads, campaignMetrics, metricsLoading, trends, trendRange, setTrendRange, dashboardAccountFilter, selectedCampaignId }: { accounts: Account[]; campaigns: Campaign[]; leads: Lead[]; campaignMetrics: CampaignMetricsHistory[]; metricsLoading: boolean; trends: DashboardTrend[]; trendRange: 7 | 30; setTrendRange: (v: 7 | 30) => void; dashboardAccountFilter: number | "all"; selectedCampaignId: number | "all" }) {
  const { currentAccountId } = useWorkspace();

  // Filter leads by selected campaign
  const campaignFilteredLeads = useMemo(() => {
    if (selectedCampaignId === "all") return leads;
    return leads.filter((l: any) => (l.campaign_id || l.campaigns_id) === selectedCampaignId);
  }, [leads, selectedCampaignId]);

  // Filter campaigns list when a specific campaign is selected
  const campaignFilteredCampaigns = useMemo(() => {
    if (selectedCampaignId === "all") return campaigns;
    return campaigns.filter((c: any) => (c.id || c.Id) === selectedCampaignId);
  }, [campaigns, selectedCampaignId]);

  // Filter metrics by selected campaign
  const campaignFilteredMetrics = useMemo(() => {
    if (selectedCampaignId === "all") return campaignMetrics;
    return campaignMetrics.filter((m: any) => (m.campaigns_id || m.campaignsId) === selectedCampaignId);
  }, [campaignMetrics, selectedCampaignId]);

  // When a specific account is selected, only show that one in the subaccounts section
  const subaccounts = useMemo(() => {
    const all = accounts.filter((a: any) => a.id !== 1);
    if (dashboardAccountFilter === "all") return all;
    return all.filter((a: any) => a.id === dashboardAccountFilter);
  }, [accounts, dashboardAccountFilter]);

  // Total calls booked across all accounts (respecting campaign filter)
  const totalCallsBooked = useMemo(() => {
    return campaignFilteredLeads.filter((l: any) => Boolean(l.booked_call_date)).length;
  }, [campaignFilteredLeads]);

  // Agency-wide secondary KPI stats (respecting campaign filter)
  const agencyStats = useMemo(() => {
    const totalLeads = campaignFilteredLeads.length;
    const activeCampaigns = campaignFilteredCampaigns.filter((c: any) => c.status === "Active").length;
    const messagesSent = campaignFilteredLeads.reduce((sum: number, l: any) => sum + (Number(l.message_count_sent) || 0), 0);
    const leadsContacted = campaignFilteredLeads.filter((l: any) => (Number(l.message_count_sent) || 0) > 0).length;
    const leadsResponded = campaignFilteredLeads.filter((l: any) => (Number(l.message_count_received) || 0) > 0).length;
    const responseRate = leadsContacted > 0 ? Math.round((leadsResponded / leadsContacted) * 100) : 0;
    return { totalLeads, activeCampaigns, messagesSent, responseRate };
  }, [campaignFilteredLeads, campaignFilteredCampaigns]);

  // Extract sparkline data series from trends
  const bookingsSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.bookings })), [trends]);
  const responseRateSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.responseRate })), [trends]);
  const leadsSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.leadsTargeted })), [trends]);
  const messagesSparkline: SparklineDataPoint[] = useMemo(() => trends.map((t) => ({ date: t.date, value: t.messagesSent })), [trends]);

  return (
    <div className="mt-6 space-y-12" data-testid="agency-dashboard">
      {/* Hero KPI + Secondary KPI cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 -mb-6" data-testid="secondary-kpi-cards">
        {/* Hero KPI: Calls Booked — largest, most prominent */}
        <div
          className="col-span-2 row-span-2 rounded-2xl border-2 shadow-lg relative overflow-hidden flex flex-col justify-between p-6"
          style={{ borderColor: '#FCB803', background: 'linear-gradient(135deg, rgba(252,184,3,0.08) 0%, rgba(252,184,3,0.02) 100%)' }}
          data-testid="stat-bookings"
        >
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: '#FCB803', transform: 'translate(30%, -30%)' }} />
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-5" style={{ background: '#FCB803', transform: 'translate(-30%, 30%)' }} />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(252,184,3,0.15)' }}>
                <CalendarIcon className="w-5 h-5" style={{ color: '#FCB803' }} />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest" data-testid="stat-bookings-label">Calls Booked</span>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-5xl md:text-6xl font-black tracking-tight text-foreground" data-testid="stat-bookings-value" style={{ lineHeight: 1.1 }}>
                {totalCallsBooked}
              </div>
              <TrendIndicator data={bookingsSparkline} color="#FCB803" />
            </div>
            {totalCallsBooked === 0 && agencyStats.totalLeads === 0 && (
              <p className="text-xs text-muted-foreground mt-2" data-testid="stat-bookings-empty-hint">
                Add leads and launch a campaign to start booking calls.
              </p>
            )}
          </div>
          <div className="relative z-10 mt-2">
            <KpiSparkline data={bookingsSparkline} color="#FCB803" height={48} gradientId="hero-bookings-spark" />
          </div>
          <div className="relative z-10 mt-2 flex items-center justify-between">
            <div className="text-xs text-muted-foreground font-medium">North Star KPI</div>
            <TrendRangeToggle value={trendRange} onChange={setTrendRange} />
          </div>
        </div>

        {/* Secondary KPI cards — response rate, total leads, active campaigns, messages sent */}
        <Stat label="Response Rate" value={`${agencyStats.responseRate}%`} testId="stat-response-rate" icon={<TrendingUp className="w-4 h-4" />} sparklineData={responseRateSparkline} sparklineColor="#10b981" />
        <Stat label="Total Leads" value={String(agencyStats.totalLeads)} testId="stat-total-leads" icon={<Users className="w-4 h-4" />} sparklineData={leadsSparkline} sparklineColor="#3b82f6" />
        <Stat label="Active Campaigns" value={String(agencyStats.activeCampaigns)} testId="stat-active-campaigns" icon={<Target className="w-4 h-4" />} />
        <Stat label="Messages Sent" value={String(agencyStats.messagesSent)} testId="stat-messages-sent" icon={<MessageSquare className="w-4 h-4" />} sparklineData={messagesSparkline} sparklineColor="#8b5cf6" />
      </div>

      <QuickJumpCards />
      <CampaignPerformanceCards
        campaigns={campaignFilteredCampaigns}
        metrics={campaignFilteredMetrics}
        loading={metricsLoading}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HotLeadsWidget leads={campaignFilteredLeads} />
        <LeadScoreDistributionChart leads={campaignFilteredLeads} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {subaccounts.map((acc: any) => {
          const accCampaigns = campaignFilteredCampaigns.filter((c: any) => (c.account_id || c.accounts_id) === acc.id);
          return (
            <div key={acc.id} className="rounded-2xl border border-border bg-card p-6 flex flex-col shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{acc.name}</h2>
                  <p className="text-sm text-muted-foreground">{acc.owner_email}</p>
                </div>
                <div className="px-3 py-1 bg-brand-yellow/20 text-brand-yellow rounded-full text-[10px] font-bold uppercase">
                  {acc.status}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Active Campaigns</h3>
                <div className="space-y-3">
                  {accCampaigns.length === 0 ? (
                    <DataEmptyState variant="campaigns" compact />
                  ) : (
                    accCampaigns.map((c: any) => (
                      <div key={c.id} className="p-4 rounded-2xl bg-muted/30 dark:bg-muted/10 border border-border flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm text-foreground">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.type}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-foreground">${Number(c.total_cost) || 0}</div>
                          <div className="text-[10px] text-muted-foreground">spend</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
  isBookedReportOpen,
  setIsBookedReportOpen,
  dashboardTab,
  leads,
  campaigns,
  campaignMetrics,
  metricsLoading,
  trends,
  trendRange,
  setTrendRange,
}: {
  accountId: number;
  selectedCampaignId: number | "all";
  setSelectedCampaignId: (v: number | "all") => void;
  campaignOptions: any[];
  stats: any;
  funnel: any[];
  stagePalette: any[];
  isBookedReportOpen: boolean;
  setIsBookedReportOpen: (v: boolean) => void;
  dashboardTab: DashboardTab;
  leads: Lead[];
  campaigns: Campaign[];
  campaignMetrics: CampaignMetricsHistory[];
  metricsLoading: boolean;
  trends: DashboardTrend[];
  trendRange: 7 | 30;
  setTrendRange: (v: 7 | 30) => void;
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

  // Build performance-over-time data from real trend data (messages sent over time)
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

  return (
    <div className="mt-0 space-y-12 flex flex-col" data-testid="subaccount-dashboard">
      <QuickJumpCards />
      <div className="-mt-10 mb-8" data-testid="grid-kpis">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="secondary-kpi-cards">
          {/* Hero KPI: Calls Booked — largest, most prominent, top-left */}
          <div
            className="col-span-2 row-span-2 rounded-2xl border-2 shadow-lg relative overflow-hidden flex flex-col justify-between p-6"
            style={{ borderColor: '#FCB803', background: 'linear-gradient(135deg, rgba(252,184,3,0.08) 0%, rgba(252,184,3,0.02) 100%)' }}
            data-testid="stat-bookings"
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: '#FCB803', transform: 'translate(30%, -30%)' }} />
            <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-5" style={{ background: '#FCB803', transform: 'translate(-30%, 30%)' }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(252,184,3,0.15)' }}>
                  <CalendarIcon className="w-5 h-5" style={{ color: '#FCB803' }} />
                </div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest" data-testid="stat-bookings-label">Calls Booked</span>
              </div>
              <div className="flex items-end gap-3">
                <div className="text-5xl md:text-6xl font-black tracking-tight text-foreground" data-testid="stat-bookings-value" style={{ lineHeight: 1.1 }}>
                  {stats.callsBooked}
                </div>
                <TrendIndicator data={bookingsSparkline} color="#FCB803" />
              </div>
              {stats.callsBooked === 0 && stats.totalLeads === 0 && (
                <p className="text-xs text-muted-foreground mt-2" data-testid="stat-bookings-empty-hint">
                  Add leads and launch a campaign to start booking calls.
                </p>
              )}
            </div>
            <div className="relative z-10 mt-2">
              <KpiSparkline data={bookingsSparkline} color="#FCB803" height={48} gradientId="sub-hero-bookings-spark" />
            </div>
            <div className="relative z-10 mt-2 flex items-center justify-between">
              <div className="text-xs text-muted-foreground font-medium">North Star KPI</div>
              <TrendRangeToggle value={trendRange} onChange={setTrendRange} />
            </div>
          </div>

          {/* Secondary KPI cards — response rate, total leads, active campaigns, messages sent */}
          <Stat label="Response Rate" value={`${stats.responseRate}%`} testId="stat-response-rate" icon={<TrendingUp className="w-4 h-4" />} sparklineData={responseRateSparkline} sparklineColor="#10b981" />
          <Stat label="Total Leads" value={String(stats.totalLeads)} testId="stat-total-leads" icon={<Users className="w-4 h-4" />} sparklineData={leadsSparkline} sparklineColor="#3b82f6" />
          <Stat label="Active Campaigns" value={String(stats.activeCampaigns)} testId="stat-active-campaigns" icon={<Target className="w-4 h-4" />} />
          <Stat label="Messages Sent" value={String(stats.messagesSent)} testId="stat-messages-sent" icon={<MessageSquare className="w-4 h-4" />} sparklineData={messagesSparkline} sparklineColor="#8b5cf6" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HotLeadsWidget leads={leads} />
        <LeadScoreDistributionChart leads={leads.filter((l: any) => (l.account_id || l.accounts_id) === accountId)} />
      </div>

      <CampaignPerformanceCards
        campaigns={campaigns.filter((c: any) => (c.account_id || c.accounts_id || c.Accounts_id) === accountId)}
        metrics={campaignMetrics}
        loading={metricsLoading}
      />

      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[400px]">
          <div className="lg:col-span-2 flex flex-col min-h-[280px] lg:min-h-0">
            <div className="mb-4">
              <h3 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Performance Over Time</h3>
            </div>
            <div className="flex-grow rounded-2xl border border-border bg-card p-6 shadow-sm overflow-hidden pb-4 flex flex-col">
              {leadGrowthData.length === 0 ? (
                <div className="flex-grow flex items-center justify-center" data-testid="performance-chart-empty">
                  <DataEmptyState
                    variant="dashboard"
                    compact
                    title="No performance data"
                    description="Trend data will appear here once leads start receiving messages."
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-end mb-4 shrink-0">
                    <div className="flex items-center gap-2 px-3 py-1 bg-brand-blue/10 text-brand-blue rounded-full text-[10px] font-bold">
                      <TrendingUp className="w-3 h-3" />
                      {trendRange === 7 ? "Last 7 days" : "Last 30 days"}
                    </div>
                  </div>
                  <div className="flex-grow -ml-2 -mb-2">
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
                          tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}}
                          dy={5}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}}
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
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col min-h-[300px] lg:min-h-0">
            <div className="mb-4">
              <h3 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sales Funnel</h3>
            </div>
            <div className="flex-grow rounded-2xl border border-border bg-card p-4 md:p-6 shadow-sm flex flex-col" data-testid="pipeline-funnel">
              {(() => {
                const totalLeads = funnel.reduce((sum: number, s: any) => sum + s.value, 0);
                const stageCount = funnel.length;
                // Funnel tapering: widest at top (100%), narrowest at bottom
                const minWidth = 40; // minimum width percentage for last stage

                // Empty state: no leads in this account/campaign
                if (totalLeads === 0) {
                  return (
                    <div className="flex-grow flex items-center justify-center" data-testid="funnel-empty-state">
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
                  <div className="flex-grow flex flex-col justify-center gap-1 py-2">
                    {funnel.map((stage: any, idx: number) => {
                      const pct = totalLeads > 0 ? (stage.value / totalLeads) * 100 : 0;
                      // Funnel taper: each stage gets progressively narrower
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
                          {/* Connector line between stages */}
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
          </div>
        </div>
      </div>

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
    </div>
  );
}

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
      <div className="p-4 border-b border-border bg-card/80  sticky top-0 z-20">
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
