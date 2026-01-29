import { useMemo, useState } from "react";
import { useLeads } from "@/hooks/useLeads";
import { Lead } from "@/data/mocks";
import { Topbar } from "@/components/crm/Topbar";
import { Sidebar } from "@/components/crm/Sidebar";
import { LeadsTable } from "@/components/crm/LeadsTable";
import { InteractionsChat } from "@/components/crm/InteractionsChat";
import { ManualSend } from "@/components/crm/ManualSend";
import { Badge } from "@/components/ui/badge";

function KPI({ label, value, hint, testId }: { label: string; value: string; hint: string; testId: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4" data-testid={testId}>
      <div className="text-xs text-muted-foreground" data-testid={`${testId}-label`}>
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight" data-testid={`${testId}-value`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground" data-testid={`${testId}-hint`}>
        {hint}
      </div>
    </div>
  );
}

export default function AppDashboard() {
  const { leads } = useLeads();
  const [activeLeadId, setActiveLeadId] = useState<number | null>(leads[0]?.id ?? null);

  const activeLead = useMemo(() => leads.find((l) => l.id === activeLeadId) ?? null, [leads, activeLeadId]);

  const kpis = useMemo(() => {
    const responded = leads.filter((l) => l.conversion_status === "Responded" || l.conversion_status === "Multiple Responses").length;
    const booked = leads.filter((l) => l.conversion_status === "Booked").length;
    const dnd = leads.filter((l) => l.conversion_status === "DND").length;
    return { responded, booked, dnd };
  }, [leads]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 to-background" data-testid="page-app-dashboard">
      <Topbar />
      <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 flex gap-6">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" data-testid="text-dashboard-title">
                  CRM Dashboard
                </h1>
                <Badge className="border" data-testid="badge-mock">
                  MOCK
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="text-dashboard-subtitle">
                Static prototype (React + Tailwind). Data is hardcoded to match your NocoDB schema.
              </p>
              <p className="mt-1 text-xs text-muted-foreground" data-testid="text-dashboard-real-comment">
                REAL: useSWR(`${import.meta.env.VITE_NOCODB_URL}/api/v1/db/data/nocodb/Leads`)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KPI label="Responded" value={String(kpis.responded)} hint="Leads with inbound replies" testId="kpi-responded" />
            <KPI label="Booked" value={String(kpis.booked)} hint="Booked calls" testId="kpi-booked" />
            <KPI label="DND" value={String(kpis.dnd)} hint="Do-not-disturb" testId="kpi-dnd" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-6">
            <div className="min-w-0">
              <LeadsTable
                leads={leads}
                activeLeadId={activeLeadId}
                onSelect={(lead: Lead) => setActiveLeadId(lead.id)}
              />
            </div>

            <div className="rounded-2xl border border-border bg-background overflow-hidden flex flex-col min-h-[520px]" data-testid="panel-right">
              <InteractionsChat lead={activeLead} />
              <div className="p-4 border-t border-border" data-testid="panel-manual-send">
                <ManualSend disabled={!activeLead} />
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-muted-foreground" data-testid="text-schema-note">
            Schema notes: Accounts, Campaigns, Leads, Interactions (fields mirrored in mocks.ts).
          </div>
        </div>
      </div>
    </div>
  );
}
