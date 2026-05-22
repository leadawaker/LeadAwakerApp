// Hero section

function Hero({ wineIntensity, textures }) {
  const [niche, setNiche] = React.useState("kitchen");
  const isMobile = window.useIsMobile();
  const isTablet = window.useIsMobile(1440);
  const { t } = window.useI18n();
  const [heroRef, heroInView] = window.useInView({ immediate: true });

  return (
    <section ref={heroRef} data-screen-label="01 Hero" style={{
      maxWidth: 1240, margin: "0 auto",
      padding: isMobile ? "32px 18px 48px" : isTablet ? "64px 32px 48px" : "140px 48px 80px",
      position: "relative",
      minHeight: isMobile ? undefined : "auto",
      display: isMobile ? "block" : "flex",
      alignItems: isMobile ? undefined : "flex-start"
    }}>
      <Blobs />
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1.15fr 0.85fr",
        gap: isMobile ? 36 : isTablet ? 32 : 64, alignItems: "flex-start",
        position: "relative", width: "100%"
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

          <div className="invisible-plate">
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

            <p className="serif italic" style={{
              fontSize: isMobile ? "20px" : "clamp(22px, 2.4vw, 32px)",
              lineHeight: 1.25,
              color: "var(--mute)", maxWidth: 520, margin: "0 0 24px",
              letterSpacing: "-0.015em",
              ...window.revealStyle(heroInView, { delay: window.stagger(2) }),
            }}>
              {t('hero.sub')}
            </p>

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
            marginBottom: isMobile ? 8 : 48,
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

        </div>

        <div style={{
          position: "relative", minWidth: 0,
          display: "flex",
          justifyContent: isMobile ? "stretch" : "flex-end",
          ...window.revealStyle(heroInView, { delay: window.stagger(3) }),
        }}>
          <div style={{
            position: "relative", width: "100%",
            maxWidth: isMobile ? "100%" : 440
          }}>
            <ConversationCard niche={niche} onSetNiche={setNiche} />
          </div>
        </div>
      </div>
    </section>);
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
