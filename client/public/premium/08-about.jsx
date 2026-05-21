// About section

function About() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const people = t('about.people');
  const [sectionRef, sectionInView] = window.useInView();

  const photoPeople = [
    { photo: "/images/Project%20(20260521052903).jpg", photoZoom: 1.87, photoFocus: "45% 10%", photoRotate: 5 },
    { photo: "/images/file_00000000a29871f4b7f12305e811031e.png", photoZoom: 1.65, photoFocus: "50% 20%" },
  ];

  const sz = isMobile ? 88 : 108;

  return (
    <section ref={sectionRef} id="about" data-screen-label="04 About" style={isMobile ? sectionWrapMobile : sectionWrap}>
      <div className="glass" style={{
        borderRadius: 14, padding: isMobile ? "28px 18px 28px" : "64px 64px 56px"
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 3fr",
          gap: isMobile ? 24 : 46, alignItems: "start"
        }}>

          {/* Left: heading */}
          <div>
            <div className="eyebrow" style={{ marginBottom: isMobile ? 16 : 24 }}>{t('about.eyebrow')}</div>
            <h2 className="serif" style={{ margin: 0, fontSize: isMobile ? "clamp(28px, 7.5vw, 40px)" : "clamp(36px, 3.4vw, 52px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              <span style={{ fontFamily: '"Bodoni Moda", "Bodoni 72", Georgia, serif', display: "block" }}>Design</span>
              {t('about.h2_meets')}{" "}<span className="italic" style={{ color: "var(--wine)" }}>{t('about.h2_italic')}</span>
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 15.5, lineHeight: 1.65, color: "var(--mute)", margin: isMobile ? "16px 0 0" : "24px 0 0", maxWidth: 360 }}>
              {t('about.body')}
            </p>
          </div>

          {/* Right: person cards */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 20 : 24, alignItems: "start" }}>
            {people.map((p, idx) => {
              const ph = photoPeople[idx] || {};
              return (
                <div key={p.name} style={{
                  borderRadius: 14,
                  padding: isMobile ? "22px 18px 24px" : "26px 24px 28px",
                  background: "rgba(255,255,255,0.04)",
                  display: "flex", flexDirection: "column",
                  ...window.revealStyle(sectionInView, { delay: window.stagger(idx, 100) }),
                }}>

                  {/* Photo left + name/roles right */}
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: isMobile ? 14 : 18, marginBottom: isMobile ? 16 : 20 }}>

                    {/* Circle — neu-polished responds to directional light tokens */}
                    <div className="neu-polished-large" style={{
                      width: sz + 6, height: sz + 6, flexShrink: 0,
                      borderRadius: "50%", padding: 3,
                    }}>
                      <div style={{
                        width: sz, height: sz, borderRadius: "50%", overflow: "hidden",
                        backgroundImage: `url('${ph.photo}')`,
                        backgroundSize: `${(ph.photoZoom || 1) * 100}%`,
                        backgroundPosition: ph.photoFocus || "50% 50%",
                        backgroundRepeat: "no-repeat",
                        backgroundColor: "var(--bg-2)",
                        ...(ph.photoRotate ? { transform: `rotate(${ph.photoRotate}deg)` } : {}),
                      }} />
                    </div>

                    {/* Name + roles stacked */}
                    <div>
                      <div className="serif" style={{
                        fontStyle: idx === 1 ? "italic" : "normal",
                        color: idx === 1 ? "var(--wine-soft, #7A2E3E)" : "var(--fg)",
                        fontSize: isMobile ? 20 : 23, lineHeight: 1.15,
                        marginBottom: 8,
                      }}>{p.name}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {(p.roles || []).map((r, i) => (
                          <div key={i} style={{
                            fontFamily: "var(--mono)", fontSize: isMobile ? 9 : 10,
                            color: "var(--mute)",
                            letterSpacing: "0.12em", textTransform: "uppercase",
                          }}>{r}</div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Bio */}
                  <p style={{
                    margin: 0, fontSize: isMobile ? 13.5 : 14.5,
                    lineHeight: 1.75, color: "var(--mute)", textAlign: "justify",
                  }}>{p.bio}</p>

                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>);
}
