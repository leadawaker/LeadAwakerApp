import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, CSSProperties } from "react";
import profileImg from "@/assets/profile.jpg";

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
        {/* AWAKER Photo - Just the Photo with Smooth Animation */}
        <motion.div
          initial={{ opacity: 0, rotateX: 90, scale: 0.8 }}
          animate={isInView ? { opacity: 1, rotateX: 0, scale: 1 } : { opacity: 0, rotateX: 90, scale: 0.8 }}
          transition={{ delay: 0.3, duration: 1, type: "spring", stiffness: 100, damping: 15 }}
          style={logoStyle}
          data-testid="animated-logo-awaker"
          className="flex items-center justify-center"
        >
          <img
            src={profileImg}
            alt="My Photo"
            className="w-full h-full object-cover rounded-3xl shadow-sm"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
