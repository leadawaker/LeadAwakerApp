// campaign-workspace.jsx — shared shell for the Campaigns page.
// CampaignList owns the full left-card header: title, Stats/Settings tabs,
// and search/filter/group/sort/new toolbar. No topbar in main section —
// content starts directly, giving the eye a clean left→right journey.
// Depends on: components.jsx, layout-bold.jsx, settings-b.jsx, settings-components.jsx

function CampaignWorkspace() {
  const [tab, setTab] = React.useState('stats');
  const [demoMode, setDemoMode] = React.useState(false);
  const D = window.LA_DATA;

  const [collapsed, setCollapsed] = React.useState(() => window.innerWidth < 1200);
  React.useEffect(() => {
    const handler = () => setCollapsed(window.innerWidth < 1200);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Settings "Demo" preview hides all agency chrome so you see the client view.
  const hideRail = tab === 'settings' && demoMode;

  if (hideRail) {
    return (
      <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <CampaignSettings tab={tab} setTab={setTab} demoMode={demoMode} setDemoMode={setDemoMode} />
        </div>
      </div>
    );
  }

  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      <Sidebar active="Campaigns" />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        {/* Top header: title + Stats/Settings seg + toolbar */}
        <div style={{ height: 60, flexShrink: 0, padding: '0 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Campaigns</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.1em' }}>#{D.active.id}</span>
          <div className="la-seg">
            {[{ key: 'stats', Ic: IconActivity, label: 'Stats' }, { key: 'settings', Ic: IconSettings, label: 'Settings' }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`la-seg-btn${tab === t.key ? ' on' : ''}`}>
                <t.Ic size={14} />{t.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <input className="neu-input" placeholder="Search…" style={{ padding: '8px 12px 8px 32px', fontSize: 12, width: 180 }} />
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex', pointerEvents: 'none' }}><IconSearch size={12} /></span>
            </div>
            {collapsed ? (
              <button title="Options" className="la-btn la-btn--soft la-btn--icon"><IconSettings size={13} /></button>
            ) : (
              <>
                <button title="Filter" className="la-btn la-btn--soft la-btn--icon"><IconFilter size={13} /></button>
                <button title="Sort"   className="la-btn la-btn--soft la-btn--icon"><IconSort size={13} /></button>
                <button title="Group"  className="la-btn la-btn--soft la-btn--icon"><IconLayers size={13} /></button>
              </>
            )}
            <button className="la-btn la-btn--wine la-btn--icon"><IconPlus size={14} /></button>
          </div>
        </div>
        {/* Content row */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          <CampaignList tab={tab} setTab={setTab} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
            {tab === 'stats'
              ? <CampaignMonitor tab={tab} setTab={setTab} />
              : <CampaignSettings tab={tab} setTab={setTab} demoMode={demoMode} setDemoMode={setDemoMode} />}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CampaignWorkspace });
