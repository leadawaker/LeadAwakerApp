import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";

export interface Scenario {
  label: string;
  responseRate: number;
  qualifiedRate: number;
  closeRate: number;
}

export interface ScenarioResult {
  responded: number;
  respondedPct: number;
  qualified: number;
  qualifiedPct: number;
  closed: number;
  closedPct: number;
  revenue: number;
}

export interface HoveredDot {
  deal: number;
  week: number;
  revenue: number;
  profit: number;
  x: number;
  y: number;
}

export const tierColors = [
  { border: "#94a3b8", accent: "#64748b" },
  { border: "#4F46E5", accent: "#4F46E5" },
  { border: "#FEB800", accent: "#FEB800" },
];

export const sliderPct = (val: number, min: number, max: number) =>
  ((val - min) / (max - min)) * 100;

export function useRevenueCalculator() {
  const { t, i18n } = useTranslation("home");
  const { symbol: currencySymbol, dealConfig, costConfig, currencyCode, override: overrideCurrency } =
    useCurrency(i18n.language === "pt");
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
  const [hoveredDot, setHoveredDot] = useState<HoveredDot | null>(null);
  const [editingLeads, setEditingLeads] = useState(false);
  const [editingDeal, setEditingDeal] = useState(false);
  const [editingCost, setEditingCost] = useState(false);
  const [leadsInput, setLeadsInput] = useState("");
  const [dealInput, setDealInput] = useState("");
  const [costInput, setCostInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [customCloseRateOn, setCustomCloseRateOn] = useState(false);
  const didHydrateFromUrl = useRef(false);

  const scenarios: Scenario[] = useMemo(() => [
    { label: t("calculator.scenarios.conservative"), responseRate: 0.35, qualifiedRate: 0.10, closeRate: 0.35 },
    { label: t("calculator.scenarios.expected"), responseRate: 0.50, qualifiedRate: 0.15, closeRate: 0.40 },
    { label: t("calculator.scenarios.optimistic"), responseRate: 0.65, qualifiedRate: 0.20, closeRate: 0.50 },
  ], [t]);

  const marginApplied = profitMode ? dealValue * (grossMargin / 100) : dealValue;
  const effectiveDealValue = recurring ? marginApplied * monthsRetained : marginApplied;
  const effectiveLeads = decayOn ? Math.round(leads * (1 - decayPct / 100)) : leads;

  const results: ScenarioResult[] = useMemo(() => {
    return scenarios.map((s, i) => {
      const closeRate = customCloseRateOn ? (closeRateOverrides[i] ?? s.closeRate) : s.closeRate;
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
  }, [effectiveLeads, effectiveDealValue, scenarios, closeRateOverrides, customCloseRateOn]);

  const totalAdSpend = leads * costPerLead;
  const selectedRevenue = results[selectedScenario].revenue;
  const roi = totalAdSpend > 0 ? Math.round(((selectedRevenue - totalAdSpend) / totalAdSpend) * 100) : 0;

  const currentCloseRate = customCloseRateOn
    ? (closeRateOverrides[selectedScenario] ?? scenarios[selectedScenario]?.closeRate ?? 0.4)
    : (scenarios[selectedScenario]?.closeRate ?? 0.4);
  const closePct = Math.round(currentCloseRate * 100);

  const handleSelectScenario = (i: number) => setSelectedScenario(i);

  const updateCloseRate = (val: number) => {
    setCloseRateOverrides((prev) => ({ ...prev, [selectedScenario]: val }));
  };

  const handleShare = async (title: string) => {
    const search = window.location.search || "";
    const url = `${window.location.origin}/${search}#calculator`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `${currencySymbol}${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${currencySymbol}${Math.round(val / 1_000)}K`;
    return `${currencySymbol}${val}`;
  };

  const toggleAdvanced = () => {
    setShowAdvanced((v) => {
      if (v) setShowChart(false);
      return !v;
    });
  };

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
    if (params.get("mode") === "profit") setProfitMode(true);
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

  useEffect(() => {
    if (!didHydrateFromUrl.current) return;
    const params = new URLSearchParams(window.location.search);
    params.set("leads", String(leads));
    params.set("deal", String(dealValue));
    params.set("cost", String(costPerLead));
    params.set("s", String(selectedScenario));
    params.delete("rr"); params.delete("qr"); params.delete("cr"); params.delete("fm"); params.delete("view");
    for (let i = 0; i < 3; i += 1) {
      const v = closeRateOverrides[i];
      if (typeof v === "number") params.set(`cr${i}`, String(Math.round(v * 100)));
      else params.delete(`cr${i}`);
    }
    if (profitMode) { params.set("mode", "profit"); params.set("gm", String(grossMargin)); }
    else { params.delete("mode"); params.delete("gm"); }
    if (recurring) { params.set("rec", "1"); params.set("mr", String(monthsRetained)); }
    else { params.delete("rec"); params.delete("mr"); }
    if (decayOn) { params.set("dcn", "1"); params.set("dc", String(decayPct)); }
    else { params.delete("dcn"); params.delete("dc"); }
    if (dealsPerWeek !== 3) params.set("dpw", String(dealsPerWeek));
    else params.delete("dpw");
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  }, [leads, dealValue, costPerLead, selectedScenario, closeRateOverrides, grossMargin, profitMode, recurring, monthsRetained, decayOn, decayPct, dealsPerWeek]);

  return {
    currencySymbol, currencyCode, overrideCurrency, currencyOpen, setCurrencyOpen,
    dealConfig, costConfig,
    leads, setLeads, dealValue, setDealValue, costPerLead, setCostPerLead,
    editingLeads, setEditingLeads, leadsInput, setLeadsInput,
    editingDeal, setEditingDeal, dealInput, setDealInput,
    editingCost, setEditingCost, costInput, setCostInput,
    selectedScenario, handleSelectScenario, scenarios,
    customCloseRateOn, setCustomCloseRateOn,
    profitMode, setProfitMode, grossMargin, setGrossMargin,
    recurring, setRecurring, monthsRetained, setMonthsRetained,
    decayOn, setDecayOn, decayPct, setDecayPct,
    chartTab, setChartTab, dealsPerWeek, setDealsPerWeek, hoveredDot, setHoveredDot,
    showAdvanced, toggleAdvanced, showChart, setShowChart,
    results, totalAdSpend, selectedRevenue, roi, effectiveLeads, effectiveDealValue,
    currentCloseRate, closePct, updateCloseRate,
    formatCurrency, handleShare, shareCopied,
  };
}
