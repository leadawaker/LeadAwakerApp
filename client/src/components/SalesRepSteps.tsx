import React, { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, MessageSquare, TrendingUp, Server, MessageCircle, Mail, Calendar, Box, Copy, TrendingDown } from "lucide-react";
import databaseIntegrationImg from "@assets/generated_images/database_upload_and_crm_integration.png";
import womanPhoneImg from "@assets/woman_answering_phone_in_living_room_1766483592249.png";
import dailyLeadsImg from "@assets/generated_images/daily_leads_closed_chart_dashboard.png";
import { MeteorContainer } from "./Meteor";

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

const Plane = () => {
  return (
    <motion.div
      initial={{
        top: "8%",
        left: "105%"
      }}
      animate={{
        top: "28%",
        left: "-5%"
      }}
      transition={{
        duration: 40,
        ease: "linear",
        repeat: Infinity
      }}
      className="absolute w-2 h-2 z-20 pointer-events-none"
    >
      <motion.div
        animate={{
          opacity: [0, 1, 1, 0, 1, 1, 0],
          backgroundColor: ["#000000", "#ffffff", "#ffffff", "#000000", "#ff0000", "#ff0000", "#000000"],
          boxShadow: [
            "0 0 10px 3px transparent",
            "0 0 10px 3px #ffffff",
            "0 0 10px 3px #ffffff",
            "0 0 10px 3px transparent",
            "0 0 10px 3px #ff0000",
            "0 0 10px 3px #ff0000",
            "0 0 10px 3px transparent"
          ]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          times: [0, 0.01, 0.25, 0.5, 0.51, 0.75, 1]
        }}
        className="rounded-full"
        style={{
          width: "2px",
          height: "2px"
        }}
      />
    </motion.div>
  );
};

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
  const cardOpacity = useTransform(scrollYProgress, [-0.2, 0.4, 2], [0, 1, 1]);
  const cardY = useTransform(scrollYProgress, [-0.2, 0.4], [50, 0]);
  const imageOpacity = useTransform(scrollYProgress, [-0.2, 0.4], [0, 1]);

  const isLeft = align === "left";

  return (
    <div ref={containerRef} className="h-[80vh] w-full flex items-center justify-center px-4 md:px-12 relative z-10">
      <div className="container mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
        <motion.div 
          style={{ opacity: cardOpacity, y: cardY, transform: 'translateZ(0)' }}
          className={`order-2 ${isLeft ? "md:order-1" : "md:order-2"}`}
        >
          <div className="relative">
            <div className={`absolute top-1/2 -translate-y-1/2 w-16 h-[2px] bg-primary/30 hidden md:block ${isLeft ? "-right-16" : "-left-16"}`} />
            <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary hidden md:block ${isLeft ? "-right-18 translate-x-2" : "-left-18 -translate-x-2"}`} />
            <Badge className="mb-4 bg-orange-600 text-white hover:bg-orange-700 text-lg px-3 py-1 rounded-full w-10 h-10 flex items-center justify-center" data-testid={`step-badge-${number}`}>
              {number}
            </Badge>
            
            <Card className="bg-card backdrop-blur-sm border-white/10 overflow-hidden group hover:border-primary/50 transition-colors duration-500">
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
          style={{ opacity: imageOpacity, transform: 'translateZ(0)' }}
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
              <span className="text-accent font-mono text-sm uppercase tracking-wider mb-2 block">Step {number} Details</span>
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
  const [glitchAnimating, setGlitchAnimating] = useState(false);

  return (
    <div 
      ref={scrollRef} 
      className="bg-slate-950 text-foreground overflow-hidden selection:bg-primary/30 relative"
      style={{ minHeight: '100%' }}
    >
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `radial-gradient(circle at 23% 45%, white 0.9px, transparent 0.9px),
                            radial-gradient(circle at 68% 12%, white 1.8px, transparent 1.8px),
                            radial-gradient(circle at 42% 28%, white 1.2px, transparent 1.2px),
                            radial-gradient(circle at 85% 52%, white 1.2px, transparent 1.2px),
                            radial-gradient(circle at 15% 61%, white 0.9px, transparent 0.9px),
                            radial-gradient(circle at 72% 38%, white 1.2px, transparent 1.2px),
                            radial-gradient(circle at 38% 8%, white 0.9px, transparent 0.9px),
                            radial-gradient(circle at 91% 71%, white 1.2px, transparent 1.2px)`,
          backgroundRepeat: 'repeat',
          backgroundSize: '450px 380px',
          filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
          animation: 'twinkle-fast 0.8s ease-in-out infinite',
          animationDelay: '0s'
        }}
      />
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `radial-gradient(circle at 57% 22%, #e8e8e8 1.5px, transparent 1.5px),
                            radial-gradient(circle at 29% 15%, white 1.2px, transparent 1.2px),
                            radial-gradient(circle at 76% 55%, white 0.9px, transparent 0.9px),
                            radial-gradient(circle at 11% 67%, #e8e8e8 2.25px, transparent 2.25px),
                            radial-gradient(circle at 64% 79%, white 0.9px, transparent 0.9px),
                            radial-gradient(circle at 47% 45%, #f0f0f0 1.5px, transparent 1.5px),
                            radial-gradient(circle at 85% 8%, #e8e8e8 1.5px, transparent 1.5px),
                            radial-gradient(circle at 36% 88%, #f0f0f0 1.5px, transparent 1.5px)`,
          backgroundRepeat: 'repeat',
          backgroundSize: '450px 380px',
          filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
          animation: 'twinkle-fast-offset-1 1s ease-in-out infinite',
          animationDelay: '0.5s',
          opacity: 0.7
        }}
      />
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `radial-gradient(circle at 19% 19%, white 0.9px, transparent 0.9px),
                            radial-gradient(circle at 73% 33%, #f0f0f0 2.25px, transparent 2.25px),
                            radial-gradient(circle at 54% 61%, white 1.2px, transparent 1.2px),
                            radial-gradient(circle at 31% 74%, white 1.2px, transparent 1.2px),
                            radial-gradient(circle at 92% 47%, white 0.9px, transparent 0.9px),
                            radial-gradient(circle at 67% 82%, white 1.2px, transparent 1.2px),
                            radial-gradient(circle at 44% 14%, #e8e8e8 1.5px, transparent 1.5px),
                            radial-gradient(circle at 10% 51%, white 0.9px, transparent 0.9px)`,
          backgroundRepeat: 'repeat',
          backgroundSize: '450px 380px',
          filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
          animation: 'twinkle-fast-offset-2 0.9s ease-in-out infinite',
          animationDelay: '1.2s',
          opacity: 0.6
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 200% 250% at 50% 120%, rgba(240, 235, 190, 1) 0%, rgba(255, 230, 100, 1) 12%, rgba(255, 180, 60, 1) 25%, rgba(120, 100, 180, 0.9) 40%, rgba(0, 0, 0, 1) 60%)',
        zIndex: 0
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 300% 80% at 50% 64%, transparent 0%, transparent 44%, rgba(100, 180, 255, 0.55) 46%, rgba(80, 160, 240, 0.5) 48%, rgba(60, 140, 220, 0.45) 54%, transparent 56%, transparent 100%)',
        zIndex: 1
      }} />
      <Plane />
      <div className="relative z-10">
      {/* Pain Points Section */}
      <section className="py-32 md:py-40">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            onViewportEnter={() => setGlitchAnimating(true)}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="text-center max-w-4xl mx-auto mb-24"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 drop-shadow-lg">
              <span style={{ 
                backgroundImage: 'linear-gradient(to right, #FFFFFF 0%, #FFFFFF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                display: 'inline-block',
                filter: 'drop-shadow(4px 0px 15px rgba(128, 128, 128, 0.15)) drop-shadow(2px 0px 5px rgba(128, 128, 128, 0.1))',
                textShadow: '3px 0px 6px rgba(128, 128, 128, 0.12)'
              }}>
                Manual reactivation
              </span>
              {' '}
              <span style={{ 
                backgroundImage: 'linear-gradient(to right, #FFFFFF 0%, #FEC966 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                display: 'inline-block',
                marginRight: '0.24em',
                filter: 'drop-shadow(8px 0px 30px rgba(254, 201, 102, 0.4)) drop-shadow(4px 0px 10px rgba(254, 201, 102, 0.25))',
                textShadow: '6px 0px 12px rgba(254, 201, 102, 0.3)'
              }}>
                is
              </span>
              <span 
                className={`hologram-glitch ${glitchAnimating ? 'animate' : ''}`}
                data-testid="text-broken"
              >
                bro<span className="flicker-letter">k</span>en
              </span>
              <span style={{ 
                color: '#FED966',
                filter: 'drop-shadow(10px 0px 40px rgba(254, 184, 0, 0.55)) drop-shadow(5px 0px 10px rgba(254, 184, 0, 0.4))',
                textShadow: '8px 0px 15px rgba(254, 184, 0, 0.4), 12px 0px 25px rgba(254, 184, 0, 0.25)',
                display: 'inline-block'
              }} data-testid="text-dot">.</span>
            </h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.08,
                  delayChildren: 0.1,
                }
              }
            }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24"
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
                initial={{ borderColor: 'rgb(249, 115, 22)' }}
                animate={{ borderColor: 'rgb(59, 130, 246)' }}
                transition={{ delay: i * 0.08 + 0.1 + 0.8, duration: 0.5 }}
                className="group relative bg-gradient-to-br from-slate-800/80 to-slate-800/60 border backdrop-blur-sm p-8 rounded-2xl text-center transition-all duration-400 cursor-default overflow-hidden shadow-lg shadow-primary/20"
                style={{
                  borderColor: 'rgb(59, 130, 246)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgb(234, 152, 44)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 25px 50px -12px rgba(234, 152, 44, 0.35), 0 25px 50px -12px rgba(234, 152, 44, 0.35)';
                  const icon = (e.currentTarget as HTMLElement).querySelector('[data-testid="pain-icon"]') as HTMLElement;
                  if (icon) icon.style.color = 'rgb(234, 152, 44)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgb(59, 130, 246)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 15px -3px rgba(59, 130, 246, 0.2), 0 10px 15px -3px rgba(59, 130, 246, 0.2)';
                  const icon = (e.currentTarget as HTMLElement).querySelector('[data-testid="pain-icon"]') as HTMLElement;
                  if (icon) icon.style.color = 'rgb(59, 130, 246)';
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-orange-500/5 group-hover:to-orange-500/10 transition-all duration-400" style={{ background: 'linear-gradient(135deg, transparent 0%, transparent 100%)' }} />
                <div className="relative z-10">
                  <div className="text-primary mb-4 transform group-hover:scale-125 transition-all duration-400 inline-flex items-center justify-center" style={{ color: 'rgb(59, 130, 246)' }} data-testid="pain-icon">{pain.icon}</div>
                  <p className="text-sm font-semibold text-white transition-all duration-400 leading-relaxed">{pain.title}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center max-w-2xl mx-auto"
          >
            <p className="text-accent text-xl font-medium tracking-wide">Companies have invested <span className="font-bold">THOUSANDS</span> in acquiring these leads, but they're leaving <span className="font-bold">MILLIONS</span> on the table because reactivation is too painful and ineffective.</p>
          </motion.div>
        </div>
      </section>

      {/* Meteor Section */}
      <section className="relative overflow-hidden" style={{ height: '8vh' }}>
        <MeteorContainer />
      </section>

      {/* Intro Section */}
      <section className="flex items-center justify-center relative overflow-hidden" style={{ height: '15vh' }}>
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center relative z-10"
          data-testid="sales-rep-intro"
        >
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-white drop-shadow-lg">
            Your Expert Sales Rep in 3 Steps.
          </h1>
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
      <div style={{ marginTop: "-40vh" }}>
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
      <div style={{ marginTop: "-40vh" }}>
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
