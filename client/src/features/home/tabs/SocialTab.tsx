import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { useHomeSocial } from "../api/homeApi";
import { DayChart } from "../components/DayChart";
import { EmptyState } from "../components/EmptyState";
import banner from "@/assets/home/social.webp";
import { HomeBanner } from "../components/HomeBanner";
import { RowList } from "../components/RowList";
import { StatRow } from "../components/StatRow";
import { rateOf, trendOf } from "../lib/homeFormat";
import type { HomeTabProps } from "./tabTypes";

export default function SocialTab({ scope }: HomeTabProps) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useHomeSocial(scope);

  if (isError) return <EmptyState title={t("errorTitle")} body={t("error")} />;

  const messagesIn = data?.messagesIn.value ?? 0;
  const messagesOut = data?.messagesOut.value ?? 0;
  const rate = data ? rateOf(data.bookings.value, data.conversations.value) : null;
  const recentRows = (data?.recent ?? []).map((r) => ({
    key: String(r.leadId),
    title: r.name || t("unknownContact"),
    meta: r.snippet,
    time: r.at,
    onClick: () => setLocation(`/platform/contacts/${r.leadId}`),
  }));

  return (
    <div className="flex flex-col gap-5">
      <HomeBanner
        eyebrow={t("tabs.social")}
        value={isLoading || !data ? "…" : data.conversations.value}
        sentence={t("social.banner")}
        trend={data ? trendOf(data.conversations) : null}
        vsLabel={t(`vs.${scope.period}`)}
        image={banner}
        artY="10%"
      />
      {data && !data.connected && scope.accountId !== 0 && (
        <PanelShell variant="flat">
          <div style={{ fontSize: 13.5, color: "var(--mute)" }}>{t("social.notConnected")}</div>
        </PanelShell>
      )}
      <StatRow items={[
        { key: "conversations", label: t("social.tiles.conversations"), value: data?.conversations.value ?? "…", compared: data?.conversations },
        {
          key: "messages", label: t("social.tiles.messages"), value: data ? messagesIn + messagesOut : "…",
          sub: data ? t("social.tiles.messagesSub", { in: messagesIn, out: messagesOut }) : undefined,
        },
        { key: "bookings", label: t("social.tiles.bookings"), value: data?.bookings.value ?? "…", compared: data?.bookings },
        {
          key: "rate", label: t("social.tiles.bookingRate"), value: !data ? "…" : rate === null ? "-" : `${rate}%`,
          sub: data && rate === null ? t("social.tiles.rateNone") : undefined,
        },
      ]} />
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        <PanelShell>
          <SectionHead title={t("social.perDay")} />
          <DayChart data={data?.perDay ?? []} label={t("social.perDay")} />
        </PanelShell>
        <PanelShell>
          <SectionHead title={t("social.recent")} />
          <RowList rows={recentRows} empty={t("social.recentEmpty")} />
        </PanelShell>
      </div>
    </div>
  );
}
