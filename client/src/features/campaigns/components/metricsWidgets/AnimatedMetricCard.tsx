import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// ── Count-up animation hook (private) ────────────────────────────────────────

function useCountUp(target: number, duration = 900, trigger = 0): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  // Latest displayed value — the animation starts from here so switching
  // timeframes tweens from the current number to the new one (e.g. 5 → 10)
  // instead of always restarting at 0.
  const valueRef = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const from = valueRef.current;
    if (from === target) return; // nothing to animate
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (target - from) * eased);
      valueRef.current = next;
      setValue(next);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, trigger]);
  return value;
}

// ── AnimatedMetricCard ────────────────────────────────────────────────────────

export function AnimatedMetricCard({ numericValue, displayValue, label, animTrigger, borderColor, trendData, star = false }: {
  numericValue: number;
  displayValue: string;
  label: string;
  animTrigger: number;
  borderColor?: string;
  trendData?: number[];
  /** North-star highlight — gold ring + warm gradient (matches the design's Booked card). */
  star?: boolean;
}) {
  const isPercent = displayValue.endsWith("%");
  const isDash = displayValue === "—";
  const animated = useCountUp(isDash ? 0 : numericValue, 900, animTrigger);
  const numberText = isDash ? "—" : isPercent ? `${animated}` : animated.toLocaleString();
  const showSparkline = trendData && trendData.length > 1;
  return (
    <div
      className={cn("neu-raised-crisp flex flex-col")}
      style={{
        padding: "10px 14px 8px",
        borderRadius: "var(--r-surface)",
        position: "relative",
        overflow: "hidden",
        background: star ? "linear-gradient(160deg, var(--warn-tint), var(--card) 60%)" : "var(--card)",
        boxShadow: star ? "var(--sh-raised-crisp), inset 0 0 0 1.5px rgba(196,138,47,0.5)" : undefined,
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span className="eyebrow eyebrow-sm">{label}</span>
        {star && <span style={{ fontSize: 12, color: "var(--stage-booked)", fontWeight: 600 }}>★</span>}
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 4, marginTop: 6 }}>
        <span className="serif" style={{ fontSize: 32, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.02em" }}>{numberText}</span>
        {isPercent && !isDash && <span style={{ fontSize: 14, color: "var(--mute)" }}>%</span>}
      </div>
      {showSparkline ? (
        <svg width="100%" height="10" viewBox="0 0 80 20" preserveAspectRatio="none" style={{ marginTop: 4, color: borderColor || "var(--mute)", opacity: 0.7 }}>
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={(() => {
              const min = Math.min(...trendData);
              const max = Math.max(...trendData);
              const range = max - min || 1;
              return trendData
                .map((v, i) => {
                  const x = (i / (trendData.length - 1)) * 80;
                  const y = 18 - ((v - min) / range) * 16;
                  return `${x},${y}`;
                })
                .join(" ");
            })()}
          />
        </svg>
      ) : (
        <div style={{ marginTop: 10, height: 20 }} />
      )}
    </div>
  );
}
