import { useTranslation } from "react-i18next";
import { Check, AlertTriangle, Sparkles } from "lucide-react";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import type { SpeedToLeadMetrics } from "../data/mockMetrics";

/** Plain-language AI read-out of the dashboard: wins (✓) and watch-outs (⚠). */
export function AiOperationsInsights({ m }: { m: SpeedToLeadMetrics }) {
  const { t } = useTranslation("speedToLead");

  return (
    <PanelShell testId="card-ai-insights" className="min-h-0" variant="flat" style={{ padding: "28px 0", borderRadius: 0, overflow: "visible" }}>
      <SectionHead
        title={t("insights.title")}
        titleSize={18}
        marginBottom={14}
        action={
          <span
            className="flex items-center justify-center"
            style={{ width: 30, height: 30, borderRadius: "var(--r-button)", background: "var(--wine-tint)", color: "var(--wine)" }}
          >
            <Sparkles size={15} />
          </span>
        }
      />

      <div className="flex flex-col">
        {m.insights.map((ins, i) => {
          const good = ins.tone === "good";
          const Icon = good ? Check : AlertTriangle;
          const color = good ? "var(--good)" : "var(--warn)";
          const tint = good ? "var(--good-tint)" : "var(--warn-tint)";
          return (
            <div
              key={ins.key}
              className="flex items-start gap-3 py-3.5"
              style={{ borderBottom: i < m.insights.length - 1 ? "1px solid var(--line)" : "none" }}
            >
              <span
                className="flex items-center justify-center shrink-0 mt-0.5"
                style={{ width: 24, height: 24, borderRadius: "50%", background: tint, color }}
              >
                <Icon size={14} strokeWidth={good ? 3 : 2.4} />
              </span>
              <div className="min-w-0">
                <div style={{ fontSize: 13.5, color: "var(--ink-soft)", fontWeight: 600, lineHeight: 1.3 }}>
                  {t(`insights.${ins.key}.headline`)}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 3, lineHeight: 1.4 }}>
                  {t(`insights.${ins.key}.detail`)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}
