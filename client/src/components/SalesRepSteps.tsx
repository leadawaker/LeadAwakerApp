import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, MessageSquare, TrendingUp, Server, MessageCircle, Mail, Calendar } from "lucide-react";
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
  const cardOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 1]);
  const cardY = useTransform(scrollYProgress, [0, 0.2], [50, 0]);
  const imageOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);

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
                <h3 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight text-white" data-testid={`step-title-${number}`}>{cardTitle}</h3>
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
    <div ref={scrollRef} className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
      {/* Intro Section */}
      <section className="h-[80vh] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-center"
          data-testid="sales-rep-intro"
        >
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-black">
            Your Expert Sales Rep in 3 Steps.
          </h1>
          <p className="text-primary text-xl font-medium tracking-wide">
            Dead leads <span className="opacity-50">→</span> revenue.
          </p>
        </motion.div>
      </section>

      {/* Step 1 with Integration Icons */}
      <div className="h-[80vh] w-full flex items-center justify-center px-4 md:px-12 relative z-10">
        <div className="container mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="order-2 md:order-1"
          >
            <div className="relative">
              <div className="absolute top-1/2 -translate-y-1/2 w-16 h-[2px] bg-primary/30 hidden md:block -right-16" />
              <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary hidden md:block -right-18 translate-x-2" />
              <Badge className="mb-4 bg-orange-600 text-white hover:bg-orange-700 text-lg px-3 py-1 rounded-full w-10 h-10 flex items-center justify-center" data-testid="step-badge-1">
                1
              </Badge>
              
              <Card className="bg-card/50 backdrop-blur-sm border-white/10 overflow-hidden group hover:border-primary/50 transition-colors duration-500">
                <CardContent className="p-8">
                  <div className="mb-6 p-3 bg-primary/10 w-fit rounded-xl text-primary" data-testid="step-icon-1">
                    <Database className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight text-white" data-testid="step-title-1">Upload database</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed" data-testid="step-description-1">
                    AI instantly IDs high-potential dormant leads.
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="order-1 md:order-2 relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-white/5"
            data-testid="step-image-1"
          >
            <img 
              src={databaseIntegrationImg} 
              alt="Upload database" 
              className="w-full h-full object-cover"
            />
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="absolute inset-0 bg-blue-950/60 backdrop-blur-sm flex flex-col items-center justify-center p-8"
            >
              <span className="text-primary font-mono text-sm uppercase tracking-wider mb-4 block">Step 1 Details</span>
              <p className="text-white text-center mb-8 font-bold text-lg max-w-xs">
                Your existing stack becomes an automation powerhouse.
              </p>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-2 border-white rounded-lg flex items-center justify-center mb-3">
                    <Server className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-medium text-white text-center">CRM / Databases</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-2 border-white rounded-lg flex items-center justify-center mb-3">
                    <MessageCircle className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-medium text-white text-center">WhatsApp, SMS & Chat</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-2 border-white rounded-lg flex items-center justify-center mb-3">
                    <Mail className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-medium text-white text-center">Email Platforms</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-2 border-white rounded-lg flex items-center justify-center mb-3">
                    <Calendar className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-medium text-white text-center">Calendar Apps</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Step 2 */}
      <div style={{ marginTop: "30%" }}>
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
  );
};

export default SalesRepSteps;
