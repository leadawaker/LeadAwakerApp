import { useTranslation } from "react-i18next";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { HBar } from "./HBar";
import type { SpeedToLeadMetrics } from "../data/mockMetrics";

const AXIS_MAX = 60;

function ResponseDistributionContent({ m }: { m: SpeedToLeadMetrics }) {
  const { t } = useTranslation("speedToLead");

  return (
    <>
      <SectionHead title={t("distribution.title")} titleSize={18} marginBottom={16} />

      <div className="flex flex-col gap-3 flex-1">
        {m.distribution.map((b) => (
          <div key={b.key} className="flex items-center gap-3">
            <span style={{ fontSize: 12, color: "var(--ink-soft)", minWidth: 64 }}>
              {t(`distribution.${b.key}`)}
            </span>
            <HBar pct={b.pct} max={AXIS_MAX} color={b.tone === "good" ? "var(--good)" : "var(--wine)"} height={9} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", fontWeight: 600, minWidth: 34, textAlign: "right" }}>
              {b.pct}%
            </span>
          </div>
        ))}
      </div>

    </>
  );
}

/** Horizontal distribution of first-touch buckets; fast buckets sage, slow wine.
 *  Pass bare=true when rendering inside a parent PanelShell (skips own shell). */
export function ResponseDistributionCard({ m, bare }: { m: SpeedToLeadMetrics; bare?: boolean }) {
  if (bare) return <ResponseDistributionContent m={m} />;
  return (
    <PanelShell testId="card-distribution" variant="flat" style={{ borderRadius: 0, overflow: "visible", padding: "8px 4px", minHeight: 220 }}>
      <ResponseDistributionContent m={m} />
    </PanelShell>
  );
}
