import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { Lead } from "@/types/models";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

/**
 * Compute a lead engagement score (0–100) from available lead data.
 *
 * The score is a heuristic based on:
 * - Conversion status progression (up to 40 pts)
 * - Message activity (up to 20 pts)
 * - Bump stage progression (up to 15 pts)
 * - Recency of interaction (up to 15 pts)
 * - Priority level (up to 10 pts)
 *
 * If the API provides a real `lead_score` field, that value is used instead.
 */
function computeLeadScore(lead: any): number {
  // Use actual lead_score from DB if available
  const dbScore = Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_score ?? 0);
  if (dbScore > 0) return Math.min(dbScore, 100);

  let score = 0;

  // 1. Conversion status (0-40)
  const statusScores: Record<string, number> = {
    New: 5,
    Contacted: 15,
    Responded: 25,
    "Multiple Responses": 30,
    Qualified: 35,
    Booked: 40,
    DND: 0,
    Lost: 0,
  };
  const status = lead.conversion_status || lead.Conversion_Status || "New";
  score += statusScores[status] ?? 5;

  // 2. Message activity (0-20)
  const sent = Number(lead.message_count_sent) || 0;
  const received = Number(lead.message_count_received) || 0;
  if (received > 0) score += Math.min(received * 5, 15);
  if (sent > 0) score += Math.min(sent * 2, 5);

  // 3. Bump stage (0-15)
  const bumpStage = Number(lead.current_bump_stage) || 0;
  score += Math.min(bumpStage * 5, 15);

  // 4. Recency (0-15)
  const lastActivity =
    lead.last_interaction_at ||
    lead.last_message_received_at ||
    lead.last_message_sent_at ||
    lead.updated_at;
  if (lastActivity) {
    const daysAgo = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo < 1) score += 15;
    else if (daysAgo < 3) score += 12;
    else if (daysAgo < 7) score += 8;
    else if (daysAgo < 14) score += 4;
    else if (daysAgo < 30) score += 2;
  }

  // 5. Priority (0-10)
  const priority = (lead.priority || "").toLowerCase();
  if (priority === "urgent") score += 10;
  else if (priority === "high") score += 7;
  else if (priority === "medium") score += 4;
  else if (priority === "low") score += 1;

  return Math.min(score, 100);
}

/** Score range bucket definitions */
const SCORE_BUCKETS = [
  { range: "0–20", min: 0, max: 20, color: "#64748b" },
  { range: "21–40", min: 21, max: 40, color: "#3b82f6" },
  { range: "41–60", min: 41, max: 60, color: "#eab308" },
  { range: "61–80", min: 61, max: 80, color: "#f97316" },
  { range: "81–100", min: 81, max: 100, color: "#ef4444" },
];

interface LeadScoreDistributionChartProps {
  leads: Lead[];
}

export function LeadScoreDistributionChart({ leads }: LeadScoreDistributionChartProps) {
  const distributionData = useMemo(() => {
    // Compute scores for all leads
    const scores = leads.map((l) => computeLeadScore(l));

    // Bucket the scores
    return SCORE_BUCKETS.map((bucket) => {
      const count = scores.filter((s) => s >= bucket.min && s <= bucket.max).length;
      return {
        range: bucket.range,
        count,
        color: bucket.color,
      };
    });
  }, [leads]);

  const totalLeads = leads.length;

  if (totalLeads === 0) {
    return (
      <div
        className="rounded-2xl border border-border bg-card shadow-sm flex flex-col"
        data-testid="lead-score-distribution-chart"
      >
        <div className="flex items-center gap-2 p-4 pb-3 border-b border-border">
          <div className="p-1.5 rounded-lg bg-indigo-500/10">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </div>
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            Lead Score Distribution
          </h3>
        </div>
        <div className="p-4">
          <DataEmptyState
            variant="leads"
            compact
            title="No leads"
            description="No leads to analyze for score distribution."
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-border bg-card shadow-sm flex flex-col"
      data-testid="lead-score-distribution-chart"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
          </div>
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            Lead Score Distribution
          </h3>
        </div>
        <div className="text-[10px] font-bold text-muted-foreground tabular-nums">
          {totalLeads} lead{totalLeads !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 pt-3" data-testid="lead-score-chart-container">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={distributionData}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="[&_line]:stroke-border"
                stroke="currentColor"
                opacity={0.15}
              />
              <XAxis
                dataKey="range"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                dy={5}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.3, radius: 8 }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  backgroundColor: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                  padding: "8px 12px",
                  fontSize: "12px",
                }}
                formatter={(value: number, _name: string, props: any) => {
                  const pct = totalLeads > 0 ? ((value / totalLeads) * 100).toFixed(0) : 0;
                  return [`${value} leads (${pct}%)`, `Score ${props.payload.range}`];
                }}
                labelFormatter={() => ""}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {distributionData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap" data-testid="lead-score-legend">
          {SCORE_BUCKETS.map((bucket) => (
            <div key={bucket.range} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: bucket.color, opacity: 0.85 }}
              />
              <span className="text-[10px] font-medium text-muted-foreground">
                {bucket.range}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
