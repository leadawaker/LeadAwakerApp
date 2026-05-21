// FAQ section

function FAQRow({ q, a, initial }) {
  const [open, setOpen] = React.useState(initial);
  return (
    <div className={open ? "neu-inset" : "neu-raised"} style={{ borderRadius: 10, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, padding: "20px 24px", background: "none", border: "none", cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35 }}>{q}</span>
        <span style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: 999,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: open ? "var(--wine)" : "transparent",
          border: `1.5px solid ${open ? "var(--wine)" : "var(--line)"}`,
          color: open ? "#fff" : "var(--mute)",
          transition: "all 200ms ease",
          fontSize: 14, lineHeight: 1,
        }}>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 24px 20px", fontSize: 14.5, lineHeight: 1.65, color: "var(--mute)" }}>
          {a}
        </div>
      )}
    </div>
  );
}

function FAQ() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const items = t('faq.items');
  const [sectionRef, sectionInView] = window.useInView();

  return (
    <section ref={sectionRef} id="enquiries" data-screen-label="05 Enquiries" style={isMobile ? sectionWrapMobile : sectionWrap}>
      <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: isMobile ? 28 : 48 }}>
        <h2 className="serif" style={{ margin: 0, textAlign: "center", fontSize: isMobile ? "clamp(30px, 8vw, 40px)" : "clamp(36px, 3.4vw, 52px)", lineHeight: 1.02, letterSpacing: "-0.02em", ...window.revealStyle(sectionInView, { delay: 0 }) }}>
          <span className="italic">{t('faq.heading')}</span>
        </h2>
        <div style={{ display: "grid", gap: 14, width: "100%" }}>
          {items.map((it, i) => (
            <div key={i} style={window.revealStyle(sectionInView, { delay: window.stagger(i, 50) })}>
              <FAQRow q={it.q} a={it.a} initial={i === 0} />
            </div>
          ))}
        </div>
      </div>
    </section>);
}
