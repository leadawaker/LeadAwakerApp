import { motion } from "framer-motion";
import { CheckCircle2, Users, Rocket, Target } from "lucide-react";
import profilePhoto from "@assets/Screenshot_20251219_160952_ChatGPT_1766322249853.jpg";
import mainLogo from "@assets/Project_(20251219120952)_1766322389784.jpg";

export default function About() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-6"
          >
            About Lead Awaker
          </motion.h1>
          <p className="text-xl text-muted-foreground">
            We are an AI automation agency dedicated to unlocking hidden revenue in your business.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
          <motion.div
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.2 }}
          >
            <img 
              src={profilePhoto} 
              alt="Lead Awaker Founder" 
              className="rounded-2xl shadow-2xl border border-border w-full"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              Most businesses sit on a goldmine of unconverted leads. You paid for them, they showed interest, but life got in the way.
            </p>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              At Lead Awaker, we believe you shouldn't have to keep spending more on ads to get new sales. Our mission is to reactivate your existing database using intelligent, human-like AI conversations that convert at scale.
            </p>
            
            <div className="space-y-4">
              {[
                "Data-Driven Approach",
                "Advanced AI Technology",
                "Results-Oriented Strategy",
                "Seamless Integration"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="text-primary w-5 h-5" />
                  <span className="font-medium">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Values Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Users className="w-10 h-10 text-accent" />,
              title: "Customer First",
              desc: "We prioritize your customer's experience, ensuring every AI interaction feels personal and helpful."
            },
            {
              icon: <Target className="w-10 h-10 text-primary" />,
              title: "Precision Targeting",
              desc: "We don't just blast messages. We target specific segments of your list with relevant offers."
            },
            {
              icon: <Rocket className="w-10 h-10 text-accent" />,
              title: "Rapid Growth",
              desc: "Our goal is to add significant revenue to your bottom line within the first 30 days."
            }
          ].map((val, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + (i * 0.1) }}
              className="bg-muted/30 p-8 rounded-2xl border border-border"
            >
              <div className="mb-6">{val.icon}</div>
              <h3 className="text-xl font-bold mb-3">{val.title}</h3>
              <p className="text-muted-foreground">{val.desc}</p>
            </motion.div>
          ))}
        </div>

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
