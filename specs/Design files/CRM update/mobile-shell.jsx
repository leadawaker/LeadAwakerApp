// mobile-shell.jsx — shared mobile chrome for the Lead Awaker Campaigns app.
// Top app bars (list + detail), bottom tab bar, and small reused pieces.
// Depends on components.jsx (icons, StatusPill) + design-system.css.

// ─── Bottom tab bar ────────────────────────────────────────────────
// Campaigns · Leads · Calendar · Tasks · More  (wine accent on active)
function MobBottomNav({ active, onTab }) {
  const tabs = [
    { key: 'Campaigns', Ic: IconCampaigns, label: 'Campaigns' },
    { key: 'Leads',     Ic: IconLeads,     label: 'Leads' },
    { key: 'Calendar',  Ic: IconCal,       label: 'Calendar' },
    { key: 'Tasks',     Ic: IconTasks,     label: 'Tasks' },
    { key: 'More',      Ic: IconMore,      label: 'More' },
  ];
  return (
    <div style={{
      flexShrink: 0,
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
      background: 'var(--bg-2)',
      borderTop: '1px solid var(--line)',
      minHeight: 'var(--bottombar-h)',
      padding: '8px 6px calc(10px + var(--safe-bottom))',
    }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button key={t.key} onClick={() => onTab && onTab(t.key)} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            padding: '4px 0',
          }}>
            <span style={{
              width: 56, height: 30, borderRadius: 'var(--r-pill)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: on ? 'var(--wine)' : 'var(--mute)',
              background: on ? 'var(--wine-tint)' : 'transparent',
              boxShadow: on ? 'inset 0 0 0 1px rgba(94,34,48,0.14)' : 'none',
              transition: 'all 160ms',
            }}>
              <t.Ic size={21} />
            </span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: on ? 'var(--wine)' : 'var(--mute-2)',
              fontWeight: on ? 700 : 400,
            }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── List-screen top bar ───────────────────────────────────────────
function MobListBar({ onSearch }) {
  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
      {/* brand + agency switcher */}
      <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px 6px' }}>
        <button className="la-switcher" style={{ width: 'auto', padding: '7px 12px', gap: 8 }}>
          <span className="row" style={{ gap: 8 }}>
            <IconSwap size={13} /><span>Agency View</span>
          </span>
          <span style={{ display: 'flex', transform: 'rotate(90deg)', color: 'var(--mute-2)' }}><IconChev size={11} /></span>
        </button>
        <div className="row" style={{ gap: 8 }}>
          <IconBtn Ic={IconSearch} onClick={onSearch} />
          <IconBtn Ic={IconBell} dot />
        </div>
      </div>
      {/* big title */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', padding: '4px 18px 16px' }}>
        <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
          <span className="serif" style={{ fontSize: 34, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Campaigns</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <IconBtn Ic={IconFilter} />
          <IconBtn Ic={IconSort} />
        </div>
      </div>
    </div>
  );
}

// ─── Detail-screen top bar ─────────────────────────────────────────
function MobDetailBar({ campaign, tab, setTab, onBack }) {
  return (
    <div style={{ flexShrink: 0, background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}>
      <div className="row" style={{ gap: 10, padding: '12px 12px 10px' }}>
        <button onClick={onBack} style={{
          width: 38, height: 38, borderRadius: 'var(--r-pill)', flexShrink: 0,
          border: 'none', cursor: 'pointer',
          background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)',
          color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ display: 'flex', transform: 'rotate(180deg)' }}><IconChev size={16} /></span>
        </button>
        <div className="la-mono-tile wine" style={{ width: 38, height: 38, fontSize: 16, borderRadius: 'var(--r-button)' }}>{campaign.mono}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.name}</div>
          <div className="row" style={{ gap: 7 }}>
            <StatusPill status={campaign.status} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.1em' }}>#{campaign.id}</span>
          </div>
        </div>
        <IconBtn Ic={IconMore} />
      </div>
      {/* Stats / Settings segmented control */}
      <div style={{ padding: '0 14px 12px' }}>
        <div className="la-seg la-seg--fill">
          {[['stats', IconActivity, 'Stats'], ['settings', IconSettings, 'Settings']].map(([k, Ic, label]) => {
            const on = k === tab;
            return (
              <button key={k} onClick={() => setTab(k)} className={`la-seg-btn${on ? ' on' : ''}`} style={{ padding: '9px 0' }}><Ic size={14} />{label}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Small round icon button ───────────────────────────────────────
function IconBtn({ Ic, onClick, dot }) {
  return (
    <button onClick={onClick} style={{
      width: 38, height: 38, borderRadius: 'var(--r-pill)', position: 'relative',
      border: 'none', cursor: 'pointer',
      background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)',
      color: 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Ic size={16} />
      {dot && <span style={{ position: 'absolute', top: 9, right: 9, width: 6, height: 6, borderRadius: '50%', background: 'var(--wine)' }} />}
    </button>
  );
}

// ─── Reusable bottom sheet (locked transition — variation B) ───────
// Renders a scrim + a panel that rises from the bottom with a drag handle.
// `open` drives it; manages its own mount/unmount so the exit animates.
function MobSheet({ open, onClose, children }) {
  const [render, setRender] = React.useState(open);
  const [vis, setVis] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setRender(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)));
    } else {
      setVis(false);
    }
  }, [open]);
  if (!render) return null;
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
  return (
    <>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, zIndex: 20,
        background: 'rgba(31,26,20,0.32)',
        opacity: vis ? 1 : 0, transition: 'opacity 360ms ease',
        pointerEvents: vis ? 'auto' : 'none',
      }} />
      <div onTransitionEnd={() => { if (!vis) setRender(false); }} style={{
        position: 'absolute', left: 0, right: 0, top: 18, bottom: 0, zIndex: 21,
        transform: vis ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform 360ms ${ease}`,
        borderRadius: 'var(--r-panel) var(--r-panel) 0 0', overflow: 'hidden',
        boxShadow: '0 -10px 40px rgba(60,45,25,0.20)',
      }}>
        <div onClick={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 26, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 6 }}>
          <span style={{ width: 40, height: 5, borderRadius: 'var(--r-pill)', background: 'var(--mute-2)', opacity: 0.6 }} />
        </div>
        {children}
      </div>
    </>
  );
}

// Wrapper that recedes (scales back) when a sheet is open behind it.
function MobRecede({ open, children }) {
  const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
  return (
    <div style={{
      position: 'absolute', inset: 0,
      transform: open ? 'scale(0.96)' : 'scale(1)', transformOrigin: '50% 0%',
      transition: `transform 360ms ${ease}`,
    }}>{children}</div>
  );
}

// ─── Placeholder screen for not-yet-designed tabs ──────────────────
function MobPlaceholder({ label, Ic }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18, padding: 40, textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 'var(--r-panel)',
        background: 'var(--surface)', boxShadow: 'var(--sh-raised-medium)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)',
      }}><Ic size={30} /></div>
      <div>
        <div className="serif" style={{ fontSize: 30, color: 'var(--ink)', marginBottom: 6 }}>{label}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Mobile design · next up</div>
      </div>
    </div>
  );
}

Object.assign(window, { MobBottomNav, MobListBar, MobDetailBar, IconBtn, MobPlaceholder, MobSheet, MobRecede });
