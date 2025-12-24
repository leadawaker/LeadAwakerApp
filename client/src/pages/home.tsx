import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Database, MessageSquare, Calendar, BarChart, CheckCircle, ChevronDown, Menu } from "lucide-react";
import { Link } from "wouter";
import { useState, useRef } from "react";
import { useInView } from "framer-motion";
import { useEffect } from "react";
import Chat3D from "@/components/Chat3D";
import { PipelineChart } from "@/components/PipelineChart";
import { SalesRepSteps } from "@/components/SalesRepSteps";
import { AnimatedLogo3D } from "@/components/AnimatedLogo3D";

const AnimatedCounter = ({ end, duration = 3, format = (v: number) => Math.round(v).toString(), suffix = "" }: { end: number | string; duration?: number; format?: (v: number) => string; suffix?: string }) => {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!isInView) return;
    
    const numEnd = typeof end === 'string' ? 0 : end;
    const start = numEnd / 2;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const current = start + (numEnd - start) * progress;
      setValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);
  
  return (
    <div ref={ref}>
      {typeof end === 'string' ? end : format(value)}{suffix}
    </div>
  );
};

const AnimatedRangeCounter = ({ start: startNum, end: endNum, duration = 3, format = (v: number) => Math.round(v).toString(), suffix = "" }: { start: number; end: number; duration?: number; format?: (v: number) => string; suffix?: string }) => {
  const [startValue, setStartValue] = useState(0);
  const [endValue, setEndValue] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!isInView) return;
    
    const startHalf = startNum / 2;
    const endHalf = endNum / 2;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const currentStart = startHalf + (startNum - startHalf) * progress;
      const currentEnd = endHalf + (endNum - endHalf) * progress;
      setStartValue(currentStart);
      setEndValue(currentEnd);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isInView, startNum, endNum, duration]);
  
  return (
    <div ref={ref}>
      {format(startValue)}-{format(endValue)}{suffix}
    </div>
  );
};

const KanbanCard = ({ title, delay, isInView }: { title: string; delay: number; isInView: boolean }) => (
  <motion.div
    initial={{ x: -100, opacity: 0 }}
    animate={isInView ? { x: 0, opacity: 1 } : { x: -100, opacity: 0 }}
    transition={{ delay, duration: 0.5, repeat: Infinity, repeatDelay: 4 }}
    className="bg-white p-3 rounded-lg shadow-md border border-border text-sm font-medium w-32 text-center"
  >
    {title}
  </motion.div>
);

const AnimatedPipeline = ({ isInView }: { isInView: boolean }) => {
  const stages = ["Not Engaged", "Contacted", "Replied", "Qualified", "Sent to Client"];
  
  return (
    <div className="space-y-6">
      {stages.map((stage, idx) => (
        <div key={idx} className="flex items-center gap-4">
          <div className="w-32 text-sm font-semibold text-muted-foreground">{stage}</div>
          <div className="flex-1 h-16 bg-muted/30 rounded-lg border border-dashed border-border flex items-center px-4 overflow-hidden relative">
            {idx === 0 && <KanbanCard title="Lead #1234" delay={0} isInView={isInView} />}
            {idx === 1 && <KanbanCard title="Lead #5678" delay={0.3} isInView={isInView} />}
            {idx === 2 && <KanbanCard title="Lead #9012" delay={0.6} isInView={isInView} />}
            {idx === 3 && <KanbanCard title="Lead #3456" delay={0.9} isInView={isInView} />}
            {idx === 4 && <KanbanCard title="Lead #7890" delay={1.2} isInView={isInView} />}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function Home() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

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
                      background: 'linear-gradient(to right, transparent 0%, transparent 35%, #FEB800 50%, transparent 65%, transparent 100%)',
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
                  <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-primary hover:bg-yellow-400 hover:text-black hover:shadow-yellow-400/50 text-white transition-all">
                    Book a Call
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/services">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-2 hover:bg-yellow-400 hover:text-black hover:border-yellow-400 transition-all">
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
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-8 rounded-2xl text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">From chaos to certainty in 30 days</h2>
            <p className="text-lg text-muted-foreground">
              Sales teams shift from grind to strategy while Lead Awaker generates pipeline automatically.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {[
              {
                isRange: true,
                start: 40,
                end: 60,
                suffix: "%",
                label: "Reply Rates",
                subtext: "vs industry 5-10%"
              },
              {
                metric: 25,
                suffix: "%",
                label: "Leads Reactivated",
                subtext: "into live opportunities"
              },
              {
                metric: 40,
                suffix: "+",
                label: "Hours Saved",
                subtext: "per rep/month"
              },
              {
                metric: 5000,
                suffix: "",
                isCost: true,
                label: "Upfront Cost",
                subtext: "performance‑based pricing"
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
                      duration={3}
                      format={(v) => Math.round(v).toString()}
                      suffix={(result as any).suffix}
                    />
                  ) : (result as any).isCost ? (
                    <AnimatedCounter 
                      end={(result as any).metric} 
                      duration={3}
                      format={(v) => `$${Math.round((result as any).metric - v).toString()}`}
                    />
                  ) : (
                    <AnimatedCounter 
                      end={(result as any).metric} 
                      duration={3}
                      format={(v) => Math.round(v).toString()}
                      suffix={(result as any).suffix}
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

      {/* Demo Section with Logo */}
      <section id="demo" className="py-24 pt-36 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h2 className="text-3xl md:text-4xl font-bold">Let us show you how it's done</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                If a picture is worth a thousand words, a demo is worth a thousand pictures. That's why before you do anything, I want you to see AI in action. This demo gives a taster of how AI engages with customers in a natural way and bears the brunt of repetitive tasks, so you and your team don't have to.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                With AI freeing up valuable man-power and doing the work you'd "never get around to doing", you can unlock new levels of ROI whilst focusing on the things you enjoy.
              </p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Link href="/book-demo">
                  <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-primary hover:bg-yellow-400 hover:text-black hover:shadow-yellow-400/50 transition-all text-white">
                    Check Out The Demo
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex justify-center items-center"
            >
              <AnimatedLogo3D />
            </motion.div>
          </div>
        </div>
      </section>


      {/* Security & AI Guardrails Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Security, Compliance, and Reputation Built In</h2>
            <p className="text-lg text-muted-foreground">Your brand and data stay protected every step of the way.</p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                title: "Data Protection",
                desc: "Encrypted data handling and restricted access"
              },
              {
                title: "Compliance",
                desc: "GDPR/CCPA-friendly practices built in"
              },
              {
                title: "AI Guardrails",
                desc: "Safety filters on every interaction"
              },
              {
                title: "Sender Reputation",
                desc: "Protects your brand from spammy outreach"
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card p-6 rounded-xl border border-border text-center"
              >
                <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
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
              },
              {
                q: "What about compliance (GDPR, CCPA)?",
                a: "All workflows respect opt-out preferences, unsubscribe links, and data residency requirements. We're fully compliant."
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

          <div className="text-center">
            <Link href="/faq">
              <Button variant="outline" className="border-2">
                View All FAQs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom Demo CTA */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')"}} />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to convert dead leads into booked sales?
            </h2>
            <p className="text-lg opacity-90 mb-8 leading-relaxed">
              See how we've helped 50+ B2B companies reactivate their dormant databases and generate thousands in new revenue.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/book-demo">
                <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-white text-primary hover:bg-yellow-400 hover:text-black hover:shadow-yellow-400/50 transition-all font-bold">
                  Book a Demo
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="#demo">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-2 border-white text-white hover:bg-white/10">
                  See How It Works
                </Button>
              </Link>
            </div>
            <p className="text-sm opacity-75 mt-8">Average setup: 2-5 days | Performance-based pricing</p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
