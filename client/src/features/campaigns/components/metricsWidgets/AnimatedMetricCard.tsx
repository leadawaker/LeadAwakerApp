import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// ── Count-up animation hook (private) ────────────────────────────────────────

function useCountUp(target: number, duration = 900, trigger = 0): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
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

export function AnimatedMetricCard({ numericValue, displayValue, label, animTrigger, borderColor, trendData }: {
  numericValue: number;
  displayValue: string;
  label: string;
  animTrigger: number;
  borderColor?: string;
  trendData?: number[];
}) {
  const isPercent = displayValue.endsWith("%");
  const isDash = displayValue === "—";
  const animated = useCountUp(isDash ? 0 : numericValue, 900, animTrigger);
  const display = isDash ? "—" : isPercent ? `${animated}%` : animated.toLocaleString();
  const showSparkline = trendData && trendData.length > 1;
  return (
    <div
      className={cn("rounded-xl bg-white dark:bg-white/[0.12] p-4 md:p-8 flex flex-col items-center justify-center text-center", borderColor && "border-t-2")}
      style={borderColor ? { borderTopColor: borderColor } : undefined}
    >
      <div className="text-[22px] md:text-[28px] font-black text-foreground tabular-nums leading-none">{display}</div>
      <div className="text-[10px] text-foreground/40 uppercase tracking-wider mt-1.5">{label}</div>
      {showSparkline && (
        <svg width="80" height="20" viewBox="0 0 80 20" className="mt-2 opacity-50">
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
      )}
    </div>
  );
}
