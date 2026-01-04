import React, { useState, useEffect, useRef } from 'react';
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
  offsetX: number;
  offsetY: number;
}

const LeadReactivationAnimation = () => {
  const [brightness, setBrightness] = useState(0);
  const [cursors, setCursors] = useState<CursorData[]>([]);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [activeClickCount, setActiveClickCount] = useState(0);
  const [clickScale, setClickScale] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const id = Date.now() + i;
        const startX = Math.random() * 100;
        const startY = Math.random() * 100;
        const offsetX = (Math.random() - 0.5) * 40;
        const offsetY = (Math.random() - 0.5) * 40;
        setCursors(prev => [...prev, { id, startX, startY, offsetX, offsetY }]);
        
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
            targetOffsetX={c.offsetX}
            targetOffsetY={c.offsetY}
            buttonRef={buttonRef}
            onHover={(clicking) => setActiveClickCount(n => clicking ? n + 1 : Math.max(0, n - 1))} 
          />
        ))}
      </AnimatePresence>

      <div className="relative">
        <motion.button
          ref={buttonRef}
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

const Cursor = ({ startX, startY, targetOffsetX, targetOffsetY, buttonRef, onHover }: { startX: number, startY: number, targetOffsetX: number, targetOffsetY: number, buttonRef: React.RefObject<HTMLButtonElement>, onHover: (clicking: boolean) => void }) => {
  const [phase, setPhase] = useState('moving');
  const cursorRef = useRef<HTMLDivElement>(null);
  
  const [randomConfig] = useState(() => {
    const isFirstFew = Math.random() > 0.5;
    const isSlow = Math.random() < (5 / 30);
    const baseDuration = 0.5 + Math.random() * 0.6;
    
    const jitterMultiplier = isFirstFew ? 1.2 : 0.8;
    return {
      jitterX: (isFirstFew ? (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 5) * jitterMultiplier * 25,
      jitterY: (isFirstFew ? (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 5) * jitterMultiplier * 25,
      duration: isSlow ? baseDuration * 1.3 : baseDuration,
      delay: Math.random() * 0.2,
      pathType: Math.floor(Math.random() * 4),
      halfwayOffset: {
        x: (Math.random() - 0.5) * (isFirstFew ? 18 : 12) * 5,
        y: (Math.random() - 0.5) * (isFirstFew ? 18 : 12) * 5
      }
    };
  });

  useEffect(() => {
    const checkCollision = setInterval(() => {
      if (!cursorRef.current || !buttonRef.current || phase === 'clicking' || phase === 'done') return;
      
      const cursorRect = cursorRef.current.getBoundingClientRect();
      const buttonRect = buttonRef.current.getBoundingClientRect();
      
      const cx = cursorRect.left + cursorRect.width / 2;
      const cy = cursorRect.top + cursorRect.height / 2;
      
      const inside = (
        cx >= buttonRect.left &&
        cx <= buttonRect.right &&
        cy >= buttonRect.top &&
        cy <= buttonRect.bottom
      );

      if (inside && phase === 'moving') {
        setPhase('hover');
      }
    }, 50);
    
    return () => clearInterval(checkCollision);
  }, [buttonRef, phase]);

  useEffect(() => {
    const t_click = setTimeout(() => { 
      setPhase('clicking'); 
      onHover(true); 
    }, 1000);
    const t_done = setTimeout(() => { 
      setPhase('done'); 
      onHover(false); 
    }, 1300);
    
    return () => { 
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
      ref={cursorRef}
      initial={{ left: `${startX}%`, top: `${startY}%`, rotate: Math.random() * 30 - 15 }}
      animate={{ 
        left: `calc(50% + ${targetOffsetX}px)`, 
        top: `calc(50% + ${targetOffsetY}px)`,
        rotate: isClicking ? 0 : (Math.random() * 20 - 10),
        x: keyframes.x,
        y: keyframes.y,
        scale: keyframes.scale ?? 1,
        opacity: isClicking ? [1, 1, 0] : 1
      }}
      transition={{ 
        duration: 1.2, 
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
            strokeWidth="2.9"
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
              strokeWidth="2.9"
              strokeLinejoin="round"
            />
            <path d="M22 6v6" stroke="black" strokeWidth="2.4" />
            <path d="M25 7v5" stroke="black" strokeWidth="2.4" />
            <path d="M28 8v4" stroke="black" strokeWidth="2.4" />
          </svg>
          
          {isClicking && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.5, y: 5 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <svg width="40" height="40" viewBox="0 0 32 24" className="overflow-visible">
                <path d="M12 -8 L6 -18" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
                <path d="M21 -12 L21 -24" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
                <path d="M30 -8 L36 -18" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default LeadReactivationAnimation;
