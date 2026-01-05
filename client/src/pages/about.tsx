import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Rocket, Target, Code2, TrendingUp, Briefcase, ChevronDown } from "lucide-react";
import AnimatedLogo3D from "@/components/AnimatedLogo3D";
import LeadReactivationAnimation from "@/components/LeadReactivationAnimation";

const CyclingWord = ({ words, duration = 3000 }: { words: string[], duration?: number }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, duration);
    return () => clearInterval(timer);
  }, [words, duration]);

  return (
    <span className="inline-flex min-w-[8rem]">
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="text-primary font-bold"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

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
      q: "What if our leads are really old or completely cold?",
      a: "Age isn't the main factor; relevance is. Leads from 6 months or even 2 years ago can still convert if the original pain point remains and the outreach feels personal. The system identifies who's still in market based on engagement signals, not just database age."
    },
    {
      q: "Will this work with our industry/niche?",
      a: "Lead Awaker is built channel-agnostic and adapts to your specific sales process, whether you're in life insurance, fitness coaching, legal services, or B2B consulting. The AI learns your terminology, objections, and conversion patterns during setup."
    },
    {
      q: "How do you avoid coming across as spam or pushy?",
      a: "Every message is personalized based on where the lead left off in your funnel, uses natural language (not robotic templates), and respects opt-out signals immediately. The goal is to feel like a helpful follow-up from your team, not a blast campaign."
    },
    {
      q: "Do we need to provide scripts or does the AI write everything?",
      a: "You provide examples of your best-performing conversations and key talking points; the AI adapts those into natural, individualized messages. You approve the tone during setup, and the system learns what converts over time."
    },
    {
      q: "What channels do you use to re-engage leads?",
      a: "Email, SMS, WhatsApp, and Telegram depending on your audience and compliance requirements. SMS often gets 98% open rates vs. 15-25% for email, so the system prioritizes the channel most likely to get attention without being intrusive."
    },
    {
      q: "How do you handle compliance (GDPR, CAN-SPAM, CCPA)?",
      a: "All outreach respects existing opt-in records, includes clear unsubscribe options, and logs consent by channel. If a lead opted into email but not SMS, they're only contacted via email. Compliance is built into the workflow, not bolted on."
    },
    {
      q: "What happens when a lead responds?",
      a: "The AI qualifies their interest level and either books a call directly into your calendar, hands off to your sales team with context, or continues nurturing based on readiness signals. You define the handoff criteria during setup."
    },
    {
      q: "Can we pause or adjust campaigns mid-run?",
      a: "Yes. You can pause outreach, update messaging, or adjust targeting rules anytime through the dashboard. Changes take effect immediately without losing progress on active conversations."
    },
    {
      q: "What results can we realistically expect?",
      a: "Most clients see 8-15% of dormant leads re-engage within the first 30 days, with 20-40% of those converting into booked calls or purchases. Results depend on list quality, offer fit, and how long leads have been dormant, but even a 5% reactivation rate pays for itself quickly."
    }
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 text-center">
      <div className="container mx-auto px-4 md:px-6">
        
        {/* 1. Intro Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-16"
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mt-[10px] mb-0 text-center">What we care about</h1>
          
          <div className="mb-0 p-0 flex justify-center">
            <LeadReactivationAnimation />
          </div>

          <div className="space-y-6 w-full text-left mt-0 p-0">
            <p className="text-xl text-muted-foreground leading-relaxed text-left">
              You spend time, money, and effort building your business, yet so much of that energy goes into just getting your clients' attention back. They showed interest, then life got in the way.
            </p>
            <p className="text-xl text-muted-foreground leading-relaxed text-left">
              At Lead Awaker, the belief is that your energy should go into what you excel at: delivering the quality service you already provide. The job here is to help you harness the power of attention.
            </p>
            <p className="text-xl text-muted-foreground leading-relaxed text-left">
              For your brand to mean something valuable to a lead, that person has to be treated as an individual first, not as a line in a spreadsheet. When they are approached in a way that respects their timing, context, and preferences, they feel understood, and when they feel understood, they are finally awake to understand <span className="text-primary font-bold">you</span><CyclingWord words={[".", "r company.", "r brand.", "r services.", "r products.", "r story.", "r values."]} />
            </p>
          </div>
        </motion.div>

        {/* 2. Meet the Founder */}
        <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] mr-[50vw] bg-[#E5E7EB] py-24 mb-20 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="container mx-auto px-4 md:px-6 relative text-left">
            <div className="max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <div className="relative group">
                  <div className="absolute -inset-4 bg-primary/5 rounded-[2rem] blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
                  <div className="relative bg-white/40 backdrop-blur-sm p-8 md:p-12 rounded-[2rem] border border-white/50 shadow-xl flex flex-col md:flex-row items-center gap-12">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                      <div className="w-64 h-64 md:w-80 md:h-80">
                        <AnimatedLogo3D />
                      </div>
                    </div>
                    <div className="flex-grow space-y-6">
                      <div className="space-y-1">
                        <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Gabriel B. Fronza</h3>
                        <div className="flex items-center gap-2">
                          <div className="h-[1px] w-4 bg-primary/50" />
                          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Founder</p>
                          <div className="h-[1px] w-4 bg-primary/50" />
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <p className="text-xl text-gray-800 font-medium leading-relaxed italic border-l-4 border-primary/30 pl-6">
                          "I kept seeing the same problem, businesses stuck wasting their money on more ads instead of waking up the leads they already paid for."
                        </p>
                        <p className="text-lg text-gray-600 leading-relaxed font-light">Lead Awaker is the result of 10+ years building production software, 5 years obsessing over data and automation systems, 4 years running a business with wife Danique.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <hr className="border-border mb-20" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto mb-24"
        >
          <div className="bg-card/50 border border-border rounded-3xl p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-10 text-left">Frequently Asked Questions</h2>
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
