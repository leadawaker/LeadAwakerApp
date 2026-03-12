import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskStats, type TaskStatPoint } from "../api/tasksApi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── localStorage helpers ─────────────────────────────────────────────
const COLLAPSED_KEY = "tasks-chart-collapsed";
const AGGREGATION_KEY = "tasks-chart-aggregation";

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v === "true" : fallback;
  } catch {
    return fallback;
  }
}

function loadString<T extends string>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return (v as T) ?? fallback;
  } catch {
    return fallback;
  }
}

type Aggregation = "daily" | "weekly";

// ── Aggregate daily data into weekly buckets ─────────────────────────
function aggregateWeekly(data: TaskStatPoint[]): TaskStatPoint[] {
  if (data.length === 0) return [];
  const weekMap = new Map<string, number>();
  for (const point of data) {
    const d = new Date(point.date);
    // Week starts on Monday
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const weekKey = monday.toISOString().slice(0, 10);
    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + point.completedCount);
  }
  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, completedCount]) => ({ date, completedCount }));
}

// ── Format date for display ──────────────────────────────────────────
function formatDate(dateStr: string, aggregation: Aggregation): string {
  const d = new Date(dateStr);
  if (aggregation === "weekly") {
    return `W ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Custom tooltip ───────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, aggregation }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-foreground">{formatDate(label, aggregation)}</p>
      <p className="text-brand-indigo">
        {payload[0].value} task{payload[0].value !== 1 ? "s" : ""} completed
      </p>
    </div>
  );
}

export default function ProgressChart() {
  const [collapsed, setCollapsed] = useState(() => loadBool(COLLAPSED_KEY, false));
  const [aggregation, setAggregation] = useState<Aggregation>(() =>
    loadString(AGGREGATION_KEY, "daily")
  );
  const { data: rawData, isLoading } = useTaskStats();

  const chartData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    return aggregation === "weekly" ? aggregateWeekly(rawData) : rawData;
  }, [rawData, aggregation]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  const toggleAggregation = useCallback(() => {
    setAggregation((prev) => {
      const next = prev === "daily" ? "weekly" : "daily";
      localStorage.setItem(AGGREGATION_KEY, next);
      return next;
    });
  }, []);

  const totalCompleted = useMemo(
    () => (rawData ?? []).reduce((sum, p) => sum + p.completedCount, 0),
    [rawData]
  );

  return (
    <div
      className="mb-2 rounded-xl border border-border/50 bg-card overflow-hidden transition-all duration-200"
      data-testid="progress-chart"
    >
      {/* Header / collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
        data-testid="progress-chart-toggle"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <BarChart3 className="h-4 w-4 text-brand-indigo shrink-0" />
        <span className="text-sm font-medium text-foreground">Progress</span>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {totalCompleted} completed
        </span>
      </button>

      {/* Chart body */}
      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Daily / Weekly toggle */}
          <div className="flex items-center gap-1 mb-3">
            <button
              onClick={toggleAggregation}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md font-medium transition-colors",
                aggregation === "daily"
                  ? "bg-brand-indigo/10 text-brand-indigo"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              data-testid="chart-toggle-daily"
            >
              Daily
            </button>
            <button
              onClick={toggleAggregation}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md font-medium transition-colors",
                aggregation === "weekly"
                  ? "bg-brand-indigo/10 text-brand-indigo"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              data-testid="chart-toggle-weekly"
            >
              Weekly
            </button>
          </div>

          {isLoading ? (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Loading…
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              No completed tasks yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/30"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatDate(v, aggregation)}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  stroke="currentColor"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  stroke="currentColor"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<ChartTooltip aggregation={aggregation} />}
                  cursor={{ strokeDasharray: "3 3" }}
                />
                <Line
                  type="monotone"
                  dataKey="completedCount"
                  stroke="var(--color-brand-indigo, #6366f1)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-brand-indigo, #6366f1)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
