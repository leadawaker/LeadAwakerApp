import { useState } from "react";
import { useLeads } from "@/hooks/useLeads";
import { Topbar } from "@/components/crm/Topbar";
import { Sidebar } from "@/components/crm/Sidebar";
import { LeadCard } from "@/components/crm/LeadCard";

export default function AppLeads() {
  const { leads } = useLeads();
  const [active, setActive] = useState<number | null>(leads[0]?.id ?? null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 to-background" data-testid="page-app-leads">
      <Topbar />
      <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 flex gap-6">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" data-testid="text-leads-title">
              Leads
            </h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-leads-subtitle">
              All leads (MOCK). REAL: fetch from NocoDB Leads table.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-leads">
            {leads.map((lead) => (
              <button
                key={lead.id}
                className="text-left"
                onClick={() => setActive(lead.id)}
                data-testid={`button-select-lead-${lead.id}`}
              >
                <LeadCard lead={lead} active={active === lead.id} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
