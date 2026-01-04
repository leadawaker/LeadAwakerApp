import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LeadReactivationAnimation = () => {
  return null;
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
