import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { DollarSign, Users, Receipt, Share2, Check, Info, ChevronDown } from "lucide-react";
import { useCurrency, CURRENCIES } from "@/hooks/useCurrency";

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

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <Info className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[#4F46E5] cursor-help" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-[#131B49] text-white text-sm leading-snug font-normal p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-normal text-left">
        {text}
      </span>
    </span>
  );
}

export default function RevenueCalculator() {
  const { t, i18n } = useTranslation("home");
  const { symbol: currencySymbol, dealConfig, costConfig, currencyCode, override: overrideCurrency } = useCurrency(i18n.language === "pt");
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const [leads, setLeads] = useState(5000);
  const [dealValue, setDealValue] = useState(dealConfig.default);
  const [costPerLead, setCostPerLead] = useState(costConfig.default);
  const [selectedScenario, setSelectedScenario] = useState(1);
  const [closeRateOverrides, setCloseRateOverrides] = useState<Record<number, number>>({});
  const [chartTab, setChartTab] = useState<"breakeven" | "cac">("breakeven");
  const [shareCopied, setShareCopied] = useState(false);
  const [profitMode, setProfitMode] = useState(false);
  const [grossMargin, setGrossMargin] = useState(60);
  const [recurring, setRecurring] = useState(false);
  const [monthsRetained, setMonthsRetained] = useState(12);
  const [decayOn, setDecayOn] = useState(false);
  const [decayPct, setDecayPct] = useState(10);
  const [dealsPerWeek, setDealsPerWeek] = useState(3);
  const [hoveredDot, setHoveredDot] = useState<{ deal: number; week: number; revenue: number; profit: number; x: number; y: number } | null>(null);
  const [editingLeads, setEditingLeads] = useState(false);
  const [editingDeal, setEditingDeal] = useState(false);
  const [editingCost, setEditingCost] = useState(false);
  const [leadsInput, setLeadsInput] = useState("");
  const [dealInput, setDealInput] = useState("");
  const [costInput, setCostInput] = useState("");
  const didHydrateFromUrl = useRef(false);

  const handleShare = async () => {
    const search = window.location.search || "";
    const url = `${window.location.origin}/${search}#calculator`;
    if (navigator.share) {
      try {
        await navigator.share({ title: t("calculator.title"), url });
        return;
      } catch {
        // user cancelled or share failed; fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // clipboard blocked; no-op
    }
  };

  const scenarios: Scenario[] = useMemo(() => [
    { label: t("calculator.scenarios.conservative"), responseRate: 0.35, qualifiedRate: 0.10, closeRate: 0.35 },
    { label: t("calculator.scenarios.expected"), responseRate: 0.50, qualifiedRate: 0.15, closeRate: 0.40 },
    { label: t("calculator.scenarios.optimistic"), responseRate: 0.65, qualifiedRate: 0.20, closeRate: 0.50 },
  ], [t]);

  const closeRateFor = (i: number) => closeRateOverrides[i] ?? scenarios[i].closeRate;

  const marginApplied = profitMode ? dealValue * (grossMargin / 100) : dealValue;
  const effectiveDealValue = recurring ? marginApplied * monthsRetained : marginApplied;
  const effectiveLeads = decayOn ? Math.round(leads * (1 - decayPct / 100)) : leads;

  const results: ScenarioResult[] = useMemo(() => {
    return scenarios.map((s, i) => {
      const closeRate = closeRateOverrides[i] ?? s.closeRate;
      const responded = Math.round(effectiveLeads * s.responseRate);
      const qualified = Math.round(responded * s.qualifiedRate);
      const closed = Math.round(qualified * closeRate);
      const revenue = closed * effectiveDealValue;
      return {
        responded,
        respondedPct: Math.round(s.responseRate * 100),
        qualified,
        qualifiedPct: Math.round(s.responseRate * s.qualifiedRate * 100),
        closed,
        closedPct: parseFloat((s.responseRate * s.qualifiedRate * closeRate * 100).toFixed(1)),
        revenue,
      };
    });
  }, [effectiveLeads, effectiveDealValue, scenarios, closeRateOverrides]);

  const totalAdSpend = leads * costPerLead;
  const selectedRevenue = results[selectedScenario].revenue;
  const roi = totalAdSpend > 0 ? Math.round(((selectedRevenue - totalAdSpend) / totalAdSpend) * 100) : 0;

  const handleSelectScenario = (i: number) => setSelectedScenario(i);

  const updateCloseRate = (val: number) => {
    setCloseRateOverrides((prev) => ({ ...prev, [selectedScenario]: val }));
  };

  // Hydrate state from URL query params on first mount.
  useEffect(() => {
    if (didHydrateFromUrl.current) return;
    didHydrateFromUrl.current = true;
    const params = new URLSearchParams(window.location.search);
    const readNum = (key: string): number | null => {
      const raw = params.get(key);
      if (raw === null || raw === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    const qLeads = readNum("leads");
    const qDeal = readNum("deal");
    const qCost = readNum("cost");
    const qScenario = readNum("s");
    if (qLeads !== null && qLeads > 0) setLeads(qLeads);
    if (qDeal !== null && qDeal > 0) setDealValue(qDeal);
    if (qCost !== null && qCost > 0) setCostPerLead(qCost);
    if (qScenario !== null && qScenario >= 0 && qScenario <= 2) setSelectedScenario(qScenario);
    const nextOverrides: Record<number, number> = {};
    for (let i = 0; i < 3; i += 1) {
      const v = readNum(`cr${i}`);
      if (v !== null && v >= 5 && v <= 70) nextOverrides[i] = v / 100;
    }
    if (Object.keys(nextOverrides).length > 0) setCloseRateOverrides(nextOverrides);
    const qMargin = readNum("gm");
    if (qMargin !== null && qMargin >= 10 && qMargin <= 100) setGrossMargin(qMargin);
    if (params.get("mode") === "profit") {
      setProfitMode(true);
    }
    if (params.get("rec") === "1") {
      setRecurring(true);
      const qMonths = readNum("mr");
      if (qMonths !== null && qMonths >= 1 && qMonths <= 60) setMonthsRetained(qMonths);
    }
    if (params.get("dcn") === "1") {
      setDecayOn(true);
      const qDecay = readNum("dc");
      if (qDecay !== null && qDecay >= 0 && qDecay <= 30) setDecayPct(qDecay);
    }
    const qDpw = readNum("dpw");
    if (qDpw !== null && qDpw >= 1 && qDpw <= 10) setDealsPerWeek(qDpw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state back to URL query params whenever it changes (after hydration).
  useEffect(() => {
    if (!didHydrateFromUrl.current) return;
    const params = new URLSearchParams(window.location.search);
    params.set("leads", String(leads));
    params.set("deal", String(dealValue));
    params.set("cost", String(costPerLead));
    params.set("s", String(selectedScenario));
    // Legacy params no longer used; strip if present.
    params.delete("rr");
    params.delete("qr");
    params.delete("cr");
    params.delete("fm");
    params.delete("view");
    for (let i = 0; i < 3; i += 1) {
      const v = closeRateOverrides[i];
      if (typeof v === "number") {
        params.set(`cr${i}`, String(Math.round(v * 100)));
      } else {
        params.delete(`cr${i}`);
      }
    }
    if (profitMode) {
      params.set("mode", "profit");
      params.set("gm", String(grossMargin));
    } else {
      params.delete("mode");
      params.delete("gm");
    }
    if (recurring) {
      params.set("rec", "1");
      params.set("mr", String(monthsRetained));
    } else {
      params.delete("rec");
      params.delete("mr");
    }
    if (decayOn) {
      params.set("dcn", "1");
      params.set("dc", String(decayPct));
    } else {
      params.delete("dcn");
      params.delete("dc");
    }
    if (dealsPerWeek !== 3) {
      params.set("dpw", String(dealsPerWeek));
    } else {
      params.delete("dpw");
    }
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", newUrl);
  }, [leads, dealValue, costPerLead, selectedScenario, closeRateOverrides, grossMargin, profitMode, recurring, monthsRetained, decayOn, decayPct, dealsPerWeek]);

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `${currencySymbol}${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${currencySymbol}${Math.round(val / 1_000)}K`;
    return `${currencySymbol}${val}`;
  };

  const tierColors = [
    { border: "#94a3b8", accent: "#64748b" },
    { border: "#4F46E5", accent: "#4F46E5" },
    { border: "#FEB800", accent: "#FEB800" },
  ];

  const sliderPct = (val: number, min: number, max: number) =>
    ((val - min) / (max - min)) * 100;

  return (
    <section className="py-48 bg-white dark:bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          id="calculator"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative text-center max-w-7xl mx-auto mb-16 scroll-mt-24"
        >
          <button
            type="button"
            onClick={handleShare}
            aria-label={shareCopied ? t("calculator.share.copied") : t("calculator.share.label")}
            title={shareCopied ? t("calculator.share.copied") : t("calculator.share.label")}
            className="absolute -top-5 right-0 inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-white dark:bg-background text-muted-foreground hover:text-[#4F46E5] hover:border-[#4F46E5] transition-colors"
          >
            {shareCopied ? (
              <Check className="w-4 h-4 text-[#22c55e]" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>
          <p className="text-sm font-heading font-semibold uppercase tracking-widest text-[#4F46E5] mb-3">
            {t("calculator.eyebrow")}
          </p>
          <h2 className="text-4xl md:text-[47px] lg:text-[59px] font-bold tracking-tight font-heading">
            {t("calculator.title")}
          </h2>
          <p className="text-lg md:text-xl mt-4 text-muted-foreground">
            {t("calculator.subtitle")}
          </p>

          {/* Currency selector */}
          <div className="relative inline-block mt-5">
            <button
              type="button"
              onClick={() => setCurrencyOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-white dark:bg-background text-sm font-medium text-muted-foreground hover:text-foreground hover:border-[#4F46E5] transition-colors"
            >
              {currencySymbol} {currencyCode}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {currencyOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-36 rounded-xl border border-border bg-white dark:bg-background shadow-lg z-30 py-1">
                {Object.values(CURRENCIES).map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => { overrideCurrency(c.code); setCurrencyOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[#4F46E5]/10 ${c.code === currencyCode ? "text-[#4F46E5] font-semibold" : "text-foreground"}`}
                  >
                    {c.symbol} {c.code}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        <div className="max-w-7xl mx-auto">
          {/* Input Controls - 3 sliders */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="grid md:grid-cols-3 gap-8 mb-16"
          >
            {/* Dead Leads Slider */}
            <div className="bg-[#F4F5F9] dark:bg-[#1e2535] rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#4F46E5]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#4F46E5]" />
                </div>
                <label className="font-heading font-bold text-lg">
                  {t("calculator.leadsLabel")}
                </label>
              </div>
              {editingLeads ? (
                <input
                  type="number"
                  autoFocus
                  value={leadsInput}
                  onChange={(e) => setLeadsInput(e.target.value)}
                  onBlur={() => {
                    const n = parseInt(leadsInput, 10);
                    if (!isNaN(n) && n > 0) setLeads(n);
                    setEditingLeads(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
                  }}
                  className="text-4xl font-bold font-heading text-[#4F46E5] mb-4 w-full bg-transparent outline-none"
                />
              ) : (
                <div
                  className="text-4xl font-bold font-heading text-[#4F46E5] mb-4 cursor-text hover:opacity-70 transition-opacity"
                  onClick={() => { setLeadsInput(String(leads)); setEditingLeads(true); }}
                  title="Click to type"
                >
                  {leads.toLocaleString()}
                </div>
              )}
              <input
                type="range"
                min={500}
                max={50000}
                step={500}
                value={Math.min(Math.max(leads, 500), 50000)}
                onChange={(e) => setLeads(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #4F46E5 ${sliderPct(Math.min(Math.max(leads, 500), 50000), 500, 50000)}%, rgba(100,116,139,0.3) ${sliderPct(Math.min(Math.max(leads, 500), 50000), 500, 50000)}%)`,
                }}
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>500</span>
                <span>50,000</span>
              </div>
            </div>

            {/* Deal Value Slider */}
            <div className="bg-[#F4F5F9] dark:bg-[#1e2535] rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#FEB800]/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-[#FEB800]" />
                </div>
                <label className="font-heading font-bold text-lg">
                  {t("calculator.dealLabel")}
                </label>
              </div>
              {editingDeal ? (
                <input
                  type="number"
                  autoFocus
                  value={dealInput}
                  onChange={(e) => setDealInput(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(dealInput);
                    if (!isNaN(n) && n > 0) setDealValue(n);
                    setEditingDeal(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
                  }}
                  className="text-4xl font-bold font-heading text-[#FEB800] mb-4 w-full bg-transparent outline-none"
                />
              ) : (
                <div
                  className="text-4xl font-bold font-heading text-[#FEB800] mb-4 cursor-text hover:opacity-70 transition-opacity"
                  onClick={() => { setDealInput(String(dealValue)); setEditingDeal(true); }}
                  title="Click to type"
                >
                  {currencySymbol}{dealValue.toLocaleString()}
                </div>
              )}
              <input
                type="range"
                min={dealConfig.min}
                max={dealConfig.max}
                step={dealConfig.step}
                value={Math.min(Math.max(dealValue, dealConfig.min), dealConfig.max)}
                onChange={(e) => setDealValue(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #FEB800 ${sliderPct(Math.min(Math.max(dealValue, dealConfig.min), dealConfig.max), dealConfig.min, dealConfig.max)}%, rgba(100,116,139,0.3) ${sliderPct(Math.min(Math.max(dealValue, dealConfig.min), dealConfig.max), dealConfig.min, dealConfig.max)}%)`,
                }}
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>{currencySymbol}{dealConfig.min.toLocaleString()}</span>
                <span>{currencySymbol}{dealConfig.max.toLocaleString()}</span>
              </div>
            </div>

            {/* Cost Per Lead Slider */}
            <div className="bg-[#F4F5F9] dark:bg-[#1e2535] rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#ef4444]/10 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-[#ef4444]" />
                </div>
                <label className="font-heading font-bold text-lg">
                  {t("calculator.costLabel")}
                </label>
              </div>
              {editingCost ? (
                <input
                  type="number"
                  autoFocus
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(costInput);
                    if (!isNaN(n) && n > 0) setCostPerLead(n);
                    setEditingCost(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
                  }}
                  className="text-4xl font-bold font-heading text-[#ef4444] mb-4 w-full bg-transparent outline-none"
                />
              ) : (
                <div
                  className="text-4xl font-bold font-heading text-[#ef4444] mb-4 cursor-text hover:opacity-70 transition-opacity"
                  onClick={() => { setCostInput(String(costPerLead)); setEditingCost(true); }}
                  title="Click to type"
                >
                  {currencySymbol}{costPerLead.toLocaleString()}
                </div>
              )}
              <input
                type="range"
                min={costConfig.min}
                max={costConfig.max}
                step={costConfig.step}
                value={Math.min(Math.max(costPerLead, costConfig.min), costConfig.max)}
                onChange={(e) => setCostPerLead(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ef4444 ${sliderPct(Math.min(Math.max(costPerLead, costConfig.min), costConfig.max), costConfig.min, costConfig.max)}%, rgba(100,116,139,0.3) ${sliderPct(Math.min(Math.max(costPerLead, costConfig.min), costConfig.max), costConfig.min, costConfig.max)}%)`,
                }}
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>{currencySymbol}{costConfig.min}</span>
                <span>{currencySymbol}{costConfig.max}</span>
              </div>
            </div>
          </motion.div>

          <div className="mb-16 pt-6 pb-6 border-t border-b border-[#e5e7eb] dark:border-white/10">
            <div>
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="flex flex-col items-start md:items-center md:text-center">
                    <div className="flex items-center gap-2 flex-wrap justify-between md:justify-center w-full">
                      <span className="flex items-center gap-1">
                        <label className="font-heading font-bold text-sm">
                          {t("calculator.advanced.showAs")}
                        </label>
                        <InfoTooltip text={t("calculator.advanced.showAsHint")} />
                      </span>
                      <div role="tablist" className="inline-flex bg-white dark:bg-[#1e2535] border border-[#e5e7eb] dark:border-white/10 rounded-full p-1 ml-1">
                        {([
                          { key: false, label: t("calculator.advanced.revenueMode") },
                          { key: true, label: t("calculator.advanced.profitMode") },
                        ] as const).map(({ key, label }) => {
                          const active = profitMode === key;
                          return (
                            <button
                              key={String(key)}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              onClick={() => setProfitMode(key)}
                              className="px-4 py-1.5 rounded-full text-sm font-heading font-bold transition-all"
                              style={{
                                backgroundColor: active ? "#4F46E5" : "transparent",
                                color: active ? "#fff" : "#64748b",
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {profitMode && (
                      <div className="mt-5 w-full">
                        <div className="flex items-baseline justify-between mb-2">
                          <label className="font-heading font-bold text-sm">
                            {t("calculator.advanced.grossMargin")}
                          </label>
                          <span className="font-heading font-bold text-sm text-[#4F46E5]">
                            {grossMargin}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={grossMargin}
                          onChange={(e) => setGrossMargin(Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #4F46E5 ${sliderPct(grossMargin, 10, 100)}%, rgba(100,116,139,0.3) ${sliderPct(grossMargin, 10, 100)}%)`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start md:items-center md:text-center">
                    <div className="flex items-center gap-2 flex-wrap justify-between md:justify-center w-full">
                      <span className="flex items-center gap-1">
                        <label className="font-heading font-bold text-sm">
                          {t("calculator.advanced.dealType")}
                        </label>
                        <InfoTooltip text={t("calculator.advanced.dealTypeHint")} />
                      </span>
                      <div role="tablist" className="inline-flex bg-white dark:bg-[#1e2535] border border-[#e5e7eb] dark:border-white/10 rounded-full p-1 ml-1">
                        {([
                          { key: false, label: t("calculator.advanced.oneShot") },
                          { key: true, label: t("calculator.advanced.recurring") },
                        ] as const).map(({ key, label }) => {
                          const active = recurring === key;
                          return (
                            <button
                              key={String(key)}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              onClick={() => setRecurring(key)}
                              className="px-4 py-1.5 rounded-full text-sm font-heading font-bold transition-all"
                              style={{
                                backgroundColor: active ? "#FEB800" : "transparent",
                                color: active ? "#fff" : "#64748b",
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {recurring && (
                      <div className="mt-5 w-full">
                        <div className="flex items-baseline justify-between mb-2">
                          <label className="font-heading font-bold text-sm">
                            {t("calculator.advanced.monthsRetained")}
                          </label>
                          <span className="font-heading font-bold text-sm text-[#FEB800]">
                            {monthsRetained}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={60}
                          step={1}
                          value={monthsRetained}
                          onChange={(e) => setMonthsRetained(Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #FEB800 ${sliderPct(monthsRetained, 1, 60)}%, rgba(100,116,139,0.3) ${sliderPct(monthsRetained, 1, 60)}%)`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start md:items-center md:text-center">
                    <div className="flex items-center gap-2 flex-wrap justify-between md:justify-center w-full">
                      <span className="flex items-center gap-1">
                        <label className="font-heading font-bold text-sm">
                          {t("calculator.advanced.decay")}
                        </label>
                        <InfoTooltip text={t("calculator.advanced.decayTooltip")} />
                      </span>
                      <div role="tablist" className="inline-flex bg-white dark:bg-[#1e2535] border border-[#e5e7eb] dark:border-white/10 rounded-full p-1 ml-1">
                        {([
                          { key: false, label: t("calculator.advanced.off") },
                          { key: true, label: t("calculator.advanced.on") },
                        ] as const).map(({ key, label }) => {
                          const active = decayOn === key;
                          return (
                            <button
                              key={String(key)}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              onClick={() => setDecayOn(key)}
                              className="px-4 py-1.5 rounded-full text-sm font-heading font-bold transition-all"
                              style={{
                                backgroundColor: active ? "#ef4444" : "transparent",
                                color: active ? "#fff" : "#64748b",
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {decayOn && (
                      <div className="mt-5 w-full">
                        <div className="flex items-baseline justify-between mb-2">
                          <label className="font-heading font-bold text-sm">
                            {t("calculator.advanced.decayLabel")}
                          </label>
                          <span className="font-heading font-bold text-sm text-[#ef4444]">
                            {decayPct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={30}
                          step={1}
                          value={decayPct}
                          onChange={(e) => setDecayPct(Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #ef4444 ${sliderPct(decayPct, 0, 30)}%, rgba(100,116,139,0.3) ${sliderPct(decayPct, 0, 30)}%)`,
                          }}
                        />
                      </div>
                    )}
                  </div>
              </div>
            </div>
          </div>

          {/* Single Scenario Panel (left) + Dark Outcome Panel (right) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="grid md:grid-cols-2 gap-6 mb-10"
          >
            {(() => {
              const r = results[selectedScenario];
              const color = tierColors[selectedScenario];
              const currentCloseRate = closeRateFor(selectedScenario);
              const closePct = Math.round(currentCloseRate * 100);
              return (
                <div
                  className="rounded-2xl p-8 flex flex-col bg-[#F4F5F9] dark:bg-[#1e2535]"
                  style={{
                    border: `2px solid ${color.border}`,
                    boxShadow: `0 8px 32px ${color.accent}30`,
                  }}
                >
                  <div
                    role="tablist"
                    aria-label={t("calculator.scenarios.tablistLabel")}
                    className="flex w-full mb-6 bg-white/70 dark:bg-white/10 rounded-full p-1"
                  >
                    {scenarios.map((sc, i) => {
                      const c = tierColors[i];
                      const active = i === selectedScenario;
                      return (
                        <button
                          key={i}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => handleSelectScenario(i)}
                          className="flex-1 px-2 md:px-3 py-2 rounded-full text-xs md:text-sm font-heading font-bold transition-all duration-200"
                          style={{
                            backgroundColor: active ? c.accent : "transparent",
                            color: active ? "#fff" : "#64748b",
                            boxShadow: active ? `0 4px 14px ${c.accent}40` : undefined,
                          }}
                        >
                          {sc.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-center mb-8">
                    <div
                      className="text-4xl lg:text-5xl font-bold font-heading"
                      style={{ color: color.accent }}
                    >
                      {formatCurrency(r.revenue)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {recurring
                        ? profitMode ? t("calculator.results.profitLtv") : t("calculator.results.revenueLtv")
                        : profitMode ? t("calculator.results.profit") : t("calculator.results.revenue")}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: t("calculator.results.total"), value: effectiveLeads, pct: 100, muted: false },
                      { label: t("calculator.results.responded"), value: r.responded, pct: r.respondedPct, muted: false },
                      { label: t("calculator.results.qualified"), value: r.qualified, pct: r.qualifiedPct, muted: false },
                      { label: t("calculator.results.closed"), value: r.closed, pct: r.closedPct, muted: false },
                    ].map((metric, j) => {
                      const barWidth = effectiveLeads > 0 ? Math.max((metric.value / effectiveLeads) * 100, 1) : 0;
                      return (
                        <div key={j}>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-sm text-muted-foreground">
                              {metric.label}
                            </span>
                            <div className="flex items-baseline gap-2">
                              <span className="font-heading font-bold text-base">
                                {metric.value.toLocaleString()}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                (~{metric.pct}%)
                              </span>
                            </div>
                          </div>
                          <div className="h-3 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: metric.muted ? "#cbd5e1" : color.accent,
                              }}
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-6 mt-6 border-t border-black/5 dark:border-white/10">
                    <div className="flex items-baseline justify-between mb-2">
                      <label className="text-sm font-heading font-bold">
                        {t("calculator.closeRateLabel")}
                      </label>
                      <span className="text-sm font-heading font-bold" style={{ color: color.accent }}>
                        {closePct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={70}
                      step={1}
                      value={closePct}
                      onChange={(e) => updateCloseRate(Number(e.target.value) / 100)}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${color.accent} ${sliderPct(currentCloseRate, 0.05, 0.70)}%, rgba(100,116,139,0.3) ${sliderPct(currentCloseRate, 0.05, 0.70)}%)`,
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            <div
              className="relative overflow-hidden rounded-2xl p-8 flex flex-col justify-center"
              style={{
                background: "linear-gradient(135deg, #131B49 0%, #1e2a6e 50%, #2a3680 100%)",
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr_1px_1fr] gap-6 md:gap-0 items-center">
                <div className="text-center md:px-4">
                  <p className="text-white/60 text-sm mb-2 font-heading">
                    {t("calculator.investment.spent")}
                  </p>
                  <div className="text-3xl md:text-3xl font-bold font-heading text-[#ef4444]">
                    {formatCurrency(totalAdSpend)}
                  </div>
                </div>

                <div className="hidden md:block w-px h-16 bg-white/10" />

                <div className="text-center md:px-4">
                  <p className="text-white/60 text-sm mb-2 font-heading">
                    {recurring
                      ? profitMode ? t("calculator.investment.returnProfitLtv") : t("calculator.investment.returnLtv")
                      : profitMode ? t("calculator.investment.returnProfit") : t("calculator.investment.return")}
                  </p>
                  <div className="text-3xl md:text-3xl font-bold font-heading text-white">
                    {formatCurrency(selectedRevenue)}
                  </div>
                </div>

                <div className="hidden md:block w-px h-16 bg-white/10" />

                <div className="text-center md:px-4">
                  <p className="text-white/60 text-sm mb-2 font-heading">
                    {t("calculator.investment.roi")}
                  </p>
                  <div className="text-3xl md:text-3xl font-bold font-heading text-[#FEB800]">
                    {roi > 0 ? "+" : ""}{roi}%
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/10">
                <div
                  role="tablist"
                  aria-label={t("calculator.charts.tablistLabel")}
                  className="sticky top-2 z-10 flex w-full mb-4 bg-[#131B49]/95 backdrop-blur rounded-full p-1 ring-1 ring-white/5"
                >
                  {([
                    { key: "breakeven" as const, label: t("calculator.charts.breakeven") },
                    { key: "cac" as const, label: t("calculator.charts.cac") },
                  ]).map(({ key, label }) => {
                    const active = chartTab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setChartTab(key)}
                        className="flex-1 px-2 py-1.5 rounded-full text-xs md:text-sm font-heading font-bold transition-all duration-200"
                        style={{
                          backgroundColor: active ? "#fff" : "transparent",
                          color: active ? "#131B49" : "rgba(255,255,255,0.6)",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="min-h-[260px] pt-6">
                {chartTab === "breakeven" && (() => {
                  const closed = results[selectedScenario].closed;
                  const breakevenDeal = effectiveDealValue > 0 ? Math.ceil(totalAdSpend / effectiveDealValue) : 0;
                  const totalRevenue = closed * effectiveDealValue;
                  const maxRevenue = Math.max(totalRevenue, totalAdSpend, 1);
                  const dataPoints = Array.from({ length: closed + 1 }, (_, i) => ({
                    deal: i,
                    cumulative: i * effectiveDealValue,
                  }));
                  // Add left+right padding inside the viewBox for axis labels.
                  const padL = 13;
                  const padR = -20;
                  const padT = 14;
                  const padB = 20;
                  const viewBoxW = 440;
                  const viewBoxH = 160;
                  const plotW = viewBoxW - padL - padR;
                  const plotH = viewBoxH - padT - padB;
                  const xFor = (i: number) => padL + (i / Math.max(closed, 1)) * plotW;
                  const yFor = (val: number) => padT + plotH - (val / maxRevenue) * plotH;
                  const spendY = yFor(totalAdSpend);
                  const pointsAttr = dataPoints.map((p, i) => `${xFor(i)},${yFor(p.cumulative)}`).join(" ");
                  const breakevenReachable = breakevenDeal > 0 && breakevenDeal <= closed;
                  const profitDeals = breakevenReachable ? closed - breakevenDeal : 0;
                  const breakevenWeek = Math.max(1, Math.ceil(breakevenDeal / dealsPerWeek));
                  const totalWeeks = Math.max(1, Math.ceil(closed / dealsPerWeek));
                  return (
                    <div>
                      <p className="text-sm text-white font-heading mb-3 leading-snug">
                        {breakevenReachable
                          ? t("calculator.charts.breakevenNarrativeWeeks", { deal: breakevenDeal, week: breakevenWeek, profitDeals, totalWeeks })
                          : t("calculator.charts.breakevenMiss", { total: closed })}
                      </p>
                      <div className="mb-4 pb-3 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="text-xs font-heading font-bold text-white/80 whitespace-nowrap">
                              {t("calculator.charts.paceLabel")}
                            </label>
                            <span className="relative inline-flex items-center group">
                              <Info className="w-3 h-3 text-white/40 group-hover:text-white cursor-help" />
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-black/90 text-white text-[11px] leading-snug font-normal p-2.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-normal text-left">
                                {t("calculator.advanced.paceHint")}
                              </span>
                            </span>
                            <span className="text-xs font-heading font-bold text-[#FEB800] ml-1">
                              {t("calculator.charts.paceValue", { count: dealsPerWeek })}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={10}
                            step={1}
                            value={dealsPerWeek}
                            onChange={(e) => setDealsPerWeek(Number(e.target.value))}
                            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, #FEB800 ${sliderPct(dealsPerWeek, 1, 10)}%, rgba(255,255,255,0.1) ${sliderPct(dealsPerWeek, 1, 10)}%)`,
                            }}
                          />
                        </div>
                      </div>
                      <svg viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} className="w-full h-44" onMouseLeave={() => setHoveredDot(null)}>
                        {/* Y axis */}
                        <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                        <text x={padL - 6} y={padT + 4} fontSize="10" fill="rgba(255,255,255,0.5)" textAnchor="end">{formatCurrency(Math.round(maxRevenue))}</text>
                        <text x={padL - 6} y={padT + plotH + 4} fontSize="10" fill="rgba(255,255,255,0.5)" textAnchor="end">€0</text>
                        {/* X axis */}
                        <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                        <text x={padL} y={padT + plotH + 14} fontSize="10" fill="rgba(255,255,255,0.5)">0</text>
                        <text x={padL + plotW} y={padT + plotH + 14} fontSize="10" fill="rgba(255,255,255,0.5)" textAnchor="end">{closed} {t("calculator.charts.dealsLabel")} · {t("calculator.charts.weekLabel", { week: totalWeeks })}</text>
                        {/* Spend breakeven line */}
                        <line x1={padL} x2={padL + plotW} y1={spendY} y2={spendY} stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" />
                        <text x={padL + plotW - 4} y={spendY - 4} fontSize="10" fill="#ef4444" textAnchor="end">{t("calculator.charts.spendLine", { amount: formatCurrency(totalAdSpend) })}</text>
                        {/* Cumulative revenue line (white) */}
                        <polyline fill="none" stroke="#ffffff" strokeWidth="2.5" points={pointsAttr} />
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
                        {/* End point label */}
                        {closed > 0 && (
                          <g>
                            <circle cx={xFor(closed)} cy={yFor(totalRevenue)} r="4" fill="#ffffff" />
                            <text x={xFor(closed) - 6} y={yFor(totalRevenue) - 6} fontSize="10" fill="#ffffff" textAnchor="end" fontWeight="bold">
                              {formatCurrency(totalRevenue)}
                            </text>
                          </g>
                        )}
                        {/* Hover dots — 4 evenly spaced points on the revenue line */}
                        {closed > 0 && [0.25, 0.5, 0.75, 1].map((frac) => {
                          const deal = Math.round(frac * closed);
                          const rev = deal * effectiveDealValue;
                          const profit = rev - totalAdSpend;
                          const week = Math.max(1, Math.ceil(deal / dealsPerWeek));
                          const cx = xFor(deal);
                          const cy = yFor(rev);
                          const isHovered = hoveredDot?.deal === deal;
                          const tipW = 110;
                          const tipH = 52;
                          const tipX = Math.min(Math.max(cx - tipW / 2, 2), viewBoxW - tipW - 2);
                          const tipAbove = cy - tipH - 10;
                          const tipY = tipAbove < padT ? cy + 10 : tipAbove;
                          return (
                            <g key={frac}>
                              <circle
                                cx={cx} cy={cy} r="10"
                                fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredDot({ deal, week, revenue: rev, profit, x: cx, y: cy })}
                              />
                              <circle cx={cx} cy={cy} r={isHovered ? 5 : 3.5} fill="#ffffff" opacity={isHovered ? 1 : 0.6} style={{ transition: "r 0.15s, opacity 0.15s" }} />
                              {isHovered && (
                                <g>
                                  <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="6" fill="#131B49" opacity="0.97" />
                                  <text x={tipX + 8} y={tipY + 14} fontSize="9.5" fill="rgba(255,255,255,0.55)" fontFamily="inherit">Deal #{deal} · Wk {week}</text>
                                  <text x={tipX + 8} y={tipY + 28} fontSize="10.5" fill="#ffffff" fontWeight="bold" fontFamily="inherit">Rev: {formatCurrency(Math.round(rev))}</text>
                                  <text x={tipX + 8} y={tipY + 43} fontSize="10.5" fill={profit >= 0 ? "#22c55e" : "#ef4444"} fontWeight="bold" fontFamily="inherit">P&amp;L: {profit >= 0 ? "+" : ""}{formatCurrency(Math.round(profit))}</text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  );
                })()}

                {chartTab === "cac" && (() => {
                  const bars = scenarios.map((s, i) => {
                    const cac = results[i].closed > 0 ? totalAdSpend / results[i].closed : 0;
                    return { label: s.label, value: cac, color: tierColors[i].accent };
                  });
                  const maxCac = Math.max(...bars.map((b) => b.value), 1);
                  return (
                    <div className="space-y-4">
                      <p className="text-xs text-white/50 font-heading">
                        {t("calculator.charts.cacSubtitle")}
                      </p>
                      {bars.map((b, i) => (
                        <div key={i}>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-sm font-heading text-white">
                              {b.label}
                            </span>
                            <span className="text-base md:text-lg font-bold font-heading" style={{ color: i === 0 ? "#cbd5e1" : i === 1 ? "#818cf8" : b.color }}>
                              {formatCurrency(Math.round(b.value))}
                            </span>
                          </div>
                          <div className="h-4 w-full rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: b.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max((b.value / maxCac) * 100, 2)}%` }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      ))}
                      <p className="text-[11px] text-white/40 leading-snug pt-2">
                        {t("calculator.charts.cacFootnote")}
                      </p>
                    </div>
                  );
                })()}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center mt-8"
          >
            <p className="text-sm text-muted-foreground mb-3">
              {t("calculator.cta.subtitle")}
            </p>
            <a
              href="#book-demo"
              className="inline-flex items-center gap-2 text-[#4F46E5] font-heading font-bold hover:underline"
            >
              {t("calculator.cta.label")} →
            </a>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
