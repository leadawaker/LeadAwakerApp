import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface FloatingPathsProps {
  position: number;
  color?: string;
}

export function FloatingPaths({
  position,
  color = "currentColor",
}: FloatingPathsProps) {
  const [animating, setAnimating] = useState(true);
  const [pathCount, setPathCount] = useState(36);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setPathCount(mq.matches ? 12 : 36);
    const handler = (e: MediaQueryListEvent) => setPathCount(e.matches ? 12 : 36);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setAnimating(false), 30000);
    return () => clearTimeout(timer);
  }, []);

  // Stable random durations — computed once per mount, not on every render
  const paths = useMemo(
    () =>
      Array.from({ length: pathCount }, (_, i) => ({
        id: i,
        d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
          380 - i * 5 * position
        } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
          152 - i * 5 * position
        } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
          684 - i * 5 * position
        } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
        width: 0.5 + i * 0.03,
        opacity: 0.1 + i * 0.03,
        duration: 20 + Math.random() * 10,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathCount, position]
  );

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="w-full h-full"
        viewBox="0 0 696 316"
        fill="none"
        style={{ color }}
      >
        <title>Background Paths</title>
        <AnimatePresence>
          {animating &&
            paths.map((path) => (
              <motion.path
                key={path.id}
                d={path.d}
                stroke="currentColor"
                strokeWidth={path.width}
                strokeOpacity={path.opacity}
                initial={{ pathLength: 0.3, opacity: path.opacity }}
                animate={{
                  pathLength: 1,
                  opacity: [path.opacity * 0.5, path.opacity, path.opacity * 0.5],
                  pathOffset: [0, 1, 0],
                }}
                exit={{ opacity: 0, transition: { duration: 1.5 } }}
                transition={{
                  duration: path.duration,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
              />
            ))}
        </AnimatePresence>
      </svg>
    </div>
  );
}
