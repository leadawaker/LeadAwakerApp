import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { campaigns, leads, interactions, automationLogs } from "@/data/mocks";
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
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function AppDashboard() {
  const { currentAccountId, isAgencyView, currentAccount } = useWorkspace();
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "all">("all");
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>("pipeline");
  const [isBookedReportOpen, setIsBookedReportOpen] = useState(false);

  const stagePalette = useMemo(() => [
    { id: "New" as const, label: "New", icon: <Zap className="w-3.5 h-3.5" />, fill: "#1a3a6f", textColor: "white" as const },
    { id: "Contacted" as const, label: "Contacted", icon: <MessageSquare className="w-3.5 h-3.5" />, fill: "#2d5aa8", textColor: "white" as const },
    { id: "Responded" as const, label: "Responded", icon: <TrendingUp className="w-3.5 h-3.5" />, fill: "#1E90FF", textColor: "white" as const },
    { id: "Multiple Responses" as const, label: "Multiple", icon: <ArrowUpRight className="w-3.5 h-3.5" />, fill: "#17A398", textColor: "white" as const },
    { id: "Qualified" as const, label: "Qualified", icon: <CheckCircle2 className="w-3.5 h-3.5" />, fill: "#10b981", textColor: "white" as const },
    { id: "Booked" as const, label: "Booked", icon: <CalendarIcon className="w-3.5 h-3.5" />, fill: "#facc15", textColor: "#ca8a04" as const },
    { id: "DND" as const, label: "DND", icon: <Target className="w-3.5 h-3.5" />, fill: "#ef4444", textColor: "white" as const },
  ], []);

  const funnel = useMemo(() => {
    const accountLeads = leads
      .filter((l) => l.account_id === currentAccountId)
      .filter((l) => (selectedCampaignId === "all" ? true : l.campaign_id === selectedCampaignId));

    const counts: Record<string, number> = {
      New: accountLeads.filter((l) => l.conversion_status === "New").length,
      Contacted: accountLeads.filter((l) => l.conversion_status === "Contacted").length,
      Responded: accountLeads.filter((l) => l.conversion_status === "Responded").length,
      "Multiple Responses": accountLeads.filter((l) => l.conversion_status === "Multiple Responses").length,
      Qualified: accountLeads.filter((l) => l.conversion_status === "Qualified").length,
      Booked: accountLeads.filter((l) => l.conversion_status === "Booked").length,
      DND: accountLeads.filter((l) => l.conversion_status === "DND").length,
    };

    return stagePalette
      .map((s) => ({ name: s.label, value: counts[s.id], fill: s.fill }));
  }, [currentAccountId, selectedCampaignId, stagePalette]);

  const stats = useMemo(() => {
    const accountLeads = leads
      .filter((l) => l.account_id === currentAccountId)
      .filter((l) => (selectedCampaignId === "all" ? true : l.campaign_id === selectedCampaignId));

    const accountCampaigns = campaigns.filter((c) => c.account_id === currentAccountId);
    const bookingsMo = accountLeads.filter((l) => l.conversion_status === "Booked").length;
    const aiCost = accountCampaigns.reduce((sum, c) => sum + c.total_cost, 0);
    return {
      totalLeads: accountLeads.length,
      activeCampaigns: accountCampaigns.filter((c) => c.status === "Active").length,
      bookingsMo,
      aiCost,
    };
  }, [currentAccountId, selectedCampaignId]);

  const campaignOptions = useMemo(() => {
    return campaigns.filter((c) => c.account_id === currentAccountId);
  }, [currentAccountId]);

  return (
    <CrmShell>
      <div className="py-6" data-testid="page-dashboard">
        <div className="p-0">
          {isAgencyView ? (
            <AgencyDashboard />
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
            />
          )}
        </div>
      </div>
    </CrmShell>
  );
}

function AgencyDashboard() {
  const agencyButtons = "h-10 rounded-xl bg-yellow-400 text-yellow-950 font-semibold hover:bg-yellow-300";

  const activeCampaigns = useMemo(() => {
    // Agency view: show a mix of active campaigns across accounts
    return campaigns
      .filter((c) => c.status === "Active")
      .slice(0, 4)
      .map((c) => {
        const leadsCount = leads.filter((l) => l.campaign_id === c.id && l.account_id === c.account_id).length;
        return {
          ...c,
          leads_count: leadsCount,
          next_run: new Date(Date.now() + 60 * 60 * 1000).toLocaleString(),
        };
      });
  }, []);

  const tasks = useMemo(() => {
    // Mock tasks derived from automation logs + leads
    return automationLogs
      .slice(0, 10)
      .map((log) => {
        const lead = leads.find((l) => l.id === log.lead_id);
        return {
          id: log.id,
          lead_name: lead?.full_name ?? `Lead #${log.lead_id}`,
          priority: lead?.priority ?? "Medium",
          next_action_at: lead?.next_action_at ?? new Date().toISOString(),
          status: log.status,
        };
      });
  }, []);

  const activity = useMemo(() => {
    const items = [
      ...interactions.slice(0, 12).map((i) => ({
        kind: "interaction" as const,
        id: i.id,
        at: i.created_at,
        text: i.content,
        category: i.direction === "Inbound" ? "Received" : "Sent",
      })),
      ...automationLogs.slice(0, 12).map((l) => ({
        kind: "log" as const,
        id: l.id,
        at: l.created_at,
        text: `${l.status}${l.error_message ? ` — ${l.error_message}` : ""}`,
        category: "System",
      })),
    ];

    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  }, []);

  const categoryColors: Record<string, string> = {
    Received: "bg-blue-50 text-blue-600 border-blue-100",
    Sent: "bg-green-50 text-green-600 border-green-100",
    System: "bg-purple-50 text-purple-600 border-purple-100",
  };

  return (
    <div className="mt-6 space-y-6" data-testid="agency-dashboard">
      <section data-testid="section-active-campaigns">
        <div className="flex items-center justify-between gap-3" data-testid="row-campaigns-head">
          <div className="text-sm font-semibold" data-testid="text-campaigns-title">Active Campaigns</div>
          <button className={agencyButtons} type="button" data-testid="button-agency-new-campaign">
            New campaign
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="grid-campaigns">
          {activeCampaigns.map((c) => (
            <div key={c.id} className="rounded-2xl border-none bg-white p-4 shadow-none" data-testid={`card-campaign-${c.id}`}>
              <div className="font-semibold" data-testid={`text-campaign-name-${c.id}`}>{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-campaign-meta-${c.id}`}>
                {c.status} • leads={c.leads_count}
              </div>
              <div className="mt-3 text-xs text-muted-foreground" data-testid={`text-campaign-next-${c.id}`}>next_run: {c.next_run}</div>
            </div>
          ))}
        </div>
      </section>

      <section data-testid="section-tasks">
        <div className="flex items-center justify-between gap-3" data-testid="row-tasks-head">
          <div className="text-sm font-semibold" data-testid="text-tasks-title">My Tasks</div>
          <button className={agencyButtons} type="button" data-testid="button-agency-add-task">
            Add task
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          {tasks.map((t) => (
            <div key={t.id} className="rounded-2xl bg-white p-4 shadow-none border-none" data-testid={`row-task-${t.id}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold" data-testid={`text-task-lead-${t.id}`}>{t.lead_name}</div>
                <div className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted/10 text-muted-foreground" data-testid={`text-task-priority-${t.id}`}>{t.priority}</div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <div data-testid={`text-task-next-${t.id}`}>{new Date(t.next_action_at).toLocaleString()}</div>
                <div data-testid={`text-task-status-${t.id}`}>{t.status}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section data-testid="section-activity">
        <div className="flex items-center justify-between gap-3" data-testid="row-activity-head">
          <div className="text-sm font-semibold" data-testid="text-activity-title">Recent Activity</div>
          <button className={agencyButtons} type="button" data-testid="button-agency-export">
            Export
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {activity.map((a) => (
            <div key={`${a.kind}-${a.id}`} className="rounded-2xl bg-white p-4 shadow-none border-none flex items-center justify-between gap-4" data-testid={`row-activity-${a.kind}-${a.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase shrink-0", categoryColors[a.category])}>
                  {a.category}
                </span>
                <div className="text-sm font-medium truncate" data-testid={`text-activity-text-${a.kind}-${a.id}`}>{a.text}</div>
              </div>
              <div className="text-[11px] text-muted-foreground whitespace-nowrap" data-testid={`text-activity-at-${a.kind}-${a.id}`}>
                {new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </section>
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
  dashboardTab
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
}) {

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
    <div className="mt-0 space-y-6 flex flex-col" data-testid="subaccount-dashboard">
      <div className="flex items-start justify-between">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 flex-grow max-w-[calc(100%-200px)]" data-testid="grid-kpis">
          <Stat label="Total Contacts" value={String(stats.totalLeads)} testId="stat-total" icon={<Users className="w-4 h-4" />} />
          <Stat label="Active Campaigns" value={String(stats.activeCampaigns)} testId="stat-active" icon={<Target className="w-4 h-4" />} />
          <Stat label="Bookings/Mo" value={String(stats.bookingsMo)} testId="stat-bookings" icon={<CalendarIcon className="w-4 h-4" />} />
          <Stat label="AI Cost" value={`$${stats.aiCost.toFixed(0)}`} testId="stat-cost" icon={<Zap className="w-4 h-4" />} />
          <Stat label="Avg Resp Time" value="4.2m" testId="stat-resp" icon={<Clock className="w-4 h-4" />} />
          <Stat label="Conv Rate" value="12.4%" testId="stat-conv" icon={<TrendingUp className="w-4 h-4" />} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[400px]">
          <div className="lg:col-span-2 flex flex-col">
            <div className="mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Performance Over Time</h3>
            </div>
            <div className="flex-grow rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-end mb-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">
                  <TrendingUp className="w-3 h-3" />
                  +24% vs last year
                </div>
              </div>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={leadGrowthData}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#64748b'}}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#64748b'}}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
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
          <div className="flex flex-col">
            <div className="mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conversion Funnel</h3>
            </div>
            <div className="flex-grow rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
              <div className="flex-grow flex flex-col justify-between py-2">
                {funnel.map((stage: any, idx: number) => (
                  <div key={stage.name} className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-600">{stage.name}</span>
                      <span className="text-slate-900">{stage.value}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ 
                          width: `${(stage.value / Math.max(...funnel.map((s: any) => s.value))) * 100}%`,
                          backgroundColor: stage.fill,
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section
        className="p-0 flex flex-col"
        data-testid="section-pipeline"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conversions</h2>
        </div>
        <div className="overflow-x-auto overflow-y-hidden pb-4" data-testid="scroll-pipeline">
          <div className="min-w-[1610px] grid grid-cols-7 gap-3 h-[calc(100vh-285px)]" data-testid="grid-pipeline">
            {stagePalette.map((s) => (
              <PipelineCol key={s.id} stage={s} accountId={accountId} campaignId={selectedCampaignId} />
            ))}
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid={testId}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider" data-testid={`${testId}-label`}>{label}</div>
        <div className="text-slate-400">{icon}</div>
      </div>
      <div className="text-2xl font-black tracking-tight text-slate-900" data-testid={`${testId}-value`}>{value}</div>
    </div>
  );
}

function PipelineCol({
  stage,
  accountId,
  campaignId,
}: {
  stage: { id: string; label: string; icon?: React.ReactNode; fill: string; textColor: "black" | "white" };
  accountId: number;
  campaignId: number | "all";
}) {
  const items = useMemo(() => {
    const filtered = leads
      .filter((l) => l.account_id === accountId)
      .filter((l) => (campaignId === "all" ? true : l.campaign_id === campaignId));

    const isMatch = (s: string) => s === stage.id;

    return filtered.filter((l) => isMatch(l.conversion_status));
  }, [accountId, campaignId, stage.id]);

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

  return (
    <div className="w-full bg-white flex flex-col h-full rounded-2xl overflow-hidden shadow-sm border border-slate-100" data-testid={`col-${stage.id}`}>
      <div
        className={cn(
          "p-4 flex items-center justify-between z-10 shrink-0 sticky top-0 bg-white dark:bg-slate-900",
        )}
        data-testid={`col-head-${stage.id}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div 
            className="flex items-center justify-center w-7 h-7 rounded-lg shadow-sm border"
            style={{ 
              backgroundColor: `${stage.fill}15`,
              color: stage.id === 'Booked' ? '#ca8a04' : stage.fill,
              borderColor: `${stage.fill}30`
            }}
          >
            {stage.icon}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-black uppercase tracking-tight text-slate-900 truncate">{stage.label}</span>
            <span
              className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500"
              data-testid={`col-count-${stage.id}`}
            >
              {items.length}
            </span>
          </div>
        </div>
      </div>
      <div className="p-3 pt-0 space-y-2 flex-grow overflow-y-auto scrollbar-hide" data-testid={`col-body-${stage.id}`}>
        {items.slice(0, 50).map((l) => (
          <div key={l.id} className="group relative w-full" data-testid={`row-contact-pill-${stage.id}-${l.id}`}>
            <div
              className={cn(
                "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm cursor-pointer relative",
                "transition-[height,transform,box-shadow,background-color,border-color] duration-150 ease-out",
                "hover:shadow-md",
                "h-10 group-hover:h-[104px]",
                "p-2"
              )}
              onClick={() => {
                window.history.pushState({}, "", `/app/contacts/${l.id}`);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              data-testid={`pill-contact-${stage.id}-${l.id}`}
            >
              <div className="flex items-center gap-2" data-testid={`row-pill-header-${stage.id}-${l.id}`}>
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ 
                    backgroundColor: `${stage.fill}15`,
                    color: stage.id === 'Booked' ? '#ca8a04' : stage.fill,
                    border: `1px solid ${stage.fill}30`
                  }}
                >
                  {getInitials(l.full_name)}
                </div>
                <div
                  className="font-semibold text-xs truncate flex-grow"
                  style={{ color: stage.id === 'Booked' ? '#ca8a04' : stage.fill }}
                  data-testid={`text-pipe-name-${stage.id}-${l.id}`}
                >
                  {l.full_name}
                </div>
                <span
                  className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap uppercase tracking-tighter"
                  data-testid={`text-pipe-time-${stage.id}-${l.id}`}
                >
                  {formatTimeAgo(l.created_at)}
                </span>
              </div>

              <div
                className={cn(
                  "mt-2 overflow-hidden",
                  "opacity-0 translate-y-1 pointer-events-none",
                  "transition-[opacity,transform] duration-150 ease-out",
                  "group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto"
                )}
                data-testid={`panel-contact-details-${stage.id}-${l.id}`}
              >
                <div className="space-y-1.5" data-testid={`stack-contact-details-${stage.id}-${l.id}`}>
                  <div className="text-xs font-mono" data-testid={`text-contact-phone-${stage.id}-${l.id}`}>{l.phone}</div>
                  <div className="text-xs truncate" data-testid={`text-contact-email-${stage.id}-${l.id}`}>{l.email || "No email"}</div>
        <div className="flex flex-wrap gap-1 mt-1" data-testid={`list-contact-tags-${stage.id}-${l.id}`}>
          {(l.tags || ['Lead']).map((tag: string) => {
            const tagInfo = CSV_TAGS.find(ct => ct.name === tag);
            const color = tagInfo?.color || '#64748B';
            return (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded-md text-[9px] font-bold border"
                style={{ 
                  backgroundColor: `${color}15`,
                  color: color,
                  borderColor: `${color}30`
                }}
                data-testid={`chip-contact-tag-${stage.id}-${l.id}-${tag}`}
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
          <div className="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-900/50 p-3">
            No contacts.
          </div>
        ) : null}
      </div>
    </div>
  );
}
