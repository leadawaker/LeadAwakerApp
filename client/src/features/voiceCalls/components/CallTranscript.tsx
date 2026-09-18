import { useTranslation } from "react-i18next";
import type { VoiceCallTurn } from "../api/voiceCallsApi";
import { formatClock } from "../format";

/**
 * Read-only call transcript in the Chats bubble style: caller on the left
 * (inset), AI on the right (ink). Each side is named once, the first time it
 * speaks.
 */
export function CallTranscript({ turns }: { turns: VoiceCallTurn[] }) {
  const { t, i18n } = useTranslation("voiceCalls");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {turns.map((turn, i) => {
        const ai = turn.direction !== "inbound";
        const prevAi = i > 0 ? turns[i - 1].direction !== "inbound" : null;
        const nextAi = i < turns.length - 1 ? turns[i + 1].direction !== "inbound" : null;
        const firstInRun = prevAi !== ai;
        const lastInRun = nextAi !== ai;
        // Name each side the first time it speaks; alignment carries it after.
        const firstOfSide = turns.findIndex((x) => (x.direction !== "inbound") === ai) === i;
        return (
          <div
            key={turn.id}
            style={{ display: "flex", flexDirection: "column", alignItems: ai ? "flex-end" : "flex-start", marginTop: firstInRun && i > 0 ? 14 : 0 }}
          >
            {firstOfSide && (
              <span style={{ fontSize: 11, fontWeight: 600, color: ai ? "var(--ink-soft)" : "var(--mute)", margin: "0 4px 4px" }}>
                {ai ? t("ai") : t("caller")}
              </span>
            )}
            <div
              style={{
                maxWidth: "78%",
                whiteSpace: "pre-wrap",
                padding: "8px 12px 6px",
                fontSize: 13.5,
                lineHeight: 1.5,
                borderRadius: ai
                  ? `13px ${firstInRun ? 13 : 5}px ${lastInRun ? 3 : 5}px 13px`
                  : `${firstInRun ? 13 : 5}px 13px 13px ${lastInRun ? 3 : 5}px`,
                background: ai ? "var(--ink)" : "transparent",
                color: ai ? "var(--paper)" : "var(--ink-soft)",
                boxShadow: ai ? "none" : "var(--sh-inset-crisp)",
              }}
            >
              {turn.content}
              <div style={{ fontSize: 10, textAlign: "right", marginTop: 2, color: ai ? "color-mix(in srgb, var(--paper) 65%, transparent)" : "var(--mute-2)" }}>
                {formatClock(turn.createdAt, i18n.language)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
