// Demo form + mock WhatsApp chat

function Demo() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const [firstName, setFirstName] = React.useState("");
  const [niche, setNiche] = React.useState("");
  const [sectionRef, sectionInView] = window.useInView();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Typing animation for eyebrow
  const FULL_TEXT = t('demo.eyebrow_text');
  const [typed, setTyped] = React.useState("");
  const [cursorOn, setCursorOn] = React.useState(true);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    let idx = 0;
    const delay = setTimeout(() => {
      const iv = setInterval(() => {
        idx++;
        setTyped(FULL_TEXT.slice(0, idx));
        if (idx >= FULL_TEXT.length) {
          clearInterval(iv);
          setDone(true);
        }
      }, 75);
      return () => clearInterval(iv);
    }, 600);
    return () => clearTimeout(delay);
  }, []);

  React.useEffect(() => {
    if (done) {
      let count = 0;
      const blink = setInterval(() => {
        setCursorOn((v) => !v);
        if (++count > 6) { clearInterval(blink); setCursorOn(false); }
      }, 400);
      return () => clearInterval(blink);
    } else {
      const blink = setInterval(() => setCursorOn((v) => !v), 530);
      return () => clearInterval(blink);
    }
  }, [done]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || niche.trim().length < 3) {
      setError(t('demo.err_fill'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/demo/create-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), niche: niche.trim(), language: "nl" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message || t('demo.err_generic'));
        setLoading(false);
        return;
      }
      const data = await res.json();
      window.location.href = data.whatsappUrl;
    } catch {
      setError(t('demo.err_network'));
      setLoading(false);
    }
  }

  return (
    <section ref={sectionRef} id="try" data-screen-label="05 Demo" style={{ maxWidth: 1240, margin: "0 auto", padding: isMobile ? "84px 18px" : "144px 48px" }}>
      <style>{`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        .typing-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--mute); margin: 0 2px; animation: dot-bounce 1.3s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.18s; }
        .typing-dot:nth-child(3) { animation-delay: 0.36s; }
        .demo-input { width: 100%; border: none; outline: none; padding: 14px 18px; border-radius: 8px; color: var(--ink); font-family: var(--sans); font-size: 15px; background: transparent; }
        .demo-input::placeholder { color: var(--mute-2); }
      `}</style>

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: isMobile ? 32 : 64,
        alignItems: "center"
      }}>

        {/* Left: form */}
        <div style={window.revealStyle(sectionInView, { delay: 0 })}>
          {/* Eyebrow typing animation */}
          <div style={{ marginBottom: 12 }}>
            <span style={{
              fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
              letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--wine)"
            }}>
              {typed}
              <span style={{ opacity: cursorOn ? 1 : 0, transition: "opacity 0.05s", fontWeight: 300 }}>|</span>
            </span>
          </div>

          <h2 className="serif" style={{
            margin: "0 0 16px", fontSize: isMobile ? "clamp(30px, 8vw, 40px)" : "clamp(36px, 3.5vw, 52px)",
            lineHeight: 1.05, letterSpacing: "-0.02em"
          }}>
            {t('demo.h2')}<br />
            <span className="italic" style={{ color: "var(--wine)" }}>{t('demo.h2_italic')}</span>
          </h2>

          <p style={{ fontSize: 17, color: "var(--mute)", lineHeight: 1.6, marginBottom: 36, maxWidth: 420 }}>
            {t('demo.body')}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="neu-inset-crisp" style={{ borderRadius: 10 }}>
              <input
                type="text"
                className="demo-input"
                placeholder={t('demo.ph_name')}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="neu-inset-crisp" style={{ borderRadius: 10 }}>
              <input
                type="text"
                className="demo-input"
                placeholder={t('demo.ph_trade')}
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                maxLength={200}
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: "var(--wine)", padding: "2px 4px" }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-neu btn-wine"
              style={{
                marginTop: 4, padding: "14px 28px", borderRadius: 10,
                fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? t('demo.btn_loading') : t('demo.btn_submit')}
            </button>

            <p style={{ fontSize: 12, color: "var(--mute-2)", marginTop: 4 }}>
              {t('demo.hint')}
            </p>
          </form>
        </div>

        {/* Right: mock chat — identical structure to ConversationCard */}
        <div className="glass-strong" style={{
          padding: "24px 22px 20px", borderRadius: 10,
          display: "flex", flexDirection: "column",
          ...window.revealStyle(sectionInView, { delay: 150 }),
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingBottom: 18, marginBottom: 18,
            borderBottom: "1px solid var(--line)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="neu-raised-soft" style={{
                width: 40, height: 40, borderRadius: 999,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--serif)", fontSize: 20, fontStyle: "italic",
                color: firstName.trim() ? "var(--wine)" : "var(--ink)",
                transition: "color 0.2s"
              }}>
                {firstName.trim() ? firstName.trim()[0].toUpperCase() : "L"}
              </div>
              <div>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: firstName.trim() ? "var(--wine)" : "var(--ink)",
                  transition: "color 0.2s"
                }}>
                  {firstName.trim() || t('demo.chat_lead_name')}
                </div>
                <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 2, fontFamily: "var(--mono)", letterSpacing: "0.04em" }}>
                  {niche.trim() ? `${niche.trim()} · ${t('convUI.chat_enquired_note')}` : t('demo.chat_lead_sub')}
                </div>
              </div>
            </div>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 10, fontFamily: "var(--mono)", letterSpacing: "0.14em",
              textTransform: "uppercase", color: "var(--wine)",
              padding: "6px 10px", borderRadius: 4,
              background: "var(--wine-tint)"
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--wine)", boxShadow: "0 0 0 3px var(--wine-glow)" }} />
              {t('demo.chat_live')}
            </span>
          </div>

          {/* Messages */}
<div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
  <div style={window.revealStyle(sectionInView, { delay: window.stagger(0, 120), axis: 'x', distance: 8 })}>
    <Msg from="homeowner" time="09:14">{t('convUI.demo_msg1')}</Msg>
  </div>
  <div style={window.revealStyle(sectionInView, { delay: window.stagger(1, 120), axis: 'x', distance: -8 })}>
    <Msg from="firm" time="09:21" readReceipt={true}>{t('convUI.demo_msg2')}</Msg>
  </div>
  <div style={window.revealStyle(sectionInView, { delay: window.stagger(2, 120), axis: 'x', distance: 8 })}>
    <Msg from="homeowner" time="09:22">{t('convUI.demo_msg3')}</Msg>
  </div>
  <TypingBubble dir="lead" />
</div>

        </div>

      </div>
    </section>
  );
}
