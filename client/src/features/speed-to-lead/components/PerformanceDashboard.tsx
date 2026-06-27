import { useState } from "react";
import type { SpeedToLeadMetrics, LeadRange } from "../data/mockMetrics";
import { MedianFirstTouchCard } from "./MedianFirstTouchCard";
import { ChannelMixCard } from "./ChannelMixCard";
import { ResponseDistributionCard } from "./ResponseDistributionCard";
import { TotalLeadsCard } from "./TotalLeadsCard";
import { LeadSourcesCard } from "./LeadSourcesCard";
import { LiveFirstTouchFeed } from "./LiveFirstTouchFeed";
import { AiOperationsInsights } from "./AiOperationsInsights";
import { PanelShell } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";

/**
 * Speed-to-Lead performance dashboard layout:
 *   Row 1 — one big raised panel (3 equal cols, titles aligned at the top):
 *     Left:   Median First Touch
 *     Middle: Total Leads + inline chart (owns the range switcher next to its title)
 *     Right:  Channel Mix (donut + per-channel legend)
 *   Row 2 — flat on bg: [Live Feed (wider) | AI Insights]
 *   Row 3 — two inset panels side by side: [Response Distribution | Lead Sources]
 *
 * activeRange lives here and is shared: TotalLeadsCard shows the switcher and
 * consumes the value for chart/number display.
 */
export function PerformanceDashboard({ m }: { m: SpeedToLeadMetrics }) {
  const [activeRange, setActiveRange] = useState<LeadRange>("24h");
  const COL_PAD = 26;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Row 1: unified raised panel — three aligned stat columns ─────────── */}
      <PanelShell testId="panel-top-stats" style={{ padding: 0, overflow: "hidden" }}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1px 1fr 1px 1fr" }}>
          <div style={{ padding: COL_PAD }}>
            <MedianFirstTouchCard m={m} bare />
          </div>

          <div style={{ background: "var(--line)" }} />

          <div style={{ padding: COL_PAD }}>
            <TotalLeadsCard m={m} bare activeRange={activeRange} onRangeChange={setActiveRange} />
          </div>

          <div style={{ background: "var(--line)" }} />

          <div style={{ padding: COL_PAD }}>
            <ChannelMixCard m={m} bare />
          </div>
        </div>
      </PanelShell>

      {/* ── Row 2: flat — Live Feed + AI Insights ───────────────────────────── */}
      <div className="grid gap-10" style={{ gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1fr)" }}>
        <LiveFirstTouchFeed m={m} />
        <AiOperationsInsights m={m} />
      </div>

      {/* ── Row 3: inset pair — Response Distribution + Lead Sources ─────────── */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <PanelShell testId="card-distribution" variant="inset">
          <ResponseDistributionCard m={m} bare />
        </PanelShell>
        <PanelShell testId="card-lead-sources" variant="inset">
          <LeadSourcesCard m={m} bare />
        </PanelShell>
      </div>
    </div>
  );
}
