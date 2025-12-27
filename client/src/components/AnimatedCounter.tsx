import { useState, useEffect, useRef } from "react";
import { motion, animate, useMotionValue, useInView, AnimatePresence } from "framer-motion";

interface AnimatedCounterProps {
  start?: number;
  end: number;
  duration?: number;
  format?: (value: number) => string;
  suffix?: string;
  suffixAtEnd?: boolean;
  onFinalComplete?: () => void;
}

export default function AnimatedCounter({ 
  start = 0,
  end, 
  duration = 2, 
  format = (v) => Math.round(v).toString(),
  suffix = "",
  suffixAtEnd = false,
  onFinalComplete
}: AnimatedCounterProps) {
  const count = useMotionValue(start);
  const [displayValue, setDisplayValue] = useState(format(start) + (suffix && !suffixAtEnd ? suffix : ""));
  const [showSuffix, setShowSuffix] = useState(suffix && !suffixAtEnd);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const [isZero, setIsZero] = useState(false);

  useEffect(() => {
    if (!isInView) return;

    const controls = animate(count, end, { 
      duration,
      onComplete: () => {
        setShowSuffix(true);
        if (end === 0) {
          setTimeout(() => {
            setIsZero(true);
            onFinalComplete?.();
          }, 1000);
        }
      }
    });
    return controls.stop;
  }, [isInView, end, duration, count, suffixAtEnd]);

  useEffect(() => {
    return count.on("change", (latest) => {
      const isComplete = latest <= end;
      setDisplayValue(format(latest) + (isComplete || showSuffix ? suffix : ""));
    });
  }, [count, format, suffix, showSuffix, end]);

  return (
    <motion.div className="flex flex-col items-center relative">
      <AnimatePresence mode="wait">
        {isZero ? (
          <motion.span
            key="zero-text"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              color: "#94a3b8" 
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="font-black"
          >
            Absolute ZERO
          </motion.span>
        ) : (
          <motion.span
            key="counter-value"
            ref={ref}
            data-testid="text-animated-counter"
            exit={{ opacity: 0 }}
            className="inherit"
          >
            {displayValue}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
