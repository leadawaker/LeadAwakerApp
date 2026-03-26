import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BarChart2 } from "lucide-react";
import type { CampaignMetricsHistory } from "@/types/models";

/** Performance chart using Recharts */
export function PerformanceChart({ metrics }: { metrics: CampaignMetricsHistory[] }) {
  const { t } = useTranslation("campaigns");
  const chartData = useMemo(() => {
    return [...metrics]
      .sort((a, b) => (a.metric_date || "").localeCompare(b.metric_date || ""))
      .map((m) => ({
        date: m.metric_date
          ? new Date(m.metric_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : "",
        "Response %": Number(m.response_rate_percent) || 0,
        "Booking %": Number(m.booking_rate_percent) || 0,
        "ROI %": Number(m.roi_percent) || 0,
      }));
  }, [metrics]);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <BarChart2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
        <p className="text-[12px] text-muted-foreground">{t("panel.noPerformanceData")}</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              fontSize: "11px",
              padding: "6px 10px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
          />
          <Line
            type="monotone"
            dataKey="Response %"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="Booking %"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="ROI %"
            stroke="#10b981"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
