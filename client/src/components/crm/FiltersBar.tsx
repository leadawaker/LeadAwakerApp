import { useMemo } from "react";
import { campaigns } from "@/data/mocks";
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

  const campaignOptions = useMemo(() => {
    const list = campaigns.filter((c) => c.account_id === currentAccountId);
    return list;
  }, [currentAccountId]);

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between" data-testid="bar-filters">
      <div className="flex items-center gap-2">
        <select
          value={selectedCampaignId}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedCampaignId(v === "all" ? "all" : Number(v));
          }}
          className="h-10 rounded-xl border border-border bg-muted/20 px-3 text-sm"
          data-testid="select-campaign"
        >
          <option value="all">All campaigns</option>
          {campaignOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
