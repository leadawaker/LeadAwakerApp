import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

import { Database, MessageSquare, TrendingUp, Box, Copy, TrendingDown, Mail, ChevronLeft, ChevronRight } from "lucide-react";

import leadsDbImg from "../assets/step-1-main.png";
import conversationImg from "@assets/Gemini_Generated_Image_j212wcj212wcj212_1766858918533.png";
import dailyLeadsImg from "../assets/step-3-main.jpg";

import appointmentBookingImg from "../assets/step-3-appointment-booking.jpg";
import uploadDatabaseImg from "../assets/step-1-upload-database.png";
import { MeteorContainer } from "./Meteor";

import excelLogo from "@assets/Microsoft_Office_Excel_(2019–2025).svg_1767283614696.png";
import conversationCardImg from "@assets/Gemini_Generated_Image_j212wcj212wcj212_1767283699067.png";

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
  leftText?: string;
  cardImage?: string;
}

const Plane = ({ startTrigger }: { startTrigger: boolean }) => {
  return (
    <motion.div
      initial={{
        top: "18%",
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
  leftText,
}: StepProps) => {
  const { t } = useTranslation('salesRepSteps');
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

  const overlayOpacity = useTransform(scrollYProgress, [-0.2, 0.3], [0, 1]);
  const overlayTextY = useTransform(scrollYProgress, [0.5, 0.9], [20, 0]);
  const cardOpacity = useTransform(scrollYProgress, [-0.2, 0.3], [0, 1]);
  const cardY = useTransform(scrollYProgress, [-0.2, 0.3], [50, 0]);

  const isLeft = align === "left";

  return (
    <div ref={containerRef} className="h-[40vh] w-full flex items-center justify-center px-4 sm:px-6 md:px-12 relative z-10">
      <div className="container mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-16 items-center">
        <motion.div 
          style={{ opacity: cardOpacity, transform: 'translateZ(0)', willChange: 'opacity' }}
          className={`order-2 ${isLeft ? "md:order-1" : "md:order-2"}`}
        >
          <div className="relative">
            <Card className="bg-card backdrop-blur-sm border-white/10 overflow-hidden group hover:border-primary/50 transition-colors duration-500">
              <CardContent className="p-8">
                <div className="mb-6 p-3 bg-slate-200 w-fit rounded-xl text-gray-600 flex items-center justify-center min-w-[56px] min-h-[56px]" data-testid={`step-icon-${number}`}>
                  {icon}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight text-foreground" data-testid={`step-title-${number}`}>{cardTitle}</h3>
                <p className="text-muted-foreground text-lg leading-relaxed" data-testid={`step-description-${number}`}>
                  {cardDescription.split('\n\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < cardDescription.split('\n\n').length - 1 && <br />}
                    </span>
                  ))}
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
        <motion.div 
          style={{ transform: 'translateZ(0)', willChange: 'transform' }}
          className={`order-1 ${isLeft ? "md:order-2" : "md:order-1"} relative ${number === "3" ? "h-full" : "aspect-[4/3]"} rounded-2xl overflow-hidden shadow-2xl border border-white/5`}
          data-testid={`step-image-${number}`}
        >
          {leftText ? (
            <>
              <img 
                src={image} 
                alt={cardTitle} 
                className="w-full h-full object-cover"
                style={{ opacity: 0.4 }}
              />
              <motion.div 
                style={{ opacity: overlayOpacity }}
                className="absolute inset-0 bg-gradient-to-r from-blue-950/90 to-blue-900/85 flex flex-col items-start justify-start p-8 text-white"
              >
                <div className="space-y-6 max-w-2xl">
                  {leftText.split('\n').map((line, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-400 mt-2" />
                      <div className="font-medium text-gray-100 text-[16px]">
                        {line}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          ) : (
            <>
              <img 
                src={image} 
                alt={cardTitle} 
                className="w-full h-full object-cover"
                style={{ opacity: 0.4 }}
              />
              <motion.div 
                style={{ 
                  opacity: overlayOpacity,
                  boxShadow: 'inset 0 0 60px rgba(59, 130, 246, 0.5), inset 0 0 40px rgba(100, 150, 255, 0.3)'
                }}
                className="absolute inset-0 bg-blue-950/50 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center"
              >
                <motion.div style={{ y: overlayTextY }}>
                  <span className="text-accent font-mono text-sm uppercase tracking-wider mb-2 block">{t('common.stepDetails', { number })}</span>
                  <h4 className="text-3xl font-bold text-white mb-4">{overlayTitle}</h4>
                  <p className="text-gray-200 text-[16px] max-w-md mx-auto leading-relaxed">
                    {overlayDescription}
                  </p>
                </motion.div>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

const StepCarousel = ({ steps, onStepInView }: { steps: any[], onStepInView: () => void }) => {
  const { t } = useTranslation('salesRepSteps');
  const [currentStep, setCurrentStep] = useState(0);

  const handlePrev = () => {
    setCurrentStep((prev) => (prev - 1 + steps.length) % steps.length);
  };

  const handleNext = () => {
    setCurrentStep((prev) => (prev + 1) % steps.length);
  };

  return (
    <div className="relative w-full pt-12 pb-48">
        <div className="mx-auto relative z-10">


        {/* Stacked Cards Container */}
        <div className="relative h-[850px] flex flex-col items-center justify-center">
          <div className="relative w-full h-[650px] flex items-center justify-center">
            {steps.map((step, index) => {
              const position = (index - currentStep + steps.length) % steps.length;
              const isActive = position === 0;
              const isNext = position === 1;
              const isPrev = position === steps.length - 1;

              return (
                <motion.div
                  key={index}
                  data-testid={`card-step-${index}`}
                  initial={false}
                  animate={{
                    scale: isActive ? 1 : 0.85,
                    x: isActive ? 0 : isNext ? 150 : -150,
                    opacity: isActive ? 1 : 0.4,
                    zIndex: isActive ? 20 : 10,
                    filter: isActive ? 'blur(0px)' : 'blur(2px)',
                    pointerEvents: isActive ? 'auto' : 'none',
                  }}
                  transition={{ 
                    x: { type: 'spring', stiffness: 300, damping: 30 },
                    scale: { type: 'spring', stiffness: 300, damping: 30 },
                    opacity: { duration: 0.3 }
                  }}
                  className="absolute w-full max-w-5xl left-1/2 -translate-x-1/2"
                >
                  <Card className="bg-card backdrop-blur-sm border-white/10 group hover:border-primary/50 transition-colors duration-500 shadow-2xl">
  <CardContent className="p-8">
    <div className="mb-6 p-3 bg-[#fff7e0] w-fit rounded-xl text-gray-600 flex items-center justify-center min-w-[56px] min-h-[56px]" data-testid={`step-icon-${step.number}`}>
      {step.icon}
    </div>
    <h3 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight text-foreground" data-testid={`step-title-${step.number}`}>
      {step.cardTitle}
    </h3>
    <p className="text-muted-foreground text-lg leading-relaxed mb-6" data-testid={`step-description-${step.number}`}>
      {step.cardDescription}
    </p>

    {/* Bullet points and media */}
    <div className="border-t border-white/10">
      {step.cardImage && step.number === "1" ? (
        <div className="relative mb-6 rounded-lg overflow-hidden group">
          <img src={step.cardImage} alt="Step illustration" className="w-full h-auto object-cover rounded-lg" />

          {/* CRM Logos Carousel overlaying the image */}
          <motion.div
            initial={false}
            animate={{ opacity: isActive ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="absolute top-[5%] left-0 right-0 h-1/4 flex items-center px-4 pt-4 z-10"
            style={{
              maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'
            }}
          >
            <style>{`
              @keyframes crmScroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .crm-carousel-track {
                animation: crmScroll 52.3s linear infinite;
                display: flex;
                gap: 1rem;
                width: max-content;
              }
              .crm-carousel-track:hover {
                animation-play-state: paused;
              }
              .crm-logo-item {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.375rem 0.75rem;
                background: rgba(255, 255, 255, 0.35);
                border-radius: 0.375rem;
                border: 1px solid rgba(226, 232, 240, 0.3);
                backdrop-filter: blur(4px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              }
            `}</style>
            <div className="crm-carousel-track">
              {[
                { name: 'Salesforce', url: 'https://www.vectorlogo.zone/logos/salesforce/salesforce-icon.svg' },
                { name: 'HubSpot', url: 'https://www.vectorlogo.zone/logos/hubspot/hubspot-icon.svg' },
                { name: 'GoHighLevel', url: 'https://www.google.com/s2/favicons?domain=gohighlevel.com&sz=128' },
                { name: 'Pipedrive', url: 'https://cdn.worldvectorlogo.com/logos/pipedrive.svg' },
                { name: 'Sheets', url: 'https://www.gstatic.com/images/branding/product/2x/sheets_2020q4_48dp.png' },
                { name: 'Excel', url: excelLogo },
                { name: 'Supabase', url: 'https://www.vectorlogo.zone/logos/supabase/supabase-icon.svg' },
                { name: 'Airtable', url: 'https://www.vectorlogo.zone/logos/airtable/airtable-icon.svg' },
                { name: 'API', url: null },
                // Duplicate for seamless loop
                { name: 'Salesforce', url: 'https://www.vectorlogo.zone/logos/salesforce/salesforce-icon.svg' },
                { name: 'HubSpot', url: 'https://www.vectorlogo.zone/logos/hubspot/hubspot-icon.svg' },
                { name: 'GoHighLevel', url: 'https://www.google.com/s2/favicons?domain=gohighlevel.com&sz=128' },
                { name: 'Pipedrive', url: 'https://cdn.worldvectorlogo.com/logos/pipedrive.svg' },
                { name: 'Sheets', url: 'https://www.gstatic.com/images/branding/product/2x/sheets_2020q4_48dp.png' },
                { name: 'Excel', url: excelLogo },
                { name: 'Supabase', url: 'https://www.vectorlogo.zone/logos/supabase/supabase-icon.svg' },
                { name: 'Airtable', url: 'https://www.vectorlogo.zone/logos/airtable/airtable-icon.svg' },
                { name: 'API', url: null }
              ].map((crm, i) => (
                <div key={i} className="crm-logo-item">
                  {crm.url ? <img src={crm.url} alt={crm.name} className="w-6 h-6 object-contain" /> : <span className="text-blue-600 font-mono font-bold text-sm">&lt;/&gt;</span>}
                  <span className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">{crm.name}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Navigation Controls - On top of image for desktop, hidden on mobile */}
          <div className="hidden md:flex absolute bottom-4 left-0 right-0 z-20 items-center justify-center gap-4">
            {/* Left Arrow */}
            <button
              onClick={handlePrev}
              data-testid="button-prev-step-card"
              className="p-2 text-white hover:text-blue-500 transition-colors duration-200 flex items-center justify-center bg-black/30 rounded-full backdrop-blur-sm"
              aria-label={t('common.prevStep')}
            >
              <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
            </button>

            {/* Dots */}
            <div className="flex gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  data-testid={`dot-step-card-${i}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? 'bg-blue-500 w-8 h-3 md:w-10 md:h-4'
                      : 'bg-blue-300 hover:bg-blue-400 w-3 h-3 md:w-4 md:h-4'
                  }`}
                  aria-label={t('common.goToStep', { number: i + 1 })}
                />
              ))}
            </div>

            {/* Right Arrow */}
            <button
              onClick={handleNext}
              data-testid="button-next-step-card"
              className="p-2 text-white hover:text-blue-500 transition-colors duration-200 flex items-center justify-center bg-black/30 rounded-full backdrop-blur-sm"
              aria-label={t('common.nextStep')}
            >
              <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
            </button>
          </div>
        </div>
      ) : step.cardImage ? (
        <div className="mb-4 rounded-lg overflow-hidden relative">
          <img src={step.cardImage} alt="Step illustration" className="w-full h-auto object-cover rounded-lg" />

          {/* Navigation Controls - On top of image for desktop, hidden on mobile */}
          <div className="hidden md:flex absolute bottom-4 left-0 right-0 z-20 items-center justify-center gap-4">
            {/* Left Arrow */}
            <button
              onClick={handlePrev}
              data-testid="button-prev-step-card"
              className="p-2 text-white hover:text-blue-500 transition-colors duration-200 flex items-center justify-center bg-black/30 rounded-full backdrop-blur-sm"
              aria-label={t('common.prevStep')}
            >
              <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
            </button>

            {/* Dots */}
            <div className="flex gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  data-testid={`dot-step-card-${i}`}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? 'bg-blue-500 w-8 h-3 md:w-10 md:h-4'
                      : 'bg-blue-300 hover:bg-blue-400 w-3 h-3 md:w-4 md:h-4'
                  }`}
                  aria-label={t('common.goToStep', { number: i + 1 })}
                />
              ))}
            </div>

            {/* Right Arrow */}
            <button
              onClick={handleNext}
              data-testid="button-next-step-card"
              className="p-2 text-white hover:text-blue-500 transition-colors duration-200 flex items-center justify-center bg-black/30 rounded-full backdrop-blur-sm"
              aria-label={t('common.nextStep')}
            >
              <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Navigation Controls - Below Image for mobile only */}
      <div className="flex md:hidden items-center justify-center gap-4 mb-6">
        {/* Left Arrow */}
        <button
          onClick={handlePrev}
          data-testid="button-prev-step-card-mobile"
          className="p-2 text-gray-600 hover:text-blue-500 transition-colors duration-200 flex items-center justify-center bg-gray-100 rounded-full"
          aria-label={t('common.prevStep')}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Dots */}
        <div className="flex gap-2">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              data-testid={`dot-step-card-mobile-${i}`}
              className={`rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'bg-blue-500 w-8 h-3'
                  : 'bg-blue-300 hover:bg-blue-400 w-3 h-3'
              }`}
              aria-label={t('common.goToStep', { number: i + 1 })}
            />
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={handleNext}
          data-testid="button-next-step-card-mobile"
          className="p-2 text-gray-600 hover:text-blue-500 transition-colors duration-200 flex items-center justify-center bg-gray-100 rounded-full"
          aria-label={t('common.nextStep')}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <motion.div
        animate={{ 
          height: isActive ? "auto" : 0,
          opacity: isActive ? 1 : 0
        }}
        transition={{ duration: 0.4 }}
        className="overflow-hidden"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
          {step.leftText && step.leftText.split('\n').map((line: string, i: number) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
              <div className="font-medium text-gray-600 text-[16px]">
                {line}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  </CardContent>
</Card>
                </motion.div>
              );
            })}

          </div>
        </div>
      </div>
    </div>
  );
};

export const SalesRepSteps = () => {
  const { t } = useTranslation('salesRepSteps');
  const scrollRef = useRef(null);
  const [glitchAnimating, setGlitchAnimating] = useState(false);
  const [planeStarted, setPlaneStarted] = useState(false);

  useEffect(() => {
    // Proactively start the plane animation shortly after mount
    const timer = setTimeout(() => setPlaneStarted(true), 1000);

    // Trigger glitch animation much earlier
    const glitchTimer = setTimeout(() => setGlitchAnimating(true), 500);

    // Add CSS for the glitch animation to work on all devices
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes glitch-mobile {
        0% { transform: translate(0); }
        20% { transform: translate(-2px, 2px); }
        40% { transform: translate(-2px, -2px); }
        60% { transform: translate(2px, 2px); }
        80% { transform: translate(2px, -2px); }
        100% { transform: translate(0); }
      }
      .hologram-glitch.animate {
        animation: glitch-mobile 0.3s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);

    return () => {
      clearTimeout(timer);
      clearTimeout(glitchTimer);
      document.head.removeChild(style);
    };
  }, []);
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"]
  });
  const cloudY = useTransform(scrollYProgress, [0, 1], [0, 50]);

  const steps = [
    {
      number: t('steps.step1.number'),
      cardTitle: t('steps.step1.cardTitle'),
      cardDescription: t('steps.step1.cardDescription'),
      overlayTitle: "",
      overlayDescription: "",
      image: leadsDbImg,
      icon: <Database className="w-8 h-8 text-yellow-500" />,
      align: "left" as const,
      cardImage: uploadDatabaseImg,
      leftText: `${t('steps.step1.bulletPoints.reawaken')}\n${t('steps.step1.bulletPoints.segment')}`
    },
    {
      number: t('steps.step2.number'),
      cardTitle: t('steps.step2.cardTitle'),
      cardDescription: t('steps.step2.cardDescription'),
      overlayTitle: t('steps.step2.overlayTitle'),
      overlayDescription: t('steps.step2.overlayDescription'),
      image: conversationImg,
      icon: <MessageSquare className="w-8 h-8 text-yellow-500" />,
      align: "right" as const,
      cardImage: conversationCardImg,
      leftText: `${t('steps.step2.bulletPoints.response')}\n${t('steps.step2.bulletPoints.followUp')}\n${t('steps.step2.bulletPoints.languages')}\n${t('steps.step2.bulletPoints.humanTakeover')}\n${t('steps.step2.bulletPoints.selling')}`
    },
    {
      number: t('steps.step3.number'),
      cardTitle: t('steps.step3.cardTitle'),
      cardDescription: t('steps.step3.cardDescription'),
      overlayTitle: "",
      overlayDescription: "",
      image: dailyLeadsImg,
      icon: <TrendingUp className="w-8 h-8 text-yellow-500" />,
      align: "left" as const,
      cardImage: appointmentBookingImg,
      leftText: `${t('steps.step3.bulletPoints.calendar')}\n${t('steps.step3.bulletPoints.support')}\n${t('steps.step3.bulletPoints.optimization')}\n${t('steps.step3.bulletPoints.dashboard')}`
    }
  ];

  const painPoints = [
    { icon: <Box className="w-8 h-8" strokeWidth={1.5} />, title: t('painPoints.bloatedCrm') },
    { icon: <Copy className="w-8 h-8" strokeWidth={1.5} />, title: t('painPoints.wastedTime') },
    { icon: <TrendingDown className="w-8 h-8" strokeWidth={1.5} />, title: t('painPoints.lowReplyRates') },
    { icon: <Mail className="w-8 h-8" strokeWidth={1.5} />, title: t('painPoints.spamCampaigns') }
  ];

  return (
    <div 
      ref={scrollRef} 
      className="bg-slate-950 text-foreground overflow-hidden selection:bg-primary/30 relative"
      style={{ minHeight: '100%' }}
    >
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `radial-gradient(circle at 12% 85%, white 0.6px, transparent 0.6px),
                            radial-gradient(circle at 88% 12%, white 1.1px, transparent 1.1px),
                            radial-gradient(circle at 25% 65%, white 0.8px, transparent 0.8px),
                            radial-gradient(circle at 75% 60%, white 0.7px, transparent 0.7px),
                            radial-gradient(circle at 45% 70%, white 0.5px, transparent 0.5px),
                            radial-gradient(circle at 15% 90%, white 0.6px, transparent 0.6px),
                            radial-gradient(circle at 85% 85%, white 0.8px, transparent 0.8px),
                            radial-gradient(circle at 50% 95%, white 0.5px, transparent 0.5px),
                            radial-gradient(circle at 30% 80%, white 0.7px, transparent 0.7px),
                            radial-gradient(circle at 70% 90%, white 0.6px, transparent 0.6px)`,
          backgroundRepeat: 'repeat',
          backgroundSize: 'max(1300px, 200vw) max(1100px, 200vh)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
          animation: 'twinkle-fast 0.8s ease-in-out infinite',
          animationDelay: '0s',
          filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
          opacity: 0.4
        }}
      />
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `radial-gradient(circle at 67% 42%, #e8e8e8 1.0px, transparent 1.0px),
                            radial-gradient(circle at 15% 15%, white 0.8px, transparent 0.8px)`,
          backgroundRepeat: 'repeat',
          backgroundSize: 'max(1700px, 200vw) max(1400px, 200vh)',
          filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
          animation: 'twinkle-fast-offset-1 1s ease-in-out infinite',
          animationDelay: '0.5s',
          opacity: 0.4
        }}
      />
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: `radial-gradient(circle at 39% 79%, white 0.6px, transparent 0.6px),
                            radial-gradient(circle at 83% 33%, #f0f0f0 1.4px, transparent 1.4px)`,
          backgroundRepeat: 'repeat',
          backgroundSize: 'max(2100px, 200vw) max(1800px, 200vh)',
          filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
          animation: 'twinkle-fast-offset-2 0.9s ease-in-out infinite',
          animationDelay: '1.2s',
          opacity: 0.4
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 500% 120% at 50% 105%, rgba(59, 130, 246, 0.8) 0%, rgba(37, 99, 235, 0.7) 25%, rgba(29, 78, 216, 0.55) 45%, rgba(30, 58, 138, 0.3) 65%, rgba(30, 58, 138, 0) 100%)',
        zIndex: 0
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 440% 100% at 50% 95%, rgba(254, 215, 170, 0.75) 0%, rgba(251, 146, 60, 0.5) 25%, rgba(37, 99, 235, 0) 50%)',
        zIndex: 0
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(to top, rgba(254, 243, 199, 0.45) 0%, rgba(254, 243, 199, 0.2) 15%, transparent 50%)',
        zIndex: 0
      }} />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{
        background: 'linear-gradient(to bottom, transparent 0%, #F4F5F9 100%)',
        height: '25vh',
        zIndex: 5
      }} />
      <Plane startTrigger={planeStarted} />
      <div className="relative z-10">
      {/* Pain Points Section */}
      <section className="pt-48 pb-32 md:pt-56 md:pb-40">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            onViewportEnter={() => {
              setGlitchAnimating(true);
            }}
            viewport={{ once: true, margin: "-20% 0px -20% 0px" }}
            transition={{ duration: 0.3 }}
            className="text-center max-w-6xl mx-auto mb-24"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 drop-shadow-lg">
              <span className="text-white" style={{ 
                display: 'inline-block',
                filter: 'drop-shadow(4px 0px 15px rgba(128, 128, 128, 0.15)) drop-shadow(2px 0px 5px rgba(128, 128, 128, 0.1))',
                textShadow: '3px 0px 6px rgba(128, 128, 128, 0.12)'
              }}>
                {t('painPoints.title')}
              </span>
              {' '}
                <span style={{ 
                  color: '#E0F2FE',
                  display: 'inline-block',
                  marginRight: '0.24em'
                }}>
                  {t('painPoints.titleIs')}
                </span>
             
              <span 
                className={`hologram-glitch ${glitchAnimating ? 'animate' : ''}`}
                data-testid="text-broken"
                data-text={t('painPoints.titleBroken')}
              >
                {t('painPoints.titleBroken')}
              </span>

              <span style={{ 
                color: '#E0F2FE',
                filter: 'drop-shadow(3px 0px 12px rgba(147, 197, 253, 0.225)) drop-shadow(1.5px 0px 3px rgba(147, 197, 253, 0.18))',
                textShadow: '2.4px 0px 4.5px rgba(147, 197, 253, 0.18), 3.6px 0px 7.5px rgba(147, 197, 253, 0.135)',
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
            {painPoints.map((pain, i) => (
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
                  <p className="text-sm font-semibold text-white transition-all duration-400 leading-relaxed whitespace-pre-line">{pain.title}</p>
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
            <p 
              className="text-xl font-medium tracking-wide text-[#bfbfbf]"
              dangerouslySetInnerHTML={{ 
                __html: t('painPoints.subtitle')
                  .replace('<strong>', '<span class="font-bold text-white inline-block">')
                  .replace('</strong>', '</span>')
                  .replace('<strong>', '<span class="font-bold text-white inline-block text-[18px]">')
                  .replace('</strong>', '</span>')
              }}
            />
          </motion.div>
        </div>
      </section>

      {/* Meteor Section */}
      <section className="relative overflow-hidden" style={{ height: '8vh' }}>
        <MeteorContainer />
      </section>

        {/* Intro Section */}
        <section className="flex items-start justify-center relative overflow-hidden mb-2 py-8 md:py-9 md:pt-12" style={{ minHeight: '12vh' }}>
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center relative z-10 px-4 w-full max-w-4xl"
            data-testid="sales-rep-intro"
          >
            <h1 className="text-3xl md:text-6xl font-extrabold tracking-tight mb-2 md:mb-4 text-white drop-shadow-lg leading-tight">
              {t('intro.title')}
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
              {t('intro.subtitle') || "Reativação completa e humanizada em 3 etapas simples."}
            </p>
          </motion.div>
        </section>

      {/* Step Carousel */}
      <section className="relative py-0">
        <StepCarousel steps={steps} onStepInView={() => setPlaneStarted(true)} />
      </section>

      </div>
    </div>
  );
};

export default SalesRepSteps;
