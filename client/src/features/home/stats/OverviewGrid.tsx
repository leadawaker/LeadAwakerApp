import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { AudioLines, Globe, MessageCircle, type LucideIcon } from "lucide-react";
import { openLead } from "@/lib/leadLink";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/crm/primitives/Pill";
import { PanelShell, SectionHead } from "@/features/campaigns/components/metricsWidgets/panelPrimitives";
import type { AttentionRow, HomeChannel, HomeServices } from "@shared/homeTypes";
import { useHomeOverview, useHomePhone, useHomeWebsite, useHomeWhatsapp, type HomeScope } from "../api/homeApi";
import { BarList } from "../components/BarList";
import { DayChart } from "../components/DayChart";
import { EmptyState } from "../components/EmptyState";
import { RowList, type RowListItem } from "../components/RowList";
import { EVENT_ICON } from "../components/activityIcons";
import { openCall } from "../lib/openCall";
import { recentChannels, type RecentChannel } from "../lib/recentChannels";
import { SERVICE_ANCHOR } from "./ServiceCards";

const RECENT_KEY = "la.stats.recentChannel";
const RECENT_ICON: Record<RecentChannel, LucideIcon> = { phone: AudioLines, whatsapp: MessageCircle, website: Globe };
// SMS has no card of its own: it is WhatsApp's fallback.
const CHANNEL_CARD: Record<HomeChannel, "phone" | "whatsapp" | "website"> = { phone: "phone", whatsapp: "whatsapp", sms: "whatsapp", website: "website" };

function readRecent(): RecentChannel | null {
  try {
    const v = localStorage.getItem(RECENT_KEY);
    return v === "phone" || v === "whatsapp" || v === "website" ? v : null;
  } catch {
    return null;
  }
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
const TITLE = 22;

/** Recent calls or chats, one channel at a time behind a small Calls / WhatsApp switch. */
function RecentActivity({ scope, services }: { scope: HomeScope; services: HomeServices }) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  // Calls and WhatsApp; Website chat only joins when it is the account's chat channel.
  const channels = recentChannels(services);
  const [picked, setPicked] = useState<RecentChannel | null>(readRecent);
  const active: RecentChannel = picked && channels.includes(picked) ? picked : channels[0] ?? "phone";
  const pick = (c: RecentChannel) => {
    setPicked(c);
    try { localStorage.setItem(RECENT_KEY, c); } catch { /* not remembered */ }
  };

  // The banners above load the same queries, so these come from the cache.
  const phone = useHomePhone(scope, services.phone);
  const whatsapp = useHomeWhatsapp(scope, services.whatsapp);
  const website = useHomeWebsite(scope, services.website);

  let rows: RowListItem[] = [];
  let empty = t("overview.activityEmpty");
  if (active === "phone") {
    rows = (phone.data?.recent ?? []).map((r) => ({
      key: r.callId,
      title: r.name || t("overview.unknownCaller"),
      meta: r.headline ?? r.callerNumber ?? undefined,
      tag: <Pill>{t(`phone.outcome.${r.outcome}`)}</Pill>,
      time: r.at,
      onClick: () => openCall(r.callId, setLocation),
    }));
    empty = t("phone.recentEmpty");
  } else {
    const data = active === "whatsapp" ? whatsapp.data : website.data;
    rows = (data?.recent ?? []).map((r) => ({
      key: String(r.leadId),
      title: r.name || t(active === "website" ? "overview.visitor" : "unknownContact"),
      meta: r.snippet,
      time: r.at,
      onClick: () => openLead(setLocation, r.leadId),
    }));
    empty = t(active === "website" ? "website.recentEmpty" : "whatsapp.recentEmpty");
  }

  const toggle = channels.length > 1 ? (
    <div className="la-seg la-seg--touch max-w-full" role="tablist" aria-label={t("stats.recentChannel")} style={{ overflowX: "auto", scrollbarWidth: "none" }}>
      {channels.map((c) => {
        const Icon = RECENT_ICON[c];
        return (
          <button key={c} type="button" role="tab" aria-selected={active === c} data-testid={`stats-recent-${c}`}
            className={cn("la-seg-btn shrink-0", active === c && "on")} onClick={() => pick(c)}>
            <Icon size={13} aria-hidden />
            {t(`stats.recentTabs.${c}`)}
          </button>
        );
      })}
    </div>
  ) : undefined;

  return (
    <PanelShell className="min-w-0" testId="stats-recent">
      <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: 14 }}>
        <SectionHead title={t("overview.activity")} titleSize={TITLE} marginBottom={0} />
        {toggle}
      </div>
      <RowList rows={rows} empty={empty} />
    </PanelShell>
  );
}

/**
 * The middle of the Stats page, in three narrow columns (stacked on a phone):
 * By channel with Conversations per day under it, Recent activity, Needs attention.
 * An account with no calls, WhatsApp or website chat (SMS or Reactivation only)
 * has no Recent activity, so it gets two columns instead of an empty middle one.
 */
export function OverviewGrid({ scope, services }: { scope: HomeScope; services: HomeServices }) {
  const { t } = useTranslation("home");
  const [, setLocation] = useLocation();
  const { data, isError } = useHomeOverview(scope);

  if (isError) return <EmptyState title={t("errorTitle")} body={t("error")} />;

  const live: Record<HomeChannel, boolean> = {
    phone: services.phone, whatsapp: services.whatsapp, website: services.website, sms: services.sms,
  };
  // A channel is listed when its service is on, or when it has numbers in this period.
  const channelRows = (["phone", "whatsapp", "sms", "website"] as HomeChannel[])
    .map((c) => ({ c, row: data?.byChannel.find((b) => b.channel === c) }))
    .filter(({ c, row }) => live[c] || (row?.conversations ?? 0) > 0 || (row?.bookings ?? 0) > 0)
    .map(({ c, row }) => {
      const isSms = c === "sms";
      const card = CHANNEL_CARD[c];
      return {
        key: c,
        label: t(`channel.${c}`),
        value: row?.conversations ?? 0,
        extra: isSms ? "-" : (row?.bookings ?? 0),
        sub: isSms ? t("overview.smsNote") : undefined,
        // The row jumps to its channel's card at the top of this page.
        onClick: services[card] ? () => scrollTo(SERVICE_ANCHOR[card]) : undefined,
      };
    });

  const nameOf = (row: AttentionRow) =>
    row.name || t(row.channel === "phone" ? "overview.unknownCaller" : row.channel === "website" ? "overview.visitor" : "unknownContact");
  const attentionRows: RowListItem[] = (data?.attention ?? []).map((r, i) => ({
    key: `${r.kind}-${r.callId ?? r.leadId ?? "x"}-${i}`,
    title: nameOf(r),
    meta: t(`overview.attentionKind.${r.kind}`),
    tag: <Pill>{t(`channel.${r.channel}`)}</Pill>,
    icon: EVENT_ICON[r.kind],
    time: r.at,
    onClick: r.callId ? () => openCall(r.callId as string, setLocation) : r.leadId ? () => openLead(setLocation, r.leadId as number) : undefined,
  }));
  const waiting = data?.waiting ?? 0;
  const showRecent = recentChannels(services).length > 0;

  return (
    <div className={cn("grid grid-cols-1 items-start gap-5 md:grid-cols-2", showRecent && "xl:grid-cols-3")} data-testid="stats-overview-grid">
      <div className="flex min-w-0 flex-col gap-5">
        <PanelShell testId="stats-by-channel">
          <SectionHead title={t("overview.byChannel")} titleSize={TITLE} />
          <BarList columns={[t("overview.conversations"), t("overview.bookings")]} rows={channelRows} />
        </PanelShell>
        <PanelShell testId="stats-per-day">
          <SectionHead title={t("overview.perDay")} titleSize={TITLE} />
          <DayChart data={data?.perDay ?? []} label={t("overview.perDay")} />
        </PanelShell>
      </div>
      {showRecent && <RecentActivity scope={scope} services={services} />}
      <div className={cn("min-w-0", showRecent && "md:col-span-2 xl:col-span-1")}>
        <PanelShell testId="stats-attention">
          <SectionHead
            title={t("overview.attention")}
            titleSize={TITLE}
            action={waiting > 0 ? <Pill>{t("stats.waiting", { count: waiting })}</Pill> : undefined}
          />
          <RowList rows={attentionRows} empty={t("overview.attentionEmpty")} />
        </PanelShell>
      </div>
    </div>
  );
}
