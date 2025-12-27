import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, MessageSquare, TrendingUp, Box, Copy, TrendingDown, Mail } from "lucide-react";
import databaseIntegrationImg from "@assets/generated_images/database_upload_and_crm_integration.png";
import womanPhoneImg from "@assets/woman_answering_phone_in_living_room_1766483592249.png";
import dailyLeadsImg from "@assets/generated_images/daily_leads_closed_chart_dashboard.png";
import cloudTexture from "@assets/generated_images/cloud-bottom-bar.jpg";
import cloudsOverlay from "@assets/Project_(20251227103213)_1766828113842.jpg";
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
  onInView?: () => void;
}

const Plane = ({ startTrigger }: { startTrigger: boolean }) => {
  return (
    <motion.div
      initial={{
        top: "35%",
        left: "105%",
        rotate: -5
      }}
      animate={startTrigger ? {
        top: "75%",
        left: "-10%",
        rotate: -15
      } : {}}
      transition={{
        duration: 35,
        ease: "linear",
        repeat: 0
      }}
      className="absolute w-2 h-2 z-0 pointer-events-none"
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
  onInView,
}: StepProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });

  useEffect(() => {
    if (isInView && onInView) {
      onInView();
    }
  }, [isInView, onInView]);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "center center"],
  });

  const iconOpacity = useTransform(scrollYProgress, [0.45, 0.5, 0.55], [1, 0, 1]);
  
  const [stepContent, setStepContent] = useState<React.ReactNode>(number === "1" ? "1" : icon);

  useEffect(() => {
    return scrollYProgress.onChange((v) => {
      if (v > 0.5) {
        setStepContent(icon);
      } else {
        setStepContent(number === "1" ? "1" : icon);
      }
    });
  }, [scrollYProgress, icon, number]);

  const overlayOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1]);
  const overlayTextY = useTransform(scrollYProgress, [0.3, 0.7], [20, 0]);
  const cardOpacity = useTransform(scrollYProgress, [-0.2, 0.3], [0, 1]);
  const cardY = useTransform(scrollYProgress, [-0.2, 0.3], [50, 0]);
  const imageOpacity = useTransform(scrollYProgress, [-0.2, 0.3], [0, 1]);

  const isLeft = align === "left";

  return (
    <div ref={containerRef} className="h-[40vh] w-full flex items-center justify-center px-4 sm:px-6 md:px-12 relative z-10">
      <div className="container mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-16 items-center">
        <motion.div 
          style={{ opacity: cardOpacity, y: cardY, transform: 'translateZ(0)', willChange: 'opacity, transform' }}
          className={`order-2 ${isLeft ? "md:order-1" : "md:order-2"}`}
        >
          <div className="relative">
            <div className={`absolute top-1/2 -translate-y-1/2 w-16 h-[2px] bg-white z-50 hidden md:block ${isLeft ? "-right-16" : "-left-16"}`} />
            <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-600 hidden md:block ${isLeft ? "-right-18 translate-x-2" : "-left-18 -translate-x-2"}`} />
            
            <Card className="bg-card backdrop-blur-sm border-white/10 overflow-hidden group hover:border-primary/50 transition-colors duration-500">
              <CardContent className="p-8">
                <div className="mb-6 p-3 bg-primary/10 w-fit rounded-xl text-primary flex items-center justify-center min-w-[56px] min-h-[56px]" data-testid={`step-icon-${number}`}>
                  <motion.div style={{ opacity: iconOpacity }}>
                    {stepContent}
                  </motion.div>
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
          style={{ opacity: imageOpacity, transform: 'translateZ(0)', willChange: 'opacity, transform' }}
          className={`order-1 ${isLeft ? "md:order-2" : "md:order-1"} relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-white/5`}
          data-testid={`step-image-${number}`}
        >
          <img 
            src={image} 
            alt={cardTitle} 
            className="w-full h-full object-cover"
          />
          <motion.div 
            style={{ 
              opacity: overlayOpacity,
              boxShadow: 'inset 0 0 60px rgba(59, 130, 246, 0.5), inset 0 0 40px rgba(100, 150, 255, 0.3)'
            }}
            className="absolute inset-0 bg-blue-950/50 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center"
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
  const [planeStarted, setPlaneStarted] = useState(false);
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"]
  });
  const cloudY = useTransform(scrollYProgress, [0, 1], [0, 50]);

  return (
    <div 
      ref={scrollRef} 
      className="bg-slate-950 text-foreground overflow-hidden selection:bg-primary/30 relative"
      style={{ minHeight: '100%' }}
    >
      <div 
        className="absolute inset-0 -z-20" 
        style={{
          backgroundImage: `radial-gradient(circle at 12% 85%, white 0.6px, transparent 0.6px),
                            radial-gradient(circle at 88% 12%, white 1.1px, transparent 1.1px)`,
          backgroundRepeat: 'repeat',
          backgroundSize: '1300px 1100px',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
          animation: 'twinkle-fast 0.8s ease-in-out infinite',
          animationDelay: '0s',
          filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
          opacity: 0.85
        }}
      />
      <div 
        className="absolute inset-0 -z-20" 
        style={{
          backgroundImage: `radial-gradient(circle at 67% 42%, #e8e8e8 1.0px, transparent 1.0px),
                            radial-gradient(circle at 15% 15%, white 0.8px, transparent 0.8px)`,
          backgroundRepeat: 'repeat',
          backgroundSize: '1700px 1400px',
          filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
          animation: 'twinkle-fast-offset-1 1s ease-in-out infinite',
          animationDelay: '0.5s',
          opacity: 0.8
        }}
      />
      <div 
        className="absolute inset-0 -z-20" 
        style={{
          backgroundImage: `radial-gradient(circle at 39% 79%, white 0.6px, transparent 0.6px),
                            radial-gradient(circle at 83% 33%, #f0f0f0 1.4px, transparent 1.4px)`,
          backgroundRepeat: 'repeat',
          backgroundSize: '2100px 1800px',
          filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
          animation: 'twinkle-fast-offset-2 0.9s ease-in-out infinite',
          animationDelay: '1.2s',
          opacity: 0.75
        }}
      />
      <div className="absolute inset-0 pointer-events-none -z-10" style={{
        background: 'radial-gradient(ellipse 500% 120% at 50% 105%, rgba(59, 130, 246, 0.8) 0%, rgba(37, 99, 235, 0.7) 25%, rgba(29, 78, 216, 0.55) 45%, rgba(30, 58, 138, 0.3) 65%, rgba(30, 58, 138, 0) 100%)',
      }} />
      <div className="absolute inset-0 pointer-events-none -z-10" style={{
        background: 'radial-gradient(ellipse 440% 100% at 50% 95%, rgba(254, 215, 170, 0.75) 0%, rgba(251, 146, 60, 0.5) 25%, rgba(37, 99, 235, 0) 50%)',
      }} />
      <div className="absolute inset-0 pointer-events-none -z-10" style={{
        background: 'linear-gradient(to top, rgba(254, 243, 199, 0.45) 0%, rgba(254, 243, 199, 0.2) 15%, transparent 50%)',
      }} />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none -z-10" style={{
        background: 'linear-gradient(to bottom, transparent 0%, #F4F5F9 100%)',
        height: '25vh',
      }} />
      <Plane startTrigger={planeStarted} />
      {/* Animated Clouds Overlay - Moved behind content */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-0 h-[500px] overflow-hidden opacity-80">
        <motion.div 
          className="flex h-full w-[200%]"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ 
            duration: 80, 
            repeat: Infinity, 
            ease: "linear" 
          }}
        >
          <img 
            src={cloudsOverlay}
            alt=""
            className="w-1/2 h-full object-contain object-bottom"
            style={{ 
              mixBlendMode: 'screen',
              willChange: 'transform'
            }}
          />
          <img 
            src={cloudsOverlay}
            alt=""
            className="w-1/2 h-full object-contain object-bottom"
            style={{ 
              mixBlendMode: 'screen',
              willChange: 'transform'
            }}
          />
        </motion.div>
      </div>
      <div className="relative z-10">
      {/* Pain Points Section */}
      <section className="pt-48 pb-32 md:pt-56 md:pb-40">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            onViewportEnter={() => {
              // Trigger split animation immediately on viewport entry
              setGlitchAnimating(true);
            }}
            viewport={{ once: true, margin: "0px" }}
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
                backgroundImage: 'linear-gradient(to right, #FFFFFF 0%, #60a5fa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                display: 'inline-block',
                marginRight: '0.24em',
                filter: 'drop-shadow(8px 0px 30px rgba(96, 165, 250, 0.4)) drop-shadow(4px 0px 10px rgba(96, 165, 250, 0.25))',
                textShadow: '6px 0px 12px rgba(96, 165, 250, 0.3)'
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
                color: '#60a5fa',
                filter: 'drop-shadow(10px 0px 40px rgba(96, 165, 250, 0.55)) drop-shadow(5px 0px 10px rgba(96, 165, 250, 0.4))',
                textShadow: '8px 0px 15px rgba(96, 165, 250, 0.4), 12px 0px 25px rgba(96, 165, 250, 0.25)',
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
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-24"
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
                transition={{ delay: i * 0.08 + 0.1 + 0.1, duration: 0.5 }}
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
            <p className="text-xl font-medium tracking-wide text-[#bfbfbf]">
              Companies have invested <span className="font-bold text-white inline-block">THOUSANDS</span> in acquiring these leads, but they're leaving <span className="font-bold text-white inline-block">MILLIONS</span> on the table because reactivation is too painful and ineffective.
            </p>
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
      <div style={{ marginTop: "1.15rem", marginBottom: "5rem" }}>
        <FullscreenStep 
          number="1"
          cardTitle="Upload your database"
          cardDescription="Send a CSV or connect your CRM. That’s it, we handle the rest."
          overlayTitle="Your existing stack becomes an automation powerhouse."
          overlayDescription="CRM / Databases, WhatsApp, SMS & Chat, Email Platforms, Calendar Apps"
          image={databaseIntegrationImg}
          icon={<Database className="w-8 h-8" />}
          align="left"
          onInView={() => setPlaneStarted(true)}
        />
      </div>
      {/* Step 2 */}
      <div style={{ marginTop: "1rem", marginBottom: "5rem" }}>
        <FullscreenStep 
          number="2"
          cardTitle="Chat GPT-5.2 conversations"
          cardDescription="Natural, contextual SMS (not robot templates)."
          overlayTitle="Build the Automations"
          overlayDescription="Set up AI agents, workflows, and integrations in minutes."
          image={womanPhoneImg}
          icon={<MessageSquare className="w-8 h-8" />}
          align="right"
          onInView={() => setPlaneStarted(true)}
        />
      </div>
      {/* Step 3 */}
      <div style={{ marginTop: "1rem", marginBottom: "4rem" }}>
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
