import { useMemo } from "react";
import { campaigns } from "@/data/mocks";
import { useWorkspace } from "@/hooks/useWorkspace";

export type DashboardTab = "pipeline" | "funnel";

export function FiltersBar({
  selectedCampaignId,
  setSelectedCampaignId,
  dashboardTab,
  setDashboardTab,
  allowAllAccounts,
}: {
  selectedCampaignId: number | "all";
  setSelectedCampaignId: (v: number | "all") => void;
  dashboardTab?: DashboardTab;
  setDashboardTab?: (v: DashboardTab) => void;
  allowAllAccounts?: boolean;
}) {
  const { currentAccountId } = useWorkspace();

  const campaignOptions = useMemo(() => {
    const list = campaigns.filter((c) => c.account_id === currentAccountId);
    return list;
  }, [currentAccountId]);

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between" data-testid="bar-filters">
      <div className="flex items-center gap-2" data-testid="row-campaign-and-tabs">
        <select
          value={selectedCampaignId}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedCampaignId(v === "all" ? "all" : Number(v));
          }}
          className="h-10 rounded-xl border-none bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          data-testid="select-campaign"
        >
          <option value="all">All campaigns</option>
          {campaignOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {dashboardTab && setDashboardTab ? (
          <div
            className="inline-flex rounded-xl border border-border bg-muted/20 p-1"
            data-testid="segmented-dashboard-tabs"
            role="tablist"
            aria-label="Dashboard view"
          >
            <button
              type="button"
              onClick={() => setDashboardTab("pipeline")}
              className={
                "h-9 px-3 rounded-lg text-sm font-semibold transition-colors " +
                (dashboardTab === "pipeline"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
              data-testid="tab-conversion-pipeline"
              role="tab"
              aria-selected={dashboardTab === "pipeline"}
            >
              Conversion Pipeline
            </button>
            <button
              type="button"
              onClick={() => setDashboardTab("funnel")}
              className={
                "h-9 px-3 rounded-lg text-sm font-semibold transition-colors " +
                (dashboardTab === "funnel"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
              data-testid="tab-sales-funnel"
              role="tab"
              aria-selected={dashboardTab === "funnel"}
            >
              Sales Funnel
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
