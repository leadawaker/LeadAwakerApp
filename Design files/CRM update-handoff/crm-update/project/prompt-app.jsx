// prompt-app.jsx — Prompt Library page header (title + System/Campaigns tabs,
// like other pages), a refined prompt-meta bar, and a responsive orchestrator.
// Depends on: prompt-panels.jsx, prompt-engine.jsx, prompt-data.js, components.jsx

// ── A labeled meta chip (model / temp / max / version …) ───────────
function MetaChip({ label, value, accent, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 11px', borderRadius: 'var(--r-button)', border: 'none',
      background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', cursor: onClick ? 'pointer' : 'default',
    }}>
      {label && <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{label}</span>}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: accent || 'var(--ink-soft)', fontWeight: 600 }}>{value}</span>
      {onClick && <PIconChevD size={11} style={{ color: 'var(--mute-2)' }} />}
    </button>
  );
}

// ── Page header — title + System/Campaigns tabs + global actions ───
function PromptPageHeader({ tab, setTab, counts, listCollapsed, onToggleList, narrow }) {
  const tabs = [['system', 'System & CRM', counts.system], ['campaign', 'Campaigns', counts.campaign]];
  return (
    <div style={{ height: 60, flexShrink: 0, padding: '0 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg)' }}>
      {/* list collapse toggle (replaces the old pause button) */}
      <button onClick={onToggleList} title={listCollapsed ? 'Show prompt list' : 'Collapse prompt list'} style={{
        width: 36, height: 36, borderRadius: 'var(--r-button)', border: 'none', cursor: 'pointer',
        background: listCollapsed ? 'var(--wine-tint)' : 'var(--surface)', boxShadow: listCollapsed ? '0 0 0 1px var(--wine-glow)' : 'var(--sh-raised-crisp)',
        color: listCollapsed ? 'var(--wine)' : 'var(--mute)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><PIconSidebar size={16} /></button>

      <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Prompt Library</span>

      {/* System / Campaigns tabs next to the title */}
      <div className="la-seg">
        {tabs.map(([k, label, n]) => {
          const on = k === tab;
          return (
            <button key={k} onClick={() => setTab(k)} className={`la-seg-btn${on ? ' on' : ''}`}>
              {narrow && k === 'system' ? 'System' : label}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: on ? 'var(--wine)' : 'var(--mute-2)', background: on ? 'var(--wine-tint)' : 'var(--bg)', borderRadius: 'var(--r-pill)', padding: '1px 7px' }}>{n}</span>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />

      {/* Collection controls — search · filter · group · sort · add */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative' }}>
          <input className="neu-input" placeholder="Search prompts…" style={{ paddingLeft: 32, fontSize: 12, padding: '8px 12px 8px 32px', width: narrow ? 150 : 200 }} />
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex' }}><PIconSearch size={13} /></span>
        </div>
        {[[PIconFilter, 'Filter'], [PIconLayers, 'Group'], [PIconSort, 'Sort']].map(([Ic, label], i) => (
          <button key={i} title={label} className="la-btn la-btn--soft la-btn--icon"><Ic size={14} /></button>
        ))}
        <button className="la-btn la-btn--wine"><PIconPlus size={13} />New</button>
      </div>
    </div>
  );
}

// ── Prompt identity / meta bar (above the editor) ──────────────────
function PromptMetaBar({ prompt, showPreview, onTogglePreview, paneToggle, paneView, setPaneView, onBack }) {
  return (
    <div style={{ flexShrink: 0, minHeight: 56, padding: '10px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14, background: 'var(--paper)', flexWrap: 'wrap' }}>
      {onBack && (
        <button onClick={onBack} title="Back to list" className="la-btn la-btn--soft la-btn--icon" style={{ flexShrink: 0 }}><PIconChevL size={16} /></button>
      )}
      {/* identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--r-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--wine-tint)', color: 'var(--wine)', boxShadow: '0 0 0 1px var(--wine-glow)' }}><PIconBot size={19} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prompt.name}</span>
            {prompt.active && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--good-tint)', color: 'var(--good)', fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--good)' }} />Active
              </span>
            )}
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>#{prompt.id} · {prompt.group}</span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* meta chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <MetaChip label="Model" value={prompt.model} onClick={() => {}} />
        <MetaChip label="Temp" value={prompt.temperature} />
        <MetaChip label="Max" value={`${prompt.maxTokens}`} />
        <MetaChip label="Ver" value={prompt.version} onClick={() => {}} />
      </div>

      <div style={{ width: 1, height: 26, background: 'var(--line)' }} />

      {/* preview control: split toggle (wide) OR edit/preview switch (narrow) */}
      {paneToggle ? (
        <div className="la-seg">
          {[['edit', 'Edit'], ['preview', 'Preview']].map(([k, label]) => {
            const on = k === paneView;
            return (
              <button key={k} onClick={() => setPaneView(k)} className={`la-seg-btn${on ? ' on' : ''}`}>{k === 'preview' ? <PIconEye size={13} /> : null}{label}</button>
            );
          })}
        </div>
      ) : (
        <button onClick={onTogglePreview} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--r-button)', border: 'none', cursor: 'pointer',
          background: showPreview ? 'var(--wine-tint)' : 'var(--surface)', boxShadow: showPreview ? '0 0 0 1px var(--wine-glow)' : 'var(--sh-raised-crisp)',
          color: showPreview ? 'var(--wine)' : 'var(--mute)', fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
        }}>
          {showPreview ? <PIconEyeOff size={14} /> : <PIconEye size={14} />}{showPreview ? 'Hide preview' : 'Preview'}
        </button>
      )}

      <button title="Save" className="la-btn la-btn--wine la-btn--icon" style={{ flexShrink: 0 }}><PIconSave size={15} /></button>
      <button title="Delete" className="la-btn la-btn--soft la-btn--icon" style={{ color: 'var(--stage-lost)', flexShrink: 0 }}><PIconTrash size={15} /></button>
    </div>
  );
}

// ═══ APP ═══════════════════════════════════════════════════════════
function PromptApp() {
  const D = window.LA_PROMPTS;
  const [activeId, setActiveId] = React.useState(D.activeId);
  const [showPreview, setShowPreview] = React.useState(true);
  const [collapsed, setCollapsed] = React.useState(false);
  const [drafts, setDrafts] = React.useState({});
  const [listTab, setListTab] = React.useState('campaign');
  const [editMode, setEditMode] = React.useState('structured');
  const [paneView, setPaneView] = React.useState('edit');   // narrow: edit | preview
  const [mobileOpen, setMobileOpen] = React.useState(false); // very-small: list ↔ editor drill-in

  const [vw, setVw] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1600);
  React.useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Breakpoints:
  //  ≥1280  wide   — list (or collapsed rail) + editor | preview split
  //  860–1279 medium — list rail; ONE pane at a time (Edit/Preview toggle)
  //  <860   small  — list is full-width; tapping a prompt drills into the editor
  const small = vw < 860;
  const medium = vw >= 860 && vw < 1280;
  const counts = { system: D.prompts.filter(p => p.kind === 'system').length, campaign: D.prompts.filter(p => p.kind === 'campaign').length };

  const listCollapsed = !small && (collapsed || medium);
  const singlePane = medium || small;   // don't split 50/50

  const prompt = D.prompts.find(p => p.id === activeId);
  const content = drafts[activeId] != null ? drafts[activeId] : prompt.content;
  const setContent = (v) => setDrafts(d => ({ ...d, [activeId]: v }));

  const selectPrompt = (id) => { setActiveId(id); if (small) setMobileOpen(true); };

  // small + not opened → show full-width list only
  const showListOnly = small && !mobileOpen;
  const showWorkspace = !showListOnly;

  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      <Sidebar active="Prompt Library" />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        <PromptPageHeader tab={listTab} setTab={setListTab} counts={counts}
                          listCollapsed={listCollapsed} onToggleList={() => { if (small) { setMobileOpen(false); } else { setCollapsed(c => !c); } }}
                          narrow={medium || small} />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {/* list — hidden in small drill-in mode */}
          {(!small || showListOnly) && (
            <div style={{ flex: small ? '1 1 100%' : '0 0 auto', minWidth: 0, display: 'flex' }}>
              <PromptList prompts={D.prompts} activeId={activeId} collapsed={listCollapsed} onSelect={selectPrompt} tab={listTab} />
            </div>
          )}

          {/* workspace */}
          {showWorkspace && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <PromptMetaBar prompt={prompt} showPreview={showPreview} onTogglePreview={() => setShowPreview(s => !s)}
                             paneToggle={singlePane} paneView={paneView} setPaneView={setPaneView}
                             onBack={small ? () => setMobileOpen(false) : null} />
              <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
                {/* EDITOR */}
                {(!singlePane || paneView === 'edit') && (
                  <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: (!singlePane && showPreview) ? '1px solid var(--line)' : 'none' }}>
                    <PromptEditor value={content} onChange={setContent} mode={editMode} setMode={setEditMode} />
                  </div>
                )}
                {/* PREVIEW */}
                {((!singlePane && showPreview) || (singlePane && paneView === 'preview')) && (
                  <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <PromptPreview src={content} vars={D.vars} name={prompt.name} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MetaChip, PromptPageHeader, PromptMetaBar, PromptApp });
