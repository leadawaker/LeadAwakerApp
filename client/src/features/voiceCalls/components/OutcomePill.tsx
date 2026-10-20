import { useTranslation } from "react-i18next";
import { Pill } from "@/components/crm/primitives";
import type { VoiceOutcome } from "../api/voiceCallsApi";
import { normalizeOutcome, OUTCOME_LABEL_KEY, outcomeColors } from "../status";

/** "Thu 14:30" from the booked timestamp, else whatever text the call stored. */
export function slotLabel(bookedIso: string | null | undefined, bookedSlot: string | null | undefined, locale: string): string | null {
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
  /** Shown before the outcome inside the pill, e.g. "Call 3". */
  prefix?: string;
}

/** What the call amounted to, as a pill. Booked calls carry their slot inside it. */
export function OutcomePill({ outcome, bookedSlot, bookedIso, small, prefix }: Props) {
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
        boxShadow: c.inset ? "var(--sh-inset-super-crisp)" : c.ring ? `inset 0 0 0 1px ${c.ring}` : "none",
        fontFamily: "var(--mono)", fontSize: small ? 9 : 10, fontWeight: 700,
        letterSpacing: "0.12em", textTransform: "uppercase",
        padding: small ? "4px 8px" : "5px 10px",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.text, flexShrink: 0 }} />
      {prefix && <span>{`${prefix} ·`}</span>}
      {t(`outcomes.${OUTCOME_LABEL_KEY[key]}`)}
      {slot && <span style={{ fontWeight: 600, letterSpacing: "0.04em" }}>{`· ${slot}`}</span>}
    </Pill>
  );
}
