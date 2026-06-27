import { useTranslation } from "react-i18next";
import { MessageCircle, Mail, Smartphone } from "lucide-react";
import { PanelShell } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { DonutChart } from "@/components/ui/donut-chart";
import { StatHeader } from "./StatHeader";
import type { SpeedToLeadMetrics } from "../data/mockMetrics";

const CHANNEL_ICON: Record<string, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  smsFallback: Smartphone,
  emailFallback: Mail,
};

function ChannelMixContent({ m }: { m: SpeedToLeadMetrics }) {
  const { t } = useTranslation("speedToLead");
  const dominant = m.channelMix[0];

  return (
    <>
      <StatHeader title={t("channelMix.title")} />

      {/* Donut (left) + per-channel legend (right): share %, count, median time. */}
      <div className="flex items-center gap-5">
        <DonutChart
          size={116}
          strokeWidth={13}
          skipAnimation
          strokeLinecap="butt"
          raised
          data={m.channelMix.map((c) => ({ key: c.key, label: c.key, value: c.pct, color: c.color }))}
          centerContent={
            <div className="flex flex-col items-center">
              <span className="display" style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1 }}>
                {m.dominantChannelPct}%
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)", marginTop: 3 }}>
                {t(`channels.${dominant.key}`)}
              </span>
            </div>
          }
        />

        <div className="flex-1 flex flex-col gap-3.5 min-w-0">
          {m.channelMix.map((c) => {
            const Icon = CHANNEL_ICON[c.key] ?? MessageCircle;
            return (
              <div key={c.key} className="flex items-center justify-between gap-2 min-w-0">
                <span className="flex items-center gap-2 min-w-0" style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                  <span style={{ color: c.color, display: "flex" }}><Icon size={15} /></span>
                  <span className="truncate">{t(`channels.${c.key}`)}</span>
                </span>
                <span className="flex flex-col items-end shrink-0">
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", fontWeight: 600 }}>
                    {c.medianLabel}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)", marginTop: 2 }}>
                    {t("channelMix.shareCount", { pct: c.pct, count: c.count.toLocaleString() })}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Donut of channel share + a legend with per-channel share, count and median time.
 *  Pass bare=true when rendering inside a parent PanelShell (skips own shell). */
export function ChannelMixCard({ m, bare }: { m: SpeedToLeadMetrics; bare?: boolean }) {
  if (bare) return <ChannelMixContent m={m} />;
  return (
    <PanelShell testId="card-channel-mix" variant="flat" style={{ borderRadius: 0, overflow: "visible", padding: "8px 4px", minHeight: 220 }}>
      <ChannelMixContent m={m} />
    </PanelShell>
  );
}
