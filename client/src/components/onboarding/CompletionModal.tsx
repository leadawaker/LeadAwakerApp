/**
 * Celebration modal shown when the onboarding tutorial is completed.
 * Uses framer-motion for confetti-style animation.
 */
import { motion } from "framer-motion";
import { PartyPopper, ArrowRight } from "lucide-react";

interface Props {
  onDismiss: () => void;
}

// Confetti particle component
function Particle({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <motion.div
      className="absolute top-0 rounded-full"
      style={{
        left: `${x}%`,
        width: 8,
        height: 8,
        backgroundColor: color,
      }}
      initial={{ y: 0, opacity: 1, scale: 0 }}
      animate={{
        y: [0, -80, 200],
        opacity: [0, 1, 0],
        scale: [0, 1.2, 0.6],
        rotate: [0, 360, 720],
      }}
      transition={{
        duration: 2,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

const CONFETTI_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];

export function CompletionModal({ onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        className="bg-background border border-border rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden relative"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
      >
        {/* Confetti particles */}
        <div className="absolute inset-x-0 top-1/3 overflow-hidden pointer-events-none h-40">
          {CONFETTI_COLORS.map((color, i) => (
            <Particle
              key={i}
              delay={i * 0.1}
              x={10 + i * 12}
              color={color}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-8 text-center relative z-10">
          <motion.div
            className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"
            initial={{ rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <PartyPopper className="h-8 w-8 text-primary" />
          </motion.div>

          <motion.h2
            className="text-xl font-bold text-foreground mb-2"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            You're all set!
          </motion.h2>

          <motion.p
            className="text-sm text-muted-foreground mb-6"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Your account is configured and your campaign is ready to go.
            Leads will start receiving messages during your business hours.
          </motion.p>

          <motion.button
            onClick={onDismiss}
            className="text-sm font-medium text-primary-foreground bg-primary px-6 py-2.5 rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Go to Campaigns
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
