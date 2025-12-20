import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, Database, Zap, MessageSquare, RefreshCcw } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen pt-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden pb-20 md:pb-32">
        <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent blur-3xl opacity-50" />
        
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent font-medium text-sm mb-6 border border-accent/20">
                <Zap className="w-4 h-4" />
                <span>AI Automation Agency</span>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 text-foreground">
                Wake Up Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  Dormant Leads
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg leading-relaxed">
                Pull fresh sales from leads you’ve already paid for and haven’t bought, using conversational AI.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/book-demo">
                  <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white">
                    Start Reactivation
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/services">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-2">
                    Explore Services
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative aspect-square md:aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl bg-white border border-border p-6 md:p-8 flex flex-col justify-center">
                {/* Mock Chat Interface */}
                <div className="flex flex-col gap-4 max-w-sm mx-auto w-full">
                  <div className="flex gap-3 items-end">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Bot size={16} />
                    </div>
                    <div className="bg-muted p-4 rounded-2xl rounded-bl-none text-sm text-foreground shadow-sm">
                      Hi John! I noticed you were interested in our services last month but we never connected. Are you still looking for help with automation?
                    </div>
                  </div>
                  
                  <div className="flex gap-3 items-end flex-row-reverse">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 shrink-0">
                      <span className="text-xs font-bold">JD</span>
                    </div>
                    <div className="bg-primary p-4 rounded-2xl rounded-br-none text-sm text-white shadow-md">
                      Hey! Yes actually, I've just been super busy. Can we chat?
                    </div>
                  </div>

                  <div className="flex gap-3 items-end">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Bot size={16} />
                    </div>
                    <div className="bg-muted p-4 rounded-2xl rounded-bl-none text-sm text-foreground shadow-sm animate-pulse">
                      typing...
                    </div>
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section Preview */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Database Reactivation</h2>
            <p className="text-muted-foreground text-lg">
              Stop burning money on new ads. Your next best customer is already sitting in your database.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Database className="w-8 h-8 text-primary" />,
                title: "Data Audit",
                desc: "We analyze your existing lead database to identify dormant opportunities."
              },
              {
                icon: <MessageSquare className="w-8 h-8 text-accent" />,
                title: "Conversational AI",
                desc: "Our AI initiates natural, personalized conversations to re-engage old leads."
              },
              {
                icon: <RefreshCcw className="w-8 h-8 text-primary" />,
                title: "Instant Reactivation",
                desc: "Turn 'dead' leads into booked appointments and fresh sales automatically."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card p-8 rounded-2xl border border-border hover:shadow-lg transition-shadow"
              >
                <div className="mb-6 p-4 rounded-2xl bg-background w-fit border border-border/50 shadow-sm">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Teaser Section */}
      <section className="py-24 relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-8">Ready to awake your leads?</h2>
          <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">
            Book a demo to see how our AI can add 20-30% more revenue to your bottom line this month.
          </p>
          
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl max-w-3xl mx-auto border border-white/20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-left">
                <h3 className="text-xl font-bold mb-2">Interactive Demo</h3>
                <p className="opacity-80">Do you already have a booking link?</p>
              </div>
              <Link href="/book-demo">
                <Button size="lg" variant="secondary" className="whitespace-nowrap font-bold text-primary">
                  Let's find out <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
