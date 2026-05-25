// Hero section

const NICHE_IMAGES = {
  kitchen:     '/premium/uploads/hero-images/kitchenfinalyes.webp',
  flooring:    '/premium/uploads/hero-images/flooring.webp',
  wellness:    '/premium/uploads/hero-images/sauna final.webp',
  landscaping: '/premium/uploads/hero-images/garden6-2.webp',
  roofing:     '/premium/uploads/hero-images/roof3.webp',
};

const NICHE_IMAGE_STYLE = {
  kitchen:     { objectFit: "contain", objectPosition: "center 80%",  transformOrigin: "center center", defaultAdj: { scale: 0.95, tx: -11, ty: -7,  rot: 0 } },
  flooring:    { objectFit: "contain", objectPosition: "center 90%",  transformOrigin: "center center", defaultAdj: { scale: 0.8,  tx: -17, ty: 4,   rot: 0 } },
  wellness:    { objectFit: "none",    objectPosition: "center",       transformOrigin: undefined,       defaultAdj: { scale: 0.5,  tx: -13, ty: 6,   rot: 0 } },
  landscaping: { objectFit: "none",    objectPosition: "center",       transformOrigin: undefined,       defaultAdj: { scale: 0.5,  tx: -16, ty: 20,  rot: 0 } },
  roofing:     { objectFit: "none",    objectPosition: "center",       transformOrigin: undefined,       defaultAdj: { scale: 0.55, tx: -9,  ty: 9,   rot: 0 } },
};

const NICHE_ADJUST_KEY = "hero_niche_adjustments";
const DEFAULT_ADJUST = { scale: 1, tx: 0, ty: 0, rot: 0 };

function loadAdjustments() {
  try { return JSON.parse(localStorage.getItem(NICHE_ADJUST_KEY)) || {}; } catch { return {}; }
}
function saveAdjustments(data) {
  localStorage.setItem(NICHE_ADJUST_KEY, JSON.stringify(data));
}
function getAdjust(adj, key) {
  return { ...DEFAULT_ADJUST, ...(NICHE_IMAGE_STYLE[key]?.defaultAdj || {}), ...(adj[key] || {}) };
}
function buildTransform({ scale, tx, ty, rot }) {
  if (scale === 1 && tx === 0 && ty === 0 && rot === 0) return undefined;
  return `rotate(${rot}deg) scale(${scale}) translateX(${tx}%) translateY(${ty}%)`;
}
function buildFreeTransform({ scale, tx, ty, rot }) {
  return `translate(-50%, -50%) rotate(${rot}deg) scale(${scale}) translateX(${tx}%) translateY(${ty}%)`;
}

function Hero({ wineIntensity, textures }) {
  const [niche, setNiche] = React.useState("kitchen");
  const [adjustments, setAdjustments] = React.useState(loadAdjustments);
  const isMobile = window.useIsMobile();

  function updateAdjust(nicheKey, field, value) {
    setAdjustments(prev => {
      const next = { ...prev, [nicheKey]: { ...getAdjust(prev, nicheKey), [field]: value } };
      saveAdjustments(next);
      return next;
    });
  }
  const isTablet = window.useIsMobile(1440);
  const { t } = window.useI18n();
  const [heroRef, heroInView] = window.useInView({ immediate: true });

  return (
    <section ref={heroRef} data-screen-label="01 Hero" style={{
      maxWidth: 1240, margin: "0 auto",
      padding: isMobile ? "32px 18px 48px" : isTablet ? "64px 32px 48px" : "140px 48px 80px",
      position: "relative",
      overflow: "visible",
      minHeight: isMobile ? undefined : "auto",
      display: isMobile ? "block" : "flex",
      alignItems: isMobile ? undefined : "flex-start"
    }}>
      <Blobs />

      {/* Niche background — sits behind everything in the section */}
      {!isMobile && (
        <div aria-hidden style={{
          position: "absolute",
          top: "-200px", bottom: "-200px",
          right: "-600px",
          left: "35%",
          zIndex: 0,
          pointerEvents: "none",
        }}>
          {Object.keys(NICHE_IMAGES).map(key => {
            const base = NICHE_IMAGE_STYLE[key];
            const adj = getAdjust(adjustments, key);
            const hasAdj = adj.scale !== 1 || adj.tx !== 0 || adj.ty !== 0;
            const isFree = base.objectFit === "none";
            return (
              <img
                key={key}
                src={NICHE_IMAGES[key]}
                alt=""
                style={isFree ? {
                  position: "absolute",
                  top: "50%", left: "50%",
                  width: "auto", height: "auto",
                  maxWidth: "none", maxHeight: "none",
                  transform: buildFreeTransform(adj),
                  opacity: key === niche ? 1 : 0,
                  transition: "opacity 700ms ease",
                  willChange: "opacity",
                } : {
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  ...base,
                  ...(hasAdj ? { transform: buildTransform(adj), transformOrigin: "center center" } : {}),
                  opacity: key === niche ? 1 : 0,
                  transition: "opacity 700ms ease",
                  willChange: "opacity",
                }}
              />
            );
          })}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1.15fr 0.85fr",
        gap: isMobile ? 36 : isTablet ? 32 : 64, alignItems: "flex-start",
        position: "relative", width: "100%", zIndex: 1,
      }}>
        <div>
          <div className="row" style={{ gap: 12, marginBottom: isMobile ? 22 : 36, ...window.revealStyle(heroInView, { delay: window.stagger(0) }) }}>
            <span className="neu-polished-crisp" style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "8px 16px 8px 12px", borderRadius: 6,
              fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)",
              letterSpacing: "0.12em", textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999, background: "var(--wine)",
                flexShrink: 0,
                boxShadow: "0 0 0 4px var(--wine-glow)"
              }} />
              {t('hero.badge')}
            </span>
          </div>

          <div style={{ background: "transparent", backdropFilter: "blur(0px)", WebkitBackdropFilter: "blur(0px)" }}>
            <h1 className="serif" style={{
              fontSize: isMobile ? "clamp(36px, 10vw, 52px)" : "clamp(48px, 5.5vw, 80px)",
              lineHeight: 1.08,
              margin: "0 0 20px", color: "var(--ink)", letterSpacing: "-0.025em",
              textWrap: "balance",
              ...window.revealStyle(heroInView, { delay: window.stagger(1) }),
            }}>
              {t('hero.h1_line1')}<br />
              {t('hero.h1_pre')}{" "}
              <span className="italic" style={{ color: "var(--wine)" }}>{t('hero.h1_italic')}</span>
            </h1>

             

            <p style={{
              fontSize: isMobile ? 15 : 17, lineHeight: 1.6, color: "var(--mute)",
              maxWidth: 480, margin: isMobile ? "0 0 28px" : "0 0 40px", fontWeight: 400,
              ...window.revealStyle(heroInView, { delay: window.stagger(3) }),
            }}>
              {t('hero.body')}
            </p>
          </div>

          <div style={{
            display: "flex", alignItems: "stretch",
            gap: isMobile ? 10 : 16, flexWrap: "wrap",
            marginBottom: isMobile ? 8 : 16,
            flexDirection: isMobile ? "column" : "row",
            ...window.revealStyle(heroInView, { delay: window.stagger(4) }),
          }}>
            <a href="#contact" className="btn-neu btn-wine" style={isMobile ? { justifyContent: "center" } : null}>
              {t('hero.cta_primary')} <ArrowSm />
            </a>
            <a href="#try" className="btn-neu" style={isMobile ? { justifyContent: "center" } : null}>
              {t('hero.cta_secondary')}
            </a>
          </div>

          <NicheImageDebug niche={niche} adjustments={adjustments} onUpdate={updateAdjust} />

        </div>

        <div style={{
          position: "relative", minWidth: 0,
          display: "flex",
          justifyContent: isMobile ? "stretch" : "center",
          ...window.revealStyle(heroInView, { delay: window.stagger(3) }),
        }}>

          <div style={{
            position: "relative", width: "100%",
            maxWidth: isMobile ? "100%" : 400,
            zIndex: 1,
          }}>
            <ConversationCard niche={niche} onSetNiche={setNiche} />
          </div>
        </div>
      </div>
    </section>);
}

function NicheImageDebug({ niche, adjustments, onUpdate }) {
  const adj = getAdjust(adjustments, niche);

  function reset() {
    ["scale","tx","ty","rot"].forEach(f => onUpdate(niche, f, DEFAULT_ADJUST[f]));
  }

  const SLIDERS = [
    { field: "scale", label: "S",   min: 0.1,  max: 3,   step: 0.05, unit: "×" },
    { field: "tx",    label: "X",   min: -200, max: 200, step: 1,    unit: "%" },
    { field: "ty",    label: "Y",   min: -200, max: 200, step: 1,    unit: "%" },
    { field: "rot",   label: "R",   min: 0,    max: 360, step: 1,    unit: "°" },
  ];

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "8px 10px", marginBottom: 24,
      maxWidth: 260, fontSize: 10, fontFamily: "var(--mono)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ color: "var(--mute)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <strong style={{ color: "var(--ink)" }}>{niche}</strong>
        </span>
        <button onClick={reset} style={{
          fontSize: 9, color: "var(--mute)", background: "none",
          border: "1px solid var(--border)", borderRadius: 3,
          padding: "1px 6px", cursor: "pointer",
        }}>reset</button>
      </div>

      {SLIDERS.map(({ field, label, min, max, step, unit }) => (
        <div key={field} style={{ display: "grid", gridTemplateColumns: "12px 1fr 28px", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <span style={{ color: "var(--mute)" }}>{label}</span>
          <input
            type="range" min={min} max={max} step={step}
            value={adj[field]}
            onChange={e => onUpdate(niche, field, parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "var(--wine)", cursor: "pointer", height: 3 }}
          />
          <span style={{ color: "var(--ink)", textAlign: "right" }}>{adj[field]}{unit}</span>
        </div>
      ))}
    </div>
  );
}

function Blobs() {
  return (
    <div aria-hidden style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
      opacity: 0.55
    }}>
      <div style={{
        position: "absolute", bottom: -40, right: 240, width: 280, height: 280,
        borderRadius: "50%", background: "radial-gradient(circle, rgba(245,225,190,0.5), transparent 70%)"
      }} />
    </div>);
}

function StatChip({ n, label }) {
  return (
    <div className="neu-polished" style={{
      padding: "20px 22px", fontWeight: "500", borderRadius: "8px"
    }}>
      <div className="serif" style={{ fontSize: 38, lineHeight: 1, color: "var(--ink)" }}>{n}</div>
      <div style={{
        fontSize: 11, lineHeight: 1.45, color: "var(--mute)", marginTop: 10,
        fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.08em"
      }}>{label}</div>
    </div>);
}
