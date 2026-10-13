// Account workspace "Recaps & alerts" tab (specs/client-recaps): the daily
// recap, instant alerts, recipients and a test send. The agency edits; the
// client sees the same cards read-only.
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useAlertSettings, type AlertSettingsPatch } from "./alertsApi";
import { RecapCard } from "./RecapCard";
import { InstantAlertsCard } from "./InstantAlertsCard";
import { RecipientsCard } from "./RecipientsCard";
import { TestSendCard } from "./TestSendCard";

export function AlertsTab({ accountId, readOnly = false }: { accountId: number; readOnly?: boolean }) {
  const { t } = useTranslation("clientAlerts");
  const { settings, loading, error, save, test } = useAlertSettings(accountId);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {!canEdit && (
        <p className="neu-inset-super-crisp" style={{ borderRadius: "var(--r-surface)", padding: "10px 14px", margin: 0, fontSize: 12.5, color: "var(--mute)" }}>
          {t("readOnly")}
        </p>
      )}
      {!settings.configured && canEdit && (
        <p className="neu-inset-super-crisp" style={{ borderRadius: "var(--r-surface)", padding: "10px 14px", margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>
          {t("notConfigured")}
        </p>
      )}
      <RecipientsCard {...card} />
      <RecapCard {...card} />
      <InstantAlertsCard {...card} />
      {canEdit && <TestSendCard settings={settings} onTest={(body) => test.mutateAsync(body)} />}
    </div>
  );
}
