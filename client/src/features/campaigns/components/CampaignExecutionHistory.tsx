/**
 * CampaignExecutionHistory
 *
 * Execution timeline and run history for a campaign.
 * Currently a stub — execution history data is not yet implemented in the API.
 * Intended to display past execution runs, their status, and timing.
 */
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";

export interface CampaignExecutionHistoryProps {
  campaignId: number;
}

export function CampaignExecutionHistory({ campaignId }: CampaignExecutionHistoryProps) {
  const { t } = useTranslation("campaigns");

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Clock className="w-8 h-8 text-foreground/20" />
      <p className="text-[12px] text-foreground/40">
        Execution history coming soon
      </p>
    </div>
  );
}
