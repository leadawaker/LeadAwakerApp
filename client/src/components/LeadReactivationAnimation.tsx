import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LeadReactivationAnimation = () => {
  const [brightness, setBrightness] = useState(0);
  const [cursors, setCursors] = useState<{id: number, startX: number, startY: number, offsetX: number, offsetY: number}[]>([]);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [activeClickCount, setActiveClickCount] = useState(0);
  const [clickScale, setClickScale] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeClickCount > 0) {
      setClickScale(prev => Math.min(prev + (0.75 / 33), 0.75));
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
    const sequence = [
      { delay: 1500, startX: 0, startY: 20 },
      { delay: 3000, startX: 100, startY: 30 },
      { delay: 4500, startX: 15, startY: 100 },
      { delay: 6000, startX: 40, startY: 0 },
      { delay: 6300, startX: 100, startY: 15 },
      { delay: 6600, startX: 0, startY: 50 },
      { delay: 6900, startX: 100, startY: 60 },
      { delay: 7200, startX: 35, startY: 100 },
      { delay: 7400, startX: 100, startY: 25 },
      { delay: 7600, startX: 0, startY: 40 },
      { delay: 7800, startX: 100, startY: 45 },
      { delay: 8000, startX: 0, startY: 65 },
      { delay: 8100, startX: 100, startY: 75 },
      { delay: 8200, startX: 45, startY: 0 },
      { delay: 8300, startX: 100, startY: 85 },
      { delay: 8400, startX: 0, startY: 55 },
      { delay: 8500, startX: 100, startY: 20 },
      { delay: 8600, startX: 50, startY: 100 },
      { delay: 8700, startX: 0, startY: 25 },
      { delay: 8800, startX: 100, startY: 40 },
      { delay: 8900, startX: 35, startY: 0 },
      { delay: 9000, startX: 100, startY: 70 },
      { delay: 9100, startX: 0, startY: 85 },
      { delay: 9200, startX: 100, startY: 30 },
      { delay: 9300, startX: 40, startY: 100 },
      { delay: 9400, startX: 100, startY: 50 },
      { delay: 9500, startX: 0, startY: 35 },
      { delay: 9600, startX: 55, startY: 100 },
      { delay: 9700, startX: 0, startY: 65 },
      { delay: 9800, startX: 100, startY: 55 },
      { delay: 9900, startX: 50, startY: 0 },
      { delay: 10000, startX: 100, startY: 20 },
      { delay: 10100, startX: 0, startY: 75 }
    ];
    sequence.forEach((cursor, index) => {
      setTimeout(() => {
        const id = Date.now() + index;
        // Shifted clicks slightly more to the left: offsetX range is now approx -40 to +20 instead of -15 to +15
        const offsetX = ((Math.random() - 0.5) * 30) - 10; 
        const offsetY = (Math.random() - 0.5) * 10; 
        setCursors(prev => [...prev, { ...cursor, id, offsetX, offsetY }]);
        
        setTimeout(() => {
          setCursors(prev => prev.filter(c => c.id !== id));
          setBrightness(b => Math.min(b + (100 / 33), 100));
          if (index === sequence.length - 1) {
            setHasReachedEnd(true);
          }
        }, 1400);
      }, cursor.delay);
    });
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
      
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none mix-blend-multiply" />
      
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
      <motion.button
        ref={buttonRef}
        animate={{ 
          scale: hasReachedEnd ? 1 : 0.25 + clickScale,
          opacity: 1,
          boxShadow: brightness === 0 
            ? [
                '0 4px 12px -4px rgba(0,0,0,0.1), 0 0 0 0px rgba(255, 255, 255, 0), inset 0 1px 2px rgba(255,255,255,0.4)',
                '0 4px 12px -4px rgba(0,0,0,0.1), 0 0 20px 4px rgba(255, 255, 255, 0.6), inset 0 1px 4px rgba(255,255,255,0.8)',
                '0 4px 12px -4px rgba(0,0,0,0.1), 0 0 0 0px rgba(255, 255, 255, 0), inset 0 1px 2px rgba(255,255,255,0.4)'
              ]
            : hasReachedEnd 
              ? '0 15px 35px -12px rgba(251, 191, 36, 0.4), 0 8px 15px -6px rgba(251, 146, 60, 0.2), inset 0 1px 1px rgba(255,255,255,0.4)' 
              : `0 4px 12px -4px rgba(0,0,0,0.1), 0 ${brightness * 0.1}px ${brightness * 0.4}px rgba(251, 191, 36, ${brightness * 0.003 + 0.05}), inset 0 1px 1px rgba(255,255,255,0.2)`
        }}
        transition={brightness === 0 ? { boxShadow: { repeat: Infinity, duration: 2 } } : { duration: 0.2 }}
        initial={{ opacity: 0, scale: 0.25 }}
        className="relative px-12 py-6 text-2xl font-bold rounded-2xl z-10 select-none overflow-hidden border border-black/15 transition-all duration-200"
        style={{
          background: `linear-gradient(135deg, rgb(${currentC1.r}, ${currentC1.g}, ${currentC1.b}), rgb(${currentC2.r}, ${currentC2.g}, ${currentC2.b}))`,
          color: (activeClickCount > 0 || hasReachedEnd) ? '#ffffff' : '#1e293b'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50 pointer-events-none" />
        
        {/* Periodic Shine Effect */}
        {hasReachedEnd && (
          <motion.div
            initial={{ left: '-100%' }}
            animate={{ left: '200%' }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 5.5, // 1.5s duration + 5.5s delay = 7s cycle
              ease: "easeInOut"
            }}
            className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 z-20 pointer-events-none"
          />
        )}

        <span className="relative z-10 tracking-tight text-[1.44em]">Your Brand</span>
      </motion.button>
      {hasReachedEnd && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          <div className="relative w-[400px] h-[150px]">
            {[
              { x: 0, y: 20, s: 1.1, d: 0 },
              { x: 15, y: 80, s: 1.25, d: 0.2 },
              { x: 45, y: 40, s: 1.1, d: 0.4 },
              { x: 75, y: 60, s: 0.9, d: 0.6 },
              { x: 100, y: 30, s: 0.8, d: 0.8 },
              { x: 25, y: 10, s: 1.0, d: 1.0 },
              { x: 85, y: 90, s: 1.2, d: 1.2 },
            ].map((config, i) => (
              <svg
                key={i}
                viewBox="0 0 24 24"
                className="absolute w-6 h-6 fill-white opacity-0 animate-sparkle"
                style={{
                  left: `${config.x}%`,
                  top: `${config.y}%`,
                  '--s': config.s,
                  animationDelay: `${config.d}s`,
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
  const [isOverButton, setIsOverButton] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const checkCollision = setInterval(() => {
      if (!cursorRef.current || !buttonRef.current || isClicked) return;
      
      const cursorRect = cursorRef.current.getBoundingClientRect();
      const buttonRect = buttonRef.current.getBoundingClientRect();
      
      const cx = cursorRect.left;
      const cy = cursorRect.top;
      
      const inside = (
        cx >= buttonRect.left &&
        cx <= buttonRect.right &&
        cy >= buttonRect.top &&
        cy <= buttonRect.bottom
      );

      if (inside && !isOverButton) {
        setIsOverButton(true);
      }
      
      const targetX = buttonRect.left + buttonRect.width / 2 + targetOffsetX;
      const targetY = buttonRect.top + buttonRect.height / 2 + targetOffsetY;
      
      const dx = cx - targetX;
      const dy = cy - targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 15 && !isClicked) {
        setIsClicked(true);
        onHover(true);
        setTimeout(() => onHover(false), 300);
      }
    }, 10);
    
    return () => clearInterval(checkCollision);
  }, [buttonRef, isOverButton, isClicked, onHover, targetOffsetX, targetOffsetY]);

  return (
    <motion.div
      ref={cursorRef}
      initial={{ left: `${startX}%`, top: `${startY}%` }}
      animate={{ 
        left: `calc(50% + ${targetOffsetX}px)`, 
        top: `calc(50% + ${targetOffsetY}px)`, 
        scale: isClicked ? 0.616 : 0.8,
        opacity: isClicked ? 0 : 1
      }}
      transition={{ duration: 1.2, ease: "linear" }}
      className="absolute z-20 pointer-events-none"
    >
      <div className="relative w-[54px] h-[54px]">
        {!isOverButton ? (
          <svg width="54" height="54" viewBox="0 -1 32 26" fill="none" className="absolute top-0 left-0">
            <path
              d="M1 3h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v2H9v1h1v2h1v2h-1v1H8v-1H7v-2H6v-2H5v1H4v1H3v1H1v-17z"
              fill="#ffffff"
              stroke="#000"
              strokeWidth="1.2"
            />
          </svg>
        ) : (
          <div className="absolute top-0 left-0">
            <svg width="54" height="54" viewBox="0 0 32 24" fill="none">
              <path
                d="M19 1h2v1h1v4h2v1h3v1h2v1h1v1h1v7h-1v3h-1v3H19v-3h-1v-2h-1v-2h-1v-2h-1v-1h-1v-3h3v1h1V2h1"
                fill="#ffffff"
                stroke="#000"
                strokeWidth="1.2"
              />
              <path d="M22 6v6" stroke="#000" strokeWidth="1.2" />
              <path d="M25 7v5" stroke="#000" strokeWidth="1.2" />
              <path d="M28 8v4" stroke="#000" strokeWidth="1.2" />
            </svg>
            {isClicked && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, y: 10 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute -top-12 left-0 pointer-events-none"
              >
                <svg width="54" height="54" viewBox="0 0 32 24" className="overflow-visible">
                  <path d="M12 -8 L6 -18" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
                  <path d="M21 -12 L21 -24" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
                  <path d="M30 -8 L36 -18" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default LeadReactivationAnimation;
