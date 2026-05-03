import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Database, MessageSquare, TrendingUp, Box, Copy, TrendingDown, Mail } from "lucide-react";

import leadsDbImg from "../assets/step-1-main.webp";
import conversationImg from "../assets/Gemini_Generated_Image_j212wcj212wcj212_1766858918533.webp";
import dailyLeadsImg from "../assets/step-3-main.webp";
import appointmentBookingImg from "../assets/step-3-appointment-booking.webp";
import uploadDatabaseImg from "../assets/step-1-upload-database.webp";
import conversationCardImg from "../assets/Gemini_Generated_Image_j212wcj212wcj212_1767283699067.webp";

import { MeteorContainer } from "./Meteor";
import { StepCarousel } from "./StepCarousel";

const Plane = ({ startTrigger }: { startTrigger: boolean }) => (
  <motion.div
    initial={{ top: "18%", left: "105%", rotate: -5 }}
    animate={startTrigger ? { top: "75%", left: "-10%", rotate: -15 } : {}}
    transition={{ duration: 35, ease: "linear", repeat: 0 }}
    className="absolute w-2 h-2 z-0 pointer-events-none"
  >
    <motion.div
      animate={{
        opacity: [0, 1, 1, 0, 1, 1, 0],
        backgroundColor: ["#000000", "#ffffff", "#ffffff", "#000000", "#ff0000", "#ff0000", "#000000"],
        boxShadow: [
          "0 0 10px 3px transparent", "0 0 10px 3px #ffffff", "0 0 10px 3px #ffffff",
          "0 0 10px 3px transparent", "0 0 10px 3px #ff0000", "0 0 10px 3px #ff0000",
          "0 0 10px 3px transparent"
        ]
      }}
      transition={{ duration: 4, repeat: Infinity, times: [0, 0.01, 0.25, 0.5, 0.51, 0.75, 1] }}
      className="rounded-full"
      style={{ width: "2px", height: "2px" }}
    />
  </motion.div>
);

export const SalesRepSteps = () => {
  const { t } = useTranslation('salesRepSteps');
  const scrollRef = useRef(null);
  const [glitchAnimating, setGlitchAnimating] = useState(false);
  const [planeStarted, setPlaneStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPlaneStarted(true), 1000);
    setGlitchAnimating(true);
    return () => clearTimeout(timer);
  }, []);

  const { scrollYProgress } = useScroll({ target: scrollRef, offset: ["start start", "end end"] });
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
      {/* Background stars */}
      <div className="absolute inset-0" style={{
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
        willChange: 'transform', backfaceVisibility: 'hidden', perspective: '1000px',
        animation: 'twinkle-fast 0.8s ease-in-out infinite', filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
        opacity: 0.4
      }} />
      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle at 67% 42%, #e8e8e8 1.0px, transparent 1.0px),
                          radial-gradient(circle at 15% 15%, white 0.8px, transparent 0.8px)`,
        backgroundRepeat: 'repeat', backgroundSize: 'max(1700px, 200vw) max(1400px, 200vh)',
        filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
        animation: 'twinkle-fast-offset-1 1s ease-in-out infinite', animationDelay: '0.5s', opacity: 0.4
      }} />
      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(circle at 39% 79%, white 0.6px, transparent 0.6px),
                          radial-gradient(circle at 83% 33%, #f0f0f0 1.4px, transparent 1.4px)`,
        backgroundRepeat: 'repeat', backgroundSize: 'max(2100px, 200vw) max(1800px, 200vh)',
        filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
        animation: 'twinkle-fast-offset-2 0.9s ease-in-out infinite', animationDelay: '1.2s', opacity: 0.4
      }} />

      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 500% 120% at 50% 105%, rgba(59, 130, 246, 0.8) 0%, rgba(37, 99, 235, 0.7) 25%, rgba(29, 78, 216, 0.55) 45%, rgba(30, 58, 138, 0.3) 65%, rgba(30, 58, 138, 0) 100%)', zIndex: 0 }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 440% 100% at 50% 95%, rgba(254, 215, 170, 0.75) 0%, rgba(251, 146, 60, 0.5) 25%, rgba(37, 99, 235, 0) 50%)', zIndex: 0 }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(254, 243, 199, 0.45) 0%, rgba(254, 243, 199, 0.2) 15%, transparent 50%)', zIndex: 0 }} />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none [background:linear-gradient(to_bottom,transparent_0%,#F4F5F9_100%)] dark:[background:linear-gradient(to_bottom,transparent_0%,hsl(var(--background))_100%)]" style={{ height: '25vh', zIndex: 5 }} />

      <Plane startTrigger={planeStarted} />

      <div className="relative z-10">
        {/* Pain Points */}
        <section className="pt-48 pb-32 md:pt-56 md:pb-40">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              onViewportEnter={() => setGlitchAnimating(true)}
              viewport={{ once: true, margin: "-20% 0px -20% 0px" }}
              transition={{ duration: 0.3 }}
              className="text-center max-w-6xl mx-auto mb-24"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 drop-shadow-lg">
                <span className="text-white" style={{ display: 'inline-block', filter: 'drop-shadow(4px 0px 15px rgba(128, 128, 128, 0.15)) drop-shadow(2px 0px 5px rgba(128, 128, 128, 0.1))', textShadow: '3px 0px 6px rgba(128, 128, 128, 0.12)' }}>
                  {t('painPoints.title')}
                </span>
                {' '}
                <span style={{ color: '#E0F2FE', display: 'inline-block', marginRight: '0.24em' }}>
                  {t('painPoints.titleIs')}
                </span>
                <span className={`hologram-glitch ${glitchAnimating ? 'animate' : ''}`} data-testid="text-broken" data-text={t('painPoints.titleBroken')}>
                  {t('painPoints.titleBroken')}
                </span>
                <span style={{ color: '#E0F2FE', filter: 'drop-shadow(3px 0px 12px rgba(147, 197, 253, 0.225)) drop-shadow(1.5px 0px 3px rgba(147, 197, 253, 0.18))', textShadow: '2.4px 0px 4.5px rgba(147, 197, 253, 0.18), 3.6px 0px 7.5px rgba(147, 197, 253, 0.135)', display: 'inline-block' }} data-testid="text-dot">.</span>
              </h2>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-24"
            >
              {painPoints.map((pain, i) => (
                <motion.div
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 30, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, type: "spring", stiffness: 100, damping: 15 } } }}
                  initial={{ borderColor: 'rgb(249, 115, 22)' }}
                  animate={{ borderColor: 'rgb(59, 130, 246)' }}
                  transition={{ delay: i * 0.08 + 0.2, duration: 0.5 }}
                  className="group relative bg-gradient-to-br from-slate-800/80 to-slate-800/60 border backdrop-blur-sm p-8 rounded-2xl text-center transition-all duration-400 cursor-default overflow-hidden shadow-lg shadow-primary/20"
                  style={{ borderColor: 'rgb(59, 130, 246)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgb(234, 152, 44)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 25px 50px -12px rgba(234, 152, 44, 0.35)';
                    const icon = (e.currentTarget as HTMLElement).querySelector('[data-testid="pain-icon"]') as HTMLElement;
                    if (icon) icon.style.color = 'rgb(234, 152, 44)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgb(59, 130, 246)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 15px -3px rgba(59, 130, 246, 0.2)';
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
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }}
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

        {/* Meteor divider */}
        <section className="relative overflow-hidden" style={{ height: '8vh' }}>
          <MeteorContainer />
        </section>

        {/* Intro */}
        <section className="flex items-start justify-center relative overflow-hidden mb-2 py-8 md:py-9 md:pt-12" style={{ minHeight: '12vh' }}>
          <motion.div
            initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center relative z-10 px-4 w-full max-w-4xl"
            data-testid="sales-rep-intro"
          >
            <h1 className="text-3xl md:text-6xl font-extrabold tracking-tight mb-2 md:mb-4 text-white drop-shadow-lg leading-tight">
              {t('intro.title')}
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed -mt-3">
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
