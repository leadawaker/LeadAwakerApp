// Performance panel — Day/Week/Month segmented control + 4 big metrics + trend
// chart. Mirrors the Claude design's PERFORMANCE card (inset surface).
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CampaignMetricsHistory } from "@/types/models";
import { SectionHead } from "../panelPrimitives";
import { AnimatedMetricCard } from "../AnimatedMetricCard";
import { aggregateByTimeframe, trendPoints, type Timeframe } from "./utils";

const TF_INDEX: Record<Timeframe, number> = { "1D": 0, "7D": 1, "1M": 2 };

export function PerformancePanel({ metrics, animTrigger }: {
  metrics: CampaignMetricsHistory[];
  animTrigger: number;
}) {
  const { t } = useTranslation("campaigns");
  const [tf, setTf] = useState<Timeframe>("7D");

  const agg = useMemo(() => aggregateByTimeframe(metrics, tf), [metrics, tf]);
  const points = useMemo(() => trendPoints(metrics, tf), [metrics, tf]);
  const trig = animTrigger + TF_INDEX[tf] + 1;

  const title =
    tf === "1D" ? t("summary.timeframes.today") :
    tf === "7D" ? t("summary.timeframes.thisWeek") :
    t("summary.timeframes.thisMonth");

  const segs: Array<{ k: Timeframe; l: string }> = [
    { k: "1D", l: t("summary.timeframes.day") },
    { k: "7D", l: t("summary.timeframes.week") },
    { k: "1M", l: t("summary.timeframes.month") },
  ];

  return (
    <div className="panel-inset-animate flex flex-col" style={{ padding: 26, overflow: "hidden" }} data-testid="campaign-detail-view-metrics">
      <SectionHead
        titleSize={32}
        eyebrow={t("summary.eyebrows.performance")}
        title={title}
        action={
          <div className="la-seg">
            {segs.map((s) => (
              <button key={s.k} onClick={() => setTf(s.k)} className={`la-seg-btn${tf === s.k ? " on" : ""}`}>{s.l}</button>
            ))}
          </div>
        }
      />

      {/* Metrics (4×1 row) + trend chart on the right; stays side-by-side */}
      <div className="bold-metrics-row">
        <div
          className="perf-metrics grid gap-3"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", flex: "1 1 45%", minWidth: 240 }}
        >
          <AnimatedMetricCard numericValue={agg.leadsTargeted} displayValue={agg.leadsTargeted.toLocaleString()} label={t("summary.leadsTargeted")} animTrigger={trig} borderColor="#6C5A8C" />
          <AnimatedMetricCard numericValue={agg.messagesSent}  displayValue={agg.messagesSent.toLocaleString()}  label={t("summary.messagesSent")}  animTrigger={trig} borderColor="#3F8E8E" />
          <AnimatedMetricCard numericValue={agg.responseRate}  displayValue={`${agg.responseRate}%`} label={t("summary.responsePercent")} animTrigger={trig} borderColor="#DA9426" />
          <AnimatedMetricCard numericValue={agg.bookingRate}   displayValue={`${agg.bookingRate}%`}  label={t("summary.bookingPercent")}  animTrigger={trig} borderColor="#2F9461" star />
        </div>

        {/* Vertical divider — hidden once the row wraps (see .bold-metrics-rule) */}
        <div className="bold-metrics-rule" style={{ width: 1, background: "var(--line)", alignSelf: "stretch" }} />

        <div className="perf-chart flex flex-col" style={{ flex: "1 1 40%", minWidth: 180 }}>
          <div className="flex-1 min-h-[120px]" key={trig} data-testid="campaign-detail-view-trends">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={points.map((p) => ({ date: p.date, [t("summary.responsePercent")]: p.response, [t("summary.bookingPercent")]: p.booking }))}
                margin={{ top: 15, right: 4, bottom: 0, left: -39 }}
              >
              <defs>
                <linearGradient id="fillResp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--wine)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--wine)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date" tick={({ x, y, payload, index }) => {
                const dateStr = payload.value;
                const prevDate = index > 0 ? points[index - 1]?.date : null;
                let displayText = dateStr;

                if (tf === "1D") {
                  // Daily view: show hourly (e.g., "12:00", "1:00", "2:00")
                  const timePart = dateStr.split(' ').pop() ?? dateStr;
                  displayText = timePart.replace(':00', ''); // Remove :00 for cleaner look
                } else if (tf === "7D") {
                  // Weekly view: show day abbreviation + date (e.g., "Mon 15", "Tue 16")
                  try {
                    const date = new Date(dateStr);
                    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                    const dayName = dayNames[date.getDay()];
                    const dayNum = date.getDate();
                    displayText = `${dayName} ${dayNum}`;
                  } catch {
                    displayText = dateStr.split(' ').pop() ?? dateStr;
                  }
                } else if (tf === "1M") {
                  // Monthly view: show month only on first occurrence, then just day numbers
                  const parts = dateStr.split(' ');
                  const day = parts[parts.length - 1];

                  // Check if this is the first occurrence of this month
                  let showMonth = index === 0;
                  if (!showMonth && prevDate) {
                    const currMonthStr = dateStr.substring(0, 3); // e.g., "Feb", "Mar"
                    const prevMonthStr = prevDate.substring(0, 3);
                    showMonth = currMonthStr !== prevMonthStr;
                  }

                  displayText = showMonth ? `${dateStr.substring(0, 3)} ${day}` : day;
                }

                return <text x={x} y={y + 10} fontSize={10} fill="rgba(0,0,0,0.4)" textAnchor="middle">{displayText}</text>;
              }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid rgba(0,0,0,0.1)", backgroundColor: "rgba(255,255,255,0.95)", color: "#111", fontSize: "11px", padding: "6px 10px" }} />
              <Area type="monotone" dataKey={t("summary.responsePercent")} stroke="var(--wine)" strokeWidth={2} fill="url(#fillResp)" dot={false} activeDot={{ r: 3 }} />
              <Area type="monotone" dataKey={t("summary.bookingPercent")} stroke="#C4A62F" strokeWidth={2} fill="none" dot={false} activeDot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
