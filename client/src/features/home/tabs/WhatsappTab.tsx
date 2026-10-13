import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Pill } from "@/components/crm/primitives/Pill";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { useHomeWhatsapp } from "../api/homeApi";
import { BarList } from "../components/BarList";
import { DayChart } from "../components/DayChart";
import { EmptyState } from "../components/EmptyState";
import banner from "@/assets/home/whatsapp.webp";
import { HomeBanner } from "../components/HomeBanner";
import { RowList } from "../components/RowList";
import { StatRow } from "../components/StatRow";
import { trendOf } from "../lib/homeFormat";
import type { HomeTabProps } from "./tabTypes";

export default function WhatsappTab({ scope, services }: HomeTabProps) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useHomeWhatsapp(scope);

  if (isError) return <EmptyState title={t("errorTitle")} body={t("error")} />;

  const recentRows = (data?.recent ?? []).map((r) => ({
    key: String(r.leadId),
    title: r.name || t("unknownContact"),
    meta: r.snippet,
    time: r.at,
    onClick: () => setLocation(`/platform/contacts/${r.leadId}`),
  }));
  const messagesIn = data?.messagesIn.value ?? 0;
  const messagesOut = data?.messagesOut.value ?? 0;
  const followUps = data?.followUps ?? 0;
  const showFollowUps = !!data && (followUps > 0 || services.phone);
  const sms = data?.sms ?? null;
  const sender = data?.sender ?? null;
  const showSide = showFollowUps || !!sms || !!sender;

  return (
    <div className="flex flex-col gap-5">
      <HomeBanner
        eyebrow={t("tabs.whatsapp")}
        value={isLoading || !data ? "…" : data.conversations.value}
        sentence={t("whatsapp.banner")}
        trend={data ? trendOf(data.conversations) : null}
        vsLabel={t(`vs.${scope.period}`)}
        image={banner}
      />
      <StatRow items={[
        { key: "conversations", label: t("whatsapp.tiles.conversations"), value: data?.conversations.value ?? "…", compared: data?.conversations },
        {
          key: "messages", label: t("whatsapp.tiles.messages"), value: data ? messagesIn + messagesOut : "…",
          sub: data ? t("whatsapp.tiles.messagesSub", { in: messagesIn, out: messagesOut }) : undefined,
        },
        { key: "bookings", label: t("whatsapp.tiles.bookings"), value: data?.bookings.value ?? "…", compared: data?.bookings },
        { key: "handedOff", label: t("whatsapp.tiles.handedOff"), value: data?.handedOff.value ?? "…", compared: data?.handedOff },
      ]} />
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        <PanelShell>
          <SectionHead title={t("whatsapp.perDay")} />
          <DayChart data={data?.perDay ?? []} label={t("whatsapp.perDay")} />
        </PanelShell>
        {showSide && (
          <div className="flex flex-col gap-5">
            {showFollowUps && (
              <PanelShell variant="flat">
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 22, color: "var(--ink)" }}>{followUps}</span>
                  <span style={{ fontSize: 13.5, color: "var(--mute)" }}>{t("whatsapp.followUps", { count: followUps })}</span>
                </div>
              </PanelShell>
            )}
            {sms && (
              <PanelShell>
                <SectionHead title={t("whatsapp.sms.title")} />
                <div style={{ fontSize: 12.5, color: "var(--mute)", paddingBottom: 8 }}>{t("whatsapp.sms.note")}</div>
                <BarList rows={[
                  { key: "sent", label: t("whatsapp.sms.sent"), value: sms.sent },
                  { key: "delivered", label: t("whatsapp.sms.delivered"), value: sms.delivered },
                  { key: "failed", label: t("whatsapp.sms.failed"), value: sms.failed },
                ]} />
                {sms.followUpShare !== null && (
                  <div style={{ fontSize: 12.5, color: "var(--mute)", paddingTop: 8 }}>{t("whatsapp.sms.share", { pct: sms.followUpShare })}</div>
                )}
              </PanelShell>
            )}
            {sender && (
              <PanelShell variant="flat">
                <SectionHead title={t("whatsapp.sender.title")} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Pill>{t(sender.connected ? "whatsapp.sender.connected" : "whatsapp.sender.notConnected")}</Pill>
                  {sender.quality && <span style={{ fontSize: 13, color: "var(--mute)" }}>{t("whatsapp.sender.quality", { rating: sender.quality })}</span>}
                </div>
              </PanelShell>
            )}
          </div>
        )}
      </div>
      <PanelShell>
        <SectionHead title={t("whatsapp.recent")} />
        <RowList rows={recentRows} empty={t("whatsapp.recentEmpty")} />
      </PanelShell>
    </div>
  );
}
