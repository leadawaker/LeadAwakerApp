// Demos > Settings > AI receptionist > Calls: how long a demo call may run,
// the numbers Sara never remembers, Gabriel's phones for "Call me + prospect" and how
// Sara joins it (handoff or three-way),
// and the password for the demo page opened without a link (minted links need
// none). Saves only its own fields; the server merges them into the voice row.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_OWNER_PHONE,
  DEFAULT_OWNER_PHONE_BACKUP,
  useDemoSettings,
  useEngineVoiceOptions,
  useSaveVoiceSettings,
  type VoiceDemoSettings,
} from "../api/demoSettingsApi";
import { CommaListInput } from "./CommaListInput";
import { ENGINE_INPUT, SaveBar, Seg, SETTINGS_CARD, SETTINGS_HINT, SETTINGS_LABEL, SETTINGS_RULE, SETTINGS_TITLE } from "./engineControls";

type Draft = Pick<VoiceDemoSettings,
  "maxCallMinutes" | "forgetNumbers" | "passwords" | "ownerPhone" | "ownerPhoneBackup" | "ownerPhoneUse" | "callMeStyle" | "browserJitter">;
type CallMeStyle = NonNullable<VoiceDemoSettings["callMeStyle"]>;
type BrowserJitter = NonNullable<VoiceDemoSettings["browserJitter"]>;

const ROW = "flex items-center gap-2 max-sm:flex-wrap";
const SMALL: React.CSSProperties = { ...SETTINGS_TITLE, fontSize: 13 };

export function VoiceCallsSettings() {
  const { t } = useTranslation("demos");
  const { data } = useDemoSettings();
  const { data: engine } = useEngineVoiceOptions();
  const save = useSaveVoiceSettings();
  const saved = (data?.settings?.voice || {}) as VoiceDemoSettings;
  const [draft, setDraft] = useState<Draft | null>(null);
  const current: Draft = draft ?? saved;
  const patch = (next: Partial<Draft>) => setDraft({ ...current, ...next });

  const onSave = async () => {
    if (!draft) return;
    try {
      await save.mutateAsync({
        // null clears a saved limit back to the engine's default.
        maxCallMinutes: current.maxCallMinutes ?? null,
        forgetNumbers: current.forgetNumbers ?? [],
        passwords: current.passwords ?? [],
        ownerPhone: current.ownerPhone?.trim() || null,
        ownerPhoneBackup: current.ownerPhoneBackup?.trim() || null,
        ownerPhoneUse: current.ownerPhoneUse ?? "primary",
        callMeStyle: current.callMeStyle ?? "handoff",
        browserJitter: current.browserJitter ?? "standard",
      });
      setDraft(null);
    } catch {
      // The draft stays for another try; the reason shows under the button.
    }
  };

  return (
    <div className="neu-raised" style={SETTINGS_CARD} data-testid="voice-calls-settings">
      <span style={{ ...SETTINGS_TITLE, marginBottom: 12 }}>{t("settings.calls.title")}</span>

      <div style={{ display: "grid", gap: 8 }}>
        <label className={ROW}>
          <span style={SETTINGS_LABEL}>{t("settings.calls.limit")}</span>
          <input
            type="number"
            min={1}
            max={30}
            style={{ ...ENGINE_INPUT, width: 90 }}
            value={current.maxCallMinutes ?? engine?.max_call_minutes ?? 5}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              // Empty means the engine default; anything else is kept in 1..30.
              patch({ maxCallMinutes: e.target.value === "" || !n ? null : Math.min(30, Math.max(1, n)) });
            }}
          />
        </label>
      </div>

      <label style={{ display: "block", marginTop: 14 }}>
        <span style={SMALL}>{t("settings.calls.forget")}</span>
        <span style={SETTINGS_HINT}>{t("settings.calls.forgetHint")}</span>
        <CommaListInput
          style={{ ...ENGINE_INPUT, width: "100%" }}
          value={current.forgetNumbers ?? []}
          placeholder={t("settings.calls.forgetPlaceholder")}
          onChange={(forgetNumbers) => patch({ forgetNumbers })}
        />
      </label>

      <div style={SETTINGS_RULE} />

      <span style={SMALL}>{t("settings.calls.phones")}</span>
      <span style={SETTINGS_HINT}>{t("settings.calls.phonesHint")}</span>
      <div style={{ display: "grid", gap: 8 }}>
        <label className={ROW}>
          <span style={SETTINGS_LABEL}>{t("settings.calls.ownerPhone")}</span>
          <input
            style={{ ...ENGINE_INPUT, width: 180, maxWidth: "100%" }}
            inputMode="tel"
            value={current.ownerPhone ?? ""}
            placeholder={DEFAULT_OWNER_PHONE}
            onChange={(e) => patch({ ownerPhone: e.target.value })}
          />
        </label>
        <label className={ROW}>
          <span style={SETTINGS_LABEL}>{t("settings.calls.ownerPhoneBackup")}</span>
          <input
            style={{ ...ENGINE_INPUT, width: 180, maxWidth: "100%" }}
            inputMode="tel"
            value={current.ownerPhoneBackup ?? ""}
            placeholder={DEFAULT_OWNER_PHONE_BACKUP}
            onChange={(e) => patch({ ownerPhoneBackup: e.target.value })}
          />
        </label>
        <div className={ROW}>
          <span style={SETTINGS_LABEL}>{t("settings.calls.ownerPhoneUse")}</span>
          <Seg<"primary" | "backup">
            value={current.ownerPhoneUse ?? "primary"}
            options={["primary", "backup"]}
            ariaLabel={t("settings.calls.ownerPhoneUse")}
            label={(o) => t(`settings.calls.use.${o}`)}
            onChange={(ownerPhoneUse) => patch({ ownerPhoneUse })}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <span style={SMALL}>{t("settings.calls.style")}</span>
        <span style={SETTINGS_HINT}>{t("settings.calls.styleHint")}</span>
        <Seg<CallMeStyle>
          value={current.callMeStyle ?? "handoff"}
          options={["handoff", "barge", "conference"]}
          ariaLabel={t("settings.calls.style")}
          label={(o) => t(`settings.calls.styles.${o}`)}
          onChange={(callMeStyle) => patch({ callMeStyle })}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <span style={SMALL}>{t("settings.calls.jitter")}</span>
        <span style={SETTINGS_HINT}>{t("settings.calls.jitterHint")}</span>
        <Seg<BrowserJitter>
          value={current.browserJitter ?? "standard"}
          options={["off", "standard", "large"]}
          ariaLabel={t("settings.calls.jitter")}
          label={(o) => t(`settings.calls.jitters.${o}`)}
          onChange={(browserJitter) => patch({ browserJitter })}
        />
      </div>

      <div style={SETTINGS_RULE} />

      <label className={ROW}>
        <span style={SETTINGS_LABEL}>{t("settings.calls.password")}</span>
        <CommaListInput
          style={{ ...ENGINE_INPUT, width: 210, maxWidth: "100%" }}
          value={current.passwords ?? []}
          placeholder={t("settings.calls.passwordPlaceholder")}
          onChange={(passwords) => patch({ passwords })}
        />
      </label>

      <SaveBar
        dirty={!!draft}
        pending={save.isPending}
        error={save.isError ? (save.error as Error) : null}
        onSave={() => void onSave()}
        onCancel={() => setDraft(null)}
      />
    </div>
  );
}
