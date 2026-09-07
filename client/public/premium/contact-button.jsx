// Floating WhatsApp contact button.
//
// Placeholder for the self-built AI widget. /solar runs the LeadConnector
// chat widget (loaded from index.html), so this button renders everywhere
// else instead — two chat affordances stacked in the same corner would
// overlap. When the own widget lands, this is the component it replaces.

const WA_NUMBER = "31684446349"; // Gabriel's Dutch mobile, +31 6 84446349
// One source of truth: 10-cta-footer.jsx's PartnersCTA links to the same
// number, and reads it from here rather than repeating the digits.
window.WA_NUMBER = WA_NUMBER;

function ContactButton() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const [hovered, setHovered] = React.useState(false);

  // /solar already has the LeadConnector widget in this corner.
  if (window.SITE_VARIANT === 'solar') return null;

  const href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(t('contact.wa_prefill'))}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('contact.wa_label')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        right: isMobile ? 16 : 28,
        bottom: isMobile ? 16 : 28,
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: isMobile ? "13px 15px" : "13px 20px",
        borderRadius: 999,
        background: "linear-gradient(145deg, var(--wine-soft), var(--wine))",
        color: "var(--paper)",
        textDecoration: "none",
        fontFamily: "var(--sans)",
        fontSize: 14,
        fontWeight: 600,
        boxShadow: hovered
          ? "0 6px 22px -4px rgba(94,34,48,0.45), 0 2px 6px rgba(20,15,10,0.2)"
          : "0 4px 16px -4px rgba(94,34,48,0.35), 0 1px 4px rgba(20,15,10,0.16)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition: "transform 180ms ease, box-shadow 180ms ease",
      }}
    >
      <WhatsAppGlyph />
      {/* The label is what makes this read as "reach a person" rather than a
          bot bubble. Dropped on mobile, where it would crowd the viewport. */}
      {!isMobile && <span>{t('contact.wa_label')}</span>}
    </a>
  );
}

function WhatsAppGlyph({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.17 8.17 0 0 1-1.26-4.4c0-4.54 3.7-8.23 8.23-8.23 2.2 0 4.26.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.23 8.24Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.71-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.24-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.26 1.04.41 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}
