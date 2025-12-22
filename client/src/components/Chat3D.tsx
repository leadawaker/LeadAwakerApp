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
          y: scrollY * 0.3,
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
            background: "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 100%), linear-gradient(to right, rgba(0,122,107,0.02) 0%, transparent 50%)"
          }}
          data-testid="chat-3d-card"
        >
          {/* Cool glow effect */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(circle at 20% 50%, rgba(0,122,107,0.05) 0%, transparent 40%)",
          }} />
          
          {/* Chat Header */}
          <div className="p-4 flex items-center gap-3" style={{ backgroundColor: "#007A6B" }}>
            <div className="rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ width: "44px", height: "44px", backgroundColor: "#6B6B6B" }} data-testid="chat-avatar">J</div>
            <div>
              <h3 className="text-white font-medium text-sm" data-testid="chat-name">Jack Johnson</h3>
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
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#007A6B" }}>
                    Hi, this is Sophie from Sterling Finance, is this Jack who wanted to check if they were owed a refund on their car finance?
                  </div>
                  <span className="text-xs text-slate-400 pr-2">14:35</span>
                </div>
              </motion.div>

              {/* Message 2 - Sophie */}
              <motion.div className="flex justify-end" custom={1} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#007A6B" }}>
                    just bumping this up in case you got busy before :)
                  </div>
                  <span className="text-xs text-slate-400 pr-2">14:55</span>
                </div>
              </motion.div>

              {/* Message 3 - Jack */}
              <motion.div className="flex justify-start" custom={2} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-jack-1">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%] shadow-sm text-sm whitespace-nowrap">
                    Hi, yes
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:00</span>
                </div>
              </motion.div>

              {/* Message 4 - Jack */}
              <motion.div className="flex justify-start" custom={3} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-jack-2">
                <div className="flex flex-col items-start gap-1">
                  <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm text-sm">
                    I would like to check. I had 2 cars on finance 5 years ago
                  </div>
                  <span className="text-xs text-slate-400 pl-2">15:01</span>
                </div>
              </motion.div>

              {/* Message 5 - Sophie */}
              <motion.div className="flex justify-end" custom={4} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-sophie-3">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#009B88" }}>
                    That's great Jack! Do you happen to have your vehicle finance agreement documents handy for those cars?
                  </div>
                  <span className="text-xs text-slate-400 pr-2">15:04</span>
                </div>
              </motion.div>

              {/* Typing Indicator */}
              <motion.div className="flex justify-start" custom={5} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true, margin: "-100px" }} data-testid="message-typing">
                <div className="bg-slate-200 text-slate-500 rounded-full px-4 py-2 shadow-sm flex items-center justify-center gap-2">
                  <motion.span className="text-4xl font-black" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}>·</motion.span>
                  <motion.span className="text-4xl font-black" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}>·</motion.span>
                  <motion.span className="text-4xl font-black" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}>·</motion.span>
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
