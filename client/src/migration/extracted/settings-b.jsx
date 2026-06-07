// Settings Layout B — "Step Navigator"
// Numbered inner-left nav with editorial serif section headings.
// Feels like a guided setup wizard, great for onboarding clients.
//
// CampaignSettings = content-only (no sidebar/list) so it can be dropped
// into the shared CampaignWorkspace beside the Stats monitor. The
// Stats/Settings PageTabs in the hero drive `tab`/`setTab`.

function CampaignSettings({ tab, setTab, demoMode, setDemoMode }) {
  const [active, setActive]     = React.useState('business');
  const [showPrompt, setShowPrompt] = React.useState(true);

  // Live variable state — editing the form fields below updates the connected
  // prompt's resolved preview on the right in real time.
  const [vars, setVars] = React.useState(() => ({ ...(window.LA_PROMPTS ? window.LA_PROMPTS.vars : {}) }));

  const sections = [
    { id: 'business', num: '01', label: 'Business & Campaign', title: 'The Business', desc: 'Company context, agent identity, and the offer' },
    { id: 'ai',       num: '02', label: 'AI Settings',         title: 'The Voice',    desc: 'First message, bump sequence, and AI behaviour' },
    { id: 'behavior', num: '03', label: 'Behavior',            title: 'The Rules',    desc: 'Language, schedule, booking, and limits' },
  ];

  const cur    = sections.find((s) => s.id === active);
  const curIdx = sections.indexOf(cur);

  // The prompt connected to this campaign (Demo Prompt) — resolved live.
  const connected = window.LA_PROMPTS ? window.LA_PROMPTS.prompts.find(p => p.id === 65) : null;

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--bg)', padding: 'var(--pad, 28px)' }}>

      <SettingsHero tab={tab} setTab={setTab} demoMode={demoMode} setDemoMode={setDemoMode} showPrompt={showPrompt} setShowPrompt={setShowPrompt} />

      {/* Two-column inner layout */}
      <div style={{ display: 'flex', gap: 'var(--gap, 22px)', alignItems: 'flex-start' }}>

        {/* ── Left section nav ── */}
        <div style={{ width: 262, flexShrink: 0, position: 'sticky', top: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sections.map((s) => {
              const on = s.id === active;
              return (
                <button key={s.id} onClick={() => setActive(s.id)} style={{
                  padding: '18px 20px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  borderRadius: 'var(--r-surface)', transition: 'all 150ms',
                  background: on ? 'var(--card)' : 'transparent',
                  boxShadow: on ? 'var(--sh-raised-crisp)' : 'none',
                  borderLeft: `3px solid ${on ? 'var(--wine)' : 'transparent'}`,
                }}>
                  <div className="row" style={{ gap: 12, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', color: on ? 'var(--wine)' : 'var(--mute-2)' }}>{s.num}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: on ? 'var(--ink)' : 'var(--ink-soft)' }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', paddingLeft: 30, lineHeight: 1.4 }}>{s.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Auto-save indicator (changes persist automatically) */}
          <div style={{
            marginTop: 24,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '13px 16px', borderRadius: 'var(--r-surface)',
            background: 'var(--good-tint)',
            border: '1px solid rgba(47,148,97,0.18)',
          }}>
            <span style={{
              width: 26, height: 26, borderRadius: 'var(--r-button)', flexShrink: 0,
              background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--good)',
            }}><IconCheck size={14} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>All changes saved</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute)', marginTop: 2 }}>Auto-saved · just now</div>
            </div>
          </div>
        </div>

        {/* ── Content card ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="neu-raised" style={{ padding: 'var(--pad-card, 36px)', borderRadius: 'var(--r-card)' }}>

            {/* Editorial section heading */}
            <div style={{ marginBottom: 'calc(var(--gap-form, 24px) + 10px)', paddingBottom: 'var(--gap-form, 24px)', borderBottom: '1px solid var(--line)' }}>
              <div className="eyebrow wine" style={{ marginBottom: 10 }}>{cur.num} / 03</div>
              <div className="serif italic" style={{ fontSize: 52, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 10 }}>
                {cur.title}
              </div>
              <div style={{ fontSize: 14, color: 'var(--mute)' }}>{cur.desc}</div>
            </div>

            {active === 'business' && <BusinessSection vars={vars} setVars={setVars} />}
            {active === 'ai'       && <AISection vars={vars} setVars={setVars} />}
            {active === 'behavior' && <BehaviorSection vars={vars} setVars={setVars} />}

            {/* Prev / Next nav */}
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
              <button
                onClick={() => curIdx > 0 && setActive(sections[curIdx - 1].id)}
                disabled={curIdx === 0}
                style={{
                  border: 'none', borderRadius: 'var(--r-button)', cursor: curIdx > 0 ? 'pointer' : 'default',
                  background: curIdx > 0 ? 'var(--card)' : 'transparent',
                  boxShadow: curIdx > 0 ? 'var(--sh-raised-crisp)' : 'none',
                  padding: '11px 20px',
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: curIdx > 0 ? 'var(--ink)' : 'var(--mute-2)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                ← {curIdx > 0 ? sections[curIdx - 1].label : 'Start'}
              </button>
              <button
                onClick={() => curIdx < sections.length - 1 && setActive(sections[curIdx + 1].id)}
                style={{
                  border: 'none', borderRadius: 'var(--r-button)', cursor: curIdx < sections.length - 1 ? 'pointer' : 'default',
                  background: curIdx < sections.length - 1 ? 'var(--wine-grad)' : 'var(--card)',
                  boxShadow: curIdx < sections.length - 1 ? 'var(--sh-polished-medium)' : 'var(--sh-raised-crisp)',
                  padding: '11px 20px',
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: curIdx < sections.length - 1 ? 'var(--paper)' : 'var(--mute)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                {curIdx < sections.length - 1 ? sections[curIdx + 1].label : 'All done'} →
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>

    {/* ── Live connected-prompt panel (updates as you edit) ── */}
    {showPrompt && connected && !demoMode && (
      <ConnectedPromptPanel prompt={connected} vars={vars} onClose={() => setShowPrompt(false)} />
    )}
    </div>
  );
}

// ── Live connected-prompt panel (right side of Campaign Settings) ──
// Resolves the campaign's linked prompt against the live `vars` from the form,
// so editing a field updates the rendered prompt instantly.
function ConnectedPromptPanel({ prompt, vars, onClose }) {
  return (
    <div style={{ width: 440, flexShrink: 0, borderLeft: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flexShrink: 0, height: 56, padding: '0 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ color: 'var(--wine)', display: 'flex' }}><IconSpark size={15} /></span>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Connected Prompt</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{prompt.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--good)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }} />Live
          </span>
          <button onClick={onClose} title="Hide" style={{ width: 30, height: 30, borderRadius: 'var(--r-button)', border: 'none', cursor: 'pointer', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)', fontFamily: 'var(--mono)', fontSize: 15, lineHeight: 1 }}>
            ✕
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 22px 36px' }}>
        <MarkdownResolved clean={resolvePrompt(prompt.content, vars)} vars={vars} />
      </div>
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Edits to the form update this preview live · </span>
        <a href="Prompt Library.html" style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wine)', fontWeight: 700, textDecoration: 'none' }}>Open in Prompt Library →</a>
      </div>
    </div>
  );
}

// Standalone wrapper (used if mounted on its own page)
function SettingsB() {
  const [tab, setTab] = React.useState('settings');
  const [demoMode, setDemoMode] = React.useState(false);
  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {!demoMode && <Sidebar active="Campaigns" />}
        {!demoMode && <CampaignList />}
        <CampaignSettings tab={tab} setTab={setTab} demoMode={demoMode} setDemoMode={setDemoMode} />
      </div>
    </div>
  );
}

Object.assign(window, { SettingsB, CampaignSettings, ConnectedPromptPanel });
