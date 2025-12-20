import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Database, MessageSquare, Calendar, BarChart, CheckCircle, ChevronDown, Menu } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import leadLogo from "@assets/Untitled_design_1766218788499.jpg";

const AnimatedCard = ({ leadId, stageIndex, totalStages }: { leadId: string; stageIndex: number; totalStages: number }) => {
  // Each card's cycle: starts at stage 0, moves through all stages, then loops
  // stageIndex tells us which stage this card should be animating through
  const cycleDuration = totalStages * 1.5 + 2; // 1.5s per stage + 2s delay before repeat
  const delayPerStage = 1.5; // Time for each stage transition
  
  return (
    <motion.div
      initial={{ x: 0, opacity: 1 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="absolute bg-white p-3 rounded-lg shadow-md border border-border text-sm font-medium w-32 text-center top-4"
      style={{
        left: `${stageIndex * 20}%`,
        animation: `slideRight ${cycleDuration}s infinite`,
        animationDelay: `-${stageIndex * delayPerStage}s`
      }}
    >
      {leadId}
    </motion.div>
  );
};

const AnimatedPipeline = () => {
  const stages = ["Not Engaged", "Contacted", "Replied", "Qualified", "Sent to Client"];
  const leads = ["Lead #1234", "Lead #5678", "Lead #9012", "Lead #3456"];
  const totalStages = stages.length;
  const cycleDuration = totalStages * 1.5 + 2;

  return (
    <div className="overflow-x-auto">
      <style>{`
        @keyframes hopRight {
          0% { left: 50%; transform: translateX(-50%); opacity: 0; }
          1% { opacity: 1; }
          ${(1.5 / cycleDuration) * 100}% { left: 50%; transform: translateX(-50%); opacity: 1; }
          ${(3 / cycleDuration) * 100}% { left: 50%; transform: translateX(-50%); opacity: 1; }
          ${(4.5 / cycleDuration) * 100}% { left: 50%; transform: translateX(-50%); opacity: 1; }
          ${(6 / cycleDuration) * 100}% { left: 50%; transform: translateX(-50%); opacity: 1; }
          ${(7.5 / cycleDuration) * 100}% { left: 50%; transform: translateX(-50%); opacity: 1; }
          ${(8 / cycleDuration) * 100}% { left: 50%; transform: translateX(-50%); opacity: 0; }
          100% { left: 50%; transform: translateX(-50%); opacity: 0; }
        }
      `}</style>
      
      <div className="flex gap-6 min-w-max pb-6">
        {stages.map((stage, idx) => (
          <div key={idx} className="flex flex-col w-40">
            {/* Stage Header */}
            <div className="text-sm font-semibold text-muted-foreground mb-4 h-12 flex items-center">
              {stage}
            </div>
            
            {/* Column Container */}
            <div className="flex-1 min-h-80 bg-muted/30 rounded-lg border border-dashed border-border relative p-4">
              {/* For "Not Engaged" stage, show all leads stacked vertically */}
              {idx === 0 && (
                <div className="flex flex-col gap-3">
                  {leads.map((lead, leadIdx) => (
                    <motion.div
                      key={lead}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: leadIdx * 0.1 }}
                      className="bg-white p-3 rounded-lg shadow-sm border border-border text-xs font-medium text-center w-full"
                    >
                      {lead}
                    </motion.div>
                  ))}
                </div>
              )}
              
              {/* For other stages, show cards hopping in */}
              {idx > 0 && (
                <div className="relative w-full h-full">
                  {leads.map((lead, leadIdx) => {
                    const arrivalStage = leadIdx + 1;
                    if (idx >= arrivalStage) {
                      return (
                        <motion.div
                          key={lead}
                          className="absolute bg-white p-3 rounded-lg shadow-md border border-border text-xs font-medium text-center w-32 top-1/2 whitespace-nowrap"
                          style={{
                            animation: `hopRight ${cycleDuration}s infinite`,
                            animationDelay: `-${(leadIdx * 1.5 + (idx - 1) * 1.5)}s`
                          }}
                        >
                          {lead}
                        </motion.div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
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
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 text-foreground">
                Turn cold leads into <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">booked calls</span>—automatically.
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg leading-relaxed">
                AI + workflow automation for outbound, inbound, and CRM follow-up.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/book-demo">
                  <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white">
                    Book a Call
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-2">
                    See the System
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative bg-card p-8 rounded-2xl border border-border shadow-2xl"
            >
              <h3 className="text-sm font-semibold text-muted-foreground mb-6 uppercase tracking-wide">Conversion Pipeline</h3>
              <AnimatedPipeline />
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-12 border-y border-border bg-muted/20">
        <div className="container mx-auto px-4 md:px-6">
          <p className="text-center text-sm font-semibold text-muted-foreground mb-6 uppercase tracking-wide">
            Built with tools you already use
          </p>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8 items-center justify-center">
            {[
              { name: "CRM", icon: "📊" },
              { name: "WhatsApp/SMS", icon: "💬" },
              { name: "Email", icon: "✉️" },
              { name: "Calendars", icon: "📅" },
              { name: "Webhooks", icon: "🔗" },
              { name: "Databases", icon: "🗄️" },
            ].map((tool, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div className="text-3xl">{tool.icon}</div>
                <p className="text-sm font-medium text-foreground">{tool.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What We Do</h2>
            <p className="text-lg text-muted-foreground">
              Comprehensive automation for every stage of your sales process.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <MessageSquare className="w-8 h-8" />,
                title: "Lead Follow-up Automation",
                desc: "Instantly respond to new leads with AI-driven personalized sequences."
              },
              {
                icon: <Database className="w-8 h-8" />,
                title: "CRM Pipeline + Segmentation",
                desc: "Automatically organize and segment leads based on behavior and interest."
              },
              {
                icon: <CheckCircle className="w-8 h-8" />,
                title: "AI Qualification & Routing",
                desc: "AI qualifies leads and routes them to the right team member instantly."
              },
              {
                icon: <Calendar className="w-8 h-8" />,
                title: "Appointment Booking Flows",
                desc: "One-click scheduling integrated with your calendar and CRM."
              },
              {
                icon: <BarChart className="w-8 h-8" />,
                title: "Reporting Dashboards",
                desc: "Real-time visibility into response rates, conversions, and revenue impact."
              },
              {
                icon: <Zap className="w-8 h-8" />,
                title: "Integrations & Maintenance",
                desc: "Seamless setup with your existing stack, ongoing optimization."
              }
            ].map((service, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-card p-8 rounded-2xl border border-border hover:shadow-lg transition-shadow group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                  {service.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{service.title}</h3>
                <p className="text-muted-foreground">{service.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-muted/30">
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
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Real-World Use Cases</h2>
            <p className="text-lg text-muted-foreground">
              See how businesses are using Lead Awaker to scale their sales.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: "Inbound Lead Response in Under 60 Seconds",
                desc: "AI responds to form submissions instantly, answer questions, and qualify before humans take over."
              },
              {
                title: "No-Show Reduction",
                desc: "Automated reminders and rescheduling cut no-shows by up to 60%."
              },
              {
                title: "Reactivation Campaigns",
                desc: "Turn dormant leads from 6+ months ago into fresh conversations and closed deals."
              },
              {
                title: "Multi-Language Follow-up",
                desc: "AI automatically responds in the lead's preferred language for global sales teams."
              }
            ].map((useCase, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex gap-6 items-start bg-card p-8 rounded-2xl border border-border hover:shadow-lg transition-shadow"
              >
                <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-bold mb-2">{useCase.title}</h3>
                  <p className="text-muted-foreground">{useCase.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by Sales Leaders</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "We cut response time from hours to seconds. Qualified leads are on our sales team's calendar before they even realize they're qualified.",
                author: "Sarah Chen",
                title: "VP Sales, SaaS Company"
              },
              {
                quote: "The reactivation campaign alone brought in 15+ deals we thought were dead. We're recovering revenue without any additional ad spend.",
                author: "Marcus Rodriguez",
                title: "Founder, E-commerce Marketplace"
              },
              {
                quote: "No more manual follow-ups, no more leads falling through the cracks. Everything moves predictably through the pipeline.",
                author: "Jessica Kim",
                title: "Sales Director, B2B Services"
              }
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card p-8 rounded-2xl border border-border"
              >
                <p className="text-muted-foreground mb-6 italic">"{testimonial.quote}"</p>
                <div>
                  <p className="font-bold">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.title}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to know about getting started.
            </p>
          </div>

          <div className="space-y-4">
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
                q: "Who has access to our lead data?",
                a: "Only you and your team. Data stays in your CRM. We never store or sell lead information. GDPR and SOC2 compliant."
              },
              {
                q: "What if something breaks?",
                a: "We provide 24/7 monitoring and support. If a workflow fails, we fix it immediately and notify you with a detailed report."
              },
              {
                q: "Can we pause or cancel anytime?",
                a: "Yes. No long-term contracts. You can pause or cancel monthly plans with 30 days notice."
              },
              {
                q: "Do you provide training?",
                a: "Yes. We include onboarding training for your team and ongoing support to optimize performance."
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
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')"}} />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Ready to automate your sales?
              </h2>
              <p className="text-xl opacity-90 mb-8 leading-relaxed">
                Book a call with our team. We'll audit your process and show you exactly what's possible.
              </p>
              <div className="space-y-4">
                <p className="text-sm opacity-75">Average setup: 2-5 days | No long-term contracts</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20"
            >
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                    data-testid="input-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                    data-testid="input-email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Company</label>
                  <input
                    type="text"
                    placeholder="Your company"
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                    data-testid="input-company"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    placeholder="Tell us about your sales process..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
                    data-testid="textarea-message"
                  />
                </div>
                <Button className="w-full bg-white text-primary hover:bg-white/90 font-bold h-12 rounded-lg" data-testid="button-submit">
                  Schedule a Demo
                </Button>
                <p className="text-xs opacity-75 text-center">
                  This is a demo form. In production, we'll use your booking link.
                </p>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
