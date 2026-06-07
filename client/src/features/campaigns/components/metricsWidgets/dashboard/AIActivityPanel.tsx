// AI Activity panel — inset "Today's bump distribution" cadence ladder + a
// "Just happened" feed of the last 20 messages (in/out). Mirrors the Claude
// design's AIActivityCard. neu-raised surface.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Campaign } from "@/types/models";
import { useConversationsData } from "@/features/conversations/hooks/useConversationsData";
import { PanelShell, SectionHead } from "../panelPrimitives";
import { bumpDistribution, recentMessages, type CadenceRow } from "./utils";

const LADDER_COLORS = ["var(--stage-new)", "var(--stage-contacted)", "var(--stage-responded)", "var(--stage-multi)", "var(--mute-2)"];

function CadenceLadder({ cadence }: { cadence: CadenceRow[] }) {
  const max = Math.max(1, ...cadence.map((c) => c.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {cadence.map((c, i) => (
        <div key={c.key} className="row" style={{ gap: 14 }}>
          <div style={{ width: 90, fontSize: 12, color: "var(--ink-soft)", fontWeight: 500 }}>{c.label}</div>
          <div style={{ width: 42, fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)", letterSpacing: "0.06em" }}>{c.dayLabel}</div>
          <div style={{ flex: 1, height: 14, background: "var(--card)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
            <div style={{ width: `${(c.count / max) * 100}%`, height: "100%", background: LADDER_COLORS[i] || "var(--mute-2)", borderRadius: "var(--r-pill)", transition: "width 400ms" }} />
          </div>
          <div style={{ width: 28, textAlign: "right", fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink)" }}>{c.count}</div>
        </div>
      ))}
    </div>
  );
}

export function AIActivityPanel({ campaign, accountId }: { campaign: Campaign; accountId: number }) {
  const { t } = useTranslation("campaigns");
  const campaignId = campaign.id || (campaign as any).Id;
  const { leads, interactions } = useConversationsData(accountId, campaignId);

  const { queuedToday, cadence } = useMemo(() => bumpDistribution(leads, campaign), [leads, campaign]);

  const nameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of leads as any[]) {
      const id = Number(l.id ?? l.Id ?? 0);
      m.set(id, l.full_name || l.fullName || l.name || "—");
    }
    return m;
  }, [leads]);

  const recent = useMemo(
    () => recentMessages(interactions as any[], campaignId, (id) => nameById.get(id) || "", 20),
    [interactions, campaignId, nameById],
  );

  return (
    <PanelShell variant="raised" testId="campaign-detail-view-activity" style={{ height: "100%" }}>
      <SectionHead
        eyebrow={
          <span className="row" style={{ gap: 7 }}>
            <span className="la-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--good)" }} />
            {t("summary.eyebrows.live")}
          </span>
        }
        title={t("summary.aiActivity")}
        titleSize={32}
        marginBottom={20}
      />

      {/* Bump distribution (inset) */}
      <div className="neu-inset" style={{ padding: "16px 18px", borderRadius: "var(--r-card)", marginBottom: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <span className="eyebrow eyebrow-sm">{t("summary.bumpDistribution")}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", color: "var(--mute)" }}>
            {t("summary.queued", { count: queuedToday })}
          </span>
        </div>
        <CadenceLadder cadence={cadence} />
      </div>

      {/* Just happened */}
      <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10 }}>{t("summary.justHappened")}</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {recent.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--mute)", padding: "8px 0" }}>{t("summary.noMessages")}</div>
        ) : recent.map((r) => {
          const inbound = r.direction === "in";
          const color = inbound ? "var(--good)" : "var(--mute)";
          const Icon = inbound ? ArrowDownLeft : ArrowUpRight;
          return (
            <div key={r.id} className="row" style={{ gap: 14, padding: "11px 0", borderBottom: "1px solid var(--line)", alignItems: "flex-start" }}>
              <div style={{ width: 30, height: 30, borderRadius: "var(--r-button)", flexShrink: 0, marginTop: 1, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", display: "flex", alignItems: "center", justifyContent: "center", color }}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.name}</span>
                  <span style={{ fontSize: 12, color, fontWeight: 500 }}>{inbound ? t("summary.replied") : t("summary.sent")}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.preview}</div>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", letterSpacing: "0.06em", whiteSpace: "nowrap", marginTop: 2 }}>{r.ago}</span>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}
