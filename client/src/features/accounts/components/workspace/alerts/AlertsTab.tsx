// Account workspace "Alerts" tab (specs/client-recaps): who gets them, the
// daily recap, instant alerts and a test send, one section at a time behind
// the same menu as the Phone tab. The agency edits; the client sees the same
// cards read-only.
import { RequestChangeNote } from "@/components/crm/RequestChangeNote";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BellRing, Loader2, Newspaper, Send, Users } from "lucide-react";
import { SectionHeader, SectionLayout, SectionRail, type SectionRailItem } from "../SectionRail";
import { useAlertSettings, type AlertSettingsPatch } from "./alertsApi";
import { RecapCard } from "./RecapCard";
import { InstantAlertsCard } from "./InstantAlertsCard";
import { RecipientsCard } from "./RecipientsCard";
import { TestSendCard } from "./TestSendCard";

type AlertSection = "recipients" | "recap" | "instant" | "test";

export function AlertsTab({ accountId, readOnly = false, stacked = false }: { accountId: number; readOnly?: boolean; stacked?: boolean }) {
  const { t } = useTranslation("clientAlerts");
  const { t: tc } = useTranslation("crm");
  const { settings, loading, error, save, test } = useAlertSettings(accountId);
  const [section, setSection] = useState<AlertSection>("recipients");

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ padding: 48, color: "var(--mute)" }}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (error || !settings) {
    return (
      <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: 32, textAlign: "center", color: "var(--mute)", fontSize: 13.5 }}>
        {t("common.loadFailed")}
      </div>
    );
  }

  const canEdit = settings.canEdit && !readOnly;
  const onSave = async (patch: AlertSettingsPatch) => {
    try { await save.mutateAsync(patch); return true; } catch { return false; }
  };
  const card = { settings, canEdit, saving: save.isPending, onSave };

  const { recipients, instant, channels } = settings.alerts;
  const emails = recipients.emails.length;
  const whatsapps = recipients.whatsapp.filter((w) => !w.optedOutAt).length;
  const instantOn = Object.values(instant).filter(Boolean).length;
  const instantTotal = Object.keys(instant).length;
  const items: SectionRailItem<AlertSection>[] = [
    {
      key: "recipients", icon: <Users size={16} />, label: t("rail.recipients.label"),
      state: emails + whatsapps > 0 ? "on" : "off",
      detail: emails + whatsapps > 0 ? t("rail.recipients.detail", { emails, whatsapps }) : t("rail.recipients.none"),
    },
    {
      key: "recap", icon: <Newspaper size={16} />, label: t("rail.recap.label"),
      state: settings.recap.enabled ? "on" : "off",
      detail: settings.recap.enabled ? t("rail.recap.on", { time: settings.recap.time }) : t("rail.recap.off"),
    },
    {
      key: "instant", icon: <BellRing size={16} />, label: t("rail.instant.label"),
      state: instantOn === 0 ? "off" : Object.values(channels.alerts).some(Boolean) ? "on" : "pending",
      detail: t("rail.instant.detail", { on: instantOn, total: instantTotal }),
    },
    ...(canEdit ? [{ key: "test" as const, icon: <Send size={16} />, label: t("rail.test.label"), detail: t("rail.test.detail") }] : []),
  ];
  const shown = items.some((i) => i.key === section) ? section : "recipients";
  const index = items.findIndex((i) => i.key === shown) + 1;

  return (
    <SectionLayout
      stacked={stacked}
      testId="alerts-tab"
      rail={(layout) => <SectionRail items={items} active={shown} onSelect={setSection} layout={layout} testId="alerts-rail" />}
    >
    <section style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
      <SectionHeader index={index} title={t(`rail.${shown}.label`)} help={t(`rail.${shown}.help`)} />
      {!canEdit && <RequestChangeNote area={tc("requestChange.areas.alerts")} />}
      {!settings.configured && canEdit && (
        <p className="neu-inset-super-crisp" style={{ borderRadius: "var(--r-surface)", padding: "10px 14px", margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>
          {t("notConfigured")}
        </p>
      )}
      {shown === "recipients" && <RecipientsCard {...card} />}
      {shown === "recap" && <RecapCard {...card} />}
      {shown === "instant" && <InstantAlertsCard {...card} />}
      {shown === "test" && canEdit && <TestSendCard settings={settings} onTest={(body) => test.mutateAsync(body)} />}
    </section>
    </SectionLayout>
  );
}
