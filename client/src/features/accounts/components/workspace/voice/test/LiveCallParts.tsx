// The pieces of the live view (LiveCallView): the section frame, the compact tool tag row
// and the transcript with the tools inline. Presentational: the view decides what to pass.
// Newest entry on top.
import { useMemo, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { newestFirst, pairAgentDelays, shortText, type LiveToolRow } from "./liveMetrics";
import { insertToolsAfterLines } from "@/features/voiceCalls/review/toolTags";
import { ToolLine, ToolTag } from "@/features/voiceCalls/review/ToolTag";
import { TranscriptBubble } from "@/features/voiceCalls/review/TranscriptBubble";
import { useFitInColumn } from "@/features/voiceCalls/review/useFitInColumn";
import { useOptionalVoiceTest } from "./VoiceTestProvider";

export function LiveSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span className="eyebrow eyebrow-sm" title={hint}>{title}</span>
      {children}
    </section>
  );
}

const empty = { margin: 0, fontSize: 12.5, color: "var(--mute)" } as const;

/** Every tool that ran, as tags in one wrapping row (newest first). The details are in the transcript. */
export function LiveToolTags({ tools }: { tools: LiveToolRow[] }) {
  const { t } = useTranslation("voiceTab");
  if (tools.length === 0) return <p style={empty}>{t("test.panel.live.toolsEmpty")}</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 84, overflowY: "auto" }} data-testid="voice-test-live-tools">
      {newestFirst(tools).map((x) => (
        <ToolTag key={x.id} name={x.name} ms={x.ms} pending={x.pending} failed={x.failed} compact />
      ))}
    </div>
  );
}

export interface TranscriptLine { role: "user" | "agent"; text: string }

/**
 * Grows with the conversation, then scrolls: in the wide column up to the height left
 * below the rest of the panel (one scrollbar), inline up to most of the viewport.
 * No well of its own: the live view around it is already inset. Each agent line ends with
 * its reply delay; a tool sits right after the line that was last when it fired.
 */
export function LiveTranscript({ lines, tools, delaysMs }: { lines: TranscriptLine[]; tools: LiveToolRow[]; delaysMs: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const column = useOptionalVoiceTest()?.column ?? false;
  const maxHeight = useFitInColumn(ref, column, "max(260px, calc(100dvh - 340px))");
  const items = useMemo(() => {
    const delays = pairAgentDelays(lines, delaysMs);
    const withDelay = lines.map((l, i) => ({ ...l, delayMs: delays[i] }));
    const placed = tools.map((tool) => ({ tool, afterLines: tool.afterLines ?? lines.length }));
    return newestFirst(insertToolsAfterLines(withDelay, placed));
  }, [lines, tools, delaysMs]);
  return (
    <div ref={ref} data-testid="voice-test-live-transcript"
      style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight, overflowY: "auto" }}>
      {items.map((it) => it.kind === "turn"
        ? <TranscriptBubble key={`turn-${it.key}`} role={it.turn.role} text={it.turn.text} delayMs={it.turn.delayMs} />
        : (
          <ToolLine key={`tool-${it.tool.tool.id}`}
            tool={{ ...it.tool.tool, title: [shortText(it.tool.tool.args), it.tool.tool.result].filter((x) => x && x !== "{}").join("\n") || undefined }} />
        ))}
    </div>
  );
}
