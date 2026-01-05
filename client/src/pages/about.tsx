import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Rocket, Target, Code2, TrendingUp, Briefcase, ChevronDown } from "lucide-react";
import AnimatedLogo3D from "@/components/AnimatedLogo3D";
import LeadReactivationAnimation from "@/components/LeadReactivationAnimation";

export default function About() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const sections = [
    {
      icon: <Code2 className="w-6 h-6 text-primary" />,
      title: "Reliable technical backbone",
      items: [
        "10+ years shipping production software across games and film",
        "Experience at Framestore, Sega, New World Interactive",
        "Knows how to keep complex systems simple and stable for non-technical teams"
      ]
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-primary" />,
      title: "Performance-obsessed problem solving",
      items: [
        "5 years data analysis & trading mastery",
        "Built custom AI tools for trading performance",
        "Live coaching and feedback systems",
        "Custom TradingView code for data automation"
      ]
    },
    {
      icon: <Briefcase className="w-6 h-6 text-primary" />,
      title: "Done-for-you automation, not more tools",
      items: [
        "Built complete AI agency infrastructure",
        "Lead enrichment systems for HubSpot clients",
        "Developed scraping tools and business automation",
        "Combined automation with data analysis expertise"
      ]
    },
    {
      icon: <Rocket className="w-6 h-6 text-accent" />,
      title: "Where Lead Awaker is going next",
      items: [
        "Founded TA Monks (4 years) with wife Danique",
        "Transitioned to building Lead Awaker",
        "Goal: Scale to $100M ARR"
      ]
    }
  ];

  const faqs = [
    {
      q: "What's the setup time?",
      a: "Most setups take 2–5 days depending on your CRM and list size. You keep running your business; the team handles the integrations and workflows for you."
    },
    {
      q: "Do you support our CRM?",
      a: "We integrate with Salesforce, HubSpot, Pipedrive, Close, and custom APIs. If it has an API, we can connect to it."
    },
    {
      q: "How much does it cost?",
      a: "Pricing starts from a simple, custom quote. Most clients choose a performance‑based model tied to reactivated revenue, with no upfront setup fees."
    }
  ];

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6">
        
        {/* 1. Intro Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto text-center mb-16"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-primary mb-3 uppercase">
            About Lead Awaker
          </p>
          <h1 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">
            What we are about
          </h1>
          
          <div className="mb-12">
            <LeadReactivationAnimation />
          </div>

          <div className="space-y-6 max-w-4xl mx-auto text-left">
            <p className="text-xl text-muted-foreground leading-relaxed">
              You spend time, money, and effort building your business so you can help people in your own particular way. Yet you still end up pouring huge amounts of energy just trying to get your clients' attention back on your brand.
            </p>
            <p className="text-xl text-muted-foreground leading-relaxed">
              They showed interest, then life got in the way. All that energy gets diluted as their attention drifts somewhere else.
            </p>
            <p className="text-xl text-muted-foreground leading-relaxed">
              At Lead Awaker, the belief is that your energy should go into what you excel at: delivering the quality service you already provide. The job here is to help you harness the power of attention.
            </p>
            <p className="text-xl text-muted-foreground leading-relaxed">
              For your brand to mean something valuable to a lead, that person has to be treated as an individual first, not as a line in a spreadsheet. When they are approached in a way that respects their timing, context, and preferences, they feel understood, and when they feel understood, they are finally in the right place to understand you.
            </p>
          </div>
        </motion.div>

        {/* 2. Meet the Founder */}
        <div className="grid md:grid-cols-3 gap-12 items-start mb-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="md:col-span-1 text-center sticky top-32"
          >
            <div className="flex justify-center mb-6">
              <AnimatedLogo3D />
            </div>
            <h2 className="text-2xl font-bold">Gabriel Fronza</h2>
            <p className="text-muted-foreground">Founder & Tech Lead</p>
          </motion.div>

          <div className="md:col-span-2 grid sm:grid-cols-2 gap-4">
            {sections.map((section, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-4 bg-primary/10 w-fit p-2 rounded-lg">{section.icon}</div>
                <h3 className="text-lg font-bold mb-3 leading-tight">{section.title}</h3>
                <ul className="space-y-2">
                  {section.items.map((item, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2 leading-relaxed">
                      <span className="text-primary mt-1 flex-shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <hr className="border-border mb-20" />
        </div>

        {/* 5. FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto mb-24"
        >
          <div className="bg-card/50 border border-border rounded-3xl p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-10 text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-border rounded-2xl overflow-hidden bg-background"
                >
                  <button
                    onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                    className="w-full flex items-center justify-between p-6 hover:bg-muted/50 transition-colors group"
                  >
                    <h3 className="text-lg font-bold text-left group-hover:text-primary transition-colors">{faq.q}</h3>
                    <ChevronDown
                      className={`w-5 h-5 text-primary transition-transform duration-300 ${
                        openFAQ === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFAQ === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-6 pb-6 text-muted-foreground border-t border-border pt-4"
                    >
                      <p className="text-base leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
