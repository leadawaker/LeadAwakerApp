import { motion } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Wraps page content with a fast opacity-only fade on mount.
 * Pure crossfade (no spatial motion) so identical bg-muted panels
 * appear to persist across page navigations without any visible jump.
 */
export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.15,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="h-full w-full"
      style={{ willChange: "opacity" }}
    >
      {children}
    </motion.div>
  );
}
