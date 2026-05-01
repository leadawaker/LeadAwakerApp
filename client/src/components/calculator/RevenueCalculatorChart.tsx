import { useTranslation } from "react-i18next";
import { ScenarioResult, HoveredDot } from "./useRevenueCalculator";

interface Props {
  results: ScenarioResult[];
  selectedScenario: number;
  effectiveDealValue: number;
  totalAdSpend: number;
  dealsPerWeek: number;
  formatCurrency: (v: number) => string;
  hoveredDot: HoveredDot | null;
  setHoveredDot: (v: HoveredDot | null) => void;
}

export function RevenueCalculatorChart({
  results, selectedScenario, effectiveDealValue, totalAdSpend,
  dealsPerWeek, formatCurrency, hoveredDot, setHoveredDot,
}: Props) {
  const { t } = useTranslation("home");
  const closed = results[selectedScenario].closed;
  const breakevenDeal = effectiveDealValue > 0 ? Math.ceil(totalAdSpend / effectiveDealValue) : 0;
  const totalRevenue = closed * effectiveDealValue;
  const maxRevenue = Math.max(totalRevenue, totalAdSpend, 1);
  const dataPoints = Array.from({ length: closed + 1 }, (_, i) => ({ deal: i, cumulative: i * effectiveDealValue }));
  const padL = 56, padR = 12, padT = 14, padB = 22;
  const viewBoxW = 440, viewBoxH = 160;
  const plotW = viewBoxW - padL - padR;
  const plotH = viewBoxH - padT - padB;
  const xFor = (i: number) => padL + (i / Math.max(closed, 1)) * plotW;
  const yFor = (val: number) => padT + plotH - (val / maxRevenue) * plotH;
  const spendY = yFor(totalAdSpend);
  const pointsAttr = dataPoints.map((_, i) => `${xFor(i)},${yFor(i * effectiveDealValue)}`).join(" ");
  const breakevenReachable = breakevenDeal > 0 && breakevenDeal <= closed;
  const profitDeals = breakevenReachable ? closed - breakevenDeal : 0;
  const breakevenWeek = Math.max(1, Math.ceil(breakevenDeal / dealsPerWeek));
  const totalWeeks = Math.max(1, Math.ceil(closed / dealsPerWeek));

  return (
    <div className="mt-4">
      <p className="text-sm text-foreground font-heading mb-3 leading-snug">
        {breakevenReachable
          ? t("calculator.charts.breakevenNarrativeWeeks", { deal: breakevenDeal, week: breakevenWeek, profitDeals, totalWeeks })
          : t("calculator.charts.breakevenMiss", { total: closed })}
      </p>

      <svg viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} className="w-full h-44" style={{ overflow: "visible" }} onMouseLeave={() => setHoveredDot(null)}>
        <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="rgba(100,116,139,0.25)" strokeWidth="1" />
        <text x={padL - 6} y={padT + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{formatCurrency(Math.round(maxRevenue))}</text>
        <text x={padL - 6} y={padT + plotH + 4} fontSize="10" fill="#94a3b8" textAnchor="end">0</text>
        <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke="rgba(100,116,139,0.25)" strokeWidth="1" />
        <text x={padL} y={padT + plotH + 14} fontSize="10" fill="#94a3b8">0</text>
        <text x={padL + plotW} y={padT + plotH + 14} fontSize="10" fill="#94a3b8" textAnchor="end">
          {closed} {t("calculator.charts.dealsLabel")} · {t("calculator.charts.weekLabel", { week: totalWeeks })}
        </text>
        <line x1={padL} x2={padL + plotW} y1={spendY} y2={spendY} stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" />
        <text x={padL + plotW - 4} y={spendY - 4} fontSize="10" fill="#ef4444" textAnchor="end">
          {t("calculator.charts.spendLine", { amount: formatCurrency(totalAdSpend) })}
        </text>
        <polyline fill="none" stroke="#4F46E5" strokeWidth="2.5" points={pointsAttr} />
        {breakevenReachable && (() => {
          const bx = xFor(breakevenDeal);
          return (
            <g>
              <line x1={bx} x2={bx} y1={spendY} y2={padT + plotH} stroke="#FEB800" strokeWidth="1.5" strokeDasharray="2 3" />
              <circle cx={bx} cy={spendY} r="5" fill="#FEB800" />
              <text x={bx} y={padT + plotH + 14} fontSize="10" fill="#FEB800" textAnchor="middle" fontWeight="bold">
                {t("calculator.charts.breakevenAtDealWeek", { deal: breakevenDeal, week: breakevenWeek })}
              </text>
            </g>
          );
        })()}
        {closed > 0 && (
          <g>
            <circle cx={xFor(closed)} cy={yFor(totalRevenue)} r="4" fill="#4F46E5" />
            <text x={xFor(closed) - 6} y={yFor(totalRevenue) - 6} fontSize="10" fill="#4F46E5" textAnchor="end" fontWeight="bold">
              {formatCurrency(totalRevenue)}
            </text>
          </g>
        )}
        {closed > 0 && [0.25, 0.5, 0.75, 1].map((frac) => {
          const deal = Math.round(frac * closed);
          const rev = deal * effectiveDealValue;
          const profit = rev - totalAdSpend;
          const week = Math.max(1, Math.ceil(deal / dealsPerWeek));
          const cx = xFor(deal);
          const cy = yFor(rev);
          const isHovered = hoveredDot?.deal === deal;
          const tipW = 110, tipH = 52;
          const tipX = Math.min(Math.max(cx - tipW / 2, padL + 2), viewBoxW - tipW - 2);
          const tipAbove = cy - tipH - 10;
          const tipY = tipAbove < padT ? cy + 10 : tipAbove;
          return (
            <g key={frac}>
              <circle cx={cx} cy={cy} r="10" fill="transparent" className="cursor-pointer"
                onMouseEnter={() => setHoveredDot({ deal, week, revenue: rev, profit, x: cx, y: cy })} />
              <circle cx={cx} cy={cy} r={isHovered ? 5 : 3.5} fill="#4F46E5" opacity={isHovered ? 1 : 0.5}
                style={{ transition: "r 0.15s, opacity 0.15s" }} />
              {isHovered && (
                <g>
                  <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                  <text x={tipX + 8} y={tipY + 14} fontSize="9.5" fill="#94a3b8" fontFamily="inherit">Deal #{deal} · Wk {week}</text>
                  <text x={tipX + 8} y={tipY + 28} fontSize="10.5" fill="#1e293b" fontWeight="bold" fontFamily="inherit">Rev: {formatCurrency(Math.round(rev))}</text>
                  <text x={tipX + 8} y={tipY + 43} fontSize="10.5" fill={profit >= 0 ? "#16a34a" : "#ef4444"} fontWeight="bold" fontFamily="inherit">
                    P&amp;L: {profit >= 0 ? "+" : ""}{formatCurrency(Math.round(profit))}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
