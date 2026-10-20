// What this account actually runs, one row per service: the phone
// receptionist, WhatsApp, the website chat and its text campaigns. Each row
// shows whether it is on, the one fact that identifies it, and this month's
// use where we count it. A row opens the tab where the service is managed.
// Agency only: the rows read the same data the Integrations cards do.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, Globe, Megaphone, MessageCircle, Phone } from "lucide-react";
import { Panel } from "./atoms";
import { useWhatsappSender } from "./whatsapp/whatsappApi";
import { useVoiceLine } from "./voice/useVoiceLine";
import { currentMonth, useVoiceStats } from "./voice/useVoiceStats";
import { fetchWidgetConfigs } from "../../api/widgetApi";
import type { CampaignRowData, WorkspaceTab } from "./types";

type State = "on" | "pending" | "off";
const DOT: Record<State, string> = { on: "var(--good)", pending: "var(--warn)", off: "var(--mute-2)" };

interface Row { key: string; icon: React.ReactNode; state: State; detail: string | null; usage: string | null; tab: WorkspaceTab | null }

export function ServicesPanel({ accountId, campaigns, onOpenTab, naked = true, eyebrow }: {
  eyebrow?: string;
  accountId: number; campaigns: CampaignRowData[]; onOpenTab?: (tab: WorkspaceTab) => void;
  /** false on mobile, where the panel is a card of its own. */
  naked?: boolean;
}) {
  const { t } = useTranslation("accounts");
  const { line } = useVoiceLine(accountId);
  const { stats } = useVoiceStats(accountId, currentMonth());
  const { sender } = useWhatsappSender(accountId);
  // Same key as the Integrations strip: one fetch serves both.
  const { data: widgets } = useQuery({
    queryKey: ["integrations-overview", "widgets", accountId],
    queryFn: () => fetchWidgetConfigs(accountId),
    staleTime: 30_000,
  });

  const number = line?.number ?? null;
  const widget = widgets?.configs.find((c) => c.enabled) ?? widgets?.configs[0] ?? null;
  const activeCampaigns = campaigns.filter((c) => c.status.toLowerCase() === "active").length;

  const rows: Row[] = [
    {
      key: "phone", icon: <Phone size={16} />, tab: "voice",
      state: number?.status === "live" ? "on" : number ? "pending" : "off",
      detail: number?.phoneNumber ?? null,
      usage: number && stats ? t("services.phoneUsage", { count: stats.calls, bookings: stats.bookings }) : null,
    },
    {
      key: "whatsapp", icon: <MessageCircle size={16} />, tab: "integrations",
      state: sender?.status === "connected" ? "on" : sender ? "pending" : "off",
      detail: sender?.displayPhoneNumber ?? null,
      usage: sender ? t(`services.whatsappMode.${sender.onboardingMode ?? "manual"}`) : null,
    },
    {
      key: "website", icon: <Globe size={16} />, tab: "integrations",
      state: widget?.enabled && widget.allowedDomains?.length ? "on" : widget ? "pending" : "off",
      detail: widget?.allowedDomains?.[0] ?? null,
      usage: null,
    },
    {
      key: "campaigns", icon: <Megaphone size={16} />, tab: null,
      state: activeCampaigns ? "on" : campaigns.length ? "pending" : "off",
      detail: null,
      usage: campaigns.length ? t("services.campaignUsage", { count: campaigns.length, active: activeCampaigns }) : null,
    },
  ];

  return (
    <Panel eyebrow={eyebrow} title={t("services.title")} naked={naked} style={naked ? undefined : { background: "var(--card)" }}>
      <div style={{ display: "flex", flexDirection: "column", padding: "0 12px 12px" }} data-testid="account-services">
        {rows.map((row) => {
          const open = row.tab && onOpenTab ? () => onOpenTab(row.tab!) : undefined;
          return (
            <button
              key={row.key}
              type="button"
              onClick={open}
              disabled={!open}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 12px", borderRadius: 12, border: 0,
                background: "none", textAlign: "left", cursor: open ? "pointer" : "default", width: "100%", minWidth: 0,
              }}
              data-testid={`account-service-${row.key}`}
            >
              <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, background: row.state === "off" ? "var(--surface)" : "var(--wine-tint)", color: row.state === "off" ? "var(--mute-2)" : "var(--wine)" }}>
                {row.icon}
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
              {open && <ChevronRight size={15} style={{ color: "var(--mute-2)", flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
