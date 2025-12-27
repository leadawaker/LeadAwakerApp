import { motion } from "framer-motion";

export default function ChatCard2D() {
  const messageVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.3,
      },
    }),
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 flex items-center gap-3" style={{ backgroundColor: "#2563EB" }}>
        <div className="rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ width: "44px", height: "44px", backgroundColor: "#6B6B6B" }}>
          J
        </div>
        <div>
          <h3 className="text-white font-medium text-sm">Jack Johnson</h3>
          <p className="text-xs flex items-center gap-1" style={{ color: "#FCC700" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#FCC700" }} />
            Online
          </p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="p-6 space-y-4 bg-slate-50 min-h-[400px] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100/20 via-transparent to-slate-100/20 pointer-events-none" />
        
        <div className="relative z-10 space-y-4">
          {/* Message 1 - Sophie */}
          <motion.div className="flex justify-end" custom={0} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true }}>
            <div className="flex flex-col items-end gap-1">
              <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                Hi, this is Sophie from Sterling Finance, is this Jack who wanted to check if they were owed a refund on their car finance?
              </div>
              <span className="text-xs text-slate-400 pr-2">14:35</span>
            </div>
          </motion.div>

          {/* Message 2 - Sophie */}
          <motion.div className="flex justify-end" custom={1} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true }}>
            <div className="flex flex-col items-end gap-1">
              <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#2563EB" }}>
                just bumping this up in case you got busy before :)
              </div>
              <span className="text-xs text-slate-400 pr-2">14:55</span>
            </div>
          </motion.div>

          {/* Message 3 - Jack */}
          <motion.div className="flex justify-start" custom={2} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true }}>
            <div className="flex flex-col items-start gap-1">
              <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%] shadow-sm text-sm whitespace-nowrap">
                Hi, yes
              </div>
              <span className="text-xs text-slate-400 pl-2">15:00</span>
            </div>
          </motion.div>

          {/* Message 4 - Jack */}
          <motion.div className="flex justify-start" custom={3} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true }}>
            <div className="flex flex-col items-start gap-1">
              <div className="bg-white text-slate-700 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm text-sm">
                I would like to check. I had 2 cars on finance 5 years ago
              </div>
              <span className="text-xs text-slate-400 pl-2">15:01</span>
            </div>
          </motion.div>

          {/* Message 5 - Sophie */}
          <motion.div className="flex justify-end" custom={4} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true }}>
            <div className="flex flex-col items-end gap-1">
              <div className="text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm text-sm" style={{ backgroundColor: "#3B82F6" }}>
                That's great Jack! Do you happen to have your vehicle finance agreement documents handy for those cars?
              </div>
              <span className="text-xs text-slate-400 pr-2">15:04</span>
            </div>
          </motion.div>

          {/* Typing Indicator */}
          <motion.div className="flex justify-start" custom={5} initial="hidden" whileInView="visible" variants={messageVariants} viewport={{ once: true }}>
            <div className="bg-slate-200 text-slate-500 rounded-full px-4 py-2 shadow-sm flex items-center justify-center gap-2">
              <motion.span className="text-4xl font-black" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}>·</motion.span>
              <motion.span className="text-4xl font-black" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}>·</motion.span>
              <motion.span className="text-4xl font-black" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}>·</motion.span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
