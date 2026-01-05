'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CursorData {
  delay: number;
  startX: number;
  startY: number;
  id?: number;
}

const LeadReactivationAnimation = () => {
  const [brightness, setBrightness] = useState(0);
  const [cursors, setCursors] = useState<CursorData[]>([]);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [activeClickCount, setActiveClickCount] = useState(0);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [forceWhite, setForceWhite] = useState(false);
  const [clickScale, setClickScale] = useState(0);

  useEffect(() => {
    if (brightness > 80) {
      setForceWhite(true);
    }
  }, [brightness]);

  useEffect(() => {
    if (activeClickCount > 0) {
      setClickScale(prev => Math.min(prev + (0.75 / 30), 0.75)); 
    }
  }, [activeClickCount]);

  const isWordHighlight = activeClickCount > 0 || animationComplete || hasReachedEnd || forceWhite;

  const startColor1 = { r: 59, g: 130, b: 246 };
  const startColor2 = { r: 13, g: 148, b: 136 };
  const endColor1 = { r: 251, g: 191, b: 36 };
  const endColor2 = { r: 251, g: 146, b: 60 };

  const currentC1 = {
    r: startColor1.r + (endColor1.r - startColor1.r) * (brightness / 100),
    g: startColor1.g + (endColor1.g - startColor1.g) * (brightness / 100),
    b: startColor1.b + (endColor1.b - startColor1.b) * (brightness / 100)
  };

  const currentC2 = {
    r: startColor2.r + (endColor2.r - startColor2.r) * (brightness / 100),
    g: startColor2.g + (endColor2.g - startColor2.g) * (brightness / 100),
    b: startColor2.b + (endColor2.b - startColor2.b) * (brightness / 100)
  };

  const arrowX = 5.5;
  const arrowY = 3.21;
  const handX = 16.15;
  const handY = 0.15;

  useEffect(() => {
    const cursorSequence: CursorData[] = [
      { delay: 500, startX: 20, startY: 20 },
      { delay: 2000, startX: 80, startY: 30 },
      { delay: 3500, startX: 15, startY: 70 },
      { delay: 5000, startX: 40, startY: 10 },
      { delay: 5300, startX: 60, startY: 15 },
      { delay: 5600, startX: 25, startY: 50 },
      { delay: 5900, startX: 75, startY: 60 },
      { delay: 6200, startX: 35, startY: 80 },
      { delay: 6400, startX: 55, startY: 25 },
      { delay: 6600, startX: 10, startY: 40 },
      { delay: 6800, startX: 85, startY: 45 },
      { delay: 7000, startX: 30, startY: 65 },
      { delay: 7100, startX: 70, startY: 75 },
      { delay: 7200, startX: 45, startY: 35 },
      { delay: 7300, startX: 65, startY: 85 },
      { delay: 7400, startX: 20, startY: 55 },
      { delay: 7500, startX: 80, startY: 20 },
      { delay: 7600, startX: 50, startY: 90 },
      { delay: 7700, startX: 15, startY: 25 },
      { delay: 7800, startX: 75, startY: 40 },
      { delay: 7900, startX: 35, startY: 15 },
      { delay: 8000, startX: 60, startY: 70 },
      { delay: 8100, startX: 25, startY: 85 },
      { delay: 8200, startX: 85, startY: 30 },
      { delay: 8300, startX: 40, startY: 60 },
      { delay: 8400, startX: 70, startY: 50 },
      { delay: 8500, startX: 30, startY: 35 },
      { delay: 8600, startX: 55, startY: 80 },
      { delay: 8700, startX: 10, startY: 65 },
      { delay: 8800, startX: 90, startY: 55 },
      { delay: 8900, startX: 50, startY: 45 },
      { delay: 9000, startX: 65, startY: 20 },
      { delay: 9100, startX: 22, startY: 75 }
    ];

    cursorSequence.forEach((cursor, index) => {
      setTimeout(() => {
        const cursorId = Date.now() + index;
        setCursors(prev => [...prev, { ...cursor, id: cursorId }]);

        setTimeout(() => {
          setCursors(prev => prev.filter(c => c.id !== cursorId));
          setBrightness(prev => Math.min(prev + (100 / 30), 100));

          if (index === cursorSequence.length - 1) {
            setHasReachedEnd(true);
            setTimeout(() => setAnimationComplete(true), 1500);
          }
        }, 1400);
      }, cursor.delay);
    });
  }, []);

  return (
    <div className="relative w-full h-[60vh] bg-white flex items-center justify-center overflow-hidden font-sans rounded-2xl border border-border shadow-sm mb-12">
      <style>{`
        @keyframes sparkle {
          0%, 100% { transform: scale(0); opacity: 0; }
          50% { transform: scale(var(--s, 1)); opacity: 1; }
        }
        .animate-sparkle {
          animation: sparkle 0.75s both;
        }
      `}</style>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none mix-blend-multiply"></div>

      <AnimatePresence>
        {cursors.map((cursor) => (
          <Cursor 
            key={cursor.id} 
            startX={cursor.startX} 
            startY={cursor.startY}
            arrowX={arrowX}
            arrowY={arrowY}
            handX={handX}
            handY={handY}
            onHover={(isClicking) => {
              setActiveClickCount(prev => isClicking ? prev + 1 : Math.max(0, prev - 1));
            }}
          />
        ))}
      </AnimatePresence>

      <motion.button
        id="lead-button"
        initial={{ scale: 0.45, opacity: 0 }}
        animate={{ 
          scale: (brightness >= 100 || hasReachedEnd) 
            ? 1.0 
            : 0.25 + clickScale, 
          opacity: 1 
        }}
        transition={{ 
          type: "spring",
          stiffness: (activeClickCount > 0 || hasReachedEnd) ? 1200 : 400,
          damping: (activeClickCount > 0 || hasReachedEnd) ? 20 : 25,
          mass: 0.5
        }}
        whileHover={(brightness >= 100 || hasReachedEnd) ? { 
          scale: 1.05,
          rotate: [0, -1, 1, -1, 0],
          transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" }
        } : {}}
        className="relative px-12 py-6 text-2xl font-bold rounded-2xl transition-all duration-200 z-10 select-none overflow-hidden group border border-black/10"
        style={{
          background: `linear-gradient(135deg, rgb(${currentC1.r}, ${currentC1.g}, ${currentC1.b}), rgb(${currentC2.r}, ${currentC2.g}, ${currentC2.b}))`,
          boxShadow: (brightness >= 100 || hasReachedEnd)
            ? `0 15px 35px -12px rgba(251, 191, 36, 0.4), 0 8px 15px -6px rgba(251, 146, 60, 0.2), inset 0 1px 1px rgba(255,255,255,0.4)`
            : `0 4px 12px -4px rgba(0,0,0,0.1), 0 ${brightness * 0.1}px ${brightness * 0.4}px rgba(251, 191, 36, ${brightness * 0.003 + 0.05}), inset 0 1px 1px rgba(255,255,255,0.2)`,
          color: isWordHighlight ? '#ffffff' : '#1e293b',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50 pointer-events-none" />

        <motion.div
          animate={{
            left: ['-100%', '200%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatDelay: 8.5,
            ease: "easeInOut"
          }}
          className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 pointer-events-none z-20"
        />

        <span className="relative z-10 tracking-tight text-[1.44em]">Your Brand</span>
      </motion.button>

      {(brightness >= 100 || hasReachedEnd) && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          <motion.div 
            className="relative w-[400px] h-[150px]"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            style={{ 
              opacity: animationComplete ? 0 : 1,
              transition: 'opacity 0.5s ease-in-out'
            }}
          >
            {[
              { x: 0, y: 20, d: 0 },
              { x: 15, y: 80, d: 0.2 },
              { x: 45, y: 40, d: 0.4 },
              { x: 75, y: 60, d: 0.6 },
              { x: 100, y: 30, d: 0.8 },
              { x: 25, y: 10, d: 1.0 },
              { x: 85, y: 90, d: 1.2 },
            ].map((config, i) => (
              <svg
                key={i}
                viewBox="0 0 24 24"
                className="absolute w-6 h-6 fill-white opacity-0 animate-sparkle"
                style={{
                  left: `${config.x}%`,
                  top: `${config.y}%`,
                  '--s': 1,
                  animationDelay: `${config.d}s`,
                } as any}
              >
                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
              </svg>
            ))}
          </motion.div>
          {animationComplete && (
            <motion.div 
              className="absolute pointer-events-none"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              style={{ width: '400px', height: '150px' }}
            >
              {[
                { x: 10, y: 30, d: 0, s: 0.8 },
                { x: 80, y: 20, d: 1, s: 1.1 },
                { x: 30, y: 70, d: 2, s: 0.9 },
                { x: 60, y: 80, d: 3, s: 1.2 },
                { x: 90, y: 60, d: 4, s: 0.7 },
                { x: 20, y: 10, d: 5, s: 1.0 },
                { x: 70, y: 40, d: 6, s: 0.8 },
              ].map((config, i) => (
                <svg
                  key={`hover-${i}`}
                  viewBox="0 0 24 24"
                  className="absolute w-5 h-5 fill-white opacity-0 animate-sparkle"
                  style={{
                    left: `${config.x}%`,
                    top: `${config.y}%`,
                    '--s': config.s,
                    animationDelay: `${config.d}s`,
                    animationDuration: '4s',
                    animationIterationCount: 'infinite'
                  } as any}
                >
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

const Cursor = ({ startX, startY, onHover }: { startX: number, startY: number, arrowX: number, arrowY: number, handX: number, handY: number, onHover?: (isClicking: boolean) => void }) => {
  const [phase, setPhase] = useState<'idle' | 'moving' | 'hovering' | 'clicking' | 'disappearing'>('idle');
  const [buttonScale, setButtonScale] = useState(1);
  const [offsets] = useState(() => ({
    x: (Math.random() - 0.5) * 6,
    y: (Math.random() - 0.5) * 3
  }));

  const buttonCenterX = 50 + offsets.x;
  const buttonCenterY = 50 + offsets.y - (buttonScale < 0.5 ? 2.5 : 0);
  const [currentPos, setCurrentPos] = useState({ x: startX, y: startY });
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
    const idleTimer = setTimeout(() => {
      setPhase('moving');
      setCurrentPos({ x: buttonCenterX, y: buttonCenterY });
    }, 50 + randomConfig.delay * 1000);

    const checkInterval = setInterval(() => {
      const buttonElement = document.getElementById('lead-button');
      const buttonRect = buttonElement?.getBoundingClientRect();
      const cursorElement = document.getElementById(`cursor-${startX}-${startY}`);

      if (buttonRect && cursorElement) {
        const style = window.getComputedStyle(buttonElement!);
        const matrix = new DOMMatrixReadOnly(style.transform);
        setButtonScale(matrix.a);

        const cursorRect = cursorElement.getBoundingClientRect();
        // Adding 4px buffer for more reliable detection
        const isOverlapping = !(
          cursorRect.right < buttonRect.left - 4 ||
          cursorRect.left > buttonRect.right + 4 ||
          cursorRect.bottom < buttonRect.top - 4 ||
          cursorRect.top > buttonRect.bottom + 4
        );

        if (isOverlapping) {
          setPhase(prev => (prev === 'moving' || prev === 'idle') ? 'hovering' : prev);
        } else {
          setPhase(prev => (prev === 'hovering') ? 'moving' : prev);
        }
      }
    }, 16);

    const clickTimer = setTimeout(() => setPhase('clicking'), randomConfig.duration * 1000 + 100);
    const disappearingTimer = setTimeout(() => setPhase('disappearing'), randomConfig.duration * 1000 + 300);

    return () => {
      clearTimeout(idleTimer);
      clearInterval(checkInterval);
      clearTimeout(clickTimer);
      clearTimeout(disappearingTimer);
    };
  }, [buttonCenterX, buttonCenterY, startX, startY, randomConfig]);

    useEffect(() => {
      if (phase === 'clicking') {
        onHover?.(true);
        return () => onHover?.(false);
      }
    }, [phase, onHover]);

  const isPointer = phase === 'idle' || phase === 'moving';
  const isHand = phase === 'hovering' || phase === 'clicking' || phase === 'disappearing';
  const isClicking = phase === 'clicking';
  const isDisappearing = phase === 'disappearing';

  const getKeyframes = () => {
    if (isDisappearing) return { x: 0, y: 0 };
    if (isClicking) return { x: 0, y: 0, scale: 0.77 };

    const halfwayX = randomConfig.halfwayOffset.x;
    const halfwayY = randomConfig.halfwayOffset.y;

    switch(randomConfig.pathType) {
      case 1:
        return {
          x: [0, halfwayX, randomConfig.jitterX, 0],
          y: [0, halfwayY, randomConfig.jitterY, 0],
        };
      case 2:
        return {
          x: [0, halfwayX, -randomConfig.jitterX * 0.8, randomConfig.jitterX, 0],
          y: [0, -halfwayY * 0.5, randomConfig.jitterY, -randomConfig.jitterY * 0.3, 0],
        };
      case 3:
        return {
          x: [0, halfwayX * 1.5, -randomConfig.jitterX, randomConfig.jitterX * 0.5, 0],
          y: [0, -halfwayY, randomConfig.jitterY * 1.2, 0],
        };
      default:
        return {
          x: [0, halfwayX * 0.2, randomConfig.jitterX, 0],
          y: [0, halfwayY * 0.2, randomConfig.jitterY, 0],
        };
    }
  };

  return (
    <motion.div
      id={`cursor-${startX}-${startY}`}
      className="absolute pointer-events-none z-20"
      style={{
        left: `${currentPos.x}%`,
        top: `${currentPos.y}%`,
        transformOrigin: 'center center',
        opacity: isDisappearing ? 0 : 1,
        transition: (phase === 'moving' || phase === 'hovering' || phase === 'clicking' || phase === 'disappearing') 
          ? `left ${randomConfig.duration}s cubic-bezier(0.34, 1.56, 0.64, 1), top ${randomConfig.duration}s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out` 
          : 'none'
      }}
      animate={{ 
        ...getKeyframes(),
        x: (getKeyframes() as any).x * buttonScale,
        y: (getKeyframes() as any).y * buttonScale,
      }}
      transition={{ 
        duration: isClicking ? 0.05 : (0.1 + Math.random() * 0.2),
        ease: isClicking ? "easeOut" : "linear",
        repeat: isClicking ? 0 : 2,
        repeatType: "reverse"
      }}
    >
      {isPointer && (
        <svg width="45" height="45" viewBox="0 -1 32 26" fill="none" className="drop-shadow-xl">
          <path
            d="M1 3h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v2H9v1h1v2h1v2h-1v1H8v-1H7v-2H6v-2H5v1H4v1H3v1H1v-17z"
            fill="white"
            stroke="black"
            strokeWidth="0.5"
            strokeLinejoin="miter"
          />
        </svg>
      )}
      {isHand && (
        <svg 
          width="45" height="45" viewBox="0 0 32 24" fill="none" className="drop-shadow-xl overflow-visible"
          style={{
            marginLeft: `${(1 - 19) * (45 / 32)}px`,
            marginTop: `${(3 - 1) * (45 / 24)}px`,
            position: 'relative',
            zIndex: 10
          }}
        >
          <path
            d="M19 1h2v1h1v4h2v1h3v1h2v1h1v1h1v7h-1v3h-1v3H19v-3h-1v-2h-1v-2h-1v-2h-1v-1h-1v-3h3v1h1V2h1"
            fill="white"
            stroke="black"
            strokeWidth="1"
            strokeLinejoin="miter"
          />
          <path d="M22 6v6" stroke="black" strokeWidth="1" />
          <path d="M25 7v5" stroke="black" strokeWidth="1" />
          <path d="M28 8v4" stroke="black" strokeWidth="1" />

          <AnimatePresence>
            {isClicking && (
              <motion.g
                key="click-strokes"
                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{ 
                  zIndex: 100,
                  position: 'relative'
                }}
              >
                {/* 3 angled stroke lines - YELLOW MATCHING BUTTON GLOW */}
                <path d="M12 -8 L6 -18" stroke="#fbbf24" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M21 -12 L21 -24" stroke="#fbbf24" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M30 -8 L36 -18" stroke="#fbbf24" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      )}
    </motion.div>
  );
};

export default LeadReactivationAnimation;