import { useTranslation } from "react-i18next";
import { callOutcomeStatus, StatusPill } from "@/components/crm/status/StatusPill";
import type { VoiceOutcome } from "../api/voiceCallsApi";
import { normalizeOutcome } from "../status";

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
  /** No dot, smaller text: the list cards. */
  bare?: boolean;
}

/** What the call amounted to, as the shared status pill. Booked calls carry their slot inside it. */
export function OutcomePill({ outcome, bookedSlot, bookedIso, small, prefix, bare }: Props) {
  const { i18n } = useTranslation("voiceCalls");
  const status = callOutcomeStatus(normalizeOutcome(outcome));
  const slot = status === "booked" ? slotLabel(bookedIso, bookedSlot, i18n.language) : null;
  return <StatusPill status={status} detail={slot} small={small} prefix={prefix} bare={bare} />;
}
