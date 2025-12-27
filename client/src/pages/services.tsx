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
          <div className="grid md:grid-cols-2 gap-12 items-center py-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 md:order-1"
            >
              <h2 className="text-3xl font-bold mb-4">See Our AI in Action</h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                Watch how our conversational AI agents engage with prospects naturally and authentically. These aren't robotic automated messages—they're intelligent, context-aware conversations that build trust and drive results.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>Intelligent responses tailored to each prospect</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>Multi-channel conversations (SMS, Email, WhatsApp)</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>Seamless escalation to your team when needed</span>
                </li>
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 md:order-2 max-w-md mx-auto w-full"
            >
              <ChatCard2D />
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
