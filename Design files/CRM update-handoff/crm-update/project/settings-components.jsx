// settings-components.jsx
// Form controls, section panels, and campaign settings hero
// Depends on: components.jsx (Icon, StatusPill, ChannelChip, etc. on window)

// ─── Extra icons ───────────────────────────────────────────────────
const IconGlobe = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 3c-2 2.8-3.2 5.8-3.2 9s1.2 6.2 3.2 9M12 3c2 2.8 3.2 5.8 3.2 9s-1.2 6.2-3.2 9"/></>} />;
const IconLink  = (p) => <Icon {...p} d={<><path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M11 12h2"/></>} />;

// ─── Field wrapper ─────────────────────────────────────────────────
function SF({ label, icon, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      {label && (
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          {icon && <span style={{ color: 'var(--mute-2)', display: 'flex' }}>{icon}</span>}
          <span className="eyebrow eyebrow-sm">{label}</span>
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Text input ────────────────────────────────────────────────────
function STI({ placeholder, defaultValue, value, onChange, mono = false }) {
  const controlled = value !== undefined;
  return (
    <input className="neu-input" placeholder={placeholder}
           {...(controlled ? { value, onChange: (e) => onChange && onChange(e.target.value) } : { defaultValue })}
           style={{ width: '100%', fontFamily: mono ? 'var(--mono)' : 'var(--sans)', fontSize: 14 }} />
  );
}

// ─── Textarea ─────────────────────────────────────────────────────
function STA({ placeholder, defaultValue, value, onChange, rows = 4 }) {
  const controlled = value !== undefined;
  return (
    <textarea className="neu-input" placeholder={placeholder}
              {...(controlled ? { value, onChange: (e) => onChange && onChange(e.target.value) } : { defaultValue })}
              rows={rows} style={{ width: '100%', resize: 'vertical', lineHeight: 1.55, fontFamily: 'var(--sans)', fontSize: 14 }} />
  );
}

// ─── Select ───────────────────────────────────────────────────────
function SSel({ value, options = [], placeholder, controlledValue, onChange }) {
  const isControlled = controlledValue !== undefined;
  const common = {
    className: 'neu-input',
    style: { width: '100%', appearance: 'none', WebkitAppearance: 'none', paddingRight: 40, cursor: 'pointer', fontSize: 14 },
  };
  return (
    <div style={{ position: 'relative' }}>
      {isControlled ? (
        <select {...common} value={controlledValue} onChange={(e) => onChange && onChange(e.target.value)}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      ) : (
        <select {...common} defaultValue={value || ''}>
          {placeholder && <option value="">{placeholder}</option>}
          {value && <option value={value}>{value}</option>}
          {options.filter(o => o !== value).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      )}
      <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: 'var(--mute-2)', pointerEvents: 'none', display: 'flex' }}>
        <IconChev size={15} />
      </span>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────
function STog({ value, onChange }) {
  return (
    <button onClick={() => onChange && onChange(!value)} style={{
      width: 52, height: 28, borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', flexShrink: 0,
      background: value ? 'var(--wine-grad)' : 'var(--bg)',
      boxShadow: value ? 'var(--sh-raised-crisp)' : 'var(--sh-inset-crisp)',
      position: 'relative', transition: 'all 220ms',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: 'var(--card-bright)',
        boxShadow: 'var(--sh-raised-crisp)', position: 'absolute', top: 3,
        left: value ? 27 : 3, transition: 'left 200ms',
      }} />
    </button>
  );
}

// ─── Segmented (typos 0–3) — pill .la-seg with fixed-width number cells ──
function SSeg({ options, value, onChange }) {
  return (
    <div className="la-seg la-seg--pill">
      {options.map((o) => (
        <button key={o} onClick={() => onChange && onChange(o)}
          className={`la-seg-btn${value === o ? ' on' : ''}`}
          style={{ width: 42, height: 30, padding: 0, fontSize: 14 }}>{o}</button>
      ))}
    </div>
  );
}

// ─── Booking mode — equal-width view switcher ─────────────────────
function SBooking({ value, onChange }) {
  const opts = ['Call Agent', 'Direct Booking'];
  return (
    <div className="la-seg la-seg--fill">
      {opts.map((o) => (
        <button key={o} onClick={() => onChange && onChange(o)}
          className={`la-seg-btn${value === o ? ' on' : ''}`}
          style={{ padding: '12px 0' }}>{o}</button>
      ))}
    </div>
  );
}

// ─── AI Generate button ───────────────────────────────────────────
function AIBtn({ size = 'sm' }) {
  const small = size === 'sm';
  return (
    <button className={`la-btn la-btn--wine${small ? '' : ' la-btn--lg'}`}>
      <IconSpark size={12} />AI WRITE
    </button>
  );
}

// ─── Bump card ────────────────────────────────────────────────────
function SBump({ number, delay: initDelay }) {
  const [delay, setDelay] = React.useState(initDelay);
  return (
    <div className="neu-raised-crisp" style={{ padding: '18px 20px', borderRadius: 'var(--r-surface)' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 'var(--r-button)', background: 'var(--bg)',
            boxShadow: 'var(--sh-inset-crisp)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--wine)', fontWeight: 700,
          }}>{number}</div>
          <span className="eyebrow">Bump {number}</span>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="eyebrow eyebrow-sm">Delay</span>
            <input type="number" className="neu-input" value={delay} onChange={(e) => setDelay(e.target.value)}
                   style={{ width: 66, padding: '8px 10px', fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'center' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.14em' }}>HRS</span>
          </div>
          <AIBtn />
        </div>
      </div>
      <STA placeholder={`Write bump ${number} message, or hit AI Write to generate one…`} rows={3} />
    </div>
  );
}

// ─── Settings hero card ───────────────────────────────────────────
function SettingsHero({ tab, setTab, demoMode, setDemoMode, showPrompt, setShowPrompt }) {
  const D = window.LA_SETTINGS.campaign;
  return (
    <div className="neu-polished" style={{ padding: 'var(--pad-hero, 28px 32px)', borderRadius: 'var(--r-card)', marginBottom: 'var(--gap, 24px)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
        <div className="row" style={{ gap: 22, alignItems: 'center' }}>
          <div className="la-mono-tile wine" style={{ width: 58, height: 58, fontSize: 22 }}>{D.mono}</div>
          <div>
            <div className="eyebrow">Campaign · #{D.id}</div>
            <div className="serif" style={{ fontSize: 38, color: 'var(--ink)', lineHeight: 1.1, marginTop: 5 }}>{D.name}</div>
            <div className="row" style={{ gap: 10, marginTop: 10 }}>
              <StatusPill status={D.status} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.1em' }}>LAST RUN MAR 24 · 12:00 AM</span>
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 10, flexShrink: 0 }}>
          {/* Connected-prompt toggle */}
          {!demoMode && setShowPrompt && (
            <button onClick={() => setShowPrompt(!showPrompt)} style={{
              border: 'none', cursor: 'pointer', padding: '9px 18px', borderRadius: 'var(--r-button)', transition: 'all 200ms',
              background: showPrompt ? 'var(--wine-tint)' : 'var(--card)',
              boxShadow: showPrompt ? '0 0 0 1px var(--wine-glow)' : 'var(--sh-raised-crisp)',
              color: showPrompt ? 'var(--wine)' : 'var(--ink)',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <IconSpark size={12} />{showPrompt ? 'Hide Prompt' : 'Live Prompt'}
            </button>
          )}
          {/* Demo button */}
          <button onClick={() => setDemoMode && setDemoMode(!demoMode)} style={{
            border: 'none', cursor: 'pointer', padding: '9px 20px', borderRadius: 'var(--r-button)', transition: 'all 200ms',
            background: demoMode ? 'var(--wine-grad)' : 'var(--card)',
            boxShadow: demoMode ? 'var(--sh-polished-medium)' : 'var(--sh-raised-crisp)',
            color: demoMode ? 'var(--paper)' : 'var(--ink)',
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {demoMode ? <><IconCheck size={12} />Exit Demo</> : <><IconSpark size={12} />Demo</>}
          </button>
        </div>
      </div>
      <hr className="rule" style={{ margin: '22px 0 18px' }} />
      {/* Meta strip */}
      <div className="row" style={{ gap: 36, flexWrap: 'wrap' }}>
        {[
          { label: 'Channel', value: <span className="row" style={{ gap: 6 }}><IconWA size={14} />{D.channel}</span> },
          { label: 'Daily Limit', value: D.dailyLimit },
          { label: 'Active Hours', value: D.activeHours },
          { label: 'Owner', value: (
            <span className="row" style={{ gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: 'var(--r-flush)', background: 'linear-gradient(145deg, #8a6e4a, #5a4530)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontFamily: 'var(--mono)' }}>{D.ownerInit}</span>
              {D.owner}
            </span>
          )},
        ].map((m) => (
          <div key={m.label}>
            <div className="eyebrow eyebrow-sm">{m.label}</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 4 }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section content panels ────────────────────────────────────────

function BusinessSection({ vars, setVars }) {
  const live = vars || {};
  const set = (k) => (v) => setVars && setVars(p => ({ ...p, [k]: v }));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
      <SF label="Company Name" icon={<IconAccts size={13} />}><STI value={live.company_name} onChange={set('company_name')} placeholder="Company name" /></SF>
      <SF label="Agent Name" icon={<IconLeads size={13} />}><STI value={live.agent_name} onChange={set('agent_name')} placeholder="e.g. Ana" /></SF>
      <SF label="Stage of Sales Process" icon={<IconLayers size={13} />}><SSel placeholder="— Select stage —" options={['Awareness','Consideration','Decision','Post-sale']} /></SF>
      <SF label="AI Style" icon={<IconSpark size={13} />}><SSel controlledValue={live.ai_style} onChange={set('ai_style')} placeholder="— Select style —" options={['Consultative','Direct','Friendly','Professional','Casual, smooth and pro']} /></SF>
      <SF label="Inquiry Date" icon={<IconCadence size={13} />}><STI placeholder="e.g. Last 6 months, 2+ years ago" /></SF>
      <SF label="Service" icon={<IconBox size={13} />}><STI value={live.service_name} onChange={set('service_name')} placeholder="e.g. kitchen renovation consultation" /></SF>
      <SF label="Niche" icon={<IconHelp size={13} />}><STI value={live.niche} onChange={set('niche')} placeholder="e.g. premium kitchen" /></SF>
      <SF label="USP" icon={<IconCheck size={13} />}><SSel placeholder="— Select USP —" options={['Price','Quality','Speed','Service quality']} /></SF>
      <SF label="Business Description" icon={<IconDoc size={13} />} span={2}>
        <STA value={live.business_description} onChange={set('business_description')} rows={4} />
      </SF>
      <SF label="Knowledge Base" icon={<IconLibrary size={13} />} span={2}>
        <STA placeholder="Key facts, stats, achievements the AI should know about this business…" rows={4} />
      </SF>
    </div>
  );
}

function AISection({ vars, setVars }) {
  const D = window.LA_SETTINGS.ai;
  const live = vars || {};
  const set = (k) => (v) => setVars && setVars(p => ({ ...p, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-form, 22px)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
        <SF label="AI Role" icon={<IconSpark size={13} />}><STI value={live.ai_role} onChange={set('ai_role')} placeholder="e.g. sales representative" /></SF>
        <SF label="AI Voice Mode" icon={<IconChats size={13} />}><SSel value="Off" options={['Natural','Formal','Energetic']} /></SF>
        <SF label="Linked Prompt" icon={<IconLibrary size={13} />} span={2}><SSel value="Demo Prompt" options={['Demo Prompt','Default — New Campaign','Objection Handler']} /></SF>
      </div>
      <SF label="First Message" icon={<IconChats size={13} />}>
        <div style={{ position: 'relative' }}>
          <STA defaultValue={D.firstMessage} rows={5} />
          <div style={{ position: 'absolute', bottom: 10, right: 10 }}><AIBtn /></div>
        </div>
      </SF>
      <div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Bump Sequence</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {D.bumps.map((b, i) => <SBump key={i} number={i + 1} delay={b.delay} />)}
        </div>
      </div>
    </div>
  );
}

function BehaviorSection({ vars, setVars }) {
  const D = window.LA_SETTINGS.behavior;
  const live = vars || {};
  const set = (k) => (v) => setVars && setVars(p => ({ ...p, [k]: v }));
  const [typos, setTypos]     = React.useState(D.typosPerChat);
  const [demo, setDemo]       = React.useState(D.demoCampaign);
  const bookingLabel = live.booking_mode === 'direct' ? 'Direct Booking' : 'Call Agent';
  const langLabel = { en: 'English', pt: 'Portuguese', es: 'Spanish', fr: 'French' }[live.language] || 'English';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-form, 20px)' }}>
      <SF label="Language" icon={<IconGlobe size={13} />}>
        <SSel controlledValue={langLabel} onChange={(v) => set('language')({ English: 'en', Portuguese: 'pt', Spanish: 'es', French: 'fr' }[v] || 'en')} options={['English','Portuguese','Spanish','French']} />
      </SF>
      <SF label="Niche" icon={<IconBox size={13} />}><STI value={live.niche} onChange={set('niche')} placeholder="e.g. premium kitchen" /></SF>
      <SF label="Website" icon={<IconLink size={13} />}><STI placeholder="https://…" defaultValue={D.website} mono /></SF>
      <SF label="Calendar Link" icon={<IconCal size={13} />}><STI value={live.calendar_link} onChange={set('calendar_link')} placeholder="https://calendly.com/…" mono /></SF>
      <SF label="Status" icon={<IconActivity size={13} />}><SSel value={D.status} options={['Active','Inactive']} /></SF>
      <SF label="Account" icon={<IconAccts size={13} />}><STI placeholder="Account ID" defaultValue={String(D.account)} mono /></SF>
      <SF label="Type" icon={<IconLayers size={13} />}><SSel placeholder="— Select type —" options={['Cold outreach','Reactivation','Referral','Post-sale']} /></SF>
      <SF label="Demo Campaign">
        <div className="row" style={{ gap: 14, paddingTop: 8 }}>
          <STog value={demo} onChange={setDemo} />
          <span style={{ fontSize: 13, color: demo ? 'var(--wine)' : 'var(--mute)', fontWeight: 500 }}>{demo ? 'Enabled' : 'Disabled'}</span>
        </div>
      </SF>
      <SF label="Booking Mode" span={2}><SBooking value={bookingLabel} onChange={(v) => set('booking_mode')(v === 'Direct Booking' ? 'direct' : 'call')} /></SF>
      <SF label="Typos per Chat">
        <SSeg options={[0, 1, 2, 3]} value={typos} onChange={setTypos} />
      </SF>
      <SF label="Active Hours" icon={<IconCadence size={13} />}>
        <div className="row" style={{ gap: 8 }}>
          <input className="neu-input" defaultValue={D.activeHoursStart} style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 13 }} />
          <span style={{ color: 'var(--mute-2)', fontFamily: 'var(--mono)' }}>–</span>
          <input className="neu-input" defaultValue={D.activeHoursEnd} style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 13 }} />
        </div>
      </SF>
      <SF label="Campaign Duration" icon={<IconCal size={13} />} span={2}><SSel placeholder="— Select duration —" options={['7 days','14 days','30 days','60 days','Ongoing']} /></SF>
      <SF label="Interval" icon={<IconCadence size={13} />} span={2}><SSel placeholder="— Select interval —" options={['1 day','2 days','3 days','7 days','14 days']} /></SF>
    </div>
  );
}

Object.assign(window, {
  IconGlobe, IconLink,
  SF, STI, STA, SSel, STog, SSeg, SBooking, AIBtn, SBump,
  SettingsHero, BusinessSection, AISection, BehaviorSection,
});
