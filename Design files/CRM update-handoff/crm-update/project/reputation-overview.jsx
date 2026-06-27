// reputation-overview.jsx — Analytics tab (executive reporting)
// Faithful to the reference: health + KPIs · attention card + dual-axis rating chart ·
// generation funnel | sentiment+distribution | response SLA.
// In automatic mode, reply-rate / response-time / SLA reflect the hands-free service.
// Depends on: components.jsx, reputation-components.jsx, reputation-data.js

// ─── Reputation Health — composite ring (no driver bars) ─────────
function RepHealthCard({ score, of, label, delta, note }) {
  const pct = score / of;
  const R = 30, C = 2 * Math.PI * R;
  return (
    <div className="neu-raised" style={{ padding: 20, borderRadius: 'var(--r-card)', position: 'relative', overflow: 'hidden', flex: '1.4 1 230px', minWidth: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--wine-grad)' }} />
      <div className="eyebrow eyebrow-sm">Reputation health</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 46, lineHeight: 1, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{score}</span>
            <span style={{ fontSize: 15, color: 'var(--mute)' }}>/ {of}</span>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 21, color: 'var(--wine)', lineHeight: 1, marginTop: 8 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--good)' }}>↑ {delta}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--mute-2)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{note}</span>
          </div>
        </div>
        <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
          <svg width="84" height="84" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r={R} fill="none" stroke="var(--bg)" strokeWidth="8" />
            <circle cx="42" cy="42" r={R} fill="none" stroke="var(--wine)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 42 42)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── KPI metric card (Playfair number) ───────────────────────────
function RepMetricCard({ label, value, suffix, delta, deltaTone = 'good', note, accent, stars, spark }) {
  return (
    <div className="neu-raised" style={{ padding: 20, borderRadius: 'var(--r-card)', position: 'relative', overflow: 'hidden', flex: '1 1 160px', minWidth: 0 }}>
      {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />}
      <div className="eyebrow eyebrow-sm" style={{ whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 42, lineHeight: 1, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{value}</span>
        {suffix && <span style={{ fontSize: 15, color: 'var(--mute)' }}>{suffix}</span>}
      </div>
      {stars != null && <div style={{ marginTop: 8 }}><RepStars rating={Math.round(stars)} size={13} /></div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {delta && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: deltaTone === 'good' ? 'var(--good)' : 'var(--mute)' }}>{delta}</span>}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--mute-2)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{note}</span>
      </div>
    </div>
  );
}

// ─── Dual-axis rating chart (rating L / volume R) + range switch ──
function RepRatingChart({ series }) {
  const [range, setRange] = React.useState('quarter');
  const s = series[range];
  const RANGES = [{ k: 'week', l: '1W' }, { k: 'month', l: '1M' }, { k: 'quarter', l: '3M' }];

  const rMin = 3.5, rMax = 5.0;
  const volMax = Math.max(4, Math.ceil(Math.max(...s.volume) * 1.15 / 5) * 5);
  const padT = 8, padB = 10, plotH = 100 - padT - padB;
  const yR = (v) => padT + (1 - (v - rMin) / (rMax - rMin)) * plotH;
  const yVbase = 100 - padB;
  const barH = (v) => (v / volMax) * plotH;
  const n = s.rating.length;
  const xAt = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);

  const line = s.rating.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(2)},${yR(v).toFixed(2)}`).join(' ');
  const area = line + ` L100,${yVbase} L0,${yVbase} Z`;
  const lastY = yR(s.rating[n - 1]);
  const ratingTicks = [5.0, 4.5, 4.0, 3.5];
  const negs = s.negatives || [];
  const negY = yR(3.6);

  // paired thin volume bars, sitting next to each other at each point
  const sub = 1.2, gap = 0.55;     // bar width / gap, in viewBox units

  return (
    <div className="neu-raised" style={{ flex: '2 1 460px', minWidth: 0, borderRadius: 'var(--r-card)', background: 'var(--card)', padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div className="eyebrow eyebrow-sm">Rating over time</div>
        <div className="la-seg">
          {RANGES.map(r => <button key={r.k} onClick={() => setRange(r.k)} className={`la-seg-btn${range === r.k ? ' on' : ''}`}>{r.l}</button>)}
        </div>
      </div>

      {/* legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--mute)' }}><span style={{ width: 14, height: 2, background: 'var(--wine)', borderRadius: 2 }} />Avg rating</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--mute)' }}><span style={{ width: 9, height: 9, background: 'var(--line-strong)', opacity: 0.45, borderRadius: 1 }} />Review volume</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--mute)' }}><span style={{ width: 8, height: 8, background: 'var(--wine)', borderRadius: '50%' }} />Negative reviews</span>
      </div>

      {/* plot with axes */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        {/* left rating axis (tiny star marks the rating scale) */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 188, paddingTop: padT * 1.88 - 6, paddingBottom: padB * 1.88, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)' }}>
          <span style={{ position: 'absolute', top: -5, left: -1, color: 'var(--wine)', display: 'flex' }}><RIconStarF size={11} /></span>
          {ratingTicks.map(t => <span key={t}>{t.toFixed(1)}</span>)}
        </div>

        {/* plot */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', width: '100%', height: 188 }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
              {ratingTicks.map(t => <line key={t} x1="0" y1={yR(t)} x2="100" y2={yR(t)} stroke="var(--line)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />)}
              {s.volume.map((v, i) => {
                const cx = xAt(i);
                const h = barH(v), h2 = barH(v) * 0.72;
                const left = cx - (sub + gap / 2);
                return (
                  <g key={i}>
                    <rect x={left} y={yVbase - h} width={sub} height={h} fill="var(--line-strong)" opacity="0.42" rx="0.4" />
                    <rect x={left + sub + gap} y={yVbase - h2} width={sub} height={h2} fill="var(--line-strong)" opacity="0.3" rx="0.4" />
                  </g>
                );
              })}
              <path d={area} fill="var(--wine-tint)" />
              <path d={line} fill="none" stroke="var(--wine)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* negative-review markers (HTML so dots stay round under the stretched svg) */}
            {negs.map((i) => (
              <span key={'neg' + i} style={{ position: 'absolute', left: `${xAt(i)}%`, top: `${negY}%`, width: 8, height: 8, borderRadius: '50%', background: 'var(--wine)', border: '1.5px solid var(--card)', transform: 'translate(-50%, -50%)', boxShadow: 'var(--sh-raised-crisp)' }} />
            ))}
            {/* last value label — number only, no marker dot */}
            <div style={{ position: 'absolute', top: `${lastY}%`, right: 0, transform: 'translate(2px, -50%)', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--paper)', background: 'var(--wine)', borderRadius: 'var(--r-flush)', padding: '2px 7px', boxShadow: 'var(--sh-raised-crisp)' }}>{s.now.toFixed(1)}</div>
            {/* trend annotation */}
            <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--good-tint)', borderRadius: 'var(--r-pill)', padding: '3px 10px', fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, color: 'var(--good)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>↑ {s.annotation}</div>
          </div>
        </div>

        {/* right volume axis */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 188, paddingTop: padT * 1.88 - 6, paddingBottom: padB * 1.88, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', textAlign: 'right' }}>
          <span>{volMax}</span><span>{Math.round(volMax * 2 / 3)}</span><span>{Math.round(volMax / 3)}</span><span>0</span>
        </div>
      </div>

      {/* x axis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, marginLeft: 28, marginRight: 24, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute-2)', letterSpacing: '0.08em' }}>
        {s.axis.map((a, i) => <span key={i}>{a}</span>)}
      </div>
    </div>
  );
}

// ─── Analytics "auto-handled" card (oversight/audit, replaces the to-do hero in auto mode) ─
function RepAutoHandledCard({ count, median, audit, threshold, delay }) {
  return (
    <div className="neu-raised" style={{ flex: '1 1 320px', minWidth: 0, borderRadius: 'var(--r-card)', background: 'var(--wine-grad)', color: 'var(--paper)', overflow: 'hidden', padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}><IconSpark size={13} />Auto-handled this period</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 58, lineHeight: 0.9, color: 'var(--paper)', letterSpacing: '-0.02em' }}>{count}</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 21, color: 'rgba(255,255,255,0.92)', lineHeight: 1.05 }}>replies posted</span>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--r-pill)', padding: '5px 12px' }}>
          <RIconClock size={13} /><span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--paper)' }}>{median}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)' }}>median</span>
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.78)' }}>{threshold}★+ reviews answered automatically after {repDelayLabel(delay)}.</div>

      {/* audit log */}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.16)', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Audit log · recently posted</span>
        {audit.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', gap: 1 }}>{[1, 2, 3, 4, 5].map(i => <span key={i} style={{ display: 'flex', color: i <= a.rating ? '#E8C97A' : 'rgba(255,255,255,0.25)' }}><RIconStarF size={10} /></span>)}</span>
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.94)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{a.name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: a.by === 'AI' ? '#B4E8C6' : 'rgba(255,255,255,0.6)' }}>{a.by === 'AI' ? 'AI' : a.by.split(' ')[0]}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>{a.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analytics "needs attention" card (wine) ─────────────────────
function RepAttentionCard({ S, latest, autoMode, onOpenQueue }) {
  const count = autoMode ? S.negNeeds : S.needsReply;
  const heading = autoMode ? 'reviews held for you' : 'reviews awaiting reply';
  return (
    <div className="neu-raised" style={{ flex: '1 1 320px', minWidth: 0, borderRadius: 'var(--r-card)', background: 'var(--wine-grad)', color: 'var(--paper)', overflow: 'hidden', padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}>Needs your attention</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 58, lineHeight: 0.9, color: 'var(--paper)', letterSpacing: '-0.02em' }}>{count}</span>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'rgba(255,255,255,0.92)', lineHeight: 1.05 }}>{heading}</span>
      </div>

      {!autoMode && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {[{ n: S.negNeeds, l: 'negative', d: '#E8B4B4' }, { n: S.neuNeeds, l: 'neutral', d: '#E8D7B4' }, { n: S.posNeeds, l: 'positive', d: '#B4E8C6' }].map(b => (
            <span key={b.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--r-pill)', padding: '5px 12px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: b.d }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--paper)' }}>{b.n}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)' }}>{b.l}</span>
            </span>
          ))}
        </div>
      )}

      {autoMode && (
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, marginTop: 14, background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--r-pill)', padding: '6px 13px' }}>
          <IconSpark size={13} /><span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.9)' }}>Positives auto-replied — only negatives held</span>
        </div>
      )}

      {/* latest waiting */}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.16)', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Latest waiting</span>
        {latest.map(w => (
          <div key={w.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.4, color: 'rgba(255,255,255,0.94)', textWrap: 'pretty', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{w.text}"</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'inline-flex', gap: 2 }}>{[1, 2, 3, 4, 5].map(i => <span key={i} style={{ display: 'flex', color: i <= w.rating ? '#E8C97A' : 'rgba(255,255,255,0.25)' }}><RIconStarF size={11} /></span>)}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'rgba(255,255,255,0.6)' }}>{w.ago} ago</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgba(255,255,255,0.82)' }}><RIconClock size={14} />Oldest: <strong style={{ color: 'var(--paper)' }}>{S.oldestDays}d</strong></span>
        <button onClick={onOpenQueue} style={{ marginLeft: 'auto', border: 'none', cursor: 'pointer', background: 'var(--paper)', color: 'var(--wine)', padding: '11px 18px', borderRadius: 'var(--r-button)', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: 'var(--sh-raised-crisp)', whiteSpace: 'nowrap' }}>Review queue <RIconArrow size={13} /></button>
      </div>
    </div>
  );
}

// ─── Sentiment donut (pie) ───────────────────────────────────────
function RepSentimentPie({ sentiment }) {
  const segs = [
    { key: 'positive', label: 'Positive', value: sentiment.positive, color: 'var(--good)' },
    { key: 'neutral', label: 'Neutral', value: sentiment.neutral, color: 'var(--mute-2)' },
    { key: 'negative', label: 'Negative', value: sentiment.negative, color: 'var(--wine)' },
  ];
  const p = sentiment.positive, nu = sentiment.neutral;
  const grad = `conic-gradient(var(--good) 0 ${p}%, var(--mute-2) ${p}% ${p + nu}%, var(--wine) ${p + nu}% 100%)`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <div style={{ position: 'relative', width: 116, height: 116, flexShrink: 0 }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: grad, boxShadow: 'var(--sh-raised-crisp)' }} />
        <div style={{ position: 'absolute', inset: 24, borderRadius: '50%', background: 'var(--card)', boxShadow: 'var(--sh-inset-crisp)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 25, lineHeight: 1, color: 'var(--wine)' }}>{sentiment.positive}%</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute-2)', marginTop: 2 }}>positive</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1, minWidth: 0 }}>
        {segs.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', flex: 1 }}>{s.label}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rating distribution ─────────────────────────────────────────
function RepDistribution({ rows }) {
  const maxC = Math.max(...rows.map(r => r.count));
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {rows.map(r => (
        <div key={r.stars} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, width: 30, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)' }}>
            {r.stars}<span style={{ display: 'flex', color: repRatingColor(r.stars) }}><RIconStarF size={11} /></span>
          </span>
          <div style={{ flex: 1, height: 8, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
            <div style={{ width: `${(r.count / maxC) * 100}%`, height: '100%', background: repRatingColor(r.stars), borderRadius: 'var(--r-pill)' }} />
          </div>
          <span style={{ width: 58, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)' }}>{r.count} ({Math.round((r.count / total) * 100)}%)</span>
        </div>
      ))}
    </div>
  );
}

// ─── Response SLA bands ──────────────────────────────────────────
function RepSLACard({ bands }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {bands.map(b => (
        <div key={b.band}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.04em', color: 'var(--ink-soft)' }}>{b.band}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{b.pct}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
            <div style={{ width: `${b.pct}%`, height: '100%', background: b.color, borderRadius: 'var(--r-pill)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Generation funnel (gray→gold gradient; negative branch in wine) ─
const FUNNEL_GRAY = '#A99C8C';
const FUNNEL_GOLD = '#C49A3C';
function repLerpHex(a, b, t) {
  const h = (s, i) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map(i => Math.round(h(a, i) + (h(b, i) - h(a, i)) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

function RepGenerationFunnel({ steps, referral }) {
  const max = steps[0].value;
  const n = steps.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {steps.map((s, idx) => {
        const gold = repLerpHex(FUNNEL_GRAY, FUNNEL_GOLD, n === 1 ? 1 : idx / (n - 1));
        const w = (s.value / max) * 100;
        const posShare = s.pos != null ? s.pos / s.value : 1;
        return (
          <div key={s.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5, gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>
                {s.pos != null
                  ? <React.Fragment><span style={{ color: gold }}>{s.pos}</span><span style={{ color: 'var(--mute-2)' }}> + </span><span style={{ color: 'var(--wine)' }}>{s.neg}</span></React.Fragment>
                  : s.value}
              </span>
            </div>
            <div style={{ display: 'flex', width: `${w}%`, minWidth: 44, height: 16, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
              {s.pos != null ? (
                <React.Fragment>
                  <div style={{ width: `${posShare * 100}%`, height: '100%', background: gold }} />
                  <div style={{ width: `${(1 - posShare) * 100}%`, height: '100%', background: 'var(--wine)' }} />
                </React.Fragment>
              ) : (
                <div style={{ width: '100%', height: '100%', background: s.combo ? `linear-gradient(90deg, ${gold}, var(--wine))` : gold }} />
              )}
            </div>
            {s.note && <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.04em', color: 'var(--mute-2)', marginTop: 4, textTransform: 'uppercase' }}>{s.note}</div>}
          </div>
        );
      })}

      {referral && (
        <div style={{ marginTop: 2, paddingTop: 13, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Referral asks</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.04em', color: 'var(--mute-2)', marginTop: 2, textTransform: 'uppercase' }}>{referral.note}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 27, lineHeight: 1, color: 'var(--wine)' }}>{referral.pct}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--mute)' }}>%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel shell ─────────────────────────────────────────────────
function RepPanel({ title, right, children, flex, minWidth = 0, sub }) {
  return (
    <div className="neu-raised" style={{ flex, minWidth, borderRadius: 'var(--r-card)', background: 'var(--card)', padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div className="eyebrow eyebrow-sm">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ═══ Analytics tab ═════════════════════════════════════════════════
function RepAnalytics({ autoMode, auto, onOpenQueue }) {
  const O = window.REP_DATA.overview;
  const F = window.REP_DATA.feedback;
  const S = window.REP_DATA.summary;
  const D = window.REP_DATA;
  const latest = window.REP_DATA.latestWaiting;
  const m = O.metrics;

  // audit / auto-handled figures for the oversight card
  const autoPostedNeeds = autoMode ? D.reviews.filter(r => r.status === 'needs' && repAutoPosts(r, auto)) : [];
  const repliedHist = D.reviews.filter(r => r.status === 'replied');
  const audit = [
    ...autoPostedNeeds.map(r => ({ id: r.id, name: r.name, rating: r.rating, when: repDelayLabel(auto.delay) + ' after', by: 'AI' })),
    ...repliedHist.map(r => ({ id: r.id, name: r.name, rating: r.rating, when: r.reply.ago + ' ago', by: r.reply.by === 'auto' ? 'AI' : r.reply.by })),
  ].slice(0, 6);
  const handledCount = autoPostedNeeds.length + repliedHist.length;

  // metrics shift under automatic mode
  const replyRate = autoMode ? { value: '100', delta: '+12%', note: 'fully automated' } : m.replyRate;
  const medianReply = autoMode ? { value: '20', suffix: 'min', delta: 'steady', note: 'auto-posted' } : m.medianReply;

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {autoMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'var(--wine-tint)', borderRadius: 'var(--r-surface)', padding: '11px 16px' }}>
            <span style={{ display: 'flex', color: 'var(--wine)' }}><IconSpark size={16} /></span>
            <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}><strong>Oversight view</strong> — in automatic mode this dashboard is an audit report, not a to-do list. Replies post for you; reply rate and response speed reflect the hands-free service.</span>
          </div>
        )}

        {/* row 1 — four KPI cards */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <RepMetricCard label="Avg rating" value={m.avgRating.value} delta={`↑ ${m.avgRating.delta}`} note={m.avgRating.note} stars={4.6} accent="var(--good)" />
          <RepMetricCard label="Median reply" value={medianReply.value} suffix={medianReply.suffix} delta={medianReply.delta} note={medianReply.note} accent="var(--wine)" />
          <RepMetricCard label="Reply rate" value={replyRate.value} suffix="%" delta={`↑ ${replyRate.delta}`} note={replyRate.note} accent="var(--good)" />
          <RepMetricCard label="New this month" value={m.thisMonth.value} delta={`↑ ${m.thisMonth.delta}`} note={m.thisMonth.note} accent="var(--mute-2)" />
        </div>

        {/* row 2 — (auto: auto-handled audit | manual: attention) + dual-axis chart */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>
          {autoMode
            ? <RepAutoHandledCard count={handledCount} median={`${medianReply.value} ${medianReply.suffix || 'min'}`} audit={audit} threshold={auto.threshold} delay={auto.delay} />
            : <RepAttentionCard S={S} latest={latest} autoMode={autoMode} onOpenQueue={onOpenQueue} />}
          <RepRatingChart series={O.ratingSeries} />
        </div>

        {/* row 3 — generation funnel | sentiment (pie) + distribution */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <RepPanel flex="1 1 320px" title="Review generation funnel"
            right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--mute)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: '#C49A3C' }} />Positive</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--wine)' }} />Negative</span>
            </span>}>
            <RepGenerationFunnel steps={F.funnel} referral={F.referralAskRate} />
          </RepPanel>

          <RepPanel flex="1 1 340px" title="Sentiment & distribution" right={<span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)' }}>{S.count} total</span>}>
            <RepSentimentPie sentiment={O.sentiment} />
            <div style={{ margin: '18px 0', height: 1, background: 'var(--line)' }} />
            <RepDistribution rows={O.distribution} />
          </RepPanel>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  RepHealthCard, RepMetricCard, RepRatingChart, RepAttentionCard, RepAutoHandledCard,
  RepSentimentPie, RepDistribution, RepSLACard, RepGenerationFunnel, RepPanel, RepAnalytics,
});
