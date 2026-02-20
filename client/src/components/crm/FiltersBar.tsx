import { useMemo, useEffect } from "react";
import { useCampaigns } from "@/hooks/useApiData";
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
  const { campaigns } = useCampaigns();

  // Sync with Topbar campaign selector via localStorage
  useEffect(() => {
    const handleSync = () => {
      const stored = localStorage.getItem("leadawaker_selected_campaign");
      if (stored) {
        setSelectedCampaignId(stored === "all" ? "all" : Number(stored));
      }
    };

    window.addEventListener("storage", handleSync);
    // Initial sync
    handleSync();
    return () => window.removeEventListener("storage", handleSync);
  }, [setSelectedCampaignId]);

  const campaignOptions = useMemo(() => {
    return campaigns.filter((c: any) => {
      const accId = c.account_id || c.accounts_id || c.Accounts_id;
      return accId === currentAccountId;
    });
  }, [campaigns, currentAccountId]);

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between" data-testid="bar-filters">
      <div className="flex items-center gap-2" data-testid="row-campaign-and-tabs">
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
