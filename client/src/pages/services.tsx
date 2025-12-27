import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import ChatCard2D from "@/components/ChatCard2D";

export default function Services() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-6"
          >
            Our Services
          </motion.h1>
          <p className="text-xl text-muted-foreground">
            We specialize in Database Reactivation—turning your old leads into new revenue.
          </p>
        </div>

        <div className="space-y-24">
          {/* Chat Card Section */}
          <div className="flex gap-8 items-start max-w-6xl mx-auto py-12">
            {/* Chat Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex-shrink-0"
            >
              <ChatCard2D />
            </motion.div>
            
            {/* Explanation Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex-1 max-w-md space-y-6 pt-8"
            >
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  AI-Powered Lead Awakening
                </h3>
                
                <p className="text-gray-700 text-sm leading-relaxed mb-6">
                  This chat shows our <strong>"Sleeping Beauty Android"</strong> in action – a fully automated SMS conversation that wakes up cold leads.
                </p>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-gray-900">Initial SMS sent automatically</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span className="text-sm font-medium text-gray-900">Lead replies → AI asks qualifying questions</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    <span className="text-sm font-medium text-gray-900">Handles objections → Pushes to DSAR</span>
                  </div>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-200 rounded-xl mb-6">
                  <p className="text-sm text-gray-800 font-medium mb-1">
                    <strong>DSAR = Data Subject Access Request</strong>
                  </p>
                  <p className="text-xs text-gray-600">
                    Gets car finance documents from providers. Signing confirms they're ready to pursue their refund claim.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div>
                    <div className="text-2xl font-bold text-emerald-700">42%</div>
                    <div className="text-xs text-emerald-800 uppercase tracking-wide">Reply Rate</div>
                    <div className="text-xs text-gray-600">(vs 20% industry avg)</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-700">20.4%</div>
                    <div className="text-xs text-emerald-800 uppercase tracking-wide">DSAR Signed</div>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl text-sm">
                  <p className="font-bold text-gray-900 mb-1">Real Results:</p>
                  <ul className="text-xs space-y-1 text-gray-700 list-disc list-inside">
                    <li>$21 cost per DSAR completion (pure AI, no calls)</li>
                    <li>Solicitors earn $1,200-$1,800 per case</li>
                    <li>My fee: $190 per DSAR lead</li>
                  </ul>
                </div>

                <p className="text-xs text-gray-500 italic pt-4 border-t border-gray-200">
                  No salespeople. No phone calls. Just AI converting cold leads into high-value cases.
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="mt-24 text-center">
          <Link href="/book-demo">
            <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20">
              Start Your Campaign
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
