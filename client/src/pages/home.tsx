import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Database, MessageSquare, Calendar, BarChart, CheckCircle, ChevronDown, Menu } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import leadLogo from "@assets/Untitled_design_1766218788499.jpg";

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
                From first contact to CRM follow-up, our AI automations handle it all—so you can focus on closing deals, not chasing them.
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
                    How It Works
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative bg-gradient-to-b from-blue-50 to-white p-0 rounded-3xl border border-gray-200 shadow-2xl overflow-hidden"
              style={{ backgroundImage: 'linear-gradient(135deg, #e0f2f7 0%, #f0f9fb 100%)' }}
            >
              {/* WhatsApp Header */}
              <div className="bg-gradient-to-r from-primary to-primary/90 text-white p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">S</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Sophie from XYZ</p>
                  <p className="text-xs opacity-75">Online</p>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="p-4 space-y-4 h-[500px] overflow-y-auto">
                {/* Sophie Message 1 (You/User - Right side, teal) */}
                <motion.div 
                  className="flex justify-end"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "0px 0px -100px 0px" }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="bg-primary text-white p-3 rounded-2xl rounded-br-none max-w-xs text-sm shadow-md">
                    <p>Hey this is Sophie from XYZ, is this the same John that got a product quote from us a couple of months ago?</p>
                  </div>
                </motion.div>

                {/* John Message 1 (Recipient - Left side, light gray) */}
                <motion.div 
                  className="flex justify-start"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "0px 0px -100px 0px" }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <div className="bg-gray-200 text-gray-800 p-3 rounded-2xl rounded-bl-none max-w-xs text-sm shadow-sm">
                    <p>Hey yes, I remember that.</p>
                  </div>
                </motion.div>

                {/* Sophie Message 2 (You/User - Right side, teal) */}
                <motion.div 
                  className="flex justify-end"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "0px 0px -100px 0px" }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <div className="bg-primary text-white p-3 rounded-2xl rounded-br-none max-w-xs text-sm shadow-md">
                    <p>Great! My calendar booked me to call you but I didn't want to disturb you. Are you still interested?</p>
                  </div>
                </motion.div>

                {/* John Message 2 (Recipient - Left side, light gray) */}
                <motion.div 
                  className="flex justify-start"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "0px 0px -100px 0px" }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <div className="bg-gray-200 text-gray-800 p-3 rounded-2xl rounded-bl-none max-w-xs text-sm shadow-sm">
                    <p>Maybe, I haven't thought about that for a while</p>
                  </div>
                </motion.div>

                {/* Sophie Message 3 (You/User - Right side, teal) */}
                <motion.div 
                  className="flex justify-end"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "0px 0px -100px 0px" }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                >
                  <div className="bg-primary text-white p-3 rounded-2xl rounded-br-none max-w-xs text-sm shadow-md">
                    <p>Let me ask you, what fitness goals are you aiming to achieve?</p>
                  </div>
                </motion.div>

                {/* Typing indicator (Recipient typing) */}
                <motion.div 
                  className="flex justify-start"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "0px 0px -100px 0px" }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                >
                  <div className="bg-gray-200 text-gray-600 p-3 rounded-2xl rounded-bl-none flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                    <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                  </div>
                </motion.div>
              </div>

              <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Bar - Seamless Integration */}
      <section className="py-16 border-y border-border bg-muted/20">
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

      {/* Pain Points Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Manual Reactivation Is Broken</h2>
            <p className="text-lg text-muted-foreground">
              B2B sales teams are drowning in dead lead databases while burning resources.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
            {[
              { icon: "📋", title: "Messy spreadsheets or bloated CRMs filled with thousands of dead leads" },
              { icon: "⏰", title: "Sales reps spend 20-40 hours weekly on repetitive, soul-crushing outreach" },
              { icon: "❌", title: "5-10% response rates with zero ROI on cold leads" },
              { icon: "👥", title: "Generic mass blasts that get ignored or marked as spam" },
              { icon: "🔄", title: "Team burnout, morale tanks, turnover increases" }
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
            className="bg-blue-50 border border-blue-200 p-6 rounded-xl text-center max-w-2xl mx-auto"
          >
            <p className="text-sm"><span className="font-bold text-blue-700">Bottom Line:</span> <span className="text-gray-700">Companies have invested thousands in acquiring these leads, but they're leaving money on the table because reactivation is too painful and ineffective.</span></p>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Your AI Sales Android</h2>
            <p className="text-lg text-muted-foreground">
              Our simple 3-step process turns your dormant leads into fresh revenue.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                num: "1",
                title: "Upload Your Database",
                desc: "Plug in your CRM export and the AI starts working immediately. We analyze it to identify dormant leads with sales potential."
              },
              {
                num: "2",
                title: "AI Conversations Begin",
                desc: "GPT-4o generates natural, contextual messages tailored to each lead—not robotic templates. Human-like two-way dialogue."
              },
              {
                num: "3",
                title: "Watch Sales Roll In",
                desc: "Qualified leads are warmed up and meetings booked directly on your calendar. 24/7 autonomous operation."
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

          {/* CRM Pipeline Visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20 bg-card rounded-2xl border border-border p-8 md:p-10 overflow-hidden"
          >
            <h4 className="text-lg font-bold mb-8 text-center">Your Conversion Pipeline in Action</h4>
            <div className="space-y-4">
              {[
                { stage: "New Leads", leads: [{ name: "John Smith", phone: "+1 (555) 123-4567", time: "Just now" }, { name: "Sarah Johnson", phone: "+1 (555) 234-5678", time: "2 min ago" }] },
                { stage: "Contacted", leads: [{ name: "Mike Chen", phone: "+1 (555) 345-6789", time: "5 min ago" }] },
                { stage: "Qualified", leads: [{ name: "Emma Davis", phone: "+1 (555) 456-7890", time: "12 min ago" }] },
                { stage: "Booked", leads: [{ name: "Alex Taylor", phone: "+1 (555) 567-8901", time: "2 hours ago" }] }
              ].map((column, colIdx) => (
                <motion.div
                  key={colIdx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: colIdx * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-32 text-sm font-semibold text-accent flex-shrink-0 pt-1">{column.stage}</div>
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap gap-3">
                      {column.leads.map((lead, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.95 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: colIdx * 0.1 + idx * 0.05 }}
                          className="bg-muted/50 p-3 rounded-lg border border-border/50 text-sm flex-1 min-w-[180px]"
                        >
                          <p className="font-medium text-foreground">{lead.name}</p>
                          <p className="text-muted-foreground text-xs mt-1">{lead.phone}</p>
                          <p className="text-muted-foreground text-xs mt-1">Last replied: {lead.time}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Results Section */}
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
