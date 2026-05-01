import { motion } from "framer-motion";
import { Info, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CURRENCIES } from "@/hooks/useCurrency";
import { Scenario, sliderPct } from "./useRevenueCalculator";

interface Props {
  scenarios: Scenario[];
  selectedScenario: number;
  onSelectScenario: (i: number) => void;
  accentColor: string;
  profitMode: boolean;
  setProfitMode: (v: boolean) => void;
  grossMargin: number;
  setGrossMargin: (v: number) => void;
  recurring: boolean;
  setRecurring: (v: boolean) => void;
  monthsRetained: number;
  setMonthsRetained: (v: number) => void;
  decayOn: boolean;
  setDecayOn: (v: boolean) => void;
  decayPct: number;
  setDecayPct: (v: number) => void;
  customCloseRateOn: boolean;
  setCustomCloseRateOn: (v: boolean) => void;
  closePct: number;
  onUpdateCloseRate: (v: number) => void;
  showChart: boolean;
  setShowChart: (v: boolean) => void;
  dealsPerWeek: number;
  setDealsPerWeek: (v: number) => void;
  currencySymbol: string;
  currencyCode: string;
  currencyOpen: boolean;
  setCurrencyOpen: (v: boolean) => void;
  overrideCurrency: (code: string) => void;
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <Info className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[#4F46E5] cursor-help" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-[#131B49] text-white text-sm leading-snug font-normal p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-30 whitespace-normal text-left">
        {text}
      </span>
    </span>
  );
}

function BlueToggle({ options, value, onChange, color }: {
  options: { key: boolean; label: string }[];
  value: boolean;
  onChange: (v: boolean) => void;
  color: string;
}) {
  return (
    <div role="tablist" className="inline-flex shrink-0 bg-white dark:bg-background border border-[#e5e7eb] dark:border-white/10 rounded-full p-1">
      {options.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={String(key)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-heading transition-all${active ? " font-bold" : " font-medium"}`}
            style={{ backgroundColor: active ? color : "transparent", color: active ? "#fff" : "#64748b" }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function BlueSlider({ min, max, step, value, onChange, color }: {
  min: number; max: number; step: number; value: number; onChange: (v: number) => void; color: string;
}) {
  return (
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 rounded-full appearance-none cursor-pointer"
      style={{ background: `linear-gradient(to right, ${color} ${sliderPct(value, min, max)}%, rgba(100,116,139,0.3) ${sliderPct(value, min, max)}%)` }}
    />
  );
}

export function RevenueCalculatorAdvanced({
  scenarios, selectedScenario, onSelectScenario, accentColor,
  profitMode, setProfitMode, grossMargin, setGrossMargin,
  recurring, setRecurring, monthsRetained, setMonthsRetained,
  decayOn, setDecayOn, decayPct, setDecayPct,
  customCloseRateOn, setCustomCloseRateOn, closePct, onUpdateCloseRate,
  showChart, setShowChart, dealsPerWeek, setDealsPerWeek,
  currencySymbol, currencyCode, currencyOpen, setCurrencyOpen, overrideCurrency,
}: Props) {
  const { t } = useTranslation("home");

  return (
    <motion.div
      key="advanced"
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="relative bg-[#F4F5F9] dark:bg-[#1e2535] rounded-2xl p-6 w-full md:w-[380px] shrink-0 flex flex-col gap-[26px]"
      style={{ zIndex: 20 }}
    >
      {/* Lead Temperature — inline */}
      <div className="flex items-center justify-between gap-3">
        <label className="font-heading font-bold text-sm whitespace-nowrap">{t("calculator.advanced.leadTemp")}</label>
        <div
          role="tablist"
          aria-label={t("calculator.scenarios.tablistLabel")}
          className="inline-flex bg-white dark:bg-background border border-[#e5e7eb] dark:border-white/10 rounded-full p-1"
        >
          {scenarios.map((sc, i) => {
            const active = i === selectedScenario;
            const btnColor = i === 0 ? "#4d6e9c" : i === 2 ? "#FEB800" : "#4F46E5";
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectScenario(i)}
                className={`px-3 py-1.5 rounded-full text-sm font-heading transition-all duration-200${active ? " font-bold" : " font-medium"}`}
                style={{ backgroundColor: active ? btnColor : "transparent", color: active ? "#fff" : "#64748b" }}
              >
                {sc.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Deal Type — inline */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <label className="font-heading font-bold text-sm truncate">{t("calculator.advanced.dealType")}</label>
            <InfoTip text={t("calculator.advanced.dealTypeHint")} />
          </div>
          <BlueToggle color={accentColor}
            options={[
              { key: false, label: t("calculator.advanced.oneShot") },
              { key: true, label: t("calculator.advanced.recurring") },
            ]}
            value={recurring}
            onChange={setRecurring}
          />
        </div>
        {recurring && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="font-heading text-sm text-muted-foreground">{t("calculator.advanced.monthsRetained")}</label>
              <span className="font-heading font-bold text-sm" style={{ color: accentColor }}>{monthsRetained}</span>
            </div>
            <BlueSlider min={1} max={60} step={1} value={monthsRetained} onChange={setMonthsRetained} color={accentColor} />
          </div>
        )}
      </div>

      {/* Show As — inline (below Deal Type) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <label className="font-heading font-bold text-sm truncate">{t("calculator.advanced.showAs")}</label>
            <InfoTip text={t("calculator.advanced.showAsHint")} />
          </div>
          <BlueToggle color={accentColor}
            options={[
              { key: false, label: t("calculator.advanced.revenueMode") },
              { key: true, label: t("calculator.advanced.profitMode") },
            ]}
            value={profitMode}
            onChange={setProfitMode}
          />
        </div>
        {profitMode && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="font-heading text-sm text-muted-foreground">{t("calculator.advanced.grossMargin")}</label>
              <span className="font-heading font-bold text-sm" style={{ color: accentColor }}>{grossMargin}%</span>
            </div>
            <BlueSlider min={10} max={100} step={5} value={grossMargin} onChange={setGrossMargin} color={accentColor} />
          </div>
        )}
      </div>

      {/* Database Decay — inline */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <label className="font-heading font-bold text-sm truncate">{t("calculator.advanced.decay")}</label>
            <InfoTip text={t("calculator.advanced.decayTooltip")} />
          </div>
          <BlueToggle color={accentColor}
            options={[
              { key: false, label: t("calculator.advanced.off") },
              { key: true, label: t("calculator.advanced.on") },
            ]}
            value={decayOn}
            onChange={setDecayOn}
          />
        </div>
        {decayOn && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="font-heading text-sm text-muted-foreground">{t("calculator.advanced.decayLabel")}</label>
              <span className="font-heading font-bold text-sm" style={{ color: accentColor }}>{decayPct}%</span>
            </div>
            <BlueSlider min={0} max={30} step={1} value={decayPct} onChange={setDecayPct} color={accentColor} />
          </div>
        )}
      </div>

      {/* Custom Close Rate — inline */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label className="font-heading font-bold text-sm truncate min-w-0">{t("calculator.closeRateLabel")}</label>
          <BlueToggle color={accentColor}
            options={[
              { key: false, label: t("calculator.advanced.off") },
              { key: true, label: t("calculator.advanced.on") },
            ]}
            value={customCloseRateOn}
            onChange={setCustomCloseRateOn}
          />
        </div>
        {customCloseRateOn && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="font-heading text-sm text-muted-foreground">Your rate</label>
              <span className="font-heading font-bold text-sm" style={{ color: accentColor }}>{closePct}%</span>
            </div>
            <BlueSlider
              min={5} max={70} step={1}
              value={closePct}
              onChange={(v) => onUpdateCloseRate(v / 100)}
              color={accentColor}
            />
          </div>
        )}
      </div>

      {/* Breakeven Timeline — inline */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label className="font-heading font-bold text-sm truncate min-w-0">{t("calculator.advanced.timeline")}</label>
          <BlueToggle color={accentColor}
            options={[
              { key: false, label: t("calculator.advanced.off") },
              { key: true, label: t("calculator.advanced.on") },
            ]}
            value={showChart}
            onChange={setShowChart}
          />
        </div>
        {showChart && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-center gap-1">
                <label className="font-heading text-sm text-muted-foreground">{t("calculator.charts.paceLabel")}</label>
                <InfoTip text={t("calculator.advanced.paceHint")} />
              </div>
              <span className="font-heading font-bold text-sm" style={{ color: accentColor }}>
                {t("calculator.charts.paceValue", { count: dealsPerWeek })}
              </span>
            </div>
            <BlueSlider min={1} max={10} step={1} value={dealsPerWeek} onChange={setDealsPerWeek} color={accentColor} />
          </div>
        )}
      </div>

      {/* Currency — inline */}
      <div className="flex items-center justify-between gap-2">
        <label className="font-heading font-bold text-sm">{t("calculator.advanced.currency")}</label>
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setCurrencyOpen(!currencyOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-white dark:bg-background text-sm font-medium text-muted-foreground hover:text-foreground hover:border-[#4F46E5] transition-colors"
          >
            {currencySymbol} {currencyCode}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {currencyOpen && (
            <div className="absolute right-0 mt-1 w-36 rounded-xl border border-border bg-white dark:bg-background shadow-lg py-1" style={{ zIndex: 50 }}>
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
      </div>
    </motion.div>
  );
}
