// Revenue Audit Calculator

const CURRENCIES = {
  EUR: { symbol: "€", code: "EUR" },
  USD: { symbol: "$", code: "USD" },
  GBP: { symbol: "£", code: "GBP" },
};

const SCENARIOS = [
  { label: "Conservative", response: 0.35, qualified: 0.10, close: 0.35 },
  { label: "Expected",     response: 0.50, qualified: 0.15, close: 0.30 },
  { label: "Optimistic",   response: 0.65, qualified: 0.20, close: 0.50 },
];

function Audit() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const [copied, setCopied] = React.useState(false);
  const [sectionRef, sectionInView] = window.useInView();

  /* ── Core sliders ── */
  const LEADS_DEFAULT = 1000;
  const DEAL_DEFAULT  = 8000;
  const [leads, setLeads]             = React.useState(0);
  const [dealValue, setDealValue]     = React.useState(0);
  const auditAnimPlayed = React.useRef(false);
  const [animProgress, setAnimProgress]     = React.useState(0);
  const [revenueDisplay, setRevenueDisplay] = React.useState(null);
  const [isAnimating, setIsAnimating]       = React.useState(false);

  React.useEffect(() => {
    if (!sectionInView || auditAnimPlayed.current) return;
    auditAnimPlayed.current = true;
    setIsAnimating(true);

    // Pre-compute final revenue at defaults so revenue counter starts at 90%
    const sc0 = SCENARIOS[1];
    const finalResponded = Math.round(LEADS_DEFAULT * sc0.response);
    const finalQualified = Math.round(finalResponded * sc0.qualified);
    const finalClosed    = Math.round(finalQualified * sc0.close);
    const finalRevenue   = finalClosed * DEAL_DEFAULT;
    const revenueFrom    = finalRevenue * 0.9;

    setRevenueDisplay(finalRevenue); // static at final value from the start

    const sliderDur = 1400;
    const start = performance.now();

    const frame = (now) => {
      const elapsed = now - start;
      const sp = Math.min(elapsed / sliderDur, 1);
      const se = 1 - Math.pow(1 - sp, 3);
      setLeads(Math.round(LEADS_DEFAULT * se));
      setDealValue(Math.round(DEAL_DEFAULT * se));
      setAnimProgress(se); // bars sync with sliders

      if (sp < 1) {
        requestAnimationFrame(frame);
      } else {
        setIsAnimating(false);
        setRevenueDisplay(null);
        setAnimProgress(1);
      }
    };
    requestAnimationFrame(frame);
  }, [sectionInView]);
  const [totalAdSpend, setTotalAdSpend] = React.useState(null);
  const [scenario, setScenario]       = React.useState(1);

  /* ── Click-to-type ── */
  const [editLeads, setEditLeads]     = React.useState(false);
  const [editDeal, setEditDeal]       = React.useState(false);
  const [editCost, setEditCost]       = React.useState(false);
  const [leadsInput, setLeadsInput]   = React.useState("");
  const [dealInput, setDealInput]     = React.useState("");
  const [spendInput, setSpendInput]   = React.useState("");

  /* ── Advanced options ── */
  const [currencyKey, setCurrencyKey]         = React.useState("EUR");
  const [currencyOpen, setCurrencyOpen]       = React.useState(false);
  const [recurring, setRecurring]             = React.useState(false);
  const [monthsRetained, setMonthsRetained]   = React.useState(12);
  const [profitMode, setProfitMode]           = React.useState(false);
  const [grossMargin, setGrossMargin]         = React.useState(60);
  const [decayOn, setDecayOn]                 = React.useState(false);
  const [decayPct, setDecayPct]               = React.useState(10);
  const [customCloseOn, setCustomCloseOn]     = React.useState(false);
  const [closeOverrides, setCloseOverrides]   = React.useState({});
  const [showChart, setShowChart]             = React.useState(false);
  const [dealsPerWeek, setDealsPerWeek]       = React.useState(3);
  const [hoveredDot, setHoveredDot]           = React.useState(null);

  /* ── Computed values ── */
  const cur            = CURRENCIES[currencyKey];
  const effectiveLeads = decayOn ? Math.round(leads * (1 - decayPct / 100)) : leads;
  const marginApplied  = profitMode ? dealValue * (grossMargin / 100) : dealValue;
  const effectiveDeal  = recurring ? marginApplied * monthsRetained : marginApplied;
  const sc             = SCENARIOS[scenario];
  const customClose    = customCloseOn ? (closeOverrides[scenario] ?? sc.close) : sc.close;
  const closePct       = Math.round(customClose * 100);

  const results = React.useMemo(() => SCENARIOS.map((s, i) => {
    const cr        = customCloseOn ? (closeOverrides[i] ?? s.close) : s.close;
    const responded = Math.round(effectiveLeads * s.response);
    const qualified = Math.round(responded * s.qualified);
    const closed    = Math.round(qualified * cr);
    return { responded, qualified, closed, revenue: closed * effectiveDeal };
  }), [effectiveLeads, effectiveDeal, scenario, customCloseOn, closeOverrides]);

  const r          = results[scenario];
  const totalSpend = totalAdSpend ?? 0;
  const roi        = totalSpend > 0 ? Math.round(((r.revenue - totalSpend) / totalSpend) * 100) : 0;
  const accentColor = scenario === 0 ? "var(--mute)" : scenario === 2 ? "var(--wine)" : "var(--ink)";

  function fmtNum(n) {
    return Math.round(n).toLocaleString('nl-NL');
  }

  function fmt(n) {
    if (n >= 1_000_000) return cur.symbol + (n / 1_000_000).toFixed(1).replace('.', ',') + "M";
    if (n >= 1_000)     return cur.symbol + Math.round(n / 1_000) + "K";
    return cur.symbol + fmtNum(n);
  }

  function fmtFull(n) {
    return cur.symbol + fmtNum(n);
  }

  function pctOfLeads(n) {
    return effectiveLeads > 0 ? Math.round((n / effectiveLeads) * 100) : 0;
  }

  function sliderPct(value, min, max) {
    return (((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100).toFixed(1) + "%";
  }

  /* ────────────────── Sub-components ────────────────── */

  /* Single slider — lives inside the big inset panel, no card of its own */
  function AuditSlider({ label, min, max, step, value, onChange, display, editing, setEditing, inputVal, setInputVal, onCommit, nullable, onClear }) {
    const pct = sliderPct(value, min, max);
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "4px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--mute)", fontWeight: 500, letterSpacing: "0.01em" }}>{label}</span>
          {editing ? (
            <input
              type="number" autoFocus value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={() => { const n = parseFloat(inputVal); if (!isNaN(n) && n >= 0) onCommit(n); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }}
              style={{ fontFamily: "var(--mono)", fontSize: 24, fontWeight: 700, color: accentColor, background: "transparent", border: "none", outline: "none", width: 140, textAlign: "right", letterSpacing: "-0.02em" }}
            />
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                title="Click to type"
                onClick={() => { setInputVal(String(value)); setEditing(true); }}
                style={{ fontFamily: "var(--mono)", fontSize: 24, color: display === "—" ? "var(--mute-2)" : accentColor, fontWeight: 700, letterSpacing: "-0.02em", cursor: "text" }}
              >
                {display}
              </span>
              {nullable && display !== "—" && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClear(); }}
                  title="Clear"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mute-2)", fontSize: 16, lineHeight: 1, padding: "0 2px" }}
                >×</button>
              )}
            </span>
          )}
        </div>
        <input
          type="range"
          className="audit-slider"
          min={min} max={max} step={isAnimating ? 1 : step}
          value={Math.min(Math.max(value, min), max)}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ '--pct': pct }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{min.toLocaleString('nl-NL')}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{max.toLocaleString('nl-NL')}</span>
        </div>
      </div>
    );
  }

  /* Neumorphic On/Off toggle — inset strip, active pops out with wine */
  function NeuToggle({ value, onChange }) {
    return (
      <div className="neu-toggle">
        {[false, true].map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            className={"neu-toggle-btn" + (value === opt ? " neu-toggle-on" : "")}
          >
            {opt ? "On" : "Off"}
          </button>
        ))}
      </div>
    );
  }


  /* Progress bar — inset groove, wine fill */
  function MetricBar({ pct }) {
    return (
      <div className="audit-bar-track">
        <div
          className="audit-bar-fill"
          style={{ width: (pct * animProgress) + "%", background: "linear-gradient(90deg, var(--wine-soft), var(--wine))" }}
        />
      </div>
    );
  }

  /* ── Breakeven chart ── */
  function BreakevenChart() {
    const closed         = r.closed;
    const breakevenDeal  = effectiveDeal > 0 ? Math.ceil(totalSpend / effectiveDeal) : 0;
    const maxRevenue     = Math.max(closed * effectiveDeal, totalSpend, 1);
    const padL = 52, padR = 12, padT = 14, padB = 24;
    const vbW = 440, vbH = 160;
    const plotW = vbW - padL - padR;
    const plotH = vbH - padT - padB;
    const xFor = (i)   => padL + (i / Math.max(closed, 1)) * plotW;
    const yFor = (val) => padT + plotH - (val / maxRevenue) * plotH;
    const spendY           = yFor(totalSpend);
    const points           = Array.from({ length: closed + 1 }, (_, i) => `${xFor(i)},${yFor(i * effectiveDeal)}`).join(" ");
    const breakevenReach   = breakevenDeal > 0 && breakevenDeal <= closed;
    const profitDeals      = breakevenReach ? closed - breakevenDeal : 0;
    const breakevenWk      = Math.max(1, Math.ceil(breakevenDeal / dealsPerWeek));
    const totalWeeks       = Math.max(1, Math.ceil(closed / dealsPerWeek));
    const bx = breakevenReach ? xFor(breakevenDeal) : null;
    const by = breakevenReach ? yFor(breakevenDeal * effectiveDeal) : null;

    return (
      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5, marginBottom: 10 }}>
          {breakevenReach
            ? `Break even at deal ${breakevenDeal} (week ${breakevenWk}). ${profitDeals} profit deals over ${totalWeeks} wks.`
            : `${closed} total deals. Add spend data to see breakeven.`}
        </p>
        <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: "100%", height: 160, overflow: "visible" }} onMouseLeave={() => setHoveredDot(null)}>
          <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="var(--line)" strokeWidth="1" />
          <text x={padL - 5} y={padT + 5} fontSize="10" fill="var(--mute-2)" textAnchor="end">{fmt(Math.round(maxRevenue))}</text>
          <text x={padL - 5} y={padT + plotH + 4} fontSize="10" fill="var(--mute-2)" textAnchor="end">0</text>
          <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke="var(--line)" strokeWidth="1" />
          <text x={padL} y={padT + plotH + 16} fontSize="10" fill="var(--mute-2)">0</text>
          <text x={padL + plotW} y={padT + plotH + 16} fontSize="10" fill="var(--mute-2)" textAnchor="end">{closed} deals · wk {totalWeeks}</text>
          {totalSpend > 0 && <>
            <line x1={padL} x2={padL + plotW} y1={spendY} y2={spendY} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" />
            <text x={padL + plotW - 4} y={spendY - 4} fontSize="10" fill="#ef4444" textAnchor="end">Spend {fmt(totalSpend)}</text>
          </>}
          <polyline fill="none" stroke="var(--wine)" strokeWidth="2" points={points} />
          {breakevenReach && <>
            <line x1={bx} x2={bx} y1={padT} y2={padT + plotH} stroke="var(--wine)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={bx} cy={by} r="5" fill="var(--wine)" stroke="var(--paper)" strokeWidth="2" />
          </>}
          {Array.from({ length: Math.min(closed + 1, 40) }, (_, i) => {
            const step = Math.max(1, Math.floor(closed / 20));
            const d = i * step;
            if (d > closed) return null;
            return (
              <circle key={d} cx={xFor(d)} cy={yFor(d * effectiveDeal)} r="7" fill="transparent"
                onMouseEnter={() => setHoveredDot({ deal: d, week: Math.ceil(d / dealsPerWeek), revenue: d * effectiveDeal, x: xFor(d), y: yFor(d * effectiveDeal) })}
                style={{ cursor: "crosshair" }}
              />
            );
          })}
          {hoveredDot && (
            <g>
              <circle cx={hoveredDot.x} cy={hoveredDot.y} r="4" fill={accentColor} />
              <rect x={Math.min(hoveredDot.x - 50, vbW - 116)} y={hoveredDot.y - 42} width={116} height={34} rx="5" fill="var(--ink)" opacity="0.92" />
              <text x={Math.min(hoveredDot.x - 50, vbW - 116) + 8} y={hoveredDot.y - 25} fontSize="10" fill="#fff">Deal {hoveredDot.deal} · Wk {hoveredDot.week}</text>
              <text x={Math.min(hoveredDot.x - 50, vbW - 116) + 8} y={hoveredDot.y - 12} fontSize="10" fill="rgba(255,255,255,0.7)">{fmt(Math.round(hoveredDot.revenue))}</text>
            </g>
          )}
        </svg>
      </div>
    );
  }

  /* ── Sliders column — one big inset panel, stretches to match results height ── */
  function SlidersCol() {
    return (
      <div className="audit-pressed" style={{
        borderRadius: 16,
        padding: "28px 28px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 0,
      }}>
        {AuditSlider({
          label: t('audit.label_leads'), min: 100, max: 2000, step: 100,
          value: leads, onChange: setLeads, display: leads.toLocaleString('nl-NL'),
          editing: editLeads, setEditing: setEditLeads,
          inputVal: leadsInput, setInputVal: setLeadsInput, onCommit: setLeads,
        })}
        <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
        {AuditSlider({
          label: t('audit.label_deal') + ' ' + cur.symbol, min: 2000, max: 100000, step: 1000,
          value: dealValue, onChange: setDealValue, display: cur.symbol + dealValue.toLocaleString('nl-NL'),
          editing: editDeal, setEditing: setEditDeal,
          inputVal: dealInput, setInputVal: setDealInput, onCommit: setDealValue,
        })}
        <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
        {AuditSlider({
          label: t('audit.label_cost') + ' ' + cur.symbol, min: 1000, max: 50000, step: 500,
          value: totalAdSpend ?? 1000, onChange: setTotalAdSpend,
          display: totalAdSpend === null ? "—" : cur.symbol + (totalAdSpend).toLocaleString('nl-NL'),
          editing: editCost, setEditing: setEditCost,
          inputVal: spendInput, setInputVal: setSpendInput, onCommit: setTotalAdSpend,
          nullable: true, onClear: () => setTotalAdSpend(null),
        })}
      </div>
    );
  }

  /* ── Results column ── */
  function ResultsCol() {
    const metrics = [
      { label: t('audit.metric_total'),     value: effectiveLeads, bar: 100 },
      { label: t('audit.metric_responded'), value: r.responded,    bar: pctOfLeads(r.responded) },
      { label: t('audit.metric_booked'),    value: r.qualified,    bar: pctOfLeads(r.qualified) },
      { label: t('audit.metric_closed'),    value: r.closed,       bar: pctOfLeads(r.closed) },
    ];
    return (
      <div className="neu-raised-large" style={{ borderRadius: 16, padding: "36px 36px 32px", display: "flex", flexDirection: "column", gap: 28, height: "100%" }}>
        <div>
          <div style={{ fontFamily: "--mono", fontSize: 11, color: "var(--mute)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
            {profitMode ? t('audit.label_profit') : t('audit.label_revenue')}
          </div>
          <div style={{ fontFamily: "Lora", fontSize: "clamp(48px, 4.5vw, 72px)", color: accentColor, lineHeight: 1, letterSpacing: "-0.03em" }}>
            {fmtFull(revenueDisplay !== null ? revenueDisplay : r.revenue)}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--mute)" }}>{t('audit.untouched')}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {metrics.map((m) => (
            <div key={m.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--mute)", fontWeight: 500 }}>{m.label}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--ink)", fontWeight: 700 }}>
                  {m.label !== t('audit.metric_total') && <span style={{ fontSize: 11, color: "var(--mute-2)", marginRight: 6 }}>{Math.round(m.bar * animProgress)}%</span>}
                  {m.value.toLocaleString('nl-NL')}
                </span>
              </div>
              {MetricBar({ pct: m.bar })}
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5 }}>
          You recover <strong style={{ color: "var(--ink)" }}>{r.closed} {t('audit.recover_deals')}</strong>
          {totalSpend > 0 && <span> {t('audit.recover_roi')} <strong style={{ color: accentColor }}>{roi > 0 ? "+" : ""}{roi}%</strong></span>}
          {" — "}
          <a href="#contact" style={{
            color: "var(--wine)", textDecoration: "none", fontWeight: 600,
            borderBottom: "1px solid var(--wine)", paddingBottom: 1,
          }}>{t('audit.cta_btn')}</a>
        </div>

        {showChart && BreakevenChart()}
      </div>
    );
  }


  /* ── Render ── */
  return (
    <section ref={sectionRef} id="audit" data-screen-label="04 Audit" style={{ maxWidth: 1240, margin: "0 auto", padding: isMobile ? "84px 18px" : "144px 48px" }}>
      <style>{`
        /* ── Raised cards inside audit get a touch of extra drop for depth ── */
        #audit .neu-raised-soft, #audit .neu-raised {
          box-shadow: var(--sh-raised-medium), 0 3px 7px rgba(0,0,0,0.12);
        }
        /* ── Slider: large touch target, no clipping ── */
        .audit-slider {
          -webkit-appearance: none; appearance: none;
          display: block; width: 100%; height: 40px;
          outline: none; cursor: pointer; background: transparent;
          padding: 0; margin: 0; border: none;
        }
        /* ── Webkit track: inset groove, lighter fill up to thumb ── */
        .audit-slider::-webkit-slider-container { overflow: visible; }
        .audit-slider::-webkit-slider-runnable-track {
          height: 10px; border-radius: 999px;
          background: linear-gradient(
            to right,
            rgba(94,34,48,0.38) var(--pct, 0%),
            var(--bg-2) var(--pct, 0%)
          );
          box-shadow: var(--sh-inset-crisp);
        }
        /* ── Firefox track ── */
        .audit-slider::-moz-range-track {
          height: 8px; border-radius: 999px;
          background: var(--bg-2);
          box-shadow: var(--sh-inset-crisp);
        }
        /* ── Firefox filled portion ── */
        .audit-slider::-moz-range-progress {
          height: 8px; border-radius: 999px;
          background: rgba(94,34,48,0.38);
        }
        /* ── Webkit thumb: darker wine knob, smaller than track fill ── */
        .audit-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 20px; height: 20px;
          margin-top: calc((8px - 20px) / 2);
          border-radius: 50%;
          background: linear-gradient(145deg, var(--wine-soft), var(--wine));
          box-shadow: var(--sh-raised-crisp), 0 0 0 2px rgba(255,252,244,0.95);
          cursor: grab;
          transition: transform 100ms ease;
        }
        .audit-slider:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.12); }
        /* ── Firefox thumb ── */
        .audit-slider::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%; border: none;
          background: linear-gradient(145deg, var(--wine-soft), var(--wine));
          box-shadow: var(--sh-raised-crisp), 0 0 0 2px rgba(255,252,244,0.95);
          cursor: grab;
        }
        /* ── Progress bar track ── */
        .audit-bar-track {
          height: 10px; border-radius: 999px; position: relative;
          background: var(--bg-2);
          box-shadow: var(--sh-inset-crisp);
        }
        .audit-bar-fill {
          position: absolute; top: 2px; left: 0; bottom: 2px;
          border-radius: 999px;
          transition: width 300ms cubic-bezier(.4,0,.2,1);
        }
        /* ── Pressed-in surface — medium inset for the panel-sized container ── */
        .audit-pressed {
          background: linear-gradient(145deg, var(--bg-2), var(--bg));
          box-shadow: var(--sh-inset-large);
        }
        /* ── Neu toggle (On/Off) — inset strip, active wine knob ── */
        .neu-toggle {
          display: inline-flex; border-radius: 999px; padding: 3px; gap: 2px;
          background: linear-gradient(145deg, var(--bg-2), var(--bg));
          box-shadow: var(--sh-inset-crisp);
        }
        .neu-toggle-btn {
          padding: 4px 11px; border-radius: 999px; border: none; cursor: pointer;
          font-family: var(--sans); font-size: 10px; font-weight: 700;
          letter-spacing: 0.05em; text-transform: uppercase;
          background: transparent; color: var(--mute-2);
          transition: all 140ms ease;
        }
        .neu-toggle-on {
          background: linear-gradient(145deg, var(--wine-soft), var(--wine));
          box-shadow: var(--sh-polished-crisp);
          color: #fff;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: isMobile ? 32 : 52, textAlign: "center", ...window.revealStyle(sectionInView, { delay: 0 }) }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>{t('audit.eyebrow')}</div>
        <h2
          className="serif"
          onClick={() => {
            const url = window.location.origin + window.location.pathname + "#audit";
            navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          style={{
            margin: "0 0 28px",
            fontSize: isMobile ? "clamp(28px, 8vw, 38px)" : "clamp(40px, 4vw, 60px)",
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            cursor: "pointer",
            transition: "opacity 150ms ease",
            userSelect: "none"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          {t('audit.h2')}<br />
          <span className="italic" style={{ color: "var(--wine)" }}>
            {copied ? t('audit.h2_copied') : t('audit.h2_italic')}
          </span>
        </h2>
      </div>

      {/* Basic layout: 2-column — sliders + results */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 32, alignItems: "stretch", ...window.revealStyle(sectionInView, { delay: 150 }) }}>
        {SlidersCol()}
        {ResultsCol()}
      </div>

    </section>
  );
}
