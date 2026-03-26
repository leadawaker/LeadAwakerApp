// Score display components extracted from LeadsCardView.tsx

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TrendingUp, TrendingDown, Bot } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechTooltip, ResponsiveContainer } from "recharts";
import { cn, relativeTime } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  useScoreBreakdown,
  useScoreHistory,
  TIER_COLORS,
  TIER_BAR_COLOR,
  type ScoreHistoryPoint,
} from "@/hooks/useScoreBreakdown";
import type { ScoreInsight } from "./types";
import { DIMENSION_COLORS, DIMENSION_TOOLTIPS } from "./constants";
import { buildScoreInsights, cardEngagementContext, cardActivityContext, cardFunnelContext } from "./scoreUtils";

// ── Score insight tag component ───────────────────────────────────────────────
export function ScoreInsightTag({ insight, compact }: { insight: ScoreInsight; compact?: boolean }) {
  const isUp = insight.direction === "up";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className={cn("flex items-center", compact ? "gap-2" : "gap-2.5 min-h-[38px]")}>
      {isUp
        ? <TrendingUp className={cn(iconSize, "text-blue-500 shrink-0")} />
        : <TrendingDown className={cn(iconSize, "text-gray-400 shrink-0")} />
      }
      <span className={cn("leading-snug text-foreground/80", compact ? "text-[12px]" : "text-[14px]")}>
        {insight.label}
      </span>
    </div>
  );
}

// ── Score history area chart ───────────────────────────────────────────────────
export function ScoreHistoryChart({ data, tierColor, score, leadId }: {
  data: ScoreHistoryPoint[]; tierColor: string; score: number; leadId: number | null;
}) {
  const gradId = `sg-${leadId ?? "x"}`;

  const now = new Date();

  // Sort chronologically, keep all data points (timestamps, not just dates)
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  // If fewer than 2 data points, synthesize a flat line at the current score
  if (sorted.length < 2) {
    const todayLabel = now.toLocaleDateString(undefined, { weekday: "short" });
    const yesterdayLabel = new Date(now.getTime() - 86_400_000).toLocaleDateString(undefined, { weekday: "short" });
    const chartData = [
      { label: yesterdayLabel, score: 0 },
      { label: todayLabel, score },
    ];
    return (
      <div className="w-full h-[130px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 14, right: 36, bottom: 0, left: -4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tierColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={tierColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "rgba(0,0,0,0.35)" }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "rgba(0,0,0,0.3)" }} tickLine={false} axisLine={false} width={32} tickCount={4} />
            <Area
              type="monotone" dataKey="score" stroke={tierColor} strokeWidth={2}
              fill={`url(#${gradId})`} strokeDasharray="4 4"
              dot={(dotProps: any) => {
                const isLast = dotProps.index === chartData.length - 1;
                return (
                  <g key={dotProps.index}>
                    <circle cx={dotProps.cx} cy={dotProps.cy} r={isLast ? 4 : 2} fill={tierColor} stroke={isLast ? "white" : "none"} strokeWidth={isLast ? 2 : 0} opacity={isLast ? 1 : 0.4} />
                  </g>
                );
              }}
              isAnimationActive={true} animationBegin={100} animationDuration={600} animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Deduplicate consecutive same-score points ──
  // Keep: first occurrence of a new score, last occurrence before score changes, and always the last point.
  const deduped: typeof sorted = [];
  for (let i = 0; i < sorted.length; i++) {
    const prev = i > 0 ? sorted[i - 1].score : -1;
    const next = i < sorted.length - 1 ? sorted[i + 1].score : -1;
    const cur = sorted[i].score;
    const isFirst = cur !== prev;            // score just changed
    const isLast = cur !== next;             // score about to change
    const isVeryLast = i === sorted.length - 1;
    if (isFirst || isLast || isVeryLast) {
      deduped.push(sorted[i]);
    }
  }

  // ── Prepend a zero-origin point (1 minute before first real data point) ──
  const firstTs = new Date(deduped[0].date);
  const zeroDate = new Date(firstTs.getTime() - 60_000).toISOString();
  const withZero = [{ date: zeroDate, score: 0 }, ...deduped];

  const chartData = withZero.map((d, i) => {
    const ts = new Date(d.date);
    const diffMs = now.getTime() - ts.getTime();
    const diffDays = diffMs / 86_400_000;
    let label: string;
    if (diffDays < 1) {
      label = ts.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays <= 7) {
      label = ts.toLocaleDateString(undefined, { weekday: "short" });
    } else {
      label = ts.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    // Mark whether this is the first point of a plateau (show label) vs a repeat (just dot)
    const prevScore = i > 0 ? withZero[i - 1].score : -1;
    const isNewScore = d.score !== prevScore;
    return { label, score: d.score, isNewScore };
  });

  return (
    <div className="w-full h-[140px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 20, right: 36, bottom: 0, left: -4 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tierColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={tierColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "rgba(0,0,0,0.35)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "rgba(0,0,0,0.3)" }}
            tickLine={false}
            axisLine={false}
            width={32}
            tickCount={4}
          />
          <RechTooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid rgba(0,0,0,0.08)",
              backgroundColor: "rgba(255,255,255,0.96)",
              fontSize: "11px",
              padding: "4px 8px",
              color: "#111",
            }}
            formatter={(v: number) => [`${v}/100`, "Score"]}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={tierColor}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={(dotProps: any) => {
              const val = dotProps.payload.score;
              const { isNewScore } = dotProps.payload;
              const isLast = dotProps.index === chartData.length - 1;
              const isZero = dotProps.index === 0;
              // Zero-origin: small faded dot, no label
              if (isZero) {
                return (
                  <g key={dotProps.index}>
                    <circle cx={dotProps.cx} cy={dotProps.cy} r={2} fill={tierColor} opacity={0.4} />
                  </g>
                );
              }
              // Last point: just a prominent dot, no label (the big hero number above shows it)
              if (isLast) {
                return (
                  <g key={dotProps.index}>
                    <circle cx={dotProps.cx} cy={dotProps.cy} r={4} fill={tierColor} stroke="white" strokeWidth={2} />
                  </g>
                );
              }
              // Repeat of same score (plateau anchor): just a small dot, no label
              if (!isNewScore) {
                return (
                  <g key={dotProps.index}>
                    <circle cx={dotProps.cx} cy={dotProps.cy} r={2} fill={tierColor} opacity={0.5} />
                  </g>
                );
              }
              // First occurrence of a new score: dot + label
              const prevScore = dotProps.index > 0 ? chartData[dotProps.index - 1].score : 0;
              const wentUp = val >= prevScore;
              // For scores near 100, always label below to avoid cropping
              const labelY = val >= 90 ? dotProps.cy + 14 : (wentUp ? dotProps.cy - 10 : dotProps.cy + 14);
              return (
                <g key={dotProps.index}>
                  <circle cx={dotProps.cx} cy={dotProps.cy} r={2.5} fill={tierColor} />
                  <text
                    x={dotProps.cx}
                    y={labelY}
                    textAnchor="middle"
                    dominantBaseline="auto"
                    fill={tierColor}
                    style={{ fontSize: 10, fontWeight: 700 }}
                  >
                    {val}
                  </text>
                </g>
              );
            }}
            activeDot={{ r: 4, fill: tierColor, stroke: "white", strokeWidth: 2 }}
            isAnimationActive={true}
            animationBegin={100}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Compact sub-score bar (matches ContactSidebar pattern) ────────────────────
export function ScoreBar({ label, value, max, color, context }: { label: string; value: number; max: number; color: string; context?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-foreground/80">{label}</span>
        <span className="text-[12px] font-bold tabular-nums text-foreground/70">
          {Math.round(value)}<span className="text-foreground/30">/{max}</span>
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {context && (
        <span className="text-[12px] text-muted-foreground leading-snug">{context}</span>
      )}
    </div>
  );
}

// ── Score column widget (horizontal bar + tooltip on hover) ───────────────────
export function ScoreColumnWidget({ label, value, maxPts, insights, isBooked }: {
  label: string; value: number; maxPts: number;
  insights: ScoreInsight[]; isBooked?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, Math.round((value / maxPts) * 100)));
  const [displayPct, setDisplayPct] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setDisplayPct(pct), 20);
    return () => clearTimeout(id);
  }, [pct]);
  const barColor = DIMENSION_COLORS[label] ?? "#6366f1";
  const tooltipText = DIMENSION_TOOLTIPS[label];
  return (
    <div className="flex flex-col gap-1 w-full group/bar">
      {/* Label + percentage */}
      <div className="flex items-baseline justify-between">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground cursor-help border-b border-dotted border-muted-foreground/30">
              {label}
            </span>
          </TooltipTrigger>
          {tooltipText && (
            <TooltipContent side="top" className="max-w-[220px] text-[11px] leading-snug">
              {tooltipText}
            </TooltipContent>
          )}
        </Tooltip>
        <span className="text-[13px] font-semibold tabular-nums text-foreground/70">
          {Math.round(value)}<span className="text-foreground/30 text-[10px]">/{maxPts}</span>
          <span className="text-foreground/30 text-[10px] ml-1">({pct}%)</span>
        </span>
      </div>
      {/* Horizontal bar */}
      <div className="relative w-full h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute top-0 left-0 bottom-0 rounded-full transition-[width] duration-[450ms] ease-out"
          style={{ width: `${displayPct}%`, backgroundColor: barColor, boxShadow: `2px 0 8px ${barColor}50` }}
        />
        {isBooked && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] select-none">👑</div>
        )}
      </div>
      {/* Insights below */}
      {insights.length > 0 && (
        <div className="flex flex-wrap items-start gap-1 mt-0.5">
          {insights.map((ins, i) => <ScoreInsightTag key={i} insight={ins} compact />)}
        </div>
      )}
    </div>
  );
}

// ── Score widget with AI summary ──────────────────────────────────────────────
export function ScoreWidget({ score, lead, status }: { score: number; lead?: Record<string, any>; status?: string }) {
  const { t } = useTranslation("leads");
  const leadId = lead?.Id || lead?.id;
  const { breakdown } = useScoreBreakdown(leadId ? Number(leadId) : null);
  const { history } = useScoreHistory(leadId ? Number(leadId) : null);
  const aiSummary = lead?.ai_summary || lead?.aiSummary || "";
  const memoryStr = lead?.ai_memory || lead?.aiMemory || "";
  let parsedSummary = "";
  if (!aiSummary && memoryStr) {
    try {
      const obj = typeof memoryStr === "string" ? JSON.parse(memoryStr) : memoryStr;
      parsedSummary = obj?.summary || obj?.notes || obj?.description || "";
    } catch { parsedSummary = ""; }
  }
  const summaryText = aiSummary || parsedSummary;
  const insights = lead ? buildScoreInsights(lead, t) : [];
  const tierColor = TIER_BAR_COLOR[breakdown?.tier ?? "Sleeping"];
  // Sub-scores are already pre-scaled: eng (max 30) + act (max 20) + funnel (max 50) = lead_score
  const engPts    = breakdown?.engagement_score ?? 0;
  const actPts    = breakdown?.activity_score ?? 0;
  const funnelPts = breakdown?.funnel_weight ?? 0;
  const isBooked  = status === "Booked";

  return (
    <div className="bg-white/50 dark:bg-white/[0.10] rounded-xl p-[21px] flex flex-col gap-3 h-full overflow-y-auto">
      {/* Header — title + time */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[18px] font-semibold font-heading text-foreground">{t("score.title")}</p>
        {breakdown?.last_updated && (
          <span className="text-[10px] text-muted-foreground/50">
            {relativeTime(breakdown.last_updated)}
          </span>
        )}
      </div>

      {/* Score hero: big number right-aligned, tier badge to its left — hidden when score=0 */}
      {score > 0 && (
        <div className="flex items-center justify-end gap-2.5 shrink-0 pt-10 -mb-8 pr-1">
          {breakdown && (
            <span
              className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", TIER_COLORS[breakdown.tier] ?? TIER_COLORS.Sleeping)}
              style={(breakdown.tier === "Hot" || breakdown.tier === "Awake") ? {
                boxShadow: `0 0 8px 2px ${breakdown.tier === "Hot" ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)"}`,
              } : undefined}
            >
              {breakdown.tier}
            </span>
          )}
          <span className="text-5xl font-black tabular-nums leading-none">
            {score}
          </span>
        </div>
      )}

      {/* Score history chart + horizontal bars — hidden when score=0 */}
      {score > 0 && (
        <ScoreHistoryChart
          data={history}
          tierColor={tierColor}
          score={score}
          leadId={leadId ? Number(leadId) : null}
        />
      )}
      {breakdown && score > 0 && (
        <div className="flex flex-col gap-2.5 shrink-0 pt-2" style={{ marginLeft: 28, marginRight: 36 }}>
          <ScoreBar label="Engagement" value={engPts} max={30} color="#3B82F6" context={cardEngagementContext(lead)} />
          <ScoreBar label="Activity" value={actPts} max={20} color="#10B981" context={cardActivityContext(lead)} />
          <ScoreBar label="Funnel" value={funnelPts} max={50} color="#F59E0B" context={cardFunnelContext(lead)} />
        </div>
      )}

      {/* Score=0 empty state */}
      {score === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="text-3xl">😴</span>
          <p className="text-[13px] font-medium text-muted-foreground/60">{t("score.noActivity", "No activity yet")}</p>
          <p className="text-[11px] text-muted-foreground/40">{t("score.noActivityHint", "Score will update as interactions happen")}</p>
        </div>
      )}

      {/* AI Summary — only shown for Booked status */}
      {status === "Booked" && summaryText ? (
        <div className="border-t border-border/20 pt-3 mt-1 flex-1 min-h-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Bot className="h-3 w-3 text-brand-indigo/60" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">{t("detail.aiSummary")}</p>
          </div>
          <p className="text-[12px] text-foreground/75 leading-relaxed whitespace-pre-wrap">{summaryText}</p>
        </div>
      ) : status === "Booked" ? (
        <div className="border-t border-border/20 pt-3 mt-1 flex-1 min-h-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mb-1.5">{t("detail.aiSummary")}</p>
          <p className="text-[11px] text-muted-foreground/50 italic">{t("detail.noAiSummary")}</p>
        </div>
      ) : null}
    </div>
  );
}
