import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function Chat3D() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
          transition: "transform 0.1s ease-out"
        }}>
        {/* The Chat Card */}
        <div 
          className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative"
          style={{
            transform: "rotateY(0deg) rotateX(0deg) rotateZ(0deg)",
            boxShadow: "15px 15px 40px -10px rgba(0,0,0,0.08), -8px -8px 20px rgba(255,255,255,0.6)",
            background: "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 100%), linear-gradient(to right, rgba(37,99,235,0.02) 0%, transparent 50%)"
          }}
          data-testid="chat-3d-card"
        >
          {/* Cool glow effect */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(circle at 20% 50%, rgba(37,99,235,0.05) 0%, transparent 40%)",
          }} />
          
          {/* Chat Header */}
          <div className="p-4 flex items-center gap-3" style={{ backgroundColor: "#2563EB" }}>
            <div className="rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ width: "44px", height: "44px", backgroundColor: "#6B6B6B" }} data-testid="chat-avatar">M</div>
            <div>
              <h3 className="text-white font-medium text-sm" data-testid="chat-name">Maria Silva</h3>
              <p className="text-xs flex items-center gap-1" style={{ color: "#FCC700" }} data-testid="chat-status">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#FCC700" }} />
                Online
              </p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="p-6 space-y-4 bg-slate-50 min-h-[400px] relative overflow-hidden">
            {/* Overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100/20 via-transparent to-slate-100/20 pointer-events-none" />
            
            <div className="relative z-10 space-y-4">
              {/* Message 1 - Sophie */}
              <motion.div className="flex justify-end" custom={0} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-1">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    Hi Maria, this is Sophie from Peak Creative checking in. You reached out back in July about getting a new website that converts better for your coaching business. Did that timing work out, or should we circle back? 😊
                  </div>
                  <span className="text-xs text-slate-400 pr-2">14:35</span>
                </div>
              </motion.div>

              {/* Message 2 - Sophie */}
              <motion.div className="flex justify-end" custom={1} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    Just bumping this up in case you got busy over the holidays! Still on your radar?
                  </div>
                  <span className="text-xs text-slate-400 pr-2">14:55</span>
                </div>
              </motion.div>

              {/* Message 3 - Maria */}
              <motion.div className="flex justify-start" custom={2} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-maria-1">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%] shadow-sm text-sm">
                    Hi Sophie! Yes sorry, summer was crazy with client launches. The website is definitely still something I need.
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:02</span>
                </div>
              </motion.div>

              {/* Message 4 - Sophie */}
              <motion.div className="flex justify-end" custom={3} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-3">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>No worries at all Maria, I totally get it! Quick question: what was the main blocker that kept it on hold? (Budget, timeline, or just other fires?)</div>
                  <span className="text-xs text-slate-400 pr-2">15:03</span>
                </div>
              </motion.div>

              {/* Lead Engaged Divider */}
              <motion.div 
                className="flex items-center justify-center gap-4 py-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 4 }}
              >
                <div className="h-[1px] flex-grow bg-slate-200" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">--- Lead Engaged ---</span>
                <div className="h-[1px] flex-grow bg-slate-200" />
              </motion.div>

              {/* Message 5 - Maria */}
              <motion.div className="flex justify-start" custom={5} initial="hidden" animate="visible" variants={messageVariants} data-testid="message-maria-2">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%] shadow-sm text-sm">
                    Honestly a bit of all three. I need something that looks pro but doesn't take forever or cost a fortune.
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:06</span>
                </div>
              </motion.div>

              {/* Message 6 - Sophie */}
              <motion.div className="flex justify-end" custom={6} initial="hidden" animate="visible" variants={messageVariants} data-testid="message-sophie-4">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    Perfect, that's exactly what we specialize in. We've since added templates that cut delivery from 8 weeks to 3 while keeping the custom feel. Want me to send over 3 options that match your coaching niche with rough timelines and pricing? Or hop on a quick 15-min call tomorrow to walk through?
                  </div>
                  <span className="text-xs text-slate-400 pr-2">15:08</span>
                </div>
              </motion.div>

              {/* Message 7 - Maria */}
              <motion.div className="flex justify-start" custom={7} initial="hidden" animate="visible" variants={messageVariants} data-testid="message-maria-3">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%] shadow-sm text-sm">
                    The 15-min call tomorrow works great! What times do you have?
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:09</span>
                </div>
              </motion.div>

              {/* Appointment Confirmed Divider */}
              <motion.div 
                className="flex items-center justify-center gap-4 py-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 8 }}
              >
                <div className="h-[1px] flex-grow bg-green-200" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-green-500">--- Appointment Confirmed ---</span>
                <div className="h-[1px] flex-grow bg-green-200" />
              </motion.div>

              {/* Message 8 - Sophie */}
              <motion.div className="flex justify-end" custom={9} initial="hidden" animate="visible" variants={messageVariants} data-testid="message-sophie-5">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                    Awesome! Here's my Calendly for tomorrow: [link]<br/>
                    I'll send a recap of our chat there too so you have it handy. Talk soon Maria! 🚀
                  </div>
                  <span className="text-xs text-slate-400 pr-2">15:10</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        </div>
      </motion.div>
    </div>
  );
}
