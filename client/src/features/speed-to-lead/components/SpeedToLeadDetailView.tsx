import { getSpeedToLeadMetrics, type SpeedToLeadCampaign } from "../data/mockMetrics";
import { SpeedToLeadDetailHeader } from "./SpeedToLeadDetailHeader";
import { PerformanceDashboard } from "./PerformanceDashboard";
import { SpeedToLeadSettings } from "./SpeedToLeadSettings";
import { PanelShell } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import type { SpeedToLeadTab } from "./SpeedToLeadTopbar";

/** Selected-campaign detail body: header + (Performance dashboard | Settings). */
export function SpeedToLeadDetailView({
  campaign,
  tab,
}: {
  campaign: SpeedToLeadCampaign;
  tab: SpeedToLeadTab;
}) {
  const m = getSpeedToLeadMetrics(campaign.id);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" data-testid="speed-to-lead-detail">
      {/* Sticky header — freezes on scroll */}
      <div className="sticky top-0 z-20" style={{ background: "var(--bg)" }}>
        <div className="max-w-[1386px] mr-auto px-4 md:px-6 pt-6 pb-4">
          <PanelShell testId="speed-to-lead-header-panel">
            <SpeedToLeadDetailHeader campaign={campaign} />
          </PanelShell>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="max-w-[1386px] mr-auto px-4 md:px-6 pb-6">
        {tab === "performance" ? (
          <PerformanceDashboard m={m} />
        ) : (
          <SpeedToLeadSettings campaign={campaign} />
        )}
      </div>
    </div>
  );
}
