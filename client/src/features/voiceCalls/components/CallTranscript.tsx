import { forwardRef, memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { VoiceCallTurn } from "../api/voiceCallsApi";
import { formatClock, formatDuration } from "../format";

/** Wraps each case-insensitive match of `query` in a highlight. */
function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(needle);
  while (at !== -1) {
    if (at > from) out.push(text.slice(from, at));
    out.push(
      <mark key={at} style={{ background: "var(--wine-tint)", color: "inherit", borderRadius: 3, padding: "0 1px", boxShadow: "0 0 0 1px var(--wine)" }}>
        {text.slice(at, at + q.length)}
      </mark>,
    );
    from = at + q.length;
    at = lower.indexOf(needle, from);
  }
  out.push(text.slice(from));
  return out;
}

/**
 * Read-only call transcript in the Chats bubble style: caller on the left
 * (inset), AI on the right (ink). Each side is named once, the first time it
 * speaks. When the recording is available each bubble shows where it starts
 * in the call and clicking that jumps the player there.
 */
export const CallTranscript = memo(forwardRef<HTMLDivElement, {
  turns: VoiceCallTurn[];
  times: (number | null)[] | null;
  active: number;
  query: string;
  onSeek: (seconds: number) => void;
}>(function CallTranscript({ turns, times, active, query, onSeek }, ref) {
  const { t, i18n } = useTranslation("voiceCalls");
  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {turns.map((turn, i) => {
        const ai = turn.direction !== "inbound";
        const prevAi = i > 0 ? turns[i - 1].direction !== "inbound" : null;
        const nextAi = i < turns.length - 1 ? turns[i + 1].direction !== "inbound" : null;
        const firstInRun = prevAi !== ai;
        const lastInRun = nextAi !== ai;
        // Name each side the first time it speaks; alignment carries it after.
        const firstOfSide = turns.findIndex((x) => (x.direction !== "inbound") === ai) === i;
        const at = times?.[i] ?? null;
        const isActive = i === active;
        const stampColor = ai ? "color-mix(in srgb, var(--paper) 65%, transparent)" : "var(--mute-2)";
        return (
          <div
            key={turn.id}
            data-turn={i}
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
                // Playing line: a white ring inside a thin dark edge, visible on both
                // the ink AI bubble and the see-through caller bubble.
                boxShadow: [isActive ? "inset 0 0 0 2px var(--paper), 0 0 0 1.5px var(--ink)" : null, ai ? null : "var(--sh-inset-crisp)"].filter(Boolean).join(", ") || "none",
                transition: "box-shadow 160ms",
              }}
            >
              {highlight(turn.content ?? "", query)}
              <div style={{ fontSize: 10, textAlign: "right", marginTop: 2, color: stampColor }}>
                {at != null ? (
                  <button
                    onClick={() => onSeek(at)}
                    title={t("playFromHere")}
                    style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "inherit", fontSize: 10, fontFamily: "var(--mono)", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 2 }}
                  >
                    {formatDuration(at)}
                  </button>
                ) : (
                  formatClock(turn.createdAt, i18n.language)
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}));
