// Daily recap: on/off, local time (shared with the onboarding wizard's
// setup.handoff keys), the language of every recap and alert, and which
// channels it goes out on.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Newspaper } from "lucide-react";
import { Panel } from "../atoms";
import { ALERT_CHANNELS, ALERT_LANGUAGES, type AlertChannel } from "@shared/clientAlerts";
import { FieldLabel, ReadOnlyValue, SwitchRow, errorStyle, helpStyle, inputStyle } from "./alertsAtoms";
import type { AlertSettingsPatch, AlertSettingsResponse } from "./alertsApi";

export function RecapCard({ settings, canEdit, saving, onSave }: {
  settings: AlertSettingsResponse; canEdit: boolean; saving: boolean;
  onSave: (patch: AlertSettingsPatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("clientAlerts");
  const [error, setError] = useState<string | null>(null);
  const save = async (patch: AlertSettingsPatch) => {
    setError(null);
    if (!(await onSave(patch))) setError(t("common.saveFailed"));
  };
  const ch = settings.alerts.channels.recap;
  const setChannel = (c: AlertChannel, on: boolean) => save({ alerts: { channels: { recap: { [c]: on } } } });

  return (
    <Panel icon={<Newspaper size={17} />} title={t("recap.title")} pad={20}>
      <p style={helpStyle}>{t("recap.help")}</p>
      <SwitchRow label={t("recap.enabled")} help={t("recap.enabledHelp")} checked={settings.recap.enabled}
        disabled={!canEdit || saving} onChange={(on) => save({ recap: { enabled: on } })} />

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
        <div>
          <FieldLabel>{t("recap.time")}</FieldLabel>
          {canEdit ? (
            <input type="time" key={settings.recap.time} defaultValue={settings.recap.time} disabled={saving}
              onBlur={(e) => {
                const v = e.target.value;
                if (/^\d{2}:\d{2}$/.test(v) && v !== settings.recap.time) void save({ recap: { time: v } });
              }}
              className="neu-inset-crisp" style={{ ...inputStyle, width: 130 }} aria-label={t("recap.time")} />
          ) : <ReadOnlyValue value={settings.recap.time} />}
        </div>
        <div>
          <FieldLabel>{t("recap.timezone")}</FieldLabel>
          <ReadOnlyValue value={settings.timezone} />
        </div>
        <div>
          <FieldLabel>{t("language.label")}</FieldLabel>
          {canEdit ? (
            <select value={settings.alerts.language ?? ""} disabled={saving}
              onChange={(e) => save({ alerts: { language: (e.target.value || null) as any } })}
              className="neu-inset-crisp" style={{ ...inputStyle, width: 190 }} aria-label={t("language.label")}>
              <option value="">{t("language.auto")}</option>
              {ALERT_LANGUAGES.map((l) => <option key={l} value={l}>{t(`language.${l}`)}</option>)}
            </select>
          ) : <ReadOnlyValue value={settings.alerts.language ? t(`language.${settings.alerts.language}`) : t("language.auto")} />}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <FieldLabel>{t("recap.channels")}</FieldLabel>
        {ALERT_CHANNELS.map((c) => (
          <SwitchRow key={c} label={t(`channels.${c}`)} help={t(`channels.${c}HelpRecap`)} checked={ch[c]}
            disabled={!canEdit || saving} onChange={(on) => setChannel(c, on)} />
        ))}
      </div>
      {error && <p role="alert" style={errorStyle}>{error}</p>}
    </Panel>
  );
}
