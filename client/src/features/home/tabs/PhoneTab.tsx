import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Pill } from "@/components/crm/primitives/Pill";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { StatCard } from "@/features/billing/components/workspace/atoms";
import type { CallOutcome } from "@shared/homeTypes";
import { useHomePhone } from "../api/homeApi";
import { BarList } from "../components/BarList";
import { DayChart } from "../components/DayChart";
import { EmptyState } from "../components/EmptyState";
import banner from "@/assets/home/phone.webp";
import { HomeBanner } from "../components/HomeBanner";
import { RowList } from "../components/RowList";
import { StatRow } from "../components/StatRow";
import { formatDuration, trendOf } from "../lib/homeFormat";
import { openCall } from "../lib/openCall";
import type { HomeTabProps } from "./tabTypes";

const OUTCOMES: CallOutcome[] = ["booked", "callback", "transferred", "hung_up", "other"];

export default function PhoneTab({ scope }: HomeTabProps) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useHomePhone(scope);

  if (isError) return <EmptyState title={t("errorTitle")} body={t("error")} />;

  const outcomeRows = OUTCOMES.map((o) => ({
    key: o,
    label: t(`phone.outcome.${o}`),
    value: data?.outcomes.find((x) => x.outcome === o)?.count ?? 0,
  }));
  const recentRows = (data?.recent ?? []).map((r) => ({
    key: r.callId,
    title: r.name || t("overview.unknownCaller"),
    meta: r.callerNumber ?? undefined,
    tag: <Pill>{t(`phone.outcome.${r.outcome}`)}</Pill>,
    time: r.at,
    onClick: () => openCall(r.callId, setLocation),
  }));
  const failed = data?.transfersFailed ?? 0;
  const dash = isLoading || !data;

  return (
    <div className="flex flex-col gap-5">
      <HomeBanner
        eyebrow={t("tabs.phone")}
        value={dash ? "…" : data.calls.value}
        sentence={t("phone.banner")}
        trend={data ? trendOf(data.calls) : null}
        vsLabel={t(`vs.${scope.period}`)}
        image={banner}
      />
      <StatRow items={[
        { key: "calls", label: t("phone.tiles.calls"), value: data?.calls.value ?? "…", compared: data?.calls },
        { key: "booked", label: t("phone.tiles.booked"), value: data?.booked.value ?? "…", compared: data?.booked },
        {
          key: "transferred", label: t("phone.tiles.transferred"), value: data?.transferred.value ?? "…",
          compared: failed > 0 ? undefined : data?.transferred,
          sub: failed > 0 ? t("phone.tiles.transfersFailed", { count: failed }) : undefined,
        },
        { key: "avg", label: t("phone.tiles.avgLength"), value: data ? formatDuration(data.avgSeconds.value) : "…", compared: data?.avgSeconds },
      ]} />
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        <PanelShell>
          <SectionHead title={t("phone.perDay")} />
          <DayChart data={data?.perDay ?? []} label={t("phone.perDay")} />
        </PanelShell>
        <PanelShell>
          <SectionHead title={t("phone.outcomes")} />
          <BarList rows={outcomeRows} />
        </PanelShell>
      </div>
      {data && (
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
          {data.outOfHoursPct !== null && <StatCard flat label={t("phone.outOfHours")} value={`${data.outOfHoursPct}%`} />}
          <StatCard flat label={t("phone.screened", { count: data.screened })} value={data.screened} />
        </div>
      )}
      <PanelShell>
        <SectionHead title={t("phone.recent")} />
        <RowList rows={recentRows} empty={t("phone.recentEmpty")} />
      </PanelShell>
    </div>
  );
}
