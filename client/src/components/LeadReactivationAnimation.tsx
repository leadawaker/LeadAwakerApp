import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    const startSequence = setTimeout(() => {
      for (let i = 0; i < 30; i++) {
        setTimeout(() => {
          const id = Date.now() + i;
          const startX = Math.random() * 100;
          const startY = Math.random() * 100;
          setCursors(prev => [...prev, { id, startX, startY }]);
          
          setTimeout(() => {
            setCursors(prev => prev.filter(c => c.id !== id));
            setBrightness(b => Math.min(b + (100 / 30), 100));
            if (i === 29) {
              setHasReachedEnd(true);
            }
          }, 1400);
        }, i * 250);
      }
    }, 1000); // 1 second initial delay

    return () => clearTimeout(startSequence);
  }, []);

  return (
    <div className="relative w-full h-[400px] bg-white flex items-center justify-center overflow-hidden font-sans rounded-xl border border-border mb-12">
      <style>{`
        @keyframes sparkle {
          0%, 100% { transform: scale(0); opacity: 0; }
          50% { transform: scale(var(--s, 1)); opacity: 1; }
        }
        .animate-sparkle {
          animation: sparkle 0.75s both;
        }
      `}</style>
      
      <AnimatePresence>
        {cursors.map(c => (
          <Cursor 
            key={c.id} 
            startX={c.startX} 
            startY={c.startY} 
            onHover={(clicking) => setActiveClickCount(n => clicking ? n + 1 : Math.max(0, n - 1))} 
          />
        ))}
      </AnimatePresence>
      <motion.button
        animate={{ scale: hasReachedEnd ? 1 : 0.45 + clickScale }}
        className="relative px-12 py-6 text-2xl font-bold rounded-2xl z-10 select-none overflow-hidden border border-black/10"
        style={{
          background: `linear-gradient(135deg, rgb(${currentC1.r}, ${currentC1.g}, ${currentC1.b}), rgb(${currentC2.r}, ${currentC2.g}, ${currentC2.b}))`,
          boxShadow: hasReachedEnd ? '0 15px 35px rgba(251, 191, 36, 0.4)' : 'none',
          color: brightness > 50 ? '#ffffff' : '#1e293b'
        }}
      >
        <motion.div
          animate={{ left: ['-100%', '200%'] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
          className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 z-20"
        />
        Your Brand
      </motion.button>
      {hasReachedEnd && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          <div className="relative w-[400px] h-[150px]">
            {[0, 0.2, 0.4, 0.6, 0.8].map((d, i) => (
              <svg
                key={i}
                viewBox="0 0 24 24"
                className="absolute w-6 h-6 fill-white opacity-0 animate-sparkle"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  '--s': 1 + Math.random(),
                  animationDelay: `${d}s`,
                } as any}
              >
                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
              </svg>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Cursor = ({ startX, startY, onHover }: { startX: number, startY: number, onHover: (clicking: boolean) => void }) => {
  const [phase, setPhase] = useState<'moving' | 'clicking' | 'done'>('moving');
  
  useEffect(() => {
    const t1 = setTimeout(() => { setPhase('clicking'); onHover(true); }, 1000);
    const t2 = setTimeout(() => { setPhase('done'); onHover(false); }, 1300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'done') return null;

  return (
    <motion.div
      initial={{ left: `${startX}%`, top: `${startY}%` }}
      animate={{ 
        left: '50%', 
        top: '50%', 
        scale: phase === 'clicking' ? 0.77 : 1 
      }}
      transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
      className="absolute z-20 pointer-events-none"
    >
      {phase === 'moving' ? (
        <svg width="45" height="45" viewBox="0 -1 32 26" fill="none">
          <path
            d="M1 3h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v2H9v1h1v2h1v2h-1v1H8v-1H7v-2H6v-2H5v1H4v1H3v1H1v-17z"
            fill="#ffffff"
            stroke="#000"
            strokeWidth="0.2"
          />
        </svg>
      ) : (
        <div className="relative">
          <svg width="45" height="45" viewBox="0 0 32 24" fill="none">
            <path
              d="M19 1h2v1h1v4h2v1h3v1h2v1h1v1h1v7h-1v3h-1v3H19v-3h-1v-2h-1v-2h-1v-2h-1v-1h-1v-3h3v1h1V2h1"
              fill="#ffffff"
              stroke="#000"
              strokeWidth="0.2"
            />
            <path d="M22 6v6" stroke="#000" strokeWidth="0.2" />
            <path d="M25 7v5" stroke="#000" strokeWidth="0.2" />
            <path d="M28 8v4" stroke="#000" strokeWidth="0.2" />
          </svg>
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-12 left-0 pointer-events-none"
          >
            <svg width="45" height="45" viewBox="0 0 32 24" className="overflow-visible">
              <path d="M12 -8 L6 -18" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
              <path d="M21 -12 L21 -24" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
              <path d="M30 -8 L36 -18" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default LeadReactivationAnimation;
