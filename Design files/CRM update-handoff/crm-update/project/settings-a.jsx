// Settings Layout A — "Tabbed Focus"
// Section tabs across the top, one panel at a time.
// Demo button hides sidebar + campaign list for clean screenshare.

function SettingsA() {
  const [demoMode, setDemoMode] = React.useState(false);
  const [tab, setTab] = React.useState('business');

  const tabs = [
    { id: 'business', label: 'Business & Campaign', Ic: IconDoc },
    { id: 'ai',       label: 'AI Settings',          Ic: IconSpark },
    { id: 'behavior', label: 'Behavior',              Ic: IconSettings },
  ];

  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <HeaderBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {!demoMode && <Sidebar />}
        {!demoMode && <CampaignList />}

        <div style={{ flex: 1, padding: 28, overflowY: 'auto', background: 'var(--bg)' }}>

          <SettingsHero demoMode={demoMode} setDemoMode={setDemoMode} />

          {/* Section tab strip + save row */}
          <div className="row" style={{ gap: 0, borderBottom: '1px solid var(--line)', marginBottom: 22 }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '13px 26px', border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
                color: tab === t.id ? 'var(--wine)' : 'var(--mute)', fontWeight: tab === t.id ? 700 : 400,
                borderBottom: tab === t.id ? '2px solid var(--wine)' : '2px solid transparent',
                marginBottom: -1, transition: 'color 150ms',
              }}>
                <t.Ic size={13} />{t.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <div className="row" style={{ gap: 10, paddingBottom: 8 }}>
              <button className="la-btn la-btn--soft la-btn--lg">Discard</button>
              <button className="btn-wine" style={{ padding: '10px 22px' }}>Save Changes</button>
            </div>
          </div>

          {/* Content panel */}
          <div className="neu-raised" style={{ padding: 32, borderRadius: 'var(--r-card)' }}>
            {tab === 'business' && <BusinessSection />}
            {tab === 'ai'       && <AISection />}
            {tab === 'behavior' && <BehaviorSection />}
          </div>

        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsA });
