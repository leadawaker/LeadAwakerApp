"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/** Blend a hex color toward white by `amount` (0 = original, 1 = white). */
function tintColor(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const tr = Math.round(r + (255 - r) * amount);
  const tg = Math.round(g + (255 - g) * amount);
  const tb = Math.round(b + (255 - b) * amount);
  return `rgb(${tr},${tg},${tb})`;
}

export interface DonutChartSegment {
  value: number;
  color: string;
  label: string;
  key?: string;
  [key: string]: any;
}

interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: DonutChartSegment[];
  totalValue?: number;
  size?: number;
  strokeWidth?: number;
  animationDuration?: number;
  animationDelayPerSegment?: number;
  /** The key of the currently active (highlighted) segment. Null = none. */
  activeKey?: string | null;
  centerContent?: React.ReactNode;
  onSegmentHover?: (segment: DonutChartSegment | null) => void;
  onSegmentClick?: (segment: DonutChartSegment) => void;
  /** Called when clicking the background (gap/center) — use to deselect */
  onBackgroundClick?: () => void;
}

const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>(
  (
    {
      data,
      totalValue: propTotalValue,
      size = 200,
      strokeWidth = 20,
      animationDuration = 1,
      animationDelayPerSegment = 0.05,
      activeKey,
      centerContent,
      onSegmentHover,
      onSegmentClick,
      onBackgroundClick,
      className,
      ...props
    },
    ref
  ) => {
    const internalTotalValue = React.useMemo(
      () =>
        propTotalValue || data.reduce((sum, segment) => sum + segment.value, 0),
      [data, propTotalValue]
    );

    const radius = size / 2 - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;

    // Pre-compute segment positions so we can render in reverse z-order
    // (last segment on top so rounded caps layer correctly)
    let cumulativePercentage = 0;
    const segments = data
      .filter((s) => s.value > 0)
      .map((segment, index) => {
        const percentage =
          internalTotalValue === 0
            ? 0
            : (segment.value / internalTotalValue) * 100;
        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
        const strokeDashoffset = (cumulativePercentage / 100) * circumference;
        const segKey = segment.key ?? segment.label ?? String(index);
        cumulativePercentage += percentage;
        return { segment, index, percentage, strokeDasharray, strokeDashoffset, segKey };
      });

    return (
      <div
        ref={ref}
        className={cn("relative flex items-center justify-center", className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          onMouseLeave={() => onSegmentHover?.(null)}
        >
          {/* Invisible full-area rect — catches clicks on the gap/center to deselect */}
          <rect
            x={0}
            y={0}
            width={size}
            height={size}
            fill="transparent"
            onClick={onBackgroundClick}
            style={{ cursor: "default" }}
          />

          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"}
            strokeWidth={strokeWidth}
            style={{ pointerEvents: "none" }}
          />

          {/* Segments rendered first-to-last so each cap layers over the previous gap.
              pointerEvents="stroke" keeps hit-testing tight to the painted arc only. */}
          <AnimatePresence>
            {segments.map(({ segment, index, strokeDasharray, strokeDashoffset, segKey }) => {
              const isActive = activeKey != null && activeKey === segKey;
              const isDimmed = activeKey != null && !isActive;

              return (
                <motion.circle
                  key={segKey}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={-strokeDashoffset}
                  strokeLinecap="round"
                  initial={{ opacity: 0, strokeDashoffset: circumference, stroke: segment.color }}
                  animate={{
                    opacity: 1,
                    strokeDashoffset: -strokeDashoffset,
                    stroke: isDimmed ? tintColor(segment.color, 0.72) : segment.color,
                  }}
                  transition={{
                    opacity: { duration: 0.15 },
                    stroke: { duration: 0.15 },
                    strokeDashoffset: {
                      duration: animationDuration,
                      delay: index * animationDelayPerSegment,
                      ease: "easeOut",
                    },
                  }}
                  className="origin-center cursor-pointer"
                  style={{
                    pointerEvents: "stroke",
                  }}
                  onMouseEnter={() => onSegmentHover?.(segment)}
                  onMouseLeave={() => onSegmentHover?.(null)}
                  onClick={(e) => { e.stopPropagation(); onSegmentClick?.(segment); }}
                />
              );
            })}
          </AnimatePresence>
        </svg>

        {centerContent && (
          <div
            className="absolute flex flex-col items-center justify-center pointer-events-none"
            style={{
              width: size - strokeWidth * 2.5,
              height: size - strokeWidth * 2.5,
            }}
          >
            {centerContent}
          </div>
        )}
      </div>
    );
  }
);

DonutChart.displayName = "DonutChart";

export { DonutChart };
