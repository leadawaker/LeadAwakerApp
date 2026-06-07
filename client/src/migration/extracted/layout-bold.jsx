/* Variation B — "Now & Next" monitoring dashboard
   The AI does the work; this page is for watching. It answers three
   questions at a glance:
     · Overall state of the campaign        (left column)
     · What just happened                   (right rail, top)
     · What's about to happen / get bumped   (right rail, below NOW)
   Brighter palette: white cards on a soft warm ground, wine for the
   brand/AI, emerald = booked, amber = warm / about-to-send.
*/

// ─── Time-aware metric data ────────────────────────────────────────
const METRICS_BY_TF = {
  '1D': { targeted: 22,   sent: 18,   responseRate: 16, booked: 28, dT: '+3 today', dS: '+8 today', dR: '1.2', dB: '+2 today' },
  '7D': { targeted: 310,  sent: 298,  responseRate: 18, booked: 35, dT: '+12 wk',   dS: '+58 wk',   dR: '2.1', dB: '+9 wk' },
  '1M': { targeted: 1240, sent: 1190, responseRate: 21, booked: 38, dT: '+48 mo',   dS: '+210 mo',  dR: '4.3', dB: '+14 mo' },
};
const CHART_DATA = {
  '1D': {
    resp: [10, 12, 11, 14, 13, 15, 14, 16, 15, 17, 14, 16, 17, 15, 18, 16, 17, 19, 18, 16],
    book: [1,  1,  2,  2,  2,  3,  2,  3,  3,  3,  4,  3,  4,  4,  3,  4,  4,  4,  5,  4],
    axis: ['06:00', '09:00', '12:00', '15:00'],
  },
  '7D': {
    resp: [12, 15, 14, 17, 18, 16, 19, 22, 20, 18, 21, 23, 22, 24, 26, 25, 27, 28, 30, 28],
    book: [2,  3,  3,  5,  4,  6,  5,  7,  8,  7,  9,  10, 9,  11, 12, 11, 13, 14, 13, 15],
    axis: ['MON', 'WED', 'FRI', 'SUN'],
  },
  '1M': {
    resp: [8, 10, 9, 12, 13, 11, 14, 15, 14, 16, 17, 16, 18, 19, 20, 21, 20, 22, 23, 24],
    book: [1,  2,  2,  3,  3,  4,  4,  5,  5,  6,  6,  7,  8,  9,  9, 10, 11, 12, 13, 14],
    axis: ['MAY 1', 'MAY 8', 'MAY 15', 'MAY 22'],
  },
};

function CampaignMonitor({ tab, setTab }) {
  const D = window.LA_DATA;
  const [tf, setTf] = React.useState('7D');
  const [hoveredStage, setHoveredStage] = React.useState(null);
  const [pipeWide, setPipeWide] = React.useState(false);
  const colStateRef = React.useRef(null);
  const mData = METRICS_BY_TF[tf];
  const cData = CHART_DATA[tf];

  // When the pipeline column is wide enough, float donut left of the bars
  React.useEffect(() => {
    if (!colStateRef.current) return;
    const ro = new ResizeObserver(([e]) => setPipeWide(e.contentRect.width >= 460));
    ro.observe(colStateRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>

      {/* Hero */}
      <div className="bold-hero">
        <div style={{ padding: '34px 36px 28px' }}>
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 14, marginBottom: 16 }}>
                <StatusPill status={D.active.status} />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.18em' }}>CAMPAIGN · #{D.active.id} · LIVE MONITOR</span>
              </div>
              <div className="row" style={{ gap: 20, alignItems: 'center' }}>
                <div className="la-mono-tile wine" style={{ width: 54, height: 54, fontSize: 21 }}>{D.active.mono}</div>
                <div className="serif" style={{ fontSize: 52, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.018em' }}>{D.active.name}</div>
              </div>
              <div style={{ marginTop: 24 }}><CampaignMeta /></div>
            </div>
            <div className="row" style={{ gap: 10, flexShrink: 0 }}>
              <button className="btn-neu" style={{ padding: '12px 18px' }}>Edit</button>
              <button className="btn-wine" style={{ padding: '12px 18px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <IconSpark size={14} />Generate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI TLDR — sits directly on the background, no inset */}
      <div style={{ margin: '0 36px 20px', padding: '0 4px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 30, height: 30, borderRadius: 'var(--r-surface)', background: 'var(--wine-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)', flexShrink: 0 }}>
          <IconSpark size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow wine eyebrow-sm" style={{ marginBottom: 4 }}>AI READ · THIS WEEK</div>
          <div className="serif italic" style={{ fontSize: 17, lineHeight: 1.45, color: 'var(--ink-soft)' }}>"{D.aiTLDR}"</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="bold-grid">
        <div className="bold-main">

          {/* PERFORMANCE — inset surface */}
          <div className="col-metrics" style={{ borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-inset-crisp)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18, flexWrap: 'wrap' }}>
              <div>
                <div className="eyebrow">Performance</div>
                <div className="serif" style={{ fontSize: 26, color: 'var(--ink-soft)', marginTop: 4, whiteSpace: 'nowrap' }}>
                  {tf === '1D' ? 'Today' : tf === '7D' ? 'This Week' : 'This Month'}
                </div>
              </div>
              <div className="la-seg">
                {[{ k: '1D', l: 'Day' }, { k: '7D', l: 'Week' }, { k: '1M', l: 'Month' }].map(o => (
                  <button key={o.k} onClick={() => setTf(o.k)} className={`la-seg-btn${tf === o.k ? ' on' : ''}`}>{o.l}</button>
                ))}
              </div>
            </div>
            <div className="bold-metrics-row">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, flex: '1 1 56%', minWidth: 360 }}>
                <BigMetric label="Targeted" value={mData.targeted} delta={mData.dT} tone="neutral" />
                <BigMetric label="Sent"     value={mData.sent}     delta={mData.dS} tone="neutral" />
                <BigMetric label="Response" value={mData.responseRate} suffix="%" delta={'+' + mData.dR} tone="warm" />
                <BigMetric label="Booked"   value={mData.booked}   suffix="%" delta={mData.dB} tone="good" star />
              </div>
              <div style={{ width: 1, background: 'var(--line)', alignSelf: 'stretch' }} className="bold-metrics-rule" />
              <div style={{ flex: '1 1 40%', minWidth: 280, display: 'flex', flexDirection: 'column' }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                  <span className="eyebrow eyebrow-sm">Trends · {tf === '1D' ? 'Today' : tf === '7D' ? 'This Week' : 'This Month'}</span>
                  <div className="row" style={{ gap: 14, fontSize: 9, fontFamily: 'var(--mono)', letterSpacing: '0.12em', color: 'var(--mute)' }}>
                    <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--stage-responded)' }} />RESPONSE</span>
                    <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--wine)' }} />BOOKING</span>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <TrendChart height={118} respPts={cData.resp} bookPts={cData.book} axis={cData.axis} />
                </div>
              </div>
            </div>
          </div>

          {/* PIPELINE (flat) + AI ACTIVITY */}
          <div className="bold-state-now">
            <div className="col-state" ref={colStateRef}>
              <div style={{ padding: 26, borderRadius: 'var(--r-card)' }}>
                <SectionHead eyebrow="Conversion" title="Pipeline" />
                {/* pipeWide: donut floats left of bars on ultra-wide screens */}
                <div style={{ display: 'flex', flexDirection: pipeWide ? 'row' : 'column', alignItems: pipeWide ? 'flex-start' : 'center', gap: 20 }}>
                  <div style={{ flexShrink: 0 }}>
                    <PipelineDonut size={148} thickness={20} hoveredStage={hoveredStage} onHoverStage={setHoveredStage} />
                  </div>
                  <div style={{ flex: 1, width: pipeWide ? undefined : '100%', paddingTop: pipeWide ? 10 : 0 }}>
                    <PipelineBars compact hoveredStage={hoveredStage} onHoverStage={setHoveredStage} />
                  </div>
                </div>
                <hr className="rule" style={{ margin: '22px 0 18px' }} />
                <HeatStrip heat={D.heat} />
              </div>
            </div>
            <AIActivityCard />
          </div>
        </div>
        <NextCard />
      </div>
    </div>
  );
}


// Backward-compatible standalone wrapper (kept so the page still renders
// even if mounted directly without the workspace).
function LayoutBold() {
  const [tab, setTab] = React.useState('stats');
  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar active="Campaigns" />
        <CampaignList />
        <CampaignMonitor tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}

// ─── Lead Heat strip ──────────────────────────────────────────────

function HeatStrip({ heat }) {
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="eyebrow eyebrow-sm">Lead Heat</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.12em' }}>
          {heat.total} IN DATABASE
        </span>
      </div>
      {/* stacked bar */}
      <div className="row" style={{ gap: 3, height: 12, marginBottom: 14 }}>
        {heat.bands.map((b) => (
          <div key={b.key} style={{ flex: b.count, background: b.color, borderRadius: 3, minWidth: 4 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {heat.bands.map((b) => (
          <div key={b.key} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color, marginTop: 4, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 7, alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{b.label}</span>
                <span className="serif" style={{ fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{b.count}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--mute)', fontFamily: 'var(--mono)', letterSpacing: '0.04em', marginTop: 1 }}>{b.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BigMetric ────────────────────────────────────────────────────

function BigMetric({ label, value, suffix, delta, tone, star }) {
  const accentColor = tone === 'wine' ? 'var(--wine)' : tone === 'good' ? 'var(--good)' : tone === 'warm' ? 'var(--warn)' : 'var(--mute)';
  return (
    <div className="neu-raised-crisp" style={{
      padding: star ? '22px 18px 20px' : '16px 18px 14px', borderRadius: 'var(--r-surface)', position: 'relative', overflow: 'hidden',
      boxShadow: star ? 'var(--sh-raised-crisp), inset 0 0 0 1.5px rgba(196,138,47,0.5)' : undefined,
      background: star ? 'linear-gradient(160deg, var(--warn-tint), var(--card) 60%)' : undefined,
    }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="eyebrow eyebrow-sm">{label}</div>
        {star && <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.12em', color: 'var(--stage-booked)', border: '1px solid var(--stage-booked)', borderRadius: 4, padding: '1px 5px' }}>★ NORTH STAR</span>}
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 4, marginTop: 10 }}>
        <span className="serif" style={{ fontSize: star ? 46 : 40, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</span>
        {suffix && <span style={{ fontSize: 18, color: 'var(--mute)' }}>{suffix}</span>}
      </div>
      <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10, color: accentColor, letterSpacing: '0.1em' }}>
        {delta}
      </div>
    </div>
  );
}

// ─── Cadence ladder ───────────────────────────────────────────────

function CadenceLadder({ cadence }) {
  const maxCount = Math.max(...cadence.map((c) => c.count));
  const colors = ['var(--stage-new)', 'var(--stage-contacted)', 'var(--stage-responded)', 'var(--stage-multi)', 'var(--mute-2)'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {cadence.map((c, i) => (
        <div key={i} className="row" style={{ gap: 14 }}>
          <div style={{ width: 96, fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500 }}>{c.label}</div>
          <div style={{ width: 48, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', letterSpacing: '0.06em' }}>
            {c.day === 0 ? 'D+0' : `D+${c.day}`}
          </div>
          <div style={{ flex: 1, height: 14, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
            <div style={{ width: `${(c.count / maxCount) * 100}%`, height: '100%', background: colors[i], borderRadius: 'var(--r-pill)', transition: 'width 400ms' }} />
          </div>
          <div style={{ width: 30, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)' }}>{c.count}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Analysis card (hero AI insight strip) ───────────────────────

function AnalysisCard({ a }) {
  const tones = {
    'Booking momentum': { color: 'var(--good)', bg: 'var(--good-tint)' },
    'Bump cadence':     { color: 'var(--warn)', bg: 'var(--warn-tint)' },
    'At-risk':          { color: 'var(--wine)', bg: 'var(--wine-tint)' },
  };
  const tone = tones[a.title] || { color: 'var(--mute)', bg: 'transparent' };
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 'var(--r-surface)',
      background: tone.bg, boxShadow: `inset 0 0 0 1px ${tone.color}30`,
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: tone.color, marginBottom: 6, fontWeight: 700 }}>{a.title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.55, textWrap: 'pretty' }}>{a.body}</div>
    </div>
  );
}

// ─── AI Activity card (was Now) ───────────────────────────────────

function AIActivityCard() {
  const D = window.LA_DATA;
  return (
    <div className="col-now neu-raised" style={{ padding: 26, borderRadius: 'var(--r-card)', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <div className="eyebrow row" style={{ gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }} className="la-pulse" />
            LIVE
          </div>
          <div className="serif" style={{ fontSize: 32, color: 'var(--ink-soft)', marginTop: 5, lineHeight: 1.05 }}>AI Activity</div>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.1em' }}>
          {D.nowLabel} · AUTO-REFRESH
        </span>
      </div>

      {/* Bump cadence chart */}
      <div className="neu-inset" style={{ padding: '16px 18px', borderRadius: 'var(--r-card)', marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="eyebrow eyebrow-sm">Today’s bump distribution</span>
          <span className="row" style={{ gap: 6, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--mute)' }}>
            <IconBump size={11} />{D.followUp.queuedToday} QUEUED
          </span>
        </div>
        <CadenceLadder cadence={D.followUp.cadence} />
      </div>

      {/* Divider */}
      <NowDivider label={D.nowLabel} />

      {/* Just happened */}
      <div className="eyebrow eyebrow-sm" style={{ marginBottom: 10 }}>Just happened</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {D.recent.map((r, i) => <RecentRow key={i} r={r} />)}
      </div>
    </div>
  );
}

// ─── Next card — calls + handoffs only ───────────────────────────

function NextCard() {
  const D = window.LA_DATA;
  const today  = D.upNext.filter(u => u.date === 'Today');
  const future = D.upNext.filter(u => u.date !== 'Today');
  return (
    <div className="col-next neu-raised" style={{ padding: 26, borderRadius: 'var(--r-card)', display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <div className="eyebrow row" style={{ gap: 7 }}>
            <IconCal size={12} />CALLS &amp; HANDOFFS
          </div>
          <div className="serif" style={{ fontSize: 32, color: 'var(--ink-soft)', marginTop: 5, lineHeight: 1.05 }}>Next</div>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.1em' }}>{today.length} TODAY</span>
      </div>

      <div className="eyebrow eyebrow-sm" style={{ marginBottom: 6 }}>Today</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {today.map((m, i) => <UpcomingRow key={i} m={{ ...m, kind: 'event' }} imminent={i === 0} />)}
      </div>

      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
        <div className="eyebrow eyebrow-sm" style={{ marginBottom: 12 }}>Later this week</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {future.map((u, i) => <FutureRow key={i} u={u} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Just-happened row ────────────────────────────────────────────

function RecentRow({ r }) {
  const toneColor = r.tone === 'good' ? 'var(--good)' : r.tone === 'warm' ? 'var(--warn)' : 'var(--mute-2)';
  const Ic = r.tone === 'good' ? IconCheck : r.tone === 'warm' ? IconChats : IconBump;
  return (
    <div className="row" style={{ gap: 14, padding: '11px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start', opacity: 0.92 }}>
      <div style={{ width: 30, height: 30, borderRadius: 'var(--r-button)', flexShrink: 0, marginTop: 1, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: toneColor }}>
        <Ic size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.name}</span>
          <span style={{ fontSize: 13, color: toneColor, fontWeight: 500 }}>{r.action}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.preview}</div>
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.06em', whiteSpace: 'nowrap', marginTop: 2 }}>{r.ago}</span>
    </div>
  );
}

// ─── NOW divider ──────────────────────────────────────────────────

function NowDivider({ label }) {
  return (
    <div className="row" style={{ gap: 12, margin: '20px 0 16px' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--wine)', fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wine)' }} className="la-pulse" />
        NOW · {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--line-strong)' }} />
    </div>
  );
}

// ─── Upcoming row ─────────────────────────────────────────────────

function UpcomingRow({ m, imminent }) {
  const isEvent = m.kind === 'event';
  return (
    <div className="row" style={{ gap: 16, padding: '11px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
      <div className="serif" style={{ fontSize: 18, color: 'var(--ink)', minWidth: 50, letterSpacing: '-0.01em' }}>{m.time}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, marginBottom: isEvent ? 0 : 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{m.name}</span>
          {isEvent ? (
            <ChannelChip ch={m.channel} />
          ) : (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'var(--warn-tint)', color: 'var(--warn)' }}>{m.stage.toUpperCase()}</span>
          )}
        </div>
        {!isEvent && <div style={{ fontSize: 12, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.preview}</div>}
        {isEvent && <div style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>STAGE · {m.stage.toUpperCase()}</div>}
      </div>
      {imminent && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', padding: '3px 9px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap', background: 'var(--warn)', color: '#fff' }}>UP NEXT</span>
      )}
    </div>
  );
}

// ─── Future (later this week) row ─────────────────────────────────

function FutureRow({ u }) {
  return (
    <div className="row" style={{ gap: 14, padding: '7px 0' }}>
      <div style={{ width: 78, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.12em' }}>{u.date.toUpperCase()}</div>
      <div className="serif" style={{ fontSize: 15, color: 'var(--ink-soft)', minWidth: 50, letterSpacing: '-0.01em' }}>{u.time}</div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{u.name}</div>
      <ChannelChip ch={u.channel} />
    </div>
  );
}

Object.assign(window, {
  LayoutBold, CampaignMonitor, HeatStrip, BigMetric, CadenceLadder,
  AnalysisCard, AIActivityCard, NextCard, RecentRow, NowDivider, UpcomingRow, FutureRow,
});
