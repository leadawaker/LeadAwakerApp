import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, CSSProperties } from "react";

export default function AnimatedLogo3D() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.6 });

  const containerStyle: CSSProperties = {
    perspective: "1200px",
  };

  const wrapperStyle: CSSProperties = {
    width: "300px",
    height: "300px",
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
        {/* Top Logo SVG - Grows from behind */}
        <motion.img
          src="/top logo.svg"
          alt="Top Logo"
          initial={{ opacity: 0, scale: 0 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
          transition={{ delay: 1.2, duration: 0.1, type: "spring", stiffness: 200, damping: 15 }}
          style={logoStyle}
          data-testid="animated-logo-top"
        />

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
        <motion.div
          initial={{ opacity: 0, rotationX: 90 }}
          animate={isInView ? { opacity: 1, rotationX: 0 } : { opacity: 0, rotationX: 90 }}
          transition={{ delay: 1, duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
          style={logoStyle}
          data-testid="animated-logo-awaker"
          className="flex items-center justify-center"
        >
          <img
            src="/attached_assets/Gemini_Generated_Image_j212wcj212wcj212_1767283699067.png"
            alt="My Photo"
            className="w-48 h-48 rounded-full object-cover border-4 border-primary/20 shadow-2xl"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
