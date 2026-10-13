import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { useHomeWebsite } from "../api/homeApi";
import { DayChart } from "../components/DayChart";
import { EmptyState } from "../components/EmptyState";
import banner from "@/assets/home/website.webp";
import { HomeBanner } from "../components/HomeBanner";
import { RowList } from "../components/RowList";
import { StatRow } from "../components/StatRow";
import { rateOf, trendOf } from "../lib/homeFormat";
import type { HomeTabProps } from "./tabTypes";

export default function WebsiteTab({ scope }: HomeTabProps) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useHomeWebsite(scope);

  if (isError) return <EmptyState title={t("errorTitle")} body={t("error")} />;

  const rate = data ? rateOf(data.contacts.value, data.chats.value) : null;
  const recentRows = (data?.recent ?? []).map((r) => ({
    key: String(r.leadId),
    title: r.name || t("overview.visitor"),
    meta: r.snippet,
    time: r.at,
    onClick: () => setLocation(`/platform/contacts/${r.leadId}`),
  }));

  return (
    <div className="flex flex-col gap-5">
      <HomeBanner
        eyebrow={t("tabs.website")}
        value={isLoading || !data ? "…" : data.chats.value}
        sentence={t("website.banner")}
        trend={data ? trendOf(data.chats) : null}
        vsLabel={t(`vs.${scope.period}`)}
        image={banner}
      />
      <StatRow items={[
        { key: "chats", label: t("website.tiles.chats"), value: data?.chats.value ?? "…", compared: data?.chats },
        { key: "contacts", label: t("website.tiles.contacts"), value: data?.contacts.value ?? "…", compared: data?.contacts },
        {
          key: "rate", label: t("website.tiles.rate"), value: !data ? "…" : rate === null ? "-" : `${rate}%`,
          sub: data && rate === null ? t("website.tiles.rateNone") : undefined,
        },
        { key: "bookings", label: t("website.tiles.bookings"), value: data?.bookings.value ?? "…", compared: data?.bookings },
      ]} />
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        <PanelShell>
          <SectionHead title={t("website.perDay")} />
          <DayChart data={data?.perDay ?? []} label={t("website.perDay")} />
        </PanelShell>
        <PanelShell>
          <SectionHead title={t("website.recent")} />
          <RowList rows={recentRows} empty={t("website.recentEmpty")} />
        </PanelShell>
      </div>
    </div>
  );
}
