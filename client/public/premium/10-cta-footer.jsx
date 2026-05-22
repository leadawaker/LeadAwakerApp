// CTA + Footer merged into a single dark container
// FooterMark lives in footer-mark.jsx (loaded before this file)

const sectionWrap = {
  maxWidth: 1240, margin: "0 auto", padding: "144px 48px"
};

const MAPS_URL = "https://www.google.com/maps/place/Christiaan+Huygensweg+32,+5223+BH+'s-Hertogenbosch,+Netherlands/@51.691872,5.2869323,17z";
const CAL_LINK = "lead-awaker-orlfpr/discovery-call";
const CAL_NAMESPACE = "discovery-call";

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

        const NS = "http://www.w3.org/2000/svg";
        const make = (tag, attrs) => {
          const el = document.createElementNS(NS, tag);
          Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
          return el;
        };

        /* Carved silhouette: SVG inner shadow clipped to the map shape. */
        let defs = svg.querySelector("defs");
        if (!defs) {
          defs = make("defs", {});
          svg.insertBefore(defs, svg.firstChild);
        }
        const filt = make("filter", { id: "map-carve", x: "-5%", y: "-5%", width: "110%", height: "110%" });
        // Correct inner-shadow recipe: blur alpha → offset → (alpha out offset) → color → clip → merge
        const f1 = make("feGaussianBlur", { in: "SourceAlpha", stdDeviation: "4", result: "blur" });
        const f2 = make("feOffset", { in: "blur", dx: "16", dy: "3", result: "offset" });
        const f3 = make("feComposite", { in: "SourceAlpha", in2: "offset", operator: "out", result: "inner" });
        const f4 = make("feFlood", { "flood-color": "#000000", "flood-opacity": "0.5", result: "flood" });
        const f5 = make("feComposite", { in: "flood", in2: "inner", operator: "in", result: "shadow" });
        const fMerge = make("feMerge", {});
        fMerge.appendChild(make("feMergeNode", { in: "SourceGraphic" }));
        fMerge.appendChild(make("feMergeNode", { in: "shadow" }));
        [f1, f2, f3, f4, f5, fMerge].forEach(el => filt.appendChild(el));
        defs.appendChild(filt);

        const silGroup = make("g", { filter: "url(#map-carve)" });
        Array.from(svg.querySelectorAll("path")).forEach(p => {
          p.setAttribute("fill", "rgba(215, 201, 170, 0.22)");
          p.setAttribute("stroke", "rgba(255,255,255,0.3)");
          p.setAttribute("stroke-width", "1");
          p.setAttribute("vector-effect", "non-scaling-stroke");
          silGroup.appendChild(p);
        });
        svg.appendChild(silGroup);

        svg.appendChild(make("circle", { cx: 307, cy: 482, r: 36, fill: "#7A2E3E", opacity: 0.4 }));
        svg.appendChild(make("circle", { cx: 307, cy: 482, r: 15, fill: "#FFB6C8" }));
        const label = make("text", {
          x: 330, y: 490,
          "font-family": "Geist Mono, monospace",
          "font-size": 66,
          "letter-spacing": 3,
          fill: "rgba(244,239,227,1)",
          stroke: "#000",
          "stroke-width": 7,
          "paint-order": "stroke fill"
        });
        label.textContent = "DEN BOSCH";
        svg.appendChild(label);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div ref={ref} aria-hidden style={{
      width: 110, height: 130, display: "block", lineHeight: 0,
    }} />
  );
}

/* ---------------------------- CTA + FOOTER ------------------------------- */
function CTA({ textures = true }) {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();

  /* ---- form state ---- */
  const [formState, setFormState] = React.useState("idle"); // idle | sending | sent | error
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [extraOpen, setExtraOpen] = React.useState(false);
  const [quotes, setQuotes] = React.useState(200);
  const [silentPct, setSilentPct] = React.useState(50);
  const [avgValue, setAvgValue] = React.useState(8000);
  const [quotesActive, setQuotesActive] = React.useState(true);
  const [silentActive, setSilentActive] = React.useState(true);
  const [valueActive, setValueActive] = React.useState(true);

  const [prefill, setPrefill] = React.useState(null);
  const [bookingConfirmed, setBookingConfirmed] = React.useState(false);
  const [bookedSlot, setBookedSlot] = React.useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const n = name.trim();
    const em = email.trim();
    const desc = description.trim();
    if (!n || !em) return;
    setFormState("sending");

    const extras = extraOpen ? {
      ...(quotesActive ? { quotes_per_year: quotes } : {}),
      ...(silentActive ? { silent_percentage: silentPct } : {}),
      ...(valueActive  ? { avg_project_value: avgValue } : {}),
    } : {};

    const extraLines = extraOpen
      ? [
          quotesActive ? `Quotes/year: ${quotes}` : null,
          silentActive ? `Go silent: ${silentPct}%` : null,
          valueActive  ? `Avg project value: €${avgValue.toLocaleString('nl-NL')}` : null,
        ].filter(Boolean)
      : [];
    const notes = desc + (extraLines.length ? "\n\n" + extraLines.join("\n") : "");

    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, email: em, description: desc, ...extras }),
      });
    } catch {
      // non-blocking: still show calendar even if lead capture errored
    }
    setPrefill({ name: n, email: em, notes });
    setFormState("sent");
  };

  const [contentRef, contentInView] = window.useInView();

  /* ---- light rotation state ---- */
  const rotateFrameRef  = React.useRef(null);
  const returnFrameRef  = React.useRef(null);
  const rotateStartRef  = React.useRef(null);
  const startAngleRef   = React.useRef(null);
  const origAngleRef    = React.useRef(null);

  const getLightAngle = () => {
    const s = getComputedStyle(document.documentElement);
    const lx = parseFloat(s.getPropertyValue("--lx") || "0");
    const ly = parseFloat(s.getPropertyValue("--ly") || "0");
    return Math.atan2(-ly, lx) * (180 / Math.PI);
  };

  const getLightIntensity = () =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--light-intensity") || "1") * 100;

  const startRotation = React.useCallback(() => {
    if (returnFrameRef.current) { cancelAnimationFrame(returnFrameRef.current); returnFrameRef.current = null; }
    if (rotateFrameRef.current) return;

    const fromAngle = getLightAngle();
    const normFrom  = ((fromAngle % 360) + 360) % 360;
    const travel    = -normFrom; // always backward (through top) to land exactly at 0°
    const intensity = getLightIntensity();
    origAngleRef.current = normFrom;
    const t0  = performance.now();
    const dur = 12000;

    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      applyLight(normFrom + travel * e, 100, intensity);
      if (p < 1) {
        rotateFrameRef.current = requestAnimationFrame(tick);
      } else {
        rotateFrameRef.current = null;
        applyLight(0, 100, intensity);
      }
    };
    rotateFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRotation = React.useCallback(() => {
    if (!rotateFrameRef.current) return;
    cancelAnimationFrame(rotateFrameRef.current);
    rotateFrameRef.current = null;

    const fromAngle = getLightAngle();
    const toAngle   = 175; // return to CTA light angle
    const intensity = getLightIntensity();
    const t0 = performance.now();
    const dur = 8000;

    const ret = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const diff = ((toAngle - fromAngle + 540) % 360) - 180;
      applyLight(fromAngle + diff * e, 100, intensity);
      if (p < 1) {
        returnFrameRef.current = requestAnimationFrame(ret);
      } else {
        returnFrameRef.current = null;
        applyLight(toAngle, 100, intensity);
      }
    };
    returnFrameRef.current = requestAnimationFrame(ret);
  }, []);

  React.useEffect(() => () => {
    if (rotateFrameRef.current) cancelAnimationFrame(rotateFrameRef.current);
    if (returnFrameRef.current) cancelAnimationFrame(returnFrameRef.current);
  }, []);

  /* ---- scroll-triggered light shift: 175° in footer, 65° (default) elsewhere ---- */
  const sectionRef       = React.useRef(null);
  const scrollFrameRef   = React.useRef(null);

  const animateLightTo = React.useCallback((targetAngle, dur = 1600) => {
    if (scrollFrameRef.current) { cancelAnimationFrame(scrollFrameRef.current); scrollFrameRef.current = null; }
    if (window.__cancelGlobalLight) { window.__cancelGlobalLight(); window.__cancelGlobalLight = null; }
    const fromAngle = getLightAngle();
    const intensity = getLightIntensity();
    const diff = ((targetAngle - fromAngle + 540) % 360) - 180; // shortest path
    const t0 = performance.now();

    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      applyLight(fromAngle + diff * e, 100, intensity);
      if (p < 1) {
        scrollFrameRef.current = requestAnimationFrame(tick);
      } else {
        scrollFrameRef.current = null;
        applyLight(targetAngle, 100, intensity);
      }
    };
    scrollFrameRef.current = requestAnimationFrame(tick);
  }, []);

  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (rotateFrameRef.current) return; // don't fight form-focus rotation
        animateLightTo(entry.isIntersecting ? 175 : 65);
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [animateLightTo]);

  /* ---- styles ---- */
  const monoStyle = {
    fontFamily: "var(--mono)", fontSize: isMobile ? 11 : 12,
    letterSpacing: "0.06em", color: "rgba(244,239,227,0.82)",
    textDecoration: "none", lineHeight: 1.55
  };
  const labelStyle = {
    fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.18em",
    textTransform: "uppercase", color: "rgba(244,239,227,0.6)", marginBottom: 10
  };
  const linkStyle = {
    fontFamily: "var(--mono)", fontSize: 11,
    letterSpacing: "0.06em", color: "rgba(244,239,227,0.45)",
    textDecoration: "none", lineHeight: 1.8, display: "block"
  };

  return (
    <section ref={sectionRef} id="contact" data-screen-label="06 Contact" style={isMobile
      ? { maxWidth: 1240, margin: "0 auto", padding: "60px 18px 60px" }
      : { ...sectionWrap, paddingBottom: 0 }}>
      <div className="neu-raised" style={{
        borderRadius: 14, padding: isMobile ? "44px 24px 32px" : (formState === "sent" ? "36px 64px 52px" : "80px 64px 52px"),
        background: "linear-gradient(155deg, #221C14, #14110D)",
        color: "var(--paper)",
        boxShadow: "var(--sh-raised-large), inset calc(var(--lx) * 1px) calc(var(--ly) * 1px) 0 0 rgba(255,255,255,0.08)",
        position: "relative", overflow: "hidden",
        clipPath: "inset(0 round 14px)",
        display: "flex", flexDirection: "column",
        height: isMobile ? undefined : 720,
      }}>

        {/* Wood overlay */}
        {textures && (
          isMobile ? (
            <div aria-hidden style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: "url(/premium/assets/texture-wood.webp)",
              backgroundSize: "auto 160%", backgroundPosition: "center",
              backgroundRepeat: "no-repeat", opacity: 0.35, mixBlendMode: "overlay",
            }} />
          ) : (
            <div aria-hidden style={{
              position: "absolute", top: "50%", left: "50%",
              width: "140%", height: "140%", pointerEvents: "none",
              backgroundImage: "url(/premium/assets/texture-wood.webp)",
              backgroundSize: "cover", backgroundPosition: "center 70%",
              opacity: 0.35, mixBlendMode: "overlay",
              transform: "translate(-50%, -50%)",
            }} />
          )
        )}

        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient( 125% 100% at calc(50% + var(--lx) * 35%) calc(50% + var(--ly) * 35%),
              rgba(var(--light-warm), calc(var(--light-intensity) * 0.75)),
              transparent 75% ) `,
          mixBlendMode: "screen", opacity: 0.95,
        }} />
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(circle at 50% 40%, rgba(var(--light-warm), 0.08), transparent 80%)`,
          mixBlendMode: "screen",
        }} />

        {/* Wood shadow mask */}
        {isMobile ? (
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "url(/premium/assets/texture-wood.webp)",
            backgroundSize: "auto 160%", backgroundPosition: "center 70%",
            backgroundRepeat: "no-repeat", mixBlendMode: "multiply", opacity: 1,
          }} />
        ) : (
          <div aria-hidden style={{
            position: "absolute", top: "50%", left: "50%",
            width: "140%", height: "140%", pointerEvents: "none",
            backgroundImage: "url(/premium/assets/texture-wood.webp)",
            backgroundSize: "cover", backgroundPosition: "center 70%",
            mixBlendMode: "multiply", opacity: 1,
            transform: "translate(-50%, -50%)",
          }} />
        )}

        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(40% 30% at calc(50% + var(--lx) * 20%) calc(45% + var(--ly) * 20%),
              rgba(255, 255, 240, calc(var(--light-intensity) * 0.18)),
              transparent 55% )`,
          mixBlendMode: "screen", opacity: 1,
          WebkitMaskImage: `radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 35%, rgba(0,0,0,1) 70%)`,
          maskImage: `radial-gradient( ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 35%,  rgba(0,0,0,1) 70%)`
        }} />

        <div aria-hidden style={{
          position: "absolute", top: -120, right: -100, width: 360, height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(122,46,62,0.45), transparent 70%)",
          filter: "blur(20px)"
        }} />

        {/* TOP: request access + form — or full-width calendar after submit */}
        {formState === "sent" ? (
          <CalInlineEmbed
            prefill={prefill}
            bookingConfirmed={bookingConfirmed}
            bookedSlot={bookedSlot}
            onBookingConfirmed={(data) => { setBookingConfirmed(true); setBookedSlot(data); }}
            onRebook={() => setBookingConfirmed(false)}
            style={{ flex: 1, minHeight: 0 }}
          />
        ) : (
          <div ref={contentRef} style={{
            position: "relative", flex: 1, minHeight: 0, overflow: "hidden",
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr",
            gap: isMobile ? 32 : 80,
            alignItems: "stretch"
          }}>
            {/* Left: heading + map/terms pinned to bottom */}
            <div style={{ paddingTop: isMobile ? 0 : 24, display: "flex", flexDirection: "column", ...window.revealStyle(contentInView, { delay: 0 }) }}>
              <div>
                <div className="eyebrow" style={{ color: "rgba(244,239,227,0.55)", marginBottom: isMobile ? 18 : 32 }}>{t('cta.eyebrow')}</div>
                <h2 className="serif" style={{
                  margin: 0, fontSize: isMobile ? "clamp(34px, 9vw, 48px)" : "clamp(48px, 5.4vw, 84px)",
                  lineHeight: 0.98, letterSpacing: "-0.025em",
                  color: "var(--paper)", textWrap: "balance"
                }}>
                  {t('cta.h2_l1')}<br />{t('cta.h2_l2')}<br />{t('cta.h2_l3')}<br />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2em" }}>
                    <span className="italic" style={{ color: "#D9A3B0" }}>{t('cta.h2_italic')}</span>
                    <span style={{ display: "inline-block", marginTop: 5 }}>
                      <FooterMark size={isMobile ? 30 : 46} />
                    </span>
                  </span>
                </h2>
              </div>
              {!isMobile && (
                <div style={{
                  marginTop: "auto",
                  display: "flex", alignItems: "flex-end", gap: 40,
                }}>
                  <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" aria-label="Lead Awaker studio, Den Bosch, Netherlands" style={{ textDecoration: "none" }}>
                    <NetherlandsMap />
                  </a>
                  <div style={{ display: "flex", gap: 26, alignSelf: "flex-end", paddingBottom: 6 }}>
                    <a href="/premium/terms.html" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                      {t('cta.terms')}
                    </a>
                    <a href="/premium/privacy.html" target="_blank" rel="noopener noreferrer" style={linkStyle}>
                      {t('cta.privacy')}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Right: form */}
            <div style={{ paddingTop: isMobile ? 0 : 24, minHeight: 0, display: "flex", flexDirection: "column", ...window.revealStyle(contentInView, { delay: 150 }) }}>
              <div
                onFocus={startRotation}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) stopRotation(); }}
                style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
              >
                <div style={{
                  padding: 20, borderRadius: 10,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 24px 50px -30px rgba(0,0,0,0.6)",
                  flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
                }}>
                  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                      <p style={{
                        margin: 0,
                        fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.06em",
                        color: "rgba(244,239,227,0.55)", lineHeight: 1.5,
                      }}>
                        Five partner businesses at a time. Send us a short intro.
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                        <GlassInput ph={t('cta.ph_name')} value={name} onChange={(e) => setName(e.target.value)} />
                        <GlassInput ph={t('cta.ph_email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <GlassTextarea ph={t('cta.ph_describe')} value={description} onChange={(e) => setDescription(e.target.value)} />
                      <OptionalQuestions
                        t={t}
                        open={extraOpen}
                        setOpen={setExtraOpen}
                        quotes={quotes} setQuotes={setQuotes}
                        silentPct={silentPct} setSilentPct={setSilentPct}
                        avgValue={avgValue} setAvgValue={setAvgValue}
                        quotesActive={quotesActive} setQuotesActive={setQuotesActive}
                        silentActive={silentActive} setSilentActive={setSilentActive}
                        valueActive={valueActive} setValueActive={setValueActive}
                      />
                      {formState === "error" && (
                        <p style={{ margin: 0, fontSize: 12, color: "#D9A3B0", fontFamily: "var(--mono)" }}>
                          Something went wrong — please try again.
                        </p>
                      )}
                    </div>
                    <button type="submit" className="btn-neu" disabled={formState === "sending"} style={{
                      flexShrink: 0, marginTop: 12, justifyContent: "center",
                      background: "linear-gradient(145deg, #F4EFE3, #E5DECF)",
                      color: "var(--ink)", opacity: formState === "sending" ? 0.6 : 1,
                      boxShadow: "4px 4px 12px rgba(0,0,0,0.45), -2px -2px 8px rgba(255,255,255,0.05)"
                    }}>
                      {formState === "sending" ? "Sending…" : t('cta.btn_send')}
                      {formState !== "sending" && <ArrowSm />}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile-only: map + terms below form */}
        {isMobile && (
          <div style={{
            position: "relative", flexShrink: 0,
            display: "flex", alignItems: "flex-end", flexWrap: "wrap",
            gap: 24, marginTop: 44,
          }}>
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" aria-label="Lead Awaker studio, Den Bosch, Netherlands" style={{ textDecoration: "none" }}>
              <NetherlandsMap />
            </a>
            <div style={{ display: "flex", gap: 16, alignSelf: "flex-end", paddingBottom: 6 }}>
              <a href="/premium/terms.html" target="_blank" rel="noopener noreferrer" style={linkStyle}>{t('cta.terms')}</a>
              <a href="/premium/privacy.html" target="_blank" rel="noopener noreferrer" style={linkStyle}>{t('cta.privacy')}</a>
            </div>
          </div>
        )}

      </div>
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
      className="glass-field"
      style={{
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.18)",
        padding: "14px 18px", borderRadius: 6, outline: "none",
        color: "rgba(244,239,227,1)", fontFamily: "var(--sans)", fontSize: 14,
        width: "100%", boxSizing: "border-box"
      }} />
  );
}

function GlassTextarea({ ph, value, onChange }) {
  return (
    <textarea
      placeholder={ph}
      value={value}
      onChange={onChange}
      rows={1}
      className="glass-field"
      style={{
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.18)",
        padding: "14px 18px", borderRadius: 6, outline: "none",
        color: "rgba(244,239,227,1)", fontFamily: "var(--sans)", fontSize: 14,
        width: "100%", boxSizing: "border-box",
        resize: "none", lineHeight: "normal",
        height: 50, overflow: "hidden",
      }} />
  );
}

function CalInlineEmbed({ prefill, bookingConfirmed, bookedSlot, onBookingConfirmed, onRebook, style }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (bookingConfirmed) return;

    loadCalEmbed();

    /* Cal embed may not be ready immediately after loadCalEmbed() injects the
       script tag. Poll until Cal.ns exists (max ~3 s) before mounting. */
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
        config: { layout: "month_view", theme: "dark" },
      });

      ns("ui", {
        theme: "dark",
        hideEventTypeDetails: false,
        layout: "month_view",
        cssVarsPerTheme: {
          dark: {
            "cal-brand": "#D9A3B0",
            "cal-bg-emphasis": "#221C14",
            "cal-bg": "#14110D",
            "cal-bg-subtle": "#1C1815",
            "cal-bg-muted": "#1C1815",
            "cal-text": "#F4EFE3",
            "cal-text-emphasis": "#FFFFFF",
            "cal-border": "rgba(244,239,227,0.14)",
            "cal-border-subtle": "rgba(244,239,227,0.08)",
            "cal-border-emphasis": "rgba(244,239,227,0.22)",
          },
        },
      });
    };
    tryMount();

    const handleMessage = (e) => {
      const type = e.data?.data?.type || e.data?.type;
      if (type === "bookingSuccessful" || type === "cal:booking_confirmed") {
        onBookingConfirmed(e.data?.data || e.data || {});
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [prefill, bookingConfirmed]);

  if (bookingConfirmed) {
    const dt = bookedSlot?.startTime ? new Date(bookedSlot.startTime) : null;
    const formatted = dt ? dt.toLocaleString("nl-NL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : null;
    return (
      <div style={{ ...style, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "48px 0" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>✓</div>
        <p style={{ fontSize: 18, color: "var(--paper)", fontFamily: "var(--serif)", margin: "0 0 8px" }}>
          Discovery call booked.
        </p>
        {formatted && (
          <p style={{ fontSize: 13, color: "#D9A3B0", fontFamily: "var(--mono)", margin: "0 0 28px", letterSpacing: "0.06em" }}>
            {formatted}
          </p>
        )}
        <button
          type="button"
          onClick={onRebook}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.08em",
            color: "rgba(244,239,227,0.5)", textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Need to rebook?
        </button>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{ ...style, width: "100%", borderRadius: 8, overflowY: "auto", overflowX: "hidden" }}
    />
  );
}

function OptionalQuestions({ t, open, setOpen, quotes, setQuotes, silentPct, setSilentPct, avgValue, setAvgValue, quotesActive, setQuotesActive, silentActive, setSilentActive, valueActive, setValueActive }) {
  const rows = [
    { label: t('cta.q_quotes'), min: 50,   max: 2000,   step: 50,   value: quotes,    setValue: setQuotes,    active: quotesActive, setActive: setQuotesActive, fmt: (v) => v.toLocaleString('nl-NL') },
    { label: t('cta.q_silent'), min: 0,    max: 100,    step: 5,    value: silentPct, setValue: setSilentPct, active: silentActive, setActive: setSilentActive, fmt: (v) => v + "%" },
    { label: t('cta.q_value'),  min: 1000, max: 100000, step: 1000, value: avgValue,  setValue: setAvgValue,  active: valueActive,  setActive: setValueActive,  fmt: (v) => "€" + v.toLocaleString('nl-NL') },
  ];
  return (
    <div style={{
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.04)",
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: "transparent", border: "none",
          padding: "12px 16px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          color: "rgba(244,239,227,0.78)", fontFamily: "var(--mono)",
          fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
        }}
      >
        <span>{t('cta.optional_toggle')}</span>
        <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms ease", fontSize: 12 }}>⌄</span>
      </button>
      {open && (
        <div style={{ padding: "4px 16px 16px", display: "grid", gap: 18 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ opacity: row.active ? 1 : 0.45 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "rgba(244,239,227,0.7)", fontFamily: "var(--sans)" }}>{row.label}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: row.active ? "#D9A3B0" : "rgba(244,239,227,0.35)" }}>
                    {row.active ? row.fmt(row.value) : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => row.setActive(!row.active)}
                    title={row.active ? "Leave blank" : "Set a value"}
                    style={{
                      background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
                      width: 17, height: 17, borderRadius: 999, padding: 0, cursor: "pointer",
                      color: "rgba(244,239,227,0.55)", fontSize: 11, lineHeight: 0,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >{row.active ? "×" : "+"}</button>
                </span>
              </div>
              <input
                type="range" className="cta-slider"
                min={row.min} max={row.max} step={row.step}
                value={row.value}
                disabled={!row.active}
                onChange={(e) => row.setValue(Number(e.target.value))}
                style={{
                  '--pct': (((row.value - row.min) / (row.max - row.min)) * 100).toFixed(1) + "%",
                  width: "100%", cursor: row.active ? "pointer" : "not-allowed",
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Inject CTA slider style + placeholder color */
(function() {
  if (document.getElementById('_cta-slider-style')) return;
  const s = document.createElement('style');
  s.id = '_cta-slider-style';
  s.textContent = `
    .cta-slider { -webkit-appearance: none; appearance: none; height: 28px; background: transparent; outline: none; cursor: pointer; padding: 0; margin: 0; border: none; }
    .cta-slider::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: linear-gradient(to right, #D9A3B0 var(--pct, 0%), rgba(255,255,255,0.14) var(--pct, 0%)); }
    .cta-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; margin-top: -5px; border-radius: 50%; background: #D9A3B0; box-shadow: 0 0 0 2px rgba(34,28,20,0.9), 0 2px 6px rgba(0,0,0,0.4); cursor: grab; }
    .cta-slider:active::-webkit-slider-thumb { cursor: grabbing; }
    .cta-slider::-moz-range-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.14); }
    .cta-slider::-moz-range-progress { height: 6px; border-radius: 999px; background: #D9A3B0; }
    .cta-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; border: none; background: #D9A3B0; box-shadow: 0 0 0 2px rgba(34,28,20,0.9), 0 2px 6px rgba(0,0,0,0.4); cursor: grab; }
  `;
  document.head.appendChild(s);
})();

/* Inject placeholder color once */
(function() {
  if (document.getElementById('_glass-field-style')) return;
  const s = document.createElement('style');
  s.id = '_glass-field-style';
  s.textContent = '.glass-field::placeholder { color: rgba(244,239,227,0.55); opacity: 1; }';
  document.head.appendChild(s);
})();

const ArrowSm = window.ArrowSm;

/* Footer kept as a no-op so app-main's <Footer /> reference (if any) doesn't break. */
function Footer() { return null; }
