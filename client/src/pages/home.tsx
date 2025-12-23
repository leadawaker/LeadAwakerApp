import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Database, MessageSquare, Calendar, BarChart, CheckCircle, ChevronDown, Menu, Box, Copy, TrendingDown, Mail } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import leadLogo from "@assets/Untitled_design_1766218788499.jpg";
import Chat3D from "@/components/Chat3D";
import { PipelineChart } from "@/components/PipelineChart";
import { SalesRepSteps } from "@/components/SalesRepSteps";

const KanbanCard = ({ title, delay }: { title: string; delay: number }) => (
  <motion.div
    initial={{ x: -100, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ delay, duration: 0.5, repeat: Infinity, repeatDelay: 4 }}
    className="bg-white p-3 rounded-lg shadow-md border border-border text-sm font-medium w-32 text-center"
  >
    {title}
  </motion.div>
);

const AnimatedPipeline = () => {
  const stages = ["Not Engaged", "Contacted", "Replied", "Qualified", "Sent to Client"];
  
  return (
    <div className="space-y-6">
      {stages.map((stage, idx) => (
        <div key={idx} className="flex items-center gap-4">
          <div className="w-32 text-sm font-semibold text-muted-foreground">{stage}</div>
          <div className="flex-1 h-16 bg-muted/30 rounded-lg border border-dashed border-border flex items-center px-4 overflow-hidden relative">
            {idx === 0 && <KanbanCard title="Lead #1234" delay={0} />}
            {idx === 1 && <KanbanCard title="Lead #5678" delay={0.3} />}
            {idx === 2 && <KanbanCard title="Lead #9012" delay={0.6} />}
            {idx === 3 && <KanbanCard title="Lead #3456" delay={0.9} />}
            {idx === 4 && <KanbanCard title="Lead #7890" delay={1.2} />}
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
                Awake dormant leads into<br />
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
                    className="absolute left-0 top-0 bottom-0 right-0 bg-gradient-to-r from-primary to-white -z-10" 
                    style={{ right: 'calc(-100vw + 100%)', originX: 0 }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 1, duration: 0.3, ease: "easeOut" }}
                  />
                  <span 
                    className="relative inline-block font-bold py-3 z-10 text-black"
                  >
                    booked calls
                  </span>
                </motion.span>
                automatically.
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg leading-relaxed">
                From first contact to CRM follow-up, our AI automations handle it all so you can focus on closing deals, not chasing them.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                <Link href="/book-demo">
                  <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white">
                    Book a Call
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="#demo">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-2">
                    See Demo
                  </Button>
                </Link>
              </div>
            </motion.div>

            <Chat3D />
          </div>
        </div>
      </section>


      {/* Pain Points Section */}
      <section className="py-32 md:py-40 bg-muted/30 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 mix-blend-overlay" style={{backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')"}} />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-red-900 to-red-700 bg-clip-text text-transparent">Manual Reactivation Is Broken.</h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.08,
                  delayChildren: 0.1,
                }
              }
            }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          >
            {[
              { icon: <Box className="w-8 h-8" strokeWidth={1.5} />, title: "Bloated CRMs with 1000s of \"dead\" contacts you already paid for" },
              { icon: <Copy className="w-8 h-8" strokeWidth={1.5} />, title: "Reps waste 20-40 hrs/week on soul-crushing copy-paste outreach" },
              { icon: <TrendingDown className="w-8 h-8" strokeWidth={1.5} />, title: "5-10% reply rates → zero ROI" },
              { icon: <Mail className="w-8 h-8" strokeWidth={1.5} />, title: "Generic blasts → ignored or straight to spam folder" }
            ].map((pain, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 30, scale: 0.95 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100, damping: 15 } }
                }}
                className="group relative bg-gradient-to-br from-red-50 to-red-50/50 border border-red-200/60 backdrop-blur-sm p-8 rounded-2xl text-center hover:border-red-400/80 transition-all duration-400 cursor-default overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 to-red-500/0 group-hover:from-red-500/5 group-hover:to-red-500/10 transition-all duration-400" />
                <div className="relative z-10">
                  <div className="text-red-700 mb-4 transform group-hover:scale-125 transition-transform duration-400 inline-flex items-center justify-center">{pain.icon}</div>
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed">{pain.title}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-300/40 backdrop-blur-sm p-8 rounded-2xl text-center max-w-2xl mx-auto shadow-lg shadow-red-200/20"
          >
            <p className="text-base font-semibold text-red-950 leading-relaxed">Companies have invested thousands in acquiring these leads, but they're leaving millions on the table because reactivation is too painful and ineffective.</p>
          </motion.div>
        </div>
      </section>

      {/* Sales Rep Steps Section */}
      <SalesRepSteps />

      {/* Conversion Pipeline */}
      <section className="py-24 bg-muted/30">
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
                metric: "40-60%",
                label: "Reply Rates",
                subtext: "vs industry 5-10%"
              },
              {
                metric: "15-25%",
                label: "Leads Reactivated",
                subtext: "into live opportunities"
              },
              {
                metric: "40+",
                label: "Hours Saved",
                subtext: "per rep/month"
              },
              {
                metric: "$0",
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
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">{result.metric}</div>
                <h3 className="text-lg font-bold mb-1">{result.label}</h3>
                <p className="text-sm text-muted-foreground">{result.subtext}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section with Logo */}
      <section id="demo" className="py-24 border-t border-border">
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
                  <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white">
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
              className="flex justify-center"
            >
              <img 
                src={leadLogo} 
                alt="Lead Awaker Logo" 
                className="w-64 drop-shadow-lg"
                data-testid="lead-logo"
              />
            </motion.div>
          </div>
        </div>
      </section>


      {/* Security & AI Guardrails Section */}
      <section className="py-24">
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
                <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-white text-primary hover:bg-white/90 font-bold">
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
