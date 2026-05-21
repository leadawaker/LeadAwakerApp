// Main app component that orchestrates all sections

/* --------------------------------- APP ----------------------------------- */
function App() {
  const I18nProvider = window.I18nProvider;
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const isMobile = window.useIsMobile();

  React.useEffect(() => { applyPalette(t.palette); }, [t.palette]);
  React.useEffect(() => { applyDepth(t.depthScale); }, [t.depthScale]);
  React.useEffect(() => { applyFonts(t.displayFont); }, [t.displayFont]);

  /* Static mode: 5s startup on mount, then slider drives it */
  React.useEffect(() => {
    if (t.scrollLight) return;
    const cancel = window.setLightAngle(TWEAK_DEFAULTS.lightAngle, 5000);
    window.__cancelGlobalLight = cancel;
    return () => { cancel(); window.__cancelGlobalLight = null; };
  }, []);

  React.useEffect(() => {
    if (t.scrollLight) return;
    applyLight(t.lightAngle, TWEAK_DEFAULTS.lightDistance, TWEAK_DEFAULTS.lightIntensity);
  }, [t.lightAngle]);

  /* Scroll-driven mode: immediately syncs to scroll position, no competing animation */
  React.useEffect(() => {
    if (!t.scrollLight) return;

    const dist = TWEAK_DEFAULTS.lightDistance;
    const intensity = TWEAK_DEFAULTS.lightIntensity;
    let keyframes = [];

    const buildKeyframes = () => {
      const sy = window.scrollY;
      const kf = [{ y: 0, angle: 120 }];
      const approachEl = document.getElementById('approach');
      if (approachEl) {
        const rect = approachEl.getBoundingClientRect();
        const travel = approachEl.offsetHeight - window.innerHeight;
        kf.push({ y: rect.top + sy + 0.18 * travel, angle: 80 });
      }
      const auditEl = document.getElementById('audit');
      if (auditEl) kf.push({ y: auditEl.getBoundingClientRect().top + sy, angle: 0 });
      const faqEl = document.getElementById('enquiries');
      if (faqEl) kf.push({ y: faqEl.getBoundingClientRect().top + sy, angle: 90 });
      keyframes = kf.sort((a, b) => a.y - b.y);
    };

    const getScrollAngle = (sy) => {
      if (!keyframes.length) return 120;
      if (sy <= keyframes[0].y) return keyframes[0].angle;
      const last = keyframes[keyframes.length - 1];
      if (sy >= last.y) return last.angle;
      for (let i = 0; i < keyframes.length - 1; i++) {
        const a = keyframes[i], b = keyframes[i + 1];
        if (sy >= a.y && sy < b.y) {
          const p = (sy - a.y) / (b.y - a.y);
          return a.angle + (b.angle - a.angle) * p;
        }
      }
      return 120;
    };

    let pendingScrollY = null;
    let rafId = null;
    const onScroll = () => {
      pendingScrollY = window.scrollY;
      if (!rafId) rafId = requestAnimationFrame(() => {
        applyLight(getScrollAngle(pendingScrollY), dist, intensity);
        rafId = null;
      });
    };

    const onResize = () => { keyframes = []; buildKeyframes(); };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    setTimeout(() => {
      buildKeyframes();
      applyLight(getScrollAngle(window.scrollY), dist, intensity);
    }, 200);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [t.scrollLight]);

  const { TweaksPanel, TweakSection, TweakSlider, TweakToggle, TweakSelect } = window;

  const TITLE_FONT_OPTIONS = [
    { value: "Instrument Serif",   label: "Instrument Serif" },
    { value: "Cormorant Garamond", label: "Cormorant Garamond" },
    { value: "Bodoni Moda",        label: "Bodoni Moda" },
    { value: "Playfair Display",   label: "Playfair Display" },
    { value: "EB Garamond",        label: "EB Garamond" },
    { value: "Newsreader",         label: "Newsreader" },
    { value: "Lora",               label: "Lora" },
    { value: "Yeseva One",         label: "Yeseva One" },
    { value: "Geist Mono",         label: "Geist Mono" },
    { value: "Manrope",            label: "Manrope (sans)" },
  ];

  return (
    <I18nProvider>
      <Nav logoVariant={t.logoVariant} />
      <Hero wineIntensity={t.wineIntensity} textures={t.textures} />
      <Approach />
      <Process textures={t.textures} />
      <Pipeline />
      <Audit />
      <Demo />
      <About />
      <FAQ />
      <CTA textures={t.textures} />

      {/* Floating tweaks toggle button — hidden on mobile (design-time only) */}
      {!isMobile && <button
        onClick={() => window.postMessage({ type: '__activate_edit_mode' }, '*')}
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          width: 40,
          height: 40,
          borderRadius: 10,
          border: 'none',
          background: 'rgba(94, 34, 48, 0.9)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transition: 'all 150ms ease',
          backdropFilter: 'blur(8px)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(94, 34, 48, 1)';
          e.currentTarget.style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(94, 34, 48, 0.9)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Open tweaks panel"
        aria-label="Open tweaks panel"
      >
        ⚙️
      </button>}

      {!isMobile && <TweaksPanel title="Tweaks">
        <TweakSection label="Light">
          <TweakSlider
            label="Angle"
            value={t.lightAngle}
            min={0} max={360} step={5}
            onChange={(v) => setTweak("lightAngle", v)}
            unit="°" />
          <TweakToggle
            label="Scroll light"
            value={t.scrollLight}
            onChange={(v) => setTweak("scrollLight", v)} />
        </TweakSection>
        <TweakSection label="Typography">
          <TweakSelect
            label="Title font"
            value={t.displayFont}
            options={TITLE_FONT_OPTIONS}
            onChange={(v) => setTweak("displayFont", v)} />
        </TweakSection>
      </TweaksPanel>}
    </I18nProvider>);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
