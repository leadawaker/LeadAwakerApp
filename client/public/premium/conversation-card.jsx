// ConversationCard and its sub-components (used by Hero)

/* inject typing-dot keyframe + niche button hover once */
(function() {
  if (document.getElementById('_typing-kf')) return;
  const s = document.createElement('style');
  s.id = '_typing-kf';
  s.textContent = `
    @keyframes typingDot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
    .niche-btn:not([aria-pressed="true"]):hover{background:rgba(94,34,48,0.07)!important;color:var(--wine)!important;}
    .niche-btn:not([aria-pressed="true"]):hover span{color:var(--wine)!important;}
  `;
  document.head.appendChild(s);
})();

/* animation timing — delay = read(prev) + type(curr), same-direction skips read */
const READ_AGENT = 32,  TYPE_AGENT = 65,  MIN_AGENT = 2000, MAX_AGENT = 8000;
const READ_USER  = 22,  TYPE_USER  = 52,  MIN_USER  = 900,  MAX_USER  = 3800;
const INITIAL_TYPING = 2400, SYSTEM_GAP = 380, READ_RECEIPT_LEAD = 700, BOOKING_GAP = 7000, BOOKING_READ_LEAD = 3500;
const RESTART_PAUSE = 4000;
const NICHE_ORDER = ['kitchen', 'flooring', 'wellness', 'landscaping', 'roofing'];
const COUNTDOWN_SECS = 5;

/* --------------------------- CONVERSATION CARD --------------------------- */
function ConversationCard({ niche, onSetNiche }) {
  const isMobile = window.useIsMobile();
  const isTabletOrBelow = window.useIsMobile(1280);
  const { t, lang } = window.useI18n();
  const data = CHAT_CASES[niche] || CHAT_CASES.kitchen;
  const nlMessages = (window.TRANSLATIONS?.[lang]?.chatMessages || {})[niche];
  const messages = Array.isArray(nlMessages) ? nlMessages : data.messages;

  const [visible,      setVisible]      = React.useState([]);
  const [readReceipts, setReadReceipts] = React.useState(new Set());
  const [initTyping,   setInitTyping]   = React.useState(true);
  const [followMode,   setFollowMode]   = React.useState(true);

  const [autoAdvancing, setAutoAdvancing] = React.useState(false);
  const [cdSecsLeft,    setCdSecsLeft]    = React.useState(COUNTDOWN_SECS);

  const scrollRef          = React.useRef(null);
  const timeoutsRef        = React.useRef([]);
  const followRef          = React.useRef(true);
  const programmaticRef    = React.useRef(false);
  const countdownRef       = React.useRef(null);
  const nicheRef           = React.useRef(niche);

  React.useEffect(() => { nicheRef.current = niche; }, [niche]);

  React.useEffect(() => { followRef.current = followMode; }, [followMode]);

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    programmaticRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setTimeout(() => { programmaticRef.current = false; }, 600);
  }, []);

  React.useEffect(() => {
    if (followMode) scrollToBottom();
  }, [visible, initTyping, followMode, scrollToBottom]);

  const cancelCountdown = React.useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setAutoAdvancing(false);
    setCdSecsLeft(COUNTDOWN_SECS);
  }, []);

  const handleScroll = React.useCallback(() => {
    if (programmaticRef.current) return;
    if (countdownRef.current) cancelCountdown();
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setFollowMode(atBottom);
  }, [cancelCountdown]);

  /* main animation loop — auto-advance when niche changes */
  React.useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setAutoAdvancing(false);
    setCdSecsLeft(COUNTDOWN_SECS);
    setVisible([]);
    setReadReceipts(new Set());
    setInitTyping(true);
    setFollowMode(true);
    followRef.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    /* compute absolute arrival time — delay = read(prev) + type(curr) */
    let acc = 0;
    const times = messages.map((msg, i) => {
      if (i === 0) { acc = INITIAL_TYPING; return acc; }
      if (msg.type === 'system') { acc += msg.wine ? BOOKING_GAP : SYSTEM_GAP; return acc; }

      const prev    = messages[i - 1];
      const prevLen = prev?.content?.length ?? 0;
      const currLen = msg.content.length;
      const sameDir = prev?.type === msg.type;

      if (msg.type === 'agent') {
        const read = sameDir ? 0 : prevLen * READ_AGENT;
        const type = currLen * TYPE_AGENT;
        acc += Math.min(Math.max(read + type, MIN_AGENT), MAX_AGENT);
      } else {
        const read = sameDir ? 0 : prevLen * READ_USER;
        const type = currLen * TYPE_USER;
        acc += Math.min(Math.max(read + type, MIN_USER), MAX_USER);
      }
      return acc;
    });

    /* clear initial typing indicator at first message */
    timeoutsRef.current.push(setTimeout(() => setInitTyping(false), INITIAL_TYPING));

    messages.forEach((msg, i) => {
      timeoutsRef.current.push(setTimeout(() => {
        setVisible(prev => [...prev, i]);
      }, times[i]));

      if (msg.type === 'user') {
        for (let j = i - 1; j >= 0; j--) {
          if (messages[j].type === 'agent') {
            const rrTime = Math.max(times[j] + 500, times[i] - READ_RECEIPT_LEAD);
            timeoutsRef.current.push(setTimeout(() => {
              setReadReceipts(prev => new Set([...prev, j]));
            }, rrTime));
          } else if (messages[j].type === 'user') {
            break;
          }
        }
      }

      if (msg.type === 'system' && msg.wine) {
        for (let j = i - 1; j >= 0; j--) {
          if (messages[j].type === 'agent') {
            const rrTime = Math.max(times[j] + 800, times[i] - BOOKING_READ_LEAD);
            timeoutsRef.current.push(setTimeout(() => {
              setReadReceipts(prev => new Set([...prev, j]));
            }, rrTime));
            break;
          } else if (messages[j].type === 'user') {
            break;
          }
        }
      }
    });

    const lastTime = times[times.length - 1] ?? INITIAL_TYPING;
    timeoutsRef.current.push(setTimeout(() => {
      let secs = COUNTDOWN_SECS;
      setCdSecsLeft(secs);
      setAutoAdvancing(true);
      countdownRef.current = setInterval(() => {
        secs -= 1;
        setCdSecsLeft(secs);
        if (secs <= 0) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          setAutoAdvancing(false);
          setCdSecsLeft(COUNTDOWN_SECS);
          const idx = NICHE_ORDER.indexOf(nicheRef.current);
          onSetNiche(NICHE_ORDER[(idx + 1) % NICHE_ORDER.length]);
        }
      }, 1000);
    }, lastTime + RESTART_PAUSE));

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };
  }, [niche]);

  const visibleCount = visible.length;
  const nextMsgType  = messages[visibleCount]?.type;
  const showTyping   = initTyping || (
    visibleCount > 0 && visibleCount < messages.length && nextMsgType !== 'system'
  );
  const typingDir = initTyping
    ? (messages[0]?.type === 'user' ? 'user' : 'agent')
    : nextMsgType;

  return (
    <div className="glass" style={{
      padding: isMobile ? "18px 16px 14px" : "24px 22px 20px",
      backdropFilter: "saturate(160%) blur(14px)",
      WebkitBackdropFilter: "saturate(160%) blur(14px)",
      width: "100%", position: "relative", zIndex: 1,
      display: "flex",
      minHeight: isMobile ? 600 : (isTabletOrBelow ? 510 : 580),
      height: isMobile ? "620px" : (isTabletOrBelow ? "540px" : "450px"),
      flexDirection: "column", fontWeight: "100", borderRadius: "10px"
    }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        paddingBottom: 18, marginBottom: 18,
        borderBottom: "1px solid var(--line)"
      }}>
        <div className="neu-polished-crisp" style={{
          width: 40, height: 40, borderRadius: 999, flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--serif)", fontSize: 20, color: "var(--ink)", fontStyle: "italic"
        }}>{data.avatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{data.leadName}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2, gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--ink)", fontFamily: "var(--mono)", letterSpacing: "0.04em" }}>{data.project}</div>
            <div style={{ fontSize: 10, color: "var(--ink)", fontFamily: "var(--mono)", letterSpacing: "0.04em", opacity: 0.7, whiteSpace: "nowrap" }}>{t('hero.conv_enquired')} {data.ago.split(' ')[0]} {t('convUI.months_ago')}</div>
          </div>
        </div>
      </div>

      {/* Scrollable message area */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            position: "absolute", inset: 0,
            overflowY: "auto", overflowX: "hidden",
            paddingRight: 4,
            scrollbarWidth: "none"
          }}
        >
          {visible.map(i => {
            const msg = messages[i];
            if (!msg) return null;
            if (msg.type === 'system') {
              return (
                <FadeIn key={i}>
                  <Divider label={msg.content} tone={msg.wine ? 'wine' : null} />
                </FadeIn>
              );
            }
            return (
              <FadeIn key={i}>
                <Msg
                  from={msg.type === 'agent' ? 'firm' : 'lead'}
                  time={msg.time}
                  readReceipt={readReceipts.has(i)}
                >
                  {msg.content}
                </Msg>
              </FadeIn>
            );
          })}

          {showTyping && <TypingBubble dir={typingDir} />}
        </div>

        {/* Follow-mode re-engage button */}
        {!followMode && (
          <button
            onClick={() => { setFollowMode(true); scrollToBottom(); }}
            style={{
              position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
              display: "flex", alignItems: "center", gap: 5,
              background: "var(--paper)", border: "1px solid var(--line)",
              color: "var(--mute)", fontFamily: "var(--mono)", fontSize: 10,
              letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "6px 14px", borderRadius: 999,
              cursor: "pointer", zIndex: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M5 1v8M2 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('hero.conv_live')}
          </button>
        )}
      </div>

      {/* Countdown bar */}
      {autoAdvancing && (() => {
        const nextIdx = (NICHE_ORDER.indexOf(niche) + 1) % NICHE_ORDER.length;
        const nextLabel = CHAT_CASES[NICHE_ORDER[nextIdx]]?.label;
        return (
          <div style={{ marginTop: 10 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute)",
              letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5
            }}>
              <span>{t('hero.conv_next')} {nextLabel}</span>
              <span>{cdSecsLeft}s</span>
            </div>
            <div style={{ height: 2, background: "var(--line)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: "var(--wine)", borderRadius: 1,
                width: `${(cdSecsLeft / COUNTDOWN_SECS) * 100}%`,
                transition: "width 900ms linear"
              }} />
            </div>
          </div>
        );
      })()}

      <NicheSwitcher value={niche} onChange={onSetNiche} />
    </div>);
}

/* ----------------------------- SUB-COMPONENTS ---------------------------- */

function FadeIn({ children }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => { const id = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(id); }, []);
  return (
    <div style={{
      opacity: show ? 1 : 0,
      transform: show ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 320ms ease, transform 320ms ease'
    }}>
      {children}
    </div>);
}

function TypingBubble({ dir }) {
  const isFirm = dir === 'agent';
  return (
    <div style={{ display: "flex", justifyContent: isFirm ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{
        background: isFirm
          ? "linear-gradient(145deg, #2A241C, #1A150F)"
          : "linear-gradient(145deg, var(--paper), var(--bg-2))",
        padding: "14px 16px", borderRadius: 8,
        display: "flex", gap: 5, alignItems: "center",
        boxShadow: isFirm ? "0 1px 2px rgba(20,15,10,0.18), 0 6px 14px -8px rgba(20,15,10,0.25)" : "var(--sh-inset-crisp)"
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display: "inline-block",
            width: 6, height: 6, borderRadius: "50%",
            background: isFirm ? "rgba(244,239,227,0.65)" : "var(--mute)",
            animation: `typingDot 1.4s ${i * 0.2}s infinite ease-in-out`
          }} />
        ))}
      </div>
    </div>);
}

function CheckCheckIcon() {
  return (
    <svg width="14" height="9" viewBox="0 0 14 9" fill="none" aria-hidden>
      <path d="M1 4.5l3 3L9 1" stroke="rgba(255,255,255,0.75)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 4.5l3 3 5-7" stroke="rgba(255,255,255,0.75)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}

function NicheSwitcher({ value, onChange }) {
  const { t } = window.useI18n();
  const items = Object.keys(CHAT_CASES).map(k => ({ k, label: t('convUI.niche_' + k) || CHAT_CASES[k].label, icon: NICHE_ICONS[k] }));
  return (
    <div style={{
      marginTop: 8, padding: 6, borderRadius: 10,
      display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4
    }}>
      {items.map((it) => {
        const on = it.k === value;
        return (
          <button
            key={it.k}
            onClick={() => onChange(it.k)}
            className="niche-btn"
            style={{
              border: "none",
              cursor: "pointer", padding: "10px 4px 8px",
              borderRadius: 7,
              background: on ?
              "linear-gradient(145deg, var(--paper), var(--bg-2))" :
              "transparent",
              boxShadow: on ? "var(--sh-raised-crisp)" : "none",
              color: on ? "var(--ink)" : "var(--mute)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              transition: "all 200ms ease"
            }}
            aria-pressed={on}>
            <span style={{ width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", color: on ? "var(--wine)" : "var(--mute)" }}>
              {it.icon}
            </span>
            <span style={{
              fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.1em",
              textTransform: "uppercase", fontWeight: 500
            }}>{it.label}</span>
          </button>);
      })}
    </div>);
}

const NICHE_ICONS = {
  kitchen:     <svg viewBox="0 0 18 18" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="13" height="9" rx="1"/><circle cx="6.5" cy="10" r="1.8"/><circle cx="11.5" cy="10" r="1.8"/><path d="M2.5 3.5h13"/></svg>,
  flooring:    <svg viewBox="0 0 18 18" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="3.5" width="13" height="11" rx="0.5"/><path d="M2.5 7.5h13M2.5 11.5h13"/><path d="M7 3.5v4M11 7.5v4M7 11.5v3"/></svg>,
  wellness:    <svg viewBox="0 0 18 18" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9.5h14v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5Z"/><path d="M5 9.5V7a1.5 1.5 0 0 1 3 0v2.5"/><path d="M5 13.5l-1 2M13 13.5l1 2"/></svg>,
  landscaping: <svg viewBox="0 0 18 18" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14.5V9"/><path d="M9 9C9 6.5 6.5 4 4 4c0 3 2 5.5 5 5Z"/><path d="M9 12C9 9.5 11.5 7 15 7c0 3-2 5-6 5Z"/><path d="M3 14.5h12"/></svg>,
  roofing:     <svg viewBox="0 0 18 18" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 9 9 3.5 15.5 9" /><path d="M4 8v6.5h10V8" /><path d="M12 5.5V3.5h1.5v3.2" /></svg>
};

function Msg({ from, time, readReceipt, children }) {
  const isFirm = from === "firm";
  return (
    <div style={{
      display: "flex", justifyContent: isFirm ? "flex-end" : "flex-start",
      marginBottom: 10
    }}>
      <div style={{ maxWidth: "82%" }}>
        <div style={{
          background: isFirm ?
          "linear-gradient(145deg, #2A241C, #1A150F)" :
          "linear-gradient(145deg, var(--paper), var(--bg-2))",
          color: isFirm ? "var(--paper)" : "var(--ink)",
          padding: "12px 16px", fontSize: 13.5, lineHeight: 1.45,
          borderRadius: 8, fontWeight: 400,
          textWrap: "pretty",
          boxShadow: isFirm ? "0 1px 2px rgba(20,15,10,0.18), 0 6px 14px -8px rgba(20,15,10,0.25)" : "var(--sh-inset-crisp)"
        }}>{children}</div>
        <div style={{
          fontSize: 10, color: "var(--mute)", marginTop: 5,
          fontFamily: "var(--mono)", letterSpacing: "0.04em",
          display: "flex", alignItems: "center", gap: 4,
          justifyContent: isFirm ? "flex-end" : "flex-start",
          paddingLeft: 4, paddingRight: 4
        }}>
          {time}
          {isFirm && readReceipt && <CheckCheckIcon />}
        </div>
      </div>
    </div>);
}

function Divider({ label, tone }) {
  const isWine = tone === "wine";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0" }}>
      <span style={{ flex: 1, height: 1, background: isWine ? "var(--wine)" : "var(--line)", opacity: isWine ? 0.4 : 1 }} />
      <span style={{
        fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em",
        textTransform: "uppercase", color: isWine ? "var(--wine)" : "var(--mute)"
      }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: isWine ? "var(--wine)" : "var(--line)", opacity: isWine ? 0.4 : 1 }} />
    </div>);
}

function FloatNote() {
  return (
    <div className="neu-polished-large floaty" style={{
      position: "absolute", left: -64, top: -36,
      maxWidth: 210, padding: "14px 16px", borderRadius: 8,
      zIndex: 2
    }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>Editor's note</div>
      <p className="serif italic" style={{
        margin: 0, fontSize: 16, lineHeight: 1.35, color: "var(--ink)"
      }}>
        Every message is drafted in your business's voice, reviewed, then sent under your domain.
      </p>
    </div>);
}
