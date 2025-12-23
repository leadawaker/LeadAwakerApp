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
    width: "600px",
    height: "600px",
    position: "relative",
    transformStyle: "preserve-3d" as any,
  };

  const logoStyle: CSSProperties = {
    position: "absolute",
    width: "100%",
    height: "100%",
    top: 0,
    left: 0,
    transformStyle: "preserve-3d" as any,
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
        {/* LEAD SVG - Appears First */}
        <motion.img
          src="/LEAD.svg"
          alt="LEAD"
          initial={{ opacity: 0, rotationX: 90 }}
          animate={isInView ? { opacity: 1, rotationX: 0 } : { opacity: 0, rotationX: 90 }}
          transition={{ delay: 0.3, duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
          style={logoStyle}
          data-testid="animated-logo-lead"
        />

        {/* AWAKER SVG - Appears Below */}
        <motion.img
          src="/Awaker.svg"
          alt="Awaker"
          initial={{ opacity: 0, rotationX: 90 }}
          animate={isInView ? { opacity: 1, rotationX: 0 } : { opacity: 0, rotationX: 90 }}
          transition={{ delay: 1, duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
          style={logoStyle}
          data-testid="animated-logo-awaker"
        />

        {/* Top Logo SVG - Appears Last */}
        <motion.img
          src="/top logo.svg"
          alt="Top Logo"
          initial={{ opacity: 0, scale: 0, rotationY: 90 }}
          animate={isInView ? { opacity: 1, scale: 1, rotationY: 0 } : { opacity: 0, scale: 0, rotationY: 90 }}
          transition={{ delay: 1.7, duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
          style={logoStyle}
          data-testid="animated-logo-top"
        />
      </div>
    </motion.div>
  );
}
