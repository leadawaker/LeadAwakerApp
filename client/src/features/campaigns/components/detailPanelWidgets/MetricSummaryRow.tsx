import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { CampaignMetricsHistory } from "@/types/models";

/** Get ROI color class based on value */
function getRoiColor(roi: number): string {
  if (roi >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (roi >= 0) return "text-blue-600 dark:text-blue-400";
  return "text-rose-600 dark:text-rose-400";
}

/** Latest metric summary row */
export function MetricSummaryRow({
  metrics,
}: {
  metrics: CampaignMetricsHistory[];
}) {
  const { t } = useTranslation("campaigns");
  const latest = useMemo(() => {
    if (metrics.length === 0) return null;
    return [...metrics].sort((a, b) =>
      (b.metric_date || "").localeCompare(a.metric_date || "")
    )[0];
  }, [metrics]);

  const totals = useMemo(() => {
    return metrics.reduce(
      (acc, m) => ({
        leadsTargeted: acc.leadsTargeted + (Number(m.total_leads_targeted) || 0),
        messagesSent: acc.messagesSent + (Number(m.total_messages_sent) || 0),
        responses: acc.responses + (Number(m.total_responses_received) || 0),
        bookings: acc.bookings + (Number(m.bookings_generated) || 0),
        cost: acc.cost + (Number(m.total_cost) || 0),
      }),
      { leadsTargeted: 0, messagesSent: 0, responses: 0, bookings: 0, cost: 0 }
    );
  }, [metrics]);

  if (!latest) return null;

  const roiValue = Number(latest.roi_percent) || 0;
  const costPerLead = Number(latest.cost_per_lead) || 0;
  const costPerBooking = Number(latest.cost_per_booking) || 0;

  const pills: { label: string; value: string; color: string; testId?: string }[] = [
    { label: t("panel.metrics.leads"), value: totals.leadsTargeted.toLocaleString(), color: "text-violet-600 dark:text-violet-400" },
    { label: t("panel.metrics.messages"), value: totals.messagesSent.toLocaleString(), color: "text-blue-600 dark:text-blue-400" },
    { label: t("panel.metrics.responses"), value: totals.responses.toLocaleString(), color: "text-cyan-600 dark:text-cyan-400" },
    { label: t("panel.metrics.bookings"), value: totals.bookings.toLocaleString(), color: "text-amber-600 dark:text-amber-400" },
    {
      label: t("panel.metrics.responseRate"),
      value: `${Number(latest.response_rate_percent) || 0}%`,
      color: "text-indigo-600 dark:text-indigo-400",
    },
    {
      label: t("panel.metrics.bookingRate"),
      value: `${Number(latest.booking_rate_percent) || 0}%`,
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      label: t("panel.metrics.totalCost"),
      value: `$${totals.cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      color: "text-rose-600 dark:text-rose-400",
      testId: "campaign-detail-total-cost",
    },
    {
      label: t("panel.metrics.costPerLead"),
      value: `$${costPerLead.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
      color: "text-orange-600 dark:text-orange-400",
      testId: "campaign-detail-cost-per-lead",
    },
    {
      label: t("panel.metrics.costPerBooking"),
      value: costPerBooking > 0
        ? `$${costPerBooking.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        : "—",
      color: "text-pink-600 dark:text-pink-400",
      testId: "campaign-detail-cost-per-booking",
    },
    {
      label: t("panel.metrics.roi"),
      value: `${roiValue >= 0 ? "+" : ""}${roiValue}%`,
      color: getRoiColor(roiValue),
      testId: "campaign-detail-roi-percent",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-2" data-testid="campaign-detail-metrics-summary">
      {pills.map((p) => (
        <div
          key={p.label}
          className="rounded-xl bg-muted/40 p-2.5 text-center"
          data-testid={p.testId}
        >
          <div className={cn("text-sm font-black tabular-nums leading-tight", p.color)}>{p.value}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5 font-semibold uppercase tracking-wider">
            {p.label}
          </div>
        </div>
      ))}
    </div>
  );
}
