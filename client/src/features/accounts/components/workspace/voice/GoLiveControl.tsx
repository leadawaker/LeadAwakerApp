// The one switch that lets real callers reach her. Going live takes a second
// click that names the number, and is refused (here and on the server) until
// every readiness item is green. Going offline is one click, any time.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Power, PowerOff } from "lucide-react";
import { helpStyle } from "./voiceAtoms";
import type { VoiceLine, VoiceLinePatch } from "./voiceApi";

export function GoLiveControl({ line, saving, onSave }: {
  line: VoiceLine; saving: boolean; onSave: (patch: VoiceLinePatch) => Promise<boolean>;
}) {
  const { t } = useTranslation("voiceTab");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const number = line.number;
  if (!number) return null;

  const missing = line.readiness.items.filter((i) => !i.ok).map((i) => t(`readiness.items.${i.key}`));
  const isLive = number.status === "live";

  const set = async (live: boolean) => {
    setError(null);
    if (await onSave({ live })) setConfirming(false);
    else setError(t("common.saveFailed"));
  };

  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 16 }} data-testid="voice-go-live">
      {isLive ? (
        <>
          <p style={helpStyle}>{t("live.isLive", { number: number.phoneNumber })}</p>
          <button type="button" className="la-btn la-btn--soft" onClick={() => set(false)} disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <PowerOff size={13} />}
            {t("live.takeOffline")}
          </button>
        </>
      ) : missing.length > 0 ? (
        <p style={{ ...helpStyle, margin: 0 }}>{t("live.notReady", { items: missing.join(", ") })}</p>
      ) : confirming ? (
        <>
          <p style={helpStyle}>{t("live.confirmHelp", { number: number.phoneNumber })}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="la-btn la-btn--wine" onClick={() => set(true)} disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
              {t("live.confirm")}
            </button>
            <button type="button" className="la-btn la-btn--soft" onClick={() => setConfirming(false)} disabled={saving}>
              {t("live.cancel")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={helpStyle}>{t("live.readyHelp")}</p>
          <button type="button" className="la-btn la-btn--wine" onClick={() => setConfirming(true)} disabled={saving}>
            <Power size={13} />
            {t("live.goLive")}
          </button>
        </>
      )}
      {error && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: "var(--stage-lost)" }}>{error}</div>}
    </div>
  );
}
