// mobile-detail.jsx — Campaign detail for mobile: the desktop "Now & Next"
// Stats monitor reflowed into a single scrolling column, plus a compact
// Settings view. Reuses chart/metric primitives from layout-bold.jsx +
// components.jsx (PipelineDonut, PipelineBars, TrendChart, HeatStrip,
// CadenceLadder, BigMetric, NextSendCard, RecentRow, UpcomingRow, FutureRow).

// Card shell used across the detail screen
function MobCard({ children, pad = 18, style }) {
  return (
    <div className="neu-raised" style={{ padding: pad, borderRadius: 'var(--r-card)', ...style }}>
      {children}
    </div>
  );
}

function MobSectionLabel({ children, right }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
      <span className="eyebrow eyebrow-sm">{children}</span>
      {right}
    </div>
  );
}

// ─── Stats: single-column scroll ───────────────────────────────────
function MobStats() {
  const D = window.LA_DATA;
  const [tf, setTf] = React.useState('1M');
  const [aiOpen, setAiOpen] = React.useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 14px 28px' }}>

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="neu-polished" style={{ padding: 20, borderRadius: 'var(--r-panel)' }}>
        <div className="row" style={{ gap: 10, marginBottom: 14 }}>
          <StatusPill status={D.active.status} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute)', letterSpacing: '0.14em' }}>#{D.active.id} · LIVE MONITOR</span>
        </div>
        <div className="row" style={{ gap: 14, marginBottom: 18 }}>
          <div className="la-mono-tile wine" style={{ width: 48, height: 48, fontSize: 19 }}>{D.active.mono}</div>
          <div className="serif" style={{ fontSize: 30, color: 'var(--ink)', lineHeight: 1.05, letterSpacing: '-0.018em' }}>{D.active.name}</div>
        </div>

        {/* meta — 2-col grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <MetaItem label="Channel" value={<span className="row" style={{ gap: 6 }}><IconWA size={13} />{D.active.channel}</span>} />
          <MetaItem label="Daily Limit" value={D.active.dailyLimit} />
          <MetaItem label="Active Hours" value={D.active.activeHours} />
          <MetaItem label="Owner" value={D.active.ownerInit} />
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button className="btn-neu" style={{ flex: 1, padding: '13px 0' }}>Edit</button>
          <button className="btn-wine" style={{ flex: 1, padding: '13px 0', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <IconSpark size={14} />Generate
          </button>
        </div>
      </div>

      {/* ── AI Read ─────────────────────────────────────────── */}
      <MobCard pad={18}>
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--r-surface)', flexShrink: 0,
            background: 'var(--wine-grad)', boxShadow: 'var(--sh-raised-crisp)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)',
          }}><IconSpark size={17} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow wine eyebrow-sm" style={{ marginBottom: 6 }}>AI Read · This week</div>
            <div className="serif italic" style={{ fontSize: 18, lineHeight: 1.4, color: 'var(--ink-soft)' }}>“{D.aiTLDR}”</div>
          </div>
        </div>
        <button onClick={() => setAiOpen(o => !o)} style={{
          marginTop: 14, width: '100%', padding: '10px 0', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
          background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)',
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          {aiOpen ? 'Hide analysis' : 'Expand analysis'}
          <span style={{ display: 'inline-block', transform: aiOpen ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 200ms' }}><IconChev size={11} /></span>
        </button>
        {aiOpen && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {D.aiAnalysis.map((a, i) => (
              <div key={i} style={{ borderLeft: '2px solid var(--wine)', paddingLeft: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.5 }}>{a.body}</div>
              </div>
            ))}
          </div>
        )}
      </MobCard>

      {/* ── Key Metrics ─────────────────────────────────────── */}
      <MobCard pad={18}>
        <MobSectionLabel right={<TimeToggle value={tf} onChange={setTf} />}>Key Metrics</MobSectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <BigMetric label="Targeted" value="310" delta="+12 wk" tone="neutral" />
          <BigMetric label="Sent" value="298" delta="+58 wk" tone="neutral" />
          <BigMetric label="Response" value="18" suffix="%" delta="+2.1" tone="warm" />
          <BigMetric label="Booked" value="35" suffix="%" delta="+9 wk" tone="good" star />
        </div>
      </MobCard>

      {/* ── Trend ───────────────────────────────────────────── */}
      <MobCard pad={18}>
        <MobSectionLabel right={
          <div className="row" style={{ gap: 12, fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: '0.1em', color: 'var(--mute)' }}>
            <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--stage-responded)' }} />RESP</span>
            <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--wine)' }} />BOOK</span>
          </div>
        }>Performance · {tf}</MobSectionLabel>
        <TrendChart height={130} />
      </MobCard>

      {/* ── Pipeline ────────────────────────────────────────── */}
      <MobCard pad={18}>
        <MobSectionLabel>Pipeline · Conversion</MobSectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <PipelineDonut size={172} thickness={22} />
        </div>
        <PipelineBars />
      </MobCard>

      {/* ── Lead Heat ───────────────────────────────────────── */}
      <MobCard pad={18}>
        <HeatStrip heat={D.heat} />
      </MobCard>

      {/* ── NOW ─────────────────────────────────────────────── */}
      <MobCard pad={18}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <div className="eyebrow row" style={{ gap: 7 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }} className="la-pulse" />LIVE
            </div>
            <div className="serif" style={{ fontSize: 28, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1 }}>Now</div>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.1em' }}>{D.nowLabel} · AUTO</span>
        </div>
        <NextSendCard ns={D.nextSend} />
        <div className="eyebrow eyebrow-sm" style={{ margin: '18px 0 6px' }}>Just happened</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {D.recent.map((r, i) => <RecentRow key={i} r={r} />)}
        </div>
      </MobCard>

      {/* ── NEXT ────────────────────────────────────────────── */}
      <MobCard pad={18}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <div className="eyebrow row" style={{ gap: 7 }}><IconBump size={12} />UPCOMING</div>
            <div className="serif" style={{ fontSize: 28, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1 }}>Next</div>
          </div>
        </div>
        <div className="neu-inset" style={{ padding: '14px 16px', borderRadius: 'var(--r-card)', marginBottom: 18 }}>
          <div className="eyebrow eyebrow-sm" style={{ marginBottom: 12 }}>Today's bump distribution</div>
          <CadenceLadder cadence={D.followUp.cadence} />
        </div>
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 6 }}>Coming up · today</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[...D.activity].slice(0, 4).map((m, i) => <UpcomingRow key={i} m={{ ...m, kind: 'bump' }} imminent={i === 0} />)}
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <div className="eyebrow eyebrow-sm" style={{ marginBottom: 12 }}>Later this week</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {D.upNext.filter(u => u.date !== 'Today').map((u, i) => <FutureRow key={i} u={u} />)}
          </div>
        </div>
      </MobCard>

    </div>
  );
}

function MetaItem({ label, value }) {
  return (
    <div>
      <div className="eyebrow eyebrow-sm">{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ─── Settings (compact) ────────────────────────────────────────────
function MobSettings() {
  const D = window.LA_DATA.active;
  const rows = [
    ['Campaign name', D.name],
    ['Channel', D.channel],
    ['Daily limit', D.dailyLimit],
    ['Active hours', D.activeHours],
    ['Owner', D.owner],
    ['Status', 'Paused'],
  ];
  const toggles = [
    ['Auto follow-up (bumps)', true],
    ['Pause on reply', true],
    ['AI handoff for hot leads', true],
    ['Weekend sending', false],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 14px 28px' }}>
      <MobCard pad={6}>
        <div className="eyebrow eyebrow-sm" style={{ padding: '12px 14px 6px' }}>Campaign</div>
        {rows.map(([k, v], i) => (
          <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '13px 14px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'var(--mute)' }}>{k}</span>
            <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, maxWidth: '58%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
          </div>
        ))}
      </MobCard>

      <MobCard pad={6}>
        <div className="eyebrow eyebrow-sm" style={{ padding: '12px 14px 6px' }}>Automation</div>
        {toggles.map(([k, on], i) => (
          <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '12px 14px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>{k}</span>
            <MobToggle on={on} />
          </div>
        ))}
      </MobCard>

      <button className="btn-wine" style={{ padding: '15px 0', borderRadius: 'var(--r-surface)' }}>Save changes</button>
      <button style={{
        padding: '14px 0', borderRadius: 'var(--r-surface)', border: '1px solid var(--line)', cursor: 'pointer',
        background: 'transparent', color: 'var(--wine)', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>Preview client view</button>
    </div>
  );
}

function MobToggle({ on: initial }) {
  const [on, setOn] = React.useState(initial);
  return (
    <button onClick={() => setOn(o => !o)} style={{
      width: 46, height: 28, borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer', padding: 3,
      background: on ? 'var(--wine)' : 'var(--bg)',
      boxShadow: on ? 'var(--sh-raised-crisp)' : 'var(--sh-inset-crisp)',
      display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'all 180ms',
    }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: on ? 'var(--paper)' : 'var(--mute-2)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  );
}

Object.assign(window, { MobStats, MobSettings, MobCard, MobToggle });
