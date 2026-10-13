// Onboarding wizard: the daily recap switch and time. Like the channels under
// it, they save straight through the alert settings route, which owns them
// (the Recaps & alerts tab edits the same two values): a wizard left open in
// another tab can then never write an older time back. `onLocal` keeps the
// wizard's own copy in step for what it shows.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Chip, inputStyle } from "../communication/wizardAtoms";
import { useAlertSettings, type AlertSettingsPatch } from "./alertsApi";

export function WizardRecap({ accountId, labels, onLocal }: {
  accountId: number;
  labels: { on: string; off: string; time: string };
  onLocal: (patch: { recap?: boolean; recapTime?: string }) => void;
}) {
  const { t } = useTranslation("clientAlerts");
  const { settings, save } = useAlertSettings(accountId);
  const [error, setError] = useState<string | null>(null);
  if (!settings) return null;

  const { enabled, time } = settings.recap;
  const patch = async (recap: NonNullable<AlertSettingsPatch["recap"]>) => {
    setError(null);
    try {
      await save.mutateAsync({ recap });
      onLocal({ ...(recap.enabled !== undefined ? { recap: recap.enabled } : {}), ...(recap.time ? { recapTime: recap.time } : {}) });
    } catch {
      setError(t("wizard.saveFailed"));
    }
  };
  const locked = !settings.canEdit || save.isPending;

  return (
    <>
      <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
        <Chip selected={enabled} disabled={locked} onClick={() => { if (!enabled) void patch({ enabled: true }); }} label={labels.on} />
        <Chip selected={!enabled} disabled={locked} onClick={() => { if (enabled) void patch({ enabled: false }); }} label={labels.off} />
        {enabled && (
          <input
            type="time"
            key={time}
            defaultValue={time}
            disabled={locked}
            onBlur={(e) => { if (/^\d{2}:\d{2}$/.test(e.target.value) && e.target.value !== time) void patch({ time: e.target.value }); }}
            aria-label={labels.time}
            className="neu-inset-crisp"
            style={{ ...inputStyle, width: 120 }}
          />
        )}
      </div>
      {error && <p role="alert" style={{ fontSize: 12.5, color: "var(--stage-lost)", margin: "8px 0 0" }}>{error}</p>}
    </>
  );
}
