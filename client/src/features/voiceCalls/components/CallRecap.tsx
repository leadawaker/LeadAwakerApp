import { useTranslation } from "react-i18next";
import { Card, CardLabel } from "@/features/leads/components/cardView/designPrimitives";
import type { VoiceCallDetail } from "../api/voiceCallsApi";
import { CallSummaryBody } from "./CallSummaryBody";

/** Three weeks around the booked day, enough to read "that's next week". Fills its column. */
function MiniMonth({ date, locale }: { date: Date; locale: string }) {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7);
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const initials = days.slice(0, 7).map((d) => d.toLocaleDateString(locale, { weekday: "narrow" }));
  const cell: React.CSSProperties = { height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, fontSize: 12, fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, width: "100%" }}>
      {initials.map((d, i) => (
        <span key={`h${i}`} style={{ ...cell, height: 18, fontSize: 10, fontWeight: 700, color: "var(--mute-2)" }}>{d}</span>
      ))}
      {days.map((d) => {
        const booked = d.toDateString() === date.toDateString();
        const weekend = d.getDay() === 0 || d.getDay() === 6;
        return (
          <span
            key={d.toISOString()}
            style={{ ...cell, fontWeight: booked ? 700 : 400, background: booked ? "var(--good)" : "transparent", color: booked ? "var(--paper)" : weekend ? "var(--mute-2)" : "var(--ink-soft)", boxShadow: booked ? "var(--sh-raised-crisp)" : "none" }}
          >
            {d.getDate()}
          </span>
        );
      })}
    </div>
  );
}

/** The booked appointment: a mini calendar across the column, then the day and time. */
export function CallBooking({ call }: { call: VoiceCallDetail }) {
  const { t, i18n } = useTranslation("voiceCalls");
  if (!call.bookedSlot) return null;
  const when = call.bookedIso ? new Date(call.bookedIso) : null;
  return (
    <Card variant="flat" headLeft={<CardLabel>{t("sections.booked")}</CardLabel>} style={{ minWidth: 0 }} bodyStyle={{ padding: "14px 16px 18px" }}>
      {when ? (
        <>
          <MiniMonth date={when} locale={i18n.language} />
          <div style={{ marginTop: 14, fontSize: 16, fontWeight: 700, lineHeight: 1.25, color: "var(--ink)" }}>
            {when.toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--mute)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
            {when.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{call.bookedSlot}</div>
      )}
    </Card>
  );
}

/** The summary as its own raised block, above the conversation (Voice calls and Calendar). */
export function CallSummary({ call }: { call: VoiceCallDetail }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <div className="neu-raised" data-testid="voice-call-summary" style={{ flexShrink: 0, borderRadius: "var(--r-card)", background: "var(--card)", padding: "14px 18px 16px" }}>
      <div style={{ marginBottom: 8 }}><CardLabel>{t("sections.summary")}</CardLabel></div>
      <CallSummaryBody call={call} />
    </div>
  );
}

/** The summary as a flat section of the call's left panel, under the booking. */
export function CallSummaryCard({ call, divider }: { call: VoiceCallDetail; divider: boolean }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <Card
      variant="flat"
      headLeft={<CardLabel>{t("sections.summary")}</CardLabel>}
      style={{ minWidth: 0, borderTop: divider ? "1px solid var(--line)" : undefined }}
      bodyStyle={{ padding: "14px 16px 18px" }}
    >
      <CallSummaryBody call={call} />
    </Card>
  );
}

/** Booking plus summary in one flat column (the account Voice tab's test calls). */
export function CallRecap({ call }: { call: VoiceCallDetail }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <div style={{ minWidth: 0 }}>
      <CallBooking call={call} />
      <Card variant="flat" headLeft={<CardLabel>{t("sections.summary")}</CardLabel>} style={{ minWidth: 0, borderTop: call.bookedSlot ? "1px solid var(--line)" : undefined }} bodyStyle={{ padding: "14px 16px 18px" }}>
        <CallSummaryBody call={call} />
      </Card>
    </div>
  );
}
