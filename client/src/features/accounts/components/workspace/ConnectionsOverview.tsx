// The Integrations tab's menu: one tile per connection with its state and the
// one fact that matters (the number, the site, the calendar). A tile opens its
// group. On desktop the tiles stand in a column beside the open group ("rail"),
// on a phone they sit in a 2-column grid above it. Agency only: each tile reads the
// same data its cards do.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, Globe, Instagram, MessageCircle, Phone } from "lucide-react";
import { SectionRail, type SectionRailItem, type SectionState } from "./SectionRail";
import { useWhatsappSender } from "./whatsapp/whatsappApi";
import { useVoiceLine } from "./voice/useVoiceLine";
import { fetchWidgetConfigs } from "../../api/widgetApi";
import { fetchCalendarConnections } from "../../api/calendarApi";
import { useSocialStatus } from "@/features/social/components/InstagramConnectCard";
import { instagramTileState } from "@/features/social/lib/socialState";

export type ConnectionGroup = "phone" | "messaging" | "website" | "bookings" | "social";

export const groupAnchorId = (group: ConnectionGroup) => `integrations-${group}`;

export function ConnectionsOverview({ accountId, active, onSelect, layout }: {
  accountId: number;
  active: ConnectionGroup;
  onSelect: (group: ConnectionGroup) => void;
  layout: "grid" | "rail";
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

  const tiles: { group: ConnectionGroup; icon: React.ReactNode; state: SectionState; detail: string | null }[] = [
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

  const items: SectionRailItem<ConnectionGroup>[] = tiles.map((tile) => ({
    key: tile.group,
    icon: tile.icon,
    label: t(`integrationGroups.${tile.group}.short`),
    detail: tile.detail ?? t(`integrationGroups.state.${tile.group}.${tile.state}`),
    state: tile.state,
    controls: groupAnchorId(tile.group),
  }));

  return <SectionRail items={items} active={active} onSelect={onSelect} layout={layout} testId="integrations-tab" />;
}
