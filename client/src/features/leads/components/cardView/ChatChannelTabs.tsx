// Chats page inbox tabs (All chats / Website / WhatsApp). Desktop renders them
// in the topbar (icon + label + count in one row); mobile at the top of the list.
import { useTranslation } from "react-i18next";
import { Globe, MessageCircle, MessagesSquare, type LucideIcon } from "lucide-react";
import { CHAT_CHANNEL_TABS, type ChatChannelTab } from "../chatChannel";

const ICONS: Record<ChatChannelTab, LucideIcon> = {
  all: MessagesSquare,
  website: Globe,
  whatsapp: MessageCircle,
};

export function ChatChannelTabs({
  active,
  onChange,
  counts,
  variant = "list",
}: {
  active: ChatChannelTab;
  onChange: (tab: ChatChannelTab) => void;
  counts: Record<ChatChannelTab, number>;
  variant?: "topbar" | "list";
}) {
  const { t } = useTranslation("leads");
  if (variant === "topbar") {
    return (
      <div className="la-seg shrink-0" role="tablist" data-testid="chat-channel-tabs">
        {CHAT_CHANNEL_TABS.map((tab) => {
          const Icon = ICONS[tab];
          const on = tab === active;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={on}
              className={`la-seg-btn${on ? " on" : ""}`}
              style={{ padding: "8px 13px", fontSize: 10, letterSpacing: "0.12em", gap: 6 }}
              onClick={() => onChange(tab)}
              data-testid={`chat-channel-tab-${tab}`}
            >
              <Icon size={13} className="shrink-0" />
              {t(`chatChannel.${tab}`)}
              <span className="tabular-nums" style={{ color: on ? "var(--wine)" : "var(--mute-2)", fontWeight: 400 }}>{counts[tab]}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="shrink-0" style={{ padding: "10px 10px 6px" }}>
      <div className="la-seg la-seg--fill" role="tablist" data-testid="chat-channel-tabs">
        {CHAT_CHANNEL_TABS.map((tab) => {
          const Icon = ICONS[tab];
          const on = tab === active;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={on}
              className={`la-seg-btn${on ? " on" : ""}`}
              style={{ padding: "6px 4px", flexDirection: "column", gap: 3, minWidth: 0 }}
              onClick={() => onChange(tab)}
              data-testid={`chat-channel-tab-${tab}`}
            >
              {/* Label on top, count below: three labelled tabs fit the toolbar width. */}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%" }}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate" style={{ letterSpacing: "0.06em" }}>{t(`chatChannel.${tab}`)}</span>
              </span>
              <span className="tabular-nums" style={{ color: on ? "var(--wine)" : "var(--mute-2)", fontWeight: 400 }}>{counts[tab]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
