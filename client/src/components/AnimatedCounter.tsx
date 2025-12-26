import { useState, useEffect } from "react";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  format?: (value: number) => string;
  suffix?: string;
}

export default function AnimatedCounter({ 
  end, 
  duration = 2, 
  format = (v) => Math.round(v).toString(),
  suffix = ""
}: AnimatedCounterProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => format(latest) + suffix);
  const [displayValue, setDisplayValue] = useState("0" + suffix);

  useEffect(() => {
    const controls = animate(count, end, { duration });
    return controls.stop;
  }, [end, duration, count]);

  useEffect(() => {
    return rounded.onChange((v) => setDisplayValue(v));
  }, [rounded]);

  return <motion.span data-testid="text-animated-counter">{displayValue}</motion.span>;
}
