import { motion } from "framer-motion";
import { Users, Rocket, Target, Code2, TrendingUp, Briefcase } from "lucide-react";
import profilePhoto from "@assets/Screenshot_20251219_160952_ChatGPT_1766322249853.jpg";
import mainLogo from "@assets/Project_(20251219120952)_1766322389784.jpg";

export default function About() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6">
        {/* Meet the Founder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-2">Meet the Founder</h1>
          <p className="text-xl text-accent font-semibold mb-12">Gabriel Fronza</p>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-16"
          >
            <img 
              src={profilePhoto} 
              alt="Gabriel Fronza, Founder" 
              className="rounded-2xl shadow-2xl border border-border w-72 h-72 object-cover mx-auto"
            />
          </motion.div>
        </motion.div>

        {/* Background Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
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
                "Founded TA Monks (4 years) with wife Denisse",
                "Transitioned to building Lead Awaker",
                "Inspired by proven frameworks: $100M",
                "Offers and Instant AI Agency",
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
              className="bg-card p-6 rounded-2xl border border-border"
            >
              <div className="mb-4">{section.icon}</div>
              <h3 className="text-lg font-bold mb-4">{section.title}</h3>
              <ul className="space-y-2">
                {section.items.map((item, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
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

        {/* Logo Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 pt-24 border-t border-border text-center"
        >
          <h3 className="text-sm font-semibold text-muted-foreground mb-8 uppercase tracking-wide">Powered by Lead Awaker</h3>
          <img 
            src={mainLogo} 
            alt="Lead Awaker Logo" 
            className="w-64 mx-auto drop-shadow-lg"
          />
        </motion.div>
      </div>
    </div>
  );
}
