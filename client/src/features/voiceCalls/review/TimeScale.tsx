// The time scale under the review's waveform: round ticks for the part of the call in view
// (it follows zoom and scroll), the tick the playhead last passed in the lighter chart wine. Clicking the
// scale seeks there.
import type { MouseEvent } from "react";
import { formatTime, scaleTicks } from "./reviewMath";

const EPS = 1e-6;

export function TimeScale({ startS, endS, currentS, onSeek }: {
  startS: number; endS: number; currentS: number; onSeek: (s: number) => void;
}) {
  const { step, ticks } = scaleTicks(startS, endS);
  const span = endS - startS;
  if (ticks.length === 0 || span <= 0) return <div style={{ height: 22 }} />;
  const activeAt = Math.floor((currentS + EPS) / step) * step;
  const pct = (s: number) => ((s - startS) / span) * 100;
  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (box.width > 0) onSeek(startS + ((e.clientX - box.left) / box.width) * span);
  };

  return (
    <div onClick={seek} aria-hidden data-testid="voice-test-review-scale"
      style={{ position: "relative", height: 22, cursor: "pointer", borderTop: "1px solid var(--line)" }}>
      {ticks.map((s) => {
        const on = Math.abs(s - activeAt) < EPS;
        const left = pct(s);
        // The first and last labels stay inside the track.
        const shift = left < 4 ? "0" : left > 96 ? "-100%" : "-50%";
        return (
          <span key={s} style={{ position: "absolute", top: 0, left: `${left}%`, transform: `translateX(${shift})`, display: "flex", flexDirection: "column", alignItems: shift === "0" ? "flex-start" : shift === "-100%" ? "flex-end" : "center" }}>
            <span style={{ width: on ? 2 : 1, height: on ? 6 : 4, background: on ? "hsl(var(--chart-wine))" : "var(--mute-2)", borderRadius: 1 }} />
            <span style={{
              fontFamily: "var(--mono)", fontSize: 9.5, lineHeight: "14px", fontVariantNumeric: "tabular-nums",
              color: on ? "hsl(var(--chart-wine))" : "var(--mute-2)", fontWeight: on ? 700 : 400, transition: "color 150ms",
            }}>
              {formatTime(s)}
            </span>
          </span>
        );
      })}
    </div>
  );
}
