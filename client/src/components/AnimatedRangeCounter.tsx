import { useState, useEffect, useRef } from "react";
import { motion, animate, useMotionValue, useInView } from "framer-motion";

interface AnimatedRangeCounterProps {
  start: number;
  end: number;
  finalStart?: number;
  finalEnd?: number;
  duration?: number;
  format?: (value: number) => string;
  suffix?: string;
}

export default function AnimatedRangeCounter({ 
  start, 
  end, 
  finalStart,
  finalEnd,
  duration = 2, 
  format = (v) => Math.round(v).toString(),
  suffix = ""
}: AnimatedRangeCounterProps) {
  const countStart = useMotionValue(start);
  const countEnd = useMotionValue(end);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  const [displayValue, setDisplayValue] = useState(`${format(start)}-${format(end)}${suffix}`);

  useEffect(() => {
    if (!isInView) return;

    const targetStart = finalStart !== undefined ? finalStart : start;
    const targetEnd = finalEnd !== undefined ? finalEnd : end;
    
    const controlsStart = animate(countStart, targetStart, { duration });
    const controlsEnd = animate(countEnd, targetEnd, { duration });
    
    return () => {
      controlsStart.stop();
      controlsEnd.stop();
    };
  }, [isInView, start, end, finalStart, finalEnd, duration, countStart, countEnd]);

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

  return <motion.span ref={ref} data-testid="text-animated-range-counter">{displayValue}</motion.span>;
}
