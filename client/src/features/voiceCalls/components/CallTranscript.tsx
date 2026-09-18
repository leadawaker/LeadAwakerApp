import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { MonoLabel } from "@/features/voice/components/atoms";
import type { VoiceCallTurn } from "../api/voiceCallsApi";
import { formatClock } from "../format";

/** Read-only call transcript: caller on the left (card), AI on the right (ink). */
export function CallTranscript({ turns }: { turns: VoiceCallTurn[] }) {
  const { t, i18n } = useTranslation("voiceCalls");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {turns.map((turn) => {
        const ai = turn.direction !== "inbound";
        return (
          <div
            key={turn.id}
            style={{ display: "flex", flexDirection: "column", alignItems: ai ? "flex-end" : "flex-start", gap: 4, maxWidth: "78%", alignSelf: ai ? "flex-end" : "flex-start" }}
          >
            <MonoLabel color={ai ? "var(--ink-soft)" : undefined}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {ai && <Sparkles size={9} />}
                {ai ? t("ai") : t("caller")}
              </span>
            </MonoLabel>
            <div
              style={{
                whiteSpace: "pre-wrap",
                borderRadius: ai ? "var(--r-card) var(--r-card) 4px var(--r-card)" : "var(--r-card) var(--r-card) var(--r-card) 4px",
                padding: "9px 13px", fontSize: 13.5, lineHeight: 1.5,
                background: ai ? "var(--ink)" : "var(--card)",
                color: ai ? "var(--paper)" : "var(--ink-soft)",
                boxShadow: ai ? "var(--sh-raised-crisp)" : "var(--sh-raised-crisp), inset 0 0 0 1px var(--line)",
              }}
            >
              {turn.content}
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", letterSpacing: "0.04em", padding: "0 2px" }}>
              {formatClock(turn.createdAt, i18n.language)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
