/**
 * CampaignMetricsPanel
 *
 * The "Summary" tab content of CampaignDetailView.
 * Contains: Pipeline/Donut widget, Key Metrics cards, Performance Trends chart,
 * Agenda, Activity Feed, Financials, ROI Trend chart, AI Summary, A/B Test card.
 */
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Zap,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  FlaskConical,
  Percent,
  Clock,
} from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { DonutChart } from "@/components/ui/donut-chart";
import { motion, AnimatePresence } from "framer-motion";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { renderRichText } from "@/lib/richTextUtils";
import { apiFetch } from "@/lib/apiUtils";
import { useTranslation as useT } from "react-i18next";
import { DateRangeFilter, type DateRangeValue } from "@/components/crm/DateRangeFilter";
import { useLeads } from "@/hooks/useApiData";
import { AgendaWidget } from "@/components/crm/AgendaWidget";
import { ActivityFeed } from "@/components/crm/ActivityFeed";
import { PIPELINE_HEX } from "@/lib/avatarUtils";
import type { ContractFinancials } from "./useCampaignDetail";
import { getCampaignMetrics } from "./useCampaignDetail";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

function getRoiColor(roi: number | null): string {
  if (roi === null) return "text-muted-foreground";
  if (roi >= 100) return "text-emerald-600";
  if (roi >= 0) return "text-blue-600";
  return "text-rose-600";
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtCurrencyDecimals(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// ── Count-up animation hook ───────────────────────────────────────────────────
function useCountUp(target: number, duration = 900, trigger = 0): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, trigger]);
  return value;
}

// ── Funnel stage definitions ──────────────────────────────────────────────────

const FUNNEL_STAGES = [
  { key: "new",       labelKey: "funnelStages.new",               dbValue: "New" },
  { key: "contacted", labelKey: "funnelStages.contacted",         dbValue: "Contacted" },
  { key: "responded", labelKey: "funnelStages.responded",         dbValue: "Responded" },
  { key: "multi",     labelKey: "funnelStages.multipleResponses", dbValue: "Multiple Responses" },
  { key: "qualified", labelKey: "funnelStages.qualified",         dbValue: "Qualified" },
  { key: "booked",    labelKey: "funnelStages.callBooked",        dbValue: "Booked" },
  { key: "closed",    labelKey: "funnelStages.closed",            dbValue: "Closed" },
  { key: "lost",      labelKey: "funnelStages.lost",              dbValue: "Lost" },
  { key: "dnd",       labelKey: "funnelStages.dnd",               dbValue: "DND" },
] as const;

function tintColor(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgb(${Math.round(r+(255-r)*amount)},${Math.round(g+(255-g)*amount)},${Math.round(b+(255-b)*amount)})`;
}

// ── PipelineAndDonutWidget ────────────────────────────────────────────────────

function PipelineAndDonutWidget({ campaignId }: { campaignId: number }) {
  const { t } = useTranslation("campaigns");
  const { leads, loading } = useLeads(undefined, campaignId);
  const hadDataOnce = useRef(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [lockedKey, setLockedKey] = useState<string | null>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    setHoveredKey(null);
    setLockedKey(null);
    hasAnimated.current = false;
    hadDataOnce.current = false;
  }, [campaignId]);

  const activeKey = hoveredKey ?? lockedKey;

  const stages = useMemo(() => {
    return FUNNEL_STAGES.map((s) => ({
      ...s,
      label: t(s.labelKey),
      color: PIPELINE_HEX[s.dbValue] || "#6B7280",
      count: leads.filter((l: any) => l.conversion_status === s.dbValue).length,
    }));
  }, [leads, t]);

  const total = stages.reduce((s, st) => s + st.count, 0);
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const hasData = stages.some((s) => s.count > 0);

  const donutData = useMemo(() =>
    stages.filter((s) => s.count > 0).map((s) => ({
      key: s.key,
      label: s.label,
      value: s.count,
      color: s.color,
    }))
  , [stages]);

  const activeStage = activeKey ? stages.find((s) => s.key === activeKey) : null;
  const displayCount = activeStage ? activeStage.count : total;
  const displayLabel = activeStage ? activeStage.label : t("summary.totalLeads");

  const skipAnim = hasAnimated.current;
  useEffect(() => {
    if (hasData && !hasAnimated.current) hasAnimated.current = true;
    if (hasData || leads.length > 0) hadDataOnce.current = true;
  });

  if (loading && !hadDataOnce.current) {
    return (
      <>
        <div className="flex justify-center">
          <div className="w-[170px] h-[170px] rounded-full border-[22px] border-foreground/[0.06] animate-pulse" />
        </div>
        <div className="border-t border-border/15" />
        <div className="flex flex-col flex-1 justify-between w-full py-1">
          {FUNNEL_STAGES.map((s) => (
            <div key={s.key} className="flex flex-col gap-0.5">
              <div className="h-3 w-2/3 rounded bg-foreground/[0.06] animate-pulse" />
              <div className="h-[4px] w-full rounded-full bg-foreground/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (!hasData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
        <p className="text-[11px] text-foreground/40">{t("summary.noPipelineData")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-center" style={{ marginTop: 7 }}>
        <DonutChart
          data={donutData}
          size={154}
          strokeWidth={22}
          animationDuration={1.0}
          animationDelayPerSegment={0.04}
          skipAnimation={skipAnim}
          activeKey={activeKey}
          onSegmentHover={(seg) => setHoveredKey(seg?.key ?? null)}
          onSegmentClick={(seg) => setLockedKey(prev => prev !== null ? null : (seg.key ?? null))}
          onBackgroundClick={() => setLockedKey(null)}
          centerContent={
            <AnimatePresence mode="wait">
              <motion.div
                key={displayLabel}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex flex-col items-center justify-center text-center pointer-events-none select-none"
              >
                <span className="text-[10px] font-medium uppercase tracking-widest text-foreground/35 mb-0.5 leading-none max-w-[110px] truncate">
                  {displayLabel}
                </span>
                <span className="text-[26px] font-black tabular-nums leading-none text-foreground">
                  {displayCount.toLocaleString()}
                </span>
                {activeStage && total > 0 && (
                  <span className="text-[11px] font-medium text-foreground/40 mt-0.5 leading-none">
                    {((activeStage.count / total) * 100).toFixed(0)}%
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          }
        />
      </div>
      <div className="flex flex-col flex-1 justify-between w-full">
        {stages.map((stage) => {
          const isActive = activeKey === stage.key;
          const isDimmed = activeKey !== null && !isActive;
          const hasCount = stage.count > 0;
          const widthPct = hasCount ? Math.max((stage.count / maxCount) * 100, 4) : 0;
          const pct = total > 0 && hasCount ? ((stage.count / total) * 100).toFixed(0) : null;
          const barColor = isDimmed ? tintColor(stage.color, 0.72) : stage.color;
          const barH = isActive ? "22px" : "20px";

          return (
            <div
              key={stage.key}
              className="flex flex-col gap-0.5 cursor-pointer"
              onMouseEnter={() => setHoveredKey(hasCount ? stage.key : null)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => { if (hasCount) setLockedKey(prev => prev !== null ? null : stage.key); }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium truncate" style={{ color: "rgba(0,0,0,0.55)", transition: "color 150ms ease" }}>
                  {stage.label}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: isDimmed ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.75)", transition: "color 150ms ease" }}>
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="w-full rounded-full overflow-hidden bg-foreground/[0.03] relative" style={{ height: barH, transition: "height 250ms ease" }}>
                {hasCount && (
                  <div
                    className="h-full rounded-full relative"
                    style={{ width: `${widthPct}%`, backgroundColor: barColor, transition: "background-color 150ms ease, width 300ms ease" }}
                  >
                    {pct && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white tabular-nums select-none"
                        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)", opacity: isDimmed ? 0.5 : 1, transition: "opacity 150ms ease" }}
                      >
                        {pct}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PipelineCardWrapper({ campaignId }: { campaignId: number }) {
  const { t } = useTranslation("campaigns");
  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden" data-testid="campaign-detail-view-funnel">
      <div className="flex items-center min-h-[36px]">
        <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.pipeline")}</span>
      </div>
      <PipelineAndDonutWidget campaignId={campaignId} />
    </div>
  );
}

// ── AnimatedMetricCard ────────────────────────────────────────────────────────

function AnimatedMetricCard({ numericValue, displayValue, label, animTrigger, borderColor, trendData }: {
  numericValue: number;
  displayValue: string;
  label: string;
  animTrigger: number;
  borderColor?: string;
  trendData?: number[];
}) {
  const isPercent = displayValue.endsWith("%");
  const isDash = displayValue === "—";
  const animated = useCountUp(isDash ? 0 : numericValue, 900, animTrigger);
  const display = isDash ? "—" : isPercent ? `${animated}%` : animated.toLocaleString();
  const showSparkline = trendData && trendData.length > 1;
  return (
    <div
      className={cn("rounded-xl bg-white dark:bg-white/[0.12] p-4 md:p-8 flex flex-col items-center justify-center text-center", borderColor && "border-t-2")}
      style={borderColor ? { borderTopColor: borderColor } : undefined}
    >
      <div className="text-[22px] md:text-[28px] font-black text-foreground tabular-nums leading-none">{display}</div>
      <div className="text-[10px] text-foreground/40 uppercase tracking-wider mt-1.5">{label}</div>
      {showSparkline && (
        <svg width="80" height="20" viewBox="0 0 80 20" className="mt-2 opacity-50">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={(() => {
              const min = Math.min(...trendData);
              const max = Math.max(...trendData);
              const range = max - min || 1;
              return trendData
                .map((v, i) => {
                  const x = (i / (trendData.length - 1)) * 80;
                  const y = 18 - ((v - min) / range) * 16;
                  return `${x},${y}`;
                })
                .join(" ");
            })()}
          />
        </svg>
      )}
    </div>
  );
}

// ── FinancialsWidget ──────────────────────────────────────────────────────────

function FinancialsWidget({
  agg,
  campaign,
  contract,
  contractLoading,
  isAgencyUser,
  onGoToConfig,
}: {
  agg: ReturnType<typeof getCampaignMetrics>;
  campaign: Campaign;
  contract: ContractFinancials | null;
  contractLoading: boolean;
  isAgencyUser: boolean;
  onGoToConfig: () => void;
}) {
  const { t } = useTranslation("campaigns");

  const valuePB = Number(contract?.value_per_booking ?? campaign.value_per_booking ?? 0) || 0;
  const paymentTrigger = contract?.payment_trigger ?? null;
  const monthlyFee = Number(contract?.monthly_fee ?? 0) || 0;
  const fixedFeeAmt = Number(contract?.fixed_fee_amount ?? 0) || 0;

  const totalCost = agg.totalCost ?? 0;
  const costPerBooking = agg.costPerBooking ?? 0;
  const bookings = agg.bookings ?? 0;

  const campaignMonths = useMemo(() => {
    if (!campaign.start_date) return 1;
    const start = new Date(campaign.start_date);
    const end = campaign.end_date ? new Date(campaign.end_date) : new Date();
    const diffMs = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
  }, [campaign.start_date, campaign.end_date]);

  const projectedRevenue = useMemo(() => {
    let rev = bookings * valuePB;
    if (monthlyFee > 0) rev += monthlyFee * campaignMonths;
    if (fixedFeeAmt > 0) rev += fixedFeeAmt;
    return rev;
  }, [bookings, valuePB, monthlyFee, campaignMonths, fixedFeeAmt]);

  const computedRoi = useMemo(() => {
    if (totalCost <= 0) return null;
    return ((projectedRevenue - totalCost) / totalCost) * 100;
  }, [projectedRevenue, totalCost]);

  const roiValue = computedRoi ?? agg.roiPercent;
  const hasContractOrValue = contract !== null || valuePB > 0;

  if (contractLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
      {isAgencyUser && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-white dark:bg-white/[0.12] px-3 py-3">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">{t("financials.totalSpend")}</div>
            <div className="text-[18px] font-bold tabular-nums text-foreground">{fmtCurrency(totalCost)}</div>
          </div>
          <div className="rounded-xl bg-white dark:bg-white/[0.12] px-3 py-3">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">{t("financials.costPerBooking")}</div>
            <div className="text-[18px] font-bold tabular-nums text-foreground">{fmtCurrencyDecimals(costPerBooking)}</div>
          </div>
        </div>
      )}
      {isAgencyUser && hasContractOrValue && (
        <div className="rounded-xl bg-white dark:bg-white/[0.12] px-3 py-3">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider">{t("financials.projectedRevenue")}</div>
            {paymentTrigger === "sale_closed" && (
              <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{t("financials.est")}</span>
            )}
          </div>
          <div className="text-[22px] font-bold tabular-nums text-foreground">{fmtCurrency(projectedRevenue)}</div>
        </div>
      )}
      {!hasContractOrValue && (
        <button
          onClick={onGoToConfig}
          className="flex items-center gap-1.5 text-[11px] text-brand-indigo font-medium hover:underline mt-1"
        >
          <ArrowRight className="w-3 h-3" />
          {t("financials.linkContractPrompt")}
        </button>
      )}
      <div className="rounded-xl bg-white dark:bg-white/[0.12] px-3 py-3">
        <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">{t("financials.returnOnInvestment")}</div>
        <div className={cn("text-[28px] font-black tabular-nums leading-none", getRoiColor(roiValue))}>
          {roiValue != null ? `${roiValue >= 0 ? "+" : ""}${roiValue.toFixed(0)}%` : "—"}
        </div>
      </div>
    </div>
  );
}

// ── AISummaryWidget ───────────────────────────────────────────────────────────

function AISummaryWidget({ campaign, summary, generatedAt, onRefreshed }: {
  campaign: Campaign;
  summary: string | null;
  generatedAt: string | null;
  onRefreshed: (summary: string, generatedAt: string) => void;
}) {
  const { t, i18n } = useTranslation("campaigns");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedAt = useMemo(() => {
    if (!generatedAt) return null;
    try {
      return new Date(generatedAt).toLocaleString(undefined, {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return null; }
  }, [generatedAt]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const httpRes = await apiFetch(`/api/campaigns/${campaign.id || (campaign as any).Id}/generate-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: i18n.language?.split("-")[0] || "en" }),
      });
      const res = await httpRes.json() as any;
      if (res.error === "NO_GROQ_API_KEY") { setError(t("summary.groqApiKeyMissing")); return; }
      if (res.error) { setError(t("summary.generateFailed")); return; }
      onRefreshed(res.summary, res.generated_at);
    } catch {
      setError(t("summary.networkError"));
    } finally {
      setLoading(false);
    }
  }, [campaign, onRefreshed, i18n.language, t]);

  const paragraphs = useMemo(() => {
    if (!summary) return [];
    return summary.split(/\n\n+/).filter(p => p.trim().length > 0);
  }, [summary]);

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        {formattedAt ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-foreground/35 tabular-nums">{t("summary.lastRun", { date: formattedAt })}</span>
          </div>
        ) : (
          <span className="text-[10px] text-foreground/30 italic">{t("summary.noAnalysisYet")}</span>
        )}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={cn(
            "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9",
            loading
              ? "border-brand-indigo/30 text-brand-indigo/50 cursor-not-allowed"
              : "border-brand-indigo/40 text-brand-indigo hover:text-brand-indigo hover:max-w-[140px]"
          )}
        >
          {loading
            ? <div className="w-4 h-4 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin shrink-0" />
            : <Sparkles className="h-4 w-4 shrink-0" />
          }
          <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {summary ? t("summary.regenerate") : t("summary.generate")}
          </span>
        </button>
      </div>
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200/60 px-3 py-2.5 text-[11px] text-rose-600 shrink-0">
          {error}
        </div>
      )}
      {paragraphs.length > 0 ? (
        <div className="flex flex-col gap-3 text-[12px] leading-relaxed text-foreground/75">
          {paragraphs.map((p, i) => (
            <p key={i} className={cn(i === 0 && "font-medium text-foreground/85")}>{renderRichText(p)}</p>
          ))}
        </div>
      ) : !loading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
          <div className="w-10 h-10 rounded-2xl bg-brand-indigo/8 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-brand-indigo/50" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-foreground/50">{t("summary.noAiAnalysis")}</p>
            <p className="text-[11px] text-foreground/35 mt-0.5">{t("summary.aiRunsNightly")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ABTestCard ────────────────────────────────────────────────────────────────

function ABTestCard({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation("campaigns");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/campaigns/${campaign.id}/ab-stats`, { credentials: "include" })
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [campaign.id]);

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-y-auto min-h-0 max-h-[680px]" data-testid="campaign-detail-view-ab">
        <div className="flex items-center min-h-[36px] shrink-0">
          <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("abTesting.title")}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground text-xs">Loading...</div>
        </div>
      </div>
    );
  }

  const hasData = stats?.variants && (stats.variants.A || stats.variants.B);

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-y-auto min-h-0 max-h-[680px]" data-testid="campaign-detail-view-ab">
      <div className="flex items-center justify-between min-h-[36px] shrink-0">
        <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("abTesting.title")}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {stats?.split_ratio != null ? `${100 - stats.split_ratio}/${stats.split_ratio}` : "50/50"}
        </span>
      </div>
      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <FlaskConical className="w-8 h-8 opacity-20" />
          <span className="text-xs">{t("abTesting.noTest")}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            {(["A", "B"] as const).map((v) => {
              const isWinner = stats.winner === v;
              return (
                <div key={v} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-sm ${v === "A" ? "bg-indigo-500" : "bg-transparent ring-1 ring-indigo-500"}`} />
                  <span className={`text-xs font-medium ${isWinner ? "text-amber-400" : "text-foreground"}`}>
                    {v}{isWinner ? " ✦" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{stats.variants[v]?.leads ?? 0} leads</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-3">
            {[
              { key: "response",   label: t("abTesting.response"),          field: "response_rate",          pct: true },
              { key: "qual",       label: t("abTesting.qualification"),      field: "qualification_rate",      pct: true },
              { key: "booking",    label: t("abTesting.booking"),            field: "booking_rate",            pct: true },
              { key: "optout",     label: t("abTesting.optOut"),             field: "optout_rate",             pct: true,  invert: true },
              { key: "avgMsgs",    label: t("abTesting.avgMessages"),        field: "avg_messages",            pct: false, invert: true },
              { key: "avgTime",    label: t("abTesting.avgResponseTime"),    field: "avg_response_time_min",   pct: false, suffix: "m", invert: true },
            ].map(({ key, label, field, pct, invert, suffix }) => {
              const a = stats.variants.A?.[field] ?? 0;
              const b = stats.variants.B?.[field] ?? 0;
              const max = Math.max(a, b) || 1;
              const fmt = (v: number) => pct ? `${(v * 100).toFixed(0)}%` : `${v.toFixed(1)}${suffix ?? ""}`;
              const better = invert ? (a < b && a > 0 ? "A" : b < a && b > 0 ? "B" : null) : (a > b ? "A" : b > a ? "B" : null);
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
                    {better && <span className="text-[10px] text-amber-400 font-semibold">{better} ✦</span>}
                  </div>
                  {(["A", "B"] as const).map((v) => {
                    const val = v === "A" ? a : b;
                    const wPct = pct ? val * 100 : (max > 0 ? (val / max) * 100 : 0);
                    const w = Math.max(wPct, val > 0 ? 6 : 0);
                    const isSolid = v === "A";
                    const text = fmt(val);
                    return (
                      <div key={v} className="relative h-6">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${isSolid ? "bg-indigo-500" : "border border-indigo-500/60 bg-indigo-500/8"}`}
                          style={{ width: `${w}%`, minWidth: w > 0 ? "24px" : "0" }}
                        />
                        {isSolid ? (
                          <>
                            <div className="absolute inset-0 flex items-center px-3 overflow-hidden" style={{ width: `${w}%`, minWidth: w > 0 ? "24px" : "0" }}>
                              <span className="font-mono text-[11px] font-medium text-white whitespace-nowrap">{text}</span>
                            </div>
                            <div className="absolute inset-0 flex items-center px-3 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${w}%)` }}>
                              <span className="font-mono text-[11px] font-medium text-foreground whitespace-nowrap">{text}</span>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="font-mono text-[11px] font-medium text-foreground">{text}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {stats.confidence > 0 && (
            <div className="flex flex-col gap-2 pt-3 border-t border-border/30">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("abTesting.confidence")}</span>
                <span className={`font-mono font-semibold ${stats.confidence >= 0.95 ? "text-emerald-500" : stats.confidence >= 0.7 ? "text-amber-500" : "text-indigo-400"}`}>
                  {(stats.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-border/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${stats.confidence * 100}%`,
                    background: stats.confidence >= 0.95
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : stats.confidence >= 0.7
                        ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                        : "linear-gradient(90deg, #6366f1, #818cf8)",
                  }}
                />
              </div>
              {stats.leads_needed_for_95pct > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {t("abTesting.needMore", { count: stats.leads_needed_for_95pct })}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── CampaignMetricsPanel (main export) ────────────────────────────────────────

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
  localAiSummary: string | null;
  localAiSummaryAt: string | null;
  onAiSummaryRefreshed: (summary: string, generatedAt: string) => void;
  isAgencyUser: boolean;
  onGoToConfig: () => void;
  compact?: boolean;
}

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

  return (
    <div className={cn(compact ? "flex flex-col gap-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[3px]", "max-w-[1386px] w-full mr-auto")}>

      {/* Row 1, Col 1: Pipeline + Donut */}
      <PipelineCardWrapper campaignId={campaignId} />

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
        <AgendaWidget accountId={undefined} className="flex-1 min-h-0 bg-transparent" hideHeader />
      </div>

      {/* Row 2, Col 1: Activity Feed or A/B Test */}
      {campaign.ab_enabled ? (
        <ABTestCard campaign={campaign} />
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
          <ActivityFeed accountId={undefined} className="flex-1 min-h-0" />
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
