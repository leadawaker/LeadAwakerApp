// Demos → Settings → Voice: the phone line's office ambience.
//
// The switch moves the demo number at Telnyx between two routes: straight to
// OpenAI (no room sound possible), or through a Telnyx conference that loops
// an office bed to the caller. It acts immediately, because it is a routing
// change at the carrier, and shows what Telnyx reports rather than the click.
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  useDemoSettings,
  usePhoneRoute,
  useSaveVoiceSettings,
  useSetPhoneRoute,
  type VoiceDemoSettings,
} from "../api/demoSettingsApi";

const LEVELS = ["low", "medium", "high"] as const;

const CARD: React.CSSProperties = {
  borderRadius: "var(--r-card)",
  background: "var(--bone)",
  padding: "20px 22px",
  maxWidth: 560,
};

export function PhoneAmbienceSettings() {
  const { t } = useTranslation("demos");
  const { data: settings } = useDemoSettings();
  const route = usePhoneRoute();
  const setRoute = useSetPhoneRoute();
  const save = useSaveVoiceSettings();

  const voice = (settings?.settings?.voice || {}) as VoiceDemoSettings;
  const level = voice.phoneAmbienceLevel ?? "medium";
  const on = !!route.data?.ambience;
  const error = (route.error || setRoute.error || save.error) as Error | null;

  return (
    <div className="neu-raised" style={CARD}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            {t("settings.voice.phone.title")}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 2 }}>
            {t("settings.voice.phone.hint", { number: route.data?.number ?? "" })}
          </span>
        </div>
        {(route.isLoading || setRoute.isPending) ? (
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--mute)", marginTop: 2 }} />
        ) : (
          <Switch
            checked={on}
            disabled={!route.data}
            onCheckedChange={(v) => setRoute.mutate(v)}
            aria-label={t("settings.voice.phone.title")}
          />
        )}
      </div>

      <span style={{ display: "block", fontSize: 12, color: on ? "var(--ink-soft)" : "var(--mute-2)", marginTop: 10 }}>
        {on ? t("settings.voice.phone.onState") : t("settings.voice.phone.offState")}
      </span>

      <div style={{ height: 1, background: "var(--line)", margin: "16px 0" }} />

      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
        {t("settings.voice.phone.levelTitle")}
      </span>
      <span style={{ display: "block", fontSize: 12, color: "var(--mute)", margin: "2px 0 8px" }}>
        {t("settings.voice.phone.levelHint")}
      </span>
      <div className="la-seg" role="radiogroup" style={{ alignSelf: "flex-start" }}>
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={level === l}
            className={level === l ? "la-seg-btn on" : "la-seg-btn"}
            style={{ padding: "6px 12px", fontSize: 11, letterSpacing: "0.08em" }}
            disabled={save.isPending}
            onClick={() => save.mutate({ phoneAmbienceLevel: l })}
          >
            {t(`settings.voice.phone.level.${l}`)}
          </button>
        ))}
      </div>

      {error && (
        <span style={{ display: "block", marginTop: 10, fontSize: 12, color: "var(--danger, #B3261E)" }}>
          {error.message}
        </span>
      )}
    </div>
  );
}
