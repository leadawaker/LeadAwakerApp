/**
 * CampaignMetricsPanel
 *
 * The "Summary" tab content of CampaignDetailView, rebuilt to match the Claude
 * design's CampaignMonitor dashboard:
 *   · AI Read strip (single line) on top, under the header
 *   · Performance panel (Day/Week/Month seg, inset surface)
 *   · Pipeline panel (donut + bars + Lead Heat, flat) + optional A/B panel (flat)
 *   · AI Activity panel (bump distribution + last-20-messages feed, raised)
 *   · Next panel (calls today / later this week, raised white card)
 *
 * Sub-components live in ./metricsWidgets/ and ./metricsWidgets/dashboard/
 */
import { useMemo } from "react";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { useLeads } from "@/hooks/useApiData";
import { AISummaryWidget } from "./metricsWidgets";
import { ABTestCard } from "./metricsWidgets";
import { PerformancePanel } from "./metricsWidgets/dashboard/PerformancePanel";
import { PipelinePanel } from "./metricsWidgets/dashboard/PipelinePanel";
import { AIActivityPanel } from "./metricsWidgets/dashboard/AIActivityPanel";
import { NextPanel } from "./metricsWidgets/dashboard/NextPanel";

// ── Demo mode ─────────────────────────────────────────────────────────────────
const DEMO_CAMPAIGN_IDS = new Set([36]);
const DEMO_AB_STATS = {
  split_ratio: 50,
  winner: "B",
  confidence: 0.87,
  leads_needed_for_95pct: 89,
  variants: {
    A: { leads: 612, response_rate: 0.29, booking_rate: 0.062, qualification_rate: 0.18, optout_rate: 0.04, avg_messages: 4.2, avg_response_time_min: 18 },
    B: { leads: 635, response_rate: 0.33, booking_rate: 0.104, qualification_rate: 0.22, optout_rate: 0.03, avg_messages: 3.8, avg_response_time_min: 14 },
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────
export interface CampaignMetricsPanelProps {
  campaign: Campaign;
  /** Full (unfiltered) metrics history for this campaign — timeframe is chosen inside the Performance panel. */
  allMetrics: CampaignMetricsHistory[];
  animTrigger: number;
  localAiSummary: string | null;
  localAiSummaryAt: string | null;
  compact?: boolean;
}

// ── CampaignMetricsPanel ──────────────────────────────────────────────────────
export function CampaignMetricsPanel({
  campaign,
  allMetrics,
  animTrigger,
  localAiSummary,
  localAiSummaryAt,
  compact = false,
}: CampaignMetricsPanelProps) {
  const campaignId = campaign.id || (campaign as any).Id;
  const accountId = campaign.account_id || (campaign as any).Accounts_id;
  const isDemoMode = DEMO_CAMPAIGN_IDS.has(campaignId);
  const abEnabled = Boolean((campaign as any).ab_enabled ?? (campaign as any).abEnabled);

  // Leads loaded once here, shared by Pipeline + Next (AI Activity loads its own
  // via the conversations hook since it also needs interactions).
  const { leads } = useLeads(undefined, campaignId);
  const leadList = useMemo(() => leads as Record<string, any>[], [leads]);

  return (
    <div className={cn("summary-root w-full flex flex-col")}>

      {/* AI Read strip — top, flat, full width */}
      <AISummaryWidget summary={localAiSummary} generatedAt={localAiSummaryAt} />

      {/*
        Responsive dashboard grid (container-query driven, see design-system.css):
          · narrow      → everything stacked
          · ≥900px      → Performance full-width on top, then 3 equal panels in a row
          · ≥1400px     → all 4 panels side by side, equal height; Performance goes
                          vertical (metrics over a taller chart)
      */}
      <div className="summary-grid">
        <div className="summary-perf">
          <PerformancePanel metrics={allMetrics} animTrigger={animTrigger} />
        </div>

        <div className="summary-panels">
          <div className="summary-cell">
            <PipelinePanel leads={leadList} />
          </div>
          <div className="summary-cell summary-cell--rail">
            <NextPanel leads={leadList} />
          </div>
          <div className="summary-cell summary-cell--rail">
            <AIActivityPanel campaign={campaign} accountId={accountId} />
          </div>
        </div>
      </div>

      {/* A/B test panel (rare) — full width below the grid when enabled */}
      {abEnabled && (
        <ABTestCard campaign={campaign} mockStats={isDemoMode ? DEMO_AB_STATS : undefined} />
      )}
    </div>
  );
}
