import { motion } from "framer-motion";
import { Database, MessageSquare, Calendar, BarChart, ArrowRight } from "lucide-react";
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
          {/* Service 1 */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 md:order-1"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
                <Database className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Database Reactivation</h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                This is our core offering. We take your list of "dead" leads—people who inquired 3, 6, or 12 months ago but never bought—and we wake them up.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
                  <span>Segment your audience based on past interactions</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
                  <span>Craft irresistible re-engagement offers</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
                  <span>Launch multi-channel campaigns (SMS, Email)</span>
                </li>
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 md:order-2 bg-muted/50 rounded-3xl p-8 border border-border aspect-video flex items-center justify-center relative overflow-hidden"
            >
               <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-50" />
               <Database className="w-32 h-32 text-primary/20" />
            </motion.div>
          </div>

          {/* Service 2 */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
             <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-muted/50 rounded-3xl p-8 border border-border aspect-video flex items-center justify-center relative overflow-hidden"
            >
               <div className="absolute inset-0 bg-gradient-to-bl from-accent/20 to-transparent opacity-50" />
               <MessageSquare className="w-32 h-32 text-accent/20" />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent mb-6">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Conversational AI Agents</h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                We don't just send blasts; we start conversations. Our AI agents are trained to understand intent, answer questions, and handle objections in real-time.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>24/7 Response capability</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>Natural language processing for human-like chat</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <span>Seamless hand-off to human staff when needed</span>
                </li>
              </ul>
            </motion.div>
          </div>

          {/* Service 3 */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 md:order-1"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
                <Calendar className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Automated Appointment Booking</h2>
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                The ultimate goal of reactivation is getting prospects on your calendar. Our system handles the scheduling automatically.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
                  <span>Integrates with Google Calendar, Calendly, etc.</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
                  <span>Automated reminders to reduce no-shows</span>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
                  <span>Rescheduling handling without manual input</span>
                </li>
              </ul>
            </motion.div>
             <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 md:order-2 bg-muted/50 rounded-3xl p-8 border border-border aspect-video flex items-center justify-center relative overflow-hidden"
            >
               <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-50" />
               <Calendar className="w-32 h-32 text-primary/20" />
            </motion.div>
          </div>

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
