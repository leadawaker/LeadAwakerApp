// The call review's transcript, in call order (it follows the timeline), with the tools
// at the moment they ran, as tags. Every line seeks the recording to its time; the line
// that is playing is marked and kept in view inside the list (never by scrolling the
// page). Same bubbles as the live view: agent wine-tinted, caller neutral, an agent line
// ends with its reply delay.
//
// The Calls page adds: `query` (search matches highlighted), `speakers` (caller / AI
// instead of you / agent), `extras` (lines that are not turns or tools, placed by time:
// booking receipts, agency delegation chips), `fill` (the list takes its parent's height)
// and `follow` + `onUserScroll` (scrolling by hand stops keeping the playing line in view).
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useFitInColumn } from "./useFitInColumn";
import { activeTurnIndex, formatTime, type ReviewTool, type ReviewTurn } from "./reviewMath";
import { insertToolsByTime } from "./toolTags";
import { ToolLine } from "./ToolTag";
import { useToolDetail } from "./useToolDetail";
import { TranscriptBubble } from "./TranscriptBubble";
import { highlight } from "./highlight";

const label = { fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute)", width: 34, flexShrink: 0 } as const;

/** A line that is neither a turn nor a tool, at `atS` seconds into the recording. */
export interface TranscriptExtra { atS: number; key: string; node: ReactNode }

type Slot = { atS: number; tool?: ReviewTool; extra?: TranscriptExtra };

export interface ReviewTranscriptProps {
  turns: ReviewTurn[];
  tools: ReviewTool[];
  currentS: number;
  onSeek: (s: number) => void;
  column: boolean;
  /** The engine may still be writing the transcript (stillProcessing): no "nothing was said" yet. */
  processing?: boolean;
  query?: string;
  speakers?: { agent: string; user: string };
  extras?: TranscriptExtra[];
  fill?: boolean;
  /** Keep the playing line in view (default true). */
  follow?: boolean;
  /** While the recording plays: the line playing now stands out, the rest fades. */
  focus?: boolean;
  onUserScroll?: () => void;
}

const FADED = { opacity: 0.42, transition: "opacity 200ms" } as const;

export function ReviewTranscript({
  turns, tools, currentS, onSeek, column, processing = false, query = "", speakers, extras, fill = false, follow = true, focus = false, onUserScroll,
}: ReviewTranscriptProps) {
  const { t } = useTranslation("voiceTab");
  const listRef = useRef<HTMLDivElement>(null);
  const detailOf = useToolDetail();
  const items = useMemo(() => {
    const slots: Slot[] = [...tools.map((tool) => ({ atS: tool.atS, tool })), ...(extras ?? []).map((extra) => ({ atS: extra.atS, extra }))];
    return insertToolsByTime(turns, slots);
  }, [turns, tools, extras]);
  const fitted = useFitInColumn(listRef, column && !fill, "360px", items.length > 0);
  const maxHeight = fill ? undefined : fitted;

  const active = activeTurnIndex(turns, currentS);
  const activeI = active >= 0 ? turns[active].i : null;
  const fading = focus && activeI !== null;

  // Keep the playing line in view by scrolling the list only.
  useEffect(() => {
    const box = listRef.current;
    if (!box || activeI === null || !follow) return;
    const row = box.querySelector<HTMLElement>(`[data-turn="${activeI}"]`);
    if (!row) return;
    const top = row.offsetTop; // the list is the rows' offsetParent (position: relative)
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = Math.max(0, top - box.clientHeight / 3);
    }
  }, [activeI, follow]);

  if (items.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }} data-testid={processing ? "voice-test-review-processing" : undefined}>
        {t(processing ? "test.panel.review.transcriptProcessing" : "test.panel.review.transcriptEmpty")}
      </p>
    );
  }

  return (
    <div ref={listRef} onWheel={onUserScroll} onTouchMove={onUserScroll}
      style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight, overflowY: "auto", position: "relative", padding: 3, ...(fill ? { flex: 1, minHeight: 0 } : null) }}
      data-testid="voice-test-review-transcript">
      {items.map((item) => {
        if (item.kind === "tool") {
          const slot = item.tool;
          if (slot.extra) return <div key={`extra-${slot.extra.key}`} style={fading ? FADED : undefined}>{slot.extra.node}</div>;
          const x = slot.tool as ReviewTool;
          return (
            <div key={`tool-${item.key}`} style={fading ? FADED : undefined}>
              <ToolLine onClick={() => onSeek(x.atS)} detail={detailOf(x)}
                tool={{ name: x.name, result: x.result, ms: x.ms, title: [x.args, x.result].filter(Boolean).join("\n") || undefined }}
                lead={<span style={label}>{formatTime(x.atS)}</span>} />
            </div>
          );
        }
        const turn = item.turn;
        return (
          <TranscriptBubble key={`turn-${turn.i}`} role={turn.role} text={query ? highlight(turn.text, query) : turn.text} delayMs={turn.delayMs}
            speaker={speakers ? speakers[turn.role] : undefined}
            time={formatTime(turn.atS)} active={turn.i === activeI} faded={fading && turn.i !== activeI} dataTurn={turn.i} onClick={() => onSeek(turn.atS)}
            title={t("test.panel.review.seekTo", { time: formatTime(turn.atS) })} />
        );
      })}
    </div>
  );
}
