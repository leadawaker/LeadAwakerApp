import * as React from "react";

/**
 * HBar — a single neumorphic horizontal percentage bar.
 *
 * An inset track with a token-colored fill whose width is the percentage. Used
 * by the Response-Time Distribution, Lead Sources, and channel-mix legend rows.
 * Pure CSS (no recharts) so it reads cleanly against the wine/neumorphic look
 * and animates the width on mount.
 */
export function HBar({
  pct,
  color,
  height = 8,
  max = 100,
}: {
  pct: number;
  color: string;
  height?: number;
  /** Scale the fill so `pct === max` fills the track (axis-aware bars). */
  max?: number;
}) {
  const width = `${Math.max(0, Math.min(100, (pct / max) * 100))}%`;
  return (
    <div
      style={{
        flex: 1,
        height,
        borderRadius: "var(--r-pill)",
        background: "var(--bg)",
        boxShadow: "var(--sh-inset-crisp)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width,
          height: "100%",
          borderRadius: "var(--r-pill)",
          background: color,
          transition: "width 600ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />
    </div>
  );
}
