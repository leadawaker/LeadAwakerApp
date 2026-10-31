// Chats > Settings is split per service: each tab is one thing the AI does in
// chat, with its own campaign (its own prompt, tone, hours). Speed to Lead is the
// receptionist answering whoever writes in, on WhatsApp and the website chat
// (ChatTab's channel switch). Reactivation is the agency's outbound campaigns
// (the Accounts > Reactivation view). Referrals and Reputation are announced but
// not built: Reputation waits for the integration that tells the CRM a customer
// was served.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, RefreshCw, Star, UserPlus, Zap } from "lucide-react";
import { useLastTab } from "@/hooks/useLastTab";

export const CHAT_SERVICES = ["speed_to_lead", "reactivation", "referrals", "reputation"] as const;
export type ChatService = (typeof CHAT_SERVICES)[number];

const SOON = new Set<ChatService>(["referrals", "reputation"]);

const ICON: Record<ChatService, ReactNode> = {
  speed_to_lead: <Zap size={14} />, reactivation: <RefreshCw size={14} />, referrals: <UserPlus size={14} />, reputation: <Star size={14} />,
};

/** The service picked (remembered per user); a link to a section opens Speed to Lead, where the sections live. */
export function useChatService(services: readonly ChatService[], linked: boolean): [ChatService, (s: ChatService) => void] {
  const [picked, setPicked] = useLastTab<ChatService>("chats.service", CHAT_SERVICES, "speed_to_lead", linked ? "speed_to_lead" : null);
  return [services.includes(picked) ? picked : "speed_to_lead", setPicked];
}

export function ChatServiceBar({ services, service, onService }: {
  services: readonly ChatService[]; service: ChatService; onService: (s: ChatService) => void;
}) {
  const { t } = useTranslation("chatTab");
  return (
    <div className="la-seg" role="tablist" aria-label={t("services.label")} style={{ alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto" }} data-testid="chat-services">
      {services.map((s) => (
        <button key={s} type="button" role="tab" aria-selected={service === s} className={service === s ? "la-seg-btn on" : "la-seg-btn"}
          onClick={() => onService(s)} data-testid={`chat-service-${s}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          {ICON[s]}{t(`services.${s}.label`)}
        </button>
      ))}
    </div>
  );
}

export const isSoon = (s: ChatService) => SOON.has(s);

/** A service that is announced but not built yet: what it will do, and on which channel. */
export function ChatServiceSoon({ service }: { service: ChatService }) {
  const { t } = useTranslation("chatTab");
  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", padding: "28px 28px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }} data-testid={`chat-service-soon-${service}`}>
      <span style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--wine-tint)", color: "var(--wine)" }}>
        {ICON[service]}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{t(`services.${service}.label`)}</h3>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--wine-tint)", color: "var(--wine)" }}>{t("services.soon")}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--mute)", lineHeight: 1.55, maxWidth: 560 }}>{t(`services.${service}.soon`)}</p>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
        <MessageCircle size={13} />{t("services.channel", { channel: t("channels.whatsapp") })}
      </span>
    </div>
  );
}
