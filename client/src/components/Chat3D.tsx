import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";

export default function Chat3D() {
  const [scrollY, setScrollY] = useState(0);
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

  const [showEngagement, setShowEngagement] = useState(false);
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);

  const engagementMessages = [
    { type: 'jack', text: "Honestly a bit of all three. I need something that looks pro but doesn't take forever or cost a fortune.", time: "15:06" },
    { type: 'sophie', text: "Perfect, that's exactly what we specialize in. We've since added templates that cut delivery from 8 weeks to 3 while keeping the custom feel. Want me to send over 3 options that match your coaching niche with rough timelines and pricing? Or hop on a quick 15-min call tomorrow to walk through?", time: "15:08" },
    { type: 'jack', text: "The 15-min call tomorrow works great! What times do you have?", time: "15:09" },
    { type: 'sophie', text: "Awesome! Here's my Calendly for tomorrow: [link]\nI'll send a recap of our chat there too so you have it handy. Talk soon Jack! 🚀", time: "15:10" }
  ];

  useEffect(() => {
    if (showEngagement) {
      setVisibleMessages([]);

      // Sequence with explicit delays
      const timeouts: NodeJS.Timeout[] = [];
      
      engagementMessages.forEach((_, index) => {
        const timeout = setTimeout(() => {
          setVisibleMessages(prev => [...prev, index]);
        }, index * 2000);
        timeouts.push(timeout);
      });

      return () => timeouts.forEach(t => clearTimeout(t));
    }
  }, [showEngagement]);

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
    <div className="relative perspective-container">
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
        }}
      >
        <div style={{ 
          transform: `rotateY(${Math.min(-10.5 + scrollY * 0.05, 0)}deg) rotateX(${Math.max(10.5 - scrollY * 0.05, 0)}deg)`, 
          transformStyle: "preserve-3d",
          transition: "transform 0.1s ease-out",
          marginTop: "50px"
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
              <h3 className="text-white font-medium text-sm" data-testid="chat-name">Jack Johnson</h3>
              <p className="text-xs flex items-center gap-1" style={{ color: "#FCC700" }} data-testid="chat-status">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#FCC700" }} />
                Online
              </p>
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            className="p-6 pb-2 space-y-4 bg-slate-50 min-h-[700px] max-h-[800px] overflow-y-auto relative scrollbar-hide"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100/20 via-transparent to-slate-100/20 pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <motion.div className="flex justify-end" custom={0} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-1">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    Hi Jack, this is Sophie from Peak Creative checking in. You reached out back in July about getting a new website that converts better for your coaching business. Did that timing work out, or should we circle back? 😊
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
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 -mt-3.5">Lead Engaged</span>
              </motion.div>

              <motion.div className="flex justify-end" custom={1} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    Just bumping this up in case you got busy over the holidays! Still on your radar?
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
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 -mt-3.5">Follow up sent</span>
              </motion.div>

              <motion.div className="flex justify-start" custom={2} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-jack-1">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%] shadow-sm text-sm">
                    Hi Sophie! Yes sorry, summer was crazy with client launches. The website is definitely still something I need.
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
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 -mt-3.5">Lead Replied</span>
              </motion.div>

              <motion.div className="flex justify-end" custom={3} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-3">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>No worries at all Jack, I totally get it! Quick question: what was the main blocker that kept it on hold? (Budget, timeline, or just other fires?)</div>
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
                    <div className="absolute left-0 flex items-center gap-1 bg-white border border-slate-100 px-3 py-4 rounded-2xl rounded-bl-sm shadow-sm scale-90">
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
                      Continue
                    </button>
                  </motion.div>
                ) : (
                  <>
                    {visibleMessages
                      .filter(msgIdx => msgIdx < engagementMessages.length)
                      .map((msgIdx) => {
                        const msg = engagementMessages[msgIdx];
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
                                  className={`rounded-2xl px-4 py-3 max-w-[95%] shadow-sm text-sm ${
                                    msg.type === 'sophie' 
                                      ? 'text-white rounded-tr-sm' 
                                      : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm'
                                  }`}
                                  style={msg.type === 'sophie' ? { backgroundColor: "#2563EB" } : {}}
                                >
                                  {msg.text.includes("[link]") ? (
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

                            {msg.text.includes("The 15-min call tomorrow works great!") && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center gap-2 py-2"
                              >
                                <div className="h-[1px] w-full bg-slate-200" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 -mt-3.5">Lead Qualified</span>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}

                    {visibleMessages.length === engagementMessages.length && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex flex-col items-center gap-2 py-4"
                      >
                        <div className="h-[1px] w-full bg-slate-200" />
                        <div className="flex flex-col items-center bg-slate-50 px-3 -mt-3.5">
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Call Booked 🗓️</span>
                          <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest mt-1">Sent to Client</span>
                        </div>
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
