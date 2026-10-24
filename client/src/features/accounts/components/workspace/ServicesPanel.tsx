// What this account runs, one row per service: the phone receptionist,
// WhatsApp, the website chat, reactivation, reviews and social. A service the
// account does not have stays in the list, greyed out, so the client sees the
// whole offer. Each row shows whether it is on, the one fact that identifies
// it, and this month's use where we count it. A row opens the place where the
// service is managed. The agency rows read the same data the Integrations
// cards do; those endpoints are agency only, so a client login gets
// ClientServicesPanel, built from the account-scoped Home facts.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { ChevronRight, Clapperboard, Globe, Megaphone, MessageCircle, Phone, Star } from "lucide-react";
import { useHomeServices } from "@/features/home/api/homeApi";
import { useVoiceCapabilities } from "@/features/voiceCalls/api/voiceCallsApi";
import { useClientNavFacts } from "@/components/crm/useClientNavFacts";
import { fetchSocialStatus, socialStatusKey } from "@/features/social/api/socialApi";
import { Panel } from "./atoms";
import { useWhatsappSender } from "./whatsapp/whatsappApi";
import { useVoiceLine } from "./voice/useVoiceLine";
import { currentMonth, useVoiceStats } from "./voice/useVoiceStats";
import { receptionistSettingsHref } from "./receptionist/settingsLink";
import { fetchWidgetConfigs } from "../../api/widgetApi";
import type { WorkspaceTab } from "./types";

type State = "on" | "pending" | "off";
const DOT: Record<State, string> = { on: "var(--good)", pending: "var(--warn)", off: "var(--mute-2)" };

type ServiceKey = "phone" | "whatsapp" | "website" | "reactivation" | "reputation" | "social";
const ICON: Record<ServiceKey, React.ReactNode> = {
  phone: <Phone size={16} />,
  whatsapp: <MessageCircle size={16} />,
  website: <Globe size={16} />,
  reactivation: <Megaphone size={16} />,
  reputation: <Star size={16} />,
  social: <Clapperboard size={16} />,
};

interface Row { key: ServiceKey; state: State; detail?: string | null; usage?: string | null; open?: () => void }

function ServiceRows({ rows }: { rows: Row[] }) {
  const { t } = useTranslation("accounts");
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "0 12px 12px" }} data-testid="account-services">
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={row.open}
          disabled={!row.open}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 12px", borderRadius: 12, border: 0,
            background: "none", textAlign: "left", cursor: row.open ? "pointer" : "default", width: "100%", minWidth: 0,
          }}
          data-testid={`account-service-${row.key}`}
        >
          <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, background: row.state === "off" ? "var(--surface)" : "var(--wine-tint)", color: row.state === "off" ? "var(--mute-2)" : "var(--wine)" }}>
            {ICON[row.key]}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: row.state === "off" ? "var(--mute)" : "var(--ink)" }}>{t(`services.rows.${row.key}`)}</span>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: DOT[row.state], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--mute)" }}>{t(`services.state.${row.key}.${row.state}`)}</span>
            </span>
            {(row.detail || row.usage) && (
              <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 2, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                {row.detail && <span style={{ fontFamily: "var(--mono)", color: "var(--ink-soft)" }}>{row.detail}</span>}
                {row.detail && row.usage ? " · " : ""}
                {row.usage}
              </span>
            )}
          </span>
          {row.open && <ChevronRight size={15} style={{ color: "var(--mute-2)", flexShrink: 0 }} />}
        </button>
      ))}
    </div>
  );
}

const onOff = (on: boolean | undefined): State => (on ? "on" : "off");

export function ServicesPanel({ accountId, onOpenTab, naked = true, eyebrow }: {
  eyebrow?: string;
  accountId: number; onOpenTab?: (tab: WorkspaceTab) => void;
  /** false on mobile, where the panel is a card of its own. */
  naked?: boolean;
}) {
  const { t } = useTranslation("accounts");
  const { line } = useVoiceLine(accountId);
  const { stats } = useVoiceStats(accountId, currentMonth());
  const { sender } = useWhatsappSender(accountId);
  const { data: services } = useHomeServices(accountId);
  // Same keys as the Integrations strip and the Social card: one fetch serves both.
  const { data: widgets } = useQuery({
    queryKey: ["integrations-overview", "widgets", accountId],
    queryFn: () => fetchWidgetConfigs(accountId),
    staleTime: 30_000,
  });
  const { data: social } = useQuery({
    queryKey: socialStatusKey(accountId),
    queryFn: () => fetchSocialStatus(accountId),
    staleTime: 5 * 60 * 1000,
  });

  const number = line?.number ?? null;
  const widget = widgets?.configs.find((c) => c.enabled) ?? widgets?.configs[0] ?? null;
  const tab = (k: WorkspaceTab) => (onOpenTab ? () => onOpenTab(k) : undefined);

  const rows: Row[] = [
    {
      key: "phone", open: tab("voice"),
      state: number?.status === "live" ? "on" : number ? "pending" : "off",
      detail: number?.phoneNumber ?? null,
      usage: number && stats ? t("services.phoneUsage", { count: stats.calls, bookings: stats.bookings }) : null,
    },
    {
      key: "whatsapp", open: tab("integrations"),
      state: sender?.status === "connected" ? "on" : sender ? "pending" : "off",
      detail: sender?.displayPhoneNumber ?? null,
      usage: sender ? t(`services.whatsappMode.${sender.onboardingMode ?? "manual"}`) : null,
    },
    {
      key: "website", open: tab("integrations"),
      state: widget?.enabled && widget.allowedDomains?.length ? "on" : widget ? "pending" : "off",
      detail: widget?.allowedDomains?.[0] ?? null,
    },
    // Reactivation and reviews: the same facts that decide the Home tabs
    // (receptionist plumbing campaigns do not count as reactivation). Social:
    // the switch that gives the client the Social page. Reactivation opens its
    // tab even when off: that is where the agency starts the first campaign.
    { key: "reactivation", state: onOff(services?.reactivation), open: tab("reactivation") },
    { key: "reputation", state: onOff(services?.reputation) },
    { key: "social", state: onOff(social?.enabled) },
  ];

  return (
    <Panel eyebrow={eyebrow} title={t("services.title")} naked={naked} style={naked ? undefined : { background: "var(--card)" }}>
      <ServiceRows rows={rows} />
    </Panel>
  );
}

/** The client's copy of the list: the same rows, from the facts a client login may read. */
export function ClientServicesPanel({ accountId, onOpenTab, naked = true }: {
  accountId: number; onOpenTab?: (tab: WorkspaceTab) => void; naked?: boolean;
}) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();
  const { data: services } = useHomeServices(accountId);
  const { data: caps } = useVoiceCapabilities();
  const { hasSocial } = useClientNavFacts();
  const go = (href: string) => () => setLocation(href);
  const tab = (k: WorkspaceTab) => (onOpenTab ? () => onOpenTab(k) : undefined);

  // The phone opens its setup on the Calls page, which is there only once the line is live.
  const phone: State = caps?.live ? "on" : services?.phone ? "pending" : "off";
  const rows: Row[] = [
    { key: "phone", state: phone, open: phone === "on" ? go(receptionistSettingsHref("voice")) : undefined },
    { key: "whatsapp", state: onOff(services?.whatsapp), open: services?.whatsapp ? tab("integrations") : undefined },
    { key: "website", state: onOff(services?.website), open: services?.website ? tab("integrations") : undefined },
    { key: "reactivation", state: onOff(services?.reactivation), open: services?.reactivation ? go("/platform/home?tab=reactivation") : undefined },
    { key: "reputation", state: onOff(services?.reputation), open: services?.reputation ? go("/platform/home?tab=reputation") : undefined },
    { key: "social", state: onOff(hasSocial), open: hasSocial ? go("/platform/social") : undefined },
  ];

  return (
    <Panel title={t("services.title")} naked={naked}>
      <ServiceRows rows={rows} />
    </Panel>
  );
}
