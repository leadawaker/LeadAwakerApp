/* Variation A — "Refined Dashboard"
   Keeps the 3-column structure of the original but rebuilt in the
   warm-bone neumorphic system, with proper hierarchy and follow-up
   metrics added. */

function LayoutSafe() {
  const D = window.LA_DATA;
  const [tf, setTf] = React.useState('1M');

  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <HeaderBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <CampaignList />
        <div style={{ flex: 1, padding: 28, overflowY: 'auto', background: 'var(--bg)' }}>

          {/* Hero / active campaign panel */}
          <div className="neu-polished" style={{ padding: 32, borderRadius: 'var(--r-panel)', marginBottom: 24 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
              <div className="row" style={{ gap: 22, alignItems: 'center' }}>
                <div className="la-mono-tile wine" style={{ width: 64, height: 64, fontSize: 26 }}>LF</div>
                <div>
                  <div className="eyebrow">Campaign · #{D.active.id}</div>
                  <div className="serif" style={{ fontSize: 40, color: 'var(--ink)', lineHeight: 1.1, marginTop: 6 }}>{D.active.name}</div>
                  <div className="row" style={{ gap: 10, marginTop: 12 }}>
                    <StatusPill status={D.active.status} />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.1em' }}>LAST RUN MAR 24 · 12:00 AM</span>
                  </div>
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn-neu" style={{ padding: '12px 18px' }}>Edit</button>
                <button className="btn-wine" style={{ padding: '12px 18px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <IconSpark size={14} />Generate
                </button>
              </div>
            </div>
            <hr className="rule" style={{ margin: '24px 0 20px' }} />
            <CampaignMeta />
          </div>

          {/* Three-column main grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.2fr 1fr', gap: 20, marginBottom: 20 }}>

            {/* Pipeline */}
            <div className="neu-raised" style={{ padding: 26, borderRadius: 'var(--r-card)' }}>
              <SectionHead eyebrow="Conversion" title="Pipeline" />
              <div className="row" style={{ justifyContent: 'center', marginBottom: 22 }}>
                <PipelineDonut size={210} thickness={28} />
              </div>
              <PipelineBars />
            </div>

            {/* Key Metrics + Trends */}
            <div className="neu-raised" style={{ padding: 26, borderRadius: 'var(--r-card)', display: 'flex', flexDirection: 'column' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
                <div>
                  <div className="eyebrow">Performance</div>
                  <div className="serif" style={{ fontSize: 28, color: 'var(--ink-soft)', marginTop: 4 }}>Key Metrics</div>
                </div>
                <TimeToggle value={tf} onChange={setTf} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <MetricCard label="Leads Targeted" value={D.metrics.leadsTargeted} accent="var(--stage-new)" delta="+12 this week" />
                <MetricCard label="Messages Sent" value={D.metrics.messagesSent} accent="var(--stage-responded)" delta="+58 this week" />
                <MetricCard label="Response %" value={D.metrics.responsePct} suffix="%" accent="var(--warn)" delta="+2.1 vs prev" />
                <MetricCard label="Booking %" value={D.metrics.bookingPct} suffix="%" accent="var(--wine)" delta="— no change" />
              </div>
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, flex: 1 }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="eyebrow eyebrow-sm">Performance Trends</span>
                  <div className="row" style={{ gap: 14, fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '0.12em', color: 'var(--mute)' }}>
                    <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--stage-responded)' }} />RESPONSE %</span>
                    <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--wine)' }} />BOOKING %</span>
                  </div>
                </div>
                <TrendChart height={120} />
              </div>
            </div>

            {/* Up Next */}
            <div className="neu-raised" style={{ padding: 26, borderRadius: 'var(--r-card)' }}>
              <SectionHead
                eyebrow="Schedule"
                title="Up Next"
                action={<span className="row" style={{ gap: 6, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--mute)' }}>7 BOOKED</span>}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {D.upNext.slice(0, 7).map((u, i) => (
                  <UpNextRow key={i} u={u} isFirst={i === 0 || u.date !== D.upNext[i-1].date} />
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row — Activity (with follow-up aggregate) + AI Analysis */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>

            {/* Activity = follow-up aggregates + upcoming messages */}
            <div className="neu-raised" style={{ padding: 26, borderRadius: 'var(--r-card)' }}>
              <SectionHead
                eyebrow="Outreach"
                title="Activity"
                action={
                  <div className="row" style={{ gap: 14 }}>
                    <span className="row" style={{ gap: 6, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--mute)' }}>
                      <IconBump size={12} />BUMP CADENCE
                    </span>
                  </div>
                }
              />

              {/* Aggregate bump stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
                <BumpStat label="Queued Today" value={D.followUp.queuedToday} hint="messages" highlight />
                <BumpStat label="Queued This Week" value={D.followUp.queuedWeek} hint="messages" />
                <BumpStat label="Avg Bump Delay" value={D.followUp.avgBumpDelay} hint="between sends" />
                <BumpStat label="Next Send" value={D.followUp.nextSendWindow} hint="window opens" />
              </div>

              {/* Cadence breakdown */}
              <div className="neu-inset" style={{ padding: '16px 18px', borderRadius: 'var(--r-surface)', marginBottom: 22 }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                  <span className="eyebrow eyebrow-sm">Today's Bump Mix</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.12em' }}>BY STAGE</span>
                </div>
                <div className="row" style={{ gap: 4, height: 32, alignItems: 'stretch' }}>
                  {D.followUp.cadence.map((c, i) => {
                    const total = D.followUp.cadence.reduce((a, b) => a + b.count, 0);
                    return (
                      <div key={i} style={{ flex: c.count / total, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <div style={{
                          background: i === 0 ? 'var(--stage-new)' :
                                       i === 1 ? 'var(--stage-contacted)' :
                                       i === 2 ? 'var(--stage-responded)' :
                                       i === 3 ? 'var(--stage-multi)' : 'var(--mute-2)',
                          height: '100%',
                          borderRadius: 4,
                        }} />
                      </div>
                    );
                  })}
                </div>
                <div className="row" style={{ gap: 4, marginTop: 6 }}>
                  {D.followUp.cadence.map((c, i) => {
                    const total = D.followUp.cadence.reduce((a, b) => a + b.count, 0);
                    return (
                      <div key={i} style={{ flex: c.count / total, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--mute)', letterSpacing: '0.06em' }}>
                        <div>{c.label.toUpperCase()}</div>
                        <div style={{ color: 'var(--ink)', fontSize: 12, marginTop: 2 }}>{c.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upcoming messages */}
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="eyebrow eyebrow-sm">Upcoming Messages · Today</span>
                <a href="#" style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--wine)', textDecoration: 'none' }}>VIEW ALL →</a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {D.activity.slice(0, 5).map((a, i) => (
                  <ActivityRow key={i} a={a} />
                ))}
              </div>

              {/* Daily capacity */}
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="eyebrow eyebrow-sm">Daily Capacity</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.08em' }}>
                    <span style={{ color: 'var(--ink)' }}>47</span> / 100 · resets midnight
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                  <div style={{ width: '47%', height: '100%', background: 'linear-gradient(90deg, var(--wine), var(--wine-soft))', borderRadius: 'var(--r-pill)' }} />
                </div>
              </div>
            </div>

            {/* AI Analysis */}
            <AIAnalysisCard />
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── UpNext row ───────────────────────────────────────────────────

function UpNextRow({ u, isFirst }) {
  return (
    <>
      {isFirst && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em',
          color: 'var(--mute-2)', textTransform: 'uppercase',
          padding: '14px 0 8px',
        }}>{u.date}</div>
      )}
      <div className="row" style={{ gap: 14, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
        <div className="serif" style={{ fontSize: 18, color: 'var(--ink)', minWidth: 50, letterSpacing: '-0.01em' }}>{u.time}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{u.name}</div>
          <div className="row" style={{ gap: 6, marginTop: 2 }}>
            <ChannelChip ch={u.channel} />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Activity row ─────────────────────────────────────────────────

function ActivityRow({ a }) {
  return (
    <div className="row" style={{ gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <div className="serif" style={{ fontSize: 18, color: 'var(--ink)', minWidth: 52, letterSpacing: '-0.01em' }}>{a.time}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{a.name}</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em',
            padding: '2px 7px', borderRadius: 'var(--r-pill)',
            background: 'var(--wine-tint)', color: 'var(--wine)',
          }}>{a.stage.toUpperCase()}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.preview}</div>
      </div>
      <button style={{
        border: 'none', background: 'transparent',
        color: 'var(--mute-2)', cursor: 'pointer',
      }}>
        <IconChev size={14} />
      </button>
    </div>
  );
}

// ─── Bump stat ────────────────────────────────────────────────────

function BumpStat({ label, value, hint, highlight }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 'var(--r-surface)',
      background: highlight ? 'linear-gradient(145deg, rgba(94,34,48,0.05), rgba(94,34,48,0.12))' : 'var(--card)',
      boxShadow: 'var(--sh-raised-crisp)',
      position: 'relative',
    }}>
      <div className="eyebrow eyebrow-sm" style={{ color: highlight ? 'var(--wine)' : 'var(--mute)' }}>{label}</div>
      <div className="serif" style={{ fontSize: 28, color: 'var(--ink)', lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--mute-2)', fontFamily: 'var(--mono)', letterSpacing: '0.08em', marginTop: 4, textTransform: 'uppercase' }}>{hint}</div>
    </div>
  );
}

// ─── AI Analysis (TL;DR + expand) ────────────────────────────────

function AIAnalysisCard() {
  const D = window.LA_DATA;
  const [open, setOpen] = React.useState(false);
  return (
    <div className="neu-raised" style={{ padding: 26, borderRadius: 'var(--r-card)', display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="eyebrow row" style={{ gap: 6 }}>
            <IconSpark size={12} />AI ANALYSIS
          </div>
          <div className="serif" style={{ fontSize: 26, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1.1 }}>Read of the week</div>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.14em' }}>MAR 24, 12:00AM</span>
      </div>

      <div className="neu-inset" style={{ padding: '18px 20px', borderRadius: 'var(--r-surface)', marginBottom: 14 }}>
        <div className="eyebrow eyebrow-sm wine" style={{ marginBottom: 8 }}>TL;DR</div>
        <div className="serif italic" style={{ fontSize: 18, lineHeight: 1.45, color: 'var(--ink-soft)' }}>
          {D.aiTLDR}
        </div>
      </div>

      <button
        onClick={() => setOpen(!open)}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em',
          color: 'var(--wine)', padding: '4px 0', textTransform: 'uppercase',
          textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {open ? 'Hide full analysis' : 'Show full analysis'}
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}>
          <IconChev size={12} />
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {D.aiAnalysis.map((a, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.5 }}>{a.body}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />
      <button className="la-btn la-btn--soft" style={{ marginTop: 16, alignSelf: 'flex-start' }}>
        <IconSpark size={12} />Re-run analysis
      </button>
    </div>
  );
}

Object.assign(window, { LayoutSafe, UpNextRow, ActivityRow, BumpStat, AIAnalysisCard });
