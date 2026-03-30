import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types/models";
import type { ContractFinancials } from "../useCampaignDetail";
import { getCampaignMetrics } from "../useCampaignDetail";

// ── Local helpers (not exported) ──────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtCurrencyDecimals(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function getRoiColor(roi: number | null): string {
  if (roi === null) return "text-muted-foreground";
  if (roi >= 100) return "text-emerald-600";
  if (roi >= 0) return "text-blue-600";
  return "text-rose-600";
}

// ── FinancialsWidget ──────────────────────────────────────────────────────────

export function FinancialsWidget({
  agg,
  campaign,
  contract,
  contractLoading,
  aiCosts,
  isAgencyUser,
  onGoToConfig,
}: {
  agg: ReturnType<typeof getCampaignMetrics>;
  campaign: Campaign;
  contract: ContractFinancials | null;
  contractLoading: boolean;
  aiCosts: { aiTokens: number; aiCostUsd: number } | null;
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
      {isAgencyUser && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-white dark:bg-white/[0.12] px-3 py-3">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">{t("financials.aiTokens")}</div>
            <div className="text-[18px] font-bold tabular-nums text-foreground">
              {aiCosts && aiCosts.aiTokens > 0 ? aiCosts.aiTokens.toLocaleString() : "—"}
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-white/[0.12] px-3 py-3">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">{t("financials.aiCost")}</div>
            <div className="text-[18px] font-bold tabular-nums text-foreground">
              {aiCosts && aiCosts.aiCostUsd > 0 ? fmtCurrencyDecimals(aiCosts.aiCostUsd) : "—"}
            </div>
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
