import { useState, useEffect, useRef } from "react";
import { motion, animate, useMotionValue, useInView } from "framer-motion";

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
    return count.onChange((latest) => {
      setDisplayValue(format(latest) + (showSuffix ? suffix : ""));
    });
  }, [count, format, suffix, showSuffix]);

  return <motion.span ref={ref} data-testid="text-animated-counter">{displayValue}</motion.span>;
}
