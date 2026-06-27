// components.jsx — Design System Showcase
// Access via /premium/components.html — not linked from nav.

(function() {
  if (document.getElementById('_typing-kf')) return;
  const s = document.createElement('style');
  s.id = '_typing-kf';
  s.textContent = '@keyframes typingDot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}';
  document.head.appendChild(s);
})();


// ─── TOC ─────────────────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: 'colors',         label: 'Colors' },
  { id: 'typography',     label: 'Typography' },
  { id: 'shadows',        label: 'Shadows' },
  { id: 'buttons',        label: 'Buttons' },
  { id: 'inputs',         label: 'Inputs' },
  { id: 'controls',       label: 'Panel Controls' },
  { id: 'audit-controls', label: 'Audit Controls' },
  { id: 'glass',          label: 'Glass' },
  { id: 'cards',          label: 'Cards' },
  { id: 'chat',           label: 'Chat' },
  { id: 'chips',          label: 'Chips' },
  { id: 'textures',       label: 'Textures' },
  { id: 'niche-switcher', label: 'Niche Switcher' },
  { id: 'animations',     label: 'Animations' },
  { id: 'icons',          label: 'Icons' },
];

// ─── Icons (local copy since we don't load hero.jsx) ─────────────────────────

const DS_NICHE_ICONS = {
  kitchen:     <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h12v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z" /><path d="M5 8V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" /><path d="M3 11h12" /></svg>,
  flooring:    <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="3.5" width="13" height="11" rx="0.5" /><path d="M2.5 7h13M2.5 11h13M9 3.5v3.5M6 7v4M12 7v4M9 11v3.5" /></svg>,
  wellness:    <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2.5C6.5 5 4.5 7.5 4.5 10.5a4.5 4.5 0 0 0 9 0c0-3-2-5.5-4.5-8Z" /><path d="M9 14v-3M7.5 11.5h3" /></svg>,
  landscaping: <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 13V8M9 8L6 5h6L9 8Z" /><path d="M9 8L7 6h4L9 8Z" transform="translate(0 -2)" /><path d="M2 15h14" /></svg>,
  roofing:     <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 9 9 3.5 15.5 9" /><path d="M4 8v6.5h10V8" /><path d="M12 5.5V3.5h1.5v3.2" /></svg>
};

// ─── Layout primitives ────────────────────────────────────────────────────────

function Section({ id, label, children }) {
  return (
    <section id={id} style={{ marginBottom: 88, scrollMarginTop: 28 }}>
      <div style={{ marginBottom: 32, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
        <div className="eyebrow" style={{ marginBottom: 10, fontSize: 10 }}>{id}</div>
        <h2 className="serif" style={{ margin: 0, fontSize: 'clamp(28px, 3vw, 44px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{label}</h2>
      </div>
      {children}
    </section>
  );
}

function Sub({ label, dark = false, children }) {
  return (
    <div style={{ marginTop: 40 }}>
      <div className="eyebrow" style={{ marginBottom: 20, color: dark ? 'rgba(244,239,227,0.45)' : undefined }}>{label}</div>
      {children}
    </div>
  );
}

function Grid({ cols = 3, gap = 16, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
      {children}
    </div>
  );
}

// ─── Shared sub-components (local, no hero.jsx needed) ───────────────────────

function ArrowSm() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden>
      <path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FadeIn({ children }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => { const id = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(id); }, []);
  return (
    <div style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 320ms ease, transform 320ms ease' }}>
      {children}
    </div>
  );
}

function Msg({ from, time, children }) {
  const isFirm = from === 'firm';
  return (
    <div style={{ display: 'flex', justifyContent: isFirm ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <div style={{ maxWidth: '82%' }}>
        <div style={{
          background: isFirm ? 'linear-gradient(145deg, #2A241C, #1A150F)' : 'linear-gradient(145deg, var(--paper), var(--bg-2))',
          color: isFirm ? 'var(--paper)' : 'var(--ink)',
          padding: '12px 16px', fontSize: 13.5, lineHeight: 1.45,
          borderRadius: 8, fontWeight: 400, textWrap: 'pretty',
          boxShadow: isFirm ? '0 1px 2px rgba(20,15,10,0.18), 0 6px 14px -8px rgba(20,15,10,0.25)' : 'var(--sh-inset-crisp)'
        }}>{children}</div>
        <div style={{
          fontSize: 10, color: 'var(--mute)', marginTop: 5,
          fontFamily: 'var(--mono)', letterSpacing: '0.04em',
          textAlign: isFirm ? 'right' : 'left', paddingLeft: 4, paddingRight: 4
        }}>{time}</div>
      </div>
    </div>
  );
}

function Divider({ label, tone }) {
  const isWine = tone === 'wine';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0' }}>
      <span style={{ flex: 1, height: 1, background: isWine ? 'var(--wine)' : 'var(--line)', opacity: isWine ? 0.4 : 1 }} />
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: isWine ? 'var(--wine)' : 'var(--mute)' }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: isWine ? 'var(--wine)' : 'var(--line)', opacity: isWine ? 0.4 : 1 }} />
    </div>
  );
}

function TypingBubble({ dir }) {
  const isFirm = dir === 'agent' || dir === 'firm';
  return (
    <div style={{ display: 'flex', justifyContent: isFirm ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <div style={{
        background: isFirm ? 'linear-gradient(145deg, #2A241C, #1A150F)' : 'linear-gradient(145deg, var(--paper), var(--bg-2))',
        padding: '14px 16px', borderRadius: 8, display: 'flex', gap: 5, alignItems: 'center',
        boxShadow: isFirm ? '0 1px 2px rgba(20,15,10,0.18)' : 'var(--sh-inset-crisp)'
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: isFirm ? 'rgba(244,239,227,0.65)' : 'var(--mute)',
            animation: `typingDot 1.4s ${i * 0.2}s infinite ease-in-out`
          }} />
        ))}
      </div>
    </div>
  );
}

function CheckCheckIcon() {
  return (
    <svg width="14" height="9" viewBox="0 0 14 9" fill="none" aria-hidden>
      <path d="M1 4.5l3 3L9 1" stroke="#7BA8E8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 4.5l3 3 5-7" stroke="#7BA8E8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NicheSwitch({ value, onChange }) {
  const items = ['kitchen', 'flooring', 'wellness', 'landscaping', 'roofing'].map(k => ({
    k, label: CHAT_CASES[k].label, icon: DS_NICHE_ICONS[k]
  }));
  return (
    <div style={{ padding: 6, borderRadius: 10, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
      {items.map(it => {
        const on = it.k === value;
        return (
          <button key={it.k} onClick={() => onChange(it.k)} aria-pressed={on}
            style={{
              border: 'none', cursor: 'pointer', padding: '10px 4px 8px', borderRadius: 7,
              background: on ? 'linear-gradient(145deg, var(--paper), var(--bg-2))' : 'transparent',
              boxShadow: on ? 'var(--sh-raised-crisp)' : 'none',
              color: on ? 'var(--ink)' : 'var(--mute)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              transition: 'all 200ms ease'
            }}>
            <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: on ? 'var(--wine)' : 'var(--mute)' }}>
              {it.icon}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FAQRow({ q, a, initial = false }) {
  const [open, setOpen] = React.useState(initial);
  return (
    <div className="neu-raised" style={{ borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
          padding: '18px 22px', textAlign: 'left', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14
        }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4 }}>{q}</span>
        <span style={{ flexShrink: 0, fontSize: 18, color: 'var(--mute)', transition: 'transform 220ms', transform: open ? 'rotate(45deg)' : 'none', lineHeight: 1 }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 22px 18px', fontSize: 13.5, lineHeight: 1.65, color: 'var(--mute)' }}>{a}</div>
      )}
    </div>
  );
}

// ─── Section components ───────────────────────────────────────────────────────

function ColorsSection() {
  const swatches = [
    { v: '--bg',        name: 'Background' },
    { v: '--bg-2',      name: 'Background 2' },
    { v: '--paper',     name: 'Paper' },
    { v: '--ink',       name: 'Ink' },
    { v: '--ink-soft',  name: 'Ink Soft' },
    { v: '--mute',      name: 'Mute' },
    { v: '--mute-2',    name: 'Mute 2' },
    { v: '--wine',      name: 'Wine' },
    { v: '--wine-soft', name: 'Wine Soft' },
  ];
  const glass = [
    { v: '--glass-bg',        name: 'Glass BG' },
    { v: '--glass-bg-strong', name: 'Glass Strong' },
    { v: '--glass-border',    name: 'Glass Border' },
  ];
  const checker = {
    backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%)',
    backgroundSize: '12px 12px'
  };
  return (
    <Section id="colors" label="Color Palette">
      <Sub label="Base colors">
        <Grid cols={3} gap={16}>
          {swatches.map(s => (
            <div key={s.v} className="neu-raised" style={{ borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ height: 68, background: `var(${s.v})`, borderBottom: '1px solid var(--line)' }} />
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.v}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>{s.name}</div>
              </div>
            </div>
          ))}
        </Grid>
      </Sub>
      <Sub label="Glass tokens (checkerboard shows translucency)">
        <Grid cols={3} gap={16}>
          {glass.map(s => (
            <div key={s.v} className="neu-raised" style={{ borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ height: 68, ...checker, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: `var(${s.v})` }} />
              </div>
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.v}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>{s.name}</div>
              </div>
            </div>
          ))}
        </Grid>
      </Sub>
    </Section>
  );
}

function TypographySection() {
  return (
    <Section id="typography" label="Typography">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Serif heading (h1)</div>
          <div className="serif" style={{ fontSize: 'clamp(40px, 5.5vw, 72px)', lineHeight: 1.06, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
            Your leads are not dead.<br />
            They're <span className="italic" style={{ color: 'var(--wine)' }}>dormant.</span>
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Serif italic subhead</div>
          <p className="serif italic" style={{ fontSize: 'clamp(22px, 2.5vw, 36px)', lineHeight: 1.25, color: 'var(--mute)', margin: 0, letterSpacing: '-0.015em' }}>
            Make sure you're the one they hear from first.
          </p>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Sans body — weights 400, 500, 600</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[400, 500, 600].map(w => (
              <div key={w} style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', width: 30, flexShrink: 0 }}>{w}</span>
                <p style={{ margin: 0, fontFamily: 'var(--sans)', fontSize: 16, fontWeight: w, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                  Premium home improvement businesses don't need more cold leads.
                </p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Mono label / timestamp</div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.04em' }}>10:15 AM</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.04em' }}>inquired 7 mo. ago</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute-2)', letterSpacing: '0.04em' }}>Geist Mono · 11px · 0.04em tracked</span>
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Eyebrow (mono, all-caps, 0.2em tracked)</div>
          <span className="eyebrow">Premium home improvement · 11px · 0.2em · uppercase</span>
        </div>
        <div className="neu-inset" style={{ borderRadius: 10, padding: '18px 20px' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Clamp scale reference</div>
          <p style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--mute)', lineHeight: 1.8, letterSpacing: '0.01em' }}>
            h1 · clamp(48px, 5.5vw, 80px)<br />
            h2 · clamp(40px, 4vw, 60px)<br />
            subhead · clamp(22px, 2.4vw, 32px)<br />
            body-lg · 17–19px · body-sm · 14.5–15.5px · captions · 10–12px
          </p>
        </div>
      </div>
    </Section>
  );
}

function ShadowsSection() {
  const rows = ['Raised', 'Inset', 'Polished'];
  const cols = ['Crisp', 'Medium', 'Large'];
  const clsMap = {
    Raised:   { Crisp: 'neu-raised-crisp',   Medium: 'neu-raised',   Large: 'neu-raised-large' },
    Inset:    { Crisp: 'neu-inset-crisp',    Medium: 'neu-inset',    Large: 'neu-inset-large' },
    Polished: { Crisp: 'neu-polished-crisp', Medium: 'neu-polished', Large: 'neu-polished-large' },
  };
  return (
    <Section id="shadows" label="Shadows — 12 Variants">
      <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 1fr', gap: 24, alignItems: 'center' }}>
        <div />
        {cols.map(c => (
          <div key={c} className="eyebrow" style={{ textAlign: 'center' }}>{c}</div>
        ))}
        {rows.map(row => (
          <React.Fragment key={row}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span className="eyebrow" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', textAlign: 'center' }}>{row}</span>
            </div>
            {cols.map(col => {
              const cls = clsMap[row][col];
              return (
                <div key={col} className={cls} style={{
                  borderRadius: 10, padding: '28px 16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, minHeight: 110
                }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>
                    .{cls}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <p style={{ margin: '20px 0 0', fontSize: 13, color: 'var(--mute)', fontFamily: 'var(--sans)' }}>
        Move the light angle and depth sliders in the Tweaks panel — all 12 cards react in real time.
      </p>
    </Section>
  );
}

function ButtonsSection() {
  return (
    <Section id="buttons" label="Buttons">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        {[
          { cls: 'btn-neu',           label: '.btn-neu — neumorphic raised' },
          { cls: 'btn-neu btn-wine',  label: '.btn-wine — dark wine gradient' },
          { cls: 'btn-neu btn-ghost', label: '.btn-ghost — borderline ghost' },
        ].map(({ cls, label }) => (
          <div key={label}>
            <div className="eyebrow" style={{ marginBottom: 18 }}>{label}</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className={cls}>Rest state</button>
              <button className={cls}>With icon <ArrowSm /></button>
              <button className={cls} disabled style={{ opacity: 0.4, cursor: 'not-allowed' }}>Disabled</button>
            </div>
          </div>
        ))}
        <p style={{ margin: 0, fontSize: 13, color: 'var(--mute)', fontFamily: 'var(--sans)', fontStyle: 'italic' }}>
          Hover and click each button to see polished and inset active states — driven by the depth scale.
        </p>
      </div>
    </Section>
  );
}

function InputsSection() {
  const [errVal, setErrVal] = React.useState('bad@example');
  return (
    <Section id="inputs" label="Inputs & Form Elements">
      <Sub label=".neu-input — light surface (rest, focused, error)">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Rest</div>
            <input className="neu-input" placeholder="Your first name…" style={{ borderRadius: 8 }} readOnly />
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Focused</div>
            <input className="neu-input" defaultValue="Kitchen renovation" style={{ borderRadius: 8, outline: '2px solid var(--wine)', outlineOffset: 2 }} readOnly />
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Error</div>
            <input className="neu-input" value={errVal} onChange={e => setErrVal(e.target.value)} style={{ borderRadius: 8, outline: '2px solid #B91C1C', outlineOffset: 2 }} />
            <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 6, fontFamily: 'var(--sans)' }}>Please enter a valid email address</div>
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Textarea variant</div>
          <textarea className="neu-input" rows={3} placeholder="Tell us about your project…" style={{ borderRadius: 8, resize: 'vertical', display: 'block' }} readOnly />
        </div>
      </Sub>

      <Sub label="Dark / CTA variants — shown on dark surface, used in footer">
        <div style={{ background: 'linear-gradient(145deg, #1A150F, #0F0B07)', borderRadius: 12, padding: '28px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
            {[
              { label: 'Rest',    focusRing: false, err: false },
              { label: 'Focused', focusRing: true,  err: false },
              { label: 'Error',   focusRing: false,  err: true },
            ].map(({ label, focusRing, err }) => (
              <div key={label}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(244,239,227,0.45)', marginBottom: 10 }}>{label}</div>
                <input readOnly
                  style={{
                    width: '100%', border: 'none', borderRadius: 8,
                    padding: '14px 18px', fontFamily: 'var(--sans)', fontSize: 14,
                    background: 'rgba(255,255,255,0.06)', color: 'rgba(244,239,227,0.92)',
                    boxShadow: err
                      ? 'inset 0 0 0 1px #B91C1C'
                      : focusRing
                        ? 'inset 0 0 0 1px rgba(94,34,48,0.8), 0 0 0 3px rgba(94,34,48,0.15)'
                        : 'inset 0 1px 3px rgba(0,0,0,0.35)',
                    outline: 'none'
                  }}
                  placeholder="First name…"
                />
                {err && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 6, fontFamily: 'var(--sans)' }}>Required field</div>}
              </div>
            ))}
          </div>
        </div>
      </Sub>
    </Section>
  );
}

function AuditControlsSection() {
  const [leads, setLeads]   = React.useState(5000);
  const [deal, setDeal]     = React.useState(8000);
  const [margin, setMargin] = React.useState(60);
  const [tabMode, setTabMode]     = React.useState('basic');
  const [togOn, setTogOn]         = React.useState(true);
  const [togOff, setTogOff]       = React.useState(false);

  function sliderPct(v, mn, mx) {
    return (((Math.min(Math.max(v, mn), mx) - mn) / (mx - mn)) * 100).toFixed(1) + '%';
  }

  return (
    <Section id="audit-controls" label="Audit Controls">
      <div className="eyebrow" style={{ marginBottom: 24 }}>
        Custom sliders, tab toggle, and On/Off toggle from the Revenue Audit Calculator (audit.jsx)
      </div>

      <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* AuditSlider */}
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>AuditSlider — large slider with click-to-type value</div>
          <div className="audit-pressed" style={{ borderRadius: 16, padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Leads slider */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--mute)', fontWeight: 500 }}>Leads in pipeline</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 24, color: 'var(--ink)', fontWeight: 700, letterSpacing: '-0.02em' }}>{leads.toLocaleString()}</span>
              </div>
              <input type="range" className="audit-slider" min={500} max={50000} step={500} value={leads}
                onChange={e => setLeads(Number(e.target.value))}
                style={{ '--pct': sliderPct(leads, 500, 50000) }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>500</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>50,000</span>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--line)', margin: '8px 0' }} />
            {/* Deal slider */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--mute)', fontWeight: 500 }}>Avg deal value €</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 24, color: 'var(--ink)', fontWeight: 700, letterSpacing: '-0.02em' }}>€{deal.toLocaleString()}</span>
              </div>
              <input type="range" className="audit-slider" min={500} max={50000} step={500} value={deal}
                onChange={e => setDeal(Number(e.target.value))}
                style={{ '--pct': sliderPct(deal, 500, 50000) }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>500</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>50,000</span>
              </div>
            </div>
            {/* AdvSlider */}
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--mute)' }}>Gross margin (AdvSlider)</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{margin}%</span>
              </div>
              <input type="range" className="audit-slider" min={10} max={100} step={5} value={margin}
                onChange={e => setMargin(Number(e.target.value))}
                style={{ '--pct': sliderPct(margin, 10, 100) }} />
            </div>
          </div>
        </div>

        {/* Tab toggle + NeuToggle + MetricBar */}
        <div style={{ flex: '1 1 240px', minWidth: 220, display: 'flex', flexDirection: 'column', gap: 36 }}>

          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Mode tab toggle — Basic / Advanced</div>
            <div className="mode-toggle-wrap">
              {['basic', 'advanced'].map(m => (
                <button key={m} onClick={() => setTabMode(m)} className={'mode-toggle-btn' + (tabMode === m ? ' active' : '')}>
                  {m === 'basic' ? 'Basic' : 'Advanced'}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.08em' }}>
              Active: <span style={{ color: 'var(--wine)' }}>{tabMode}</span>
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>NeuToggle — On/Off pill switch</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>Recurring deal</span>
                <div className="neu-toggle">
                  {[false, true].map(opt => (
                    <button key={String(opt)} onClick={() => setTogOn(opt)}
                      className={'neu-toggle-btn' + (togOn === opt ? ' neu-toggle-on' : '')}>
                      {opt ? 'On' : 'Off'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>Show as profit</span>
                <div className="neu-toggle">
                  {[false, true].map(opt => (
                    <button key={String(opt)} onClick={() => setTogOff(opt)}
                      className={'neu-toggle-btn' + (togOff === opt ? ' neu-toggle-on' : '')}>
                      {opt ? 'On' : 'Off'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>MetricBar — progress bar</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[{ label: 'Total leads', pct: 100 }, { label: 'Responded', pct: 50 }, { label: 'Qualified', pct: 15 }, { label: 'Closed', pct: 6 }].map(m => (
                <div key={m.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--mute)', fontWeight: 500 }}>{m.label}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', fontWeight: 700 }}>{m.pct}%</span>
                  </div>
                  <div className="audit-bar-track">
                    <div className="audit-bar-fill" style={{ width: m.pct + '%', background: 'linear-gradient(90deg, var(--wine-soft), var(--wine))' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </Section>
  );
}

function GlassSection() {
  return (
    <Section id="glass" label="Glass Panels">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>.glass</div>
          <div className="glass" style={{ borderRadius: 12, padding: '28px 28px' }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Kitchen remodel</div>
            <h3 className="serif" style={{ margin: '0 0 12px', fontSize: 26, color: 'var(--ink)', lineHeight: 1.15 }}>
              Sarah Mitchell
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--mute)', lineHeight: 1.6 }}>
              Lead engaged 7 months after initial quote. Showroom visit booked.
            </p>
          </div>
          <p style={{ margin: '12px 0 0', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>
            55% opacity · blur 22px · saturate 160%
          </p>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>.glass-strong</div>
          <div className="glass-strong" style={{ borderRadius: 12, padding: '28px 28px' }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Flooring restoration</div>
            <h3 className="serif" style={{ margin: '0 0 12px', fontSize: 26, color: 'var(--ink)', lineHeight: 1.15 }}>
              Caroline Hirst
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--mute)', lineHeight: 1.6 }}>
              Century-old oak restored. Studio visit booked for both husband and wife.
            </p>
          </div>
          <p style={{ margin: '12px 0 0', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>
            75% opacity · blur 28px · saturate 160%
          </p>
        </div>
      </div>
    </Section>
  );
}

function CardsSection() {
  const lightCards = [
    { cls: 'neu-raised-large',   label: '.neu-raised-large',   icon: <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8h20v16H6z" /><path d="M10 12h12M10 16h8M10 20h5" /></svg> },
    { cls: 'neu-polished-large', label: '.neu-polished-large', icon: <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="16" cy="12" r="4" /><path d="M8 26c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg> },
    { cls: 'neu-polished',       label: '.neu-polished',       icon: <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16C6 10.5 10.5 6 16 6s10 4.5 10 10" /><path d="M16 6v4M6 16h4M22 16h4" /></svg> },
  ];
  const darkCards = [
    { cls: 'tex-wood',  label: '.tex-wood',  blendMode: 'overlay',   opacity: 0.55 },
    { cls: 'tex-stone', label: '.tex-stone', blendMode: 'multiply',  opacity: 0.22 },
    { cls: 'tex-rock',  label: '.tex-rock',  blendMode: 'multiply',  opacity: 0.35 },
  ];
  return (
    <Section id="cards" label="Cards">
      <Sub label="Light surface cards (raised, polished)">
        <Grid cols={3} gap={22}>
          {lightCards.map(({ cls, label, icon }) => (
            <div key={cls} className={cls} style={{ borderRadius: 12, padding: '26px 22px' }}>
              <div style={{ color: 'var(--wine)', marginBottom: 14, opacity: 0.7 }}>{icon}</div>
              <div className="eyebrow" style={{ marginBottom: 8, fontSize: 9 }}>{label}</div>
              <h3 className="serif" style={{ margin: '0 0 10px', fontSize: 21, lineHeight: 1.15, color: 'var(--ink)' }}>Voice calibration</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--mute)' }}>
                Every re-engagement is drafted in your business's voice, reviewed by Finn, then sent under your domain.
              </p>
            </div>
          ))}
        </Grid>
      </Sub>

      <Sub label="Dark textured cards — Process section (multiply blend on dark surface)">
        <div style={{ background: 'linear-gradient(145deg, #1A150F, #0F0B07)', borderRadius: 12, padding: '28px 24px' }}>
          <Grid cols={3} gap={18}>
            {darkCards.map(({ cls, label, blendMode, opacity }) => (
              <div key={cls} className={cls} style={{
                borderRadius: 10, padding: '22px 18px',
                background: 'rgba(18,13,8,0.85)',
                boxShadow: '0 4px 24px rgba(20,14,6,0.38), 0 1px 0 rgba(255,245,220,0.12) inset',
                minHeight: 130
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: 'rgba(244,239,227,0.85)', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'rgba(244,239,227,0.38)', lineHeight: 1.7, letterSpacing: '0.04em' }}>
                  blend-mode: {blendMode}<br />
                  opacity: {opacity}
                </div>
              </div>
            ))}
          </Grid>
        </div>
      </Sub>
    </Section>
  );
}

function ChatSection() {
  const thread = [
    { from: 'firm', time: '10:15 AM', text: 'Hi, James from Pembrook Studio here. Are you the same Sarah who was looking at a full kitchen remodel with us back in autumn?' },
    { system: 'Lead engaged' },
    { from: 'lead', time: '10:22 AM', text: "yes that's me" },
    { from: 'firm', time: '10:23 AM', text: "Thanks for coming back. We hadn't heard from you in a while and didn't want to chase." },
    { from: 'lead', time: '10:31 AM', text: "It is, actually. We've been looking around a bit more since then." },
    { system: 'Competitive situation surfaced' },
    { from: 'firm', time: '10:46 AM', text: "I appreciate you being upfront about that. Is it mainly a price comparison, or something in the design that's making it a harder call?" },
    { from: 'lead', time: '10:57 AM', text: "The other firm said they could start in six weeks. That appealed to us." },
    { system: 'Showroom visit booked', wine: true },
  ];

  return (
    <Section id="chat" label="Chat Components">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Full thread sample</div>
          <div className="glass-strong" style={{ borderRadius: 10, padding: '20px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--line)' }}>
              <div className="neu-polished-crisp" style={{ width: 36, height: 36, borderRadius: 999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--ink)', fontStyle: 'italic' }}>S</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Sarah Mitchell</div>
                <div style={{ fontSize: 10, color: 'var(--mute)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>Full kitchen remodel · 7 mo. ago</div>
              </div>
            </div>
            {thread.map((m, i) => {
              if (m.system) return <Divider key={i} label={m.system} tone={m.wine ? 'wine' : null} />;
              return <Msg key={i} from={m.from} time={m.time}>{m.text}</Msg>;
            })}
            <TypingBubble dir="firm" />
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Component reference</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="neu-raised" style={{ borderRadius: 10, padding: '16px 18px' }}>
              <div className="eyebrow" style={{ marginBottom: 8, fontSize: 9 }}>Outbound bubble (firm)</div>
              <Msg from="firm" time="10:15 AM">Dark bg, paper text. Dark gradient with drop shadow.</Msg>
            </div>
            <div className="neu-raised" style={{ borderRadius: 10, padding: '16px 18px' }}>
              <div className="eyebrow" style={{ marginBottom: 8, fontSize: 9 }}>Inbound bubble (lead)</div>
              <Msg from="lead" time="10:22 AM">Light surface. Uses sh-inset-crisp box shadow.</Msg>
            </div>
            <div className="neu-raised" style={{ borderRadius: 10, padding: '16px 18px' }}>
              <div className="eyebrow" style={{ marginBottom: 8, fontSize: 9 }}>Typing indicator (both directions)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <TypingBubble dir="firm" />
                <TypingBubble dir="lead" />
              </div>
            </div>
            <div className="neu-raised" style={{ borderRadius: 10, padding: '16px 18px' }}>
              <div className="eyebrow" style={{ marginBottom: 8, fontSize: 9 }}>System dividers</div>
              <Divider label="Lead engaged" />
              <Divider label="Studio visit booked" tone="wine" />
            </div>
            <div className="neu-raised" style={{ borderRadius: 10, padding: '16px 18px' }}>
              <div className="eyebrow" style={{ marginBottom: 8, fontSize: 9 }}>Read receipt</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                <CheckCheckIcon />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.04em' }}>10:26 AM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function ChipsSection() {
  return (
    <Section id="chips" label="Chips & Badges">
      <Grid cols={4} gap={20}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Stat chip</div>
          <div className="neu-polished" style={{ padding: '20px 22px', borderRadius: 8, display: 'inline-block' }}>
            <div className="serif" style={{ fontSize: 38, lineHeight: 1, color: 'var(--ink)' }}>94%</div>
            <div style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--mute)', marginTop: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              reply rate<br />avg. across clients
            </div>
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Status badge ("Live")</div>
          <div className="neu-raised-crisp" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '8px 16px 8px 12px', borderRadius: 6,
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)',
            letterSpacing: '0.12em', textTransform: 'uppercase'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--wine)', flexShrink: 0, boxShadow: '0 0 0 4px var(--wine-glow)' }} />
            Live
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Niche category pill</div>
          <div className="neu-raised-crisp" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 6 }}>
            <span style={{ color: 'var(--wine)', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{DS_NICHE_ICONS.kitchen}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Kitchen</span>
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Eyebrow pill</div>
          <div className="neu-polished-crisp" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 6 }}>
            <span className="eyebrow" style={{ fontSize: 10 }}>Premium home improvement</span>
          </div>
        </div>
      </Grid>
    </Section>
  );
}

function TexturesSection() {
  const tiles = [
    { cls: 'tex-wood',  label: '.tex-wood',  blendMode: 'overlay',  opacity: 0.55 },
    { cls: 'tex-stone', label: '.tex-stone', blendMode: 'multiply', opacity: 0.22 },
    { cls: 'tex-rock',  label: '.tex-rock',  blendMode: 'multiply', opacity: 0.35 },
  ];
  return (
    <Section id="textures" label="Texture Materials">
      <div style={{ background: 'linear-gradient(145deg, #1A150F, #0F0B07)', borderRadius: 14, padding: '32px 28px' }}>
        <div className="eyebrow" style={{ marginBottom: 24, color: 'rgba(244,239,227,0.4)' }}>
          Shown on dark raised surface — matches Process card context
        </div>
        <Grid cols={3} gap={20}>
          {tiles.map(({ cls, label, blendMode, opacity }) => (
            <div key={cls} className={cls} style={{
              borderRadius: 10, padding: '28px 20px',
              background: 'rgba(18,13,8,0.85)',
              boxShadow: '0 4px 24px rgba(20,14,6,0.38), 0 1px 0 rgba(255,245,220,0.12) inset',
              minHeight: 150
            }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'rgba(244,239,227,0.88)', letterSpacing: '0.06em', marginBottom: 12 }}>{label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(244,239,227,0.38)', lineHeight: 1.75, letterSpacing: '0.04em' }}>
                background-image: url(…)<br />
                background-size: cover<br />
                mix-blend-mode: {blendMode}<br />
                opacity: {opacity}
              </div>
            </div>
          ))}
        </Grid>
      </div>
    </Section>
  );
}

function NicheSwitcherSection() {
  const [niche, setNiche] = React.useState('kitchen');
  return (
    <Section id="niche-switcher" label="Niche Switcher">
      <div className="eyebrow" style={{ marginBottom: 16 }}>5-icon pill grid from hero.jsx — active/inactive states + selection transition</div>
      <div style={{ maxWidth: 460 }}>
        <NicheSwitch value={niche} onChange={setNiche} />
        <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.08em' }}>
          Active: <span style={{ color: 'var(--wine)' }}>{niche}</span> — click any pill to switch
        </div>
      </div>

      <Sub label="Active vs inactive state reference">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div className="neu-polished-crisp" style={{ borderRadius: 7, padding: '10px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--wine)' }}>{DS_NICHE_ICONS.kitchen}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink)' }}>Kitchen</span>
            </div>
            <span className="eyebrow" style={{ fontSize: 9 }}>active</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{ borderRadius: 7, padding: '10px 18px', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--mute)' }}>{DS_NICHE_ICONS.flooring}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>Flooring</span>
            </div>
            <span className="eyebrow" style={{ fontSize: 9 }}>inactive</span>
          </div>
        </div>
      </Sub>
    </Section>
  );
}

function AnimationsSection() {
  const [showing, setShowing] = React.useState(false);
  const [key, setKey] = React.useState(0);
  const trigger = () => {
    setShowing(false);
    setKey(k => k + 1);
    requestAnimationFrame(() => requestAnimationFrame(() => setShowing(true)));
  };

  return (
    <Section id="animations" label="Animations">
      <Grid cols={3} gap={28}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Float — 7s ease-in-out loop</div>
          <div className="neu-polished-large floaty" style={{ borderRadius: 10, padding: '20px 18px', maxWidth: 210 }}>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>Editor's note</div>
            <p className="serif italic" style={{ margin: 0, fontSize: 15, lineHeight: 1.35, color: 'var(--ink)' }}>
              Every message is drafted in your voice, then sent under your domain.
            </p>
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Fade-slide-in — click to trigger</div>
          <button onClick={trigger} className="btn-neu" style={{ marginBottom: 16, fontSize: 12 }}>
            Trigger
          </button>
          {showing && (
            <div key={key} style={{ animation: 'fadeSlideIn 320ms ease forwards' }}>
              <div className="neu-raised" style={{ borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                  Faded in at {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>FAQ accordion — click to expand</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FAQRow
              q="Won't homeowners be annoyed?"
              a="Only if it sounds like a sales blast, and it won't. Every message picks up where the original thread left off: their project, their room, their last question."
              initial={true}
            />
            <FAQRow
              q="What if it doesn't sound like us?"
              a="Nothing leaves the studio without your written approval. We study your past correspondence and refine until it sounds like you wrote it."
            />
          </div>
        </div>
      </Grid>
    </Section>
  );
}

const DS_ICONS = [
  { name: 'ArrowSm',    el: <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M9 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { name: 'CheckCheck', el: <svg width="14" height="9" viewBox="0 0 14 9" fill="none"><path d="M1 4.5l3 3L9 1" stroke="#7BA8E8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 4.5l3 3 5-7" stroke="#7BA8E8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { name: 'WhatsApp',   el: <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.4 2.93.6 4.43.6h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01C16.84 3.03 14.55 2 12.04 2zm4.27 13.07l-.22.62c-.25.71-1.48 1.37-2.04 1.4-.55.03-1.07.22-3.59-.74-3.01-1.15-4.93-4.24-5.08-4.44-.14-.2-1.22-1.62-1.22-3.09 0-1.48.77-2.2 1.05-2.5.27-.3.59-.37.79-.37l.57.01c.18 0 .43-.07.67.51l.86 2.08c.07.18.03.38-.1.54l-.25.32c-.14.18-.29.37-.12.67.16.3.73 1.22 1.57 1.97 1.08.97 1.99 1.27 2.3 1.42.3.14.48.12.66-.07l.48-.58c.18-.22.35-.15.58-.09l1.82.86c.22.1.37.15.42.24.06.09.06.53-.19 1.04z"/></svg> },
  { name: 'Kitchen',    el: DS_NICHE_ICONS.kitchen },
  { name: 'Flooring',   el: DS_NICHE_ICONS.flooring },
  { name: 'Wellness',   el: DS_NICHE_ICONS.wellness },
  { name: 'Garden',     el: DS_NICHE_ICONS.landscaping },
  { name: 'Roofing',    el: DS_NICHE_ICONS.roofing },
  { name: 'Archive',    el: <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8h20v16H6z" /><path d="M10 12h12M10 16h8M10 20h5" /></svg> },
  { name: 'Voice',      el: <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /><circle cx="16" cy="12" r="4" /></svg> },
  { name: 'Signal',     el: <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16C6 10.5 10.5 6 16 6s10 4.5 10 10" /><path d="M16 6v4M6 16h4M22 16h4" /></svg> },
  { name: 'Globe',      el: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 3c-4 6-4 12 0 18M12 3c4 6 4 12 0 18M3 12h18" /></svg> },
];

function IconsSection() {
  return (
    <Section id="icons" label="Icons">
      <div className="eyebrow" style={{ marginBottom: 24 }}>All SVG icons currently in use across the premium site</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        {DS_ICONS.map(({ name, el }) => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 72 }}>
            <div className="neu-raised-crisp" style={{
              width: 52, height: 52, borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ink)'
            }}>{el}</div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1.4 }}>{name}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── TOC sidebar ─────────────────────────────────────────────────────────────

function TOCSidebar({ active }) {
  return (
    <nav style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: 196,
      padding: '72px 0 24px 20px',
      overflowY: 'auto', scrollbarWidth: 'none',
      background: 'var(--bg)',
      borderRight: '1px solid var(--line)',
      zIndex: 20
    }}>
      <div className="eyebrow" style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--line)', paddingRight: 20, fontSize: 10 }}>
        Lead Awaker · DS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 12 }}>
        {TOC_ITEMS.map(({ id, label }) => {
          const isActive = active === id;
          return (
            <a key={id} href={`#${id}`}
              className={isActive ? 'ds-toc-link active' : 'ds-toc-link'}
              style={{ color: isActive ? 'var(--wine)' : 'var(--mute)', fontWeight: isActive ? 600 : 400 }}>
              {label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function ComponentsApp() {
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [activeSection, setActiveSection] = React.useState('colors');
  const isMobile = window.useIsMobile();

  React.useEffect(() => { applyPalette(t.palette); }, [t.palette]);
  React.useEffect(() => { applyFonts(t.displayFont); }, [t.displayFont]);
  React.useEffect(() => { applyDepth(t.depthScale); }, [t.depthScale]);
  React.useEffect(() => { applyLight(t.lightAngle, t.lightDistance, t.lightIntensity); }, [t.lightAngle, t.lightDistance, t.lightIntensity]);

  React.useEffect(() => {
    const ids = TOC_ITEMS.map(t => t.id);
    const visible = {};
    const update = () => {
      const first = ids.find(id => visible[id]);
      if (first) setActiveSection(first);
    };
    const observers = ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(([entry]) => {
        visible[id] = entry.isIntersecting;
        update();
      }, { rootMargin: '-20px 0px -60% 0px', threshold: 0 });
      obs.observe(el);
      return obs;
    }).filter(Boolean);
    return () => observers.forEach(o => o.disconnect());
  }, []);

  const { TweaksPanel, TweakSection, TweakSlider, TweakRadio } = window;

  return (
    <>
      {!isMobile && <TOCSidebar active={activeSection} />}

      <div style={{
        marginLeft: isMobile ? 0 : 196,
        padding: isMobile ? '48px 24px 80px' : '72px 72px 96px 80px',
        maxWidth: isMobile ? '100%' : 'calc(196px + 960px)'
      }}>
        {/* Page header */}
        <div style={{ marginBottom: 72 }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 14 }}>Lead Awaker</span>
          <h1 className="serif" style={{ fontSize: 'clamp(36px, 4vw, 60px)', lineHeight: 1.06, margin: '0 0 14px', color: 'var(--ink)', letterSpacing: '-0.025em' }}>
            Design System
          </h1>
          <p style={{ fontSize: 16, color: 'var(--mute)', margin: 0, lineHeight: 1.6, maxWidth: 520 }}>
            Every element used across the premium site, shown in isolation. Light angle, depth, and typeface react to the Tweaks panel.
          </p>
        </div>

        <ColorsSection />
        <TypographySection />
        <ShadowsSection />
        <ButtonsSection />
        <InputsSection />
        <AuditControlsSection />
        <GlassSection />
        <CardsSection />
        <ChatSection />
        <ChipsSection />
        <TexturesSection />
        <NicheSwitcherSection />
        <AnimationsSection />
        <IconsSection />
      </div>

      {/* Tweaks toggle button */}
      {!isMobile && (
        <button
          onClick={() => window.postMessage({ type: '__activate_edit_mode' }, '*')}
          style={{
            position: 'fixed', bottom: 24, left: 24, width: 40, height: 40,
            borderRadius: 10, border: 'none',
            background: 'rgba(94,34,48,0.9)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'all 150ms ease', backdropFilter: 'blur(8px)'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(94,34,48,1)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(94,34,48,0.9)'; e.currentTarget.style.transform = 'scale(1)'; }}
          title="Open tweaks panel"
          aria-label="Open tweaks panel"
        >⚙️</button>
      )}

      {!isMobile && (
        <TweaksPanel title="Tweaks">
          <TweakSection label="Light">
            <TweakSlider label="Angle"     value={t.lightAngle}    min={0}   max={360} step={5}    unit="°" onChange={v => setTweak('lightAngle', v)} />
            <TweakSlider label="Distance"  value={t.lightDistance} min={0}   max={100} step={5}         onChange={v => setTweak('lightDistance', v)} />
            <TweakSlider label="Intensity" value={t.lightIntensity}min={0}   max={100} step={5}         onChange={v => setTweak('lightIntensity', v)} />
          </TweakSection>
          <TweakSection label="Surface">
            <TweakSlider label="Depth" value={t.depthScale} min={0.4} max={1.8} step={0.05} unit="×" onChange={v => setTweak('depthScale', v)} />
          </TweakSection>
          <TweakSection label="Typography">
            <TweakRadio label="Display" value={t.displayFont}
              options={['Instrument Serif','Newsreader','EB Garamond','Playfair Display','Bodoni Moda','Lora','Cormorant Garamond']}
              onChange={v => setTweak('displayFont', v)} />
          </TweakSection>
        </TweaksPanel>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ComponentsApp />);
