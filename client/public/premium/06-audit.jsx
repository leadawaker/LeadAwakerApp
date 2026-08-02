// Revenue Audit Calculator
//
// Three tabs, one per offer (see AUDIT_POOLS in config.jsx for the rates and
// why they differ). Each tab is exactly two sliders plus the shared project
// value below, so the panel never changes height when you switch tabs.
//
// The combined line sums only pools the visitor has actually TOUCHED. A total
// assembled from defaults they never looked at is worse than no total: the
// moment they open a tab and disagree with its default, the headline they were
// just shown becomes retroactively fake.

const AUDIT_ICONS = {
  quotes: <svg viewBox="0 0 18 18" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 2.5h6L14 6v9.5H4.5Z"/><path d="M10.5 2.5V6H14"/><path d="M6.5 9.5h5M6.5 12.5h3"/></svg>,
  dbr:    <svg viewBox="0 0 18 18" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.2 9a5.8 5.8 0 1 0 1.7-4.1"/><path d="M2.8 3.2v3.2H6"/><path d="M9 6.2V9.4l2.3 1.4"/></svg>,
  upsell: <svg viewBox="0 0 18 18" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="5.8" r="2.6"/><path d="M2.4 14.5c0-2.5 2.1-4.6 4.6-4.6 1 0 2 .35 2.8.9"/><path d="M13.4 9.6v4.9M11 12h4.8"/></svg>,
};

/* Only these two ramp on scroll-in: the default tab's pool size and the shared
   value. Everything else starts at its configured default. */
const AUDIT_ANIM_KEYS = [AUDIT_POOLS[0].sliders[0].key, AUDIT_VALUE_SLIDER.key];

function auditInitialVals() {
  const o = {};
  AUDIT_POOLS.forEach((p) => p.sliders.forEach((s) => { o[s.key] = s.def; }));
  o[AUDIT_VALUE_SLIDER.key] = AUDIT_VALUE_SLIDER.def;
  return o;
}

function auditComputePool(pool, vals, avgValue) {
  const [sizeSlider, pctSlider] = pool.sliders;
  const size      = Math.round(vals[sizeSlider.key] * vals[pctSlider.key] / 100);
  const responded = Math.round(size * pool.rates.response);
  const booked    = Math.round(responded * pool.rates.qualified);
  const closed    = Math.round(booked * pool.rates.close);
  return { size, responded, booked, closed, revenue: closed * avgValue * pool.valueFactor };
}

function Audit() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const { symbol, locale } = window.useCurrency();
  const [copied, setCopied] = React.useState(false);
  const [sectionRef, sectionInView] = window.useInView();

  const [activeKey, setActiveKey]   = React.useState(AUDIT_POOLS[0].key);
  const [vals, setVals]             = React.useState(() => {
    const v = auditInitialVals();
    AUDIT_ANIM_KEYS.forEach((k) => { v[k] = 0; });   // ramped up by the intro animation
    return v;
  });
  const [touched, setTouched]       = React.useState({});
  const [editingKey, setEditingKey] = React.useState(null);
  const [editInput, setEditInput]   = React.useState("");

  const activePool = AUDIT_POOLS.find((p) => p.key === activeKey) || AUDIT_POOLS[0];
  const avgValue   = vals[AUDIT_VALUE_SLIDER.key];

  const auditAnimPlayed = React.useRef(false);
  const [animProgress, setAnimProgress]     = React.useState(0);
  const [revenueDisplay, setRevenueDisplay] = React.useState(null);
  const [isAnimating, setIsAnimating]       = React.useState(false);

  /* ── Intro ramp: runs once. The ref must survive tab switches, or every tab
       click would replay a 1.4s animation and read as broken. ── */
  React.useEffect(() => {
    if (!sectionInView || auditAnimPlayed.current) return;
    auditAnimPlayed.current = true;
    setIsAnimating(true);

    const settled = auditInitialVals();
    setRevenueDisplay(auditComputePool(AUDIT_POOLS[0], settled, settled[AUDIT_VALUE_SLIDER.key]).revenue);

    const sliderDur = 1400;
    const start = performance.now();

    const frame = (now) => {
      const sp = Math.min((now - start) / sliderDur, 1);
      const se = 1 - Math.pow(1 - sp, 3);
      setVals((v) => {
        const next = { ...v };
        AUDIT_ANIM_KEYS.forEach((k) => { next[k] = Math.round(settled[k] * se); });
        return next;
      });
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

  /* ── Computed ── */
  const results = React.useMemo(() => {
    const o = {};
    AUDIT_POOLS.forEach((p) => { o[p.key] = auditComputePool(p, vals, avgValue); });
    return o;
  }, [vals, avgValue]);

  const r = results[activeKey];

  const touchedPools  = AUDIT_POOLS.filter((p) => touched[p.key]);
  const showCombined  = touchedPools.length >= 2;
  const combinedTotal = touchedPools.reduce((sum, p) => sum + results[p.key].revenue, 0);

  /* ── Sync to the CTA pre-fill. quotes/silentPct/avgValue stay spread flat at
       the top level because 10-cta-footer.jsx reads them off __leadAwakerCalc
       by name; the rest is context for the submitted lead. ── */
  React.useEffect(() => {
    const detail = {
      ...vals,
      activeTab: activeKey,
      touchedPools: touchedPools.map((p) => p.key),
      combinedRevenue: showCombined ? combinedTotal : null,
      pools: AUDIT_POOLS.reduce((o, p) => { o[p.key] = results[p.key]; return o; }, {}),
    };
    window.__leadAwakerCalc = detail;
    window.dispatchEvent(new CustomEvent('auditSliderChange', { detail }));
  }, [vals, activeKey, touched, results]);

  React.useEffect(() => {
    const handleCtaChange = (e) => {
      const { quotes: q, silentPct: sp, avgValue: av } = e.detail;
      setVals((v) => {
        const next = { ...v };
        if (q !== undefined)  next.quotes    = q;
        if (sp !== undefined) next.silentPct = sp;
        if (av !== undefined) next.avgValue  = av;
        return next;
      });
      // Moving a slider in the CTA form is real interaction with the quotes pool.
      if (q !== undefined || sp !== undefined) setTouched((tc) => ({ ...tc, quotes: true }));
    };
    window.addEventListener('ctaSliderChange', handleCtaChange);
    return () => window.removeEventListener('ctaSliderChange', handleCtaChange);
  }, []);

  /* ── Helpers ── */
  function setSlider(poolKey, sliderKey, value) {
    setVals((v) => ({ ...v, [sliderKey]: value }));
    if (poolKey) setTouched((tc) => (tc[poolKey] ? tc : { ...tc, [poolKey]: true }));
  }

  function fmtNum(n) { return Math.round(n).toLocaleString(locale); }

  function fmtFull(n) { return symbol + fmtNum(n); }

  function fmtSlider(s, value) {
    if (s.unit === "pct")   return value + "%";
    if (s.unit === "money") return symbol + value.toLocaleString(locale);
    return value.toLocaleString(locale);
  }

  function pctOfPool(n) {
    return r.size > 0 ? Math.round((n / r.size) * 100) : 0;
  }

  function sliderPct(value, min, max) {
    return (((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100).toFixed(1) + "%";
  }

  /* ────────────────── Sub-components ──────────────────
     Called as plain functions rather than rendered as <Elements>: they are
     declared inside Audit(), so JSX usage would give them a fresh component
     identity on every render and blow away focus in the click-to-type input. */

  function AuditSlider({ poolKey, s }) {
    const value   = vals[s.key];
    const editing = editingKey === s.key;
    const commit  = (n) => {
      const clamped = s.unit === "pct" ? Math.min(100, Math.max(0, Math.round(n))) : Math.max(0, n);
      setSlider(poolKey, s.key, clamped);
    };
    return (
      <div key={s.key} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "4px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--mute)", fontWeight: 500, letterSpacing: "0.01em" }}>{t(s.label)}</span>
          {editing ? (
            <input
              type="number" autoFocus value={editInput}
              onChange={(e) => setEditInput(e.target.value)}
              onBlur={() => { const n = parseFloat(editInput); if (!isNaN(n) && n >= 0) commit(n); setEditingKey(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }}
              style={{ fontFamily: "var(--mono)", fontSize: 24, fontWeight: 700, color: "var(--ink)", background: "transparent", border: "none", outline: "none", width: 140, textAlign: "right", letterSpacing: "-0.02em" }}
            />
          ) : (
            <span
              title="Click to type"
              onClick={() => { setEditInput(String(value)); setEditingKey(s.key); }}
              style={{ fontFamily: "var(--mono)", fontSize: 24, color: "var(--ink)", fontWeight: 700, letterSpacing: "-0.02em", cursor: "text" }}
            >
              {fmtSlider(s, value)}
            </span>
          )}
        </div>
        <input
          type="range"
          className="audit-slider"
          min={s.min} max={s.max} step={isAnimating ? 1 : s.step}
          value={Math.min(Math.max(value, s.min), s.max)}
          onChange={(e) => setSlider(poolKey, s.key, Number(e.target.value))}
          style={{ '--pct': sliderPct(value, s.min, s.max) }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{s.min.toLocaleString(locale)}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{s.max.toLocaleString(locale)}</span>
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

  function AuditTabs() {
    return (
      <div style={{
        maxWidth: 520, margin: "0 auto", padding: 6, borderRadius: 10,
        display: "grid", gridTemplateColumns: `repeat(${AUDIT_POOLS.length}, 1fr)`, gap: 4,
      }}>
        {AUDIT_POOLS.map((p) => {
          const on = p.key === activeKey;
          return (
            <button
              key={p.key}
              onClick={() => { setActiveKey(p.key); setEditingKey(null); }}
              className="niche-btn"
              style={{
                border: "none", cursor: "pointer", padding: "10px 4px 8px", borderRadius: 7,
                background: on ? "linear-gradient(145deg, var(--paper), var(--bg-2))" : "transparent",
                boxShadow: on ? "var(--sh-raised-crisp)" : "none",
                color: on ? "var(--ink)" : "var(--mute)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                transition: "all 200ms ease",
              }}
              aria-pressed={on}>
              <span style={{ width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", color: on ? "var(--wine)" : "var(--mute)" }}>
                {AUDIT_ICONS[p.key]}
              </span>
              <span style={{
                fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.1em",
                textTransform: "uppercase", fontWeight: 500, lineHeight: 1.25, textAlign: "center",
              }}>{t('audit.tab_' + p.key)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  /* ── Sliders column: the active pool's two, then the shared project value ── */
  function SlidersCol() {
    return (
      <div className="audit-pressed" style={{
        borderRadius: 16, padding: "28px 28px",
        display: "flex", flexDirection: "column", height: "100%", gap: 0,
      }}>
        {activePool.sliders.map((s) => AuditSlider({ poolKey: activePool.key, s }))}
        <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
        {AuditSlider({ poolKey: null, s: AUDIT_VALUE_SLIDER })}
        {activePool.valueFactor !== 1 && (
          <div style={{ marginTop: 10, fontFamily: "var(--sans)", fontSize: 11.5, color: "var(--mute-2)", lineHeight: 1.45 }}>
            {t('audit.value_note')
              .replace('{v}', symbol + Math.round(avgValue * activePool.valueFactor).toLocaleString(locale))
              .replace('{p}', Math.round(activePool.valueFactor * 100) + '%')}
          </div>
        )}
      </div>
    );
  }

  /* ── Results column ── */
  function ResultsCol() {
    const metrics = [
      { label: t('audit.pool_' + activePool.key), value: r.size,      bar: 100, first: true },
      { label: t('audit.metric_responded'),       value: r.responded, bar: pctOfPool(r.responded) },
      { label: t('audit.metric_booked'),          value: r.booked,    bar: pctOfPool(r.booked) },
      { label: t('audit.metric_closed'),          value: r.closed,    bar: pctOfPool(r.closed) },
    ];
    return (
      <div className="neu-raised-large" style={{ borderRadius: 16, padding: "36px 36px 32px", display: "flex", flexDirection: "column", gap: 28, height: "100%" }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
            {t('audit.label_revenue')}
          </div>
          <div style={{ fontFamily: "Lora", fontSize: "clamp(48px, 4.5vw, 72px)", color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.03em" }}>
            {fmtFull(revenueDisplay !== null ? revenueDisplay : r.revenue)}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--mute)" }}>{t('audit.untouched')}</div>

          {showCombined && (
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)",
              display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap",
            }}>
              <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--mute)", lineHeight: 1.4 }}>
                {touchedPools.map((p) => t('audit.tab_' + p.key)).join(" + ")}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 17, fontWeight: 700, color: "var(--wine)", letterSpacing: "-0.01em" }}>
                {fmtFull(combinedTotal)}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {metrics.map((m) => (
            <div key={m.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--mute)", fontWeight: 500 }}>{m.label}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--ink)", fontWeight: 700 }}>
                  {!m.first && <span style={{ fontSize: 11, color: "var(--mute-2)", marginRight: 6 }}>{Math.round(m.bar * animProgress)}%</span>}
                  {m.value.toLocaleString(locale)}
                </span>
              </div>
              {MetricBar({ pct: m.bar })}
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5 }}>
          {t('audit.recover_prefix')} <strong style={{ color: "var(--ink)" }}>{r.closed} {t('audit.recover_deals')}</strong>
          {". "}
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
      <div style={{ marginBottom: isMobile ? 22 : 34, textAlign: "center", ...window.revealStyle(sectionInView, { delay: 0 }) }}>
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

      {/* Offer tabs */}
      <div style={{ marginBottom: isMobile ? 16 : 24, ...window.revealStyle(sectionInView, { delay: 100 }) }}>
        {AuditTabs()}
      </div>

      {/* 2-column: sliders + results */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 32, alignItems: "stretch", ...window.revealStyle(sectionInView, { delay: 150 }) }}>
        {SlidersCol()}
        {ResultsCol()}
      </div>

    </section>
  );
}
