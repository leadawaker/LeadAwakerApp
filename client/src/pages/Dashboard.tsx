import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
            Welcome to Your Dashboard
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Manage your sales pipeline and automate your outreach all in one place.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
