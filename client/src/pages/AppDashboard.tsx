import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { campaigns, leads, interactions, automationLogs } from "@/data/mocks";
import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts";

export default function AppDashboard() {
  const { currentAccountId, isAgencyView, currentAccount } = useWorkspace();

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-dashboard">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
              {isAgencyView
                ? "Agency mode: task/project overview (MOCK)."
                : `Subaccount mode: funnel + stats for ${currentAccount.name} (MOCK).`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground" data-testid="text-real">
              REAL: useSWR(`${import.meta.env.VITE_NOCODB_URL}/api/v1/db/data/nocodb/...`)
            </p>
          </div>
        </div>

        {isAgencyView ? <AgencyDashboard /> : <SubaccountDashboard accountId={currentAccountId} />}
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

function SubaccountDashboard({ accountId }: { accountId: number }) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "all">("all");

  const stagePalette = [
    { id: "New" as const, label: "New", fill: "#1a3a6f" },
    { id: "Contacted" as const, label: "Contacted", fill: "#2d5aa8" },
    { id: "Responded" as const, label: "Responded", fill: "#1E90FF" },
    { id: "Booked" as const, label: "Booked", fill: "#facc15" },
  ];

  const funnel = useMemo(() => {
    const accountLeads = leads
      .filter((l) => l.account_id === accountId)
      .filter((l) => (selectedCampaignId === "all" ? true : l.campaign_id === selectedCampaignId));

    const counts = {
      New: accountLeads.filter((l) => l.conversion_status === "New").length,
      Contacted: accountLeads.filter((l) => l.conversion_status === "Contacted").length,
      Responded: accountLeads.filter((l) => l.conversion_status === "Responded" || l.conversion_status === "Multiple Responses").length,
      Booked: accountLeads.filter((l) => l.conversion_status === "Booked").length,
    };

    return stagePalette.map((s) => ({ name: s.label, value: counts[s.id], fill: s.fill }));
  }, [accountId, selectedCampaignId]);

  const stats = useMemo(() => {
    const accountLeads = leads
      .filter((l) => l.account_id === accountId)
      .filter((l) => (selectedCampaignId === "all" ? true : l.campaign_id === selectedCampaignId));

    const accountCampaigns = campaigns.filter((c) => c.account_id === accountId);
    const bookingsMo = accountLeads.filter((l) => l.conversion_status === "Booked").length;
    const aiCost = accountCampaigns.reduce((sum, c) => sum + c.total_cost, 0);
    return {
      totalLeads: accountLeads.length,
      activeCampaigns: accountCampaigns.filter((c) => c.status === "Active").length,
      bookingsMo,
      aiCost,
    };
  }, [accountId, selectedCampaignId]);

  const campaignOptions = useMemo(() => {
    return campaigns.filter((c) => c.account_id === accountId);
  }, [accountId]);

  return (
    <div className="mt-6 space-y-6" data-testid="subaccount-dashboard">
      <section className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="section-campaign-selector">
        <div className="px-4 py-3 border-b border-border flex flex-col gap-3" data-testid="campaign-head">
          <div className="flex items-center justify-between gap-3" data-testid="row-campaign-title">
            <div className="min-w-0" data-testid="wrap-campaign-title">
              <div className="text-sm font-semibold truncate" data-testid="text-campaign-block-title">Campaign performance</div>
              <div className="mt-0.5 text-xs text-muted-foreground" data-testid="text-campaign-block-sub">Funnel + KPIs (MOCK)</div>
            </div>

            <div className="flex items-center gap-2" data-testid="wrap-campaign-select">
              <div className="text-xs text-muted-foreground" data-testid="label-campaign">Campaign</div>
              <div className="relative" data-testid="wrap-campaign-select-inner">
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className="h-9 rounded-xl border border-border bg-muted/20 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  data-testid="select-dashboard-campaign"
                >
                  <option value="all">All campaigns</option>
                  {campaignOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid="icon-campaign-chevron">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-4" data-testid="campaign-body">
          <div className="rounded-2xl border border-border bg-background p-4" data-testid="card-funnel">
            <div className="flex items-center justify-between" data-testid="funnel-head">
              <div className="text-sm font-semibold" data-testid="text-funnel-title">Conversion Funnel</div>
              <div className="text-xs text-muted-foreground" data-testid="text-funnel-hint">New → Contacted → Responded → Booked</div>
            </div>
            <div className="mt-3 h-[280px]" data-testid="chart-funnel">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip />
                  <Funnel dataKey="value" data={funnel} isAnimationActive>
                    <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2" data-testid="legend-funnel">
              {stagePalette.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`legend-${s.id}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4" data-testid="grid-stats">
            <Stat label="Total Contacts" value={String(stats.totalLeads)} testId="stat-total" tone="blue" />
            <Stat label="Active Campaigns" value={String(stats.activeCampaigns)} testId="stat-active" tone="indigo" />
            <Stat label="Bookings/Mo" value={String(stats.bookingsMo)} testId="stat-bookings" tone="yellow" />
            <Stat label="AI Cost" value={`$${stats.aiCost.toFixed(2)}`} testId="stat-cost" tone="slate" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-4" data-testid="section-pipeline">
        <div className="text-sm font-semibold" data-testid="text-pipeline-title">Pipeline</div>
        <div className="mt-1 text-xs text-muted-foreground" data-testid="text-pipeline-sub">Kanban-style stages (MOCK)</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="grid-pipeline">
          {stagePalette.map((s) => (
            <PipelineCol key={s.id} stage={s} accountId={accountId} campaignId={selectedCampaignId} />
          ))}
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
  stage: { id: string; label: string; fill: string };
  accountId: number;
  campaignId: number | "all";
}) {
  const items = useMemo(() => {
    const filtered = leads
      .filter((l) => l.account_id === accountId)
      .filter((l) => (campaignId === "all" ? true : l.campaign_id === campaignId));

    const isMatch = (s: string) => {
      if (stage.id === "Responded") return s === "Responded" || s === "Multiple Responses";
      return s === stage.id;
    };

    return filtered.filter((l) => isMatch(l.conversion_status));
  }, [accountId, campaignId, stage.id]);

  return (
    <div className="rounded-2xl border border-border bg-background overflow-hidden" data-testid={`col-${stage.id}`}>
      <div className="px-3 py-2 border-b border-border flex items-center justify-between" data-testid={`col-head-${stage.id}`}>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.fill }} />
          <div className="text-sm font-semibold" data-testid={`col-title-${stage.id}`}>{stage.label}</div>
        </div>
        <div className="text-xs text-muted-foreground" data-testid={`col-count-${stage.id}`}>{items.length}</div>
      </div>
      <div className="p-3 space-y-2" data-testid={`col-body-${stage.id}`}>
        {items.slice(0, 8).map((l) => (
          <div key={l.id} className="rounded-xl border border-border bg-muted/10 p-3" data-testid={`card-pipe-${stage.id}-${l.id}`}>
            <div className="font-semibold text-sm truncate" data-testid={`text-pipe-name-${stage.id}-${l.id}`}>{l.full_name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground truncate" data-testid={`text-pipe-phone-${stage.id}-${l.id}`}>{l.phone}</div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-3 text-xs text-muted-foreground" data-testid={`empty-pipe-${stage.id}`}>
            No contacts.
          </div>
        ) : null}
      </div>
    </div>
  );
}
