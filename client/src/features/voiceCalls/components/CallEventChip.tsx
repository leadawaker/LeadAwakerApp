import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pill } from "@/components/crm/primitives/Pill";
import type { VoiceCallEvent, VoiceCallTurn } from "../api/voiceCallsApi";

export type TimelineItem =
  | { type: "turn"; turn: VoiceCallTurn; index: number }
  | { type: "event"; event: VoiceCallEvent };

/** When a turn happened on the wall clock: its first words, else when it was written. */
const turnWall = (t: VoiceCallTurn) => {
  const iso = t.spokenAt ?? t.createdAt;
  return iso ? new Date(iso).getTime() : null;
};

/**
 * Turns with the call's events slotted in by time: each event goes before the
 * first turn that started after it. Turns keep their own order.
 */
export function mergeTimeline(turns: VoiceCallTurn[], events: VoiceCallEvent[]): TimelineItem[] {
  const queue = [...events].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const out: TimelineItem[] = [];
  let e = 0;
  turns.forEach((turn, index) => {
    const at = turnWall(turn);
    while (at != null && e < queue.length && new Date(queue[e].startedAt).getTime() < at) {
      out.push({ type: "event", event: queue[e++] });
    }
    out.push({ type: "turn", turn, index });
  });
  while (e < queue.length) out.push({ type: "event", event: queue[e++] });
  return out;
}

function seconds(ms: number | null): string | null {
  return ms == null ? null : `${(ms / 1000).toFixed(1)} s`;
}

function pick(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null;
  const v = (value as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  const text = JSON.stringify(value, null, 1);
  return text === "{}" ? null : text;
}

const STATUS_COLOR: Record<string, string> = {
  error: "var(--wine)",
  refused: "var(--wine)",
};

/** One tool call or backend delegation, as a small centred chip; click to see what went in and out. */
export function CallEventChip({ event }: { event: VoiceCallEvent }) {
  const { t } = useTranslation("voiceCalls");
  const [open, setOpen] = useState(false);
  const delegation = event.kind === "delegation";
  const status = event.error ? "error" : event.kind === "refused" ? "refused" : event.status;
  const label = delegation
    ? t("events.askedBackend")
    : [event.toolName ?? t("events.tool"), status ? t(`events.status.${status}`, { defaultValue: status }) : null]
        .filter(Boolean).join(" · ");
  const parts = [label, seconds(event.latencyMs)].filter(Boolean).join(" · ");

  const question = delegation ? pick(event.args, "question") : null;
  const answer = delegation ? pick(event.result, "answer") : null;
  const rows: [string, string | null][] = delegation
    ? [
        [t("events.question"), question ?? t("events.notCaptured")],
        [t("events.answer"), answer ?? (pick(event.result, "tool") ? t("events.answeredWithTool", { tool: pick(event.result, "tool") }) : t("events.noAnswer"))],
      ]
    : [[t("events.args"), asText(event.args)], [t("events.result"), asText(event.result)], [t("events.error"), event.error]];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "6px 0" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={t("events.toggle")}
        style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
      >
        <Pill color={status ? STATUS_COLOR[status] : undefined} style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>
          {parts}
        </Pill>
      </button>
      {open && (
        <div
          style={{
            marginTop: 6, maxWidth: "86%", padding: "8px 12px", borderRadius: 10, fontSize: 12, lineHeight: 1.45,
            background: "var(--card)", color: "var(--ink)", boxShadow: "0 0 0 1px var(--line)",
            display: "flex", flexDirection: "column", gap: 6,
          }}
        >
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--mute)", marginBottom: 2 }}>{k}</div>
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: delegation ? undefined : "var(--mono)", fontSize: delegation ? 12 : 11 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
