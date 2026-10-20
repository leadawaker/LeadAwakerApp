// Chat > Overview: this month's chats on the website and WhatsApp, the last
// one, and whether each channel is wired. Wiring itself lives on Integrations.
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarCheck, Globe, MessageCircle, UserRound, Radio } from "lucide-react";
import { StatCard } from "@/features/billing/components/workspace/atoms";
import { useHomeWebsite, useHomeWhatsapp } from "@/features/home/api/homeApi";
import type { WidgetConfigRow } from "../../../api/widgetApi";
import { ChatCard, helpStyle } from "./chatAtoms";
import type { ChatCampaign } from "./useChatCampaign";

type ChannelState = "on" | "pending" | "off";
const DOT: Record<ChannelState, string> = { on: "var(--good)", pending: "var(--warn)", off: "var(--mute-2)" };

function ChannelRow({ icon, label, state, detail }: { icon: React.ReactNode; label: string; state: ChannelState; detail: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ color: "var(--mute)", display: "flex" }}>{icon}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", flex: "0 0 auto" }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--mute)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: DOT[state], flexShrink: 0 }} />
    </div>
  );
}

/** The widget answers only when it is switched on and allowed on at least one site. */
export function widgetLive(widget: WidgetConfigRow | null): boolean {
  return !!widget && widget.enabled !== false && (widget.allowedDomains?.length ?? 0) > 0;
}

export function ChatOverview({ accountId, campaign, widget, onOpenIntegrations }: {
  accountId: number; campaign: ChatCampaign; widget: WidgetConfigRow | null; onOpenIntegrations?: () => void;
}) {
  const { t, i18n } = useTranslation("chatTab");
  const scope = { accountId, period: "month" as const };
  const wa = useHomeWhatsapp(scope);
  const web = useHomeWebsite(scope);
  const loading = wa.isLoading || web.isLoading;
  const n = (v: number | undefined) => (loading ? "…" : String(v ?? 0));

  const recent = [...(wa.data?.recent ?? []).map((r) => ({ ...r, channel: "whatsapp" as const })), ...(web.data?.recent ?? []).map((r) => ({ ...r, channel: "website" as const }))]
    .sort((a, b) => b.at.localeCompare(a.at));
  const last = recent[0];
  const when = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  const live = widgetLive(widget);
  const sender = wa.data?.sender ?? null;
  const active = String(campaign.status ?? "").toLowerCase() === "active";

  return (
    <>
      <div data-testid="chat-stats">
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 12 }}>{t("overview.thisMonth")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
          <StatCard label={t("overview.websiteChats")} value={n(web.data?.chats.value)} accent="var(--wine)" icon={<Globe size={15} />} />
          <StatCard label={t("overview.whatsappChats")} value={n(wa.data?.conversations.value)} accent="var(--stage-contacted)" icon={<MessageCircle size={15} />} />
          <StatCard label={t("overview.bookings")} value={n((web.data?.bookings.value ?? 0) + (wa.data?.bookings.value ?? 0))} accent="var(--good)" icon={<CalendarCheck size={15} />} />
          <StatCard label={t("overview.handedOff")} value={n(wa.data?.handedOff.value)} icon={<UserRound size={15} />} />
        </div>
      </div>

      <ChatCard icon={<MessageCircle size={17} />} title={t("overview.lastChat")} testId="chat-last">
        {last ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
              {last.name || t("overview.unknownName")}
              <span style={{ fontWeight: 400, color: "var(--mute)" }}> · {t(`overview.channel.${last.channel}`)} · {when(last.at)}</span>
            </div>
            {last.snippet && <div style={{ fontSize: 13, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.snippet}</div>}
          </div>
        ) : <p style={{ ...helpStyle, margin: 0 }}>{loading ? "…" : t("overview.noChats")}</p>}
      </ChatCard>

      <ChatCard icon={<Radio size={17} />} title={t("overview.channels")} testId="chat-channels">
        <ChannelRow
          icon={<MessageCircle size={15} />} label={t("overview.assistant")} state={active ? "on" : "pending"}
          detail={`${campaign.name ?? ""} · ${t(active ? "overview.active" : "overview.notActive", { status: campaign.status ?? "" })}`}
        />
        <ChannelRow
          icon={<Globe size={15} />} label={t("overview.channel.website")} state={live ? "on" : widget ? "pending" : "off"}
          detail={live ? t("overview.widgetLive", { domain: widget!.allowedDomains![0] }) : widget ? t("overview.widgetNotLive") : t("overview.widgetNone")}
        />
        <ChannelRow
          icon={<MessageCircle size={15} />} label={t("overview.channel.whatsapp")} state={sender?.connected ? "on" : "off"}
          detail={sender?.connected ? t("overview.senderOn") : t("overview.senderOff")}
        />
        {onOpenIntegrations && (
          <>
            <p style={{ ...helpStyle, margin: "14px 0 12px" }}>{t("overview.wiringHelp")}</p>
            <button type="button" className="la-btn la-btn--soft" onClick={onOpenIntegrations} data-testid="chat-open-integrations">
              {t("overview.openIntegrations")} <ArrowRight size={13} />
            </button>
          </>
        )}
      </ChatCard>
    </>
  );
}
