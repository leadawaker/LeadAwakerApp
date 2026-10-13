// Instant alerts: which events are sent right away, on which channels, the
// WhatsApp quiet hours and whether a caller's number goes into WhatsApp.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BellRing } from "lucide-react";
import { Panel } from "../atoms";
import { ALERT_CHANNELS, ALERT_TYPES, type AlertChannel, type AlertType } from "@shared/clientAlerts";
import { FieldLabel, ReadOnlyValue, SwitchRow, errorStyle, helpStyle, inputStyle } from "./alertsAtoms";
import type { AlertSettingsPatch, AlertSettingsResponse } from "./alertsApi";

export function InstantAlertsCard({ settings, canEdit, saving, onSave }: {
  settings: AlertSettingsResponse; canEdit: boolean; saving: boolean;
  onSave: (patch: AlertSettingsPatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("clientAlerts");
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: AlertSettingsPatch) => {
    setError(null);
    if (!(await onSave(patch))) setError(t("common.saveFailed"));
  };
  const a = settings.alerts;
  const off = !canEdit || saving;
  const setType = (k: AlertType, on: boolean) => save({ alerts: { instant: { [k]: on } } });
  const setChannel = (c: AlertChannel, on: boolean) => save({ alerts: { channels: { alerts: { [c]: on } } } });
  const setQuiet = (key: "from" | "to", v: string) => {
    if (/^\d{2}:\d{2}$/.test(v) && v !== a.quietHours[key]) void save({ alerts: { quietHours: { [key]: v } } });
  };

  return (
    <Panel icon={<BellRing size={17} />} title={t("instant.title")} pad={20}>
      <p style={helpStyle}>{t("instant.help")}</p>
      {ALERT_TYPES.map((k) => (
        <SwitchRow key={k} label={t(`types.${k}.label`)} help={t(`types.${k}.help`)} checked={a.instant[k]}
          disabled={off} onChange={(on) => setType(k, on)} />
      ))}

      <div style={{ marginTop: 18 }}>
        <FieldLabel>{t("instant.channels")}</FieldLabel>
        {ALERT_CHANNELS.map((c) => (
          <SwitchRow key={c} label={t(`channels.${c}`)} help={t(`channels.${c}HelpAlerts`)} checked={a.channels.alerts[c]}
            disabled={off} onChange={(on) => setChannel(c, on)} />
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        <FieldLabel>{t("quiet.title")}</FieldLabel>
        <SwitchRow label={t("quiet.enabled")} help={t("quiet.help")} checked={a.quietHours.enabled}
          disabled={off} onChange={(on) => save({ alerts: { quietHours: { enabled: on } } })} />
        {a.quietHours.enabled && (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginTop: 6 }}>
            {(["from", "to"] as const).map((key) => (
              <div key={key}>
                <FieldLabel>{t(`quiet.${key}`)}</FieldLabel>
                {canEdit ? (
                  <input type="time" key={a.quietHours[key]} defaultValue={a.quietHours[key]} disabled={saving}
                    onBlur={(e) => setQuiet(key, e.target.value)} className="neu-inset-crisp"
                    style={{ ...inputStyle, width: 130 }} aria-label={t(`quiet.${key}`)} />
                ) : <ReadOnlyValue value={a.quietHours[key]} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <SwitchRow label={t("instant.includePhone")} help={t("instant.includePhoneHelp")}
          checked={a.includePhoneInWhatsApp} disabled={off}
          onChange={(on) => save({ alerts: { includePhoneInWhatsApp: on } })} />
      </div>
      {error && <p role="alert" style={errorStyle}>{error}</p>}
    </Panel>
  );
}
