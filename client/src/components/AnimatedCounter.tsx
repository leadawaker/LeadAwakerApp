import { useState, useEffect, useRef } from "react";
import { motion, animate, useMotionValue, useInView, AnimatePresence } from "framer-motion";

interface AnimatedCounterProps {
  start?: number;
  end: number;
  duration?: number;
  format?: (value: number) => string;
  suffix?: string;
  suffixAtEnd?: boolean;
  onFinishedChange?: (finished: boolean) => void;
}

export default function AnimatedCounter({ 
  start = 0,
  end, 
  duration = 2, 
  format = (v) => Math.round(v).toString(),
  suffix = "",
  suffixAtEnd = false,
  onFinishedChange
}: AnimatedCounterProps) {
  const count = useMotionValue(start);
  const [displayValue, setDisplayValue] = useState(format(start) + (suffix && !suffixAtEnd ? suffix : ""));
  const [showSuffix, setShowSuffix] = useState(suffix && !suffixAtEnd);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    onFinishedChange?.(isFinished);
  }, [isFinished, onFinishedChange]);

  useEffect(() => {
    if (!isInView) return;

    const controls = animate(count, end, { 
      duration,
      onComplete: () => {
        setShowSuffix(true);
        if (end === 0) {
          setTimeout(() => setIsFinished(true), 1000);
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
      <motion.span
        ref={ref}
        data-testid="text-animated-counter"
        animate={{ 
          opacity: isFinished ? 0 : 1,
          scale: isFinished ? 0.8 : 1
        }}
        transition={{ duration: 0.3 }}
        className="text-inherit">
        {displayValue}
      </motion.span>
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-[63px]"
            data-testid="text-zero-overlay"
          >
            <div className="flex flex-col items-center leading-none mt-16">
              <span className="uppercase tracking-tighter text-white text-[63px] font-bold">Absolute</span>
              <span className="font-black uppercase tracking-tighter text-white text-[80px]">
                ZERO
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
