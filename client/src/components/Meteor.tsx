import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const Meteor = ({ onComplete }: { onComplete: () => void }) => {
  return (
    <motion.div
      initial={{ 
        opacity: 0, 
        top: "50%", 
        left: "-10%", 
        scale: 0.5 
      }}
      animate={{ 
        opacity: [0, 1, 1, 0], 
        top: "50%", 
        left: "110%", 
        scale: 1 
      }}
      transition={{ 
        duration: 0.6, 
        ease: "easeOut",
        times: [0, 0.1, 0.8, 1]
      }}
      onAnimationComplete={onComplete}
      className="absolute w-[300px] h-[0.5px] origin-left rotate-0 z-20 pointer-events-none"
      style={{
        background: "linear-gradient(to right, rgba(255, 150, 50, 0) 0%, rgba(255, 200, 100, 1) 40%, rgba(255, 255, 255, 1) 100%)",
        boxShadow: "0 0 12px 1px rgba(255, 200, 100, 0.8)"
      }}
    />
  );
};

export function MeteorContainer() {
  const [meteors, setMeteors] = useState<number[]>([]);

  const removeMeteor = (id: number) => {
    setMeteors((prev) => prev.filter((m) => m !== id));
  };
  
  // Auto-launch meteors every 30 seconds
  useEffect(() => {
    const meteorInterval = setInterval(() => {
      const id = Date.now();
      setMeteors(prev => [...prev, id]);
    }, 30000);
    return () => clearInterval(meteorInterval);
  }, []);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {meteors.map((id) => (
          <Meteor key={id} onComplete={() => removeMeteor(id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
