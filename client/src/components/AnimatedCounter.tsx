import { useState, useEffect, useRef } from "react";
import { motion, animate, useMotionValue, useInView, AnimatePresence } from "framer-motion";

interface AnimatedCounterProps {
  start?: number;
  end: number;
  duration?: number;
  format?: (value: number) => string;
  suffix?: string;
  suffixAtEnd?: boolean;
}

export default function AnimatedCounter({ 
  start = 0,
  end, 
  duration = 2, 
  format = (v) => Math.round(v).toString(),
  suffix = "",
  suffixAtEnd = false
}: AnimatedCounterProps) {
  const count = useMotionValue(start);
  const [displayValue, setDisplayValue] = useState(format(start) + (suffix && !suffixAtEnd ? suffix : ""));
  const [showSuffix, setShowSuffix] = useState(suffix && !suffixAtEnd);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    const controls = animate(count, end, { 
      duration,
      onComplete: () => {
        setShowSuffix(true);
      }
    });
    return controls.stop;
  }, [isInView, end, duration, count, suffixAtEnd]);

  useEffect(() => {
    return count.on("change", (latest) => {
      const isComplete = latest >= end;
      setDisplayValue(format(latest) + (isComplete || showSuffix ? suffix : ""));
    });
  }, [count, format, suffix, showSuffix, end]);

  return (
    <motion.div className="flex flex-col items-center relative">
      <AnimatePresence>
        {end === 0 && displayValue === format(0) + (suffixAtEnd ? suffix : "") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: -15 }}
            className="absolute z-20 pointer-events-none whitespace-nowrap flex flex-col items-center"
            style={{ top: '20%' }}
            data-testid="text-nothing-overlay"
          >
            <span className="text-yellow-500 font-black text-4xl md:text-6xl tracking-tighter uppercase leading-none">Absolutely</span>
            <span className="text-yellow-500 font-black text-4xl md:text-6xl tracking-tighter uppercase leading-none">Nothing</span>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.span 
        ref={ref} 
        data-testid="text-animated-counter"
        animate={{ 
          color: end === 0 && displayValue === format(0) + (suffixAtEnd ? suffix : "") ? "#94a3b8" : "inherit"
        }}
        transition={{ duration: 0.3 }}
      >
        {displayValue}
      </motion.span>
    </motion.div>
  );
}
