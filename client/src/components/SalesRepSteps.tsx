import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, MessageSquare, TrendingUp, Server, MessageCircle, Mail, Calendar, Box, Copy, TrendingDown } from "lucide-react";
import databaseIntegrationImg from "@assets/generated_images/database_upload_and_crm_integration.png";
import womanPhoneImg from "@assets/woman_answering_phone_in_living_room_1766483592249.png";
import dailyLeadsImg from "@assets/generated_images/daily_leads_closed_chart_dashboard.png";

interface StepProps {
  number: string;
  cardTitle: string;
  cardDescription: string;
  overlayTitle: string;
  overlayDescription: string;
  image: string;
  icon: React.ReactNode;
  align?: "left" | "right";
}

const FullscreenStep = ({
  number,
  cardTitle,
  cardDescription,
  overlayTitle,
  overlayDescription,
  image,
  icon,
  align = "left",
}: StepProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "center center"],
  });

  const overlayOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1]);
  const overlayTextY = useTransform(scrollYProgress, [0.3, 0.7], [20, 0]);
  const cardOpacity = useTransform(scrollYProgress, [-0.2, 0.4], [0, 1]);
  const cardY = useTransform(scrollYProgress, [-0.2, 0.4], [50, 0]);
  const imageOpacity = useTransform(scrollYProgress, [-0.2, 0.4], [0, 1]);

  const isLeft = align === "left";

  return (
    <div ref={containerRef} className="h-[80vh] w-full flex items-center justify-center px-4 md:px-12 relative z-10">
      <div className="container mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
        <motion.div 
          style={{ opacity: cardOpacity, y: cardY }}
          className={`order-2 ${isLeft ? "md:order-1" : "md:order-2"}`}
        >
          <div className="relative">
            <div className={`absolute top-1/2 -translate-y-1/2 w-16 h-[2px] bg-primary/30 hidden md:block ${isLeft ? "-right-16" : "-left-16"}`} />
            <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary hidden md:block ${isLeft ? "-right-18 translate-x-2" : "-left-18 -translate-x-2"}`} />
            <Badge className="mb-4 bg-orange-600 text-white hover:bg-orange-700 text-lg px-3 py-1 rounded-full w-10 h-10 flex items-center justify-center" data-testid={`step-badge-${number}`}>
              {number}
            </Badge>
            
            <Card className="bg-card/50 backdrop-blur-sm border-white/10 overflow-hidden group hover:border-primary/50 transition-colors duration-500">
              <CardContent className="p-8">
                <div className="mb-6 p-3 bg-primary/10 w-fit rounded-xl text-primary" data-testid={`step-icon-${number}`}>
                  {icon}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight text-black" data-testid={`step-title-${number}`}>{cardTitle}</h3>
                <p className="text-muted-foreground text-lg leading-relaxed" data-testid={`step-description-${number}`}>
                  {cardDescription}
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
        <motion.div 
          style={{ opacity: imageOpacity }}
          className={`order-1 ${isLeft ? "md:order-2" : "md:order-1"} relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-white/5`}
          data-testid={`step-image-${number}`}
        >
          <img 
            src={image} 
            alt={cardTitle} 
            className="w-full h-full object-cover"
          />
          <motion.div 
            style={{ opacity: overlayOpacity }}
            className="absolute inset-0 bg-blue-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div style={{ y: overlayTextY }}>
              <span className="text-primary font-mono text-sm uppercase tracking-wider mb-2 block">Step {number} Details</span>
              <h4 className="text-3xl font-bold text-white mb-4">{overlayTitle}</h4>
              <p className="text-gray-200 text-lg max-w-md mx-auto leading-relaxed">
                {overlayDescription}
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export const SalesRepSteps = () => {
  const scrollRef = useRef(null);

  return (
    <div 
      ref={scrollRef} 
      className="min-h-screen bg-gradient-to-b from-slate-950 via-orange-400 to-blue-600 text-foreground overflow-x-hidden selection:bg-primary/30 relative"
    >
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `radial-gradient(circle at 11% 19%, white 1px, transparent 1px),
                            radial-gradient(circle at 34% 8%, #e8e8e8 1.25px, transparent 1.25px),
                            radial-gradient(circle at 51% 31%, white 0.75px, transparent 0.75px),
                            radial-gradient(circle at 73% 14%, white 1px, transparent 1px),
                            radial-gradient(circle at 89% 42%, #f0f0f0 1.25px, transparent 1.25px),
                            radial-gradient(circle at 19% 48%, white 0.75px, transparent 0.75px),
                            radial-gradient(circle at 62% 55%, white 1px, transparent 1px),
                            radial-gradient(circle at 8% 71%, #e8e8e8 1.25px, transparent 1.25px),
                            radial-gradient(circle at 44% 67%, white 1px, transparent 1px),
                            radial-gradient(circle at 81% 78%, white 0.75px, transparent 0.75px),
                            radial-gradient(circle at 29% 91%, #f0f0f0 1.25px, transparent 1.25px),
                            radial-gradient(circle at 97% 25%, white 1px, transparent 1px),
                            radial-gradient(circle at 56% 9%, white 0.75px, transparent 0.75px),
                            radial-gradient(circle at 21% 38%, #e8e8e8 1.25px, transparent 1.25px),
                            radial-gradient(circle at 74% 63%, white 1px, transparent 1px),
                            radial-gradient(circle at 14% 84%, #f0f0f0 1.25px, transparent 1.25px),
                            radial-gradient(circle at 38% 51%, white 0.75px, transparent 0.75px)`,
          backgroundRepeat: 'repeat',
          backgroundSize: '450px 380px',
          filter: 'drop-shadow(0 0 12px rgba(255,255,255,1)) drop-shadow(0 0 6px rgba(255,255,255,0.8))'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-400/70 via-[50%] to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-[65%] to-blue-600/50" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-sky-300/20 mix-blend-multiply" />
      <div className="relative z-10">
      {/* Pain Points Section */}
      <section className="py-32 md:py-40">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.25)) drop-shadow(0 0 35px rgba(249, 115, 22, 0.25))' }}>Manual reactivation is broken.</h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={{
              hidden: { opacity: 1 },
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
                  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, type: "spring", stiffness: 100, damping: 15 } }
                }}
                className="group relative bg-gradient-to-br from-slate-800/80 to-slate-800/60 border border-primary/40 backdrop-blur-sm p-8 rounded-2xl text-center hover:border-primary/60 transition-all duration-400 cursor-default overflow-hidden shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/40"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/10 transition-all duration-400" />
                <div className="relative z-10">
                  <div className="text-primary mb-4 transform group-hover:scale-125 transition-transform duration-400 inline-flex items-center justify-center">{pain.icon}</div>
                  <p className="text-sm font-semibold text-white leading-relaxed">{pain.title}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-slate-800/80 border border-primary/40 backdrop-blur-sm p-8 rounded-2xl text-center max-w-2xl mx-auto shadow-lg shadow-primary/20"
          >
            <p className="text-base font-semibold text-white leading-relaxed">Companies have invested <span className="font-bold">THOUSANDS</span> in acquiring these leads, but they're leaving <span className="font-bold">MILLIONS</span> on the table because reactivation is too painful and ineffective.</p>
          </motion.div>
        </div>
      </section>

      {/* Intro Section */}
      <section className="flex items-center justify-center relative overflow-hidden mt-24" style={{ height: '15vh' }}>
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-center relative z-10"
          data-testid="sales-rep-intro"
        >
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-white drop-shadow-lg">
            Your Expert Sales Rep in 3 Steps.
          </h1>
          <p className="text-accent text-xl font-medium tracking-wide">
            Dead leads <span className="opacity-50">→</span> revenue.
          </p>
        </motion.div>
      </section>

      {/* Step 1 */}
      <FullscreenStep 
        number="1"
        cardTitle="Upload database"
        cardDescription="AI instantly IDs high-potential dormant leads."
        overlayTitle="Your existing stack becomes an automation powerhouse."
        overlayDescription="CRM / Databases, WhatsApp, SMS & Chat, Email Platforms, Calendar Apps"
        image={databaseIntegrationImg}
        icon={<Database className="w-8 h-8" />}
        align="left"
      />

      {/* Step 2 */}
      <div style={{ marginTop: "-10%" }}>
        <FullscreenStep 
          number="2"
          cardTitle="Chat GPT-5.2 conversations"
          cardDescription="Natural, contextual SMS (not robot templates)."
          overlayTitle="Build the Automations"
          overlayDescription="Set up AI agents, workflows, and integrations in minutes."
          image={womanPhoneImg}
          icon={<MessageSquare className="w-8 h-8" />}
          align="right"
        />
      </div>

      {/* Step 3 */}
      <div style={{ marginTop: "-10%" }}>
        <FullscreenStep 
          number="3"
          cardTitle="Revenue rolls in"
          cardDescription="Auto-books meetings 24/7."
          overlayTitle="Optimize Weekly"
          overlayDescription="Monitor performance and continuously improve conversion rates."
          image={dailyLeadsImg}
          icon={<TrendingUp className="w-8 h-8" />}
          align="left"
        />
      </div>
      </div>
    </div>
  );
};

export default SalesRepSteps;
