import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { CircleDashed, Layers, type LucideIcon } from "lucide-react";
import type { HomeChannelFilter } from "@shared/homeTypes";

export interface ChannelTab {
  key: HomeChannelFilter;
  label: string;
  icon: LucideIcon;
  conversations: number;
  /** "-" where a channel has no bookings of its own (SMS). */
  bookings: number | string;
  /** Hover note, e.g. that SMS counts messages sent. */
  note?: string;
}

/**
 * By channel as a vertical tab list: "All" then one row per channel, each with
 * its conversations and bookings. The picked row filters the panels beside it.
 */
export function ChannelTabs({ tabs, value, onChange, totals, otherBookings = 0, otherConversations = 0 }: {
  tabs: ChannelTab[];
  value: HomeChannelFilter;
  onChange: (c: HomeChannelFilter) => void;
  totals: { conversations: number; bookings: number };
  /** Bookings with no conversation channel (booking page, manual or imported), so the
   *  rows add up to All. Shown as a plain row, not a filter. */
  otherBookings?: number;
  /** Chats with no channel stamp (unclassified), counted in All but under no channel. */
  otherConversations?: number;
}) {
  const { t } = useTranslation("home");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const all: ChannelTab[] = [{ key: "all", label: t("overview.all"), icon: Layers, ...totals }, ...tabs];

  // Arrow keys move along the list and pick, as in any tab list.
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const next = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const j = (next + all.length) % all.length;
    onChange(all[j].key);
    refs.current[j]?.focus();
  };

  return (
    <div>
      {/* Column heads sit over the numbers; a long first head runs left into the empty space. */}
      <div className="eyebrow eyebrow-sm flex justify-end" style={{ gap: 10, paddingBottom: 6, paddingRight: 10 }}>
        <span className="home-chan-num flex justify-end whitespace-nowrap" style={{ fontSize: "inherit" }}>{t("overview.conversations")}</span>
        <span className="home-chan-num home-chan-num--wide flex justify-end whitespace-nowrap" style={{ fontSize: "inherit" }}>{t("overview.bookings")}</span>
      </div>
      <div role="tablist" aria-orientation="vertical" aria-label={t("overview.byChannel")} className="flex flex-col" style={{ gap: 4 }}>
        {all.map((tab, i) => {
          const on = tab.key === value;
          const Icon = tab.icon;
          return (
            <button key={tab.key} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" aria-selected={on}
              tabIndex={on ? 0 : -1} title={tab.note} className={on ? "home-chan on" : "home-chan"}
              onClick={() => onChange(tab.key)} onKeyDown={(e) => onKeyDown(e, i)} data-testid={`home-channel-${tab.key}`}>
              <span className="home-chan-icon" aria-hidden><Icon size={15} /></span>
              <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13.5 }}>{tab.label}</span>
              <span className="home-chan-num">{tab.conversations.toLocaleString()}</span>
              <span className="home-chan-num home-chan-num--wide home-chan-num--sub">{typeof tab.bookings === "number" ? tab.bookings.toLocaleString() : tab.bookings}</span>
            </button>
          );
        })}
        {(otherBookings > 0 || otherConversations > 0) && (
          <div className="home-chan" style={{ cursor: "default" }} title={t("overview.otherNote")} data-testid="home-channel-other">
            <span className="home-chan-icon" aria-hidden><CircleDashed size={15} /></span>
            <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13.5 }}>{t("channel.other")}</span>
            <span className="home-chan-num">{otherConversations > 0 ? otherConversations.toLocaleString() : "-"}</span>
            <span className="home-chan-num home-chan-num--wide home-chan-num--sub">{otherBookings.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
