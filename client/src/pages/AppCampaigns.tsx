import { Topbar } from "@/components/crm/Topbar";
import { Sidebar } from "@/components/crm/Sidebar";
import { campaigns } from "@/data/mocks";

export default function AppCampaigns() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 to-background" data-testid="page-app-campaigns">
      <Topbar />
      <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 flex gap-6">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" data-testid="text-campaigns-title">
              Campaigns
            </h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-campaigns-subtitle">
              MOCK data. REAL: useSWR(`${import.meta.env.VITE_NOCODB_URL}/api/v1/db/data/nocodb/Campaigns`)
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background overflow-hidden" data-testid="table-campaigns">
            <div className="divide-y divide-border">
              {campaigns.map((c) => (
                <div key={c.id} className="p-4" data-testid={`row-campaign-${c.id}`}>
                  <div className="font-semibold" data-testid={`text-campaign-name-${c.id}`}>{c.name}</div>
                  <div className="text-sm text-muted-foreground" data-testid={`text-campaign-desc-${c.id}`}>{c.description}</div>
                  <div className="mt-2 text-xs text-muted-foreground" data-testid={`text-campaign-meta-${c.id}`}>
                    {c.status} • {c.type} • daily_limit={c.daily_lead_limit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
