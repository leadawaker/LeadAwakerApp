import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { DollarSign, Users, CheckCircle2, Receipt } from "lucide-react";

interface Scenario {
  label: string;
  responseRate: number;
  qualifiedRate: number;
  closeRate: number;
}

interface ScenarioResult {
  responded: number;
  respondedPct: number;
  qualified: number;
  qualifiedPct: number;
  closed: number;
  closedPct: number;
  revenue: number;
}

export default function RevenueCalculator() {
  const { t, i18n } = useTranslation("home");
  const isBRL = i18n.language === "pt";
  const currencySymbol = isBRL ? "R$" : "€";

  const dealConfig = isBRL
    ? { default: 5000, min: 1500, max: 150000, step: 500 }
    : { default: 3000, min: 300, max: 30000, step: 250 };

  const costConfig = isBRL
    ? { default: 25, min: 5, max: 500, step: 5 }
    : { default: 15, min: 1, max: 100, step: 1 };

  const [leads, setLeads] = useState(5000);
  const [dealValue, setDealValue] = useState(dealConfig.default);
  const [costPerLead, setCostPerLead] = useState(costConfig.default);

  const scenarios: Scenario[] = useMemo(() => [
    { label: t("calculator.scenarios.conservative"), responseRate: 0.30, qualifiedRate: 0.10, closeRate: 0.25 },
    { label: t("calculator.scenarios.expected"), responseRate: 0.40, qualifiedRate: 0.15, closeRate: 0.25 },
    { label: t("calculator.scenarios.optimistic"), responseRate: 0.60, qualifiedRate: 0.20, closeRate: 0.25 },
  ], [t]);

  const results: ScenarioResult[] = useMemo(() => {
    return scenarios.map((s) => {
      const responded = Math.round(leads * s.responseRate);
      const qualified = Math.round(responded * s.qualifiedRate);
      const closed = Math.round(qualified * s.closeRate);
      const revenue = closed * dealValue;
      return {
        responded,
        respondedPct: Math.round(s.responseRate * 100),
        qualified,
        qualifiedPct: Math.round(s.responseRate * s.qualifiedRate * 100),
        closed,
        closedPct: parseFloat((s.responseRate * s.qualifiedRate * s.closeRate * 100).toFixed(1)),
        revenue,
      };
    });
  }, [leads, dealValue, scenarios]);

  const totalAdSpend = leads * costPerLead;
  const expectedRevenue = results[1].revenue;
  const roi = totalAdSpend > 0 ? Math.round(((expectedRevenue - totalAdSpend) / totalAdSpend) * 100) : 0;

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `${currencySymbol}${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${currencySymbol}${Math.round(val / 1_000)}K`;
    return `${currencySymbol}${val}`;
  };

  const tierColors = [
    { border: "#94a3b8", accent: "#64748b", bg: "#F4F5F9" },
    { border: "#4F46E5", accent: "#4F46E5", bg: "#F4F5F9" },
    { border: "#FEB800", accent: "#FEB800", bg: "#F4F5F9" },
  ];

  const sliderPct = (val: number, min: number, max: number) =>
    ((val - min) / (max - min)) * 100;

  return (
    <section className="py-32 bg-white dark:bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-6xl mx-auto mb-16"
        >
          <h2 className="text-4xl md:text-[47px] lg:text-[59px] font-bold tracking-tight font-heading">
            {t("calculator.title")}
          </h2>
          <p className="text-lg md:text-xl mt-4 text-muted-foreground">
            {t("calculator.subtitle")}
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          {/* Input Controls - 2 sliders */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="grid md:grid-cols-2 gap-8 mb-16"
          >
            {/* Dead Leads Slider */}
            <div className="bg-[#F4F5F9] rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#4F46E5]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#4F46E5]" />
                </div>
                <label className="font-heading font-bold text-lg">
                  {t("calculator.leadsLabel")}
                </label>
              </div>
              <div className="text-4xl font-bold font-heading text-[#4F46E5] mb-4">
                {leads.toLocaleString()}
              </div>
              <input
                type="range"
                min={500}
                max={50000}
                step={500}
                value={leads}
                onChange={(e) => setLeads(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #4F46E5 ${sliderPct(leads, 500, 50000)}%, #d1d5db ${sliderPct(leads, 500, 50000)}%)`,
                }}
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>500</span>
                <span>50,000</span>
              </div>
            </div>

            {/* Deal Value Slider */}
            <div className="bg-[#F4F5F9] rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#FEB800]/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-[#FEB800]" />
                </div>
                <label className="font-heading font-bold text-lg">
                  {t("calculator.dealLabel")}
                </label>
              </div>
              <div className="text-4xl font-bold font-heading text-[#FEB800] mb-4">
                {currencySymbol}{dealValue.toLocaleString()}
              </div>
              <input
                type="range"
                min={dealConfig.min}
                max={dealConfig.max}
                step={dealConfig.step}
                value={dealValue}
                onChange={(e) => setDealValue(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #FEB800 ${sliderPct(dealValue, dealConfig.min, dealConfig.max)}%, #d1d5db ${sliderPct(dealValue, dealConfig.min, dealConfig.max)}%)`,
                }}
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>{currencySymbol}{dealConfig.min.toLocaleString()}</span>
                <span>{currencySymbol}{dealConfig.max.toLocaleString()}</span>
              </div>
            </div>
          </motion.div>

          {/* Three Scenario Tier Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {scenarios.map((scenario, i) => {
              const r = results[i];
              const color = tierColors[i];
              const isFeatured = i === 1;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * i }}
                  className="relative rounded-2xl p-8 flex flex-col"
                  style={{
                    backgroundColor: color.bg,
                    border: `2px solid ${isFeatured ? color.border : "transparent"}`,
                    boxShadow: isFeatured ? `0 8px 32px ${color.accent}20` : undefined,
                  }}
                >
                  {isFeatured && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: color.accent }}
                    >
                      {t("calculator.scenarios.recommended")}
                    </div>
                  )}

                  <h3
                    className="font-heading font-bold text-xl mb-6 text-center"
                    style={{ color: color.accent }}
                  >
                    {scenario.label}
                  </h3>

                  <div className="text-center mb-8">
                    <div
                      className="text-4xl lg:text-5xl font-bold font-heading"
                      style={{ color: color.accent }}
                    >
                      {formatCurrency(r.revenue)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("calculator.results.revenue")}
                    </p>
                  </div>

                  <div className="space-y-4 flex-1">
                    {[
                      { label: t("calculator.results.responded"), value: r.responded, pct: r.respondedPct },
                      { label: t("calculator.results.qualified"), value: r.qualified, pct: r.qualifiedPct },
                      { label: t("calculator.results.closed"), value: r.closed, pct: r.closedPct },
                    ].map((metric, j) => (
                      <div key={j} className="flex items-center gap-3">
                        <CheckCircle2
                          className="w-4 h-4 shrink-0"
                          style={{ color: color.accent }}
                        />
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-heading font-bold text-lg">
                              {metric.value.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              (~{metric.pct}%)
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {metric.label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Investment vs Return callout with inline cost slider */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-2xl p-8 md:p-12"
            style={{
              background: "linear-gradient(135deg, #131B49 0%, #1e2a6e 50%, #2a3680 100%)",
            }}
          >
            <div className="relative z-10 grid md:grid-cols-[1fr_1px_1fr_1px_1fr_1px_1fr] gap-6 md:gap-0 items-center">
              {/* Cost Per Lead slider */}
              <div className="md:px-6">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="w-4 h-4 text-white/50" />
                  <p className="text-white/60 text-sm font-heading">
                    {t("calculator.costLabel")}
                  </p>
                </div>
                <div className="text-2xl md:text-3xl font-bold font-heading text-white mb-3">
                  {currencySymbol}{costPerLead.toLocaleString()}
                </div>
                <input
                  type="range"
                  min={costConfig.min}
                  max={costConfig.max}
                  step={costConfig.step}
                  value={costPerLead}
                  onChange={(e) => setCostPerLead(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #ef4444 ${sliderPct(costPerLead, costConfig.min, costConfig.max)}%, rgba(255,255,255,0.15) ${sliderPct(costPerLead, costConfig.min, costConfig.max)}%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-white/40 mt-1">
                  <span>{currencySymbol}{costConfig.min}</span>
                  <span>{currencySymbol}{costConfig.max}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px h-16 bg-white/10" />

              {/* Spent */}
              <div className="text-center md:px-6">
                <p className="text-white/60 text-sm mb-2 font-heading">
                  {t("calculator.investment.spent")}
                </p>
                <div className="text-2xl md:text-3xl font-bold font-heading text-[#ef4444]">
                  {formatCurrency(totalAdSpend)}
                </div>
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px h-16 bg-white/10" />

              {/* Expected Return */}
              <div className="text-center md:px-6">
                <p className="text-white/60 text-sm mb-2 font-heading">
                  {t("calculator.investment.return")}
                </p>
                <div className="text-2xl md:text-3xl font-bold font-heading text-[#22c55e]">
                  {formatCurrency(expectedRevenue)}
                </div>
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px h-16 bg-white/10" />

              {/* ROI */}
              <div className="text-center md:px-6">
                <p className="text-white/60 text-sm mb-2 font-heading">
                  {t("calculator.investment.roi")}
                </p>
                <div className="text-2xl md:text-3xl font-bold font-heading text-[#FEB800]">
                  {roi > 0 ? "+" : ""}{roi}%
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
