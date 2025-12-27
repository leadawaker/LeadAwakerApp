import { useState, useEffect } from "react";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";

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
  const [displayValue, setDisplayValue] = useState(format(start) + (!suffixAtEnd ? suffix : ""));
  const [showSuffix, setShowSuffix] = useState(!suffixAtEnd);

  useEffect(() => {
    const controls = animate(count, end, { 
      duration,
      onComplete: () => {
        if (suffixAtEnd) setShowSuffix(true);
      }
    });
    return controls.stop;
  }, [end, duration, count, suffixAtEnd]);

  useEffect(() => {
    return count.onChange((latest) => {
      setDisplayValue(format(latest) + (showSuffix ? suffix : ""));
    });
  }, [count, format, suffix, showSuffix]);

  return <motion.span data-testid="text-animated-counter">{displayValue}</motion.span>;
}
