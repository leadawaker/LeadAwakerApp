// The call review's summary row: duration, cost (breakdown in a tooltip), median and
// slowest reply delay, and how many tools ran. Delays and estimated costs carry "≈". Small
// type in one row: this is detail, not the page's headline.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { costParts, formatCost, formatReviewDelay, formatTime, formatUsd, type CallReview } from "./reviewMath";

const value = { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

function Stat({ label, children, hint, testId }: { label: string; children: ReactNode; hint?: string; testId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }} title={hint} data-testid={testId}>
      <span className="eyebrow eyebrow-sm" style={{ fontSize: 8, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{label}</span>
      <span style={value}>{children}</span>
    </div>
  );
}

function CostValue({ review }: { review: CallReview }) {
  const { t } = useTranslation("voiceTab");
  const text = formatCost(review.cost, t("test.panel.review.unknown"));
  const parts = costParts(review.cost);
  if (!review.cost) return <>{text}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" style={{ ...value, background: "none", border: "none", padding: 0, cursor: "help", textDecoration: "underline dotted var(--mute-2)", textUnderlineOffset: 3 }}
          aria-label={`${t("test.panel.review.cost")}: ${text}`}>
          {text}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" style={{ maxWidth: 240 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, fontFamily: "var(--mono)", fontSize: 11 }}>
          {parts.map((p) => (
            <span key={p.key} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span>{t(`test.panel.review.costPart.${p.key}`)}</span><span>{formatUsd(p.usd)}</span>
            </span>
          ))}
          <span style={{ color: "var(--mute)" }}>{t("test.panel.review.minutes", { n: review.cost.minutes.toFixed(1) })}</span>
          {review.cost.estimate && <span style={{ color: "var(--mute)", fontFamily: "var(--sans)" }}>{t("test.panel.review.costEstimate")}</span>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ReviewSummary({ review, showCost = true }: {
  review: CallReview;
  /** The Calls page leaves the cost out for anyone but the Owner (the server never sends it to them). */
  showCost?: boolean;
}) {
  const { t } = useTranslation("voiceTab");
  const unknown = t("test.panel.review.unknown");
  const delayHint = t("test.panel.review.delaysHint");
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px 12px", flexWrap: "nowrap", minWidth: 0 }} data-testid="voice-test-review-summary">
      <Stat label={t("test.panel.review.duration")} testId="voice-test-review-duration">{formatTime(review.durationSeconds)}</Stat>
      {showCost && <Stat label={t("test.panel.review.cost")} testId="voice-test-review-cost"><CostValue review={review} /></Stat>}
      <Stat label={t("test.panel.review.median")} hint={delayHint} testId="voice-test-review-median">
        {formatReviewDelay(review.summary.medianDelayMs, unknown)}
      </Stat>
      <Stat label={t("test.panel.review.slowest")} hint={delayHint} testId="voice-test-review-slowest">
        {formatReviewDelay(review.summary.slowestDelayMs, unknown)}
      </Stat>
      <Stat label={t("test.panel.review.tools")} testId="voice-test-review-tools">{review.summary.toolCount}</Stat>
    </div>
  );
}
