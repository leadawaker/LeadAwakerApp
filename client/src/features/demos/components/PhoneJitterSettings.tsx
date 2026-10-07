// Demos → Settings → Voice: the phone line's jitter buffer.
//
// OpenAI's audio packets sometimes reach Telnyx unevenly, which the caller
// hears as tiny dropouts. The buffer holds 60-200 ms of audio to smooth that
// out, at the cost of that much delay. It is a setting on the Telnyx
// connection, so it acts immediately and applies to every call on the line.
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePhoneJitter, useSetPhoneJitter } from "../api/demoSettingsApi";

const CARD: React.CSSProperties = {
  borderRadius: "var(--r-card)",
  background: "var(--bone)",
  padding: "20px 22px",
  maxWidth: 560,
};

export function PhoneJitterSettings() {
  const { t } = useTranslation("demos");
  const jitter = useSetPhoneJitter();
  const state = usePhoneJitter();
  const on = !!state.data?.enabled;
  const range = { min: state.data?.min_ms ?? 60, max: state.data?.max_ms ?? 200 };
  const error = (state.error || jitter.error) as Error | null;

  return (
    <div className="neu-raised" style={CARD}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            {t("settings.voice.jitter.title")}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 2 }}>
            {t("settings.voice.jitter.hint", range)}
          </span>
        </div>
        {(state.isLoading || jitter.isPending) ? (
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--mute)", marginTop: 2 }} />
        ) : (
          <Switch
            checked={on}
            disabled={!state.data}
            onCheckedChange={(v) => jitter.mutate(v)}
            aria-label={t("settings.voice.jitter.title")}
          />
        )}
      </div>

      <span style={{ display: "block", fontSize: 12, color: on ? "var(--ink-soft)" : "var(--mute-2)", marginTop: 10 }}>
        {on ? t("settings.voice.jitter.onState", range) : t("settings.voice.jitter.offState")}
      </span>

      {state.data?.anchorsite && (
        <span style={{ display: "block", fontSize: 12, color: "var(--mute)", marginTop: 6 }}>
          {t("settings.voice.jitter.anchor", { site: state.data.anchorsite })}
        </span>
      )}

      {error && (
        <span style={{ display: "block", marginTop: 10, fontSize: 12, color: "var(--danger, #B3261E)" }}>
          {error.message}
        </span>
      )}
    </div>
  );
}
