import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LeadReactivationAnimation = () => {
  const [brightness, setBrightness] = useState(0);
  const [cursors, setCursors] = useState<{id: number, startX: number, startY: number}[]>([]);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [activeClickCount, setActiveClickCount] = useState(0);
  const [clickScale, setClickScale] = useState(0);

  useEffect(() => {
    if (activeClickCount > 0) {
      setClickScale(prev => Math.min(prev + (0.75 / 30), 0.75)); 
    }
  }, [activeClickCount]);

  // Color logic for the transition
  const currentC1 = {
    r: 59 + (251 - 59) * (brightness / 100),
    g: 130 + (191 - 130) * (brightness / 100),
    b: 246 + (36 - 246) * (brightness / 100)
  };
  const currentC2 = {
    r: 13 + (251 - 13) * (brightness / 100),
    g: 148 + (146 - 148) * (brightness / 100),
    b: 136 + (60 - 136) * (brightness / 100)
  };

  useEffect(() => {
    // Generates 30 cursors for the sequence
    for(let i = 0; i < 30; i++) {
      setTimeout(() => {
        const id = Date.now() + i;
        const startX = Math.random() * 100;
        const startY = Math.random() * 100;
        setCursors(prev => [...prev, { id, startX, startY }]);
        
        setTimeout(() => {
          setCursors(prev => prev.filter(c => c.id !== id));
          setBrightness(b => Math.min(b + (100 / 30), 100));
          if (i === 29) setHasReachedEnd(true);
        }, 1400);
      }, i * 250);
    }
  }, []);

  return (
    <div className="relative w-full h-[400px] bg-white flex items-center justify-center overflow-hidden font-sans rounded-xl border border-border mb-12">
      <AnimatePresence>
        {cursors.map(c => (
          <Cursor 
            key={c.id} 
            startX={c.startX} 
            startY={c.startY} 
            onHover={(clicking: boolean) => setActiveClickCount(n => clicking ? n + 1 : Math.max(0, n - 1))} 
          />
        ))}
      </AnimatePresence>
      <motion.button
        animate={{ scale: hasReachedEnd ? 1 : 0.25 + clickScale }}
        className="relative px-12 py-6 text-2xl font-bold rounded-2xl z-10 select-none overflow-hidden border border-black/10"
        style={{
          background: `linear-gradient(135deg, rgb(${currentC1.r}, ${currentC1.g}, ${currentC1.b}), rgb(${currentC2.r}, ${currentC2.g}, ${currentC2.b}))`,
          boxShadow: hasReachedEnd ? '0 15px 35px rgba(251, 191, 36, 0.4)' : 'none',
          color: brightness > 50 ? '#fff' : '#1e293b'
        }}
      >
        Your Brand
      </motion.button>
    </div>
  );
};

const Cursor = ({ startX, startY, onHover }: { startX: number, startY: number, onHover: (clicking: boolean) => void }) => {
  const [phase, setPhase] = useState('moving');
  const useHand = useMemo(() => Math.random() > 0.5, []);
  
  useEffect(() => {
    const t1 = setTimeout(() => { setPhase('clicking'); onHover(true); }, 1000);
    const t2 = setTimeout(() => { setPhase('done'); onHover(false); }, 1300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'done') return null;

  const arrowSVG = (
    <svg width="30" height="30" viewBox="0 0 32 24">
      <path d="M1 3h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v2H9v1h1v2h1v2h-1v1H8v-1H7v-2H6v-2H5v1H4v1H3v1H1" fill="#ffffff" stroke="#000" strokeWidth="0.2"/>
    </svg>
  );

  const handSVG = (
    <svg width="30" height="30" viewBox="0 0 32 24">
      <path d="M19 1h2v1h1v4h2v1h3v1h2v1h1v1h1v7h-1v3h-1v3H19v-3h-1v-2h-1v-2h-1v-2h-1v-1h-1v-3h3v1h1V2h1" fill="#ffffff" stroke="#000" strokeWidth="0.2"/>
    </svg>
  );

  return (
    <motion.div
      initial={{ left: `${startX}%`, top: `${startY}%` }}
      animate={{ 
        left: '50%', 
        top: '50%', 
        scale: phase === 'clicking' ? 0.75 : 1 
      }}
      transition={{ duration: 1, ease: "easeOut" }}
      className="absolute z-20 pointer-events-none"
    >
      {useHand ? handSVG : arrowSVG}
      {phase === 'clicking' && (
         <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 pointer-events-none">
            <svg width="30" height="30" viewBox="0 0 32 24" className="overflow-visible">
                <path d="M12 -8 L6 -18" stroke="#fbbf24" strokeWidth="3" />
                <path d="M21 -12 L21 -24" stroke="#fbbf24" strokeWidth="3" />
                <path d="M30 -8 L36 -18" stroke="#fbbf24" strokeWidth="3" />
            </svg>
         </motion.g>
      )}
    </motion.div>
  );
};

export default LeadReactivationAnimation;
