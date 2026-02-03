import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";

export default function Chat3D() {
  const { t } = useTranslation('chat3d');
  const [scrollY, setScrollY] = useState(0);
  const [showEngagement, setShowEngagement] = useState(false);
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [visibleMessages, showEngagement]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Move engagementMessages INSIDE the useEffect
  useEffect(() => {
    if (showEngagement) {
      setVisibleMessages([]);

      const engagementMessages = [
        { type: 'jack', text: t('messages.jack2'), time: "15:06" },
        { type: 'jack', text: t('messages.jack3'), time: "15:06" },
        { type: 'sophie', text: t('messages.sophie4'), time: "15:08" },
        { type: 'jack', text: t('messages.jack4'), time: "15:09" },
        { type: 'sophie', text: t('messages.sophie5'), time: "15:10" },
        { type: 'tag', text: t('tags.callBooked'), subtext: t('tags.sentToClient') },
        { type: 'sophie', text: t('messages.sophie6'), time: "15:12" },
        { type: 'jack', text: t('messages.jack5'), time: "15:13" },
        { type: 'sophie', text: t('messages.sophie7'), time: "15:14" },
        { type: 'tag', text: t('tags.chatClosed') }
      ];

      const timeouts: NodeJS.Timeout[] = [];
      let currentDelay = 0;

      // tuning values
      const BASE_DELAY = 3700;        // delay for first message
      const MS_PER_CHAR = 90;        // delay per character
      const MIN_DELAY = 1000;
      const MAX_DELAY = 10000;

      engagementMessages.forEach((msg, index) => {
        const timeout = setTimeout(() => {
          setVisibleMessages(prev => [...prev, index]);
        }, currentDelay);

        timeouts.push(timeout);

        const previousMsg = engagementMessages[index - 1];

        // TAGS should appear immediately after their related balloon
        if (msg.type === 'tag') {
          currentDelay += 400; // small pause so it feels intentional
          return;
        }

        // Balloons get typing-based delay
        let msgDelay = BASE_DELAY;

        if (previousMsg?.type !== 'tag' && previousMsg?.text) {
          msgDelay = previousMsg.text.length * MS_PER_CHAR;
        }

        msgDelay = Math.min(Math.max(msgDelay, MIN_DELAY), MAX_DELAY);
        currentDelay += msgDelay;
      });

      return () => timeouts.forEach(t => clearTimeout(t));
    }
  }, [showEngagement, t]); // Add 't' to dependencies

  // Create engagementMessages for rendering
  const engagementMessages = [
    { type: 'jack', text: t('messages.jack2'), time: "15:06" },
    { type: 'jack', text: t('messages.jack3'), time: "15:06" },
    { type: 'sophie', text: t('messages.sophie4'), time: "15:08" },
    { type: 'jack', text: t('messages.jack4'), time: "15:09" },
    { type: 'sophie', text: t('messages.sophie5'), time: "15:10" },
    { type: 'tag', text: t('tags.callBooked'), subtext: t('tags.sentToClient') },
    { type: 'sophie', text: t('messages.sophie6'), time: "15:12" },
    { type: 'jack', text: t('messages.jack5'), time: "15:13" },
    { type: 'sophie', text: t('messages.sophie7'), time: "15:14" },
    { type: 'tag', text: t('tags.chatClosed') }
  ];

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: i * 0.15,
        duration: 0.5,
      },
    }),
  };



  return (
    <div className="relative perspective-container" style={{ filter: 'none', WebkitFilter: 'none' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ 
          opacity: 1, 
          scale: 1 
        }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative transform-3d w-full max-w-md mx-auto"
        style={{ 
          perspective: "2000px",
          transformStyle: "preserve-3d",
          filter: 'none',
          WebkitFilter: 'none',
        }}
      >
        <div style={{ 
          transform: `rotateY(${Math.min(-10.5 + scrollY * 0.05, 0)}deg) rotateX(${Math.max(10.5 - scrollY * 0.05, 0)}deg)`, 
          transformStyle: "preserve-3d",
          transition: "transform 0.1s ease-out",
          marginTop: "50px",
          filter: 'none',
          WebkitFilter: 'none',
        }}>
        <div 
          className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative"
          style={{
            transform: "rotateY(0deg) rotateX(0deg) rotateZ(0deg)",
            boxShadow: "15px 15px 40px -10px rgba(0,0,0,0.08), -8px -8px 20px rgba(255,255,255,0.6)",
            background: "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 100%), linear-gradient(to right, rgba(37,99,235,0.02) 0%, transparent 50%)"
          }}
          data-testid="chat-3d-card"
        >
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(circle at 20% 50%, rgba(37,99,235,0.05) 0%, transparent 40%)",
          }} />

          <div className="p-4 flex items-center gap-3" style={{ backgroundColor: "#2563EB" }}>
            <div className="rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ width: "44px", height: "44px", backgroundColor: "#6B6B6B" }} data-testid="chat-avatar">J</div>
            <div>
              <h3 className="text-white font-medium text-sm" data-testid="chat-name">{t('header.name')}</h3>
              <p className="text-xs flex items-center gap-1" style={{ color: "#FCC700" }} data-testid="chat-status">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#FCC700" }} />
                {t('header.status')}
              </p>
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
             className="p-6 pb-2 space-y-1 min-h-[650px] max-h-[650px] overflow-y-auto relative scrollbar-hide bg-[#ffffff]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100/20 via-transparent to-slate-100/20 pointer-events-none" />

            <div className="relative z-10 space-y-2">
              <motion.div className="flex justify-end" custom={0} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-1">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    {t('messages.sophie1')}
                  </div>
                  <span className="text-xs text-slate-400 pr-2">14:35</span>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="flex flex-col items-center gap-2 py-2"
              >
                <div className="h-[1px] w-full bg-slate-200" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 -mt-3.5">{t('tags.leadEngaged')}</span>
              </motion.div>

              <motion.div className="flex justify-end" custom={1} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm text-sm inline-block" style={{ backgroundColor: "#2563EB", whiteSpace: "nowrap" }}>
                    {t('messages.sophie2')}
                  </div>
                  <span className="text-xs text-slate-400 pr-2">14:55</span>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="flex flex-col items-center gap-2 py-2"
              >
                <div className="h-[1px] w-full bg-slate-200" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 -mt-3.5">{t('tags.followedUp')}</span>
              </motion.div>

              <motion.div className="flex justify-start" custom={2} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-jack-1">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-gray-100 text-slate-700 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%] shadow-sm text-sm">
                    {t('messages.jack1')}
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:02</span>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="flex flex-col items-center gap-2 py-2"
              >
                <div className="h-[1px] w-full bg-slate-200" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 -mt-3.5">{t('tags.leadReplied')}</span>
              </motion.div>

              <motion.div className="flex justify-end" custom={3} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-3">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    {t('messages.sophie3')}
                  </div>
                  <span className="text-xs text-slate-400 pr-2">15:03</span>
                </div>
              </motion.div>

              <AnimatePresence>
                {!showEngagement ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative flex justify-center items-center pt-4 pb-2"
                  >
                    <div className="absolute left-0 flex items-center gap-1 bg-gray-100 border border-gray-200 px-3 py-4 rounded-2xl rounded-bl-sm shadow-sm scale-90">
                      <motion.span 
                        animate={{ opacity: [0.4, 1, 0.4] }} 
                        transition={{ repeat: Infinity, duration: 1.4, delay: 0 }}
                        className="w-2 h-2 bg-slate-400 rounded-full" 
                      />
                      <motion.span 
                        animate={{ opacity: [0.4, 1, 0.4] }} 
                        transition={{ repeat: Infinity, duration: 1.4, delay: 0.2 }}
                        className="w-2 h-2 bg-slate-400 rounded-full" 
                      />
                      <motion.span 
                        animate={{ opacity: [0.4, 1, 0.4] }} 
                        transition={{ repeat: Infinity, duration: 1.4, delay: 0.4 }}
                        className="w-2 h-2 bg-slate-400 rounded-full" 
                      />
                    </div>
                    <button 
                      onClick={() => setShowEngagement(true)}
                      className="bg-primary text-white px-8 py-4 rounded-full font-bold shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 text-sm z-10"
                    >
                      {t('button.continue')}
                    </button>
                  </motion.div>
                ) : (
                  <>
                    {visibleMessages
                      .filter(msgIdx => msgIdx < engagementMessages.length)
                      .map((msgIdx) => {
                        const msg = engagementMessages[msgIdx];
                        if (msg.type === 'tag') {
                          return (
                            <motion.div 
                              key={`tag-${msgIdx}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex flex-col items-center gap-2 py-4"
                            >
                              <div className="h-[1px] w-full bg-slate-200" />
                              <div className="flex flex-col items-center bg-slate-50 px-3 -mt-3.5">
                                <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${msg.text.includes(t('tags.chatClosed')) ? 'text-slate-400' : 'text-primary'}`}>
                                  {msg.text}
                                </span>
                                {msg.subtext && (
                                  <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                                    {msg.subtext}
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          );
                        }

                        return (
                          <div key={`message-${msgIdx}`}>
                            <motion.div 
                              className={`flex ${msg.type === 'sophie' ? 'justify-end' : 'justify-start'}`}
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ duration: 0.4 }}
                            >
                              <div className={`flex flex-col ${msg.type === 'sophie' ? 'items-end' : 'items-start'} gap-1`}>
                                <div 
                                  className={`rounded-2xl px-4 py-3 shadow-sm text-sm ${
                                    msg.type === 'sophie' 
                                      ? 'text-white rounded-tr-sm max-w-[90%]' 
                                      : 'bg-gray-100 text-slate-700 border border-gray-200 rounded-tl-sm'
                                  }`}
                                  style={msg.type === 'sophie' ? { backgroundColor: "#2563EB" } : {}}
                                >
                                  {msg.text && msg.text.includes("[link]") ? (
                                  <>
                                    {msg.text.split("[link]")[0]}
                                    <span className="font-bold underline cursor-pointer">[link]</span>
                                    {msg.text.split("[link]")[1]}
                                  </>
                                ) : msg.text}
                                </div>
                                <span className={`text-xs text-slate-400 ${msg.type === 'sophie' ? 'pr-2' : 'pl-2'}`}>{msg.time}</span>
                              </div>
                            </motion.div>

                            {msg.text && msg.text.includes(t('messages.jack4').split('.')[0]) && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center gap-2 py-2"
                              >
                                <div className="h-[1px] w-full bg-slate-200" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 -mt-3.5">{t('tags.leadQualified')}</span>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}

                    {showEngagement && visibleMessages.length < engagementMessages.length && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`relative flex items-center pt-4 pb-2 ${engagementMessages[visibleMessages.length]?.type === 'sophie' ? 'justify-end' : 'justify-start'}`}
                      >
                        {engagementMessages[visibleMessages.length]?.type !== 'tag' && (
                          <div className={`flex items-center gap-1 ${engagementMessages[visibleMessages.length]?.type === 'jack' ? 'bg-gray-100 border-gray-200' : 'bg-white border-slate-100'} border px-3 py-4 rounded-2xl shadow-sm scale-90 ${engagementMessages[visibleMessages.length]?.type === 'sophie' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                            <motion.span 
                              animate={{ opacity: [0.4, 1, 0.4] }} 
                              transition={{ repeat: Infinity, duration: 1.4, delay: 0 }}
                              className="w-2 h-2 bg-slate-400 rounded-full" 
                            />
                            <motion.span 
                              animate={{ opacity: [0.4, 1, 0.4] }} 
                              transition={{ repeat: Infinity, duration: 1.4, delay: 0.2 }}
                              className="w-2 h-2 bg-slate-400 rounded-full" 
                            />
                            <motion.span 
                              animate={{ opacity: [0.4, 1, 0.4] }} 
                              transition={{ repeat: Infinity, duration: 1.4, delay: 0.4 }}
                              className="w-2 h-2 bg-slate-400 rounded-full" 
                            />
                          </div>
                        )}
                      </motion.div>
                    )}

                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        </div>
      </motion.div>
    </div>
  );
}
