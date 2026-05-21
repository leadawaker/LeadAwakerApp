// Navigation bar

function Nav({ logoVariant }) {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [navRef, navInView] = window.useInView({ immediate: true });

  const isLoggedIn = React.useMemo(() => {
    try { return Boolean(localStorage.getItem('leadawaker_auth')); } catch (_) { return false; }
  }, []);
  const appHref = React.useMemo(() => {
    try {
      const role = localStorage.getItem('leadawaker_user_role') || '';
      return (role === 'Admin' || role === 'Operator') ? '/agency/campaigns' : '/subaccount/campaigns';
    } catch (_) { return '/subaccount/campaigns'; }
  }, []);

  const NAV_ITEMS = [
    { label: t('nav.home'),    href: "/" },
    { label: t('nav.try'),     href: "/#try" },
    { label: t('nav.about'),   href: "#about" },
    { label: t('nav.contact'), href: "#contact" },
    { label: isLoggedIn ? t('nav.open_app') : t('nav.login'), href: isLoggedIn ? appHref : "/login" },
  ];

  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (!e.target.closest('[data-nav-root]')) setMenuOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuOpen]);

  const handleLogoClick = (e) => {
    const isHome = window.location.pathname === '/' || window.location.pathname === '/index.html';
    if (isHome) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div ref={navRef} style={{ position: "sticky", top: 0, zIndex: 30, opacity: navInView ? 1 : 0, transition: navInView ? 'opacity 400ms ease-out' : 'none' }}>
      <nav style={{ maxWidth: 1240, margin: "0 auto", padding: isMobile ? "6px 12px" : "8px 32px" }}>
        <div data-nav-root style={{
          padding: isMobile ? "8px 10px 8px 14px" : "10px 14px 10px 20px",
          borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: isMobile ? 8 : 16,
          background: "rgba(218,213,199,0.72)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
          border: "1px solid rgba(255,250,238,0.8)",
          transform: "translateZ(0)",
          willChange: "backdrop-filter",
          position: "relative"
        }}>

          <a href="/" onClick={handleLogoClick} aria-label="Lead Awaker" style={{ display: "inline-flex", alignItems: "center" }}>
            <img
              src="/premium/logo-v2.svg"
              alt="Lead Awaker"
              style={{ height: isMobile ? 30 : 38, width: "auto", display: "block" }} />
          </a>

          {isMobile ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <LangSwitcher isMobile={true} />
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                style={{
                  background: menuOpen ? "rgba(255,255,255,0.3)" : "transparent",
                  border: "none", cursor: "pointer",
                  padding: "8px", borderRadius: 6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--ink)", transition: "background 180ms"
                }}
              >
                {menuOpen ? (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.label} href={item.href} isMobile={false}>{item.label}</NavLink>
              ))}
              <LangSwitcher isMobile={false} />
            </div>
          )}

          {isMobile && menuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
              background: "rgba(224,218,205,0.97)",
              backdropFilter: "blur(16px) saturate(160%)",
              WebkitBackdropFilter: "blur(16px) saturate(160%)",
              border: "1px solid rgba(255,250,238,0.9)",
              borderRadius: 10,
              padding: "6px",
              zIndex: 100,
              display: "flex", flexDirection: "column", gap: 2,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)"
            }}>
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: "13px 16px", borderRadius: 7,
                    fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500,
                    color: "var(--ink)", letterSpacing: "0.01em",
                    textDecoration: "none", display: "block",
                    transition: "background 150ms"
                  }}
                  onTouchStart={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.5)"}
                  onTouchEnd={(e) => e.currentTarget.style.background = "transparent"}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.5)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  {item.label}
                </a>
              ))}
            </div>
          )}

        </div>
      </nav>
    </div>);
}

function NavLink({ children, href, isMobile }) {
  return (
    <a href={href} style={{
      padding: isMobile ? "8px 9px" : "10px 14px", borderRadius: 6,
      fontFamily: "var(--sans)", fontSize: isMobile ? 12 : 13, fontWeight: 500,
      color: "var(--ink-soft, #322B22)", letterSpacing: "0.01em",
      transition: "background 180ms", textDecoration: "none"
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.4)"}
    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      {children}</a>);
}

function LangSwitcher({ isMobile }) {
  const { lang, setLang } = window.useI18n();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 2,
      marginLeft: isMobile ? 2 : 8,
      paddingLeft: isMobile ? 4 : 10,
      borderLeft: isMobile ? "none" : "1px solid rgba(110,95,65,0.18)",
    }}>
      {['en', 'nl'].map((l) => {
        const active = lang === l;
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            style={{
              border: "none", cursor: "pointer", background: "transparent",
              fontFamily: "var(--mono)", fontSize: isMobile ? 10 : 11,
              letterSpacing: "0.1em", textTransform: "uppercase",
              padding: isMobile ? "6px 7px" : "8px 10px",
              fontWeight: active ? 700 : 400,
              color: active ? "var(--ink)" : "var(--mute)",
            }}
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

const ArrowSm = window.ArrowSm;
