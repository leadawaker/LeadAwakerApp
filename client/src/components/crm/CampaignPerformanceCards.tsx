import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { TrendingUp, CalendarIcon, MessageSquare, Megaphone } from "lucide-react";
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm animate-pulse"
          >
            <div className="h-4 w-2/3 bg-muted rounded mb-4" />
            <div className="h-8 w-full bg-muted rounded mb-3" />
            <div className="h-4 w-1/2 bg-muted rounded" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaignsWithMetrics.map((campaign) => {
          const cMetrics = metricsByCampaign[campaign.id] || [];
          const statusColor = getStatusColor(campaign.status);

          // Prepare sparkline data
          const sparkData = cMetrics.map((m) => ({
            date: m.metric_date ? m.metric_date.substring(5) : "",
            response_rate: m.response_rate_percent,
            booking_rate: m.booking_rate_percent,
          }));

          // Compute trends
          const respTrend = computeTrend(cMetrics, "response_rate_percent");
          const bookTrend = computeTrend(cMetrics, "booking_rate_percent");

          // Aggregate totals
          const totalMsgsSent = cMetrics.reduce((s, m) => s + m.total_messages_sent, 0);
          const totalBookings = cMetrics.reduce((s, m) => s + m.bookings_generated, 0);

          return (
            <div
              key={campaign.id}
              className={cn(
                "rounded-2xl border border-border bg-card p-5 shadow-sm",
                "hover:shadow-md hover:border-border transition-all duration-200"
              )}
              data-testid={`campaign-card-${campaign.id}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-foreground truncate" title={campaign.name}>
                    {campaign.name}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {campaign.type || "Campaign"} &middot; {cMetrics.length} days tracked
                  </p>
                </div>
                <span
                  className="shrink-0 ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                  style={{
                    backgroundColor: `${statusColor}20`,
                    color: statusColor,
                  }}
                  data-testid={`campaign-status-${campaign.id}`}
                >
                  {campaign.status}
                </span>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Response Rate */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Response Rate
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-xl font-black text-foreground tabular-nums"
                      data-testid={`campaign-response-rate-${campaign.id}`}
                    >
                      {respTrend.current}%
                    </span>
                    {respTrend.trend !== null && (
                      <span
                        className={cn(
                          "text-[10px] font-bold",
                          respTrend.trend >= 0 ? "text-green-500" : "text-red-500"
                        )}
                      >
                        {respTrend.trend >= 0 ? "+" : ""}
                        {respTrend.trend}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Booking Rate */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Booking Rate
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-xl font-black text-foreground tabular-nums"
                      data-testid={`campaign-booking-rate-${campaign.id}`}
                    >
                      {bookTrend.current}%
                    </span>
                    {bookTrend.trend !== null && (
                      <span
                        className={cn(
                          "text-[10px] font-bold",
                          bookTrend.trend >= 0 ? "text-green-500" : "text-red-500"
                        )}
                      >
                        {bookTrend.trend >= 0 ? "+" : ""}
                        {bookTrend.trend}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sparklines */}
              <div className="space-y-2 mb-3">
                <div>
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                    Response Rate Trend
                  </div>
                  <Sparkline
                    data={sparkData}
                    dataKey="response_rate"
                    color="#3B82F6"
                    height={36}
                  />
                </div>
                <div>
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                    Booking Rate Trend
                  </div>
                  <Sparkline
                    data={sparkData}
                    dataKey="booking_rate"
                    color="#FCB803"
                    height={36}
                  />
                </div>
              </div>

              {/* Footer Stats */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MessageSquare className="w-3 h-3" />
                  <span className="font-semibold">{totalMsgsSent}</span>
                  <span>msgs sent</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarIcon className="w-3 h-3" />
                  <span className="font-semibold">{totalBookings}</span>
                  <span>bookings</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
