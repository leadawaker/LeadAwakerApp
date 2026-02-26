import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { TrendingUp, TrendingDown, CalendarIcon, MessageSquare, Megaphone, BarChart3 } from "lucide-react";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

interface CampaignPerformanceCardsProps {
  campaigns: Campaign[];
  metrics: CampaignMetricsHistory[];
  loading?: boolean;
}

/**
 * Mini sparkline component using Recharts LineChart.
 * Renders a small, clean trend line for the given data key.
 */
function Sparkline({
  data,
  dataKey,
  color,
  height = 32,
}: {
  data: Array<Record<string, any>>;
  dataKey: string;
  color: string;
  height?: number;
}) {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              fontSize: "11px",
              padding: "4px 8px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            formatter={(value: number) => [value, ""]}
            labelFormatter={(label: string) => label}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Computes the latest metric value and the trend (% change) vs previous period.
 */
function computeTrend(
  sortedMetrics: CampaignMetricsHistory[],
  key: keyof CampaignMetricsHistory
): { current: number; trend: number | null } {
  if (sortedMetrics.length === 0) return { current: 0, trend: null };

  const latest = Number(sortedMetrics[sortedMetrics.length - 1][key]) || 0;
  if (sortedMetrics.length < 2) return { current: latest, trend: null };

  // Compare latest vs the average of the first half
  const midpoint = Math.floor(sortedMetrics.length / 2);
  const firstHalf = sortedMetrics.slice(0, midpoint);
  const firstAvg = firstHalf.reduce((s, m) => s + (Number(m[key]) || 0), 0) / firstHalf.length;

  if (firstAvg === 0) return { current: latest, trend: null };
  const trend = Math.round(((latest - firstAvg) / firstAvg) * 100);
  return { current: latest, trend };
}

/**
 * Status badge color mapping for campaign statuses.
 */
function getStatusColor(status: string): string {
  switch (status) {
    case "Active": return "#22C55E";
    case "Draft": return "#64748B";
    case "Paused": return "#F59E0B";
    case "Completed":
    case "Finished": return "#3B82F6";
    case "Archived":
    case "Inactive": return "#94A3B8";
    default: return "#64748B";
  }
}

export function CampaignPerformanceCards({
  campaigns,
  metrics,
  loading,
}: CampaignPerformanceCardsProps) {
  // Group metrics by campaign ID
  const metricsByCampaign = useMemo(() => {
    const map: Record<number, CampaignMetricsHistory[]> = {};
    for (const m of metrics) {
      const cid = m.campaigns_id || (m as any).campaignsId || 0;
      if (!map[cid]) map[cid] = [];
      map[cid].push(m);
    }
    // Sort each campaign's metrics by date ascending for sparklines
    for (const cid of Object.keys(map)) {
      map[Number(cid)].sort((a, b) => {
        const da = a.metric_date || "";
        const db = b.metric_date || "";
        return da.localeCompare(db);
      });
    }
    return map;
  }, [metrics]);

  // Filter to campaigns that have metrics data
  const campaignsWithMetrics = useMemo(() => {
    return campaigns.filter((c) => {
      const cMetrics = metricsByCampaign[c.id];
      return cMetrics && cMetrics.length > 0;
    });
  }, [campaigns, metricsByCampaign]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm animate-pulse min-h-[180px]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-3.5 w-1/2 bg-muted rounded" />
              <div className="h-5 w-14 bg-muted rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="space-y-1.5">
                <div className="h-2.5 w-16 bg-muted rounded" />
                <div className="h-6 w-12 bg-muted rounded" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2.5 w-16 bg-muted rounded" />
                <div className="h-6 w-12 bg-muted rounded" />
              </div>
            </div>
            <div className="h-2.5 w-full bg-muted rounded mb-3" />
            <div className="h-8 w-full bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (campaignsWithMetrics.length === 0) {
    return (
      <div data-testid="campaign-performance-cards">
        <div className="mb-4">
          <h3 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <Megaphone className="w-3.5 h-3.5" />
            Campaign Performance
          </h3>
        </div>
        <DataEmptyState
          variant="campaigns"
          title={campaigns.length === 0 ? "No campaigns yet" : "No performance data yet"}
          description={
            campaigns.length === 0
              ? "Create your first campaign to start engaging with leads via WhatsApp."
              : "Campaign metrics will appear here once your campaigns start running."
          }
          data-testid="campaign-performance-empty"
        />
      </div>
    );
  }

  return (
    <div data-testid="campaign-performance-cards">
      <div className="mb-4">
        <h3 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/15 dark:bg-muted/8 glass-surface text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <Megaphone className="w-3.5 h-3.5" />
          Campaign Performance
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {campaignsWithMetrics.map((campaign) => {
          const cMetrics = metricsByCampaign[campaign.id] || [];
          const statusColor = getStatusColor(campaign.status);

          // Prepare sparkline data (booking rate only)
          const sparkData = cMetrics.map((m) => ({
            date: m.metric_date ? m.metric_date.substring(5) : "",
            booking_rate: m.booking_rate_percent,
          }));

          // Compute trends
          const respTrend = computeTrend(cMetrics, "response_rate_percent");
          const bookTrend = computeTrend(cMetrics, "booking_rate_percent");

          // Aggregate totals
          const totalMsgsSent = cMetrics.reduce((s, m) => s + m.total_messages_sent, 0);
          const totalBookings = cMetrics.reduce((s, m) => s + m.bookings_generated, 0);

          // ROI — use latest metric entry value
          const latestMetric = cMetrics.length > 0 ? cMetrics[cMetrics.length - 1] : null;
          const roiPercent = latestMetric ? Number(latestMetric.roi_percent) || 0 : 0;

          return (
            <div
              key={campaign.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-border/90 transition-[box-shadow,border-color] duration-200 min-h-[180px] flex flex-col"
              data-testid={`campaign-card-${campaign.id}`}
            >
              {/* Header — name + type dot + status badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-foreground truncate leading-snug" title={campaign.name}>
                    {campaign.name}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: statusColor }}
                      aria-hidden="true"
                    />
                    {campaign.type || "Campaign"}
                  </p>
                </div>
                <span
                  className="shrink-0 ml-2 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: `${statusColor}20`,
                    color: statusColor,
                  }}
                  data-testid={`campaign-status-${campaign.id}`}
                >
                  {campaign.status}
                </span>
              </div>

              {/* Key Metrics Row — Response Rate | Booking Rate */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Response Rate */}
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Response
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span
                      className="text-2xl font-black text-foreground tabular-nums leading-none"
                      data-testid={`campaign-response-rate-${campaign.id}`}
                    >
                      {respTrend.current}%
                    </span>
                    {respTrend.trend !== null && (
                      <TrendArrow trend={respTrend.trend} />
                    )}
                  </div>
                </div>

                {/* Booking Rate */}
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Booked
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span
                      className="text-2xl font-black text-foreground tabular-nums leading-none"
                      data-testid={`campaign-booking-rate-${campaign.id}`}
                    >
                      {bookTrend.current}%
                    </span>
                    {bookTrend.trend !== null && (
                      <TrendArrow trend={bookTrend.trend} />
                    )}
                  </div>
                </div>
              </div>

              {/* Secondary Metrics Row — Messages Sent | Bookings | ROI */}
              <div className="grid grid-cols-3 gap-2 mb-3 pt-2.5 border-t border-border/50">
                <div>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Sent
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MessageSquare className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                    <span className="text-[13px] font-bold text-foreground tabular-nums">
                      {totalMsgsSent}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Bookings
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <CalendarIcon className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                    <span className="text-[13px] font-bold text-foreground tabular-nums">
                      {totalBookings}
                    </span>
                  </div>
                </div>

                <div data-testid={`campaign-roi-percent-${campaign.id}`}>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                    ROI
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <BarChart3 className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                    <span
                      className={cn(
                        "text-[13px] font-bold tabular-nums",
                        roiPercent >= 100
                          ? "text-emerald-500"
                          : roiPercent >= 50
                          ? "text-amber-500"
                          : "text-foreground"
                      )}
                    >
                      {roiPercent > 0 ? `${roiPercent.toFixed(0)}%` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Booking Rate Sparkline — unlabeled, subtle, at the bottom */}
              <div className="mt-auto pt-1">
                <Sparkline
                  data={sparkData}
                  dataKey="booking_rate"
                  color="#FCB803"
                  height={32}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Inline trend arrow with delta text — up/down color coded. */
function TrendArrow({ trend }: { trend: number }) {
  const isUp = trend >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-bold leading-none",
        isUp ? "text-emerald-500" : "text-red-500"
      )}
    >
      {isUp ? (
        <TrendingUp className="w-2.5 h-2.5" />
      ) : (
        <TrendingDown className="w-2.5 h-2.5" />
      )}
      {isUp ? "+" : ""}
      {trend}%
    </span>
  );
}
