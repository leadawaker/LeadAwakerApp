import { motion } from "framer-motion";
import { Users, Rocket, Target, Code2, TrendingUp, Briefcase } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6">
        {/* Meet the Founder - Split Layout */}
        <div className="grid md:grid-cols-3 gap-12 items-start mb-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="md:col-span-1 text-center"
          >
            <h2 className="text-2xl font-bold">Gabriel Fronza</h2>
          </motion.div>

          {/* Background Grid - Condensed */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
          {[
            {
              icon: <Code2 className="w-6 h-6 text-primary" />,
              title: "Software Development",
              items: [
                "10 years software development experience",
                "Worked at Framestore, Sega, New World Interactive",
                "Shipped 5 video games and 1 major motion picture",
                "Tom & Jerry movie $316M gross revenue",
                "Insurgency: Sandstorm: $52M revenue"
              ]
            },
            {
              icon: <TrendingUp className="w-6 h-6 text-primary" />,
              title: "Data Analysis & Trading",
              items: [
                "5 years data analysis & trading mastery",
                "Built custom AI tools for trading performance",
                "Live coaching and feedback systems",
                "Automated weekly/monthly performance reports",
                "Custom TradingView code for data automation",
                "Created Telegram trading bot for personal use"
              ]
            },
            {
              icon: <Briefcase className="w-6 h-6 text-primary" />,
              title: "AI Automation",
              items: [
                "Built complete AI agency infrastructure",
                "Lead enrichment systems for HubSpot clients",
                "Developed scraping tools and business automation",
                "Self-taught no-code/low-code AI development",
                "Combined automation with data analysis expertise"
              ]
            },
            {
              icon: <Rocket className="w-6 h-6 text-accent" />,
              title: "Current Focus",
              items: [
                "Founded TA Monks (4 years) with wife Danique",
                "Transitioned to building Lead Awaker",
                "Goal: Scale to $100M ARR"
              ]
            }
          ].map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card p-4 rounded-xl border border-border"
            >
              <div className="mb-3">{section.icon}</div>
              <h3 className="text-base font-bold mb-3">{section.title}</h3>
              <ul className="space-y-1">
                {section.items.map((item, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
          </div>
        </div>

        {/* Mission Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto mb-24"
        >
          <h2 className="text-3xl font-bold mb-8 text-center">Our Mission</h2>
          <div className="space-y-6 text-lg text-muted-foreground">
            <p>
              Most businesses sit on a goldmine of unconverted leads. You paid for them, they showed interest, but life got in the way.
            </p>
            <p>
              At Lead Awaker, we believe you shouldn't have to keep spending more on ads to get new sales. Our mission is to reactivate your existing database using intelligent, human-like AI conversations that convert at scale.
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
