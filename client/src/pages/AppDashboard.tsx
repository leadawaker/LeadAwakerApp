import { useMemo } from "react";
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
        <div className="text-sm font-semibold" data-testid="text-campaigns-title">Active Campaigns</div>
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
        <div className="text-sm font-semibold" data-testid="text-tasks-title">My Tasks</div>
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
        <div className="text-sm font-semibold" data-testid="text-activity-title">Recent Activity</div>
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
  const funnel = useMemo(() => {
    const accountLeads = leads.filter((l) => l.account_id === accountId);
    const counts = {
      New: accountLeads.filter((l) => l.conversion_status === "New").length,
      Contacted: accountLeads.filter((l) => l.conversion_status === "Contacted").length,
      Responded: accountLeads.filter((l) => l.conversion_status === "Responded" || l.conversion_status === "Multiple Responses").length,
      Booked: accountLeads.filter((l) => l.conversion_status === "Booked").length,
    };
    return [
      { name: "New", value: counts.New, fill: "#2563eb" },
      { name: "Contacted", value: counts.Contacted, fill: "#7c3aed" },
      { name: "Responded", value: counts.Responded, fill: "#16a34a" },
      { name: "Booked", value: counts.Booked, fill: "#f59e0b" },
    ];
  }, [accountId]);

  const stats = useMemo(() => {
    const accountLeads = leads.filter((l) => l.account_id === accountId);
    const accountCampaigns = campaigns.filter((c) => c.account_id === accountId);
    const bookingsMo = accountLeads.filter((l) => l.conversion_status === "Booked").length;
    const aiCost = accountCampaigns.reduce((sum, c) => sum + c.total_cost, 0);
    return {
      totalLeads: accountLeads.length,
      activeCampaigns: accountCampaigns.filter((c) => c.status === "Active").length,
      bookingsMo,
      aiCost,
    };
  }, [accountId]);

  const miniCampaigns = useMemo(() => {
    return campaigns.filter((c) => c.account_id === accountId).slice(0, 6);
  }, [accountId]);

  return (
    <div className="mt-6 space-y-6" data-testid="subaccount-dashboard">
      <section className="grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-6" data-testid="section-funnel">
        <div className="rounded-2xl border border-border bg-background p-4" data-testid="card-funnel">
          <div className="text-sm font-semibold" data-testid="text-funnel-title">Conversion Funnel</div>
          <div className="mt-3 h-[280px]" data-testid="chart-funnel">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={funnel} isAnimationActive>
                  <LabelList position="right" fill="#111827" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-muted-foreground" data-testid="text-funnel-hint">
            New → Contacted → Responded → Booked
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4" data-testid="grid-stats">
          <Stat label="Total Leads" value={String(stats.totalLeads)} testId="stat-total" />
          <Stat label="Active Campaigns" value={String(stats.activeCampaigns)} testId="stat-active" />
          <Stat label="Bookings/Mo" value={String(stats.bookingsMo)} testId="stat-bookings" />
          <Stat label="AI Cost" value={`$${stats.aiCost.toFixed(2)}`} testId="stat-cost" />
        </div>
      </section>

      <section data-testid="section-mini-campaigns">
        <div className="text-sm font-semibold" data-testid="text-mini-title">Campaigns</div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="grid-mini">
          {miniCampaigns.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-background p-4" data-testid={`card-mini-${c.id}`}>
              <div className="font-semibold" data-testid={`text-mini-name-${c.id}`}>{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-mini-meta-${c.id}`}>{c.status} • {c.type}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4" data-testid={testId}>
      <div className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>{label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight" data-testid={`${testId}-value`}>{value}</div>
    </div>
  );
}
