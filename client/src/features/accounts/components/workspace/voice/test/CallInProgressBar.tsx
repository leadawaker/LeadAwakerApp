// Below the wide breakpoint the test panel lives in Prompt & test; a call keeps
// running when another section is opened, and this bar says so at the top of it,
// with a way back to the panel and a Hang up.
import { useTranslation } from "react-i18next";
import { PhoneOff } from "lucide-react";
import { isCallBusy, useOptionalVoiceTest } from "./VoiceTestProvider";

export function CallInProgressBar({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation("voiceTab");
  const test = useOptionalVoiceTest();
  if (!test || !isCallBusy(test.phase)) return null;
  const { phase } = test;

  return (
    <div
      className="neu-inset-crisp" role="status" data-testid="voice-test-in-progress"
      style={{ borderRadius: "var(--r-card)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--wine)", flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>
        {t("test.panel.inProgress")}
        <span style={{ marginLeft: 8, fontWeight: 400, color: "var(--mute)" }}>{t(`test.panel.phase.${phase}`)}</span>
      </span>
      <button type="button" className="la-btn la-btn--soft" onClick={onOpen} data-testid="voice-test-in-progress-open">
        {t("test.panel.openPanel")}
      </button>
      <button type="button" className="la-btn la-btn--wine" onClick={test.hangup} disabled={phase === "ending"} data-testid="voice-test-in-progress-hangup">
        <PhoneOff size={14} />
        {t("test.panel.hangUp")}
      </button>
    </div>
  );
}
