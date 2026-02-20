import { useMemo } from "react";
import {
  TrendingUp,
  CalendarIcon,
  MessageSquare,
  Users,
  Zap,
  BarChart3,
} from "lucide-react";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";

interface CampaignCardGridProps {
  campaigns: Campaign[];
  metrics: CampaignMetricsHistory[];
  loading?: boolean;
  searchValue?: string;
}

/** Status badge color mapping */
function getStatusColor(status: string): { bg: string; text: string; dot: string } {
  switch (status) {
    case "Active":
      return { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" };
    case "Draft":
      return { bg: "bg-slate-500/15", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" };
    case "Paused":
      return { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" };
    case "Completed":
    case "Finished":
      return { bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" };
    case "Archived":
    case "Inactive":
      return { bg: "bg-slate-400/10", text: "text-slate-500 dark:text-slate-400", dot: "bg-slate-400" };
    default:
      return { bg: "bg-slate-500/15", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" };
  }
}

/** Aggregate all metrics for a campaign into summary stats */
function aggregateCampaignMetrics(cMetrics: CampaignMetricsHistory[]) {
  if (cMetrics.length === 0) {
    return {
      totalLeadsTargeted: 0,
      totalMessagesSent: 0,
      responseRate: null as number | null,
      bookingRate: null as number | null,
    };
  }
  // For rates, use the latest snapshot (most recent metric_date)
  const sorted = [...cMetrics].sort((a, b) =>
    (b.metric_date || "").localeCompare(a.metric_date || "")
  );
  const latest = sorted[0];

  // Total leads targeted and messages sent = sum across all days
  const totalLeadsTargeted = cMetrics.reduce(
    (s, m) => s + (m.total_leads_targeted || 0),
    0
  );
  const totalMessagesSent = cMetrics.reduce(
    (s, m) => s + (m.total_messages_sent || 0),
    0
  );

  return {
    totalLeadsTargeted,
    totalMessagesSent,
    responseRate: Number(latest.response_rate_percent) || 0,
    bookingRate: Number(latest.booking_rate_percent) || 0,
  };
}

/** Single campaign metric pill */
function MetricPill({
  icon,
  label,
  value,
  color,
  "data-testid": testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  "data-testid"?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5" data-testid={testId}>
      <div className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider", color)}>
        {icon}
        {label}
      </div>
      <div className="text-lg font-black text-foreground tabular-nums leading-none">
        {value}
      </div>
    </div>
  );
}

/** Skeleton card for loading state */
function CampaignCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
        </div>
        <div className="h-5 w-16 bg-muted rounded-full ml-2 shrink-0" />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-6 w-12 bg-muted rounded" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-6 w-12 bg-muted rounded" />
        </div>
      </div>
      <div className="pt-3 border-t border-border grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-5 w-10 bg-muted rounded" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-5 w-10 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

export function CampaignCardGrid({
  campaigns,
  metrics,
  loading,
  searchValue,
}: CampaignCardGridProps) {
  // Group metrics by campaign id
  const metricsByCampaign = useMemo(() => {
    const map: Record<number, CampaignMetricsHistory[]> = {};
    for (const m of metrics) {
      const cid = Number(m.campaigns_id || (m as any).campaignsId || 0);
      if (!cid) continue;
      if (!map[cid]) map[cid] = [];
      map[cid].push(m);
    }
    return map;
  }, [metrics]);

  if (loading) {
    return (
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4"
        data-testid="campaign-card-grid-loading"
      >
        {[1, 2, 3, 4].map((i) => (
          <CampaignCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="p-4">
        <DataEmptyState
          variant="campaigns"
          title={searchValue ? "No campaigns found" : "No campaigns yet"}
          description={
            searchValue
              ? `No campaigns match "${searchValue}". Try a different search term.`
              : "Create your first campaign to start engaging with leads via WhatsApp."
          }
          data-testid="campaign-card-grid-empty"
        />
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4"
      data-testid="campaign-card-grid"
    >
      {campaigns.map((campaign) => {
        const cid = campaign.id || campaign.Id;
        const cMetrics = metricsByCampaign[cid] || [];
        const hasMetrics = cMetrics.length > 0;
        const agg = aggregateCampaignMetrics(cMetrics);
        const statusColors = getStatusColor(campaign.status);

        // Campaign initials for avatar
        const initials = (campaign.name || "?")
          .split(" ")
          .slice(0, 2)
          .map((w: string) => w[0]?.toUpperCase() ?? "")
          .join("");

        return (
          <div
            key={cid}
            className={cn(
              "rounded-2xl border border-border bg-card p-5 shadow-sm",
              "hover:shadow-md hover:border-primary/30 transition-all duration-200",
              "flex flex-col gap-0"
            )}
            data-testid={`campaign-card-${cid}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{
                    background: (campaign.status as string) === "Active"
                      ? "linear-gradient(135deg, #10b981, #059669)"
                      : (campaign.status as string) === "Paused"
                      ? "linear-gradient(135deg, #f59e0b, #d97706)"
                      : (campaign.status as string) === "Inactive" || (campaign.status as string) === "Archived"
                      ? "linear-gradient(135deg, #94a3b8, #64748b)"
                      : "linear-gradient(135deg, #6366f1, #4f46e5)",
                  }}
                >
                  {initials || <Zap className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <h4
                    className="text-sm font-bold text-foreground truncate leading-tight"
                    title={campaign.name}
                    data-testid={`campaign-name-${cid}`}
                  >
                    {campaign.name || "Unnamed Campaign"}
                  </h4>
                  {campaign.account_name && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {campaign.account_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <span
                className={cn(
                  "shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                  statusColors.bg,
                  statusColors.text
                )}
                data-testid={`campaign-status-${cid}`}
              >
                <span
                  className={cn("w-1.5 h-1.5 rounded-full inline-block", statusColors.dot)}
                />
                {campaign.status || "Unknown"}
              </span>
            </div>

            {/* Metrics */}
            {hasMetrics ? (
              <>
                {/* Response & booking rates */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <MetricPill
                    icon={<TrendingUp className="w-3 h-3" />}
                    label="Response"
                    value={`${agg.responseRate ?? 0}%`}
                    color="text-blue-500"
                    data-testid={`campaign-response-rate-${cid}`}
                  />
                  <MetricPill
                    icon={<CalendarIcon className="w-3 h-3" />}
                    label="Booking"
                    value={`${agg.bookingRate ?? 0}%`}
                    color="text-amber-500"
                    data-testid={`campaign-booking-rate-${cid}`}
                  />
                </div>

                {/* Leads targeted & messages sent */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <MetricPill
                    icon={<Users className="w-3 h-3" />}
                    label="Leads"
                    value={agg.totalLeadsTargeted.toLocaleString()}
                    color="text-violet-500"
                    data-testid={`campaign-leads-targeted-${cid}`}
                  />
                  <MetricPill
                    icon={<MessageSquare className="w-3 h-3" />}
                    label="Messages"
                    value={agg.totalMessagesSent.toLocaleString()}
                    color="text-slate-500"
                    data-testid={`campaign-messages-sent-${cid}`}
                  />
                </div>
              </>
            ) : (
              /* No metrics yet – show placeholder stats */
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <BarChart3 className="w-6 h-6 text-muted-foreground/40 mb-1.5" />
                <p className="text-[11px] text-muted-foreground">
                  No metrics yet
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Metrics appear once the campaign runs
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
