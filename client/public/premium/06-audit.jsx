// Revenue Audit Calculator

const SCENARIOS = [
  { label: "Conservative", response: 0.50, qualified: 0.30, close: 0.20 },
  { label: "Expected",     response: 0.70, qualified: 0.50, close: 0.30 },
  { label: "Optimistic",   response: 0.80, qualified: 0.60, close: 0.35 },
];

function Audit() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const [copied, setCopied] = React.useState(false);
  const [sectionRef, sectionInView] = window.useInView();

  /* ── Core sliders ── */
  const QUOTES_DEFAULT = 200;
  const SILENT_DEFAULT = 50;
  const VALUE_DEFAULT  = 40000;

  const [quotes, setQuotes]       = React.useState(0);
  const [silentPct, setSilentPct] = React.useState(SILENT_DEFAULT);
  const [avgValue, setAvgValue]   = React.useState(0);
  const [scenario, setScenario]   = React.useState(1);

  const auditAnimPlayed = React.useRef(false);
  const [animProgress, setAnimProgress]     = React.useState(0);
  const [revenueDisplay, setRevenueDisplay] = React.useState(null);
  const [isAnimating, setIsAnimating]       = React.useState(false);

  React.useEffect(() => {
    if (!sectionInView || auditAnimPlayed.current) return;
    auditAnimPlayed.current = true;
    setIsAnimating(true);

    const sc0 = SCENARIOS[1];
    const finalDormant   = Math.round(QUOTES_DEFAULT * SILENT_DEFAULT / 100);
    const finalResponded = Math.round(finalDormant * sc0.response);
    const finalBooked    = Math.round(finalResponded * sc0.qualified);
    const finalClosed    = Math.round(finalBooked * sc0.close);
    setRevenueDisplay(finalClosed * VALUE_DEFAULT);

    const sliderDur = 1400;
    const start = performance.now();

    const frame = (now) => {
      const elapsed = now - start;
      const sp = Math.min(elapsed / sliderDur, 1);
      const se = 1 - Math.pow(1 - sp, 3);
      setQuotes(Math.round(QUOTES_DEFAULT * se));
      setAvgValue(Math.round(VALUE_DEFAULT * se));
      setAnimProgress(se);

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

  /* ── Sync values to CTA pre-fill ── */
  React.useEffect(() => {
    window.__leadAwakerCalc = { quotes, silentPct, avgValue };
  }, [quotes, silentPct, avgValue]);

  /* ── Click-to-type ── */
  const [editQuotes, setEditQuotes] = React.useState(false);
  const [editSilent, setEditSilent] = React.useState(false);
  const [editValue, setEditValue]   = React.useState(false);
  const [quotesInput, setQuotesInput] = React.useState("");
  const [silentInput, setSilentInput] = React.useState("");
  const [valueInput, setValueInput]   = React.useState("");

  /* ── Computed values ── */
  const dormantLeads = React.useMemo(
    () => Math.round(quotes * silentPct / 100),
    [quotes, silentPct]
  );

  const accentColor = scenario === 0 ? "var(--mute)" : scenario === 2 ? "var(--wine)" : "var(--ink)";

  const results = React.useMemo(() => SCENARIOS.map((s) => {
    const responded = Math.round(dormantLeads * s.response);
    const booked    = Math.round(responded * s.qualified);
    const closed    = Math.round(booked * s.close);
    return { responded, booked, closed, revenue: closed * avgValue };
  }), [dormantLeads, avgValue]);

  const r = results[scenario];

  function fmtNum(n) {
    return Math.round(n).toLocaleString('nl-NL');
  }

  function fmt(n) {
    if (n >= 1_000_000) return "€" + (n / 1_000_000).toFixed(1).replace('.', ',') + "M";
    if (n >= 1_000)     return "€" + Math.round(n / 1_000) + "K";
    return "€" + fmtNum(n);
  }

  function fmtFull(n) {
    return "€" + fmtNum(n);
  }

  function pctOfDormant(n) {
    return dormantLeads > 0 ? Math.round((n / dormantLeads) * 100) : 0;
  }

  function sliderPct(value, min, max) {
    return (((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100).toFixed(1) + "%";
  }

  /* ────────────────── Sub-components ────────────────── */

  function AuditSlider({ label, min, max, step, value, onChange, display, editing, setEditing, inputVal, setInputVal, onCommit }) {
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
            <span
              title="Click to type"
              onClick={() => { setInputVal(String(value)); setEditing(true); }}
              style={{ fontFamily: "var(--mono)", fontSize: 24, color: accentColor, fontWeight: 700, letterSpacing: "-0.02em", cursor: "text" }}
            >
              {display}
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

  /* ── Sliders column ── */
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
          label: t('audit.label_quotes'), min: 50, max: 2000, step: 50,
          value: quotes, onChange: setQuotes, display: quotes.toLocaleString('nl-NL'),
          editing: editQuotes, setEditing: setEditQuotes,
          inputVal: quotesInput, setInputVal: setQuotesInput, onCommit: setQuotes,
        })}
        <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
        {AuditSlider({
          label: t('audit.label_silent'), min: 0, max: 100, step: 5,
          value: silentPct, onChange: setSilentPct, display: silentPct + "%",
          editing: editSilent, setEditing: setEditSilent,
          inputVal: silentInput, setInputVal: setSilentInput,
          onCommit: (n) => setSilentPct(Math.min(100, Math.max(0, Math.round(n)))),
        })}
        <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
        {AuditSlider({
          label: t('audit.label_value'), min: 1000, max: 100000, step: 1000,
          value: avgValue, onChange: setAvgValue, display: "€" + avgValue.toLocaleString('nl-NL'),
          editing: editValue, setEditing: setEditValue,
          inputVal: valueInput, setInputVal: setValueInput, onCommit: setAvgValue,
        })}
      </div>
    );
  }

  /* ── Results column ── */
  function ResultsCol() {
    const metrics = [
      { label: t('audit.metric_total'),     value: dormantLeads, bar: 100 },
      { label: t('audit.metric_responded'), value: r.responded,  bar: pctOfDormant(r.responded) },
      { label: t('audit.metric_booked'),    value: r.booked,     bar: pctOfDormant(r.booked) },
      { label: t('audit.metric_closed'),    value: r.closed,     bar: pctOfDormant(r.closed) },
    ];
    return (
      <div className="neu-raised-large" style={{ borderRadius: 16, padding: "36px 36px 32px", display: "flex", flexDirection: "column", gap: 28, height: "100%" }}>
        <div>
          <div style={{ fontFamily: "--mono", fontSize: 11, color: "var(--mute)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
            {t('audit.label_revenue')}
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
          {t('audit.recover_prefix')} <strong style={{ color: "var(--ink)" }}>{r.closed} {t('audit.recover_deals')}</strong>
          {" — "}
          <a href="#contact" style={{
            color: "var(--wine)", textDecoration: "none", fontWeight: 600,
            borderBottom: "1px solid var(--wine)", paddingBottom: 1,
          }}>{t('audit.cta_btn')}</a>
        </div>
      </div>
    );
  }


  /* ── Render ── */
  return (
    <section ref={sectionRef} id="audit" data-screen-label="04 Audit" style={{ maxWidth: 1240, margin: "0 auto", padding: isMobile ? "64px 18px" : "72px 48px 144px" }}>
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

      {/* 2-column: sliders + results */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 32, alignItems: "stretch", ...window.revealStyle(sectionInView, { delay: 150 }) }}>
        {SlidersCol()}
        {ResultsCol()}
      </div>

    </section>
  );
}
