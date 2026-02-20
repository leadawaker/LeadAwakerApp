import { motion } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Wraps page content with a subtle fade + slide-up animation on mount.
 * Each CrmShell page mounts fresh, so this provides a smooth enter transition.
 * Animations are fast (220ms) and use GPU-accelerated properties (opacity, transform).
 * Uses the design system easing: cubic-bezier(0.25, 0.1, 0.25, 1) — smooth deceleration.
 */
export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.22,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="h-full w-full"
      style={{ willChange: "opacity, transform" }}
    >
      {children}
    </motion.div>
  );
}
