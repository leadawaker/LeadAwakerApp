// reputation-feedback.jsx — private-feedback pieces for the unified Inbox
// Intercepted negative feedback (caught before it goes public) lives in the Inbox
// alongside public reviews. These render the list card + the contextual detail pane.
// Depends on: components.jsx, reputation-components.jsx, reputation-data.js

// ─── Feedback status pill ────────────────────────────────────────
function RepFbStatusPill({ status, small }) {
  const map = {
    open:     { label: 'Open',     fg: 'var(--wine)', bg: 'var(--wine-tint)' },
    assigned: { label: 'Assigned', fg: 'var(--warn)', bg: 'var(--warn-tint)' },
    resolved: { label: 'Resolved', fg: 'var(--good)', bg: 'var(--good-tint)' },
  };
  const c = map[status] || map.open;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--mono)', fontSize: small ? 8 : 9, fontWeight: 700,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: small ? '2px 7px' : '3px 9px', borderRadius: 'var(--r-pill)',
      color: c.fg, background: c.bg,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.fg }} />{c.label}
    </span>
  );
}

// ═══ Left list card — private feedback ═════════════════════════════
function RepFeedbackListCard({ item, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      borderRadius: 'var(--r-surface)', position: 'relative', cursor: 'pointer',
      background: active ? 'var(--card)' : 'transparent',
      boxShadow: active ? 'var(--sh-raised-crisp)' : 'none',
      transition: 'all 130ms',
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--wine-tint)'; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, background: 'var(--wine)', borderRadius: '0 3px 3px 0' }} />
      <div style={{ padding: '11px 12px', display: 'flex', gap: 11 }}>
        <div style={{ width: 38, height: 38, borderRadius: 'var(--r-surface)', flexShrink: 0, background: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 13, boxShadow: 'var(--sh-raised-crisp)' }}>{item.ini}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            <RepLangBadge lang={item.lang} />
          </div>
          <p style={{ margin: '0 0 7px', fontSize: 12, lineHeight: 1.5, color: 'var(--mute)', textWrap: 'pretty', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.text}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute-2)', letterSpacing: '0.06em' }}>
              <RIconWA size={13} /> {item.job} · {item.ago}
            </span>
            <RepFbStatusPill status={item.status} small />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp conversation bubbles ───────────────────────────────
function RepWAThread({ wa }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {wa.map((m, i) => {
        const biz = m.from === 'biz';
        return (
          <div key={i} style={{ display: 'flex', justifyContent: biz ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '78%', padding: '9px 13px', borderRadius: 14,
              borderBottomRightRadius: biz ? 4 : 14, borderBottomLeftRadius: biz ? 14 : 4,
              background: biz ? 'var(--wine-tint)' : 'var(--card)',
              boxShadow: biz ? 'none' : 'var(--sh-raised-crisp)',
              border: biz ? '1px solid var(--wine-tint)' : 'none',
            }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{m.text}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)', marginTop: 5, textAlign: biz ? 'right' : 'left' }}>{biz ? 'You' : m.from === 'cust' ? 'Customer' : ''} · {m.ago} ago</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══ Right detail pane — private feedback workflow ═════════════════
function RepFeedbackDetail({ item }) {
  const [status, setStatus] = React.useState(item.status);
  const [assignee, setAssignee] = React.useState(item.assignee);
  const [notes, setNotes] = React.useState(item.notes || []);
  const [draft, setDraft] = React.useState('');

  React.useEffect(() => { setStatus(item.status); setAssignee(item.assignee); setNotes(item.notes || []); setDraft(''); }, [item.id]);

  const addNote = () => {
    if (!draft.trim()) return;
    setNotes([...notes, { by: 'Ricardo D.', ago: 'now', text: draft.trim() }]);
    setDraft('');
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* header */}
      <div style={{ flexShrink: 0, padding: '18px 22px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 'var(--r-surface)', flexShrink: 0, background: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 15, boxShadow: 'var(--sh-raised-crisp)' }}>{item.ini}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 7 }}>
              <span className="neu-raised" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--card)', borderRadius: 'var(--r-surface)', padding: '7px 14px' }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', lineHeight: 1, whiteSpace: 'nowrap' }}>{item.name}</span>
                <RepLangBadge lang={item.lang} />
              </span>
              <RepFbStatusPill status={status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RIconWA size={13} /> WhatsApp feedback</span>
              <span style={{ color: 'var(--line-strong)' }}>·</span>
              <span>{item.job}</span>
              <span style={{ color: 'var(--line-strong)' }}>·</span>
              <span>{item.ago} ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* scroll body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* intercept banner */}
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, background: 'var(--wine-tint)', borderRadius: 'var(--r-pill)', padding: '6px 13px' }}>
          <span style={{ display: 'flex', color: 'var(--wine)' }}><RIconFlag size={13} /></span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine)' }}>Intercepted privately — never posted to Google</span>
        </div>

        {/* the feedback */}
        <div className="neu-inset" style={{ borderRadius: 'var(--r-card)', background: 'var(--bg)', padding: '18px 20px', position: 'relative' }}>
          <span style={{ position: 'absolute', top: 8, left: 14, fontFamily: 'var(--serif)', fontSize: 48, lineHeight: 1, color: 'var(--line-strong)' }}>“</span>
          <p style={{ margin: 0, paddingLeft: 22, fontFamily: 'var(--serif)', fontSize: 19, lineHeight: 1.5, color: 'var(--ink-soft)', letterSpacing: '-0.01em', textWrap: 'pretty' }}>{item.text}</p>
        </div>

        {/* WhatsApp context */}
        <div>
          <div className="eyebrow eyebrow-sm" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
            <RIconWA size={13} /> WhatsApp conversation
          </div>
          <RepWAThread wa={item.wa} />
        </div>

        {/* internal notes */}
        <div>
          <div className="eyebrow eyebrow-sm" style={{ marginBottom: 12 }}>Internal notes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notes.length === 0 && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute-2)', letterSpacing: '0.08em' }}>No notes yet — add the first below.</div>}
            {notes.map((n, i) => (
              <div key={i} className="neu-inset" style={{ borderRadius: 'var(--r-surface)', background: 'var(--bg)', padding: '11px 14px' }}>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{n.text}</p>
                <div style={{ marginTop: 7, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>{n.by} · {n.ago === 'now' ? 'just now' : n.ago + ' ago'}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="neu-input" placeholder="Add an internal note (not visible to the customer)…"
                style={{ flex: 1, resize: 'none', fontSize: 12.5, lineHeight: 1.5, padding: '9px 12px', background: 'var(--card)', boxShadow: 'var(--sh-inset-crisp)' }} />
              <button onClick={addNote} className="la-btn la-btn--soft"><RIconNote size={12} />Add</button>
            </div>
          </div>
        </div>
      </div>

      {/* action bar */}
      <div style={{ flexShrink: 0, padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', flexWrap: 'wrap' }}>
        {status !== 'resolved' && (
          <button onClick={() => { setAssignee('Ricardo D.'); setStatus('assigned'); }} className="la-btn la-btn--wine la-btn--lg"><RIconFlag size={14} />{assignee ? 'Reassign' : 'Assign manager'}</button>
        )}
        <button onClick={() => setStatus('resolved')} className={`la-btn la-btn--lg ${status === 'resolved' ? 'la-btn--inset' : 'la-btn--soft'}`}>
          {status === 'resolved' ? '✓ Resolved' : 'Mark resolved'}
        </button>
        {assignee && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute)' }}>
            Assigned to <span style={{ color: 'var(--wine)', fontWeight: 700 }}>{assignee}</span>
          </span>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { RepFbStatusPill, RepFeedbackListCard, RepWAThread, RepFeedbackDetail });
