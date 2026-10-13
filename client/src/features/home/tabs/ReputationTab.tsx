import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Pill } from "@/components/crm/primitives/Pill";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useHomeReputation } from "../api/homeApi";
import { BarList } from "../components/BarList";
import { DayChart } from "../components/DayChart";
import { EmptyState } from "../components/EmptyState";
import banner from "@/assets/home/reputation.webp";
import { HomeBanner } from "../components/HomeBanner";
import { RowList } from "../components/RowList";
import { StatRow } from "../components/StatRow";
import { trendOf } from "../lib/homeFormat";
import type { HomeTabProps } from "./tabTypes";

export default function ReputationTab({ scope }: HomeTabProps) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { isAgencyUser } = useWorkspace();
  const { data, isLoading, isError } = useHomeReputation(scope);

  if (isError) return <EmptyState title={t("errorTitle")} body={t("error")} />;

  // The Reputation page is agency-only, so clients get no click-throughs.
  const openReputation = isAgencyUser ? () => setLocation("/platform/reputation") : undefined;
  const awaiting = data?.awaitingReply ?? 0;
  const avg = data?.avgRating.value ?? null;
  const ratingRows = [5, 4, 3, 2, 1].map((rating) => ({
    key: String(rating),
    label: t("reputation.stars", { count: rating }),
    value: data?.ratings.find((r) => r.rating === rating)?.count ?? 0,
  }));
  const recentRows = (data?.recent ?? []).map((r) => ({
    key: String(r.id),
    title: r.author || t("reputation.anonymous"),
    meta: r.text,
    tag: (
      <Pill>
        {r.rating !== null ? `${t("reputation.stars", { count: r.rating })}, ` : ""}
        {t(r.replied ? "reputation.replied" : "reputation.notReplied")}
      </Pill>
    ),
    time: r.at,
    onClick: openReputation,
  }));

  return (
    <div className="flex flex-col gap-5">
      <HomeBanner
        eyebrow={t("tabs.reputation")}
        value={isLoading || !data ? "…" : data.reviews.value}
        sentence={t("reputation.banner")}
        trend={data ? trendOf(data.reviews) : null}
        vsLabel={t(`vs.${scope.period}`)}
        image={banner}
        artY="25%"
      />
      {data && !data.connected && scope.accountId !== 0 && (
        <PanelShell variant="flat">
          <div style={{ fontSize: 13.5, color: "var(--mute)" }}>{t("reputation.notConnected")}</div>
        </PanelShell>
      )}
      <StatRow items={[
        {
          key: "avg", label: t("reputation.tiles.avgRating"), value: !data ? "…" : avg === null ? "-" : avg.toFixed(1),
          sub: data && avg === null ? t("reputation.tiles.avgNone") : undefined,
        },
        { key: "replied", label: t("reputation.tiles.replied"), value: data?.replied.value ?? "…", compared: data?.replied },
        {
          key: "awaiting", label: t("reputation.tiles.awaiting"), value: data ? awaiting : "…", filled: awaiting > 0 && isAgencyUser,
          sub: data ? t(awaiting === 0 ? "reputation.tiles.awaitingNone" : isAgencyUser ? "reputation.tiles.awaitingSub" : "reputation.tiles.awaitingClient") : undefined,
          onClick: openReputation,
        },
        { key: "requests", label: t("reputation.tiles.requests"), value: data?.requestsSent.value ?? "…", compared: data?.requestsSent },
      ]} />
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        <PanelShell>
          <SectionHead title={t("reputation.perDay")} />
          <DayChart data={data?.perDay ?? []} label={t("reputation.perDay")} />
        </PanelShell>
        <PanelShell>
          <SectionHead title={t("reputation.ratings")} />
          <BarList rows={ratingRows} />
        </PanelShell>
      </div>
      <PanelShell>
        <SectionHead title={t("reputation.recent")} />
        <RowList rows={recentRows} empty={t("reputation.recentEmpty")} />
      </PanelShell>
    </div>
  );
}
