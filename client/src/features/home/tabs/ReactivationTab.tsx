import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { ExternalLink, Plus, Upload } from "lucide-react";
import { ToolbarButton } from "@/components/crm/primitives/ToolbarButton";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useHomeReactivation } from "../api/homeApi";
import { BarList } from "../components/BarList";
import { DayChart } from "../components/DayChart";
import { EmptyState } from "../components/EmptyState";
import banner from "@/assets/home/reactivation.webp";
import { HomeBanner } from "../components/HomeBanner";
import { StatRow } from "../components/StatRow";
import { rateOf, trendOf } from "../lib/homeFormat";
import type { HomeTabProps } from "./tabTypes";

export default function ReactivationTab({ scope }: HomeTabProps) {
  const { t, i18n } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { isAgencyUser } = useWorkspace();
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const { data, isLoading, isError } = useHomeReactivation({ ...scope, campaignId });

  if (isError) return <EmptyState title={t("errorTitle")} body={t("error")} />;

  const rate = data ? rateOf(data.replied.value, data.contacted.value) : null;
  const cost = data?.costPerBooking;
  const money = new Intl.NumberFormat(i18n.language, { style: "currency", currency: "EUR" });
  const perDay = data?.perDay ?? [];
  const replies = perDay.map((p) => ({ day: p.day, value: p.replies }));
  const bookings = perDay.map((p) => ({ day: p.day, value: p.bookings }));
  const pipelineRows = (data?.pipeline ?? []).map((p) => ({ key: p.status, label: t(`reactivation.status.${p.status.replace(/\s+/g, "")}`, { defaultValue: p.status }), value: p.count }));

  return (
    <div className="flex flex-col gap-5">
      <HomeBanner
        eyebrow={t("tabs.reactivation")}
        value={isLoading || !data ? "…" : data.bookings.value}
        sentence={t("reactivation.banner")}
        trend={data ? trendOf(data.bookings) : null}
        vsLabel={t(`vs.${scope.period}`)}
        image={banner}
        artY="10%"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={campaignId ?? ""}
          onChange={(e) => setCampaignId(e.target.value ? Number(e.target.value) : null)}
          aria-label={t("reactivation.campaign")}
          className="neu-inset-crisp"
          data-testid="home-campaign"
          style={{ padding: "7px 12px", borderRadius: "var(--r-button)", fontSize: 13, border: "none", background: "var(--bg)", color: "var(--ink-soft)", maxWidth: "100%" }}
        >
          <option value="">{t("reactivation.allCampaigns")}</option>
          {(data?.campaigns ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {campaignId !== null && (
          <Link href={`/platform/campaigns?campaign=${campaignId}`} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)]">
            <ExternalLink size={13} aria-hidden />
            {t("reactivation.openCampaign")}
          </Link>
        )}
        {isAgencyUser && (
          <div className="ml-auto flex items-center gap-2">
            <ToolbarButton icon={<Plus size={16} />} label={t("reactivation.newCampaign")} onClick={() => setLocation("/platform/campaigns")} />
            <ToolbarButton icon={<Upload size={16} />} label={t("reactivation.importLeads")} onClick={() => setLocation("/platform/contacts")} />
          </div>
        )}
      </div>
      <StatRow items={[
        { key: "contacted", label: t("reactivation.tiles.contacted"), value: data?.contacted.value ?? "…", compared: data?.contacted },
        {
          key: "replyRate", label: t("reactivation.tiles.replyRate"), value: !data ? "…" : rate === null ? "-" : `${rate}%`,
          sub: data && rate === null ? t("reactivation.tiles.replyRateNone") : undefined,
        },
        { key: "bookings", label: t("reactivation.tiles.bookings"), value: data?.bookings.value ?? "…", compared: data?.bookings },
        {
          key: "cost", label: t("reactivation.tiles.costPerBooking"),
          value: !data ? "…" : cost == null ? "-" : money.format(cost),
          sub: data && cost == null ? t("reactivation.tiles.costNone") : undefined,
        },
      ]} />
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        <PanelShell>
          <SectionHead title={t("reactivation.perDay")} />
          <DayChart
            data={replies}
            label={t("reactivation.replies")}
            secondary={{ data: bookings, label: t("reactivation.tiles.bookings") }}
          />
        </PanelShell>
        <PanelShell>
          <SectionHead title={t("reactivation.pipeline")} />
          {pipelineRows.length > 0
            ? <BarList rows={pipelineRows} />
            : <div style={{ color: "var(--mute)", fontSize: 13.5, padding: "12px 4px" }}>{t("reactivation.pipelineEmpty")}</div>}
        </PanelShell>
      </div>
    </div>
  );
}
