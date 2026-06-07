import { useState, useEffect, useRef } from "react";
import { motion, animate, useMotionValue, useInView, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

// ─── AnimatedCounter ───────────────────────────────────────────────────────────

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
  onFinishedChange,
}: AnimatedCounterProps) {
  const { t } = useTranslation("home");
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
        if (end === 0) setIsFinished(true);
      },
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
        animate={{ opacity: isFinished ? 0 : 1, scale: isFinished ? 0.8 : 1 }}
        transition={{ duration: 0.3 }}
        className="text-inherit"
      >
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
            <div className="flex flex-col items-center leading-none mt-8 md:mt-16">
              <span className="uppercase tracking-tighter text-white text-[40px] md:text-[63px] font-bold">
                {t("results.absoluteZero.absolute")}
              </span>
              <span className="font-black uppercase tracking-tighter text-white text-[52px] md:text-[82px] mt-1 md:mt-0">
                {t("results.absoluteZero.zero")}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── AnimatedRangeCounter ──────────────────────────────────────────────────────

interface AnimatedRangeCounterProps {
  start: number;
  end: number;
  finalStart?: number;
  finalEnd?: number;
  duration?: number;
  format?: (value: number) => string;
  suffix?: string;
}

export function AnimatedRangeCounter({
  start,
  end,
  finalStart,
  finalEnd,
  duration = 2,
  format = (v) => Math.round(v).toString(),
  suffix = "",
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
    return () => { controlsStart.stop(); controlsEnd.stop(); };
  }, [isInView, start, end, finalStart, finalEnd, duration, countStart, countEnd]);

  useEffect(() => {
    const updateDisplay = () => {
      setDisplayValue(`${format(countStart.get())}-${format(countEnd.get())}${suffix}`);
    };
    const unsubscribeStart = countStart.onChange(updateDisplay);
    const unsubscribeEnd = countEnd.onChange(updateDisplay);
    return () => { unsubscribeStart(); unsubscribeEnd(); };
  }, [countStart, countEnd, format, suffix]);

  return (
    <motion.span
      ref={ref}
      data-testid="text-animated-range-counter"
      className="text-[48px] font-semibold"
    >
      {displayValue}
    </motion.span>
  );
}
