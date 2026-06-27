// reputation-app.jsx — Reputation workspace: 2 tabs (Inbox · Analytics)
// Inbox  → "What needs my attention right now?"  (operational hub, two-pane)
// Analytics → "How is our reputation performing?" (executive reporting)
// Depends on: components.jsx, reputation-components.jsx, reputation-overview.jsx,
//             reputation-feedback.jsx, reputation-data.js

// ─── helpers ──────────────────────────────────────────────────────
function repAgeHours(ago) {
  const m = /^(\d+)\s*([hdw])$/.exec(ago.trim());
  if (!m) return 9999;
  const n = +m[1];
  return m[2] === 'h' ? n : m[2] === 'd' ? n * 24 : n * 168;
}

// ─── Connect Google Business Profile (not-connected state) ───────
function RepConnectCard() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="neu-raised" style={{ maxWidth: 440, borderRadius: 'var(--r-panel)', background: 'var(--card)', padding: '36px 34px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, margin: '0 auto 20px', borderRadius: 'var(--r-card)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 26, color: 'var(--wine)' }}>G</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.15, marginBottom: 10 }}>Connect Google Business Profile</div>
        <p style={{ margin: '0 0 22px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--mute)', textWrap: 'pretty' }}>
          Link your Google Business Profile to monitor incoming reviews and reply to them — with AI-drafted, human-approved responses — without leaving Lead Awaker.
        </p>
        <button className="la-btn la-btn--wine la-btn--lg" style={{ margin: '0 auto' }}><RIconExt size={14} />Connect with Google</button>
        <div style={{ marginTop: 16, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Read &amp; reply access · revoke anytime</div>
      </div>
    </div>
  );
}

// ─── All caught up empty state ───────────────────────────────────
function RepCaughtUp() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 40 }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--good-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--good)' }}><IconCheck size={30} /></div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--ink)' }}>All caught up</div>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--mute)', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>Every review has a reply. New ones will appear here the moment they land on Google.</p>
    </div>
  );
}

// ─── small popover ───────────────────────────────────────────────
function RepPopover({ open, children, width = 200 }) {
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 40, width,
      background: 'var(--card)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-raised-large)', border: '1px solid var(--line)', padding: 6 }}>
      {children}
    </div>
  );
}
function RepMenuItem({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', border: 'none', cursor: 'pointer',
      borderRadius: 'var(--r-button)', background: active ? 'var(--wine-tint)' : 'transparent',
      fontFamily: 'var(--sans)', fontSize: 13, fontWeight: active ? 600 : 500, color: active ? 'var(--wine)' : 'var(--ink-soft)' }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
}

// ─── Platform status card (persistent, in header) ────────────────
function RepPlatformCard({ platform }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} className="neu-raised" style={{
        display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', border: 'none',
        background: 'var(--card)', borderRadius: 'var(--r-surface)', padding: '7px 13px',
      }}>
        <span style={{ width: 28, height: 28, borderRadius: 'var(--r-button)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15, color: 'var(--wine)' }}>G</span>
        <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{platform.name}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--good)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--good)' }} />Connected
          </span>
        </span>
        <IconChev size={13} style={{ color: 'var(--mute-2)' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, width: 240, background: 'var(--card)', borderRadius: 'var(--r-card)', boxShadow: 'var(--sh-raised-large)', border: '1px solid var(--line)', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: 'var(--r-button)', background: 'var(--surface)', boxShadow: 'var(--sh-raised-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: 'var(--wine)' }}>G</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>Google</span>
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--good)', letterSpacing: '0.04em' }}>last sync {platform.lastSync}</span>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute-2)', marginBottom: 8 }}>Coming soon</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {platform.future.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 'var(--r-button)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{f}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--mute-2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>soon</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Operational KPI strip ═════════════════════════════════════════
function RepKpiCard({ label, value, suffix, delta, sub, Ic, iconBg, iconFg }) {
  return (
    <div className="neu-raised" style={{ flex: '1 1 200px', minWidth: 0, borderRadius: 'var(--r-card)', background: 'var(--card)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--r-surface)', background: iconBg || 'var(--surface)', boxShadow: iconBg ? 'var(--sh-raised-crisp)' : 'var(--sh-inset-crisp)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconFg || 'var(--mute)' }}><Ic size={18} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow eyebrow-sm" style={{ whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 30, lineHeight: 1, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{value}</span>
          {suffix && <span style={{ fontSize: 13, color: 'var(--mute)' }}>{suffix}</span>}
          {delta && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--good)' }}>{delta}</span>}
        </div>
        {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute-2)', marginTop: 3, whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
    </div>
  );
}

function RepInboxKPIs({ S, autoMode, heldCount, autoCount }) {
  return (
    <div style={{ flexShrink: 0, padding: '14px 20px 0', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <RepKpiCard label={autoMode ? 'Held for your approval' : 'Reviews awaiting reply'} value={autoMode ? heldCount : S.needsReply} delta={autoMode ? null : '↑2'} sub={autoMode ? 'exceptions only' : 'vs last 7 days'} Ic={IconChats} iconBg="#3B6FCF" iconFg="#fff" />
      <RepKpiCard label="Negative awaiting reply" value={S.negNeeds} delta="↑1" sub="vs last 7 days" Ic={RIconFlag} iconBg="var(--wine)" iconFg="var(--paper)" />
      {autoMode
        ? <RepKpiCard label="Auto-replied today" value={autoCount} sub="posted for you" Ic={IconSpark} iconBg="#C5860F" iconFg="#fff" />
        : <RepKpiCard label="Oldest waiting review" value={S.oldestDays} suffix="days" sub="needs a reply" Ic={RIconClock} iconBg="#C5860F" iconFg="#fff" />}
      <RepKpiCard label={autoMode ? 'Auto-reply rate' : 'AI draft coverage'} value={autoMode ? 100 : S.aiCoverage} suffix="%" sub={autoMode ? 'replies posted' : 'drafts ready to review'} Ic={autoMode ? IconSpark : IconChats} iconBg="var(--good)" iconFg="var(--paper)" />
    </div>
  );
}

// ═══ Needs-attention hero — Inbox detail zero-state ════════════════
function RepAttentionHero({ S, autoMode, heldCount, onOpen }) {
  const count = autoMode ? heldCount : S.needsReply;
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div className="neu-raised" style={{ width: '100%', maxWidth: 540, borderRadius: 'var(--r-panel)', background: 'var(--wine-grad)', overflow: 'hidden', padding: '34px 36px', color: 'var(--paper)' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}>Needs your attention</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 14 }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 76, lineHeight: 0.9, color: 'var(--paper)', letterSpacing: '-0.02em' }}>{count}</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 30, color: 'rgba(255,255,255,0.9)', lineHeight: 1 }}>{autoMode ? 'reviews held for you' : 'reviews awaiting reply'}</span>
        </div>

        {/* breakdown */}
        <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          {[
            { n: S.negNeeds, label: 'negative', dot: '#E8B4B4' },
            { n: S.neuNeeds, label: 'neutral', dot: '#E8D7B4' },
            { n: S.posNeeds, label: 'positive', dot: '#B4E8C6' },
          ].map(b => (
            <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 'var(--r-pill)', padding: '7px 14px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.dot }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--paper)' }}>{b.n}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>{b.label}</span>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.16)' }}>
          <span style={{ display: 'flex', color: 'rgba(255,255,255,0.72)' }}><RIconClock size={15} /></span>
          <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.86)' }}>Oldest waiting: <strong style={{ color: 'var(--paper)' }}>{S.oldestDays} days</strong></span>
          <button onClick={onOpen} style={{
            marginLeft: 'auto', border: 'none', cursor: 'pointer',
            background: 'var(--paper)', color: 'var(--wine)', padding: '12px 20px', borderRadius: 'var(--r-button)',
            fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            display: 'inline-flex', alignItems: 'center', gap: 9, boxShadow: 'var(--sh-raised-crisp)', whiteSpace: 'nowrap',
          }}>Open queue <RIconArrow size={14} /></button>
        </div>
      </div>
    </div>
  );
}

// ═══ Inbox tab ═════════════════════════════════════════════════════
function RepInbox({ state, selection, setSelection, autoMode, auto, query }) {
  const D = window.REP_DATA;
  const S = D.summary;

  // threshold-driven partition of the queue
  const needsAll = D.reviews.filter(r => r.status === 'needs');
  const autoList = needsAll.filter(r => autoMode && repAutoPosts(r, auto));
  const heldList = needsAll.filter(r => !autoMode || !repAutoPosts(r, auto));
  const heldCount = heldList.length;
  const autoCount = autoList.length;

  const VIEWS = autoMode
    ? [
        { key: 'needs',       label: 'Needs attention', count: heldCount },
        { key: 'autoreplied', label: 'Auto-replied',    count: autoCount },
        { key: 'all',         label: 'All activity',    count: null },
      ]
    : [
        { key: 'needs',       label: 'Needs reply',   count: S.needsReply },
        { key: 'replied',     label: 'Replied',        count: S.replied },
        { key: 'all',         label: 'All activity',   count: null },
      ];
  const [view, setView] = React.useState('needs');
  React.useEffect(() => { setView('needs'); }, [autoMode]);
  const [sort, setSort] = React.useState('lowest');
  const [sortOpen, setSortOpen] = React.useState(false);

  const [vw, setVw] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1600);
  React.useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  const narrow = vw < 920;

  // build the item list for the active view (unified reviews + feedback)
  const items = React.useMemo(() => {
    const fbs = D.feedback.intercepted;
    let list = [];
    if (view === 'needs') list = heldList.map(r => ({ kind: 'review', id: r.id, ref: r, age: repAgeHours(r.ago) }));
    else if (view === 'autoreplied') list = autoList.map(r => ({ kind: 'review', id: r.id, ref: r, age: repAgeHours(r.ago) }));
    else if (view === 'replied') list = D.reviews.filter(r => r.status === 'replied').map(r => ({ kind: 'review', id: r.id, ref: r, age: repAgeHours(r.ago) }));
    else {
      list = [
        ...heldList.map(r => ({ kind: 'review', id: r.id, ref: r, age: repAgeHours(r.ago) })),
        ...autoList.map(r => ({ kind: 'review', id: r.id, ref: r, age: repAgeHours(r.ago) })),
        ...fbs.map(f => ({ kind: 'feedback', id: f.id, ref: f, age: repAgeHours(f.ago) })),
        ...D.reviews.filter(r => r.status === 'replied').map(r => ({ kind: 'review', id: r.id, ref: r, age: repAgeHours(r.ago) })),
      ];
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(it => it.ref.name.toLowerCase().includes(q) || (it.ref.text || '').toLowerCase().includes(q));
    }
    if (view === 'all') list.sort((a, b) => a.age - b.age);
    else list.sort((a, b) => sort === 'lowest'
      ? ((a.ref.rating || 0) - (b.ref.rating || 0)) || (a.age - b.age)
      : (a.age - b.age));
    return list;
  }, [view, query, sort, autoMode, auto]);

  // resolve selection (works even when the selected item isn't in the active view)
  const resolved = selection
    ? (selection.kind === 'review'
        ? D.reviews.find(r => r.id === selection.id)
        : D.feedback.intercepted.find(f => f.id === selection.id))
    : null;
  // is the resolved review one the AI posted on its own?
  const resolvedAutoPosted = !!(resolved && selection && selection.kind === 'review' && resolved.status === 'needs' && autoMode && repAutoPosts(resolved, auto));

  if (state === 'disconnected') {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <RepInboxKPIs S={S} autoMode={autoMode} heldCount={heldCount} autoCount={autoCount} />
        <RepConnectCard />
      </div>
    );
  }

  const listPane = (
    <div style={{ width: narrow ? '100%' : 348, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: narrow ? 'none' : '1px solid var(--line)' }}>
      {/* view chips + sort */}
      <div style={{ padding: '10px 12px 8px', display: 'flex', gap: 6, flexShrink: 0, borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
        {VIEWS.map(v => {
          const on = view === v.key;
          return (
            <button key={v.key} onClick={() => setView(v.key)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', border: 'none',
              padding: '5px 11px', borderRadius: 'var(--r-pill)', transition: 'all 120ms',
              fontFamily: 'var(--sans)', fontSize: 12, fontWeight: on ? 700 : 500,
              background: on ? 'var(--card)' : 'transparent',
              color: on ? 'var(--wine)' : 'var(--mute)',
              boxShadow: on ? 'var(--sh-raised-crisp)' : 'none',
              whiteSpace: 'nowrap',
            }}>
              {v.key === 'autoreplied' && <IconSpark size={11} />}
              {v.label}
              {v.count != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, padding: '0 5px', borderRadius: 'var(--r-pill)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--wine-tint)' : 'var(--bg)', boxShadow: on ? 'none' : 'var(--sh-inset-crisp)', color: on ? 'var(--wine)' : 'var(--mute)' }}>{v.count}</span>}
            </button>
          );
        })}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button onClick={() => setSortOpen(o => !o)} className="la-btn la-btn--inset la-btn--icon"><IconSort size={13} /></button>
          <RepPopover open={sortOpen} width={190}>
            <RepMenuItem active={sort === 'lowest'} onClick={() => { setSort('lowest'); setSortOpen(false); }}>Lowest rating first</RepMenuItem>
            <RepMenuItem active={sort === 'newest'} onClick={() => { setSort('newest'); setSortOpen(false); }}>Newest first</RepMenuItem>
          </RepPopover>
        </div>
      </div>

      {/* list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {state === 'caughtup' && view === 'needs'
          ? <RepCaughtUp />
          : items.length === 0
            ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute-2)', padding: 40 }}>Nothing here</div>
            : items.map(it => it.kind === 'review'
                ? <RepListCard key={it.id} review={it.ref} active={selection && selection.kind === 'review' && selection.id === it.id} onClick={() => setSelection({ kind: 'review', id: it.id })} autoPosted={autoMode && it.ref.status === 'needs' && repAutoPosts(it.ref, auto)} />
                : <RepFeedbackListCard key={it.id} item={it.ref} active={selection && selection.kind === 'feedback' && selection.id === it.id} onClick={() => setSelection({ kind: 'feedback', id: it.id })} />
              )}
      </div>
    </div>
  );

  const detailPane = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {narrow && resolved && (
        <button onClick={() => setSelection(null)} className="la-btn la-btn--soft" style={{ margin: '10px 0 0 14px', alignSelf: 'flex-start' }}>‹ Back</button>
      )}
      {!resolved
        ? <RepAttentionHero S={S} autoMode={autoMode} heldCount={heldCount} onOpen={() => { setView('needs'); const first = heldList[0] || D.reviews.find(r => r.status === 'needs'); if (first) setSelection({ kind: 'review', id: first.id }); }} />
        : selection.kind === 'review'
          ? <RepReviewDetail review={resolved} autoPosted={resolvedAutoPosted} autoDelay={auto && auto.delay} />
          : <RepFeedbackDetail item={resolved} />}
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <RepInboxKPIs S={S} autoMode={autoMode} heldCount={heldCount} autoCount={autoCount} />
      {autoMode && (
        <div style={{ margin: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--wine-tint)', borderRadius: 'var(--r-surface)', padding: '9px 14px' }}>
          <span style={{ display: 'flex', color: 'var(--wine)' }}><IconSpark size={15} /></span>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}><strong>{auto.threshold}★+ replies post automatically</strong> after {repDelayLabel(auto.delay)}. Only held exceptions — low stars{auto.confidenceHold ? ' and low-confidence drafts' : ''} — wait here for you.</span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', marginTop: 14, borderTop: '1px solid var(--line)' }}>
        {narrow ? (resolved ? detailPane : listPane) : (<>{listPane}{detailPane}</>)}
      </div>
    </div>
  );
}

// ═══ Workspace shell ═══════════════════════════════════════════════
function RepWorkspace({ state = 'connected', defaultTab = 'inbox', autoDefault = 4 }) {
  const D = window.REP_DATA;
  const [tab, setTab] = React.useState(defaultTab);
  const [query, setQuery] = React.useState('');
  React.useEffect(() => { setQuery(''); }, [tab]);
  // The automation rule lives here so the whole workspace reacts to it live.
  const [auto, setAuto] = React.useState(() => ({ ...D.settings.auto, threshold: autoDefault }));
  React.useEffect(() => { setTab(defaultTab); }, [defaultTab]);
  React.useEffect(() => { setAuto(a => ({ ...a, threshold: autoDefault })); }, [autoDefault]);
  const autoMode = auto.threshold !== 'never';

  // held = queue items that do NOT auto-post (exceptions); drives every badge
  const heldCount = React.useMemo(
    () => D.reviews.filter(r => r.status === 'needs' && (!autoMode || !repAutoPosts(r, auto))).length,
    [auto, autoMode]
  );
  const badgeCount = autoMode ? heldCount : D.summary.needsReply;

  // default selection: newest held (exception) review, else newest waiting review
  const initialSel = React.useMemo(() => {
    const held = D.reviews
      .filter(r => r.status === 'needs' && (!autoMode || !repAutoPosts(r, auto)))
      .sort((a, b) => repAgeHours(a.ago) - repAgeHours(b.ago))[0];
    const any = D.reviews.filter(r => r.status === 'needs').sort((a, b) => repAgeHours(a.ago) - repAgeHours(b.ago))[0];
    const pick = held || any;
    return pick ? { kind: 'review', id: pick.id } : null;
  }, []);
  const [selection, setSelection] = React.useState(initialSel);

  const TABS = [
    { key: 'inbox', label: 'Inbox', badge: badgeCount },
    { key: 'analytics', label: 'Analytics' },
    { key: 'settings', label: 'Settings' },
  ];

  const openQueue = () => {
    setTab('inbox');
    const first = D.reviews
      .filter(r => r.status === 'needs' && (!autoMode || !repAutoPosts(r, auto)))
      .sort((a, b) => repAgeHours(a.ago) - repAgeHours(b.ago))[0]
      || D.reviews.filter(r => r.status === 'needs').sort((a, b) => repAgeHours(a.ago) - repAgeHours(b.ago))[0];
    if (first) setSelection({ kind: 'review', id: first.id });
  };

  return (
    <div className="la-app" style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      <Sidebar active="Reputation" badges={{ Reputation: badgeCount }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        {/* page header: title · tabs · platform · queue */}
        <div style={{ height: 64, flexShrink: 0, padding: '0 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mute)' }}>Reputation</span>
          <div className="la-seg">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`la-seg-btn${tab === t.key ? ' on' : ''}`} style={{ transition: 'color 120ms' }}>
                {t.label}
                {t.badge != null && t.key !== tab && <span style={{ marginLeft: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--wine)', display: 'inline-block' }} />}
                {t.badge != null && t.key === tab && <span style={{ marginLeft: 2, fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 700, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 'var(--r-pill)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--wine-grad)', color: 'var(--paper)' }}>{t.badge}</span>}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          {autoMode && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wine)', background: 'var(--wine-tint)', borderRadius: 'var(--r-pill)', padding: '6px 12px' }}><IconSpark size={13} />Auto {auto.threshold}★+</span>
          )}
          {tab === 'inbox' && (
            <div style={{ position: 'relative' }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="neu-input" placeholder="Search inbox…"
                style={{ width: 188, fontSize: 12, padding: '7px 12px 7px 30px', borderRadius: 'var(--r-surface)' }} />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex', pointerEvents: 'none' }}><IconSearch size={13} /></span>
            </div>
          )}
          {state === 'connected' && <RepPlatformCard platform={D.platform} />}
        </div>

        {tab === 'inbox' && <RepInbox state={state} selection={selection} setSelection={setSelection} autoMode={autoMode} auto={auto} query={query} />}
        {tab === 'analytics' && <RepAnalytics autoMode={autoMode} auto={auto} onOpenQueue={openQueue} />}
        {tab === 'settings' && <RepSettings auto={auto} setAuto={setAuto} />}
      </div>
    </div>
  );
}

Object.assign(window, {
  repAgeHours, RepConnectCard, RepCaughtUp, RepPopover, RepMenuItem,
  RepPlatformCard, RepKpiCard, RepInboxKPIs, RepAttentionHero, RepInbox, RepWorkspace,
});
