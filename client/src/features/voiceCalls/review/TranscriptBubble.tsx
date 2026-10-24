// One transcript line, the same in the live view and the review: the agent's lines are
// wine-tinted and sit left, the caller's are a neutral surface and sit right, so it is
// clear who speaks. An agent line ends with its reply delay ("≈ 0.8 s") when known.
// With `onClick` the line is a button (the review seeks the recording from it).
// `speaker` names the sides where "Agent" / "You" do not fit (the Calls page: caller, AI).
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatDelay } from "./reviewMath";

const mono = { fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute)" } as const;

export interface TranscriptBubbleProps {
  role: "user" | "agent";
  /** The words; the Calls page passes them with its search matches highlighted. */
  text: ReactNode;
  /** The side's name in the header; defaults to the test panel's "Agent" / "You". */
  speaker?: string;
  /** Reply delay in ms (agent lines); null or undefined shows none. */
  delayMs?: number | null;
  /** A time label in the header (the review shows m:ss). */
  time?: string;
  /** The line playing now (review). */
  active?: boolean;
  onClick?: () => void;
  title?: string;
  dataTurn?: number;
}

export function TranscriptBubble({ role, text, speaker, delayMs, time, active, onClick, title, dataTurn }: TranscriptBubbleProps) {
  const { t } = useTranslation("voiceTab");
  const agent = role === "agent";
  const style: CSSProperties = {
    display: "flex", flexDirection: "column", gap: 3, minWidth: 0, maxWidth: "92%", textAlign: "left",
    padding: "7px 10px", borderRadius: "var(--r-surface)", color: "var(--ink)",
    alignSelf: agent ? "flex-start" : "flex-end",
    background: agent ? "var(--wine-tint)" : "var(--surface)",
    border: `1px solid ${agent ? "color-mix(in srgb, var(--wine) 22%, transparent)" : "var(--line)"}`,
    outline: active ? "2px solid color-mix(in srgb, var(--wine) 55%, transparent)" : "none",
    outlineOffset: 1, transition: "outline-color 150ms, background-color 150ms",
    ...(onClick ? { cursor: "pointer", font: "inherit" } : null),
  };
  const body = (
    <>
      <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...mono, color: agent ? "var(--wine)" : "var(--mute)", fontWeight: 600 }}>
          {speaker ?? (agent ? t("test.eleven.agent") : t("test.eleven.you"))}
        </span>
        {time && <span style={{ ...mono, fontVariantNumeric: "tabular-nums" }}>{time}</span>}
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.45, overflowWrap: "anywhere" }}>{text}</span>
      {agent && delayMs != null && Number.isFinite(delayMs) && (
        <span style={{ ...mono, alignSelf: "flex-end", fontVariantNumeric: "tabular-nums" }} title={t("test.panel.live.delaysHint")} data-testid="voice-test-bubble-delay">
          {formatDelay(delayMs)}
        </span>
      )}
    </>
  );
  if (!onClick) return <div style={style} data-testid="voice-test-bubble" data-role={role}>{body}</div>;
  return (
    <button type="button" style={style} onClick={onClick} title={title} data-turn={dataTurn}
      aria-current={active || undefined} data-testid="voice-test-bubble" data-role={role}>
      {body}
    </button>
  );
}
