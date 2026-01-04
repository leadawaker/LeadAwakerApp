import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CursorData {
  id: number;
  startX: number;
  startY: number;
}

const LeadReactivationAnimation = () => {
  const [brightness, setBrightness] = useState(0);
  const [cursors, setCursors] = useState<CursorData[]>([]);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [activeClickCount, setActiveClickCount] = useState(0);
  const [clickScale, setClickScale] = useState(0);
  const [showInitialHighlight, setShowInitialHighlight] = useState(true);

  useEffect(() => {
    if (activeClickCount > 0) {
      setClickScale(prev => Math.min(prev + (0.75 / 30), 0.75));
    }
  }, [activeClickCount]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInitialHighlight(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

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
  }, []);

  return (
    <div className="relative w-full h-screen bg-slate-50 flex items-center justify-center overflow-hidden font-sans">
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

      <div className="relative">
        <motion.button
          data-testid="button-reactivation"
          animate={{ 
            scale: hasReachedEnd ? 1 : 0.25 + clickScale,
          }}
          className="relative px-12 py-6 text-2xl font-bold rounded-2xl z-10 select-none overflow-hidden border border-black/5 shadow-xl transition-shadow"
          style={{
            background: `linear-gradient(135deg, rgb(${currentC1.r}, ${currentC1.g}, ${currentC1.b}), rgb(${currentC2.r}, ${currentC2.g}, ${currentC2.b}))`,
            boxShadow: hasReachedEnd 
              ? '0 20px 40px -10px rgba(251, 191, 36, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)' 
              : '0 4px 12px rgba(0,0,0,0.05)',
            color: brightness > 50 ? '#ffffff' : '#1e293b'
          }}
        >
          <AnimatePresence>
            {showInitialHighlight && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0, 0.6, 0], scale: [0.8, 1.2, 1.5] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="absolute inset-0 bg-blue-500/40 pointer-events-none rounded-2xl blur-md"
              />
            )}
          </AnimatePresence>

          {!hasReachedEnd && (
            <motion.div 
              animate={{ 
                opacity: [0.05, 0.15, 0.05],
                scale: [1, 1.05, 1]
              }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="absolute inset-0 bg-white pointer-events-none rounded-2xl"
            />
          )}

          <AnimatePresence>
            {hasReachedEnd && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.8, 0] }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute inset-0 bg-white pointer-events-none rounded-2xl z-20"
              />
            )}
          </AnimatePresence>

          Your Brand
        </motion.button>
        
        <motion.div
          animate={{ 
            scale: hasReachedEnd ? 1.4 : 0.2 + clickScale,
            opacity: hasReachedEnd ? 0.3 : 0.1
          }}
          className="absolute inset-0 bg-blue-400 blur-3xl -z-10 rounded-full"
        />
      </div>

      {hasReachedEnd && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          <div className="relative w-[400px] h-[150px]">
            {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((d, i) => (
              <svg
                key={i}
                viewBox="0 0 24 24"
                className="absolute w-6 h-6 fill-amber-400 opacity-0 animate-sparkle"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  '--s': 0.5 + Math.random(),
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

interface CursorProps {
  startX: number;
  startY: number;
  onHover: (clicking: boolean) => void;
}

const Cursor = ({ startX, startY, onHover }: CursorProps) => {
  const [phase, setPhase] = useState('moving');
  
  const [randomConfig] = useState(() => {
    const isFirstFew = Math.random() > 0.5;
    const isSlow = Math.random() < (5 / 30);
    const baseDuration = 0.5 + Math.random() * 0.6;
    
    const jitterMultiplier = isFirstFew ? 1.2 : 0.8;
    return {
      jitterX: (isFirstFew ? (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 5) * jitterMultiplier,
      jitterY: (isFirstFew ? (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 5) * jitterMultiplier,
      duration: isSlow ? baseDuration * 1.3 : baseDuration,
      delay: Math.random() * 0.2,
      pathType: Math.floor(Math.random() * 4),
      halfwayOffset: {
        x: (Math.random() - 0.5) * (isFirstFew ? 18 : 12),
        y: (Math.random() - 0.5) * (isFirstFew ? 18 : 12)
      }
    };
  });

  useEffect(() => {
    const t_hover = setTimeout(() => { setPhase('hover'); }, 600);
    const t_click = setTimeout(() => { setPhase('clicking'); onHover(true); }, 1000);
    const t_done = setTimeout(() => { setPhase('done'); onHover(false); }, 1300);
    
    return () => { 
      clearTimeout(t_hover); 
      clearTimeout(t_click); 
      clearTimeout(t_done); 
    };
  }, [onHover]);

  if (phase === 'done') return null;

  const isClicking = phase === 'clicking';
  const isHand = phase === 'hover' || phase === 'clicking';

  const getKeyframes = () => {
    if (isClicking) return { x: 0, y: 0, scale: 0.77 };
    
    const halfwayX = randomConfig.halfwayOffset.x;
    const halfwayY = randomConfig.halfwayOffset.y;
    switch(randomConfig.pathType) {
      case 1: // Curved: Adds a single arc via a halfway point
        return {
          x: [0, halfwayX, randomConfig.jitterX, 0],
          y: [0, halfwayY, randomConfig.jitterY, 0],
        };
      case 2: // Erratic: Moves back and forth (zags) before settling
        return {
          x: [0, halfwayX, -randomConfig.jitterX * 0.8, randomConfig.jitterX, 0],
          y: [0, -halfwayY * 0.5, randomConfig.jitterY, -randomConfig.jitterY * 0.3, 0],
        };
      case 3: // Spiral/Overshoot: Swings wide (overshoots) then pulls back
        return {
          x: [0, halfwayX * 1.5, -randomConfig.jitterX, randomConfig.jitterX * 0.5, 0],
          y: [0, -halfwayY, randomConfig.jitterY * 1.2, 0],
        };
      default: // Subtle: A slight wobble rather than a pure straight line
        return {
          x: [0, halfwayX * 0.2, randomConfig.jitterX, 0],
          y: [0, halfwayY * 0.2, randomConfig.jitterY, 0],
        };
    }
  };

  const keyframes = getKeyframes();

  return (
    <motion.div
      initial={{ left: `${startX}%`, top: `${startY}%`, rotate: Math.random() * 30 - 15 }}
      animate={{ 
        left: '50%', 
        top: '50%',
        rotate: isClicking ? 0 : (Math.random() * 20 - 10),
        ...keyframes
      }}
      transition={{ 
        duration: randomConfig.duration, 
        delay: randomConfig.delay,
        ease: [0.34, 1.56, 0.64, 1]
      }}
      className="absolute z-20 pointer-events-none"
    >
      {!isHand ? (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="drop-shadow-lg">
          <path
            d="M1 1l12.5 25.5L17 17l9.5-3.5L1 1z"
            fill="white"
            stroke="black"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <div className="relative">
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none" className="drop-shadow-lg">
            <path
              d="M19 1h2v1h1v4h2v1h3v1h2v1h1v1h1v7h-1v3h-1v3H19v-3h-1v-2h-1v-2h-1v-2h-1v-1h-1v-10h3v1h1V2h1"
              fill="white"
              stroke="black"
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            <path d="M22 6v6" stroke="black" strokeWidth="1.8" />
            <path d="M25 7v5" stroke="black" strokeWidth="1.8" />
            <path d="M28 8v4" stroke="black" strokeWidth="1.8" />
          </svg>
          
          {isClicking && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[40%] pt-1"
            >
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: [4, 12, 4], opacity: [0, 1, 0] }}
                    transition={{ duration: 0.3, repeat: 1 }}
                    className="w-1 bg-amber-400 rounded-full"
                    style={{ transform: `rotate(${(i - 1) * 35}deg)` }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default LeadReactivationAnimation;
