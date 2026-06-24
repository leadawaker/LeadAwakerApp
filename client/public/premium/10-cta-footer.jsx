// CTA + Footer — cream background with live-edge wood slab borders

const CAL_LINK = "leadawaker/reactivatie-scan";
const CAL_NAMESPACE = "reactivatie-scan";
const MAPS_URL = "https://www.google.com/maps/place/Christiaan+Huygensweg+32,+5223+BH+'s-Hertogenbosch,+Netherlands/@51.691872,5.2869323,17z";

/* Cal.com inline embed loader — runs once per page */
function loadCalEmbed() {
  if (window.__calEmbedLoaded) return;
  window.__calEmbedLoaded = true;
  (function (C, A, L) {
    let p = function (a, ar) { a.q.push(ar); };
    let d = C.document;
    C.Cal = C.Cal || function () {
      let cal = C.Cal; let ar = arguments;
      if (!cal.loaded) {
        cal.ns = {}; cal.q = cal.q || [];
        d.head.appendChild(d.createElement("script")).src = A;
        cal.loaded = true;
      }
      if (ar[0] === L) {
        const api = function () { p(api, arguments); };
        const namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === "string") {
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ["initNamespace", namespace]);
        } else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
  })(window, "https://app.cal.com/embed/embed.js", "init");
  window.Cal("init", CAL_NAMESPACE, { origin: "https://app.cal.com" });
}

/* ------------------------- NETHERLANDS MAP SVG --------------------------- */
function NetherlandsMap() {
  const ref = React.useRef(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/premium/netherlands.svg")
      .then((r) => r.text())
      .then((text) => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = text;
        const svg = ref.current.querySelector("svg");
        if (!svg) return;
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.setAttribute("viewBox", "0 0 612.54 723.62");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.style.display = "block";
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.overflow = "visible";
        svg.querySelectorAll("path").forEach((p) => {
          p.setAttribute("fill", "rgb(240, 234, 222)");
          p.setAttribute("stroke", "rgb(103, 95, 80)");
          p.setAttribute("stroke-width", "5");
          p.setAttribute("stroke-linejoin", "round");
        });
        const NS = "http://www.w3.org/2000/svg";
        const make = (tag, attrs) => {
          const el = document.createElementNS(NS, tag);
          Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
          return el;
        };
        svg.appendChild(make("circle", { cx: 307, cy: 482, r: 36, fill: "#bd4660", opacity: 0.22 }));
        svg.appendChild(make("circle", { cx: 307, cy: 482, r: 12, fill: "#e55a7b" }));
        const label = make("text", {
          x: 370, y: 490,
          "font-family": "Manrope, sans-serif",
          "font-size": 60,
          "letter-spacing": 6,
          fill: "rgb(0, 0, 0, 1)",
          stroke: "rgb(246, 243, 235)",
          "stroke-width": "16",
          "paint-order": "stroke fill",
        });
        label.textContent = "DEN BOSCH";
        svg.appendChild(label);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return <div ref={ref} aria-hidden style={{ width: 110, height: 130, display: "block", lineHeight: 0 }} />;
}

/* ---------------------------- CTA + FOOTER ------------------------------- */
function buildCtaBgTransform({ scale, tx, ty, rot, flipX, flipY }) {
  const sx = (flipX ? -1 : 1) * scale;
  const sy = (flipY ? -1 : 1) * scale;
  return `translate(-50%, -50%) rotate(${rot}deg) scale(${sx}, ${sy}) translate(${tx}%, ${ty}%)`;
}

function CTA() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();

  /* ---- bg image debug adjustments ---- */
  const [bgAdj, setBgAdj] = React.useState(() =>
    typeof loadCtaBgAdjustments !== "undefined" ? loadCtaBgAdjustments() : { scale: 1, tx: 0, ty: 5, rot: 0, flipX: false, flipY: false, brightness: 1, cropTop: 43, cropTilt: 0 }
  );
  const handleBgAdjUpdate = React.useCallback((next) => {
    setBgAdj(next);
    if (typeof saveCtaBgAdjustments !== "undefined") saveCtaBgAdjustments(next);
  }, []);

  /* ---- form state ---- */
  const [formState, setFormState] = React.useState("idle");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [quotes, setQuotes] = React.useState(200);
  const [silentPct, setSilentPct] = React.useState(50);
  const [avgValue, setAvgValue] = React.useState(40000);
  const [numbersAccurate, setNumbersAccurate] = React.useState(false);

  const [prefill, setPrefill] = React.useState(null);
  const formHeightRef = React.useRef(null);

  React.useEffect(() => {
    const handleAuditChange = (e) => {
      const { quotes: q, silentPct: sp, avgValue: av } = e.detail;
      if (q !== undefined && q !== quotes) setQuotes(q);
      if (sp !== undefined && sp !== silentPct) setSilentPct(sp);
      if (av !== undefined && av !== avgValue) setAvgValue(av);
    };
    window.addEventListener('auditSliderChange', handleAuditChange);

    const interval = setInterval(() => {
      if (window.__leadAwakerCalc) {
        if (window.__leadAwakerCalc.quotes !== undefined && window.__leadAwakerCalc.quotes !== quotes) setQuotes(window.__leadAwakerCalc.quotes);
        if (window.__leadAwakerCalc.silentPct !== undefined && window.__leadAwakerCalc.silentPct !== silentPct) setSilentPct(window.__leadAwakerCalc.silentPct);
        if (window.__leadAwakerCalc.avgValue !== undefined && window.__leadAwakerCalc.avgValue !== avgValue) setAvgValue(window.__leadAwakerCalc.avgValue);
      }
    }, 100);
    return () => {
      clearInterval(interval);
      window.removeEventListener('auditSliderChange', handleAuditChange);
    };
  }, [quotes, silentPct, avgValue]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    const em = email.trim();
    const desc = description.trim();
    if (!n || !em || !numbersAccurate) return;
    setFormState("sending");

    const extras = {
      quotes_per_year: quotes,
      silent_percentage: silentPct,
      avg_project_value: avgValue,
    };
    const notes = desc + "\n\n" + [
      `Quotes/year: ${quotes}`,
      `Go silent: ${silentPct}%`,
      `Avg project value: €${avgValue.toLocaleString('nl-NL')}`,
    ].join("\n");

    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, email: em, description: desc, ...extras }),
      });
    } catch {
      // non-blocking
    }
    if (formHeightRef.current) {
      formHeightRef.current.style.height = formHeightRef.current.offsetHeight + "px";
      formHeightRef.current.style.overflow = "auto";
    }
    setPrefill({ name: n, email: em, notes });
    setFormState("sent");
  };

  const [contentRef, contentInView] = window.useInView();


  /* ---- styles ---- */
  const linkStyle = {
    fontFamily: "var(--mono)", fontSize: 11,
    letterSpacing: "0.06em", color: "rgba(28,24,16,0.45)",
    textDecoration: "none", lineHeight: 1.8, display: "block"
  };

  return (
    <section id="contact" data-screen-label="06 Contact" style={{
      padding: isMobile ? "48px 18px 48px" : "80px 32px 64px",
    }}>
      <div className="neu-raised-large" style={{
        maxWidth: 1176, margin: "0 auto", borderRadius: 20,
        padding: isMobile ? "28px 20px 12px" : "48px 56px 20px",
        position: "relative", overflow: "hidden",
      }}>
        {(() => {
          const cropL = bgAdj.cropTop - (bgAdj.cropTilt ?? 0);
          const cropR = bgAdj.cropTop + (bgAdj.cropTilt ?? 0);
          return (
            <>
              <div aria-hidden style={{
                position: "absolute", inset: 0, zIndex: 0,
                clipPath: `polygon(0 ${cropL}%, 100% ${cropR}%, 100% 100%, 0 100%)`,
                pointerEvents: "none",
              }}>
                <img
                  src="/premium/uploads/textures/ctatext17.jpg"
                  style={{
                    position: "absolute", top: "50%", left: "50%",
                    width: "100%", height: "auto",
                    transform: buildCtaBgTransform(bgAdj),
                    transformOrigin: "0 0",
                    filter: `brightness(${bgAdj.brightness ?? 1})`,
                    pointerEvents: "none", userSelect: "none",
                  }}
                />
              </div>
              {/* neu-polished highlight sheen — sits above texture, below crop effects */}
              <div aria-hidden style={{
                position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
                background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 40%, transparent 40%)",
                borderRadius: "inherit",
              }} />
              {/* Crop edge: drop shadow into plain area + 2px highlight */}
              <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none", overflow: "hidden", borderRadius: "inherit" }}>
                <defs>
                  <filter id="cta-shadow-filt" x="-2%" y="-600%" width="104%" height="700%">
                    <feGaussianBlur stdDeviation="1 6" />
                  </filter>
                  <clipPath id="cta-above-crop">
                    <polygon points={`0,0 100,0 100,${cropR} 0,${cropL}`} />
                  </clipPath>
                </defs>
                {/* Blurred dark line, clipped to plain area — shadow cast by texture edge */}
                <line
                  x1="0" y1={cropL} x2="100" y2={cropR}
                  stroke="rgba(0,0,0,0)"
                  strokeWidth="3"
                  filter="url(#cta-shadow-filt)"
                  clipPath="url(#cta-above-crop)"
                  vectorEffect="non-scaling-stroke"
                />
                {/* 2px highlight at crop edge */}
                <line
                  x1="0" y1={cropL} x2="100" y2={cropR}
                  stroke="rgba(255,255,255,0.20)"
                  strokeWidth="6"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </>
          );
        })()}
        <div ref={formHeightRef} style={{ position: "relative", zIndex: 3 }}>
        {formState === "sent" ? (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setFormState("idle")}
              aria-label="Close calendar"
              style={{
                position: "absolute", top: 0, right: 0, zIndex: 10,
                background: "var(--surface)", border: "1px solid rgba(28,24,16,0.12)",
                borderRadius: "50%", width: 32, height: 32,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: "var(--ink)", lineHeight: 1,
                boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
              }}
            >×</button>
            <CalInlineEmbed prefill={prefill} style={{ minHeight: 520 }} />
          </div>
        ) : (
          <>
            <div ref={contentRef} style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr",
              gap: isMobile ? 32 : 80,
              alignItems: "stretch",
            }}>
              {/* Left: heading */}
              <div style={{ paddingTop: isMobile ? 0 : 24, display: "flex", flexDirection: "column", ...window.revealStyle(contentInView, { delay: 0 }) }}>
                <div className="eyebrow" style={{ color: "rgba(28,24,16,0.42)", marginBottom: isMobile ? 18 : 28 }}>{t('cta.eyebrow')}</div>
                <h2 className="serif" style={{
                  margin: 0, fontSize: isMobile ? "clamp(34px, 9vw, 48px)" : "clamp(48px, 5.4vw, 64px)",
                  lineHeight: 0.98, letterSpacing: "-0.025em",
                  color: "var(--ink)", whiteSpace: "nowrap",
                  textShadow: "0 1px 0 rgba(0,0,0,0.12)",
                }}>
                  {t('cta.h2_l1')}<br />
                  <span className="italic" style={{ color: "#9B3A50", whiteSpace: "nowrap" }}>
                    {t('cta.h2_l2')} {t('cta.h2_italic')}
                  </span>
                </h2>
                <p style={{
                  margin: isMobile ? "16px 0 0" : "22px 0 0",
                  fontFamily: "var(--sans)", fontSize: isMobile ? 16 : 18,
                  fontWeight: 600, letterSpacing: "-0.01em",
                  color: "rgba(28,24,16,0.8)",
                  lineHeight: 1.4,
                  textShadow: "0 1px 0 rgba(0,0,0,0.06)",
                }}>
                  {t('cta.btn_sub')}
                </p>
              </div>

              {/* Right: form */}
              <div style={{ paddingTop: isMobile ? 0 : 24, display: "flex", flexDirection: "column", ...window.revealStyle(contentInView, { delay: 150 }) }}>
                <div className="glass-strong" style={{ padding: 20, borderRadius: 14, flex: 1, display: "flex", flexDirection: "column" }}>
                  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                        <GlassInput ph={t('cta.ph_name')} value={name} onChange={(e) => setName(e.target.value)} />
                        <GlassInput ph={t('cta.ph_email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <GlassTextarea ph={t('cta.ph_describe')} value={description} onChange={(e) => setDescription(e.target.value)} />
                      <QualifyingSliders
                        t={t}
                        quotes={quotes} setQuotes={setQuotes}
                        silentPct={silentPct} setSilentPct={setSilentPct}
                        avgValue={avgValue} setAvgValue={setAvgValue}
                        numbersAccurate={numbersAccurate} setNumbersAccurate={setNumbersAccurate}
                        name={name}
                      />
                      {formState === "error" && (
                        <p style={{ margin: 0, fontSize: 12, color: "#7A2E3E", fontFamily: "var(--mono)" }}>
                          Something went wrong — please try again.
                        </p>
                      )}
                    </div>
                    <button type="submit" className="btn-wine" disabled={formState === "sending" || !numbersAccurate} style={{
                      flexShrink: 0, marginTop: 14, justifyContent: "center", width: "100%",
                      textTransform: "none", letterSpacing: "0.01em", fontSize: 15, borderRadius: 8,
                      padding: "18px 28px",
                    }}>
                      {formState === "sending" ? "Sending…" : t('cta.btn_send')}
                      {formState !== "sending" && <ArrowSm />}
                    </button>
                    <p style={{
                      flexShrink: 0, margin: "10px 0 0",
                      fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.04em",
                      color: "rgba(28,24,16,0.38)", lineHeight: 1.5,
                      textAlign: "center",
                    }}>
                      {t('cta.btn_after')}
                    </p>
                  </form>
                </div>
              </div>
            </div>

            {/* Footer row: map+favicon left, terms center, copyright right */}
            <div style={{
              marginTop: isMobile ? 24 : 32,
              display: "flex", alignItems: "flex-end", justifyContent: "space-between",
              gap: isMobile ? 20 : 20,
              flexWrap: isMobile ? "wrap" : "nowrap",
            }}>
              {/* Map + favicon — bottom aligned together */}
              <div style={{ display: "flex", gap: 16, alignItems: "flex-end", paddingBottom: 18 }}>
                <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" aria-label="Lead Awaker studio, Den Bosch, Netherlands" style={{ textDecoration: "none" }}>
                  <NetherlandsMap />
                </a>
                <FooterMark size={44} />
              </div>
              {/* Terms + Privacy */}
              <div style={{ display: "flex", gap: isMobile ? 16 : 30, alignSelf: "flex-end", paddingBottom: 18 }}>
                <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, color: "#3D2817" }}>{t('cta.terms')}</a>
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, color: "#3D2817" }}>{t('cta.privacy')}</a>
              </div>
              {/* Copyright */}
              <span style={{ ...linkStyle, display: "block", paddingBottom: 18, color: "#3D2817", whiteSpace: "nowrap" }}>
                Lead Awaker 2026 &mdash; All rights reserved.
              </span>
            </div>
          </>
        )}
        </div>
      </div>
      {typeof CTABgDebug !== "undefined" && (
        <CTABgDebug adj={bgAdj} onUpdate={handleBgAdjUpdate} />
      )}
    </section>
  );
}

function GlassInput({ ph, type = "text", value, onChange }) {
  return (
    <input
      type={type}
      placeholder={ph}
      value={value}
      onChange={onChange}
      className="neu-input"
      style={{ width: "100%", boxSizing: "border-box", borderRadius: 10 }} />
  );
}

function GlassTextarea({ ph, value, onChange }) {
  return (
    <textarea
      placeholder={ph}
      value={value}
      onChange={onChange}
      rows={1}
      className="neu-input"
      style={{
        width: "100%", boxSizing: "border-box", borderRadius: 10,
        resize: "none", lineHeight: "normal", height: 50, overflow: "hidden",
      }} />
  );
}

function CalInlineEmbed({ prefill, style }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    loadCalEmbed();

    let attempts = 0;
    const tryMount = () => {
      attempts++;
      if (!window.Cal?.ns) {
        if (attempts < 30) setTimeout(tryMount, 100);
        return;
      }
      const ns = window.Cal.ns[CAL_NAMESPACE];
      if (!ns || !ref.current) return;

      ref.current.innerHTML = "";

      const linkWithPrefill = CAL_LINK + "?" + new URLSearchParams({
        name: prefill?.name || "",
        email: prefill?.email || "",
        notes: prefill?.notes || "",
      }).toString();

      ns("inline", {
        elementOrSelector: ref.current,
        calLink: linkWithPrefill,
        config: { layout: "month_view", theme: "light" },
      });

      ns("ui", {
        theme: "light",
        hideEventTypeDetails: false,
        layout: "month_view",
        cssVarsPerTheme: {
          light: {
            "cal-brand": "#9B3A50",
            "cal-bg": "#ffffff",
            "cal-bg-emphasis": "#f5f5f5",
            "cal-bg-subtle": "#eeeeee",
            "cal-bg-muted": "#f9f9f9",
            "cal-text": "#1C1810",
            "cal-text-emphasis": "#0D0B08",
            "cal-border": "rgba(28,24,16,0.12)",
            "cal-border-subtle": "rgba(28,24,16,0.07)",
            "cal-border-emphasis": "rgba(28,24,16,0.2)",
          },
        },
      });
    };
    tryMount();
  }, [prefill]);

  return (
    <div
      ref={ref}
      style={{ ...style, width: "100%", borderRadius: 8, background: "#ffffff", overflowY: "auto", overflowX: "hidden" }}
    />
  );
}

function QualifyingSliders({ t, quotes, setQuotes, silentPct, setSilentPct, avgValue, setAvgValue, numbersAccurate, setNumbersAccurate, name }) {
  const handleSliderChange = (setter, value) => {
    setter(value);
    window.__leadAwakerCalc = window.__leadAwakerCalc || {};
    if (setter === setQuotes) {
      window.__leadAwakerCalc.quotes = value;
    } else if (setter === setSilentPct) {
      window.__leadAwakerCalc.silentPct = value;
    } else if (setter === setAvgValue) {
      window.__leadAwakerCalc.avgValue = value;
    }
    window.dispatchEvent(new CustomEvent('ctaSliderChange', {
      detail: {
        quotes: setter === setQuotes ? value : quotes,
        silentPct: setter === setSilentPct ? value : silentPct,
        avgValue: setter === setAvgValue ? value : avgValue
      }
    }));
  };

  const rows = [
    { label: t('cta.q_quotes'), min: 50,   max: 2000,   step: 50,   value: quotes,    setValue: setQuotes,    fmt: (v) => v.toLocaleString('nl-NL') },
    { label: t('cta.q_silent'), min: 0,    max: 100,    step: 5,    value: silentPct, setValue: setSilentPct, fmt: (v) => v + "%" },
    { label: t('cta.q_value'),  min: 1000, max: 100000, step: 1000, value: avgValue,  setValue: setAvgValue,  fmt: (v) => "€" + v.toLocaleString('nl-NL') },
  ];
  const hasName = name && name.trim().length > 0;
  return (
    <div style={{
      borderRadius: 8,
      overflow: "hidden",
    }}>
      <div style={{ padding: "16px 16px 14px", display: "grid", gap: 16 }}>
        {rows.map((row) => (
          <div key={row.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: "var(--ink)", fontFamily: "var(--sans)" }}>{row.label}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: hasName ? 800 : 700, color: hasName ? "var(--wine)" : "var(--ink)" }}>
                {row.fmt(row.value)}
              </span>
            </div>
            <input
              type="range" className="cta-slider"
              min={row.min} max={row.max} step={row.step}
              value={row.value}
              onChange={(e) => handleSliderChange(row.setValue, Number(e.target.value))}
              style={{
                '--pct': (((row.value - row.min) / (row.max - row.min)) * 100).toFixed(1) + "%",
                width: "100%", cursor: "pointer",
              }}
            />
          </div>
        ))}
      </div>
      <label style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 3px",
        cursor: "pointer",
      }}>
        <input
          type="checkbox"
          checked={numbersAccurate}
          onChange={(e) => setNumbersAccurate(e.target.checked)}
          className="cta-checkbox"
          style={hasName ? {
            boxShadow: "0 0 0 2px var(--wine)",
            borderRadius: "4px"
          } : {}}
        />
        <span style={{
          fontSize: 14,
          fontFamily: "var(--sans)",
          color: hasName ? "var(--wine)" : "rgba(28,24,16,0.75)",
          lineHeight: 1.45,
          fontWeight: hasName ? 700 : 400
        }}>
          {t('cta.checkbox_confirm')}
        </span>
      </label>
    </div>
  );
}

/* Inject CTA slider + checkbox styles */
(function() {
  if (document.getElementById('_cta-slider-style')) return;
  const s = document.createElement('style');
  s.id = '_cta-slider-style';
  s.textContent = `
    .cta-slider { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 40px; background: transparent; outline: none; cursor: pointer; padding: 0; margin: 0; border: none; }
    .cta-slider::-webkit-slider-container { overflow: visible; }
    .cta-slider::-webkit-slider-runnable-track { height: 10px; border-radius: 999px; background: linear-gradient(to right, rgba(94,34,48,0.38) var(--pct, 0%), var(--bg-2) var(--pct, 0%)); box-shadow: var(--sh-inset-crisp); }
    .cta-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; margin-top: calc((8px - 20px) / 2); border-radius: 50%; background: linear-gradient(145deg, var(--wine-soft), var(--wine)); box-shadow: var(--sh-raised-crisp), 0 0 0 2px rgba(255,252,244,0.95); cursor: grab; transition: transform 100ms ease; }
    .cta-slider:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.12); }
    .cta-slider::-moz-range-track { height: 8px; border-radius: 999px; background: var(--bg-2); box-shadow: var(--sh-inset-crisp); }
    .cta-slider::-moz-range-progress { height: 8px; border-radius: 999px; background: rgba(94,34,48,0.38); }
    .cta-slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; border: none; background: linear-gradient(145deg, var(--wine-soft), var(--wine)); box-shadow: var(--sh-raised-crisp), 0 0 0 2px rgba(255,252,244,0.95); cursor: grab; }
    .cta-checkbox { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; margin: 0; flex-shrink: 0; border-radius: 4px; background: var(--bg); box-shadow: var(--sh-inset-crisp); cursor: pointer; position: relative; transition: background 120ms ease; }
    .cta-checkbox:checked { background: var(--wine); }
    .cta-checkbox:checked::after { content: ""; position: absolute; left: 4px; top: 1px; width: 5px; height: 9px; border: solid #F4EFE3; border-width: 0 2px 2px 0; transform: rotate(45deg); }
  `;
  document.head.appendChild(s);
})();


const ArrowSm = window.ArrowSm;
