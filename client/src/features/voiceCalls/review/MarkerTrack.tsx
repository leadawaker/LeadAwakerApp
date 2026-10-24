// The tool markers on an empty track: the recording is missing, still loading, or could
// not be played. Each marker seeks (moves the cursor) to when its tool ran.
import { toolTag } from "./toolTags";
import { useToolLabel } from "./useToolLabel";
import { formatTime, markerLeftPct, type ReviewTool } from "./reviewMath";

export function MarkerTrack({ tools, durationS, currentS, onSeek }: { tools: ReviewTool[]; durationS: number; currentS: number; onSeek: (s: number) => void }) {
  const labelOf = useToolLabel();
  return (
    <div className="neu-inset-super-crisp" style={{ position: "relative", height: 52, borderRadius: "var(--r-flush)", overflow: "hidden" }} data-testid="voice-test-review-empty-track">
      <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "var(--line-strong)" }} />
      {tools.map((x, i) => {
        const pct = markerLeftPct(x.atS, durationS);
        // Labels past the middle hang to the left of their line, so they stay inside the track.
        const flip = pct > 60;
        const tag = toolTag(x.name);
        const label = labelOf(tag);
        return (
          <button key={i} type="button" onClick={() => onSeek(x.atS)} title={`${label} ${formatTime(x.atS)}`}
            style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "flex", alignItems: "flex-start", transform: flip ? "translateX(-100%)" : undefined, flexDirection: flip ? "row-reverse" : "row" }}>
            <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: flip ? undefined : 0, right: flip ? 0 : undefined, width: 1.5, background: tag.tone }} />
            <span style={{ font: "600 10px var(--mono)", color: `color-mix(in srgb, ${tag.tone} 78%, var(--ink))`, background: `color-mix(in srgb, ${tag.tone} 14%, var(--card))`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tag.tone} 35%, transparent)`, borderRadius: "var(--r-pill)", padding: "0 6px", margin: flip ? "3px 3px 0 0" : "3px 0 0 3px", whiteSpace: "nowrap" }}>{label}</span>
          </button>
        );
      })}
      <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, width: 1.5, left: `${markerLeftPct(currentS, durationS)}%`, background: "var(--ink)", pointerEvents: "none" }} />
    </div>
  );
}
