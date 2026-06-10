// Bumps Today panel — inset "Today's bump distribution" cadence ladder.
// Ported from the previous AIActivityPanel. Mirrors the Claude design's BumpsCard.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Campaign } from "@/types/models";
import { useLeads } from "@/hooks/useApiData";
import { SectionHead } from "../panelPrimitives";
import { bumpDistribution, type CadenceRow } from "./utils";

const LADDER_COLORS = ["var(--stage-new)", "var(--stage-contacted)", "var(--stage-responded)", "var(--stage-multi)", "var(--mute-2)"];

function CadenceLadder({ cadence }: { cadence: CadenceRow[] }) {
  const max = Math.max(1, ...cadence.map((c) => c.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {cadence.map((c, i) => (
        <div key={c.key} className="row" style={{ gap: 10 }}>
          <div style={{ width: 80, fontSize: 12, color: "var(--ink-soft)", fontWeight: 500, flexShrink: 0 }}>{c.label}</div>
          <div style={{ flex: 1, height: 22, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
            <div style={{ width: `${(c.count / max) * 100}%`, height: "100%", background: LADDER_COLORS[i] || "var(--mute-2)", borderRadius: "var(--r-pill)", transition: "width 400ms" }} />
          </div>
          <div style={{ width: 28, textAlign: "right", fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink)", flexShrink: 0 }}>{c.count}</div>
        </div>
      ))}
    </div>
  );
}

export function BumpsTodayPanel({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation("campaigns");
  const campaignId = campaign.id || (campaign as any).Id;
  const { leads } = useLeads(undefined, campaignId);

  const { queuedToday, cadence } = useMemo(() => bumpDistribution(leads as Record<string, any>[], campaign), [leads, campaign]);

  return (
    <div className="surface-panel" style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      padding: "20px 18px"
    }}>
      <SectionHead
        titleSize={32}
        title={t("summary.bumpsToday", "Bumps Today")}
        marginBottom={20}
        action={
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", color: "var(--mute)" }}>
            {t("summary.queued", { count: queuedToday })}
          </span>
        }
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <CadenceLadder cadence={cadence} />
      </div>
    </div>
  );
}
