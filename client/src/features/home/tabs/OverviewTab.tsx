import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Pill } from "@/components/crm/primitives/Pill";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import type { ActivityRow, AttentionRow, HomeChannel, HomeTab } from "@shared/homeTypes";
import { useHomeOverview } from "../api/homeApi";
import { BarList } from "../components/BarList";
import { DayChart } from "../components/DayChart";
import { EmptyState } from "../components/EmptyState";
import banner from "@/assets/home/overview.webp";
import { HomeBanner } from "../components/HomeBanner";
import { RowList, type RowListItem } from "../components/RowList";
import { EVENT_ICON } from "../components/activityIcons";
import { StatRow } from "../components/StatRow";
import { openCall } from "../lib/openCall";
import { trendOf } from "../lib/homeFormat";
import type { HomeTabProps } from "./tabTypes";

const CHANNEL_TAB: Record<HomeChannel, Extract<HomeTab, "phone" | "whatsapp" | "website">> = { phone: "phone", whatsapp: "whatsapp", sms: "whatsapp", website: "website" };

export default function OverviewTab({ scope, services, onOpenTab }: HomeTabProps) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const attentionRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError } = useHomeOverview(scope);

  if (isError) return <EmptyState title={t("errorTitle")} body={t("error")} />;

  const open = (row: { leadId: number | null; callId: string | null }) => {
    if (row.callId) openCall(row.callId, setLocation);
    else if (row.leadId) setLocation(`/platform/contacts/${row.leadId}`);
  };
  const nameOf = (row: { name: string | null; channel: ActivityRow["channel"] }) =>
    row.name || t(row.channel === "phone" ? "overview.unknownCaller" : row.channel === "website" ? "overview.visitor" : "unknownContact");
  const channelPill = (c: ActivityRow["channel"]) => <Pill>{t(`channel.${c}`)}</Pill>;

  const live: Record<HomeChannel, boolean> = {
    phone: services.phone, whatsapp: services.whatsapp, website: services.website, sms: services.sms,
  };
  // A channel is listed when its service is on, or when it has numbers in this period.
  const channelRows = (["phone", "whatsapp", "sms", "website"] as HomeChannel[])
    .map((c) => ({ c, row: data?.byChannel.find((b) => b.channel === c) }))
    .filter(({ c, row }) => live[c] || (row?.conversations ?? 0) > 0 || (row?.bookings ?? 0) > 0)
    .map(({ c, row }) => {
      const isSms = c === "sms";
      return {
        key: c,
        label: t(`channel.${c}`),
        value: row?.conversations ?? 0,
        extra: isSms ? "-" : (row?.bookings ?? 0),
        sub: isSms ? t("overview.smsNote") : undefined,
        onClick: services[CHANNEL_TAB[c]] ? () => onOpenTab(CHANNEL_TAB[c]) : undefined,
      };
    });

  const attentionRows: RowListItem[] = (data?.attention ?? []).map((r: AttentionRow, i) => ({
    key: `${r.kind}-${r.callId ?? r.leadId ?? "x"}-${i}`,
    title: nameOf(r),
    meta: t(`overview.attentionKind.${r.kind}`),
    tag: channelPill(r.channel),
    icon: EVENT_ICON[r.kind],
    time: r.at,
    onClick: r.callId || r.leadId ? () => open(r) : undefined,
  }));
  const activityRows: RowListItem[] = (data?.activity ?? []).map((r, i) => ({
    key: `${r.kind}-${r.callId ?? r.leadId ?? "x"}-${r.at}-${i}`,
    title: t(`overview.activityKind.${r.kind}`),
    meta: [r.name, r.headline].filter(Boolean).join(" · ") || undefined,
    tag: channelPill(r.channel),
    icon: EVENT_ICON[r.kind],
    time: r.at,
    onClick: r.callId || r.leadId ? () => open(r) : undefined,
  }));

  const waiting = data?.waiting ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <HomeBanner
        eyebrow={t("tabs.overview")}
        value={isLoading || !data ? "…" : data.conversations.value}
        sentence={t("overview.banner")}
        trend={data ? trendOf(data.conversations) : null}
        vsLabel={t(`vs.${scope.period}`)}
        image={banner}
      />
      <StatRow items={[
        { key: "bookings", label: t("overview.tiles.bookings"), value: data?.bookings.value ?? "…", compared: data?.bookings },
        { key: "callbacks", label: t("overview.tiles.callbacks"), value: data?.callbacks.value ?? "…", compared: data?.callbacks },
        { key: "newContacts", label: t("overview.tiles.newContacts"), value: data?.newContacts.value ?? "…", compared: data?.newContacts },
        {
          key: "waiting", label: t("overview.tiles.waiting"), value: data ? waiting : "…", filled: waiting > 0,
          sub: t(waiting > 0 ? "overview.tiles.waitingSub" : "overview.tiles.waitingNone"),
          onClick: () => attentionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        },
      ]} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <PanelShell>
          <SectionHead title={t("overview.byChannel")} />
          <BarList
            columns={[t("overview.conversations"), t("overview.bookings")]}
            rows={channelRows}
          />
        </PanelShell>
        <div ref={attentionRef} className="flex" style={{ scrollMarginTop: 12 }}>
          <PanelShell className="w-full">
            <SectionHead title={t("overview.attention")} />
            <RowList rows={attentionRows} empty={t("overview.attentionEmpty")} />
          </PanelShell>
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <PanelShell>
          <SectionHead title={t("overview.perDay")} />
          <DayChart data={data?.perDay ?? []} label={t("overview.perDay")} />
        </PanelShell>
        <PanelShell>
          <SectionHead title={t("overview.activity")} />
          <RowList rows={activityRows} empty={t("overview.activityEmpty")} />
        </PanelShell>
      </div>
    </div>
  );
}
