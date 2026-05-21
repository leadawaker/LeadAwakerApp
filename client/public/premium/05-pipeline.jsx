// Pipeline section with animated kanban board

function FlyingCardEl({ card, fromRect, toRect, duration = 420 }) {
  const [arrived, setArrived] = React.useState(false);
  const dx = toRect.left - fromRect.left;
  const dy = toRect.top  - fromRect.top;

  React.useEffect(() => {
    let r2;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setArrived(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  return (
    <div style={{
      position: "fixed", left: fromRect.left, top: fromRect.top,
      width: fromRect.width, zIndex: 9999, pointerEvents: "none",
      willChange: "transform",
      transform: arrived ? `translate(${dx}px,${dy}px)` : "translate(0,0)",
      transition: arrived ? `transform ${duration}ms cubic-bezier(0.4,0,0.2,1)` : "none",
    }}>
      <div style={{
        padding: "8px 10px", borderRadius: 7,
        background: "linear-gradient(145deg, var(--paper), var(--bg-2))",
        boxShadow: "var(--sh-polished-crisp)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
          {card.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute)", opacity: 0.7, whiteSpace: "nowrap" }}>{card.lastMsg}</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "1px 5px", borderRadius: 999, background: card.tier === "premium" ? "rgba(158,32,53,0.11)" : "rgba(0,0,0,0.06)", color: card.tier === "premium" ? "#9E2035" : "#888" }}>{card.tier}</span>
        </div>
      </div>
    </div>
  );
}

function Pipeline() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();

  const makeLeads = () => isMobile ? ({
    engaged: [
      { id: "e1", name: "Martijn van den Berg", lastMsg: "5m ago",  tier: "premium" },
      { id: "e2", name: "Sophie Janssen",       lastMsg: "12m ago", tier: "basic"   },
      { id: "e3", name: "Pieter de Vries",      lastMsg: "1h ago",  tier: "premium" },
    ],
    replied: [
      { id: "r1", name: "Emma Bakker",          lastMsg: "30m ago", tier: "premium" },
      { id: "r2", name: "Lars Smits",           lastMsg: "1h ago",  tier: "basic"   },
    ],
    qualified: [
      { id: "q1", name: "Anna Visser",          lastMsg: "2h ago",  tier: "premium" },
      { id: "q2", name: "Luuk Harmsen",         lastMsg: "3h ago",  tier: "premium" },
    ],
    booked: [
      { id: "b1", name: "Bart Jonker",          lastMsg: "1d ago",  tier: "premium" },
    ],
    lost: [],
  }) : ({
    engaged: [
      { id: "e1",  name: "Martijn van den Berg",  lastMsg: "5m ago",   tier: "premium" },
      { id: "e2",  name: "Sophie Janssen",         lastMsg: "12m ago",  tier: "basic"   },
      { id: "e3",  name: "Pieter de Vries",        lastMsg: "1h ago",   tier: "premium" },
      { id: "e4",  name: "Lotte Hendricks",        lastMsg: "2h ago",   tier: "basic"   },
    ],
    replied: [
      { id: "r1",  name: "Emma Bakker",            lastMsg: "30m ago",  tier: "premium" },
      { id: "r2",  name: "Lars Smits",             lastMsg: "1h ago",   tier: "basic"   },
      { id: "r3",  name: "Jasper van Dijk",        lastMsg: "2h ago",   tier: "premium" },
      { id: "r4",  name: "Nina Wolters",           lastMsg: "3h ago",   tier: "basic"   },
      { id: "r5",  name: "Rick Brouwer",           lastMsg: "4h ago",   tier: "premium" },
      { id: "r6",  name: "Amber van Beek",         lastMsg: "5h ago",   tier: "basic"   },
      { id: "r7",  name: "Thijs Groot",            lastMsg: "6h ago",   tier: "basic"   },
      { id: "r8",  name: "Manon Lagerweij",        lastMsg: "8h ago",   tier: "basic"   },
      { id: "r9",  name: "Mark van der Laan",      lastMsg: "9h ago",   tier: "premium" },
      { id: "r10", name: "Lisa Kuijpers",          lastMsg: "11h ago",  tier: "basic"   },
    ],
    qualified: [
      { id: "q1",  name: "Anna Visser",            lastMsg: "2h ago",   tier: "premium" },
      { id: "q2",  name: "Luuk Harmsen",           lastMsg: "3h ago",   tier: "premium" },
      { id: "q3",  name: "Claire Vos",             lastMsg: "4h ago",   tier: "premium" },
      { id: "q4",  name: "Mike van Oss",           lastMsg: "5h ago",   tier: "basic"   },
      { id: "q5",  name: "Bianca Stam",            lastMsg: "6h ago",   tier: "basic"   },
      { id: "q6",  name: "Jeroen Timmermans",      lastMsg: "8h ago",   tier: "premium" },
      { id: "q7",  name: "Yvonne Bruin",           lastMsg: "10h ago",  tier: "basic"   },
      { id: "q8",  name: "Patrick Nooij",          lastMsg: "12h ago",  tier: "basic"   },
      { id: "q9",  name: "Thomas Dekker",          lastMsg: "14h ago",  tier: "premium" },
      { id: "q10", name: "Femke Bosman",           lastMsg: "16h ago",  tier: "basic"   },
      { id: "q11", name: "Ruben Mulder",           lastMsg: "18h ago",  tier: "basic"   },
      { id: "q12", name: "Eline Vermeer",          lastMsg: "1d ago",   tier: "premium" },
    ],
    booked: [
      { id: "b1",  name: "Bart Jonker",            lastMsg: "1d ago",   tier: "premium" },
      { id: "b2",  name: "Kelly Zwart",            lastMsg: "1d ago",   tier: "premium" },
      { id: "b3",  name: "Paul de Graaf",          lastMsg: "2d ago",   tier: "premium" },
      { id: "b4",  name: "Sander Hoekstra",        lastMsg: "2d ago",   tier: "basic"   },
      { id: "b5",  name: "Nienke Koops",           lastMsg: "3d ago",   tier: "basic"   },
      { id: "b6",  name: "Bram Willems",           lastMsg: "3d ago",   tier: "basic"   },
      { id: "b7",  name: "Fleur de Jong",          lastMsg: "4d ago",   tier: "basic"   },
      { id: "b8",  name: "Kevin Huizing",          lastMsg: "4d ago",   tier: "basic"   },
      { id: "b9",  name: "Maud Peters",            lastMsg: "5d ago",   tier: "basic"   },
      { id: "b10", name: "Joris van Leeuwen",      lastMsg: "5d ago",   tier: "basic"   },
    ],
    lost: [
      { id: "l1", name: "Iris Bergman",            lastMsg: "3d ago",   tier: "basic"   },
      { id: "l2", name: "Daan Scholten",           lastMsg: "4d ago",   tier: "basic"   },
      { id: "l3", name: "Roos Timmer",             lastMsg: "4d ago",   tier: "basic"   },
      { id: "l4", name: "Wouter Aarts",            lastMsg: "5d ago",   tier: "basic"   },
      { id: "l5", name: "Celeste Noorda",          lastMsg: "5d ago",   tier: "basic"   },
      { id: "l6", name: "Steven Pijpers",          lastMsg: "6d ago",   tier: "basic"   },
      { id: "l7", name: "Wendy van Rooij",         lastMsg: "6d ago",   tier: "basic"   },
      { id: "l8", name: "Frank Kooiman",           lastMsg: "7d ago",   tier: "basic"   },
      { id: "l9", name: "Hanneke Prins",           lastMsg: "7d ago",   tier: "basic"   },
    ],
  });

  const STAGES = [
    { id: "engaged",   label: t('pipeline.stage_engaged'),   headerBg: "linear-gradient(145deg, #252118, #1A1910)", headerColor: "rgba(244,239,227,0.72)" },
    { id: "replied",   label: t('pipeline.stage_replied'),   headerBg: "linear-gradient(145deg, #3D2210, #2E1A0C)", headerColor: "rgba(244,239,227,0.82)" },
    { id: "qualified", label: t('pipeline.stage_qualified'), headerBg: "linear-gradient(145deg, #5E1F2E, #4A1724)", headerColor: "rgba(244,239,227,0.92)" },
    { id: "booked",    label: t('pipeline.stage_booked'),    headerBg: "linear-gradient(145deg, #B02540, #921D34)", headerColor: "#F4EFE3" },
  ];

  const PROGRESS = [
    { from: "qualified", to: "booked" },
    { from: "replied",   to: "qualified" },
    { from: "engaged",   to: "replied" },
  ];

  const LOSS = [
    { from: "engaged", to: "lost" },
    { from: "engaged", to: "lost" },
    { from: "replied",  to: "lost" },
  ];

  const COL_H = isMobile ? "auto" : 8 + (40 * 10 + 6 * 9) + 8;

  const [introRef, introInView] = window.useInView();
  const revealedCardIds = React.useRef(new Set());
  const [leads,       setLeads]       = React.useState(makeLeads);
  const [hiddenIds,   setHiddenIds]   = React.useState(() => new Set());
  const [flying,      setFlying]      = React.useState([]);
  const [freshLostIds,setFreshLostIds]= React.useState(() => new Set());
  const [inView,      setInView]      = React.useState(false);
  const [revealed,    setRevealed]    = React.useState(false);
  const containerRef = React.useRef(null);
  const leadsRef     = React.useRef(leads);
  const flyingIdsRef = React.useRef(new Set());
  React.useEffect(() => { leadsRef.current = leads; }, [leads]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    if (inView && !revealed) setRevealed(true);
  }, [inView, revealed]);

  // Cancel any in-flight overlays when section leaves the viewport so flying
  // cards don't get stranded on top of the page.
  React.useEffect(() => {
    if (inView) return;
    setFlying([]);
    setHiddenIds(new Set());
    flyingIdsRef.current = new Set();
  }, [inView]);

  React.useEffect(() => {
    if (!inView) return;
    const timeouts = new Set();
    const safeTimeout = (fn, ms) => {
      const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms);
      timeouts.add(id);
      return id;
    };

    const tick = () => {
      const current = leadsRef.current;
      const doLoss = Math.random() < 0.3;
      const pickFrom = (pool) => {
        const possible = pool.filter(m => {
          const arr = current[m.from];
          if (!arr || arr.length === 0) return false;
          return arr.some(c => !flyingIdsRef.current.has(c.id));
        });
        return possible.length ? possible[Math.floor(Math.random() * possible.length)] : null;
      };
      let move = pickFrom(doLoss ? LOSS : PROGRESS);
      if (!move) move = pickFrom(doLoss ? PROGRESS : LOSS);
      if (!move) {
        const totalCards = Object.values(current).reduce((a, b) => a + b.length, 0);
        if (totalCards < 6) setLeads(makeLeads());
        return;
      }
      const card = current[move.from].find(c => !flyingIdsRef.current.has(c.id));
      if (!card) return;

      const cardEl  = document.querySelector(`[data-lead-id="${card.id}"]`);
      const toBodyEl = document.querySelector(`[data-stage-body="${move.to}"]`);
      if (!cardEl || !toBodyEl) return;

      const fromRect   = cardEl.getBoundingClientRect();
      const toBodyRect = toBodyEl.getBoundingClientRect();
      const toRect = { left: toBodyRect.left + 9, top: toBodyRect.top + 8, width: fromRect.width };
      const duration = 380 + Math.floor(Math.random() * 220);
      const flightKey = `${card.id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

      flyingIdsRef.current.add(card.id);
      setHiddenIds(prev => { const n = new Set(prev); n.add(card.id); return n; });
      setFlying(prev => [...prev, { key: flightKey, card, fromRect, toRect, duration }]);

      safeTimeout(() => {
        const sourceBodyEl = document.querySelector(`[data-stage-body="${move.from}"]`);
        const destBodyEl   = document.querySelector(`[data-stage-body="${move.to}"]`);
        const capture = (bodyEl) => {
          const map = new Map();
          if (!bodyEl) return map;
          bodyEl.querySelectorAll("[data-lead-id]").forEach(el => {
            const r = el.getBoundingClientRect();
            map.set(el.dataset.leadId, { top: r.top, left: r.left });
          });
          return map;
        };
        const sourceBefore = capture(sourceBodyEl);
        const destBefore   = capture(destBodyEl);

        setLeads(prev => ({
          ...prev,
          [move.from]: prev[move.from].filter(l => l.id !== card.id),
          [move.to]: move.to === "lost"
            ? [card, ...prev[move.to]].slice(0, 24)
            : [card, ...prev[move.to]],
        }));
        flyingIdsRef.current.delete(card.id);
        setHiddenIds(prev => { const n = new Set(prev); n.delete(card.id); return n; });
        setFlying(prev => prev.filter(f => f.key !== flightKey));

        if (move.to === "lost") {
          setFreshLostIds(prev => { const n = new Set(prev); n.add(card.id); return n; });
          safeTimeout(() => {
            setFreshLostIds(prev => { const n = new Set(prev); n.delete(card.id); return n; });
          }, 900);
        }

        requestAnimationFrame(() => {
          const applyFlip = (bodyEl, before) => {
            if (!bodyEl) return [];
            const moved = [];
            bodyEl.querySelectorAll("[data-lead-id]").forEach(el => {
              const id = el.dataset.leadId;
              const old = before.get(id);
              if (!old) return;
              const r = el.getBoundingClientRect();
              const dy = old.top - r.top;
              const dx = old.left - r.left;
              if (dy !== 0 || dx !== 0) {
                el.style.transition = "none";
                el.style.transform = `translate(${dx}px, ${dy}px)`;
                moved.push(el);
              }
            });
            return moved;
          };
          const moved = [...applyFlip(sourceBodyEl, sourceBefore), ...applyFlip(destBodyEl, destBefore)];
          if (moved.length) {
            moved[0].offsetHeight;
            requestAnimationFrame(() => {
              moved.forEach(el => {
                el.style.transition = "transform 380ms cubic-bezier(0.4, 0, 0.2, 1)";
                el.style.transform = "";
              });
              safeTimeout(() => {
                moved.forEach(el => { el.style.transition = ""; el.style.transform = ""; });
              }, 450);
            });
          }
        });
      }, duration + 30);
    };

    const schedule = () => {
      const delay = 1000 + Math.random() * 6000;
      safeTimeout(() => { tick(); schedule(); }, delay);
    };
    const NUM_TRACKS = 3;
    for (let i = 0; i < NUM_TRACKS; i++) {
      safeTimeout(schedule, Math.random() * 2000);
    }
    return () => { timeouts.forEach(clearTimeout); flyingIdsRef.current = new Set(); };
  }, [inView]);

  const wrap = isMobile
    ? { maxWidth: 1240, margin: "0 auto", padding: "112px 18px 160px" }
    : { maxWidth: 1240, margin: "0 auto", padding: "112px 48px 192px" };

  const COL_STYLE = {
    background: "var(--bg)",
    boxShadow: "var(--sh-inset-medium)",
  };
  const CARD_STYLE = {
    background: "linear-gradient(145deg, var(--paper), var(--bg-2))",
    boxShadow: "var(--sh-polished-crisp)",
  };

  return (
    <section id="pipeline" style={wrap}>
      <style>{`
        @keyframes pipelineCardIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {flying.map(f => <FlyingCardEl key={f.key} card={f.card} fromRect={f.fromRect} toRect={f.toRect} duration={f.duration} />)}

      <div ref={introRef} style={{ marginBottom: isMobile ? 36 : 56 }}>
        <div className="eyebrow" style={{ marginBottom: isMobile ? 14 : 20 }}>{t('pipeline.eyebrow')}</div>
        <h2 className="serif" style={{
          margin: 0,
          fontSize: isMobile ? "clamp(30px, 8vw, 40px)" : "clamp(38px, 4vw, 56px)",
          lineHeight: 1.04, letterSpacing: "-0.02em", color: "var(--ink)"
        }}>
          {t('pipeline.h2_l1')}<br />
          <span className="italic" style={{ color: "var(--wine)" }}>{t('pipeline.h2_italic')}</span>
        </h2>
      </div>

      <div ref={containerRef}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
          gap: isMobile ? 12 : 14,
          marginBottom: 14,
        }}>
          {STAGES.map((stage, stageIdx) => {
            const stageLeads = leads[stage.id] || [];
            return (
              <div key={stage.id} style={{
                display: "flex", flexDirection: "column", borderRadius: 13, overflow: "hidden",
                ...COL_STYLE,
                ...window.revealStyle(introInView, { delay: window.stagger(stageIdx, 80) }),
              }}>
                <div style={{
                  padding: "11px 14px",
                  background: stage.headerBg,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.28)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexShrink: 0,
                }}>
                  <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: stage.headerColor, letterSpacing: "0.04em" }}>
                    {stage.label}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: stage.headerColor, opacity: 0.7, background: "rgba(255,255,255,0.13)", borderRadius: 999, padding: "1px 8px" }}>
                    {stageLeads.length}
                  </span>
                </div>

                <div
                  data-stage-body={stage.id}
                  style={{
                    padding: "8px 9px", display: "flex", flexDirection: "column", gap: 6,
                    height: COL_H, overflowY: "auto", scrollbarWidth: "none",
                  }}
                >
                  {stageLeads.length === 0 && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "1px dashed var(--line)", borderRadius: 7, padding: "14px 10px",
                      fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)", fontStyle: "italic",
                    }}>{t('pipeline.waiting')}</div>
                  )}
                  {stageLeads.map((lead, leadIdx) => {
                    const isFirstReveal = !revealedCardIds.current.has(lead.id);
                    if (revealed && isFirstReveal) revealedCardIds.current.add(lead.id);
                    return (
                    <div
                      key={lead.id}
                      data-lead-id={lead.id}
                      style={{
                        padding: "8px 10px", borderRadius: 7,
                        ...CARD_STYLE,
                        display: "flex", alignItems: "center", gap: 8,
                        opacity: hiddenIds.has(lead.id) ? 0 : (revealed ? 1 : 0),
                        animation: revealed && isFirstReveal
                          ? `pipelineCardIn 460ms cubic-bezier(0.4,0,0.2,1) backwards ${stageIdx * 120 + leadIdx * 90}ms`
                          : "none",
                      }}
                    >
                      <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                        {lead.name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute)", opacity: 0.7, whiteSpace: "nowrap" }}>{lead.lastMsg}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "1px 5px", borderRadius: 999, background: lead.tier === "premium" ? "rgba(158,32,53,0.11)" : "rgba(0,0,0,0.06)", color: lead.tier === "premium" ? "#9E2035" : "#888" }}>{lead.tier}</span>
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lost strip */}
        <div style={{ borderRadius: 13, overflow: "hidden", ...COL_STYLE }}>
          <div style={{
            padding: "11px 16px",
            background: "linear-gradient(145deg, #928D85, #7B7670)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.28)",
            display: "flex", alignItems: "center", gap: 9,
          }}>
            <span style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.92)", letterSpacing: "0.04em" }}>{t('pipeline.stage_lost')}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.18)", borderRadius: 999, padding: "1px 8px" }}>
              {leads.lost.length}
            </span>
            <svg title="Leads that stopped responding after multiple follow-ups." width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, opacity: 0.75, cursor: "default" }}>
              <circle cx="6.5" cy="6.5" r="6" stroke="rgba(255,255,255,0.9)" strokeWidth="1"/>
              <text x="6.5" y="10.2" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill="rgba(255,255,255,0.9)">i</text>
            </svg>
            <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 9.5, color: "rgba(255,255,255,0.7)", fontStyle: "italic" }}>
              {t('pipeline.lost_note')}
            </span>
          </div>

          <div
            data-stage-body="lost"
            style={{
              padding: "9px 9px", display: "flex", gap: 7, overflowX: "auto",
              scrollbarWidth: "none", minHeight: 52, alignItems: "center",
            }}
          >
            {leads.lost.length === 0 && (
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)", fontStyle: "italic", opacity: 0.45, padding: "4px 2px" }}>
                {t('pipeline.no_lost')}
              </div>
            )}
            {leads.lost.map((lead, lostIdx) => {
              const isFresh = freshLostIds.has(lead.id);
              const FADE_MS = 900;
              return (
              <div
                key={lead.id}
                data-lead-id={lead.id}
                style={{
                  flexShrink: 0, minWidth: 130,
                  padding: "8px 10px", borderRadius: 7,
                  background: "linear-gradient(145deg, var(--paper), var(--bg-2))",
                  boxShadow: "var(--sh-polished-crisp)",
                  display: "flex", alignItems: "center", gap: 8,
                  opacity: hiddenIds.has(lead.id) ? 0 : (revealed ? (isFresh ? 1 : 0.62) : 0),
                  transition: `opacity ${FADE_MS}ms ease`,
                  animation: revealed
                    ? `pipelineCardIn 460ms cubic-bezier(0.4,0,0.2,1) backwards ${1600 + lostIdx * 70}ms`
                    : "none",
                }}
              >
                <div style={{
                  fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600,
                  color: isFresh ? "var(--ink)" : "#7A7570",
                  transition: `color ${FADE_MS}ms ease`,
                  letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
                }}>
                  {lead.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 9.5,
                    color: isFresh ? "var(--mute)" : "#A39E97",
                    transition: `color ${FADE_MS}ms ease`,
                    whiteSpace: "nowrap",
                  }}>{lead.lastMsg}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                    padding: "1px 5px", borderRadius: 999,
                    background: isFresh
                      ? (lead.tier === "premium" ? "rgba(158,32,53,0.11)" : "rgba(0,0,0,0.06)")
                      : "rgba(0,0,0,0.07)",
                    color: isFresh
                      ? (lead.tier === "premium" ? "#9E2035" : "#888")
                      : "#9A958E",
                    transition: `color ${FADE_MS}ms ease, background-color ${FADE_MS}ms ease`,
                  }}>{lead.tier}</span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
