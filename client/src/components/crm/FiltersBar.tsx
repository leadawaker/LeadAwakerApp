import { useMemo, useEffect } from "react";
import { useCampaigns } from "@/hooks/useApiData";
import { useWorkspace } from "@/hooks/useWorkspace";

export function FiltersBar({
  selectedCampaignId,
  setSelectedCampaignId,
  allowAllAccounts,
}: {
  selectedCampaignId: number | "all";
  setSelectedCampaignId: (v: number | "all") => void;
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

      </div>
    </div>
  );
}
