// AI Activity panel — "Just happened" feed of the last 20 messages (in/out).
// Bumps Today section was split into a separate BumpsTodayPanel.
// Mirrors the Claude design's AIActivityCard. neu-raised surface.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Campaign } from "@/types/models";
import { useConversationsData } from "@/features/conversations/hooks/useConversationsData";
import { SectionHead } from "../panelPrimitives";
import { recentMessages } from "./utils";

export function AIActivityPanel({ campaign, accountId }: { campaign: Campaign; accountId: number }) {
  const { t } = useTranslation("campaigns");
  const campaignId = campaign.id || (campaign as any).Id;
  const { leads, interactions } = useConversationsData(accountId, campaignId);

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
    <div className="surface-panel" style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      padding: "20px 18px"
    }} data-testid="campaign-detail-view-activity">
      <SectionHead
        eyebrow={
          <span className="row" style={{ gap: 7 }}>
            <span className="la-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--good)" }} />
            {t("summary.eyebrows.live")}
          </span>
        }
        title={t("summary.justHappened", "Just Happened")}
        titleSize={32}
        marginBottom={20}
      />
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
    </div>
  );
}
