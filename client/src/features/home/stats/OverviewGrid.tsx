import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import { bucketOf } from "@shared/homePeriod";
import { HOME_CHANNELS, type HomeChannel, type HomeChannelFilter, type HomePeriod, type HomeServices } from "@shared/homeTypes";
import { useHomeOverview, type HomeScope } from "../api/homeApi";
import { ChannelTabs, type ChannelTab } from "../components/ChannelTabs";
import { DayChart } from "../components/DayChart";
import { EmptyState } from "../components/EmptyState";
import { PeriodMenu } from "../components/PeriodMenu";
import { CHANNEL_ICON } from "../components/activityIcons";
import { AttentionPanel, RecentActivityPanel } from "./ActivityPanels";

const CHANNEL_KEY = "leadawaker_home_channel";
const TITLE = 22;

function readChannel(): HomeChannelFilter {
  try {
    const v = localStorage.getItem(CHANNEL_KEY);
    return (HOME_CHANNELS as readonly string[]).includes(v ?? "") ? (v as HomeChannel) : "all";
  } catch {
    return "all";
  }
}

/**
 * Under the cards: Needs attention beside Recent activity (half each, same height, rows
 * scroll inside), then By channel (the channel switcher, with the period menu) beside the
 * conversations chart. The picked channel filters the chart and both lists; phones stack
 * everything in the same order.
 */
export function OverviewGrid({ scope, services, onPeriod }: {
  scope: HomeScope;
  services: HomeServices;
  onPeriod: (p: HomePeriod) => void;
}) {
  const { t } = useTranslation("home");
  const [picked, setPicked] = useState<HomeChannelFilter>(readChannel);

  // Totals and rows per channel come from the unfiltered overview (shared with the "all" view).
  const totalsQuery = useHomeOverview(scope);
  const totalsData = totalsQuery.data;
  const live: Record<HomeChannel, boolean> = {
    phone: services.phone, whatsapp: services.whatsapp, website: services.website, sms: services.sms,
  };
  // A channel is listed when its service is on, or when it has numbers in this period.
  const tabs: ChannelTab[] = HOME_CHANNELS
    .map((c) => ({ c, row: totalsData?.byChannel.find((b) => b.channel === c) }))
    .filter(({ c, row }) => live[c] || (row?.conversations ?? 0) > 0 || (row?.bookings ?? 0) > 0)
    .map(({ c, row }) => ({
      key: c,
      label: t(`channel.${c}`),
      icon: CHANNEL_ICON[c].icon,
      conversations: row?.conversations ?? 0,
      bookings: c === "sms" ? "-" : (row?.bookings ?? 0),
      note: c === "sms" ? t("overview.smsNote") : undefined,
    }));
  // Bookings no channel claims (booking page, manual or imported leads): an "Other" row,
  // so the channel rows add up to All. Every channel with bookings is listed above.
  const otherBookings = Math.max(0, (totalsData?.bookings.value ?? 0)
    - (totalsData?.byChannel ?? []).reduce((sum, b) => sum + (b.channel === "sms" ? 0 : b.bookings), 0));
  // Chats with no channel stamp count in All but under no channel: the Other row takes them too.
  const otherConversations = Math.max(0, (totalsData?.conversations.value ?? 0)
    - (totalsData?.byChannel ?? []).reduce((sum, b) => sum + (b.channel === "sms" ? 0 : b.conversations), 0));
  // A remembered channel the account does not have falls back to All.
  const channel: HomeChannelFilter = picked === "all" || tabs.some((x) => x.key === picked) ? picked : "all";
  const pick = (c: HomeChannelFilter) => {
    setPicked(c);
    try { localStorage.setItem(CHANNEL_KEY, c); } catch { /* not remembered */ }
  };

  const filtered = useHomeOverview(scope, channel);
  const data = channel === "all" ? totalsData : filtered.data;
  if (totalsQuery.isError || filtered.isError) return <EmptyState title={t("errorTitle")} body={t("error")} />;

  const bucket = bucketOf(scope.period);
  return (
    <div className="flex flex-col gap-5" data-testid="stats-overview-grid">
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
        <AttentionPanel items={data?.attention ?? []} waiting={data?.waiting ?? 0} scope={scope} channel={channel} />
        <RecentActivityPanel items={data?.recent ?? []} channel={channel} />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
        <PanelShell className="min-w-0" testId="stats-by-channel">
          <SectionHead title={<span className="block truncate">{t("overview.byChannel")}</span>} titleSize={TITLE}
            action={<span className="shrink-0"><PeriodMenu value={scope.period} onChange={onPeriod} /></span>} />
          <ChannelTabs tabs={tabs} value={channel} onChange={pick}
            totals={{ conversations: totalsData?.conversations.value ?? 0, bookings: totalsData?.bookings.value ?? 0 }}
            otherBookings={otherBookings} otherConversations={otherConversations} />
        </PanelShell>
        <PanelShell className="min-w-0 md:col-span-2" testId="stats-per-day">
          <SectionHead title={t(`overview.perBucket.${bucket}`)} titleSize={TITLE} />
          <div className="mt-auto">
            <DayChart data={data?.perDay ?? []} label={t(`overview.perBucket.${bucket}`)} bucket={bucket} />
          </div>
        </PanelShell>
      </div>
    </div>
  );
}
