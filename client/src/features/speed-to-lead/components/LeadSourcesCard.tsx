import { useTranslation } from "react-i18next";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { HBar } from "./HBar";
import { sourceMeta } from "./sourceMeta";
import type { SpeedToLeadMetrics } from "../data/mockMetrics";

function LeadSourcesContent({ m }: { m: SpeedToLeadMetrics }) {
  const { t } = useTranslation("speedToLead");

  return (
    <>
      <SectionHead title={t("sources.title")} titleSize={18} marginBottom={16} />
      <div className="flex flex-col gap-1.5 flex-1">
        {m.sources.map((s) => {
          const { icon: Icon, color } = sourceMeta(s.key);
          return (
            <div key={s.key} className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0" style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                  <span style={{ color, display: "flex" }}><Icon size={14} /></span>
                  <span className="truncate">{t(`sources.${s.key}`)}</span>
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", fontWeight: 600 }}>
                  {s.pct}%
                </span>
              </div>
              <HBar pct={s.pct} color="var(--wine)" height={7} />
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Vertical lead-source breakdown: stacked bars with brand icons.
 *  Pass bare=true when rendering inside a parent PanelShell (skips own shell). */
export function LeadSourcesCard({ m, bare }: { m: SpeedToLeadMetrics; bare?: boolean }) {
  if (bare) return <LeadSourcesContent m={m} />;
  return (
    <PanelShell testId="card-lead-sources">
      <LeadSourcesContent m={m} />
    </PanelShell>
  );
}
