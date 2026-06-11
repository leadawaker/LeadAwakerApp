import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Plus, ChevronRight, MoreHorizontal, MessageCircle } from "lucide-react";
import { CAMPAIGN_STATUS_HEX } from "@/lib/avatarUtils";
import { Panel, PanelAction, Stat } from "./atoms";
import type { CampaignRowData } from "./types";

const ROUTE_PREFIX = "/platform";

function CampaignStatusPill({ status }: { status: string }) {
  if (!status) return null;
  const hex = CAMPAIGN_STATUS_HEX[status] || "var(--mute-2)";
  return (
    <span className="row" style={{ gap: 5, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute)" }}>
      <span className="dot" style={{ background: hex }} />{status}
    </span>
  );
}

function CampaignRow({ c, onOpen, leadsLabel, respLabel }: { c: CampaignRowData; onOpen: () => void; leadsLabel: string; respLabel: string }) {
  return (
    <div
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 14px", borderRadius: "var(--r-surface)", cursor: "pointer", transition: "background 130ms", background: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--wine-tint)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div className="la-mono-tile" style={{ width: 38, height: 38, fontFamily: "var(--mono)", fontSize: 12, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", color: "var(--mute)" }}>{c.mono}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <CampaignStatusPill status={c.status} />
          <span className="row" style={{ gap: 5, fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)", letterSpacing: "0.06em" }}><MessageCircle size={12} />{c.channel}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, flexShrink: 0 }}>
        <Stat n={c.leads} l={leadsLabel} />
        <Stat n={`${c.resp}%`} l={respLabel} accent />
      </div>
      <button className="la-btn la-btn--inset la-btn--icon" style={{ flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onOpen(); }}><MoreHorizontal size={14} /></button>
    </div>
  );
}

export function CampaignsPanel({ campaigns, loading }: { campaigns: CampaignRowData[]; loading?: boolean }) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();

  const openCampaign = (id: number) => {
    if (id) { try { localStorage.setItem("selected-campaign-id", String(id)); } catch {} }
    setLocation(`${ROUTE_PREFIX}/campaigns`);
  };

  return (
    <Panel eyebrow="02" title={t("panels.campaigns")} count={t("metrics.nActive", { count: campaigns.length })}
      action={<PanelAction wine icon={<Plus size={12} />} onClick={() => setLocation(`${ROUTE_PREFIX}/campaigns`)}>{t("panels.actions.new")}</PanelAction>}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ height: 56, borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }} className="animate-pulse" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--mute-2)", fontStyle: "italic", padding: "6px 2px" }}>{t("related.noCampaigns")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {campaigns.map((c, i) => (
            <div key={c.id}>
              {i > 0 && <div className="rule" style={{ margin: "0 14px" }} />}
              <CampaignRow c={c} onOpen={() => openCampaign(c.id)} leadsLabel={t("panels.leads")} respLabel={t("panels.response")} />
            </div>
          ))}
        </div>
      )}
      <button className="la-btn la-btn--soft" style={{ alignSelf: "center", marginTop: 12 }} onClick={() => setLocation(`${ROUTE_PREFIX}/campaigns`)}>
        {t("panels.actions.viewAllCampaigns")}<ChevronRight size={12} />
      </button>
    </Panel>
  );
}
