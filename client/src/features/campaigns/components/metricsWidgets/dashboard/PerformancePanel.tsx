// Performance panel — Day/Week/Month segmented control + 4 big metrics + trend
// chart. Mirrors the Claude design's PERFORMANCE card (inset surface).
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useInteractions } from "@/hooks/useApiData";
import { SectionHead } from "../panelPrimitives";
import { AnimatedMetricCard } from "../AnimatedMetricCard";
import { liveAggregateByTimeframe, liveTrendPoints, computeXTicks, type Timeframe } from "./utils";

const TF_INDEX: Record<Timeframe, number> = { "1D": 0, "7D": 1, "1M": 2 };

export function PerformancePanel({ leads, campaignId, accountId, animTrigger }: {
  /** Campaign-scoped, normalized leads (from useLeads). */
  leads: Record<string, any>[];
  campaignId: number;
  accountId: number;
  animTrigger: number;
}) {
  const { t } = useTranslation("campaigns");
  const [tf, setTf] = useState<Timeframe>("7D");

  // Live interactions for this account — derive performance straight from them so
  // the numbers stay consistent with the A/B card and Pipeline/Next panels.
  const { interactions } = useInteractions(accountId);

  const agg = useMemo(() => liveAggregateByTimeframe(leads, interactions, campaignId, tf), [leads, interactions, campaignId, tf]);
  const points = useMemo(() => liveTrendPoints(leads, interactions, campaignId, tf), [leads, interactions, campaignId, tf]);
  const xAxis = useMemo(() => computeXTicks(points, tf), [points, tf]);
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
              <XAxis dataKey="date" ticks={xAxis.ticks} tick={({ x, y, payload }) => {
                const dateStr: string = payload.value;
                let displayText = dateStr;

                if (tf === "1D") {
                  // Daily view: hourly, drop the ":00" (e.g. "14:00" → "14h")
                  displayText = `${dateStr.replace(":00", "")}h`;
                } else if (tf === "7D") {
                  // Weekly view: weekday + date (e.g. "Mon 15")
                  try {
                    const date = new Date(dateStr);
                    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                    displayText = `${dayNames[date.getDay()]} ${date.getDate()}`;
                  } catch {
                    displayText = dateStr;
                  }
                } else if (tf === "1M") {
                  // Monthly view: month name only on the first visible tick of each
                  // month (computed in computeXTicks); otherwise just the day number.
                  const day = dateStr.split(" ").pop() ?? dateStr;
                  displayText = xAxis.showMonth.has(dateStr) ? `${dateStr.substring(0, 3)} ${day}` : day;
                }

                return <text x={x} y={y + 10} fontSize={10} fill="#948A77" textAnchor="middle">{displayText}</text>;
              }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#948A77" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid var(--line)", backgroundColor: "var(--card)", color: "var(--ink)", fontSize: "11px", padding: "6px 10px" }} />
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
