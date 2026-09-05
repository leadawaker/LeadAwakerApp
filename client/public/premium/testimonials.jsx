// Testimonials section — partner quotes ported back from the retired
// /legacy build (client/src/legacy/locales/*/home.ts "testimonial" key),
// which had the copy but no longer rendered it anywhere.

function StarIcon({ size = 22, color = "#FEB800" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M12 2.6l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L12 21.5 6.2 20.6l1.1-6.5L2.6 9.5l6.5-1z" />
    </svg>
  );
}

function TestimonialCard({ avatar, quote, name, role, delay, inView }) {
  return (
    <div
      className="neu-polished-crisp"
      style={{
        borderRadius: 14, padding: "32px 28px",
        display: "flex", flexDirection: "column", gap: 18,
        background: "radial-gradient(ellipse 80% 50% at 50% 100%, var(--glow-warm), transparent 60%), radial-gradient(ellipse 50% 35% at 50% 105%, rgba(255,255,255,0.22), transparent 70%), #FFFFFF",
        ...window.revealStyle(inView, { delay }),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <img
          src={avatar}
          alt={name}
          style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" }}
        />
        <div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{name}</div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--mute)" }}>{role}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} />)}
      </div>

      <p style={{ fontFamily: "var(--sans)", fontSize: 15.5, lineHeight: 1.65, color: "var(--ink-soft)", margin: 0, flex: 1 }}>
        {quote}
      </p>
    </div>
  );
}

function Testimonials() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const items = t('testimonials.items');
  const [sectionRef, sectionInView] = window.useInView();

  return (
    <section ref={sectionRef} id="testimonials" data-screen-label="06 Testimonials" style={isMobile ? sectionWrapMobile : sectionWrap}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: isMobile ? 28 : 48 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div className="eyebrow" style={window.revealStyle(sectionInView, { delay: 0 })}>{t('testimonials.eyebrow')}</div>
          <h2
            className="serif"
            style={{
              margin: 0, textAlign: "center",
              fontSize: isMobile ? "clamp(30px, 8vw, 40px)" : "clamp(36px, 3.4vw, 52px)",
              lineHeight: 1.02, letterSpacing: "-0.02em",
              ...window.revealStyle(sectionInView, { delay: 60 }),
            }}
          >
            <span className="italic">{t('testimonials.heading')}</span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, width: "100%" }}>
          {items.map((it, i) => (
            <TestimonialCard
              key={i}
              avatar={it.avatar}
              quote={it.quote}
              name={it.name}
              role={it.role}
              delay={window.stagger(i, 80)}
              inView={sectionInView}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
