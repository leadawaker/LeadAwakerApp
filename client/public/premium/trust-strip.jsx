// Shared section layout constants + TrustStrip section

const sectionWrap = {
  maxWidth: 1240, margin: "0 auto", padding: "144px 48px"
};
const sectionWrapMobile = {
  maxWidth: 1240, margin: "0 auto", padding: "84px 18px"
};
function getSectionWrap(isMobile) { return isMobile ? sectionWrapMobile : sectionWrap; }

/* ------------------------------ TRUST STRIP ------------------------------ */
function TrustStrip() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const sectors = ["KITCHENS", "BATHROOMS", "EXTENSIONS", "LANDSCAPE", "INTERIORS", "RENOVATION"];

  return (
    <section style={{ maxWidth: 1240, margin: "0 auto", padding: isMobile ? "20px 18px" : "32px 48px" }}>
      <div className="neu-inset" style={{
        borderRadius: 10, padding: isMobile ? "16px 18px" : "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: isMobile ? 14 : 24, flexWrap: "wrap",
        flexDirection: isMobile ? "column" : "row"
      }}>
        <div className="eyebrow">{t('trust.tagline')}</div>
        <div style={{
          display: "flex", gap: isMobile ? 16 : 36, flexWrap: "wrap",
          alignItems: "center", justifyContent: isMobile ? "center" : "flex-start"
        }}>
          {sectors.map((s) =>
          <span key={s} style={{
            fontFamily: "var(--sans)", fontSize: isMobile ? 10 : 11, fontWeight: 600,
            letterSpacing: "0.18em", color: "var(--ink)", opacity: 0.72
          }}>{s}</span>
          )}
        </div>
      </div>
    </section>);
}
