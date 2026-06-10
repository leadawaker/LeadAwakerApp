// About section

function About() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const people = t('about.people');
  const [sectionRef, sectionInView] = window.useInView();

  const BG_TEXTURE = "/premium/assets/bg-studio.webp";
  const BODONI = '"Bodoni Moda", "Bodoni 72", Georgia, serif';
  const PLAYFAIR = '"Instrument Serif", Georgia, serif';
  const ACCENT = "#9c2b3c";

  const photoPeople = [
    {
      photo: "/premium/assets/gabriel-fronza.webp",
      headOverflow: "-32%",
      personLeft: "0%",
      personWidth: "100%",
      personBgSize: "150%",
      personBgPos: "top center",
      personBottom: "0%",
    },
    {
      photo: "/premium/assets/finn-zijlstra.webp",
      headOverflow: "-36%",
      personLeft: "0%",
      personWidth: "100%",
      personBgSize: "132%",
      personBgPos: "top center",
      personBottom: "0%",
    },
  ];

  const cardRadius = isMobile ? 14 : 18;

  const AccentBar = () => (
    <div style={{ width: 32, height: 2, background: ACCENT, borderRadius: 2 }} />
  );

  return (
    <section ref={sectionRef} id="about" data-screen-label="04 About" style={isMobile ? sectionWrapMobile : sectionWrap}>
      <div className="glass" style={{
        borderRadius: 14, padding: isMobile ? "28px 18px 28px" : "64px 64px 56px"
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 3fr",
          gap: isMobile ? 24 : 56, alignItems: "start"
        }}>

          {/* Left: heading — paddingTop aligns "About" eyebrow with the top of the photo squares */}
          <div style={{ paddingTop: isMobile ? 0 : 20 }}>
            <div className="eyebrow" style={{ marginBottom: isMobile ? 10 : 14 }}>{t('about.eyebrow')}</div>
            <div style={{ marginBottom: isMobile ? 14 : 20 }}><AccentBar /></div>
            <h2 className="serif" style={{ margin: 0, fontSize: isMobile ? "clamp(40px, 10vw, 58px)" : "clamp(54px, 5.2vw, 78px)", lineHeight: 1.0 }}>
              <span style={{ display: "block" }}>{t('about.h2_meets')}</span>
              <span style={{ color: "var(--wine)", display: "block", fontStyle: "italic" }}>{t('about.h2_italic')}<span style={{ fontStyle: "normal" }}>.</span></span>
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 15.5, lineHeight: 1.65, color: "var(--mute)", margin: isMobile ? "16px 0 0" : "24px 0 0", maxWidth: 360 }}>
              {t('about.body')}
            </p>
          </div>

          {/* Right: two person cards with a centered vertical divider */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: isMobile ? 20 : 0,
            position: "relative",
            columnGap: isMobile ? undefined : 32,
          }}>
            {/* Vertical divider — pinned at exactly 50% of the container */}
            {!isMobile && (
              <div style={{
                position: "absolute",
                left: "50%",
                top: 20,
                bottom: 0,
                width: 1,
                transform: "translateX(-50%)",
                background: "var(--line)",
                pointerEvents: "none",
              }} />
            )}

            {people.map((p, idx) => {
              const ph = photoPeople[idx] || {};
              return (
                <div key={p.name} style={{
                  borderRadius: cardRadius,
                  background: "rgba(255,255,255,0.04)",
                  display: "flex", flexDirection: "column",
                  overflow: "visible",
                  ...window.revealStyle(sectionInView, { delay: window.stagger(idx, 100) }),
                }}>

                  {/* Photo composite */}
                  <div style={{
                    position: "relative",
                    width: "88%",
                    marginLeft: "auto",
                    marginRight: "auto",
                    paddingBottom: "80%",
                    overflow: "visible",
                    marginTop: isMobile ? 16 : 20,
                  }}>
                    <div style={{ position: "absolute", inset: 0 }}>

                      {/* Studio backdrop */}
                      <div style={{
                        position: "absolute", inset: 0,
                        borderRadius: cardRadius,
                        overflow: "hidden",
                      }}>
                        <div style={{
                          width: "100%", height: "100%",
                          backgroundImage: `url('${BG_TEXTURE}')`,
                          backgroundSize: "cover",
                          backgroundPosition: "50% 35%",
                        }} />
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0, height: 72,
                          background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.22))",
                          pointerEvents: "none",
                        }} />
                      </div>

                      {/* Person photo */}
                      <div style={{
                        position: "absolute",
                        top: ph.headOverflow || "-20%",
                        bottom: ph.personBottom || 0,
                        left: ph.personLeft || "0%",
                        width: ph.personWidth || "100%",
                        backgroundImage: `url('${ph.photo}')`,
                        backgroundSize: ph.personBgSize || "cover",
                        backgroundPosition: ph.personBgPos || "top center",
                        backgroundRepeat: "no-repeat",
                        clipPath: `inset(0 0 0 0 round 0 0 ${cardRadius}px ${cardRadius}px)`,
                      }} />

                    </div>
                  </div>

                  {/* Name + role + bio */}
                  <div style={{ padding: isMobile ? "22px 16px 26px" : "24px 20px 28px" }}>

                    {/* Name — Instrument Serif via .serif token */}
                    <div className="serif" style={{
                      fontSize: isMobile ? 32 : 40,
                      color: "var(--fg)",
                      lineHeight: 1.1,
                      marginBottom: 10,
                    }}>
                      {p.name}<span style={{ color: ACCENT }}>.</span>
                    </div>

                    {/* Accent bar — between name and role */}
                    <div style={{ marginBottom: isMobile ? 10 : 12 }}>
                      <AccentBar />
                    </div>

                    {/* Role — icon + bright wine, bold mono */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      marginBottom: isMobile ? 14 : 18,
                    }}>
                      {idx === 0 ? (
                        /* Cube icon for Gabriel */
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                          <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" stroke={ACCENT} strokeWidth="1.1" strokeLinejoin="round" fill="none" />
                          <polyline points="8,1 8,8" stroke={ACCENT} strokeWidth="1.1" strokeLinecap="round" />
                          <polyline points="2,4.5 8,8 14,4.5" stroke={ACCENT} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                          <line x1="8" y1="8" x2="8" y2="15" stroke={ACCENT} strokeWidth="1.1" strokeLinecap="round" />
                        </svg>
                      ) : (
                        /* Round target — circle with ticks outside the ring */
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                          <circle cx="8" cy="8" r="4.5" stroke={ACCENT} strokeWidth="1.1" />
                          <circle cx="8" cy="8" r="1.6" fill={ACCENT} />
                          <line x1="8" y1="0.5" x2="8" y2="2.8" stroke={ACCENT} strokeWidth="1.1" strokeLinecap="round" />
                          <line x1="8" y1="13.2" x2="8" y2="15.5" stroke={ACCENT} strokeWidth="1.1" strokeLinecap="round" />
                          <line x1="0.5" y1="8" x2="2.8" y2="8" stroke={ACCENT} strokeWidth="1.1" strokeLinecap="round" />
                          <line x1="13.2" y1="8" x2="15.5" y2="8" stroke={ACCENT} strokeWidth="1.1" strokeLinecap="round" />
                        </svg>
                      )}
                      <div style={{
                        fontFamily: "var(--mono)",
                        fontSize: isMobile ? 9.5 : 10.5,
                        color: ACCENT,
                        fontWeight: 700,
                        letterSpacing: "0.13em",
                        textTransform: "uppercase",
                        lineHeight: 1,
                      }}>
                        <div style={{ marginBottom: 2 }}>{p.role.split(' · ')[0]}</div>
                        <div style={{ opacity: 0.75, fontWeight: 500 }}>{p.role.split(' · ')[1]}</div>
                      </div>
                    </div>

                    {/* Hairline between role and bio — matches text container width */}
                    <div style={{
                      height: 1,
                      background: "var(--line)",
                      marginBottom: isMobile ? 16 : 20,
                    }} />

                    {/* Bio paragraphs */}
                    {(p.bio || []).map((para, i) => (
                      <p key={i} style={{
                        margin: i < p.bio.length - 1 ? "0 0 12px" : "0",
                        fontSize: isMobile ? 12 : 13,
                        lineHeight: 1.85,
                        color: "var(--mute)",
                      }}>{para}</p>
                    ))}

                  </div>

                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>);
}
