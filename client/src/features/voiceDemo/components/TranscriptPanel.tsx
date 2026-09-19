import { useEffect, useRef } from "react";
import type { EndedReason, Turn } from "../types";
import type { DemoCopy } from "../copy";

/**
 * The left panel during and after a call: the transcript, edge to edge.
 *
 * No header. The company, the clock and the hang-up all live on the phone's
 * screen now, and "call again" lives on the CRM panel that replaces the phone,
 * so a header here would only repeat them.
 *
 * Also deliberately missing: a floor indicator ("she's listening" / "she's
 * speaking") and per-turn pending dots. The phone's wave says everything
 * about who holds the floor that a prospect needs to know.
 */

const ENDED_KEY: Record<Exclude<EndedReason, null>, keyof DemoCopy> = {
  time_limit: "endedTimeLimit",
  dropped: "endedDropped",
  completed: "endedCompleted",
  silence: "endedSilence",
};

export function TranscriptPanel({
  turns,
  endedReason,
  error,
  copy,
}: {
  turns: Turn[];
  endedReason: EndedReason;
  error: string | null;
  copy: DemoCopy;
}) {
  /**
   * Follow the conversation. Deltas stream in a few characters at a time, so
   * this keys on the last turn's length as well as the count: a turn that is
   * still being written grows without ever adding a new bubble, and the
   * transcript would sit still while she talked.
   */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tail = turns.length ? turns[turns.length - 1].text.length : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, tail]);

  return (
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
      {turns.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">{copy.sayHello}</p>
      )}
      {turns.map((t) => (
        <div key={t.id} className={t.side === "you" ? "flex justify-end" : "flex justify-start"}>
          <div
            className={`max-w-[85%] rounded-[var(--r-surface)] px-3.5 py-2 text-sm ${
              t.side === "you" ? "bg-foreground text-background" : "border border-border/60 bg-background"
            }`}
          >
            {t.text}
          </div>
        </div>
      ))}
      {endedReason && (
        <p className="pt-2 text-center text-xs text-muted-foreground">{copy[ENDED_KEY[endedReason]]}</p>
      )}
      {error && <p className="pt-2 text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
