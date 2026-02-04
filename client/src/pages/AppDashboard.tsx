import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { campaigns, leads, interactions, automationLogs } from "@/data/mocks";
import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts";
import { FiltersBar } from "@/components/crm/FiltersBar";
import {
  Users,
  MessageSquare,
  TrendingUp,
  Calendar as CalendarIcon,
  CheckCircle2,
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
    { id: "New" as const, label: "🆕 New", fill: "#1a3a6f", textColor: "white" as const },
    { id: "Contacted" as const, label: "📩 Contacted", fill: "#2d5aa8", textColor: "white" as const },
    { id: "Responded" as const, label: "💬 Responded", fill: "#1E90FF", textColor: "white" as const },
    { id: "Multiple Responses" as const, label: "🔁 Multiple", fill: "#17A398", textColor: "white" as const },
    { id: "Qualified" as const, label: "✅ Qualified", fill: "#10b981", textColor: "white" as const },
    { id: "Booked" as const, label: "📅 Booked", fill: "#facc15", textColor: "#ca8a04" as const },
    { id: "DND" as const, label: "⛔️ DND", fill: "#ef4444", textColor: "white" as const },
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
      .filter((s) => s.id !== "DND")
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

  return (
    <div className="mt-6 space-y-6 flex flex-col h-[calc(100vh-180px)]" data-testid="subaccount-dashboard">
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-baseline gap-2">
          <button 
            onClick={() => setSelectedCampaignId("all")}
            className={cn(
              "text-sm font-bold transition-colors",
              dashboardTab === "pipeline" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Pipeline
          </button>
          <button 
            onClick={() => setSelectedCampaignId("all")}
            className={cn(
              "text-xs font-medium transition-colors",
              dashboardTab === "funnel" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Funnel/KPI
          </button>
        </div>
      </div>

      {dashboardTab === "funnel" ? (
        <section className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="section-campaign-selector">
          <div className="px-4 pb-4" data-testid="panel-sales-funnel">
            <div className="grid grid-cols-1 lg:grid-cols-[640px_1fr] gap-4" data-testid="campaign-body">
              <div className="rounded-2xl border border-border bg-background p-4" data-testid="card-funnel">
                <div className="flex items-start justify-between gap-3" data-testid="funnel-head">
                  <div className="min-w-0" data-testid="wrap-funnel-title">
                    <div className="text-xs font-semibold text-muted-foreground" data-testid="text-funnel-total">
                      All contacts: <span className="text-foreground font-extrabold">{stats.totalLeads}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsBookedReportOpen(true)}
                    className="h-8 w-8 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors grid place-items-center text-muted-foreground"
                    data-testid="button-booked-report"
                    aria-label="Booked report"
                  >
                    <span className="text-sm font-black">!</span>
                  </button>
                </div>
                <div className="mt-4 h-[240px] w-full overflow-hidden" data-testid="chart-funnel">
                  <div className="flex h-full w-full items-end justify-center px-4 relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none hidden xl:block">
                      <div className="flex flex-col gap-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Users key={i} className="w-4 h-4 text-muted-foreground" />
                        ))}
                      </div>
                    </div>

                    {funnel.map((stage, idx) => {
                      const maxValue = Math.max(...funnel.map((s) => s.value), 1);
                      const heightPercent = (stage.value / maxValue) * 100;

                      const taperFactor = 1 - (idx / (funnel.length - 1)) * 0.8;
                      const widthPercent = 100 * taperFactor;

                      return (
                        <div
                          key={stage.name}
                          className="flex flex-col items-center group relative h-full justify-end transition-all duration-300"
                          style={{
                            width: `${100 / funnel.length}%`,
                            marginLeft: idx === 0 ? 0 : `-20px`,
                            zIndex: funnel.length - idx,
                          }}
                        >
                          <div
                            className="transition-all duration-500 relative flex items-start justify-center pt-6 cursor-pointer hover:brightness-110 hover:scale-[1.02]"
                            style={{
                              height: `${Math.max(heightPercent, 20)}%`,
                              backgroundColor: stage.fill,
                              borderRadius: "100% 100% 0 0 / 20% 20% 0 0",
                              opacity: 0.95,
                              width: `${widthPercent}%`,
                              minWidth: "45px",
                              boxShadow:
                                "0 10px 30px rgba(0,0,0,0.1), inset 0 2px 10px rgba(255,255,255,0.2)",
                              transform: "perspective(1000px) rotateX(10deg)",
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/40 pointer-events-none" />

                            <div className="absolute top-2 left-0 right-0 flex justify-center">
                              <span className="z-10 text-[13px] font-black text-white drop-shadow-xl bg-black/30 px-2 py-0.5 rounded-lg border border-white/10 group-hover:scale-110 transition-transform">
                                {stage.value}
                              </span>
                            </div>
                          </div>
                          <div className="mt-6 flex flex-col items-center gap-1 w-full relative z-20">
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center px-1 leading-tight group-hover:text-foreground transition-colors">
                              {stage.name.replace(/[^a-zA-Z]/g, "")}
                            </div>
                            <div
                              className="w-1.5 h-1.5 rounded-full mt-1 transition-all duration-300 group-hover:scale-150"
                              style={{ backgroundColor: stage.fill }}
                            />
                          </div>
                          <div className="absolute bottom-full mb-8 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 bg-popover/90 backdrop-blur-md text-popover-foreground text-[11px] px-4 py-2 rounded-2xl border border-border shadow-2xl z-[100] pointer-events-none whitespace-nowrap font-extrabold">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.fill }} />
                              {stage.name}: {stage.value}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3" data-testid="grid-stats">
                <Stat label="Total Contacts" value={String(stats.totalLeads)} testId="stat-total" tone="blue" />
                <Stat label="Active Campaigns" value={String(stats.activeCampaigns)} testId="stat-active" tone="indigo" />
                <Stat label="Bookings/Mo" value={String(stats.bookingsMo)} testId="stat-bookings" tone="yellow" />
                <Stat label="AI Cost" value={`$${stats.aiCost.toFixed(2)}`} testId="stat-cost" tone="slate" />
              </div>

              {isBookedReportOpen ? (
                <div className="fixed inset-0 z-50" data-testid="modal-booked-report">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/50"
                    onClick={() => setIsBookedReportOpen(false)}
                    data-testid="button-close-booked-report-backdrop"
                    aria-label="Close booked report"
                  />
                  <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl">
                    <div className="p-5 border-b border-border flex items-start justify-between gap-4" data-testid="row-booked-report-head">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold" data-testid="text-booked-report-title">Booked Contacts Report</div>
                        <div className="mt-1 text-xs text-muted-foreground" data-testid="text-booked-report-sub">
                          AI insight summary (MOCK) based on recent booked conversations.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="h-9 w-9 rounded-xl border border-border bg-muted/20 hover:bg-muted/30"
                        onClick={() => setIsBookedReportOpen(false)}
                        data-testid="button-close-booked-report"
                        aria-label="Close booked report"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-5 space-y-4" data-testid="body-booked-report">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="grid-booked-report-kpis">
                        <div className="rounded-2xl border border-border bg-muted/10 p-4" data-testid="card-booked-kpi-0">
                          <div className="text-xs text-muted-foreground" data-testid="text-booked-kpi-label-0">Booked (selected)</div>
                          <div className="mt-2 text-2xl font-extrabold tracking-tight" data-testid="text-booked-kpi-value-0">{stats.bookingsMo}</div>
                        </div>
                        <div className="rounded-2xl border border-border bg-muted/10 p-4" data-testid="card-booked-kpi-1">
                          <div className="text-xs text-muted-foreground" data-testid="text-booked-kpi-label-1">Avg time-to-book</div>
                          <div className="mt-2 text-2xl font-extrabold tracking-tight" data-testid="text-booked-kpi-value-1">2.6d</div>
                        </div>
                        <div className="rounded-2xl border border-border bg-muted/10 p-4" data-testid="card-booked-kpi-2">
                          <div className="text-xs text-muted-foreground" data-testid="text-booked-kpi-label-2">Top driver</div>
                          <div className="mt-2 text-sm font-semibold" data-testid="text-booked-kpi-value-2">Fast follow-up</div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-gradient-to-br from-yellow-400/10 via-transparent to-sky-500/10 p-4" data-testid="card-booked-insight">
                        <div className="text-xs font-semibold text-yellow-500" data-testid="text-booked-insight-tag">AI Insight</div>
                        <div className="mt-2 text-sm" data-testid="text-booked-insight-body">
                          Booked contacts tend to convert when the first reply happens within <span className="font-semibold">10 minutes</span> and the second message includes a <span className="font-semibold">specific time suggestion</span> (\"Can you do Tue at 2:30?\").
                          <br />
                          <span className="text-muted-foreground">Recommendation:</span> auto-suggest 2 time slots after positive intent and add a "quick reschedule" button.
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background p-4" data-testid="card-booked-patterns">
                        <div className="text-sm font-semibold" data-testid="text-booked-patterns-title">Patterns observed</div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="grid-booked-patterns">
                          {[
                            { k: "Best channel", v: "SMS", hint: "Most bookings came from SMS threads with 2–4 messages." },
                            { k: "Language that wins", v: "Short + direct", hint: "Clear next step and one question at a time." },
                            { k: "Drop-off risk", v: "After 30 min", hint: "Interest decays quickly without a follow-up nudge." },
                            { k: "Offer angle", v: "Speed", hint: "\"We can get you in this week\" outperformed discounts." },
                          ].map((p, idx) => (
                            <div key={p.k} className="rounded-2xl border border-border bg-muted/10 p-4" data-testid={`card-booked-pattern-${idx}`}>
                              <div className="text-xs text-muted-foreground" data-testid={`text-booked-pattern-k-${idx}`}>{p.k}</div>
                              <div className="mt-1 text-sm font-semibold" data-testid={`text-booked-pattern-v-${idx}`}>{p.v}</div>
                              <div className="mt-2 text-xs text-muted-foreground" data-testid={`text-booked-pattern-hint-${idx}`}>{p.hint}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2" data-testid="row-booked-report-actions">
                        <button
                          type="button"
                          className="h-10 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 px-4 text-sm font-semibold"
                          onClick={() => setIsBookedReportOpen(false)}
                          data-testid="button-booked-report-done"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      {dashboardTab === "pipeline" ? (
        <section
          className="p-0 flex flex-col flex-grow mt-0 overflow-hidden"
          data-testid="section-pipeline"
        >
          <div className="overflow-x-auto overflow-y-hidden flex-grow pb-2" data-testid="scroll-pipeline">
            <div className="min-w-[1610px] grid grid-cols-7 gap-3 h-full" data-testid="grid-pipeline">
              {stagePalette.map((s) => (
                <PipelineCol key={s.id} stage={s} accountId={accountId} campaignId={selectedCampaignId} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  testId,
  tone,
}: {
  label: string;
  value: string;
  testId: string;
  tone: "blue" | "indigo" | "yellow" | "slate";
}) {
  const toneCls =
    tone === "yellow"
      ? "border-yellow-300/30 bg-yellow-400/10"
      : tone === "indigo"
        ? "border-indigo-400/20 bg-indigo-500/10"
        : tone === "blue"
          ? "border-sky-400/20 bg-sky-500/10"
          : "border-border bg-muted/10";

  return (
    <div className={"rounded-2xl border p-4 " + toneCls} data-testid={testId}>
      <div className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>{label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight" data-testid={`${testId}-value`}>{value}</div>
    </div>
  );
}

function PipelineCol({
  stage,
  accountId,
  campaignId,
}: {
  stage: { id: string; label: string; fill: string; textColor: "black" | "white" };
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
          "p-3 flex items-center justify-between shadow-sm z-10 shrink-0 sticky top-0 bg-white dark:bg-slate-900",
        )}
        data-testid={`col-head-${stage.id}`}
      >
        <div className="flex items-center gap-2 font-medium min-w-0">
          <span className="text-sm truncate text-slate-900">{stage.label}</span>
          <span
            className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500"
            data-testid={`col-count-${stage.id}`}
          >
            {items.length}
          </span>
        </div>
      </div>
      <div className="p-3 space-y-2 flex-grow overflow-y-auto scrollbar-hide" data-testid={`col-body-${stage.id}`}>
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
