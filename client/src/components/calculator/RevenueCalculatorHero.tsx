import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ScenarioResult } from "./useRevenueCalculator";

interface Props {
  selectedRevenue: number;
  formatCurrency: (v: number) => string;
  result: ScenarioResult;
  effectiveLeads: number;
  totalAdSpend: number;
  roi: number;
  showChart: boolean;
  showAdvanced: boolean;
  accentColor: string;
  chartNode: React.ReactNode;
  profitMode: boolean;
}

export function RevenueCalculatorHero({
  selectedRevenue, formatCurrency, result, effectiveLeads,
  totalAdSpend, roi, showChart, showAdvanced, accentColor, chartNode, profitMode,
}: Props) {
  const { t } = useTranslation("home");
  const centered = !showAdvanced;

  const stats = [
    { key: "total", label: t("calculator.results.total"), value: effectiveLeads, prefix: "", accent: false, pct: 1 },
    { key: "responded", label: t("calculator.results.responded"), value: result.responded, prefix: "~", accent: false, pct: result.responded / Math.max(effectiveLeads, 1) },
    { key: "qualified", label: t("calculator.results.qualified"), value: result.qualified, prefix: "~", accent: false, pct: result.qualified / Math.max(effectiveLeads, 1) },
    { key: "closed", label: t("calculator.results.closed"), value: result.closed, prefix: "~", accent: true, pct: result.closed / Math.max(effectiveLeads, 1) },
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.2 }}
      className="bg-[#F4F5F9] dark:bg-[#1e2535] rounded-2xl p-8 flex-1 h-full"
    >
      <p className={`text-sm text-muted-foreground mb-1${centered ? " text-center" : ""}`}>{t("calculator.hero.sittingOn")}</p>
      <div
        className={`text-6xl md:text-7xl font-bold font-heading mb-1 transition-colors duration-300${centered ? " text-center" : ""}`}
        style={{ color: accentColor }}
      >
        {formatCurrency(selectedRevenue)}
      </div>
      <p className={`text-base text-muted-foreground mb-6${centered ? " text-center" : ""}`}>{t(profitMode ? "calculator.hero.recoverableProfit" : "calculator.hero.recoverableRevenue")}</p>

      <div className="flex flex-col gap-1 mb-4">
        {stats.map(({ key, label, value, prefix, accent, pct }) => (
          <div key={key} className="mb-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span
                className="font-heading font-bold text-base transition-colors duration-300"
                style={{ color: accent ? accentColor : undefined }}
              >
                {prefix}{value.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 dark:bg-white/10 rounded-full mt-1">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(Math.round(pct * 100), pct > 0 ? 2 : 0)}%`,
                  backgroundColor: accentColor,
                  opacity: 0.3,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className={`text-sm text-muted-foreground mb-5${centered ? " text-center" : ""}`}>
        {t("calculator.hero.spentRoi", {
          spent: formatCurrency(totalAdSpend),
          roi: `${roi > 0 ? "+" : ""}${roi}%`,
        })}
      </p>

      <AnimatePresence>
        {showChart && (
          <motion.div
            key="chart"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {chartNode}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
