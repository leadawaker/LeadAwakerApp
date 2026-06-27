import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { PanelShell } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { StatHeader } from "./StatHeader";
import type { SpeedToLeadMetrics } from "../data/mockMetrics";

function MedianContent({ m }: { m: SpeedToLeadMetrics }) {
  const { t } = useTranslation("speedToLead");
  const onTarget = m.medianFirstTouchSec < m.targetSec;
  const suffix = m.medianLabel.replace(/[\d.]/g, "") || "s";

  return (
    <div className="flex flex-col">
      <StatHeader title={t("median.title")} />

      <div>
        <div className="flex items-baseline gap-1" data-testid="median-value">
          <span className="display" style={{ fontSize: 64, lineHeight: 1, color: "var(--wine)", fontWeight: 700 }}>
            {m.medianFirstTouchSec}
          </span>
          <span className="display" style={{ fontSize: 24, lineHeight: 1, color: "var(--mute)", fontWeight: 400, textTransform: "lowercase" }}>
            {suffix}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-3" style={{ color: "var(--mute)", fontSize: 13 }}>
          <span>{t("median.target", { seconds: m.targetSec })}</span>
          {onTarget && (
            <span
              className="flex items-center justify-center"
              style={{ width: 18, height: 18, borderRadius: "var(--r-pill)", background: "var(--good-tint)", color: "var(--good)" }}
            >
              <Check size={12} strokeWidth={3} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Hero card: median first-touch time. The global range switcher now lives on the
 *  Total Leads card. Pass bare=true when rendering inside a parent PanelShell. */
export function MedianFirstTouchCard({ m, bare }: { m: SpeedToLeadMetrics; bare?: boolean }) {
  if (bare) return <MedianContent m={m} />;
  return (
    <PanelShell testId="card-median-first-touch" style={{ minHeight: 280 }}>
      <MedianContent m={m} />
    </PanelShell>
  );
}
