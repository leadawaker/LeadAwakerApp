import React, { useMemo } from "react";
import { useLocation } from "wouter";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { Lead } from "@/types/models";
import { Flame, ArrowUpRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
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
  // Receiving messages is a strong signal
  if (received > 0) score += Math.min(received * 5, 15);
  if (sent > 0) score += Math.min(sent * 2, 5);

  // 3. Bump stage (0-15)
  const bumpStage = Number(lead.current_bump_stage) || 0;
  score += Math.min(bumpStage * 5, 15);

  // 4. Recency (0-15) — more recent = higher score
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

/** Get a color for the score badge */
function getScoreColor(score: number): { bg: string; text: string; ring: string } {
  if (score >= 70) return { bg: "rgba(239,68,68,0.12)", text: "#ef4444", ring: "#ef4444" };
  if (score >= 50) return { bg: "rgba(249,115,22,0.12)", text: "#f97316", ring: "#f97316" };
  if (score >= 30) return { bg: "rgba(234,179,8,0.12)", text: "#eab308", ring: "#eab308" };
  return { bg: "rgba(59,130,246,0.12)", text: "#3b82f6", ring: "#3b82f6" };
}

/** Get status badge color */
function getStatusColor(status: string): string {
  switch (status) {
    case "Booked": return "#FCB803";
    case "Qualified": return "#10b981";
    case "Multiple Responses": return "#17A398";
    case "Responded": return "#1E90FF";
    case "Contacted": return "#2d5aa8";
    case "New": return "#1a3a6f";
    case "DND": return "#ef4444";
    default: return "#64748b";
  }
}

interface HotLeadsWidgetProps {
  leads: Lead[];
  /** Max number of leads to show (default: 5) */
  limit?: number;
}

export function HotLeadsWidget({ leads, limit = 5 }: HotLeadsWidgetProps) {
  const [, setLocation] = useLocation();
  const { isAgencyView } = useWorkspace();
  const prefix = isAgencyView ? "/agency" : "/subaccount";

  const hotLeads = useMemo(() => {
    // Filter out DND/opted-out leads
    const active = leads.filter(
      (l: any) =>
        l.conversion_status !== "DND" &&
        l.conversion_status !== "Lost" &&
        !l.opted_out
    );

    // Compute scores and sort descending
    const scored = active.map((l) => ({
      ...l,
      computed_score: computeLeadScore(l),
    }));

    scored.sort((a, b) => b.computed_score - a.computed_score);
    return scored.slice(0, limit);
  }, [leads, limit]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className="rounded-2xl border border-border bg-card shadow-sm flex flex-col"
      data-testid="hot-leads-widget"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-brand-yellow/10">
            <Flame className="w-4 h-4 text-brand-yellow" />
          </div>
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            Hot Leads
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setLocation(`${prefix}/contacts`)}
          className="text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          data-testid="hot-leads-view-all"
        >
          View All
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Lead list */}
      <div className="p-2 space-y-1" data-testid="hot-leads-list">
        {hotLeads.length === 0 ? (
          <div className="py-4">
            <DataEmptyState
              variant="leads"
              compact
              title="No hot leads"
              description="No active leads to display."
            />
          </div>
        ) : (
          hotLeads.map((lead: any) => {
            const scoreColor = getScoreColor(lead.computed_score);
            const statusColor = getStatusColor(
              lead.conversion_status || "New"
            );
            const fullName =
              lead.full_name ||
              `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
              "Unknown";
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => setLocation(`${prefix}/contacts/${lead.id}`)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl p-2.5 text-left group",
                  "hover:bg-muted/50 dark:hover:bg-muted/20 transition-all duration-200",
                  "cursor-pointer"
                )}
                data-testid={`hot-lead-${lead.id}`}
              >
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    backgroundColor: `${scoreColor.bg}`,
                    color: scoreColor.text,
                    border: `1.5px solid ${scoreColor.ring}30`,
                  }}
                >
                  {getInitials(fullName)}
                </div>

                {/* Name + stage */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {fullName}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span
                      className="text-[10px] font-medium truncate"
                      style={{ color: statusColor }}
                      data-testid={`hot-lead-stage-${lead.id}`}
                    >
                      {lead.conversion_status || "New"}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0"
                  style={{
                    backgroundColor: scoreColor.bg,
                  }}
                  data-testid={`hot-lead-score-${lead.id}`}
                >
                  <TrendingUp
                    className="w-3 h-3"
                    style={{ color: scoreColor.text }}
                  />
                  <span
                    className="text-xs font-black tabular-nums"
                    style={{ color: scoreColor.text }}
                  >
                    {lead.computed_score}
                  </span>
                </div>

                {/* Arrow on hover */}
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-all shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
