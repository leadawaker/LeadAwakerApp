// CTA + Footer merged into a single dark container
// FooterMark lives in footer-mark.jsx (loaded before this file)

const sectionWrap = {
  maxWidth: 1240, margin: "0 auto", padding: "144px 48px"
};

const MAPS_URL = "https://www.google.com/maps/place/Christiaan+Huygensweg+32,+5223+BH+'s-Hertogenbosch,+Netherlands/@51.691872,5.2869323,17z";

/* ------------------------- NETHERLANDS MAP SVG --------------------------- */
function NetherlandsMap() {
  const ref = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/premium/uploads/netherlands.svg")
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
          p.setAttribute("fill", "rgba(244,239,227,0.16)");
          p.setAttribute("stroke", "rgba(244,239,227,0.2)");
          p.setAttribute("stroke-width", "5");
          p.setAttribute("stroke-linejoin", "round");
        });

        const NS = "http://www.w3.org/2000/svg";
        const make = (tag, attrs) => {
          const el = document.createElementNS(NS, tag);
          Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
          return el;
        };

        svg.appendChild(make("circle", { cx: 307, cy: 482, r: 36, fill: "#7A2E3E", opacity: 0.22 }));
        svg.appendChild(make("circle", { cx: 307, cy: 482, r: 12, fill: "#D9A3B0" }));
        const label = make("text", {
          x: 330, y: 490,
          "font-family": "Geist Mono, monospace",
          "font-size": 66,
          "letter-spacing": 3,
          fill: "rgba(244,239,227,1)"
        });
        label.textContent = "DEN BOSCH";
        svg.appendChild(label);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div ref={ref} aria-hidden style={{
      width: 110, height: 130, display: "block", lineHeight: 0
    }} />
  );
}

/* ---------------------------- CTA + FOOTER ------------------------------- */
function CTA({ textures = true }) {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();

  /* ---- form state ---- */
  const [formState, setFormState] = React.useState("idle"); // idle | sending | sent | error
  const nameRef  = React.useRef(null);
  const emailRef = React.useRef(null);
  const descRef  = React.useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name  = nameRef.current?.value?.trim();
    const email = emailRef.current?.value?.trim();
    const description = descRef.current?.value?.trim();
    if (!name || !email) return;
    setFormState("sending");
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, description }),
      });
      setFormState(r.ok ? "sent" : "error");
    } catch {
      setFormState("error");
    }
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
    const travel    = 360 - normFrom; // always forward to land exactly at 360°
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
        applyLight(360, 100, intensity);
      }
    };
    rotateFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRotation = React.useCallback(() => {
    if (!rotateFrameRef.current) return;
    cancelAnimationFrame(rotateFrameRef.current);
    rotateFrameRef.current = null;

    const fromAngle = getLightAngle();
    const toAngle   = origAngleRef.current ?? 120;
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
      : { ...sectionWrap, paddingBottom: 96 }}>
      <div className="neu-raised" style={{
        borderRadius: 14, padding: isMobile ? "44px 24px 32px" : "80px 64px 56px",
        background: "linear-gradient(155deg, #221C14, #14110D)",
        color: "var(--paper)",
        boxShadow: "var(--sh-raised-large), inset calc(var(--lx) * 1px) calc(var(--ly) * 1px) 0 0 rgba(255,255,255,0.08)",
        position: "relative", overflow: "hidden",
        clipPath: "inset(0 round 14px)"
      }}>

        {/* Wood overlay — rotate 90° so grain runs the other direction */}
        {textures && (
          <div aria-hidden style={{
            position: "absolute", top: "50%", left: "50%",
            width: isMobile ? "280%" : "200%", height: isMobile ? "280%" : "200%", pointerEvents: "none",
            backgroundImage: "url(/premium/assets/texture-wood.webp)",
            backgroundSize: "cover", backgroundPosition: "center",
            opacity: 0.35, mixBlendMode: "overlay",
            transform: "translate(-50%, -50%) rotate(90deg)"
          }} />
        )}

        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient( 85% 70% at calc(50% + var(--lx) * 35%) calc(50% + var(--ly) * 35%),
              rgba(var(--light-warm), calc(var(--light-intensity) * 0.65)),
              transparent 75% ) `,
          mixBlendMode: "screen", opacity: 0.95,
        }} />
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(circle at 50% 40%, rgba(var(--light-warm), 0.08), transparent 80%)`,
          mixBlendMode: "screen",
        }} />

        {/* Wood shadow mask — rotate to match */}
        <div aria-hidden style={{
          position: "absolute", top: "50%", left: "50%",
          width: isMobile ? "280%" : "200%", height: isMobile ? "280%" : "200%", pointerEvents: "none",
          backgroundImage: "url(/premium/assets/texture-wood.webp)",
          backgroundSize: "cover", backgroundPosition: "center",
          mixBlendMode: "multiply", opacity: 1,
          transform: "translate(-50%, -50%) rotate(90deg)"
        }} />

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

        {/* TOP: request access + form */}
        <div ref={contentRef} style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr",
          gap: isMobile ? 32 : 80,
          alignItems: "start"
        }}>
          {/* Left: heading */}
          <div style={{ paddingTop: isMobile ? 0 : 48, ...window.revealStyle(contentInView, { delay: 0 }) }}>
            <div className="eyebrow" style={{ color: "rgba(244,239,227,0.55)", marginBottom: isMobile ? 18 : 32 }}>{t('cta.eyebrow')}</div>
            <h2 className="serif" style={{
              margin: 0, fontSize: isMobile ? "clamp(34px, 9vw, 48px)" : "clamp(48px, 5.4vw, 84px)",
              lineHeight: 0.98, letterSpacing: "-0.025em",
              color: "var(--paper)", textWrap: "balance"
            }}>
              {t('cta.h2_l1')}<br />{t('cta.h2_l2')}<br />{t('cta.h2_l3')}{" "}
              <span className="italic" style={{ color: "#D9A3B0" }}>{t('cta.h2_italic')}</span>
            </h2>
          </div>

          {/* Right: text + form — pushed down to feel lower on the page */}
          <div style={{ paddingTop: isMobile ? 0 : 56, ...window.revealStyle(contentInView, { delay: 150 }) }}>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(244,239,227,0.7)", margin: "0 0 14px", maxWidth: 420 }}>
              {t('cta.body')}
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(244,239,227,0.5)", margin: "0 0 28px", maxWidth: 420, fontFamily: "var(--mono)", letterSpacing: "0.04em" }}>
              {t('cta.note')}
            </p>

            {/* Form — focus triggers light rotation */}
            <div
              onFocus={startRotation}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) stopRotation(); }}
            >
              <div style={{
                padding: 20, borderRadius: 10,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 24px 50px -30px rgba(0,0,0,0.6)"
              }}>
                {formState === "sent" ? (
                  <div style={{ padding: "24px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
                    <p style={{ fontSize: 15, color: "var(--paper)", margin: "0 0 6px", fontFamily: "var(--sans)" }}>
                      Introduction received.
                    </p>
                    <p style={{ fontSize: 12, color: "rgba(244,239,227,0.5)", margin: 0, fontFamily: "var(--mono)", letterSpacing: "0.06em" }}>
                      {t('cta.reply_note')}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                      <GlassInput ph={t('cta.ph_name')} innerRef={nameRef} />
                      <GlassInput ph={t('cta.ph_email')} type="email" innerRef={emailRef} />
                    </div>
                    <GlassTextarea ph={t('cta.ph_describe')} innerRef={descRef} />
                    {formState === "error" && (
                      <p style={{ margin: 0, fontSize: 12, color: "#D9A3B0", fontFamily: "var(--mono)" }}>
                        Something went wrong — please try again.
                      </p>
                    )}
                    <button type="submit" className="btn-neu" disabled={formState === "sending"} style={{
                      marginTop: 6, justifyContent: "center",
                      background: "linear-gradient(145deg, #F4EFE3, #E5DECF)",
                      color: "var(--ink)", opacity: formState === "sending" ? 0.6 : 1,
                      boxShadow: "4px 4px 12px rgba(0,0,0,0.45), -2px -2px 8px rgba(255,255,255,0.05)"
                    }}>
                      {formState === "sending" ? "Sending…" : t('cta.btn_send')}
                      {formState !== "sending" && <ArrowSm />}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {formState !== "sent" && (
              <p style={{ fontSize: 11, color: "rgba(244,239,227,0.45)", margin: "14px 4px 0", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}>
                {t('cta.reply_note')}
              </p>
            )}
          </div>
        </div>

        {/* BOTTOM: footer — favicon above Studio label, map to its right, terms far right */}
        <div style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
          gap: isMobile ? 28 : 48,
          alignItems: "end",
          marginTop: isMobile ? 44 : 72,
        }}>
          {/* Col 1: favicon mark + Studio address + map */}
          <div style={{ display: "flex", gap: 28, alignItems: "flex-end" }}>
            <div>
              <FooterMark size={44} />
              <div style={{ marginTop: 16 }}>
                <div style={labelStyle}>{t('cta.studio_label')}</div>
                <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" style={monoStyle}>
                  Christiaan Huygensweg 32<br />
                  5223 BH 's-Hertogenbosch<br />
                  The Netherlands
                </a>
              </div>
            </div>
            {!isMobile && (
              <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <NetherlandsMap />
              </a>
            )}
          </div>

          {/* Col 2: Terms + Privacy — bottom-right */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignSelf: "end" }}>
            <a href="https://leadawaker.com/terms" target="_blank" rel="noopener noreferrer" style={linkStyle}>
              {t('cta.terms')}
            </a>
            <a href="https://leadawaker.com/privacy" target="_blank" rel="noopener noreferrer" style={linkStyle}>
              {t('cta.privacy')}
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}

function GlassInput({ ph, type = "text", innerRef }) {
  return (
    <input
      ref={innerRef}
      type={type}
      placeholder={ph}
      className="glass-field"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.15)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.2)",
        padding: "14px 18px", borderRadius: 6, outline: "none",
        color: "rgba(244,239,227,1)", fontFamily: "var(--sans)", fontSize: 14,
        width: "100%", boxSizing: "border-box"
      }} />
  );
}

function GlassTextarea({ ph, innerRef }) {
  return (
    <textarea
      ref={innerRef}
      placeholder={ph}
      rows={4}
      className="glass-field"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.15)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.2)",
        padding: "14px 18px", borderRadius: 6, outline: "none",
        color: "rgba(244,239,227,1)", fontFamily: "var(--sans)", fontSize: 14,
        width: "100%", boxSizing: "border-box",
        resize: "vertical", lineHeight: 1.55
      }} />
  );
}

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
