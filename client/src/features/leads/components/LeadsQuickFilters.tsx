// Leads page quick filters, under the topbar: a view switch (All / Needs reply /
// Next appointments) and a channel switch (All / Website / WhatsApp / Phone).
// Counts come from the server and cover every lead, not only the loaded page.
import { useTranslation } from "react-i18next";
import {
  Users, MessageSquareReply, CalendarClock, Layers, Globe, MessageCircle, Phone, type LucideIcon,
} from "lucide-react";
import type { ChannelFilter, QuickView } from "./leadsTableConfig";

const VIEW_ICONS: Record<QuickView, LucideIcon> = { all: Users, needsReply: MessageSquareReply, upcoming: CalendarClock };
const CHANNEL_ICONS: Record<ChannelFilter, LucideIcon> = { all: Layers, website: Globe, whatsapp: MessageCircle, phone: Phone };

function Seg<K extends string>({
  items, active, onChange, icons, label, counts, testId,
}: {
  items: K[];
  active: K;
  onChange: (k: K) => void;
  icons: Record<K, LucideIcon>;
  label: (k: K) => string;
  counts: Partial<Record<K, number>>;
  testId: string;
}) {
  return (
    <div className="la-seg shrink-0" role="tablist" data-testid={testId}>
      {items.map((k) => {
        const Icon = icons[k];
        const on = k === active;
        const n = counts[k];
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={on}
            className={`la-seg-btn${on ? " on" : ""}`}
            style={{ padding: "7px 12px", fontSize: 10, letterSpacing: "0.1em", gap: 6 }}
            onClick={() => onChange(k)}
            data-testid={`${testId}-${k}`}
          >
            <Icon size={13} className="shrink-0" />
            {label(k)}
            {n !== undefined && (
              <span className="tabular-nums" style={{ color: on ? "var(--wine)" : "var(--mute-2)", fontWeight: 400 }}>{n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function LeadsQuickFilters({
  view, onViewChange, channel, onChannelChange, total, viewCounts, channelCounts,
}: {
  view: QuickView;
  onViewChange: (v: QuickView) => void;
  channel: ChannelFilter;
  onChannelChange: (c: ChannelFilter) => void;
  /** Total for "All" with the channel filter applied. */
  total: number;
  viewCounts: { needsReply: number; upcoming: number };
  channelCounts: Record<string, number>;
}) {
  const { t } = useTranslation("leads");
  return (
    <div
      className="shrink-0 flex items-center gap-3 overflow-x-auto scrollbar-hide"
      style={{ padding: "9px 17px", borderBottom: "1px solid var(--line)" }}
      data-testid="leads-quick-filters"
    >
      <Seg<QuickView>
        items={["all", "needsReply", "upcoming"]}
        active={view}
        onChange={onViewChange}
        icons={VIEW_ICONS}
        label={(k) => t(`quickViews.${k}`)}
        counts={{ all: view === "all" ? total : undefined, needsReply: viewCounts.needsReply, upcoming: viewCounts.upcoming }}
        testId="leads-quick-view"
      />
      <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0 }} />
      <Seg<ChannelFilter>
        items={["all", "website", "whatsapp", "phone"]}
        active={channel}
        onChange={onChannelChange}
        icons={CHANNEL_ICONS}
        label={(k) => t(`channelFilter.${k}`)}
        counts={{ website: channelCounts.website, whatsapp: channelCounts.whatsapp, phone: channelCounts.phone }}
        testId="leads-channel-filter"
      />
    </div>
  );
}
