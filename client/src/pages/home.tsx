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
  const [isFinished, setIsFinished] = useState(false);

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
      <section className="pb-48 pt-16 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">And what you get</h2>
            <p className="text-lg md:text-xl mt-4 text-[#3c50d6]">From chaos to certainty in 30 days</p>
          </motion.div>

          <div className="flex flex-col md:flex-row gap-8 mb-12 items-stretch max-w-4xl mx-auto">
            {/* Featured Large Card */}
            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              animate={{ 
                backgroundColor: isFinished ? "#526fff" : "#ffffff",
                color: isFinished ? "#ffffff" : "#3c50d6"
              }}
              transition={{ duration: 0.5 }}
              className="p-8 rounded-2xl border border-border text-center flex flex-col justify-center flex-[2] min-h-[550px]"
            >
              <div className="text-6xl md:text-9xl font-black mb-2 font-heading">
                <AnimatedCounter 
                  start={10000}
                  end={0} 
                  duration={5}
                  format={(v: number) => `$${Math.round(v).toString()}`}
                  onFinishedChange={(finished) => setIsFinished(finished)}
                />
              </div>
              <h3 className="text-4xl font-black mb-2 font-heading">Upfront Cost</h3>
              <p className="text-xl font-medium opacity-80">performance‑based pricing</p>
            </motion.div>

            {/* Stacked Side Cards */}
            <div className="flex flex-col gap-4 flex-1">
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
                  subtext: "into live",
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
                }
              ].map((result, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * i }}
                  className="bg-card p-6 rounded-2xl border border-border text-center flex flex-col justify-center flex-1 min-w-[280px]"
                >
                  <div className={`font-bold text-primary mb-1 font-heading ${result.isRange ? 'text-4xl' : 'text-[48px]'}`}>
                    {result.isRange ? (
                      <AnimatedRangeCounter 
                        start={result.start}
                        end={result.end}
                        finalStart={result.finalStart}
                        finalEnd={result.finalEnd}
                        duration={result.duration}
                        format={(v: number) => Math.round(v).toString()}
                        suffix={result.suffix}
                      />
                    ) : (
                      <AnimatedCounter 
                        start={result.startMetric}
                        end={result.metric} 
                        duration={result.duration}
                        format={(v: number) => Math.round(v).toString()}
                        suffix={result.suffix}
                        suffixAtEnd={result.suffixAtEnd}
                      />
                    )}
                  </div>
                  <h3 className="font-bold truncate font-heading text-[22px]">{result.label}</h3>
                </motion.div>
              ))}
            </div>
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
      {/* Bottom Demo CTA Section */}
      <section className="py-32 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="md:text-4xl lg:text-5xl font-bold mb-8 text-white tracking-tight text-[40px] leading-tight">
              See AI Work, Not Just Talk
            </h2>
            
            <div className="space-y-6 leading-relaxed mb-12 text-justify">
              <p className="text-lg opacity-90">
                If a picture is worth a thousand words, a <span className="text-[#FEB800] font-bold">live demo</span> is worth a thousand pictures. Before you do anything else, experience how AI interacts with customers naturally while handling the repetitive work your team shouldn't have to.
              </p>

              <p className="text-lg opacity-90">
                By automating what drains your time, AI frees your team to focus on what actually moves the needle — strategy, growth, and the work you enjoy. In just a few minutes, you’ll see how smarter automation transforms your ROI and your day-to-day operations.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link href="/book-demo">
                <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-white text-primary hover:bg-yellow-400 hover:text-black hover:shadow-yellow-400/35 transition-all">
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
