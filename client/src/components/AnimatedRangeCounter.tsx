import { useState, useEffect } from "react";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";

interface AnimatedRangeCounterProps {
  start: number;
  end: number;
  duration?: number;
  format?: (value: number) => string;
  suffix?: string;
}

export default function AnimatedRangeCounter({ 
  start, 
  end, 
  duration = 2, 
  format = (v) => Math.round(v).toString(),
  suffix = ""
}: AnimatedRangeCounterProps) {
  const countStart = useMotionValue(0);
  const countEnd = useMotionValue(0);
  
  const [displayValue, setDisplayValue] = useState(`${start}-${end}${suffix}`);

  useEffect(() => {
    const controlsStart = animate(countStart, start, { duration });
    const controlsEnd = animate(countEnd, end, { duration });
    
    return () => {
      controlsStart.stop();
      controlsEnd.stop();
    };
  }, [start, end, duration, countStart, countEnd]);

  useEffect(() => {
    const updateDisplay = () => {
      setDisplayValue(`${format(countStart.get())}-${format(countEnd.get())}${suffix}`);
    };
    
    const unsubscribeStart = countStart.onChange(updateDisplay);
    const unsubscribeEnd = countEnd.onChange(updateDisplay);
    
    return () => {
      unsubscribeStart();
      unsubscribeEnd();
    };
  }, [countStart, countEnd, format, suffix]);

  return <motion.span data-testid="text-animated-range-counter">{displayValue}</motion.span>;
}
