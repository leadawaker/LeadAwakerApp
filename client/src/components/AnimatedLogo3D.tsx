import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, CSSProperties } from "react";

export function AnimatedLogo3D() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const containerStyle: CSSProperties = {
    perspective: "1200px",
  };

  const wrapperStyle: CSSProperties = {
    width: "300px",
    height: "400px",
    position: "relative",
    transformStyle: "preserve-3d" as any,
  };

  const leadStyle: CSSProperties = {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    transformStyle: "preserve-3d" as any,
  };

  const awakerStyle: CSSProperties = {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    top: 100,
    transformStyle: "preserve-3d" as any,
  };

  const accentStyle: CSSProperties = {
    position: "absolute",
    width: "60px",
    height: "60px",
    top: -40,
    left: "50%",
    marginLeft: "-30px",
    transformStyle: "preserve-3d" as any,
  };

  const glowStyle: CSSProperties = {
    position: "absolute",
    width: "100%",
    height: "100%",
    top: 50,
    left: 0,
    background: "radial-gradient(circle at center, rgba(81, 112, 255, 0.2) 0%, transparent 70%)",
    borderRadius: "50%",
    filter: "blur(20px)",
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6 }}
      className="flex justify-center items-center h-full"
      style={containerStyle}
    >
      <div style={wrapperStyle}>
        <motion.div
          initial={{ opacity: 0, y: 40, rotationX: 90 }}
          animate={isInView ? { opacity: 1, y: 0, rotationX: 0 } : { opacity: 0, y: 40, rotationX: 90 }}
          transition={{ delay: 0.3, duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
          style={leadStyle}
          className="text-6xl font-bold text-primary drop-shadow-lg"
          data-testid="animated-logo-lead"
        >
          LEAD
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, rotationX: 90 }}
          animate={isInView ? { opacity: 1, y: 0, rotationX: 0 } : { opacity: 0, y: 40, rotationX: 90 }}
          transition={{ delay: 1, duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
          style={awakerStyle}
          className="text-5xl font-bold text-accent drop-shadow-lg"
          data-testid="animated-logo-awaker"
        >
          Awaker
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0, rotationY: 90 }}
          animate={isInView ? { opacity: 1, scale: 1, rotationY: 0 } : { opacity: 0, scale: 0, rotationY: 90 }}
          transition={{ delay: 1.7, duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
          style={accentStyle}
          className="bg-gradient-to-br from-primary to-accent rounded-lg shadow-lg flex items-center justify-center text-white font-bold text-xl"
          data-testid="animated-logo-accent"
        >
          ▲
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 0.3 } : { opacity: 0 }}
          transition={{ delay: 2.5, duration: 1 }}
          style={glowStyle}
        />
      </div>
    </motion.div>
  );
}
