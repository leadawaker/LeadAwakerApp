// Demo form + mock WhatsApp chat

function Demo() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const [firstName, setFirstName] = React.useState("");
  const [niche, setNiche] = React.useState("");
  const [scenario, setScenario] = React.useState("inquired");
  const [sectionRef, sectionInView] = window.useInView();

  const SCENARIOS = [
    { id: "inquired", label: t('demo.scenario_inquired'), note: t('demo.chat_note_inquired') },
    { id: "deciding", label: t('demo.scenario_deciding'), note: t('demo.chat_note_deciding') },
  ];
  const activeScenario = SCENARIOS.find((s) => s.id === scenario) || SCENARIOS[0];
  const scenarioNote = activeScenario.note;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);


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
        body: JSON.stringify({ firstName: firstName.trim(), niche: niche.trim(), language: "nl", scenario }),
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
          <div style={{ marginBottom: 12 }}>
            <span style={{
              fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
              letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--wine)"
            }}>
              {t('demo.eyebrow_text')}
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

            {/* Scenario toggle → drives the AI's lead_stage for a tailored demo.
                Segmented control inside an inset field, matching the inputs above. */}
            <div className="neu-inset-crisp" style={{
              borderRadius: 10, display: "flex", gap: 4, padding: 6
            }}>
              {SCENARIOS.map((s) => {
                const active = scenario === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScenario(s.id)}
                    aria-pressed={active}
                    style={{
                      flex: "1 1 0", textAlign: "center",
                      padding: "10px 12px", borderRadius: 7, fontSize: 13,
                      lineHeight: 1.25, fontFamily: "var(--sans)",
                      fontWeight: active ? 600 : 500,
                      cursor: "pointer", border: "none",
                      background: active ? "var(--paper)" : "transparent",
                      color: active ? "var(--ink)" : "var(--mute)",
                      boxShadow: active ? "var(--sh-raised-crisp)" : "none",
                      transition: "background 0.18s, color 0.18s, box-shadow 0.18s"
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
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
                  {niche.trim() ? `${niche.trim()} · ${scenarioNote}` : t('demo.chat_lead_sub')}
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

          {/* Messages — fixed min-height so the panel doesn't resize between scenarios */}
<div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: isMobile ? 300 : 312 }}>
  <div key={`${scenario}-0`} style={window.revealStyle(sectionInView, { delay: window.stagger(0, 120), axis: 'x', distance: 8 })}>
    <Msg from="homeowner" time="09:14">{t(`convUI.demo_${scenario}_1`)}</Msg>
  </div>
  <div key={`${scenario}-1`} style={window.revealStyle(sectionInView, { delay: window.stagger(1, 120), axis: 'x', distance: -8 })}>
    <Msg from="firm" time="09:21" readReceipt={true}>{t(`convUI.demo_${scenario}_2`)}</Msg>
  </div>
  <div key={`${scenario}-2`} style={window.revealStyle(sectionInView, { delay: window.stagger(2, 120), axis: 'x', distance: 8 })}>
    <Msg from="homeowner" time="09:22">{t(`convUI.demo_${scenario}_3`)}</Msg>
  </div>
  <TypingBubble dir="lead" />
</div>

        </div>

      </div>
    </section>
  );
}
