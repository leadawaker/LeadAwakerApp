import React from "react";
import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";

export type SparklineDataPoint = {
  date: string;
  value: number;
};

interface KpiSparklineProps {
  data: SparklineDataPoint[];
  color?: string;
  height?: number;
  showTooltip?: boolean;
  gradientId?: string;
}

/**
 * A minimal sparkline chart for KPI cards.
 * Shows trend over time with a subtle area fill.
 */
export function KpiSparkline({
  data,
  color = "#3b82f6",
  height = 32,
  showTooltip = true,
  gradientId,
}: KpiSparklineProps) {
  if (!data || data.length < 2) return null;

  // Generate unique gradient ID to avoid SVG conflicts when multiple sparklines render
  var gId = gradientId || ("sparkline-grad-" + Math.random().toString(36).slice(2, 8));

  return (
    <div style={{ width: "100%", height: height }} data-testid="kpi-sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showTooltip && (
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                backgroundColor: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                fontSize: "11px",
                padding: "4px 8px",
              }}
              formatter={function(value: number) { return [value, "Value"]; }}
              labelFormatter={function(label: string) {
                // Format date: "Feb 14"
                if (!label) return "";
                var parts = label.split("-");
                if (parts.length < 3) return label;
                var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                var monthIdx = parseInt(parts[1], 10) - 1;
                var day = parseInt(parts[2], 10);
                return months[monthIdx] + " " + day;
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fillOpacity={1}
            fill={"url(#" + gId + ")"}
            dot={false}
            activeDot={{ r: 2, strokeWidth: 0, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Toggle between 7-day and 30-day trend ranges.
 */
export function TrendRangeToggle({ value, onChange }: { value: 7 | 30; onChange: (v: 7 | 30) => void }) {
  return (
    <div className="flex items-center gap-1 bg-muted/30 rounded-full p-0.5" data-testid="trend-range-toggle">
      <button
        type="button"
        onClick={function() { onChange(7); }}
        className={"px-2 py-0.5 rounded-full text-[10px] font-bold transition-all " + (value === 7 ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        data-testid="trend-range-7d"
      >
        7d
      </button>
      <button
        type="button"
        onClick={function() { onChange(30); }}
        className={"px-2 py-0.5 rounded-full text-[10px] font-bold transition-all " + (value === 30 ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        data-testid="trend-range-30d"
      >
        30d
      </button>
    </div>
  );
}

/**
 * Shows a trend indicator (up/down arrow + percentage change)
 * based on comparing first half vs second half of data.
 */
export function TrendIndicator({ data, color }: { data: SparklineDataPoint[]; color?: string }) {
  if (!data || data.length < 2) return null;

  var midpoint = Math.floor(data.length / 2);
  var firstHalf = data.slice(0, midpoint);
  var secondHalf = data.slice(midpoint);

  var firstAvg = firstHalf.reduce(function(sum, d) { return sum + d.value; }, 0) / firstHalf.length;
  var secondAvg = secondHalf.reduce(function(sum, d) { return sum + d.value; }, 0) / secondHalf.length;

  if (firstAvg === 0 && secondAvg === 0) return null;

  var pctChange = firstAvg === 0
    ? 100
    : Math.round(((secondAvg - firstAvg) / firstAvg) * 100);

  var isPositive = pctChange >= 0;
  var displayColor = color || (isPositive ? "#10b981" : "#ef4444");

  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-bold"
      style={{ color: displayColor }}
      data-testid="trend-indicator"
    >
      {isPositive ? "↑" : "↓"}
      {Math.abs(pctChange)}%
    </span>
  );
}
