// campaign-workspace.jsx — shared shell for the Campaigns page.
// CampaignList owns the full left-card header: title, Stats/Settings tabs,
// and search/filter/group/sort/new toolbar. No topbar in main section —
// content starts directly, giving the eye a clean left→right journey.
// Depends on: components.jsx, layout-bold.jsx, settings-b.jsx, settings-components.jsx

function CampaignWorkspace() {
  const [tab, setTab] = React.useState('stats');
  const [demoMode, setDemoMode] = React.useState(false);

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
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar active="Campaigns" />
        {/* CampaignList owns the title + tabs + toolbar — no separate topbar */}
        <CampaignList tab={tab} setTab={setTab} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
          {tab === 'stats'
            ? <CampaignMonitor tab={tab} setTab={setTab} />
            : <CampaignSettings tab={tab} setTab={setTab} demoMode={demoMode} setDemoMode={setDemoMode} />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CampaignWorkspace });
