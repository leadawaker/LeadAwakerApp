import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Sun, GraduationCap, Dumbbell, Scale, Laugh, ChevronDown, CheckCheck } from "lucide-react";

type MessageItem = {
  type: "agent" | "user" | "system";
  sender?: string;
  content: string;
  time?: string;
  id?: string;
};

const CASES = [
  { key: "solar",    caseKey: "solarPanel", icon: Sun,           label: "Solar",    color: "#2563EB", leadName: "James Walker"  },
  { key: "coaching", caseKey: "coaching",   icon: GraduationCap, label: "Coaching", color: "#0D9488", leadName: "Ellen Jansen"  },
  { key: "gym",      caseKey: "gym",        icon: Dumbbell,      label: "Gym",      color: "#8B5CF6", leadName: "Mark Evans"    },
  { key: "dental",   caseKey: "dental",     icon: Laugh,         label: "Dental",   color: "#10B981", leadName: "Laura Brandt"  },
  { key: "legal",    caseKey: "lawFirm",    icon: Scale,         label: "Legal",    color: "#E11D48", leadName: "Oliver Harris" },
];

// Keyed by message ID so translation differences don't matter
const BADGE_BY_ID: Record<string, string> = {
  'sol-3':   '🛡️ Objection handled automatically',
  'gym-3':   '🛡️ Objection handled automatically',
  'dent-3':  '🛡️ Objection handled automatically',
  'dent-6':  '🔄 Reschedule handled automatically',
  'co-3':    '🎯 Real goal surfaced',
  'lf-bump': '📨 Follow-up sent automatically',
};

const DEMO_MSG_LIMIT    = 30;
const MS_PER_CHAR       = 45;
const MIN_DELAY         = 600;
const MAX_DELAY         = 3500;
const INITIAL_TYPING    = 1800;
const SYSTEM_GAP        = 450;
const READ_RECEIPT_LEAD = 700;
const UP_NEXT_WAIT      = 2000;
const UP_NEXT_HOLD      = 5000;

export default function Chat3D() {
  const { t } = useTranslation('chat3d');
  const { t: tServices } = useTranslation('services');

  const [scrollY,             setScrollY]             = useState(0);
  const [activeCaseIdx,       setActiveCaseIdx]       = useState(0);
  const [restartKey,          setRestartKey]          = useState(0);
  const [visibleMessages,     setVisibleMessages]     = useState<number[]>([]);
  const [visibleReadReceipts, setVisibleReadReceipts] = useState<Set<number>>(new Set());
  const [badgeMessages,       setBadgeMessages]       = useState<Record<number, string>>({});
  const [isDark,              setIsDark]              = useState(false);
  const [isFollowMode,        setIsFollowMode]        = useState(true);
  const [showInitTyping,      setShowInitTyping]      = useState(true);
  const [showUpNext,          setShowUpNext]          = useState(false);
  const [upNextCountdown,     setUpNextCountdown]     = useState(5);

  const scrollContainerRef    = useRef<HTMLDivElement>(null);
  const timeoutsRef           = useRef<NodeJS.Timeout[]>([]);
  const programmaticScrollRef = useRef(false);
  const isFollowModeRef       = useRef(true);

  useEffect(() => { isFollowModeRef.current = isFollowMode; }, [isFollowMode]);

  const activeCase = CASES[activeCaseIdx];

  const messages = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => (tServices(`cases.${CASES[activeCaseIdx].caseKey}.messages`, { returnObjects: true }) as MessageItem[]).slice(0, DEMO_MSG_LIMIT),
    [activeCaseIdx]
  );
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Dark mode detection
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Window scroll for 3D tilt
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    programmaticScrollRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setTimeout(() => { programmaticScrollRef.current = false; }, 600);
  }, []);

  useEffect(() => {
    if (isFollowMode) scrollToBottom();
  }, [visibleMessages, showUpNext, isFollowMode, scrollToBottom]);

  const handleChatScroll = useCallback(() => {
    if (programmaticScrollRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setIsFollowMode(atBottom);
  }, []);

  // Up next countdown
  useEffect(() => {
    if (!showUpNext) { setUpNextCountdown(5); return; }
    const interval = setInterval(() => setUpNextCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [showUpNext]);

  // Main animation loop
  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setVisibleMessages([]);
    setVisibleReadReceipts(new Set());
    setBadgeMessages({});
    setShowUpNext(false);
    setIsFollowMode(true);
    isFollowModeRef.current = true;
    setShowInitTyping(true);

    const msgs = messagesRef.current;

    // Pre-compute absolute arrival time for each message.
    // Delay before msg[N] = msg[N].content.length * MS_PER_CHAR (typing time for that message).
    let acc = 0;
    const msgTimes: number[] = msgs.map((msg, index) => {
      if (index === 0) {
        acc = INITIAL_TYPING;
      } else if (msg.type === 'system') {
        acc += SYSTEM_GAP;
      } else {
        acc += Math.min(Math.max(msg.content.length * MS_PER_CHAR, MIN_DELAY), MAX_DELAY);
      }
      return acc;
    });

    // Clear initial typing indicator as first message arrives
    timeoutsRef.current.push(setTimeout(() => setShowInitTyping(false), INITIAL_TYPING));

    msgs.forEach((msg, index) => {
      // Reveal message
      timeoutsRef.current.push(setTimeout(() => {
        setVisibleMessages(prev => [...prev, index]);
        if (msg.type === 'system' && msg.id && BADGE_BY_ID[msg.id]) {
          setBadgeMessages(prev => ({ ...prev, [index]: BADGE_BY_ID[msg.id!] }));
        }
      }, msgTimes[index]));

      // Schedule read receipt on the last agent bubble before each user message
      if (msg.type === 'user') {
        for (let i = index - 1; i >= 0; i--) {
          if (msgs[i].type === 'agent') {
            const rrTime = Math.max(msgTimes[i] + 500, msgTimes[index] - READ_RECEIPT_LEAD);
            timeoutsRef.current.push(setTimeout(() => {
              setVisibleReadReceipts(prev => new Set([...prev, i]));
            }, rrTime));
            break;
          }
        }
      }
    });

    // Auto-advance after flow ends — only if user hasn't scrolled up
    const lastTime = msgTimes[msgTimes.length - 1] ?? INITIAL_TYPING;
    const nextIdx = (activeCaseIdx + 1) % CASES.length;
    timeoutsRef.current.push(setTimeout(() => {
      if (isFollowModeRef.current) setShowUpNext(true);
    }, lastTime + UP_NEXT_WAIT));
    timeoutsRef.current.push(setTimeout(() => {
      setShowUpNext(false);
      if (isFollowModeRef.current) setActiveCaseIdx(nextIdx);
    }, lastTime + UP_NEXT_WAIT + UP_NEXT_HOLD));

    return () => timeoutsRef.current.forEach(clearTimeout);
  }, [activeCaseIdx, restartKey]);

  function handleCaseSwitch(idx: number) {
    if (idx === activeCaseIdx) setRestartKey(k => k + 1);
    else setActiveCaseIdx(idx);
  }

  const nextMsgType = messages[visibleMessages.length]?.type;
  const showTypingBubble = showInitTyping || (
    visibleMessages.length > 0 &&
    visibleMessages.length < messages.length &&
    nextMsgType !== 'system'
  );
  const typingDir = showInitTyping ? (messages[0]?.type ?? 'agent') : nextMsgType;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative perspective-container w-full" style={{ filter: 'none', WebkitFilter: 'none' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative transform-3d w-full max-w-md mx-auto"
          style={{ perspective: "2000px", transformStyle: "preserve-3d", filter: 'none', WebkitFilter: 'none' }}
        >
          <div style={{
            transform: `rotateY(${Math.min(-10.5 + scrollY * 0.05, 0)}deg) rotateX(${Math.max(10.5 - scrollY * 0.05, 0)}deg)`,
            transformStyle: "preserve-3d",
            transition: "transform 0.1s ease-out",
            marginTop: "50px",
            position: "relative",
            filter: 'none',
            WebkitFilter: 'none',
          }}>

            {/* Card */}
            <div
              className="bg-white dark:bg-zinc-900 rounded-t-2xl border border-b-0 border-slate-100 dark:border-zinc-700 overflow-hidden relative min-w-[320px]"
              style={{
                boxShadow: isDark
                  ? "15px 0px 40px -10px rgba(0,0,0,0.4), -8px -8px 20px rgba(0,0,0,0.2)"
                  : "15px 0px 40px -10px rgba(0,0,0,0.08), -8px -8px 20px rgba(255,255,255,0.6)",
              }}
              data-testid="chat-3d-card"
            >
              {/* Header */}
              <div
                className="p-4 flex items-center gap-3 transition-colors duration-500"
                style={{ backgroundColor: activeCase.color }}
              >
                <div
                  className="rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ width: "44px", height: "44px", backgroundColor: "rgba(0,0,0,0.2)" }}
                  data-testid="chat-avatar"
                >
                  {activeCase.leadName[0]}
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm" data-testid="chat-name">{activeCase.leadName}</h3>
                  <p className="text-xs flex items-center gap-1" style={{ color: "#FCC700" }} data-testid="chat-status">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#FCC700" }} />
                    {t('header.status')}
                  </p>
                </div>
              </div>

              {/* Message area */}
              <div className="relative">
                <div
                  ref={scrollContainerRef}
                  onScroll={handleChatScroll}
                  className="p-6 pb-4 space-y-1 h-[650px] overflow-y-auto relative scrollbar-hide bg-[#fafafa] dark:bg-zinc-900"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-100/20 via-transparent to-slate-100/20 pointer-events-none" />
                  <div className="relative z-10 space-y-2">
                    <AnimatePresence>
                      {visibleMessages.map(msgIdx => {
                        const msg = messages[msgIdx];
                        if (!msg) return null;

                        if (msg.type === 'system') {
                          const badge = msg.id ? badgeMessages[msgIdx] : undefined;
                          return (
                            <motion.div
                              key={msg.id ?? `sys-${msgIdx}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex flex-col items-center gap-2 py-2"
                            >
                              {/* When a badge exists it replaces the tag line entirely */}
                              {!badge && (
                                <>
                                  <div className="h-[1px] w-full bg-slate-200 dark:bg-zinc-700" />
                                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-[#fafafa] dark:bg-zinc-900 px-3 -mt-3.5">
                                    {msg.content}
                                  </span>
                                </>
                              )}
                              {badge && (
                                <motion.div
                                  initial={{ opacity: 0, x: 8, scale: 0.92 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  transition={{ duration: 0.3 }}
                                  className="flex justify-end w-full"
                                >
                                  <span
                                    className="text-[11px] font-semibold bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-zinc-600 whitespace-nowrap"
                                    style={{ boxShadow: "0 4px 4px -2px rgba(0,0,0,0.03), 0 2px 5px -1px rgba(0,0,0,0.03)" }}
                                  >
                                    {badge}
                                  </span>
                                </motion.div>
                              )}
                            </motion.div>
                          );
                        }

                        const isAgent = msg.type === 'agent';
                        const showReadReceipt = isAgent && visibleReadReceipts.has(msgIdx);

                        return (
                          <motion.div
                            key={msg.id ?? `msg-${msgIdx}`}
                            className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.4 }}
                          >
                            <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} gap-1`}>
                              <div
                                className={`rounded-2xl px-4 py-3 shadow-sm text-sm ${
                                  isAgent
                                    ? 'text-white rounded-tr-sm max-w-[90%]'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-600 rounded-tl-sm'
                                }`}
                                style={isAgent ? { backgroundColor: activeCase.color } : {}}
                              >
                                {msg.content}
                              </div>
                              {(msg.time || showReadReceipt) && (
                                <div className={`flex items-center gap-1 ${isAgent ? 'pr-2' : 'pl-2'}`}>
                                  {msg.time && <span className="text-xs text-slate-400">{msg.time}</span>}
                                  <AnimatePresence>
                                    {showReadReceipt && (
                                      <motion.span
                                        initial={{ opacity: 0, scale: 0.6 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.25 }}
                                      >
                                        <CheckCheck size={12} className="text-blue-400" strokeWidth={2.5} />
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {/* Up next pill with countdown */}
                    <AnimatePresence>
                      {showUpNext && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex justify-center py-3"
                        >
                          <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 rounded-full px-4 py-1.5">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
                              Up next: {t(`cases.${CASES[(activeCaseIdx + 1) % CASES.length].key}`)}
                            </span>
                            <motion.span
                              key={upNextCountdown}
                              initial={{ scale: 1.4, opacity: 0.5 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.25 }}
                              className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 min-w-[1ch] text-center tabular-nums"
                            >
                              {upNextCountdown}
                            </motion.span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Typing indicator */}
                    {showTypingBubble && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex pt-2 ${typingDir === 'agent' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`flex items-center gap-1 px-3 py-4 rounded-2xl shadow-sm scale-90 ${
                            typingDir === 'agent'
                              ? 'rounded-br-sm'
                              : 'bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-bl-sm'
                          }`}
                          style={typingDir === 'agent' ? { backgroundColor: activeCase.color } : {}}
                        >
                          {[0, 0.2, 0.4].map((delay, i) => (
                            <motion.span
                              key={i}
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ repeat: Infinity, duration: 1.4, delay }}
                              className={`w-2 h-2 rounded-full ${typingDir === 'agent' ? 'bg-white/70' : 'bg-slate-400'}`}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Scroll lock re-engage button */}
                <AnimatePresence>
                  {!isFollowMode && (
                    <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none z-30">
                      <motion.button
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        onClick={() => { setIsFollowMode(true); scrollToBottom(); }}
                        className="pointer-events-auto flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-slate-600 dark:text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-full shadow-md cursor-pointer"
                      >
                        <motion.span
                          animate={{ y: [0, 3, 0] }}
                          transition={{ repeat: Infinity, duration: 1.2 }}
                          className="flex"
                        >
                          <ChevronDown size={13} />
                        </motion.span>
                        Live
                      </motion.button>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Case selector tab bar */}
            <div
              className="px-3 py-3 rounded-b-2xl border border-t-0 border-slate-100 dark:border-zinc-700"
              style={{
                backgroundColor: isDark ? "#18181b" : "#fafafa",
                transform: "translateZ(0)",
                position: "relative",
                zIndex: 10,
                boxShadow: isDark
                  ? "15px 15px 40px -10px rgba(0,0,0,0.4), -8px 8px 20px rgba(0,0,0,0.2)"
                  : "15px 15px 40px -10px rgba(0,0,0,0.08), -8px 8px 20px rgba(255,255,255,0.6)",
              }}
            >
              <div
                className="relative flex rounded-full p-1"
                style={{
                  backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(255, 255, 255, 0.4)",
                  outline: "1px solid transparent",
                  boxShadow: isDark ? "0 4px 18px rgba(0,0,0,0.35)" : "0 4px 18px rgba(0,0,0,0.07)",
                }}
              >
                <motion.div
                  className="absolute top-1 bottom-1 rounded-full pointer-events-none"
                  animate={{
                    left: `calc(${(activeCaseIdx / CASES.length) * 100}% + 4px)`,
                    width: `calc(${100 / CASES.length}% - 8px)`,
                    backgroundColor: activeCase.color,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  style={{ outline: "1px solid transparent" }}
                />
                {CASES.map((c, i) => (
                  <button
                    key={c.key}
                    onClick={() => handleCaseSwitch(i)}
                    className="relative flex-1 px-2 py-2 rounded-full z-10 flex items-center justify-center"
                    style={{ transform: "translateZ(0)", outline: "1px solid transparent" }}
                  >
                    <div
                      className="flex flex-col items-center gap-0.5 transition-colors duration-200"
                      style={{ color: activeCaseIdx === i ? "white" : isDark ? "#a1a1aa" : "#64748b" }}
                    >
                      <c.icon size={16} strokeWidth={2} />
                      <span className="text-[10px] font-semibold whitespace-nowrap leading-none">
                        {t(`cases.${c.key}`)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
