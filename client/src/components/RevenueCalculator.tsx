import { motion, AnimatePresence } from "framer-motion";
import { Share2, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRevenueCalculator } from "./calculator/useRevenueCalculator";
import { RevenueCalculatorSliders } from "./calculator/RevenueCalculatorSliders";
import { RevenueCalculatorAdvanced } from "./calculator/RevenueCalculatorAdvanced";
import { RevenueCalculatorHero } from "./calculator/RevenueCalculatorHero";
import { RevenueCalculatorChart } from "./calculator/RevenueCalculatorChart";

export default function RevenueCalculator() {
  const { t } = useTranslation("home");
  const calc = useRevenueCalculator();

  const accentColor = calc.selectedScenario === 0 ? "#4d6e9c" : calc.selectedScenario === 2 ? "#FEB800" : "#4F46E5";

  const chartNode = (
    <RevenueCalculatorChart
      results={calc.results}
      selectedScenario={calc.selectedScenario}
      effectiveDealValue={calc.effectiveDealValue}
      totalAdSpend={calc.totalAdSpend}
      dealsPerWeek={calc.dealsPerWeek}
      formatCurrency={calc.formatCurrency}
      hoveredDot={calc.hoveredDot}
      setHoveredDot={calc.setHoveredDot}
    />
  );

  return (
    <section className="py-48 bg-white dark:bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          id="audit"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative text-center max-w-7xl mx-auto mb-10 scroll-mt-24"
        >
          <button
            type="button"
            onClick={() => calc.handleShare(t("calculator.title"))}
            aria-label={calc.shareCopied ? t("calculator.share.copied") : t("calculator.share.label")}
            title={calc.shareCopied ? t("calculator.share.copied") : t("calculator.share.label")}
            className="absolute -top-5 right-0 inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-white dark:bg-background text-muted-foreground hover:text-[#4F46E5] hover:border-[#4F46E5] transition-colors"
          >
            {calc.shareCopied ? <Check className="w-4 h-4 text-[#22c55e]" /> : <Share2 className="w-4 h-4" />}
          </button>
          <h2 className="text-4xl md:text-[47px] lg:text-[59px] font-bold tracking-tight font-heading">
            {t("calculator.title")}
          </h2>
          <p className="text-lg md:text-xl mt-4 text-muted-foreground">
            {t("calculator.subtitle")}
          </p>
        </motion.div>

        <div className="max-w-7xl mx-auto">
          {/* Basic / Advanced mode toggle — centered above columns */}
          <div className="flex justify-center mb-8">
            <div role="tablist" className="inline-flex bg-[#F4F5F9] dark:bg-[#1e2535] border border-[#e5e7eb] dark:border-white/10 rounded-full p-1">
              {([
                { key: false, label: t("calculator.advanced.basicMode") },
                { key: true, label: t("calculator.advanced.advancedMode") },
              ] as const).map(({ key, label }) => {
                const active = calc.showAdvanced === key;
                return (
                  <button
                    key={String(key)}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => { if (calc.showAdvanced !== key) calc.toggleAdvanced(); }}
                    className="px-6 py-2 rounded-full text-sm font-heading font-bold transition-all"
                    style={{ backgroundColor: active ? "#4941e9" : "transparent", color: active ? "#fff" : "#4d6e9c" }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <motion.div layout className="flex flex-col md:flex-row gap-6 items-stretch md:justify-center">

            <RevenueCalculatorSliders
              leads={calc.leads} setLeads={calc.setLeads}
              dealValue={calc.dealValue} setDealValue={calc.setDealValue}
              costPerLead={calc.costPerLead} setCostPerLead={calc.setCostPerLead}
              currencySymbol={calc.currencySymbol}
              dealConfig={calc.dealConfig} costConfig={calc.costConfig}
              editingLeads={calc.editingLeads} setEditingLeads={calc.setEditingLeads}
              leadsInput={calc.leadsInput} setLeadsInput={calc.setLeadsInput}
              editingDeal={calc.editingDeal} setEditingDeal={calc.setEditingDeal}
              dealInput={calc.dealInput} setDealInput={calc.setDealInput}
              editingCost={calc.editingCost} setEditingCost={calc.setEditingCost}
              costInput={calc.costInput} setCostInput={calc.setCostInput}
            />

            <AnimatePresence mode="popLayout">
              {calc.showAdvanced && (
                <RevenueCalculatorAdvanced
                  scenarios={calc.scenarios}
                  selectedScenario={calc.selectedScenario}
                  onSelectScenario={calc.handleSelectScenario}
                  accentColor={accentColor}
                  profitMode={calc.profitMode} setProfitMode={calc.setProfitMode}
                  grossMargin={calc.grossMargin} setGrossMargin={calc.setGrossMargin}
                  recurring={calc.recurring} setRecurring={calc.setRecurring}
                  monthsRetained={calc.monthsRetained} setMonthsRetained={calc.setMonthsRetained}
                  decayOn={calc.decayOn} setDecayOn={calc.setDecayOn}
                  decayPct={calc.decayPct} setDecayPct={calc.setDecayPct}
                  customCloseRateOn={calc.customCloseRateOn} setCustomCloseRateOn={calc.setCustomCloseRateOn}
                  closePct={calc.closePct} onUpdateCloseRate={calc.updateCloseRate}
                  showChart={calc.showChart} setShowChart={calc.setShowChart}
                  dealsPerWeek={calc.dealsPerWeek} setDealsPerWeek={calc.setDealsPerWeek}
                  currencySymbol={calc.currencySymbol} currencyCode={calc.currencyCode}
                  currencyOpen={calc.currencyOpen} setCurrencyOpen={calc.setCurrencyOpen}
                  overrideCurrency={calc.overrideCurrency}
                />
              )}
            </AnimatePresence>

            <motion.div layout className={calc.showAdvanced ? "flex-1 min-w-0 self-stretch flex flex-col gap-6" : "w-full md:w-[368px] self-stretch flex flex-col gap-6"}>
              <RevenueCalculatorHero
                selectedRevenue={calc.selectedRevenue}
                formatCurrency={calc.formatCurrency}
                result={calc.results[calc.selectedScenario]}
                effectiveLeads={calc.effectiveLeads}
                totalAdSpend={calc.totalAdSpend}
                roi={calc.roi}
                showChart={calc.showChart}
                showAdvanced={calc.showAdvanced}
                accentColor={accentColor}
                chartNode={chartNode}
                profitMode={calc.profitMode}
              />
            </motion.div>

          </motion.div>

          {/* CTA centered below the full flex row */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-muted-foreground mb-4">{t("calculator.cta.subtitle")}</p>
            <a
              href={`https://wa.me/554774002162?text=${encodeURIComponent(t(calc.profitMode ? "calculator.cta.waMessageProfit" : "calculator.cta.waMessage", { leads: calc.leads.toLocaleString(), dealValue: calc.formatCurrency(calc.dealValue), revenue: calc.formatCurrency(calc.selectedRevenue) }))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#4F46E5] text-white font-heading font-bold text-base hover:bg-[#4338ca] transition-colors"
            >
              {t("calculator.cta.label")} →
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
