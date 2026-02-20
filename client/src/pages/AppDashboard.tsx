import React, { useMemo, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeads, useCampaigns, useAccounts } from "@/hooks/useApiData";
import type { Lead, Campaign, Account } from "@/types/models";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

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

  // Fetch real data from API
  const { leads, loading: leadsLoading } = useLeads();
  const { campaigns, loading: campaignsLoading } = useCampaigns();
  const { accounts, loading: accountsLoading } = useAccounts();

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
    const accountLeads = leads
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
  }, [leads, currentAccountId, selectedCampaignId, stagePalette]);

  const stats = useMemo(() => {
    const accountLeads = leads
      .filter((l: any) => (l.account_id || l.accounts_id) === currentAccountId)
      .filter((l: any) => (selectedCampaignId === "all" ? true : (l.campaign_id || l.campaigns_id) === selectedCampaignId));

    const accountCampaigns = campaigns.filter((c: any) => (c.account_id || c.accounts_id) === currentAccountId);
    const bookingsMo = accountLeads.filter((l: any) => l.conversion_status === "Booked").length;
    const aiCost = accountCampaigns.reduce((sum: number, c: any) => sum + (Number(c.total_cost) || 0), 0);
    return {
      totalLeads: accountLeads.length,
      activeCampaigns: accountCampaigns.filter((c: any) => c.status === "Active").length,
      bookingsMo,
      aiCost,
    };
  }, [leads, campaigns, currentAccountId, selectedCampaignId]);

  const campaignOptions = useMemo(() => {
    return campaigns.filter((c: any) => (c.account_id || c.accounts_id) === currentAccountId);
  }, [campaigns, currentAccountId]);

  const isLoading = leadsLoading || campaignsLoading || accountsLoading;

  return (
    <CrmShell>
      <div className="py-4 px-0" data-testid="page-dashboard">
        <div className="p-0">
          <div className="px-1 md:px-0 mb-6 flex items-center justify-end">
            <FiltersBar selectedCampaignId={selectedCampaignId} setSelectedCampaignId={setSelectedCampaignId} />
          </div>
          {isLoading ? (
            <SkeletonDashboard />
          ) : isAgencyView ? (
            <AgencyDashboard accounts={accounts} campaigns={campaigns} />
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
              leads={leads}
            />
          )}
        </div>
      </div>
    </CrmShell>
  );
}

function AgencyDashboard({ accounts, campaigns }: { accounts: Account[]; campaigns: Campaign[] }) {
  const { currentAccountId } = useWorkspace();

  const subaccounts = useMemo(() => {
    return accounts.filter((a: any) => a.id !== 1);
  }, [accounts]);

  return (
    <div className="mt-6 space-y-12" data-testid="agency-dashboard">
      <QuickJumpCards />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {subaccounts.map((acc: any) => {
          const accCampaigns = campaigns.filter((c: any) => (c.account_id || c.accounts_id) === acc.id);
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

  const leadGrowthData = useMemo(() => [
    { name: "Jan", leads: 400 },
    { name: "Feb", leads: 300 },
    { name: "Mar", leads: 600 },
    { name: "Apr", leads: 800 },
    { name: "May", leads: 500 },
    { name: "Jun", leads: 900 },
    { name: "Jul", leads: 1000 },
    { name: "Aug", leads: 850 },
    { name: "Sep", leads: 1100 },
    { name: "Oct", leads: 1250 },
    { name: "Nov", leads: 1200 },
    { name: "Dec", leads: 1400 },
  ], []);

  return (
    <div className="mt-0 space-y-12 flex flex-col" data-testid="subaccount-dashboard">
      <QuickJumpCards />
      <div className="flex items-start justify-between -mt-10 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 flex-grow" data-testid="grid-kpis">
          <Stat label="Total Contacts" value={String(stats.totalLeads)} testId="stat-total" icon={<Users className="w-4 h-4" />} />
          <Stat label="Active Campaigns" value={String(stats.activeCampaigns)} testId="stat-active" icon={<Target className="w-4 h-4" />} />
          <Stat label="Bookings/Mo" value={String(stats.bookingsMo)} testId="stat-bookings" icon={<CalendarIcon className="w-4 h-4" />} />
          <Stat label="AI Cost" value={`$${stats.aiCost.toFixed(0)}`} testId="stat-cost" icon={<Zap className="w-4 h-4" />} />
          <Stat label="Avg Resp Time" value="4.2m" testId="stat-resp" icon={<Clock className="w-4 h-4" />} />
          <Stat label="Conv Rate" value="12.4%" testId="stat-conv" icon={<TrendingUp className="w-4 h-4" />} />
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[400px]">
          <div className="lg:col-span-2 flex flex-col min-h-[280px] lg:min-h-0">
            <div className="mb-4">
              <h3 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Performance Over Time</h3>
            </div>
            <div className="flex-grow rounded-2xl border border-border bg-card p-6 shadow-sm overflow-hidden pb-4 flex flex-col">
              <div className="flex items-center justify-end mb-4 shrink-0">
                <div className="flex items-center gap-2 px-3 py-1 bg-brand-blue/10 text-brand-blue rounded-full text-[10px] font-bold">
                  <TrendingUp className="w-3 h-3" />
                  +24% vs last year
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
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`${value}%`, 'Growth']}
                    />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorLeads)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="flex flex-col min-h-[300px] lg:min-h-0">
            <div className="mb-4">
              <h3 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sales Funnel</h3>
            </div>
            <div className="flex-grow rounded-2xl border border-border bg-card p-4 md:p-6 shadow-sm flex flex-col">
              <div className="flex-grow flex flex-col justify-between py-2">
                {funnel.map((stage: any, idx: number) => {
                  const maxVal = Math.max(...funnel.map((s: any) => s.value), 1);
                  return (
                    <div key={stage.name} className="space-y-1.5">
                      <div className="flex justify-between text-[13px] font-bold">
                        <span className="text-muted-foreground">{stage.name}</span>
                        <span className="text-foreground">{stage.value}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${(stage.value / maxVal) * 100}%`,
                            backgroundColor: stage.fill,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
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
}: {
  label: string;
  value: string;
  testId: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" data-testid={testId}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider" data-testid={`${testId}-label`}>{label}</div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="text-2xl font-black tracking-tight text-foreground" data-testid={`${testId}-value`}>{value}</div>
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
