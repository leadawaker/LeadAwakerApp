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
    width: "400px",
    height: "500px",
    position: "relative",
    transformStyle: "preserve-3d" as any,
    backgroundColor: "transparent",
  };

  const leadStyle: CSSProperties = {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    transformStyle: "preserve-3d" as any,
    top: "80px",
    backgroundColor: "transparent",
  };

  const awakerStyle: CSSProperties = {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    top: 200,
    transformStyle: "preserve-3d" as any,
    backgroundColor: "transparent",
  };

  const topLogoStyle: CSSProperties = {
    position: "absolute",
    width: "120px",
    height: "120px",
    top: -30,
    left: "50%",
    marginLeft: "-60px",
    transformStyle: "preserve-3d" as any,
    backgroundColor: "transparent",
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
        <motion.div
          initial={{ opacity: 0, y: 40, rotationX: 90 }}
          animate={isInView ? { opacity: 1, y: 0, rotationX: 0 } : { opacity: 0, y: 40, rotationX: 90 }}
          transition={{ delay: 0.3, duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
          style={leadStyle}
          data-testid="animated-logo-lead"
        >
          <svg
            viewBox="0 0 1041.67 1041.67"
            width="200"
            height="200"
          >
            <image href="/LEAD.svg" width="100%" height="100%" />
          </svg>
        </motion.div>

        {/* AWAKER SVG - Appears Below */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotationX: 90 }}
          animate={isInView ? { opacity: 1, y: 0, rotationX: 0 } : { opacity: 0, y: 40, rotationX: 90 }}
          transition={{ delay: 1, duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
          style={awakerStyle}
          data-testid="animated-logo-awaker"
        >
          <svg
            viewBox="0 0 1041.67 1041.67"
            width="180"
            height="180"
          >
            <image href="/Awaker.svg" width="100%" height="100%" />
          </svg>
        </motion.div>

        {/* Top Logo SVG - Appears Last */}
        <motion.div
          initial={{ opacity: 0, scale: 0, rotationY: 90 }}
          animate={isInView ? { opacity: 1, scale: 1, rotationY: 0 } : { opacity: 0, scale: 0, rotationY: 90 }}
          transition={{ delay: 1.7, duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
          style={topLogoStyle}
          data-testid="animated-logo-top"
        >
          <svg
            viewBox="0 0 1041.67 1041.67"
            width="100%"
            height="100%"
          >
            <image href="/top logo.svg" width="100%" height="100%" />
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
}
