import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { campaigns, leads, interactions, automationLogs } from "@/data/mocks";
import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts";

export default function AppDashboard() {
  const { currentAccountId, isAgencyView, currentAccount } = useWorkspace();
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "all">("all");
  const [isBookedReportOpen, setIsBookedReportOpen] = useState(false);

  const stagePalette = useMemo(() => [
    { id: "New" as const, label: "🆕 New", fill: "#0b2a5b", textColor: "white" as const },
    { id: "Contacted" as const, label: "📩 Contacted", fill: "#103a75", textColor: "white" as const },
    { id: "Responded" as const, label: "💬 Responded", fill: "#16509d", textColor: "white" as const },
    { id: "Multiple Responses" as const, label: "🔁 Multiple", fill: "#1E90FF", textColor: "white" as const },
    { id: "Qualified" as const, label: "✅ Qualified", fill: "#3b82f6", textColor: "white" as const },
    { id: "Booked" as const, label: "📅 Booked", fill: "#facc15", textColor: "black" as const },
    { id: "DND" as const, label: "⛔️ DND", fill: "#ffffff", textColor: "black" as const },
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
      <div className="px-6 py-6" data-testid="page-dashboard">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">
            Dashboard
          </h1>
          
          {!isAgencyView && (
            <div className="flex items-center gap-2 ml-2" data-testid="wrap-campaign-select">
              <div className="relative" data-testid="wrap-campaign-select-inner">
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className="h-9 rounded-xl border border-border bg-muted/20 pl-3 pr-8 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/30 appearance-none min-w-[160px]"
                  data-testid="select-dashboard-campaign"
                >
                  <option value="all">All Campaigns</option>
                  {campaignOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid="icon-campaign-chevron">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {isAgencyView ? <AgencyDashboard /> : <SubaccountDashboard accountId={currentAccountId} selectedCampaignId={selectedCampaignId} setSelectedCampaignId={setSelectedCampaignId} campaignOptions={campaignOptions} stats={stats} funnel={funnel} stagePalette={stagePalette} isBookedReportOpen={isBookedReportOpen} setIsBookedReportOpen={setIsBookedReportOpen} />}
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
        text: `${i.direction}: ${i.content}`,
      })),
      ...automationLogs.slice(0, 12).map((l) => ({
        kind: "log" as const,
        id: l.id,
        at: l.created_at,
        text: `Log: ${l.status}${l.error_message ? ` — ${l.error_message}` : ""}`,
      })),
    ];

    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  }, []);

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
            <div key={c.id} className="rounded-2xl border border-border bg-background p-4" data-testid={`card-campaign-${c.id}`}>
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
        <div className="mt-3 rounded-2xl border border-border bg-background overflow-hidden" data-testid="table-tasks">
          <div className="grid grid-cols-[1fr_120px_220px_140px] text-xs font-semibold text-muted-foreground bg-muted/20 border-b border-border px-4 py-3">
            <div>lead_name</div>
            <div>priority</div>
            <div>next_action_at</div>
            <div>status</div>
          </div>
          <div className="divide-y divide-border">
            {tasks.map((t) => (
              <div key={t.id} className="grid grid-cols-[1fr_120px_220px_140px] px-4 py-3 text-sm" data-testid={`row-task-${t.id}`}>
                <div className="font-semibold" data-testid={`text-task-lead-${t.id}`}>{t.lead_name}</div>
                <div className="text-muted-foreground" data-testid={`text-task-priority-${t.id}`}>{t.priority}</div>
                <div className="text-muted-foreground" data-testid={`text-task-next-${t.id}`}>{new Date(t.next_action_at).toLocaleString()}</div>
                <div className="text-muted-foreground" data-testid={`text-task-status-${t.id}`}>{t.status}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-testid="section-activity">
        <div className="flex items-center justify-between gap-3" data-testid="row-activity-head">
          <div className="text-sm font-semibold" data-testid="text-activity-title">Recent Activity</div>
          <button className={agencyButtons} type="button" data-testid="button-agency-export">
            Export
          </button>
        </div>
        <div className="mt-3 rounded-2xl border border-border bg-background overflow-hidden" data-testid="feed-activity">
          <div className="divide-y divide-border">
            {activity.map((a) => (
              <div key={`${a.kind}-${a.id}`} className="p-4" data-testid={`row-activity-${a.kind}-${a.id}`}>
                <div className="text-xs text-muted-foreground" data-testid={`text-activity-at-${a.kind}-${a.id}`}>{new Date(a.at).toLocaleString()}</div>
                <div className="mt-1 text-sm" data-testid={`text-activity-text-${a.kind}-${a.id}`}>{a.text}</div>
              </div>
            ))}
          </div>
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
  setIsBookedReportOpen 
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
}) {

  return (
    <div className="mt-6 space-y-6" data-testid="subaccount-dashboard">
      <section className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="section-campaign-selector">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between" data-testid="campaign-head">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest" data-testid="label-campaign">Performance metrics</div>
          <div className="text-xs text-muted-foreground" data-testid="text-campaign-block-sub">Funnel + KPIs (MOCK)</div>
        </div>

        <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-[640px_1fr] gap-4" data-testid="campaign-body">
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
            <div className="mt-2 h-[120px]" data-testid="chart-funnel">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip />
                  <Funnel dataKey="value" data={funnel} isAnimationActive>
                    <LabelList
                      position="left"
                      fill="hsl(var(--foreground))"
                      stroke="none"
                      dataKey="name"
                      formatter={(value: unknown, entry: any) => {
                        const v = typeof entry?.value === "number" ? entry.value : 0;
                        return `${String(value)}  ${v}`;
                      }}
                    />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
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
      </section>

      <section className="rounded-2xl border border-border bg-background p-4" data-testid="section-pipeline">
        <div className="text-sm font-semibold" data-testid="text-pipeline-title">Pipeline</div>
        <div className="mt-1 text-xs text-muted-foreground" data-testid="text-pipeline-sub">Kanban-style stages (MOCK)</div>
        <div className="mt-4 -mx-4">
          <div className="h-px bg-border" />
        </div>
        <div className="mt-4 overflow-x-auto pb-2" data-testid="scroll-pipeline">
          <div className="min-w-[1840px] grid grid-cols-8 gap-3" data-testid="grid-pipeline">
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

  return (
    <div className="w-full rounded-2xl border border-border bg-background" data-testid={`col-${stage.id}`}>
      <div
        className="px-3 py-2 border-b border-border flex items-center justify-between"
        style={{ backgroundColor: stage.fill }}
        data-testid={`col-head-${stage.id}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="text-sm font-semibold truncate"
            style={{ color: stage.textColor === "white" ? "#ffffff" : "#0b1220" }}
            data-testid={`col-title-${stage.id}`}
          >
            {stage.label}
          </div>
        </div>
        <div
          className="text-xs font-semibold"
          style={{ color: stage.textColor === "white" ? "#ffffff" : "#0b1220" }}
          data-testid={`col-count-${stage.id}`}
        >
          {items.length}
        </div>
      </div>
      <div className="p-3 space-y-2" data-testid={`col-body-${stage.id}`}>
        {items.slice(0, 8).map((l) => (
          <div key={l.id} className="group relative w-full rounded-xl border border-border bg-muted/10 p-3" data-testid={`card-pipe-${stage.id}-${l.id}`}>
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, "", `/app/contacts/${l.id}`);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
              className="text-left w-full"
              data-testid={`button-pipe-open-${stage.id}-${l.id}`}
            >
              <div
                className="font-semibold text-sm truncate transition-colors"
                style={{ color: stage.id === "DND" ? "hsl(var(--foreground))" : stage.fill }}
                data-testid={`text-pipe-name-${stage.id}-${l.id}`}
              >
                {l.full_name}
              </div>
            </button>

            <div
              className="pointer-events-none absolute left-3 top-10 z-[9999] hidden w-[260px] rounded-xl border border-border bg-background p-3 shadow-2xl group-hover:block"
              data-testid={`popover-pipe-${stage.id}-${l.id}`}
            >
              <div className="text-xs font-semibold" data-testid={`popover-name-${stage.id}-${l.id}`}>{l.full_name}</div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground" data-testid={`popover-meta-${stage.id}-${l.id}`}>
                <div data-testid={`popover-phone-${stage.id}-${l.id}`}>Phone: {l.phone || "—"}</div>
                <div data-testid={`popover-email-${stage.id}-${l.id}`}>Email: {l.email || "—"}</div>
                <div data-testid={`popover-tags-${stage.id}-${l.id}`}>Tags: {l.tags || "—"}</div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground" data-testid={`popover-hint-${stage.id}-${l.id}`}>
                Click name to open contact.
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="w-full rounded-xl border border-dashed border-border bg-muted/10 p-3 text-xs text-muted-foreground" data-testid={`empty-pipe-${stage.id}`}>
            No contacts.
          </div>
        ) : null}
      </div>
    </div>
  );
}
