// Process section with animated illustrations

const ARCHIVE_ROWS_DATA = [
  { who: 'M. van Dijk',    snip: 'plattegrond Q3, twee opties', tag: 'Premium',  tone: 'hot'  },
  { who: 'T. de Boer',     snip: 're: bezichtiging dinsdag',    tag: 'Default', tone: 'warm' },
  { who: 'Fam. Janssen',   snip: 'offerte opvolging',           tag: 'Premium',  tone: 'hot'  },
  { who: 'K. Vermeer',     snip: 'oriënterend, niet urgent',    tag: 'Basic', tone: 'cool' },
  { who: 'Sandra Visser',  snip: 'tweede bezoek mogelijk',      tag: 'Default', tone: 'warm' },
  { who: 'Van Rooijen',    snip: 'wanneer jullie klaar zijn',   tag: 'Premium',  tone: 'hot'  },
];
const PILL_COLORS = {
  hot:  { bg: 'rgba(179,74,44,.12)',  color: '#a3401f' },
  warm: { bg: 'rgba(146,98,40,.13)',  color: '#7d5524' },
  cool: { bg: 'rgba(122, 116, 90, 0.18)', color: '#a19363' },
};

function ArchiveScanIllus({ active = false }) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!active) { setN(0); return; }
    const TAG_INTERVAL = 2000;
    const HOLD = 15000;
    const CYCLE = ARCHIVE_ROWS_DATA.length * TAG_INTERVAL + HOLD;
    let raf, start = null;
    function tick(ts) {
      if (!start) start = ts;
      const elapsed = (ts - start) % CYCLE;
      const count = elapsed < ARCHIVE_ROWS_DATA.length * TAG_INTERVAL
        ? Math.min(ARCHIVE_ROWS_DATA.length, Math.floor(elapsed / TAG_INTERVAL) + 1)
        : ARCHIVE_ROWS_DATA.length;
      setN(count);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const illus = { padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' };
  const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--mute)', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '1px dashed rgba(90,30,41,.15)', flexShrink: 0 };

  return (
    <div style={illus}>
      <div style={header}><span>archive.scan</span><span>437 contacten</span></div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginTop: 4 }}>
        {ARCHIVE_ROWS_DATA.map((r, i) => {
          const tagged = i < n;
          const pc = PILL_COLORS[r.tone];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)', fontSize: 11, padding: '6px 0', borderBottom: i < ARCHIVE_ROWS_DATA.length - 1 ? '1px solid rgba(90,30,41,.15)' : 'none', opacity: tagged ? 1 : 0.45, transition: 'opacity 0.5s ease' }}>
              <div style={{ width: 12, height: 12, flexShrink: 0, borderRadius: 2, border: `1.2px solid ${tagged ? 'var(--wine)' : 'var(--mute)'}`, background: tagged ? 'var(--wine)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.35s ease' }}>
                {tagged && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5,4.2 L3.3,6 L6.8,2" fill="none" stroke="#f6efde" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span style={{ width: 100, color: tagged ? 'var(--ink)' : 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: tagged ? 500 : 400, transition: 'color 0.4s ease' }}>{r.who}</span>
              <span style={{ flex: 1, color: tagged ? 'rgba(92,70,46,0.8)' : 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.4s ease' }}>{r.snip}</span>
              <span style={{ width: 54, display: 'flex', justifyContent: 'flex-end', opacity: tagged ? 1 : 0, transform: tagged ? 'translateX(0)' : 'translateX(4px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em', padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase', background: pc.bg, color: pc.color }}>{r.tag}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed rgba(90,30,41,.15)', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink)', flexShrink: 0 }}>
        <span>gerangschikt {n} van 437</span>
        <div style={{ flex: 1, height: 3, background: 'rgba(90,30,41,.12)', borderRadius: 99, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--wine)', borderRadius: 99, width: `${(n / ARCHIVE_ROWS_DATA.length) * 36}%`, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--wine)', animation: active ? 'processTick 1.6s ease-in-out infinite' : 'none', flexShrink: 0 }} />
      </div>
    </div>
  );
}

function ABVariantsIllus({ active = false }) {
  const [loopKey, setLoopKey] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [winnerRevealed, setWinnerRevealed] = React.useState(false);

  const ROWS = [
    { letter: 'A', msg: '"even inchecken over de plattegrond"', target: 12, winner: false, path: 'M0,11 L6.2,10.5 L12.4,11 L18.7,9.5 L24.9,10.5 L31.1,8.5 L37.3,9.5 L43.6,10.5 L49.8,9.5 L56,8.5' },
    { letter: 'B', msg: '"dinsdag slot nog vrij?"',            target: 9, winner: true,  path: 'M0,11 L6.2,9.8 L12.4,8 L18.7,6 L24.9,4 L31.1,3 L37.3,1.8 L43.6,1.2 L49.8,0.8 L56,0.4' },
    { letter: 'C', msg: '"jouw notitie gezien, twee ideeën"',  target: 19, winner: false, path: 'M0,10.5 L6.2,9.5 L12.4,8.5 L18.7,9.5 L24.9,7.5 L31.1,6 L37.3,7 L43.6,5 L49.8,5 L56,4.5' },
  ];

  React.useEffect(() => {
    if (!active) return;
    setProgress(0);
    setWinnerRevealed(false);
    const COUNT_DUR = 1760;
    const WINNER_AT = COUNT_DUR + 300;
    const HOLD = 15000;
    let raf, start = null;

    const t1 = setTimeout(() => setWinnerRevealed(true), WINNER_AT);
    const t2 = setTimeout(() => setLoopKey(k => k + 1), WINNER_AT + HOLD);

    function tick(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;
      const p = Math.min(elapsed / COUNT_DUR, 1);
      const eased = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
      setProgress(eased);
      if (elapsed < COUNT_DUR) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
  }, [loopKey, active]);

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        @keyframes abDrawLine { from { stroke-dashoffset: 100 } to { stroke-dashoffset: 0 } }
        @keyframes starPop { 0%{opacity:0;transform:scale(0) rotate(-20deg)} 65%{transform:scale(1.35) rotate(4deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 44px 60px 22px', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--mute)', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '1px dashed rgba(90,30,41,.15)', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span>v</span><span>bericht</span><span style={{ textAlign: 'right' }}>reactie</span><span>trend</span><span></span>
      </div>
      <div key={loopKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
        {ROWS.map((r, i) => {
          const isWinner = r.winner && winnerRevealed;
          const count = Math.round(r.target * progress);
          return (
            <div key={r.letter} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 44px 60px 22px', alignItems: 'center', gap: 8, padding: isWinner ? '11px 8px' : '11px 0', margin: isWinner ? '0 -8px' : '0', borderBottom: r.letter !== 'C' ? '1px solid rgba(90,30,41,.15)' : 'none', borderRadius: isWinner ? 4 : 0, background: isWinner ? 'rgba(90,30,41,0.06)' : 'transparent', transition: 'background 0.45s ease, padding 0.3s ease' }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', color: isWinner ? 'var(--wine)' : 'var(--mute)', transition: 'color 0.4s ease' }}>{r.letter}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'rgba(92,70,46,0.8)', lineHeight: 1.4 }}>{r.msg}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'right', color: isWinner ? 'var(--wine)' : 'var(--mute)', fontWeight: isWinner ? 600 : 400, transition: 'color 0.4s ease, font-weight 0.2s' }}>{count}%</span>
              <svg viewBox="0 0 56 14" width="60" height="14">
                <path
                  d={r.path}
                  fill="none"
                  stroke={isWinner ? 'var(--wine)' : 'var(--mute)'}
                  strokeWidth={isWinner ? 1.5 : 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="100"
                  style={{ animation: active ? `abDrawLine 1.5s ease-out ${i * 130}ms both` : 'none', transition: 'stroke 0.4s ease, stroke-width 0.3s ease' }}
                />
              </svg>
              <span style={{ textAlign: 'right', color: 'var(--wine)', display: 'inline-block', animation: isWinner ? 'starPop 0.45s ease-out both' : 'none' }}>{isWinner ? '★' : ''}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed rgba(90,30,41,.15)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span>variant <span style={{ fontFamily: 'var(--serif)', color: 'var(--wine)', fontStyle: 'italic' }}>B</span> versterkt</span>
        <span style={{ transition: 'opacity 0.5s ease', opacity: winnerRevealed ? 1 : 0.3 }}>+153 verzonden</span>
      </div>
    </div>
  );
}

function WeekCalendarIllus({ active = false }) {
  const [loopKey, setLoopKey] = React.useState(0);
  const [revealed, setRevealed] = React.useState(new Set());
  const [checked, setChecked] = React.useState(new Set());

  const days = ['M', 'T', 'W', 'T', 'F'];
  const todayIdx = 1;
  const times = ['09', '10', '11', '14', '15', '16'];
  const SLOTS = [
    ['', '', 'b', '', ''],
    ['', 'b', '', '', 'h'],
    ['', '', '', 'b', ''],
    ['', '', 'b', '', ''],
    ['', '', '', 'b', ''],
    ['', 'h', '', '', ''],
  ];

  const sequence = [];
  SLOTS.forEach((row, ri) => row.forEach((s, ci) => { if (s) sequence.push({ ri, ci, type: s }); }));

  React.useEffect(() => {
    if (!active) return;
    setRevealed(new Set());
    setChecked(new Set());
    const SLOT_INTERVAL = 420;
    const HOLD = 15000;
    const timers = [];
    sequence.forEach(({ ri, ci, type }, i) => {
      const key = `${ri}-${ci}`;
      timers.push(setTimeout(() => setRevealed(prev => new Set([...prev, key])), 400 + i * SLOT_INTERVAL));
      if (type === 'b') {
        timers.push(setTimeout(() => setChecked(prev => new Set([...prev, key])), 400 + i * SLOT_INTERVAL + 320));
      }
    });
    const animDur = 400 + sequence.length * SLOT_INTERVAL;
    timers.push(setTimeout(() => setLoopKey(k => k + 1), animDur + HOLD));
    return () => timers.forEach(clearTimeout);
  }, [loopKey, active]);

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        @keyframes slotPop { 0%{opacity:0;transform:scale(0.5)} 70%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
        @keyframes checkFade { from{opacity:0;transform:scale(0.4)} to{opacity:1;transform:scale(1)} }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--mute)', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '1px dashed rgba(90,30,41,.15)', flexShrink: 0 }}>
        <span>week van 18 mei</span><span>3 gepland · 2 in behandeling</span>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '24px repeat(5, 1fr)', gridTemplateRows: 'auto repeat(6, 1fr)', gap: 5, marginTop: 10, alignContent: 'stretch' }}>
        <div />
        {days.map((d, i) => (
          <div key={i} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: i === todayIdx ? 'var(--wine)' : 'var(--mute)', textAlign: 'center', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
        ))}
        {times.map((tm, ri) => (
          <React.Fragment key={ri}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>{tm}</div>
            {SLOTS[ri].map((s, ci) => {
              const key = `${ri}-${ci}`;
              const isRevealed = revealed.has(key);
              const isChecked = checked.has(key);
              return (
                <div key={ci} style={{ borderRadius: 3, background: s === 'b' ? 'var(--wine)' : s === 'h' ? 'rgba(90,30,41,0.18)' : 'rgba(90,30,41,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !s ? 1 : isRevealed ? 1 : 0, animation: isRevealed && s ? 'slotPop 0.35s ease-out both' : 'none' }}>
                  {s === 'b' && isChecked && (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: '#f6efde', letterSpacing: '0.1em', animation: 'checkFade 0.25s ease-out both' }}>✓</span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px dashed rgba(90,30,41,.15)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span>volgend gesprek</span>
        <span style={{ color: 'var(--wine)' }}>Di 10:30 · Van Rooijen</span>
      </div>
    </div>
  );
}

function Process() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const steps = t('process.steps');
  const CARD_GAP = isMobile ? 16 : 24;

  const [sectionRef, sectionInView] = window.useInView();

  // Per-card IntersectionObserver: drives both the reveal animation and illustration
  const [cardRef0, cardInView0] = window.useInView({ threshold: 0.18 });
  const [cardRef1, cardInView1] = window.useInView({ threshold: 0.18 });
  const [cardRef2, cardInView2] = window.useInView({ threshold: 0.18 });
  const cardRefs   = [cardRef0,   cardRef1,   cardRef2];
  const cardInViews = [cardInView0, cardInView1, cardInView2];

  const illustrations = [
    <ArchiveScanIllus active={cardInViews[0]} />,
    <ABVariantsIllus  active={cardInViews[1]} />,
    <WeekCalendarIllus active={cardInViews[2]} />,
  ];

  return (
    <section ref={sectionRef} id="process" data-screen-label="03 Process" style={isMobile ? { ...sectionWrapMobile, padding: "12px 18px 72px" } : { ...sectionWrap, padding: "20px 48px 120px" }}>
      <style>{`@keyframes processTick { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
      <div style={{ marginBottom: isMobile ? 32 : 56 }}>
        <div className="eyebrow" style={{ marginBottom: isMobile ? 14 : 20 }}>{t('process.eyebrow')}</div>
        <h2 className="serif" style={{ margin: 0, fontSize: isMobile ? "clamp(32px, 8vw, 42px)" : "clamp(40px, 4vw, 60px)", lineHeight: 1.02, letterSpacing: "-0.02em", color: "var(--ink)" }}>
          {t('process.h2_l1')}<br />
          <span className="italic" style={{ color: "var(--wine)" }}>{t('process.h2_italic')}</span>
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: CARD_GAP }}>
        {steps.map((s, i) => (
          <div key={s.n} ref={cardRefs[i]} className="neu-raised" style={{
            padding: isMobile ? "24px 20px 20px" : "28px 30px 24px", borderRadius: 14,
            display: "flex", flexDirection: "column", minWidth: 0,
            ...window.revealStyle(cardInViews[i], { delay: isMobile ? 0 : i * 60 }),
          }}>
            <div style={{ borderBottom: '1px solid rgba(90,30,41,.15)', paddingBottom: 14, marginBottom: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <div className="serif italic" style={{ fontSize: isMobile ? 34 : 44, lineHeight: 0.95, color: 'var(--wine)', fontWeight: 500 }}>{s.time}</div>
              <h3 className="serif" style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.005em', textAlign: 'right' }}>{s.title}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--mute)', maxWidth: '94%' }}>{s.body}</p>
            </div>
            <div className="glass" style={{ height: 280, overflow: 'hidden', minWidth: 0, marginTop: 20, borderRadius: 10, padding: '14px 16px 12px', flexShrink: 0 }}>
              {illustrations[i]}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.05em', color: 'var(--mute)', display: 'flex', gap: 10, paddingTop: 18, lineHeight: 1.5, marginTop: 20 }}>
              <span>{s.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
