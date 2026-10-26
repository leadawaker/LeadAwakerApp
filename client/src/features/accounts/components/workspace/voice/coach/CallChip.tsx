// A call named as evidence (review problems, worst calls, change cards): who it was with (the
// lead's name, else the caller's number) and when, else the last 6 characters of its id. A click
// opens that call's review in the test panel.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cardAnchorId } from "../readiness";
import { isCallBusy, useOptionalVoiceTest } from "../test/VoiceTestProvider";
import { useCallLabels } from "./coachApi";

const CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: "var(--r-pill)",
  fontSize: 12, whiteSpace: "nowrap",
};
const TZ = "Europe/Amsterdam";

/** "Gabriel, 23 Oct 14:00": the name or number of the caller and the start time, or the id's tail. */
function useChipText(accountId: number, callId: string): string {
  const { i18n } = useTranslation();
  const labels = useCallLabels(accountId);
  const when = useMemo(() => {
    // The day first in every language ("23 Oct"): plain "en" would put the month first.
    const locale = i18n.language.toLowerCase().startsWith("en") ? "en-GB" : i18n.language;
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
  }, [i18n.language]);
  const label = labels.data?.get(callId);
  if (!label) return callId.slice(-6);
  const who = label.name ?? label.number;
  const at = when.format(new Date(label.startedAt));
  return who ? `${who}, ${at}` : at;
}

export function CallChip({ accountId, callId }: { accountId: number; callId: string }) {
  const { t } = useTranslation("voiceCoach");
  const test = useOptionalVoiceTest();
  const text = useChipText(accountId, callId);
  // Without a test panel (the Voice tab without Prompt & test) there is nothing to open.
  if (!test) return <span title={callId} style={{ ...CHIP_STYLE, color: "var(--mute)" }} data-testid="voice-call-chip">{text}</span>;

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
      aria-label={t("common.openCall", { id: text })}
      disabled={busy}
      onClick={open}
      data-testid="voice-call-chip"
    >
      {text}
    </button>
  );
}
