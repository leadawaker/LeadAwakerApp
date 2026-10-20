// The Integrations tab's menu: one tile per connection with its state and the
// one fact that matters (the number, the site, the calendar). A tile opens its
// group. On desktop the tiles stand in a column beside the open group ("rail"),
// on a phone they sit in a 2-column grid above it. Agency only: each tile reads the
// same data its cards do.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, Globe, Instagram, MessageCircle, Phone } from "lucide-react";
import { useWhatsappSender } from "./whatsapp/whatsappApi";
import { useVoiceLine } from "./voice/useVoiceLine";
import { fetchWidgetConfigs } from "../../api/widgetApi";
import { fetchCalendarConnections } from "../../api/calendarApi";
import { useSocialStatus } from "@/features/social/components/InstagramConnectCard";
import { instagramTileState } from "@/features/social/lib/socialState";

export type ConnectionGroup = "phone" | "messaging" | "website" | "bookings" | "social";
type State = "on" | "pending" | "off";

const DOT: Record<State, string> = { on: "var(--good)", pending: "var(--warn)", off: "var(--mute-2)" };

export const groupAnchorId = (group: ConnectionGroup) => `integrations-${group}`;

export function ConnectionsOverview({ accountId, active, onSelect, layout = "row" }: {
  accountId: number;
  active: ConnectionGroup;
  onSelect: (group: ConnectionGroup) => void;
  layout?: "row" | "grid" | "rail";
}) {
  const { t } = useTranslation("accounts");
  const { sender } = useWhatsappSender(accountId);
  const { line } = useVoiceLine(accountId);
  const { data: widgets } = useQuery({
    queryKey: ["integrations-overview", "widgets", accountId],
    queryFn: () => fetchWidgetConfigs(accountId),
    staleTime: 30_000,
  });
  const { data: social } = useSocialStatus(accountId);
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
    {
      group: "social", icon: <Instagram size={16} />,
      state: instagramTileState(social),
      detail: social?.connection?.username && social.connection.status !== "disconnected" ? `@${social.connection.username}` : null,
    },
  ];

  return (
    <div
      className="neu-raised"
      // The 1px gap over a line-coloured ground draws the dividers, so they stay right when the tiles wrap.
      style={{
        borderRadius: "var(--r-card)", background: "var(--line-strong)", display: "grid", gap: 1, overflow: "hidden",
        gridTemplateColumns: layout === "rail" ? "1fr" : layout === "grid" ? "1fr 1fr" : `repeat(${tiles.length}, 1fr)`,
      }}
      role="tablist"
      aria-orientation={layout === "rail" ? "vertical" : "horizontal"}
      data-testid="integrations-overview"
    >
      {tiles.map((tile) => {
        const on = tile.group === active;
        return (
        <button
          key={tile.group}
          type="button"
          role="tab"
          aria-selected={on}
          aria-controls={groupAnchorId(tile.group)}
          onClick={() => onSelect(tile.group)}
          data-testid={`integrations-tab-${tile.group}`}
          style={{
            display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
            padding: layout === "grid" ? "14px 14px" : "16px 18px", border: 0, minWidth: 0,
            // The open tile is the brightest one, like a page lifted out of the stack.
            background: on ? "var(--card)" : "var(--bone)",
            boxShadow: on ? "inset 3px 0 0 var(--wine)" : undefined,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: on ? "var(--wine)" : "var(--mute)", width: "100%" }}>
            {tile.icon}
            <span className="eyebrow eyebrow-sm" style={{ color: on ? "var(--wine)" : "var(--mute)", flex: 1 }}>{t(`integrationGroups.${tile.group}.short`)}</span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: DOT[tile.state], flexShrink: 0 }} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: tile.state === "off" ? "var(--mute)" : "var(--ink)" }}>
            {t(`integrationGroups.state.${tile.group}.${tile.state}`)}
          </span>
          <span style={{ fontSize: 12, color: "var(--mute)", fontFamily: tile.detail ? "var(--mono)" : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
            {tile.detail ?? t(`integrationGroups.${tile.group}.hint`)}
          </span>
        </button>
        );
      })}
    </div>
  );
}
