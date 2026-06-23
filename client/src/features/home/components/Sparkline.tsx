import * as React from "react";

/**
 * Soft area + line sparkline — faithful port of the mockup's Sparkline.
 * Points are normalized 0..1; color comes from the caller (a service accent).
 * The line + area carry `spark-draw` / `spark-area` classes so they animate in
 * when an ancestor `.home-stage` gains `.shown` (see home.css). When
 * `interactive`, hovering reveals a crosshair + a tooltip with the per-day value
 * derived from `peak`.
 */
export function Sparkline({
  pts,
  color,
  width = 132,
  height = 46,
  strokeWidth = 2,
  full = false,
  dots = false,
  interactive = false,
  peak,
  suffix = "",
}: {
  pts: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** Stretch to 100% width (non-uniform scaling). */
  full?: boolean;
  /** Draw a faint dot on every point (not just the last). */
  dots?: boolean;
  /** Enable hover crosshair + value tooltip. */
  interactive?: boolean;
  /** The latest real value, used to label hovered points. */
  peak?: number;
  suffix?: string;
}) {
  const n = pts.length;
  const gid = React.useId().replace(/:/g, "");
  const [hi, setHi] = React.useState<number | null>(null);
  const toX = (i: number) => (i / (n - 1)) * width;
  const toY = (v: number) => height - 3 - v * (height - 8);
  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const lastV = pts[n - 1] || 1;

  const labelFor = (i: number) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    let val = "";
    if (peak != null && !Number.isNaN(peak)) {
      const num = peak * (pts[i] / lastV);
      val = (peak % 1 === 0 ? Math.round(num) : num.toFixed(1)) + (suffix || "");
    }
    return { date, val };
  };

  const svg = (
    <svg
      width={full ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={full ? "none" : "xMidYMid meet"}
      style={{ display: "block", overflow: "visible", width: full ? "100%" : width }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="spark-area" d={area} fill={`url(#${gid})`} />
      <path
        className="spark-draw"
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* last-point dot — always visible, no animation */}
      <circle cx={toX(n - 1)} cy={toY(pts[n - 1])} r={2.6} fill={color} />
      {dots &&
        pts.slice(0, -1).map((v, i) => <circle key={`pd${i}`} cx={toX(i)} cy={toY(v)} r={1.9} fill={color} opacity={0.45} />)}
      {interactive && hi != null && (
        <>
          <line
            x1={toX(hi)}
            y1={0}
            x2={toX(hi)}
            y2={height}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={toX(hi)} cy={toY(pts[hi])} r={3.6} fill={color} stroke="var(--card)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </>
      )}
      {interactive &&
        pts.map((v, i) => (
          <rect
            key={i}
            x={toX(i) - width / n / 2}
            y={0}
            width={width / n}
            height={height}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onMouseEnter={() => setHi(i)}
          />
        ))}
    </svg>
  );

  if (!interactive) return svg;
  const lbl = hi != null ? labelFor(hi) : null;
  return (
    <div style={{ position: "relative", width: full ? "100%" : width }} onMouseLeave={() => setHi(null)}>
      {svg}
      {lbl && hi != null && (
        <div
          style={{
            position: "absolute",
            left: `${(toX(hi) / width) * 100}%`,
            bottom: "calc(100% + 6px)",
            transform: "translateX(-50%)",
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "4px 8px",
            borderRadius: "var(--r-flush)",
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "var(--sh-raised-medium)",
            zIndex: 6,
          }}
        >
          <span style={{ opacity: 0.65 }}>{lbl.date}</span>
          {lbl.val ? <span style={{ fontWeight: 700 }}>{"  " + lbl.val}</span> : null}
        </div>
      )}
    </div>
  );
}
