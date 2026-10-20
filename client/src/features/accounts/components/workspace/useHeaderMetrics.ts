// The four figures in the account header, one per tab that matters day to
// day: calls and bookings this month (Phone), whether the phone line is live
// (Phone), whether WhatsApp is connected (Integrations) and who gets the
// alerts (Alerts). Each reads the same query its tab already uses.
import { createElement } from "react";
import { useTranslation } from "react-i18next";
import { useVoiceLine } from "./voice/useVoiceLine";
import { ReadinessList } from "./voice/ReadinessList";
import { currentMonth, useVoiceStats } from "./voice/useVoiceStats";
import { useWhatsappSender } from "./whatsapp/whatsappApi";
import { useAlertSettings } from "./alerts/alertsApi";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { MetaChip } from "./types";

export function useHeaderMetrics(accountId: number): MetaChip[] {
  const { t } = useTranslation("accounts");
  const { isAgencyUser } = useWorkspace();
  const { stats } = useVoiceStats(accountId, currentMonth());
  const { line } = useVoiceLine(accountId);
  const { sender } = useWhatsappSender(accountId);
  const { settings } = useAlertSettings(accountId);
  if (!accountId) return [];

  const dash = "–";
  const missing = line ? line.readiness.items.filter((i) => !i.ok).length : 0;
  const phone = !line ? dash : line.number?.status === "live" ? t("metrics.live") : line.number ? t("metrics.notLive") : isAgencyUser ? t("metrics.noNumber") : t("metrics.settingUp");
  const whatsapp = sender?.status === "connected" ? t("metrics.connected") : sender ? t("metrics.pending") : t("metrics.off");
  const recipients = settings
    ? settings.alerts.recipients.emails.length + settings.alerts.recipients.whatsapp.filter((w) => !w.optedOutAt).length
    : null;

  return [
    {
      key: "calls", label: t("metrics.callsMonth"), value: stats ? stats.calls : dash,
      sub: stats ? t("metrics.nBooked", { count: stats.bookings }) : "", accent: "var(--wine)",
    },
    {
      key: "phone", label: t("metrics.phone"), value: phone,
      // A client with no number yet is told it is being set up, not that items are missing.
      sub: line ? (!isAgencyUser && !line.number ? "" : missing ? t("metrics.nMissing", { count: missing }) : t("metrics.ready")) : "",
      accent: line?.number?.status === "live" ? "var(--good)" : "var(--warn)",
      // Hovering "Live · ready" (or "· 2 missing") lists every readiness item.
      detail: line ? createElement(ReadinessList, { line }) : undefined,
    },
    {
      key: "whatsapp", label: t("metrics.whatsapp"), value: whatsapp, sub: "",
      accent: sender?.status === "connected" ? "var(--good)" : "var(--mute)",
    },
    {
      key: "alerts", label: t("metrics.alerts"), value: recipients ?? dash,
      sub: settings ? (settings.recap.enabled ? t("metrics.recapAt", { time: settings.recap.time }) : t("metrics.recapOff")) : "",
      accent: "var(--stage-contacted)",
    },
  ];
}
