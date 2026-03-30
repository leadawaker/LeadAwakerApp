/**
 * CampaignMetricsPanel
 *
 * The "Summary" tab content of CampaignDetailView.
 * Contains: Pipeline/Donut widget, Key Metrics cards, Performance Trends chart,
 * Agenda, Activity Feed, Financials, ROI Trend chart, AI Summary, A/B Test card.
 *
 * Sub-components live in ./metricsWidgets/
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { DateRangeFilter, type DateRangeValue } from "@/components/crm/DateRangeFilter";
import { AgendaWidget } from "@/components/crm/AgendaWidget";
import { ActivityFeed } from "@/components/crm/ActivityFeed";
import type { ContractFinancials } from "./useCampaignDetail";
import { getCampaignMetrics } from "./useCampaignDetail";
import {
  PipelineCardWrapper,
  AnimatedMetricCard,
  FinancialsWidget,
  AISummaryWidget,
  ABTestCard,
} from "./metricsWidgets";

// ── Demo mode ─────────────────────────────────────────────────────────────────
// Inject mock data for specific campaigns shown to prospects (no real leads needed)

const DEMO_CAMPAIGN_IDS = new Set([36]);

const DEMO_PIPELINE_STAGES = [
  { key: "new",       count: 412 },
  { key: "contacted", count: 247 },
  { key: "responded", count: 387 },
  { key: "multi",     count: 89  },
  { key: "qualified", count: 63  },
  { key: "booked",    count: 31  },
  { key: "closed",    count: 12  },
  { key: "lost",      count: 6   },
];

const DEMO_AB_STATS = {
  split_ratio: 50,
  winner: "B",
  confidence: 0.87,
  leads_needed_for_95pct: 89,
  variants: {
    A: { leads: 612, response_rate: 0.29, booking_rate: 0.062, qualification_rate: 0.18, optout_rate: 0.04, avg_messages: 4.2, avg_response_time_min: 18 },
    B: { leads: 635, response_rate: 0.33, booking_rate: 0.104, qualification_rate: 0.22, optout_rate: 0.03, avg_messages: 3.8, avg_response_time_min: 14 },
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CampaignMetricsPanelProps {
  campaign: Campaign;
  filteredMetrics: CampaignMetricsHistory[];
  agg: ReturnType<typeof getCampaignMetrics>;
  animTrigger: number;
  dateRange: DateRangeValue;
  onDateRangeChange: (v: DateRangeValue) => void;
  campaignCreatedAt: string | null;
  dailyStats: { sentToday: number; dailyLimit: number; channel: string } | null;
  linkedContract: ContractFinancials | null;
  contractLoading: boolean;
  aiCosts: { aiTokens: number; aiCostUsd: number } | null;
  localAiSummary: string | null;
  localAiSummaryAt: string | null;
  onAiSummaryRefreshed: (summary: string, generatedAt: string) => void;
  isAgencyUser: boolean;
  onGoToConfig: () => void;
  compact?: boolean;
}

// ── CampaignMetricsPanel ──────────────────────────────────────────────────────

export function CampaignMetricsPanel({
  campaign,
  filteredMetrics,
  agg,
  animTrigger,
  dateRange,
  onDateRangeChange,
  campaignCreatedAt,
  dailyStats,
  linkedContract,
  contractLoading,
  aiCosts,
  localAiSummary,
  localAiSummaryAt,
  onAiSummaryRefreshed,
  isAgencyUser,
  onGoToConfig,
  compact = false,
}: CampaignMetricsPanelProps) {
  const { t } = useTranslation("campaigns");

  const sortedMetrics = useMemo(() =>
    [...filteredMetrics].sort((a, b) => (a.metric_date || "").localeCompare(b.metric_date || ""))
  , [filteredMetrics]);

  const leadsTrend    = sortedMetrics.map((m) => Number(m.total_leads_targeted)  || 0);
  const messagesTrend = sortedMetrics.map((m) => Number(m.total_messages_sent)    || 0);
  const responseTrend = sortedMetrics.map((m) => Number(m.response_rate_percent)  || 0);
  const bookingTrend  = sortedMetrics.map((m) => Number(m.booking_rate_percent)   || 0);

  const campaignId = campaign.id || (campaign as any).Id;
  const accountId = campaign.account_id || (campaign as any).Accounts_id;
  const isDemoMode = DEMO_CAMPAIGN_IDS.has(campaignId);

  return (
    <div className={cn(compact ? "flex flex-col gap-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[3px]", "max-w-[1386px] w-full mr-auto")}>

      {/* Row 1, Col 1: Pipeline + Donut */}
      <PipelineCardWrapper campaignId={campaignId} mockStages={isDemoMode ? DEMO_PIPELINE_STAGES : undefined} />

      {/* Row 1, Col 2: Key Metrics + Performance Trends */}
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden" data-testid="campaign-detail-view-metrics">
        <div className="flex items-center justify-between gap-2 min-h-[36px]">
          <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.keyMetrics")}</span>
          <DateRangeFilter
            value={dateRange}
            onChange={onDateRangeChange}
            allFrom={campaignCreatedAt ? new Date(campaignCreatedAt) : undefined}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AnimatedMetricCard numericValue={agg.totalLeadsTargeted} displayValue={agg.totalLeadsTargeted.toLocaleString()} label={t("summary.leadsTargeted")} animTrigger={animTrigger} borderColor="#6366F1" trendData={leadsTrend} />
          <AnimatedMetricCard numericValue={agg.totalMessagesSent}  displayValue={agg.totalMessagesSent.toLocaleString()}  label={t("summary.messagesSent")}  animTrigger={animTrigger} borderColor="#22D3EE" trendData={messagesTrend} />
          <AnimatedMetricCard numericValue={agg.responseRate ?? 0}  displayValue={agg.responseRate != null ? `${agg.responseRate}%` : "—"} label={t("summary.responsePercent")} animTrigger={animTrigger} borderColor="#FBBF24" trendData={responseTrend} />
          <AnimatedMetricCard numericValue={agg.bookingRate  ?? 0}  displayValue={agg.bookingRate  != null ? `${agg.bookingRate}%`  : "—"} label={t("summary.bookingPercent")}  animTrigger={animTrigger} borderColor="#34D399" trendData={bookingTrend} />
        </div>

        {/* Performance Trends chart */}
        <div className="mt-auto pt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("summary.performanceTrends")}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-3 h-[2px] rounded-full inline-block bg-[#3ACBDF]" />
                Response %
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-3 h-[2px] rounded-full inline-block bg-[#f5be0b]" />
                Booking %
              </span>
            </div>
          </div>
          <div className="h-[210px]" key={animTrigger} data-testid="campaign-detail-view-trends">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sortedMetrics.map((m) => ({
                  date: m.metric_date ? new Date(m.metric_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "",
                  "Response %": Number(m.response_rate_percent) || 0,
                  "Booking %":  Number(m.booking_rate_percent)  || 0,
                }))}
                margin={{ top: 15, right: 4, bottom: 0, left: -39 }}
              >
                <defs>
                  <linearGradient id="fillResponse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9a9a9a" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#a3a3a3" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillBooking" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f5b70b" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f5be0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid rgba(0,0,0,0.1)", backgroundColor: "rgba(255,255,255,0.95)", color: "#111", fontSize: "11px", padding: "6px 10px" }} />
                <Area type="monotone" dataKey="Response %" stroke="#a0a0a0" strokeWidth={2} fill="url(#fillResponse)" dot={false} activeDot={{ r: 3 }} />
                <Area type="monotone" dataKey="Booking %"  stroke="#f5be0b" strokeWidth={2} fill="url(#fillBooking)"  dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 1, Col 3: Up Next */}
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-y-auto" data-testid="campaign-detail-view-agenda">
        <div className="flex items-center min-h-[32px] shrink-0">
          <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.upNext")}</span>
        </div>
        <AgendaWidget accountId={accountId} className="flex-1 min-h-0 bg-transparent" hideHeader />
      </div>

      {/* Row 2, Col 1: Activity Feed or A/B Test */}
      {campaign.ab_enabled ? (
        <ABTestCard campaign={campaign} mockStats={isDemoMode ? DEMO_AB_STATS : undefined} />
      ) : (
        <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden max-h-[680px]" data-testid="campaign-detail-view-activity">
          <div className="flex items-center min-h-[36px] shrink-0">
            <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.activity")}</span>
          </div>
          {dailyStats && (
            <div className="bg-white/90 dark:bg-white/[0.06] rounded-lg px-4 py-3 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Daily Capacity</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {dailyStats.sentToday.toLocaleString()} / {dailyStats.dailyLimit.toLocaleString()} · resets midnight
                </span>
              </div>
              <div className="h-1.5 w-full bg-black/[0.07] dark:bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (dailyStats.sentToday / Math.max(1, dailyStats.dailyLimit)) * 100)}%`,
                    backgroundColor:
                      dailyStats.sentToday / Math.max(1, dailyStats.dailyLimit) >= 0.9 ? "#ef4444" :
                      dailyStats.sentToday / Math.max(1, dailyStats.dailyLimit) >= 0.7 ? "#f59e0b" : "#3ACBDF",
                  }}
                />
              </div>
            </div>
          )}
          <ActivityFeed accountId={accountId} className="flex-1 min-h-0" />
        </div>
      )}

      {/* Row 2, Col 2: Financials + ROI Trend */}
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden max-h-[680px]" data-testid="campaign-detail-view-conversions">
        <div className="flex items-center min-h-[36px]">
          <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.financials")}</span>
        </div>
        <FinancialsWidget
          agg={agg}
          campaign={campaign}
          contract={linkedContract}
          contractLoading={contractLoading}
          aiCosts={aiCosts}
          isAgencyUser={isAgencyUser}
          onGoToConfig={onGoToConfig}
        />
        <div className="mt-auto border-t border-border/20 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">{t("summary.roiTrend")}</span>
          <div className="h-[180px]" data-testid="campaign-detail-view-roi">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sortedMetrics.map((m) => ({
                  date: m.metric_date ? new Date(m.metric_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "",
                  "ROI %": Number(m.roi_percent) || 0,
                }))}
                margin={{ top: 4, right: 4, bottom: 4, left: -20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid rgba(0,0,0,0.1)", backgroundColor: "rgba(255,255,255,0.95)", color: "#111", fontSize: "11px", padding: "6px 10px" }} />
                <Line type="monotone" dataKey="ROI %" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2, Col 3: AI Summary */}
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden max-h-[680px]" data-testid="campaign-detail-view-ai-summary">
        <div className="flex items-center min-h-[36px] shrink-0">
          <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.aiAnalysis")}</span>
        </div>
        <AISummaryWidget
          campaign={campaign}
          summary={localAiSummary}
          generatedAt={localAiSummaryAt}
          onRefreshed={onAiSummaryRefreshed}
        />
      </div>

    </div>
  );
}
