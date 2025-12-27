import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  ChevronDown,
  BarChart3, 
  Target, 
  Zap, 
  MessageSquare, 
  Mail, 
  Calendar,
  CheckCircle2,
  Clock,
  Shield,
  Search,
  Users
} from "lucide-react";
import Chat3D from "@/components/Chat3D";
import AnimatedLogo3D from "@/components/AnimatedLogo3D";
import PipelineChart from "@/components/PipelineChart";
import AnimatedCounter from "@/components/AnimatedCounter";
import AnimatedRangeCounter from "@/components/AnimatedRangeCounter";
import SalesRepSteps from "@/components/SalesRepSteps";
import WorkflowVisualization from "@/components/WorkflowVisualization";

export default function Home() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  return (
    <div className="min-h-screen pt-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden pb-20 md:pb-32">
        <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent blur-3xl opacity-50" />
        
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-20 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6 text-foreground relative">
                Wake dormant leads into<br />
                <motion.span 
                  className="relative block w-full"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 1 },
                    visible: { opacity: 1 }
                  }}
                >
                  <motion.span 
                    className="absolute top-0 bottom-0 -z-10" 
                    style={{ 
                      background: 'linear-gradient(to right, transparent 0%, transparent 35%, #FEB800 50%, #FEB800 55%, transparent 75%, transparent 100%)',
                      left: 'calc(50% - 200vw)', 
                      width: '400vw',
                      originX: 0.5 
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 1.5, duration: 0.3, ease: "easeOut" }}
                  />
                  <motion.span 
                    className="relative inline-block font-bold py-3 z-10"
                    initial={{ color: '#000', textShadow: 'none' }}
                    animate={{ 
                      color: '#ffffff',
                      textShadow: [
                        '0 10px 10px rgba(81, 112, 255, 0.12), -50px 0px 20px rgba(81, 112, 255, 0)',
                        '0 10px 20px rgba(81, 112, 255, 0.2), 0px 0px 20px rgba(81, 112, 255, 0.16)',
                        '0 10px 10px rgba(81, 112, 255, 0.12), 50px 0px 20px rgba(81, 112, 255, 0)'
                      ]
                    }}
                    transition={{ color: { delay: 1.5, duration: 0 }, textShadow: { delay: 1.5, duration: 0 } }}
                  >
                    booked calls
                  </motion.span>
                </motion.span>
                <span className="relative block w-full">
                  <span className="relative inline-block font-bold z-10 text-foreground">automatically.</span>
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg leading-relaxed">
                From first contact to CRM follow-up,<br />
                our AI automations handle it all<br />
                so you can focus on closing deals,<br />
                not chasing them.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                <Link href="/book-demo">
                  <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-primary hover:bg-yellow-400 hover:text-black hover:shadow-yellow-400/35 text-white transition-all">
                    Book a Call
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/services">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-2 hover:text-blue-500 hover:border-blue-500 transition-all">
                    See Services
                  </Button>
                </Link>
              </div>
            </motion.div>

            <Chat3D />
          </div>
        </div>
      </section>
      {/* Sales Rep Steps Section */}
      <SalesRepSteps />
      {/* Conversion Pipeline */}
      <section className="py-48 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          {/* New Pipeline Component */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-0"
          >
            <PipelineChart />
          </motion.div>
        </div>
      </section>
      {/* Results/Metrics Section */}
      <section className="pb-48 pt-32 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">Is what you get</h2>
            <p className="text-lg md:text-xl mt-4 text-[#3c50d6]">From chaos to certainty in 30 days</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {[
              {
                isRange: true,
                start: 20,
                end: 30,
                finalStart: 40,
                finalEnd: 60,
                suffix: "%",
                label: "Reply Rates",
                subtext: "vs industry 5-10%",
                duration: 2
              },
              {
                metric: 25,
                startMetric: 12,
                suffix: "%",
                label: "Leads Reactivated",
                subtext: "into live opportunities",
                duration: 3
              },
              {
                metric: 40,
                startMetric: 0,
                suffix: "+",
                label: "Hours Saved",
                subtext: "per rep/month",
                duration: 4,
                suffixAtEnd: true
              },
              {
                metric: 0,
                startMetric: 10000,
                isCost: true,
                label: "Upfront Cost",
                subtext: "performance‑based pricing",
                duration: 5
              }
            ].map((result, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card p-8 rounded-2xl border border-border text-center"
              >
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                  {(result as any).isRange ? (
                    <AnimatedRangeCounter 
                      start={(result as any).start}
                      end={(result as any).end}
                      finalStart={(result as any).finalStart}
                      finalEnd={(result as any).finalEnd}
                      duration={(result as any).duration}
                      format={(v: number) => Math.round(v).toString()}
                      suffix={(result as any).suffix}
                    />
                  ) : (result as any).isCost ? (
                    <AnimatedCounter 
                      start={(result as any).startMetric}
                      end={(result as any).metric} 
                      duration={(result as any).duration}
                      format={(v: number) => `$${Math.round(v).toString()}`}
                    />
                  ) : (
                    <AnimatedCounter 
                      start={(result as any).startMetric}
                      end={(result as any).metric} 
                      duration={(result as any).duration}
                      format={(v: number) => Math.round(v).toString()}
                      suffix={(result as any).suffix}
                      suffixAtEnd={(result as any).suffixAtEnd}
                    />
                  )}
                </div>
                <h3 className="text-lg font-bold mb-1">{(result as any).label}</h3>
                <p className="text-sm text-muted-foreground">{(result as any).subtext}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* Security & AI Guardrails Section */}
      <section className="py-48 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-4xl mx-auto mb-16"
          >
            <h2 className="md:text-4xl font-bold mt-[3px] mb-[3px] text-[48px]">Compliance and Reputation Built In</h2>
          </motion.div>

          <WorkflowVisualization />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="max-w-4xl mx-auto"
          >
            <div className="grid md:grid-cols-2 gap-8 text-left mt-12 p-8">
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  GDPR & CCPA Compliant
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  All workflows respect opt-out preferences, unsubscribe links, and data residency requirements. We're fully compliant with global privacy standards.
                </p>
              </div>
              <div className="space-y-3 md:pl-8 pt-8 md:pt-0">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Brand Protection
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Real-time monitoring ensures every interaction stays on-topic, professional, and perfectly aligned with your brand's voice and guidelines.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      {/* FAQ Teaser */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4 mb-12">
            {[
              {
                q: "What's the setup time?",
                a: "Most setups take 2-5 days depending on your CRM and integrations. We handle everything; you just provide access."
              },
              {
                q: "Do you support our CRM?",
                a: "We integrate with Salesforce, HubSpot, Pipedrive, Close, and custom APIs. If it has an API, we can connect to it."
              },
              {
                q: "How much does it cost?",
                a: "Pricing starts at [custom quote]. We work on performance-based or flat-fee models depending on your preference. No upfront setup fees."
              }
            ].map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="border border-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 hover:bg-muted/50 transition-colors"
                >
                  <h3 className="text-lg font-bold text-left">{faq.q}</h3>
                  <ChevronDown
                    className={`w-5 h-5 text-primary transition-transform ${
                      openFAQ === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFAQ === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 pb-6 text-muted-foreground border-t border-border"
                  >
                    {faq.a}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Let us show you how it's done Section */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')"}} />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="font-bold mb-6 text-white" style={{ fontSize: '48px' }}>Let us show you how it's done</h2>
            <p className="text-lg opacity-90 mb-8 leading-relaxed">
              If a picture is worth a thousand words, a demo is worth a thousand pictures. That's why before you do anything, I want you to see AI in action. This demo gives a taster of how AI engages with customers in a natural way and bears the brunt of repetitive tasks, so you and your team don't have to.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/book-demo">
                <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-white text-primary hover:bg-yellow-400 hover:text-black hover:shadow-yellow-400/35 transition-all font-bold">
                  Book a Demo
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
