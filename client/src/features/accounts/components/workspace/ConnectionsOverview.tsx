// The Integrations tab at a glance: one tile per connection with its state and
// the one fact that matters (the number, the site, the calendar). A tile jumps
// to its group below. Agency only: each tile reads the same data its cards do.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, Globe, MessageCircle, Phone } from "lucide-react";
import { useWhatsappSender } from "./whatsapp/whatsappApi";
import { useVoiceLine } from "./voice/useVoiceLine";
import { fetchWidgetConfigs } from "../../api/widgetApi";
import { fetchCalendarConnections } from "../../api/calendarApi";

export type ConnectionGroup = "phone" | "messaging" | "website" | "bookings";
type State = "on" | "pending" | "off";

const DOT: Record<State, string> = { on: "var(--good)", pending: "var(--warn)", off: "var(--mute-2)" };

export const groupAnchorId = (group: ConnectionGroup) => `integrations-${group}`;

function jumpTo(group: ConnectionGroup) {
  document.getElementById(groupAnchorId(group))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ConnectionsOverview({ accountId, stacked = false }: { accountId: number; stacked?: boolean }) {
  const { t } = useTranslation("accounts");
  const { sender } = useWhatsappSender(accountId);
  const { line } = useVoiceLine(accountId);
  const { data: widgets } = useQuery({
    queryKey: ["integrations-overview", "widgets", accountId],
    queryFn: () => fetchWidgetConfigs(accountId),
    staleTime: 30_000,
  });
  const { data: calendars } = useQuery({
    queryKey: ["integrations-overview", "calendars", accountId],
    queryFn: () => fetchCalendarConnections(accountId),
    staleTime: 30_000,
  });

  const number = line?.number ?? null;
  const widget = widgets?.configs.find((c) => c.enabled) ?? widgets?.configs[0] ?? null;
  const ownCalendar = calendars?.find((c) => c.provider !== "caldiy") ?? null;
  const bookingPage = calendars?.find((c) => c.provider === "caldiy") ?? null;

  const tiles: { group: ConnectionGroup; icon: React.ReactNode; state: State; detail: string | null }[] = [
    {
      group: "phone", icon: <Phone size={16} />,
      state: number?.status === "live" ? "on" : number ? "pending" : "off",
      detail: number?.phoneNumber ?? null,
    },
    {
      group: "messaging", icon: <MessageCircle size={16} />,
      state: sender?.status === "connected" ? "on" : sender ? "pending" : "off",
      detail: sender?.displayPhoneNumber ?? null,
    },
    {
      group: "website", icon: <Globe size={16} />,
      state: widget?.enabled && widget.allowedDomains?.length ? "on" : widget ? "pending" : "off",
      detail: widget?.allowedDomains?.[0] ?? null,
    },
    {
      group: "bookings", icon: <CalendarDays size={16} />,
      state: ownCalendar ? "on" : bookingPage ? "pending" : "off",
      detail: ownCalendar?.displayName ?? null,
    },
  ];

  return (
    <div
      className="neu-raised"
      // The 1px gap over a line-coloured ground draws the dividers, so they stay right when the tiles wrap.
      style={{ borderRadius: "var(--r-card)", background: "var(--line-strong)", display: "grid", gridTemplateColumns: stacked ? "1fr 1fr" : "repeat(4, 1fr)", gap: 1, overflow: "hidden" }}
      data-testid="integrations-overview"
    >
      {tiles.map((tile) => (
        <button
          key={tile.group}
          type="button"
          onClick={() => jumpTo(tile.group)}
          style={{
            display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
            padding: stacked ? "14px 14px" : "16px 20px", background: "var(--bone)", border: 0, minWidth: 0,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--mute)", width: "100%" }}>
            {tile.icon}
            <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute)", flex: 1 }}>{t(`integrationGroups.${tile.group}.short`)}</span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: DOT[tile.state], flexShrink: 0 }} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: tile.state === "off" ? "var(--mute)" : "var(--ink)" }}>
            {t(`integrationGroups.state.${tile.group}.${tile.state}`)}
          </span>
          <span style={{ fontSize: 12, color: "var(--mute)", fontFamily: tile.detail ? "var(--mono)" : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
            {tile.detail ?? t(`integrationGroups.${tile.group}.hint`)}
          </span>
        </button>
      ))}
    </div>
  );
}
