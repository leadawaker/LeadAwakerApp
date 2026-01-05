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
            const [hasStarted, setHasStarted] = useState(false);
            const [showSparkles, setShowSparkles] = useState(false);
            const [isButtonHovered, setIsButtonHovered] = useState(false); // NEW: Track button hover
            const containerRef = React.useRef<HTMLDivElement>(null);

            useEffect(() => {
              if (brightness > 80) {
                setForceWhite(true);
              }
            }, [brightness]);

            useEffect(() => {
              if (activeClickCount > 0 && !hasReachedEnd) {
                setClickScale(prev => Math.min(prev + 0.75 / 30, 0.75));
              }
            }, [activeClickCount, hasReachedEnd]);

            useEffect(() => {
              if (!(brightness >= 100 || hasReachedEnd)) return;

              const triggerEffect = () => {
                setShowSparkles(true);
                setTimeout(() => setShowSparkles(false), 1500); 
              };

              const interval = setInterval(triggerEffect, 7000);
              triggerEffect();

              return () => clearInterval(interval);
            }, [brightness, hasReachedEnd]);

            useEffect(() => {
              const observer = new IntersectionObserver(
                ([entry]) => {
                  if (entry.isIntersecting) {
                    setHasStarted(true);
                    observer.disconnect();
                  }
                },
                { threshold: 0.2 }
              );

              if (containerRef.current) {
                observer.observe(containerRef.current);
              }

              return () => observer.disconnect();
            }, []);

            useEffect(() => {
              if (!hasStarted) return;

              // UPDATED: Arrows spawn from well outside the container edges
              const cursorSequence: CursorData[] = [
                { delay: 500, startX: -15, startY: -15 },     // Top-left far
                { delay: 2000, startX: 115, startY: -10 },    // Top-right far
                { delay: 3500, startX: -10, startY: 110 },    // Bottom-left far
                { delay: 5000, startX: 50, startY: -20 },     // Top far
                { delay: 5300, startX: 120, startY: 30 },     // Right far
                { delay: 5600, startX: -20, startY: 50 },     // Left far
                { delay: 5900, startX: 115, startY: 70 },     // Right far
                { delay: 6200, startX: 30, startY: 120 },     // Bottom far
                { delay: 6400, startX: 120, startY: 10 },     // Right far
                { delay: 6600, startX: -15, startY: 40 },     // Left far
                { delay: 6800, startX: 115, startY: 50 },     // Right far
                { delay: 7000, startX: -10, startY: 80 },     // Left far
                { delay: 7100, startX: 120, startY: 90 },     // Right far
                { delay: 7200, startX: -20, startY: 20 },     // Left far
                { delay: 7300, startX: 110, startY: 115 },    // Right far
                { delay: 7400, startX: -15, startY: 60 },     // Left far
                { delay: 7500, startX: 115, startY: -5 },     // Right far
                { delay: 7600, startX: 50, startY: 120 },     // Bottom far
                { delay: 7700, startX: -10, startY: 10 },     // Left far
                { delay: 7800, startX: 110, startY: 35 },     // Right far
                { delay: 7900, startX: -20, startY: -10 },    // Left far
                { delay: 8000, startX: 120, startY: 80 },     // Right far
                { delay: 8100, startX: -15, startY: 110 },    // Left far
                { delay: 8200, startX: 115, startY: 15 },     // Right far
                { delay: 8300, startX: 40, startY: -20 },     // Top far
                { delay: 8400, startX: 110, startY: 45 },     // Right far
                { delay: 8500, startX: -20, startY: 30 },     // Left far
                { delay: 8600, startX: 120, startY: 85 },     // Right far
                { delay: 8700, startX: -10, startY: 70 },     // Left far
                { delay: 8800, startX: 115, startY: 60 },     // Right far
                { delay: 8900, startX: 50, startY: 115 },    // Bottom far
                { delay: 9000, startX: 110, startY: 25 },     // Right far
                { delay: 9100, startX: -15, startY: 95 }      // Left far
              ];

              cursorSequence.forEach((cursor, index) => {
                setTimeout(() => {
                  const cursorId = Date.now() + index;
                  setCursors(prev => [...prev, { ...cursor, id: cursorId }]);

                  setTimeout(() => {
                    setCursors(prev => prev.filter(c => c.id !== cursorId));
                    setBrightness(prev => Math.min(prev + 100 / 30, 100));

                    if (index === cursorSequence.length - 1) {
                      setHasReachedEnd(true);
                      setTimeout(() => setAnimationComplete(true), 1500);
                    }
                  }, 1800);
                }, cursor.delay);
              });
            }, [hasStarted]);

            const interpolateColor = (
              c1: { r: number; g: number; b: number },
              c2: { r: number; g: number; b: number },
              factor: number
            ) => ({
              r: Math.round(c1.r + (c2.r - c1.r) * factor),
              g: Math.round(c1.g + (c2.g - c1.g) * factor),
              b: Math.round(c1.b + (c2.b - c1.b) * factor)
            });

            const startC1 = { r: 241, g: 245, b: 249 };
            const startC2 = { r: 255, g: 255, b: 255 };
            const activeC1 = { r: 252, g: 211, b: 77 };
            const activeC2 = { r: 251, g: 146, b: 60 };

            const factor = Math.min(brightness / 100, 1);
            const currentC1 = interpolateColor(startC1, activeC1, factor);
            const currentC2 = interpolateColor(startC2, activeC2, factor);

            // NEW: Apply 15% brightness boost and 10% scale when hovering final state
            const hoverBrightnessBoost = isButtonHovered && (brightness >= 100 || hasReachedEnd) ? 1.15 : 1;
            const hoverScaleBoost = isButtonHovered && (brightness >= 100 || hasReachedEnd) ? 1.1 : 1;

            const [isClicking, setIsClicking] = useState(false);

            useEffect(() => {
              if (activeClickCount > 0) {
                setIsClicking(true);
                const timer = setTimeout(() => setIsClicking(false), 150);
                return () => clearTimeout(timer);
              }
            }, [activeClickCount]);

            const isWordHighlight = isClicking || brightness >= 100 || hasReachedEnd || forceWhite;

            return (
              <div
                ref={containerRef}
                className="relative w-full h-[32vh] flex items-center justify-center overflow-hidden font-sans mb-12"
              >
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
                  {cursors.map(cursor => (
                    <Cursor
                      key={cursor.id}
                      startX={cursor.startX}
                      startY={cursor.startY}
                      onHover={isClicking => {
                        setActiveClickCount(prev =>
                          isClicking ? prev + 1 : Math.max(0, prev - 1)
                        );
                      }}
                    />
                  ))}
                </AnimatePresence>

                <motion.button
                  id="lead-button"
                  initial={{ scale: 0.45, opacity: 0 }}
                  animate={{
                    scale: (brightness >= 100 || hasReachedEnd ? 1.0 : 0.25 + clickScale) * hoverScaleBoost,
                    opacity: 1
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: activeClickCount > 0 || hasReachedEnd ? 1200 : 400,
                    damping: activeClickCount > 0 || hasReachedEnd ? 20 : 25,
                    mass: 0.5
                  }}
                  whileHover={
                    brightness >= 100 || hasReachedEnd
                      ? {
                          scale: 1.05 * hoverScaleBoost,
                          rotate: [0, -1, 1, -1, 0],
                          transition: {
                            duration: 0.3,
                            repeat: Infinity,
                            repeatType: 'reverse'
                          }
                        }
                      : {}
                  }
                  onHoverStart={() => setIsButtonHovered(true)}
                  onHoverEnd={() => setIsButtonHovered(false)}
                  className="relative px-12 py-6 text-2xl font-bold rounded-2xl transition-all duration-200 z-10 select-none overflow-hidden group border border-black/10"
                  style={{
                    // NEW: Apply brightness boost to colors
                    background: `linear-gradient(135deg, 
                      rgb(${Math.min(255, Math.round(currentC1.r * hoverBrightnessBoost))}, 
                          ${Math.min(255, Math.round(currentC1.g * hoverBrightnessBoost))}, 
                          ${Math.min(255, Math.round(currentC1.b * hoverBrightnessBoost))}),
                      rgb(${Math.min(255, Math.round(currentC2.r * hoverBrightnessBoost))}, 
                          ${Math.min(255, Math.round(currentC2.g * hoverBrightnessBoost))}, 
                          ${Math.min(255, Math.round(currentC2.b * hoverBrightnessBoost))}))`,
                    boxShadow:
                      brightness >= 100 || hasReachedEnd
                        ? `0 20px 40px -12px rgba(251, 191, 36, ${0.5 * hoverBrightnessBoost}), 
                           0 12px 20px -8px rgba(251, 146, 60, ${0.3 * hoverBrightnessBoost}), 
                           inset 0 1px 1px rgba(255,255,255,0.4)`
                        : `0 8px 24px -6px rgba(0,0,0,0.2), 0 ${
                            brightness * 0.15
                          }px ${brightness * 0.5}px rgba(251, 191, 36, ${
                            brightness * 0.004 + 0.1
                          }), inset 0 1px 1px rgba(255,255,255,0.2)`,
                    color: isWordHighlight ? '#ffffff' : '#1e293b'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50 pointer-events-none" />

                  <motion.div
                    initial={{ left: '-100%' }}
                    animate={showSparkles ? { left: '200%' } : { left: '-100%' }}
                    transition={{
                      left: {
                        duration: showSparkles ? 1.5 : 0,
                        ease: 'easeInOut'
                      }
                    }}
                    className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 pointer-events-none z-20"
                  />

                  <span className="relative z-10 tracking-tight text-[1.44em]">
                    Your Brand
                  </span>
                </motion.button>

                {(brightness >= 100 || hasReachedEnd) && showSparkles && (
                  <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
                    <div className="relative w-[400px] h-[150px]">
                      {[
                        { x: 0, y: 20, d: 0 },
                        { x: 15, y: 80, d: 0.1 },
                        { x: 45, y: 40, d: 0.2 },
                        { x: 75, y: 60, d: 0.3 },
                        { x: 100, y: 30, d: 0.4 },
                        { x: 25, y: 10, d: 0.5 },
                        { x: 85, y: 90, d: 0.6 }
                      ].map((config, i) => (
                        <svg
                          key={i}
                          viewBox="0 0 24 24"
                          className="absolute w-6 h-6 fill-white opacity-0 animate-sparkle"
                          style={{
                            left: `${config.x}%`,
                            top: `${config.y}%`,
                            '--s': 1,
                            animationDelay: `${config.d}s`
                          }}
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

          // Cursor component remains unchanged
          const Cursor = ({
            startX,
            startY,
            onHover
          }: {
            startX: number;
            startY: number;
            onHover?: (isClicking: boolean) => void;
          }) => {
            const [phase, setPhase] = useState<
              'idle' | 'moving' | 'hovering' | 'clicking' | 'disappearing'
            >('idle');
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
              const isSlow = Math.random() < 5 / 30;
              const baseDuration = 0.5 + Math.random() * 0.6;
              const jitterMultiplier = isFirstFew ? 1.2 : 0.8;
              return {
                jitterX:
                  (isFirstFew ? (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 5) *
                  jitterMultiplier,
                jitterY:
                  (isFirstFew ? (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 5) *
                  jitterMultiplier,
                duration: isSlow ? baseDuration * 1.56 : baseDuration * 1.2,
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
                if (!buttonElement) return;

                const buttonRect = buttonElement.getBoundingClientRect();
                const cursorElement = document.getElementById(
                  `cursor-${startX}-${startY}`
                );

                if (buttonRect && cursorElement) {
                  const style = window.getComputedStyle(buttonElement);
                  const matrix = new DOMMatrixReadOnly(style.transform);
                  setButtonScale(matrix.a);

                  const cursorRect = cursorElement.getBoundingClientRect();
                  const isOverlapping = !(
                    cursorRect.right < buttonRect.left - 4 ||
                    cursorRect.left > buttonRect.right + 4 ||
                    cursorRect.bottom < buttonRect.top - 4 ||
                    cursorRect.top > buttonRect.bottom + 4
                  );

                  if (isOverlapping) {
                    setPhase(prev =>
                      prev === 'moving' || prev === 'idle' ? 'hovering' : prev
                    );
                  } else {
                    setPhase(prev => (prev === 'hovering' ? 'moving' : prev));
                  }
                }
              }, 16);

              const clickTimer = setTimeout(
                () => setPhase('clicking'),
                randomConfig.duration * 1000 + 100
              );
              const disappearingTimer = setTimeout(
                () => setPhase('disappearing'),
                randomConfig.duration * 1000 + 500
              );

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
            const isHand =
              phase === 'hovering' || phase === 'clicking' || phase === 'disappearing';
            const isClicking = phase === 'clicking';
            const isDisappearing = phase === 'disappearing';

            const getKeyframes = () => {
              if (isDisappearing) return { x: 0, y: 0 };
              if (isClicking) return { x: 0, y: 0, scale: 0.77 };

              const halfwayX = randomConfig.halfwayOffset.x;
              const halfwayY = randomConfig.halfwayOffset.y;

              switch (randomConfig.pathType) {
                case 1:
                  return {
                    x: [0, halfwayX, randomConfig.jitterX, 0],
                    y: [0, halfwayY, randomConfig.jitterY, 0]
                  };
                case 2:
                  return {
                    x: [0, halfwayX, -randomConfig.jitterX * 0.8, randomConfig.jitterX, 0],
                    y: [0, -halfwayY * 0.5, randomConfig.jitterY, -randomConfig.jitterY * 0.3, 0]
                  };
                case 3:
                  return {
                    x: [0, halfwayX * 1.5, -randomConfig.jitterX, randomConfig.jitterX * 0.5, 0],
                    y: [0, -halfwayY, randomConfig.jitterY * 1.2, 0]
                  };
                default:
                  return {
                    x: [0, halfwayX * 0.2, randomConfig.jitterX, 0],
                    y: [0, halfwayY * 0.2, randomConfig.jitterY, 0]
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
                  transition:
                    phase === 'moving' ||
                    phase === 'hovering' ||
                    phase === 'clicking' ||
                    phase === 'disappearing'
                      ? `left ${randomConfig.duration}s cubic-bezier(0.34, 1.56, 0.64, 1), top ${randomConfig.duration}s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out`
                      : 'none'
                }}
                animate={{
                  ...getKeyframes(),
                  x: (getKeyframes() as any).x * buttonScale,
                  y: (getKeyframes() as any).y * buttonScale
                }}
                transition={{
                  duration: isClicking ? 0.05 : 0.1 + Math.random() * 0.2,
                  ease: isClicking ? 'easeOut' : 'linear',
                  repeat: isClicking ? 0 : 2,
                  repeatType: 'reverse'
                }}
              >
                {isPointer && (
                  <svg
                    width="45"
                    height="45"
                    viewBox="0 -1 32 26"
                    fill="none"
                    className="drop-shadow-xl"
                  >
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
                    width="45"
                    height="45"
                    viewBox="0 0 32 24"
                    fill="none"
                    className="drop-shadow-xl overflow-visible"
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
                          transition={{ duration: 0.15, ease: 'easeOut' }}
                          style={{
                            zIndex: 100,
                            position: 'relative'
                          }}
                        >
                          <path
                            d="M12 -8 L6 -18"
                            stroke="#fbbf24"
                            strokeWidth="4.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                          <path
                            d="M21 -12 L21 -24"
                            stroke="#fbbf24"
                            strokeWidth="4.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                          <path
                            d="M30 -8 L36 -18"
                            stroke="#fbbf24"
                            strokeWidth="4.5"
                            strokeLinecap="round"
                            fill="none"
                          />
                        </motion.g>
                      )}
                    </AnimatePresence>
                  </svg>
                )}
              </motion.div>
            );
          };

          export default LeadReactivationAnimation;