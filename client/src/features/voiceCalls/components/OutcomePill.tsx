import { useTranslation } from "react-i18next";
import { Pill } from "@/components/crm/primitives";
import type { VoiceOutcome } from "../api/voiceCallsApi";
import { normalizeOutcome, OUTCOME_LABEL_KEY, outcomeColors } from "../status";

/** "Thu 14:30" from the booked timestamp, else whatever text the call stored. */
function slotLabel(bookedIso: string | null | undefined, bookedSlot: string | null | undefined, locale: string): string | null {
  if (bookedIso) {
    const d = new Date(bookedIso);
    if (!Number.isNaN(d.getTime())) {
      const day = d.toLocaleDateString(locale, { weekday: "short" });
      const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      return `${day} ${time}`;
    }
  }
  return bookedSlot || null;
}

interface Props {
  outcome: VoiceOutcome | string | null | undefined;
  bookedSlot?: string | null;
  bookedIso?: string | null;
  small?: boolean;
}

/** What the call amounted to, as a pill. Booked calls carry their slot inside it. */
export function OutcomePill({ outcome, bookedSlot, bookedIso, small }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  const key = normalizeOutcome(outcome);
  const c = outcomeColors(key);
  const slot = key === "booked" ? slotLabel(bookedIso, bookedSlot, i18n.language) : null;
  return (
    <Pill
      data-testid="voice-outcome-pill"
      data-outcome={key}
      style={{
        gap: 6, flexShrink: 0, background: c.bg, color: c.text,
        boxShadow: c.inset ? "var(--sh-inset-crisp)" : "none",
        fontFamily: "var(--mono)", fontSize: small ? 8 : 9, fontWeight: 700,
        letterSpacing: "0.12em", textTransform: "uppercase",
        padding: small ? "3px 7px" : "4px 9px",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.text, flexShrink: 0 }} />
      {t(`outcomes.${OUTCOME_LABEL_KEY[key]}`)}
      {slot && <span style={{ fontWeight: 600, letterSpacing: "0.04em" }}>{`· ${slot}`}</span>}
    </Pill>
  );
}
