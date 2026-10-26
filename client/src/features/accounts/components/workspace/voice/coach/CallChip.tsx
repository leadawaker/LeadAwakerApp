// A call named as evidence (review problems, worst calls, change cards): the last 6
// characters of its id, a click opens that call's review in the test panel.
import { useTranslation } from "react-i18next";
import { cardAnchorId } from "../readiness";
import { isCallBusy, useOptionalVoiceTest } from "../test/VoiceTestProvider";

const CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: "var(--r-pill)",
  fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em",
};

export function CallChip({ callId }: { callId: string }) {
  const { t } = useTranslation("voiceCoach");
  const test = useOptionalVoiceTest();
  const short = callId.slice(-6);
  // Without a test panel (the Voice tab without Prompt & test) there is nothing to open.
  if (!test) return <span title={callId} style={{ ...CHIP_STYLE, color: "var(--mute)" }} data-testid="voice-call-chip">{short}</span>;

  const open = () => {
    test.openReview(callId);
    // Below the wide layout the panel sits in the Test card, further up: bring it into view.
    if (test.column) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => document.getElementById(cardAnchorId("test"))?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  };

  const busy = isCallBusy(test.phase);
  return (
    <button
      type="button"
      className="neu-raised-crisp min-h-[36px] md:min-h-[26px] text-[color:var(--ink-soft)] hover:text-[color:var(--wine)]"
      style={{ ...CHIP_STYLE, border: "none", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, transition: "color 120ms, opacity 120ms" }}
      title={callId}
      aria-label={t("common.openCall", { id: short })}
      disabled={busy}
      onClick={open}
      data-testid="voice-call-chip"
    >
      {short}
    </button>
  );
}
