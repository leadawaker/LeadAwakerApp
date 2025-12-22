import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Database, MessageSquare, Calendar, BarChart, CheckCircle, ChevronDown, Menu } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import leadLogo from "@assets/Untitled_design_1766218788499.jpg";
import Chat3D from "@/components/Chat3D";
import { PipelineChart } from "@/components/PipelineChart";

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
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6 text-foreground">
                Turn cold leads into <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">booked calls</span> automatically.
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg leading-relaxed">
                From first contact to CRM follow-up, our AI automations handle it all so you can focus on closing deals, not chasing them.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
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
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Manual Reactivation Is Broken.</h2>
            <p className="text-lg text-muted-foreground mb-8">Sales teams drown in dead leads while burning cash.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
            {[
              { icon: "📊", title: "Bloated CRMs with 1000s of \"dead\" contacts you already paid for" },
              { icon: "⏰", title: "Reps waste 20-40 hrs/week on soul-crushing copy-paste outreach" },
              { icon: "📉", title: "5-10% reply rates → zero ROI" },
              { icon: "🚫", title: "Generic blasts → ignored or straight to spam folder" },
              { icon: "😩", title: "Team burnout → turnover" }
            ].map((pain, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-red-50 border border-red-200 p-6 rounded-xl text-center"
              >
                <div className="text-3xl mb-3">{pain.icon}</div>
                <p className="text-sm font-medium text-gray-700">{pain.title}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-red-100 border border-red-300 p-8 rounded-2xl text-center max-w-2xl mx-auto"
          >
            <p className="text-base font-semibold text-red-900">Companies have invested thousands in acquiring these leads, but they're leaving millions on the table because reactivation is too painful and ineffective.</p>
          </motion.div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Expert Sales Rep in 3 Steps.</h2>
            <p className="text-xl text-primary font-semibold">Dead leads → revenue.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                num: "1",
                title: "Upload database",
                desc: "AI instantly IDs high-potential dormant leads"
              },
              {
                num: "2",
                title: "Chat GPT-5.2 conversations",
                desc: "Natural, contextual SMS (not robot templates)"
              },
              {
                num: "3",
                title: "Revenue rolls in",
                desc: "Auto-books meetings 24/7"
              }
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card p-8 rounded-2xl border border-border relative"
              >
                <div className="absolute -top-6 -right-6 w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center text-lg font-bold shadow-lg">
                  {step.num}
                </div>
                <div className="text-3xl mb-4">
                  {i === 0 && "📊"}
                  {i === 1 && "💬"}
                  {i === 2 && "📈"}
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Let us show you how it's done</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                If a picture is worth a thousand words, a demo is worth a thousand pictures. That's why before you do anything, I want you to see AI in action. This demo gives a taster of how AI engages with customers in a natural way and bears the brunt of repetitive tasks, so you and your team don't have to.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                With AI freeing up valuable man-power and doing the work you'd "never get around to doing", you can unlock new levels of ROI whilst focusing on the things you enjoy.
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <Link href="/book-demo">
                <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white">
                  Check Out The Demo
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Conversion Pipeline */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground">
              Three simple steps to automate your entire sales workflow.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector lines (hidden on mobile) */}
            <div className="absolute top-1/4 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20 hidden md:block z-0" />

            {[
              {
                num: "01",
                title: "Map the Process",
                desc: "We analyze your current sales workflow and identify bottlenecks.",
                icon: <Database className="w-8 h-8" />
              },
              {
                num: "02",
                title: "Build the Automations",
                desc: "Set up AI agents, workflows, and integrations in minutes.",
                icon: <Zap className="w-8 h-8" />
              },
              {
                num: "03",
                title: "Optimize Weekly",
                desc: "Monitor performance and continuously improve conversion rates.",
                icon: <BarChart className="w-8 h-8" />
              }
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative z-10"
              >
                <div className="text-center">
                  <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center text-3xl font-bold shadow-lg">
                      {step.num}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* New Pipeline Component */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20"
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
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Within 30 Days</h2>
            <p className="text-lg text-muted-foreground">
              Real results from real sales teams using Lead Awaker.
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
                subtext: "into opportunities"
              },
              {
                metric: "40+",
                label: "Hours Saved",
                subtext: "per rep/month"
              },
              {
                metric: "$0",
                label: "Upfront Cost",
                subtext: "performance pricing"
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-8 rounded-2xl text-center max-w-2xl mx-auto"
          >
            <h3 className="text-2xl font-bold mb-3">From Chaos to Passive Revenue</h3>
            <p className="text-muted-foreground text-lg">
              Sales teams shift from grind to strategy while Lead Awaker generates pipeline automatically.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Seamless Integration - Moved after Results */}
      <section className="py-16 border-t border-border bg-muted/20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold mb-4 text-center">Seamless Integration, No Learning Curve</h3>
            <p className="text-center text-muted-foreground mb-10 text-lg">Your existing stack becomes an automation powerhouse.</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {[
                { name: "CRM Systems", icon: "📊" },
                { name: "WhatsApp, SMS & Chat", icon: "💬" },
                { name: "Email Platforms", icon: "✉️" },
                { name: "Calendar Apps", icon: "📅" },
                { name: "Webhook Endpoints", icon: "🔗" },
                { name: "Databases", icon: "🗄️" },
              ].map((tool, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col items-center gap-3 text-center"
                >
                  <div className="text-4xl">{tool.icon}</div>
                  <p className="text-sm font-medium text-foreground">{tool.name}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Logo Section */}
      <section className="py-16 border-t border-border">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <img 
              src={leadLogo} 
              alt="Lead Awaker Logo" 
              className="w-48 mx-auto drop-shadow-lg"
            />
          </motion.div>
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
