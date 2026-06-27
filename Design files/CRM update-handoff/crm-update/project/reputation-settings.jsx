// reputation-settings.jsx — Settings tab: configure the whole reputation service.
// Two halves, independent of each other:
//   1. REQUEST  — ask the customer for a review via WhatsApp (review generation)
//   2. REPLY    — reply to whatever review lands on Google (AI-drafted)
// Automation is a STAR-THRESHOLD rule (not a manual/auto switch): replies at or
// above the threshold post hands-free; everything below routes to the queue.
// Depends on: components.jsx, reputation-components.jsx, reputation-data.js

// ─── Toggle switch ───────────────────────────────────────────────
function RepToggle({ on, onChange, size = 'md' }) {
  const w = size === 'sm' ? 38 : 46, h = size === 'sm' ? 22 : 26, k = h - 6;
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{
      width: w, height: h, flexShrink: 0, border: 'none', cursor: 'pointer', padding: 0,
      borderRadius: 'var(--r-pill)', position: 'relative', transition: 'background 180ms',
      background: on ? 'var(--wine)' : 'var(--bg)',
      boxShadow: on ? 'var(--sh-raised-crisp), inset 0 1px 2px rgba(0,0,0,0.18)' : 'var(--sh-inset-crisp)',
    }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? w - k - 3 : 3, width: k, height: k,
        borderRadius: '50%', background: on ? 'var(--paper)' : 'var(--card)',
        boxShadow: 'var(--sh-raised-crisp)', transition: 'left 180ms',
      }} />
    </button>
  );
}

// ─── Setting row (label + description + control) ─────────────────
function RepSettingRow({ title, desc, children, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, padding: '15px 0', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        {desc && <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--mute)', marginTop: 3, textWrap: 'pretty' }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, paddingTop: 1 }}>{children}</div>
    </div>
  );
}

// ─── Settings panel shell ────────────────────────────────────────
function RepSettingsPanel({ eyebrow, title, desc, children, accent }) {
  return (
    <div className="neu-raised" style={{ borderRadius: 'var(--r-card)', background: 'var(--card)', overflow: 'hidden' }}>
      {accent && <div style={{ height: 3, background: accent }} />}
      <div style={{ padding: '20px 24px 8px' }}>
        <div className="eyebrow eyebrow-sm" style={{ color: 'var(--wine)' }}>{eyebrow}</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink)', lineHeight: 1.15, marginTop: 6 }}>{title}</div>
        {desc && <p style={{ margin: '7px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--mute)', maxWidth: 620, textWrap: 'pretty' }}>{desc}</p>}
      </div>
      <div style={{ padding: '4px 24px 18px' }}>{children}</div>
    </div>
  );
}

// ─── Stepper (number with − / +) ─────────────────────────────────
function RepStepper({ value, onChange, min = 0, max = 99, step = 1, suffix }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-button)', padding: 3 }}>
      <button onClick={() => onChange(Math.max(min, value - step))} className="la-btn la-btn--soft la-btn--icon" style={{ width: 26, height: 26 }}>−</button>
      <span style={{ minWidth: 54, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{value}{suffix ? ` ${suffix}` : ''}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} className="la-btn la-btn--soft la-btn--icon" style={{ width: 26, height: 26 }}>+</button>
    </div>
  );
}

// ─── Editable message template ───────────────────────────────────
function RepTemplate({ icon, label, tint, value, onChange }) {
  return (
    <div style={{ borderRadius: 'var(--r-surface)', background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span style={{ width: 24, height: 24, borderRadius: 'var(--r-button)', background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)' }}>{icon}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>{label}</span>
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
        style={{ width: '100%', border: 'none', background: 'var(--card)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-button)', outline: 'none', resize: 'vertical', fontFamily: 'var(--sans)', fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)', padding: '10px 12px' }} />
    </div>
  );
}

// ─── Token chips for templates ───────────────────────────────────
function RepTokenRow({ tokens }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)', alignSelf: 'center', marginRight: 2 }}>Insert:</span>
      {tokens.map(t => (
        <span key={t} style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--wine)', background: 'var(--wine-tint)', borderRadius: 'var(--r-flush)', padding: '3px 8px', cursor: 'default' }}>{`{{${t}}}`}</span>
      ))}
    </div>
  );
}

// ─── Keyword chips (editable) ────────────────────────────────────
function RepKeywordChips({ words, onChange }) {
  const [draft, setDraft] = React.useState('');
  const add = () => { const w = draft.trim().toLowerCase(); if (w && !words.includes(w)) onChange([...words, w]); setDraft(''); };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', justifyContent: 'flex-end', maxWidth: 360 }}>
      {words.map(w => (
        <span key={w} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--wine)', background: 'var(--wine-tint)', borderRadius: 'var(--r-flush)', padding: '4px 4px 4px 9px' }}>
          {w}
          <button onClick={() => onChange(words.filter(x => x !== w))} aria-label={`Remove ${w}`} style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--wine)', display: 'flex', padding: 2, lineHeight: 1, fontSize: 13 }}>×</button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        className="neu-input" placeholder="+ add word" style={{ width: 100, fontSize: 11.5, padding: '6px 10px' }} />
    </div>
  );
}

// ─── Two-step model explainer (non-gating) ───────────────────────
// NOTE: this intentionally does NOT branch happy→Google / unhappy→private.
// TODO (review-gating policy): a "positive → public review link, negative →
//   private channel" branch is review-gating and may violate Google's review
//   policies. Do not hardcode that branch — confirm policy + compliance first.
function RepTwoStep({ channel }) {
  const Step = ({ n, icon, tint, title, desc }) => (
    <div style={{ flex: 1, minWidth: 0, borderRadius: 'var(--r-surface)', background: 'var(--card)', boxShadow: 'var(--sh-raised-crisp)', padding: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <span style={{ width: 28, height: 28, borderRadius: 'var(--r-button)', background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--paper)', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>Step {n}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>{title}</div>
      <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--mute)', marginTop: 5, textWrap: 'pretty' }}>{desc}</div>
    </div>
  );
  return (
    <div style={{ background: 'var(--bg)', boxShadow: 'var(--sh-inset-crisp)', borderRadius: 'var(--r-card)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
        <Step n="1" icon={channel === 'sms' ? <RIconSms size={15} /> : <RIconWA size={15} />} tint="var(--good)" title="Ask for a review" desc={`We message the customer on ${channel === 'sms' ? 'SMS' : 'WhatsApp'} inviting them to leave a Google review.`} />
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--mute-2)' }}><RIconArrow size={18} /></div>
        <Step n="2" icon={<RIconStarF size={14} />} tint="var(--wine-grad)" title="Reply to what lands on Google" desc="Whatever review they post, the AI drafts a public reply — posted for you or queued, per your rule." />
      </div>
      <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.04em', color: 'var(--mute)', lineHeight: 1.5 }}>
        Step 2 runs with or without Step 1 — you can reply to organic reviews even if you never send a request.
      </div>
    </div>
  );
}

// ─── Plain-language readback of the automation rule ──────────────
function repRuleSummary(auto) {
  if (auto.threshold === 'never') {
    return 'Nothing is auto-posted — every AI reply waits for your approval.';
  }
  const band = auto.threshold === 5 ? '5★' : auto.threshold === 4 ? '4–5★' : '3–5★';
  const below = auto.threshold === 5 ? '1–4★' : auto.threshold === 4 ? '1–3★' : '1–2★';
  const delay = auto.delay === '15m' ? '15 minutes' : auto.delay === '2h' ? '2 hours' : '1 hour';
  let s = `${band} reviews are answered automatically after ${delay}. ${below} wait for your approval.`;
  if (auto.confidenceHold) s += ` Any AI reply under ${auto.confidenceMin}% confidence is held too.`;
  return s;
}

// ═══ Settings tab ══════════════════════════════════════════════════
function RepSettings({ auto, setAuto }) {
  const D = window.REP_DATA;
  const init = D.settings;
  const setA = (k, v) => setAuto(s => ({ ...s, [k]: v }));
  const [reply, setReply] = React.useState(init.reply);
  const [req, setReq] = React.useState(init.request);
  const [esc, setEsc] = React.useState(init.escalation);
  const [ref, setRef] = React.useState(init.referral);
  const setR = (k, v) => setReply(s => ({ ...s, [k]: v }));
  const setTone = (sent, v) => setReply(s => ({ ...s, toneBySentiment: { ...s.toneBySentiment, [sent]: v } }));
  const setG = (k, v) => setReply(s => ({ ...s, guardrails: { ...s.guardrails, [k]: v } }));
  const setQ = (k, v) => setReq(s => ({ ...s, [k]: v }));
  const setE = (k, v) => setEsc(s => ({ ...s, [k]: v }));
  const setRf = (k, v) => setRef(s => ({ ...s, [k]: v }));

  const THRESHOLDS = [{ v: 'never', l: 'Never' }, { v: 5, l: '5★+' }, { v: 4, l: '4★+' }, { v: 3, l: '3★+' }];
  const DELAYS = [{ v: '15m', l: '15 min' }, { v: '1h', l: '1 h' }, { v: '2h', l: '2 h' }];
  const isAuto = auto.threshold !== 'never';

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── 1 · Automation rule (headline) ── */}
        <RepSettingsPanel eyebrow="Step 2 · Automation rule" accent="var(--wine-grad)"
          title="Auto-post replies by star rating"
          desc="Set the threshold and Lead Awaker posts AI replies on its own. Anything below it routes to your queue. Manual is just the far end of the same dial — set it to “Never” and every reply waits for you.">

          <RepSettingRow title="Auto-post replies to reviews rated" desc="Reviews at or above this rating get their AI reply posted automatically.">
            <div className="la-seg">
              {THRESHOLDS.map(t => <button key={String(t.v)} onClick={() => setA('threshold', t.v)} className={`la-seg-btn${auto.threshold === t.v ? ' on' : ''}`}>{t.l}</button>)}
            </div>
          </RepSettingRow>

          {/* live plain-language readback */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, background: isAuto ? 'var(--wine-tint)' : 'var(--bg)', boxShadow: isAuto ? 'none' : 'var(--sh-inset-crisp)', borderRadius: 'var(--r-surface)', padding: '13px 15px', margin: '4px 0 2px' }}>
            <span style={{ display: 'flex', color: 'var(--wine)', marginTop: 1 }}><IconSpark size={16} /></span>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)' }}>{repRuleSummary(auto)}</div>
          </div>

          {isAuto && (
            <>
              <RepSettingRow title="Auto-post delay" desc="Wait before posting so replies feel considered, not robotic.">
                <div className="la-seg">
                  {DELAYS.map(d => <button key={d.v} onClick={() => setA('delay', d.v)} className={`la-seg-btn${auto.delay === d.v ? ' on' : ''}`}>{d.l}</button>)}
                </div>
              </RepSettingRow>
              <RepSettingRow title="Hold low-confidence replies" desc="Hold any AI reply below this confidence for your review — even if it clears the star threshold.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {auto.confidenceHold && <RepStepper value={auto.confidenceMin} onChange={(v) => setA('confidenceMin', v)} min={50} max={95} step={5} suffix="%" />}
                  <RepToggle on={auto.confidenceHold} onChange={(v) => setA('confidenceHold', v)} />
                </div>
              </RepSettingRow>
              <RepSettingRow title="Always hold negative reviews" desc="1–3★ reviews wait for a human before anything posts, regardless of the threshold." last>
                <RepToggle on={auto.holdNegative} onChange={(v) => setA('holdNegative', v)} />
              </RepSettingRow>
            </>
          )}
        </RepSettingsPanel>

        {/* ── 2 · Reply voice & guardrails ── */}
        <RepSettingsPanel eyebrow="How replies sound" accent="var(--stage-contacted)"
          title="Reply voice & guardrails"
          desc="How the AI writes your public Google replies — and the lines it must never cross when posting on its own.">

          <div className="eyebrow eyebrow-sm" style={{ marginBottom: 4, marginTop: 4 }}>Default tone by sentiment</div>
          {[{ k: 'negative', l: 'Negative reviews' }, { k: 'neutral', l: 'Neutral reviews' }, { k: 'positive', l: 'Positive reviews' }].map((s, i) => (
            <RepSettingRow key={s.k} title={s.l} last={i === 2}>
              <div className="la-seg">
                {D.tones.map(t => <button key={t.key} onClick={() => setTone(s.k, t.key)} className={`la-seg-btn${reply.toneBySentiment[s.k] === t.key ? ' on' : ''}`}>{t.label}</button>)}
              </div>
            </RepSettingRow>
          ))}

          <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />

          <RepSettingRow title="Reply language" desc="Auto matches the reviewer's language; or force one for every reply.">
            <div className="la-seg">
              {[{ v: 'auto', l: 'Auto' }, { v: 'nl', l: 'NL' }, { v: 'en', l: 'EN' }].map(o => <button key={o.v} onClick={() => setR('language', o.v)} className={`la-seg-btn${reply.language === o.v ? ' on' : ''}`}>{o.l}</button>)}
            </div>
          </RepSettingRow>
          <RepSettingRow title="Reply length">
            <div className="la-seg">
              {[{ v: 'short', l: 'Short' }, { v: 'standard', l: 'Standard' }, { v: 'detailed', l: 'Detailed' }].map(o => <button key={o.v} onClick={() => setR('length', o.v)} className={`la-seg-btn${reply.length === o.v ? ' on' : ''}`}>{o.l}</button>)}
            </div>
          </RepSettingRow>
          <RepSettingRow title="Business signature" desc="Signs off every posted reply with this name.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input value={reply.signOff} onChange={(e) => setR('signOff', e.target.value)} className="neu-input" style={{ width: 130, fontSize: 12.5, padding: '8px 12px' }} />
              <RepToggle on={reply.includeName} onChange={(v) => setR('includeName', v)} />
            </div>
          </RepSettingRow>

          <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
          <div className="eyebrow eyebrow-sm" style={{ marginBottom: 2 }}>Guardrails (enforced in auto mode)</div>
          <RepSettingRow title="Never admit legal fault" desc="Keeps public replies from conceding liability.">
            <RepToggle on={reply.guardrails.noLegalFault} onChange={(v) => setG('noLegalFault', v)} />
          </RepSettingRow>
          <RepSettingRow title="Never offer refunds or compensation publicly" desc="Money talk moves to a private channel, never a Google reply.">
            <RepToggle on={reply.guardrails.noPublicComp} onChange={(v) => setG('noPublicComp', v)} />
          </RepSettingRow>
          <RepSettingRow title="Never discuss specifics — escalate instead" desc="If a reply would need case details, hold it and escalate to a human." last>
            <RepToggle on={reply.guardrails.noSpecificsEscalate} onChange={(v) => setG('noSpecificsEscalate', v)} />
          </RepSettingRow>
        </RepSettingsPanel>

        {/* ── 3 · Review requests (WhatsApp) ── */}
        <RepSettingsPanel eyebrow="Step 1 · Generate reviews" accent="var(--good)"
          title="Review requests"
          desc="Two steps, independent of each other: first we ask the customer for a review; then we reply to whatever lands on Google. You can run either on its own.">
          <RepTwoStep channel={req.channel} />

          <div style={{ marginTop: 8 }}>
            <RepSettingRow title="Send review requests" desc="Master switch for the WhatsApp ask flow (Step 1).">
              <RepToggle on={req.enabled} onChange={(v) => setQ('enabled', v)} />
            </RepSettingRow>
            <RepSettingRow title="Channel">
              <div className="la-seg">
                <button onClick={() => setQ('channel', 'whatsapp')} className={`la-seg-btn${req.channel === 'whatsapp' ? ' on' : ''}`}><RIconWA size={13} />WhatsApp</button>
                <button onClick={() => setQ('channel', 'sms')} className={`la-seg-btn${req.channel === 'sms' ? ' on' : ''}`}><RIconSms size={13} />SMS</button>
              </div>
            </RepSettingRow>
            <RepSettingRow title="Ask after job completion" desc="Give the customer time to settle in before asking for a review.">
              <RepStepper value={req.triggerDays} onChange={(v) => setQ('triggerDays', v)} min={1} max={30} step={1} suffix="days" />
            </RepSettingRow>
            <RepSettingRow title="One follow-up nudge" desc={`Send a single reminder ${req.followUpDays} days later if there's no response.`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {req.followUp && <RepStepper value={req.followUpDays} onChange={(v) => setQ('followUpDays', v)} min={1} max={14} step={1} suffix="days" />}
                <RepToggle on={req.followUp} onChange={(v) => setQ('followUp', v)} />
              </div>
            </RepSettingRow>
            <RepSettingRow title="Frequency cap" desc="Don't ask the same customer for a review more than once within this window." last>
              <RepStepper value={req.frequencyCapDays} onChange={(v) => setQ('frequencyCapDays', v)} min={7} max={365} step={7} suffix="days" />
            </RepSettingRow>
          </div>

          {/* template */}
          <div style={{ marginTop: 14 }}>
            <div className="eyebrow eyebrow-sm" style={{ marginBottom: 12 }}>Message template</div>
            <RepTemplate icon={req.channel === 'sms' ? <RIconSms size={13} /> : <RIconWA size={13} />} tint="var(--good)" label="The ask" value={req.template} onChange={(v) => setQ('template', v)} />
            <RepTokenRow tokens={['name', 'company', 'job', 'review_link']} />
          </div>
        </RepSettingsPanel>

        {/* ── 4 · Ask for referrals (Phase 4) ── */}
        <RepSettingsPanel eyebrow="Step 3 · Grow by word of mouth" accent="var(--good)"
          title="Ask for referrals"
          desc="The natural next beat after a great review: ask your happiest customers to pass your name along. The engine sends the ask and tracks who replies — you work the names it brings back on the Referrals page.">

          <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'var(--wine-tint)', borderRadius: 'var(--r-surface)', padding: '11px 14px', margin: '4px 0 6px' }}>
            <span style={{ display: 'flex', color: 'var(--wine)' }}><IconGift size={16} /></span>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-soft)' }}>Review → reply → <strong>referral ask</strong>. Lives on its own <strong>Referrals</strong> page; this just turns the ask on and sets its voice.</span>
          </div>

          <RepSettingRow title="Ask happy customers for a referral" desc="Master switch. When on, a referral ask follows a great review automatically.">
            <RepToggle on={ref.enabled} onChange={(v) => setRf('enabled', v)} />
          </RepSettingRow>
          <RepSettingRow title="Only ask customers who rated" desc="Keep the ask to your genuine promoters — not lukewarm reviewers.">
            <div className="la-seg">
              {[5, 4].map(n => <button key={n} onClick={() => setRf('askMin', n)} className={`la-seg-btn${ref.askMin === n ? ' on' : ''}`}>{n}★+</button>)}
            </div>
          </RepSettingRow>
          <RepSettingRow title="Send the ask after the review" desc="A short pause so the ask doesn't pile on top of your reply.">
            <RepStepper value={ref.delayDays} onChange={(v) => setRf('delayDays', v)} min={0} max={14} step={1} suffix="days" />
          </RepSettingRow>
          <RepSettingRow title="Incentive framing" desc="How the ask is sweetened. Reward and charity framings both lift reply rates.">
            <div className="la-seg">
              {[{ v: 'neutral', l: 'None' }, { v: 'reward', l: 'Reward' }, { v: 'charity', l: 'Charity' }].map(o => <button key={o.v} onClick={() => setRf('framing', o.v)} className={`la-seg-btn${ref.framing === o.v ? ' on' : ''}`}>{o.l}</button>)}
            </div>
          </RepSettingRow>
          {ref.framing === 'reward' && (
            <RepSettingRow title="Reward offered" desc="Applied to the referrer's next job when their referral books." last>
              <input value={ref.reward} onChange={(e) => setRf('reward', e.target.value)} className="neu-input" style={{ width: 140, fontSize: 12.5, padding: '8px 12px' }} />
            </RepSettingRow>
          )}

          {/* template */}
          <div style={{ marginTop: 14 }}>
            <div className="eyebrow eyebrow-sm" style={{ marginBottom: 12 }}>Ask template</div>
            <RepTemplate icon={<IconGift size={13} />} tint="var(--good)" label="The referral ask" value={ref.template} onChange={(v) => setRf('template', v)} />
            <RepTokenRow tokens={['name', 'company', 'reward', 'review_link']} />
          </div>
        </RepSettingsPanel>

        {/* ── 5 · Escalation & notifications ── */}
        <RepSettingsPanel eyebrow="Safety net" accent="var(--warn)"
          title="Escalation & notifications"
          desc="Make sure the reviews that matter reach a human fast — even when everything else is hands-free.">
          <RepSettingRow title="Escalate every 1★ review" desc="A one-star review always goes to a manager, never just an auto-reply.">
            <RepToggle on={esc.onOneStar} onChange={(v) => setE('onOneStar', v)} />
          </RepSettingRow>
          <RepSettingRow title="Escalate low-confidence drafts" desc={`When the AI is unsure (below ${auto.confidenceMin}%), route it to a human instead of posting.`}>
            <RepToggle on={esc.onLowConfidence} onChange={(v) => setE('onLowConfidence', v)} />
          </RepSettingRow>
          <RepSettingRow title="Escalate on keywords" desc="Any review mentioning these words is held and escalated immediately.">
            <RepKeywordChips words={esc.keywords} onChange={(v) => setE('keywords', v)} />
          </RepSettingRow>
          <RepSettingRow title="Notify via">
            <div className="la-seg">
              {[{ v: 'email', l: 'Email' }, { v: 'whatsapp', l: 'WhatsApp' }, { v: 'slack', l: 'Slack' }].map(o => <button key={o.v} onClick={() => setE('notifyChannel', o.v)} className={`la-seg-btn${esc.notifyChannel === o.v ? ' on' : ''}`}>{o.l}</button>)}
            </div>
          </RepSettingRow>
          <RepSettingRow title="Default escalation owner">
            <div className="la-seg">
              {['Ricardo D.', 'Sanne K.'].map(n => <button key={n} onClick={() => setE('assignee', n)} className={`la-seg-btn${esc.assignee === n ? ' on' : ''}`}>{n}</button>)}
            </div>
          </RepSettingRow>
          <RepSettingRow title="Daily reputation digest" desc="One email each morning: new reviews, replies posted, anything waiting." last>
            <RepToggle on={esc.dailyDigest} onChange={(v) => setE('dailyDigest', v)} />
          </RepSettingRow>
        </RepSettingsPanel>

        {/* save bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 4px 8px' }}>
          <button className="la-btn la-btn--wine la-btn--lg"><IconCheck size={14} />Save changes</button>
          <button className="la-btn la-btn--soft la-btn--lg">Discard</button>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mute-2)' }}>
            Rule: <span style={{ color: 'var(--wine)', fontWeight: 700 }}>{auto.threshold === 'never' ? 'Manual' : `Auto ${auto.threshold}★+`}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  RepToggle, RepSettingRow, RepSettingsPanel, RepStepper, RepTemplate, RepTokenRow,
  RepKeywordChips, RepTwoStep, repRuleSummary, RepSettings,
});
