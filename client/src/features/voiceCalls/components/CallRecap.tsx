import { useTranslation } from "react-i18next";
import { Card, CardLabel } from "@/features/leads/components/cardView/designPrimitives";
import type { VoiceCallDetail } from "../api/voiceCallsApi";

/** Three weeks around the booked day, enough to read "that's next week". */
function MiniMonth({ date, locale }: { date: Date; locale: string }) {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7);
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const initials = days.slice(0, 7).map((d) => d.toLocaleDateString(locale, { weekday: "narrow" }));
  const cell: React.CSSProperties = { width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, fontSize: 10.5, fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 22px)", gap: 3 }}>
      {initials.map((d, i) => (
        <span key={`h${i}`} style={{ ...cell, height: 16, fontSize: 9, fontWeight: 700, color: "var(--mute-2)" }}>{d}</span>
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

/** Right-hand column: when they booked and what they asked for. */
export function CallRecap({ call }: { call: VoiceCallDetail }) {
  const { t, i18n } = useTranslation("voiceCalls");
  const when = call.bookedIso ? new Date(call.bookedIso) : null;
  const items = call.summary?.items ?? [];

  return (
    <Card variant="flat" headLeft={<CardLabel>{t("sections.recap")}</CardLabel>} style={{ flex: 1, minWidth: 0 }} bodyStyle={{ overflowY: "auto" }}>
      {call.bookedSlot && (
        <section style={{ padding: "16px 16px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--good)", marginBottom: 10 }}>{t("sections.booked")}</div>
          {when ? (
            <>
              <MiniMonth date={when} locale={i18n.language} />
              <div style={{ marginTop: 12, fontFamily: "var(--serif)", fontSize: 17, lineHeight: 1.25, color: "var(--ink)" }}>
                {when.toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <div style={{ fontSize: 13, color: "var(--mute)", marginTop: 2 }}>
                {when.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: 1.5, color: "var(--mute-2)" }}>
                “{call.bookedSlot}”
              </p>
            </>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{call.bookedSlot}</div>
          )}
        </section>
      )}

      <section style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 4 }}>{t("sections.wanted")}</div>
        {items.length === 0 ? (
          <p style={{ margin: "6px 0 12px", fontSize: 13, lineHeight: 1.55, color: "var(--mute)" }}>{t("noSummary")}</p>
        ) : (
          items.map((item, i) => (
            <div key={i} style={{ padding: "10px 0 12px", borderTop: i ? "1px solid var(--line)" : "none" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wine)", marginBottom: 4 }}>
                {t(`intents.${item.intent}`, { defaultValue: item.intent })}
              </div>
              {item.interest && (
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--ink)" }}>{item.interest}</p>
              )}
              {item.notes && (
                <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--mute)" }}>{item.notes}</p>
              )}
            </div>
          ))
        )}
      </section>
    </Card>
  );
}
