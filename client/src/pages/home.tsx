import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import LightField from "@/components/LightField";
import { 
  ArrowRight, 
  ChevronDown,
  BarChart3, 
  Target, 
  Zap, 
  MessageSquare, 
  Mail, 
  Calendar,
  CheckCircle2,
  Clock,
  Shield,
  Search,
  Users
} from "lucide-react";
import Chat3D from "@/components/Chat3D";
import PipelineChart from "@/components/PipelineChart";
import AnimatedCounter from "@/components/AnimatedCounter";
import AnimatedRangeCounter from "@/components/AnimatedRangeCounter";
import SalesRepSteps from "@/components/SalesRepSteps";
import WorkflowVisualization from "@/components/WorkflowVisualization";

export default function Home() {
  const { t, i18n } = useTranslation("home");
  const lang = i18n.language;
  const isDefaultLang = lang === "en";
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  return (
    <div className="min-h-screen pt-32 overflow-x-hidden md:overflow-visible">
      {/* Hero Section */}
      <section className="relative overflow-hidden pb-20 md:pb-32">
        <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent blur-3xl opacity-50" />

        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_minmax(400px,0.7fr)] lg:gap-8 items-center mb-20 relative md:ml-auto lg:w-full">

          {/* TEXT BLOCK */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center md:text-left lg:min-w-[580px] lg:translate-x-0 xl:translate-x-0 2xl:translate-x-0"
          >






              <h1 className="
                font-bold leading-[1.1] mb-6 text-foreground relative
                text-[42px] sm:text-[48px] md:text-5xl lg:text-6xl
              ">
                {t("hero.title.line1")}
                <br />

                <motion.span className="relative block w-full">
                  <motion.span
                    className="absolute top-0 bottom-0 -z-10"
                    style={{
                      background:
                        "linear-gradient(to right, transparent 0%, #FEB800 15%, #FEB800 70%, rgba(255,255,255,0.6) 85%, transparent 100%)",
                      left: "calc(50% - 200vw)",
                      width: "400vw",
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 1.5, duration: 0.3 }}
                  />
                  <motion.span
                    className="relative inline-block font-bold py-2 md:py-3 z-10"
                    initial={{ color: "#000" }}
                    animate={{ color: "#ffffff" }}
                    transition={{ delay: 1.5, duration: 0.01 }}
                  >
                    {t("hero.title.highlight")}
                  </motion.span>
                </motion.span>

                <span className="block">
                  {t("hero.title.line2")}
                </span>
              </h1>

              <p className="
                text-muted-foreground mb-8 leading-relaxed
                text-[16px] sm:text-[18px] md:text-xl
                max-w-md mx-auto md:mx-0
              ">
                {t("hero.subtitle.line1")}<br />
                {t("hero.subtitle.line2")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Link href={isDefaultLang ? "/book-demo" : `/${lang}/book-demo`}>
                  <Button size="lg" className="h-14 px-8 text-lg rounded-full">
                    {t("hero.cta.primary")}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>

                <Link href={isDefaultLang ? "/services" : `/${lang}/services`}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 px-8 text-lg rounded-full"
                  >
                    {t("hero.cta.secondary")}
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* CHAT 3D */}
            <div className="
              relative flex justify-center
              scale-[1] sm:scale-90 md:scale-100
              sm:-translate-x-2 md:translate-x-0
              lg:translate-x-[-40px] xl:translate-x-[-32px]
              origin-center
            ">
              <Chat3D />
            </div>
             </div>
            </div>
          </section>

      {/* Sales Rep Steps Section */}
      <SalesRepSteps />

      {/* Conversion Pipeline */}
      <section className="py-48 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-0"
          >
            <PipelineChart />
          </motion.div>
        </div>
      </section>

      {/* Results/Metrics Section */}
      <section className="pb-48 pt-16 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              {t("results.title")}
            </h2>
            <p className="text-lg md:text-xl mt-4 text-[#3c50d6]">
              {t("results.subtitle")}
            </p>
          </motion.div>

          <div className="flex flex-col md:flex-row gap-8 mb-12 items-stretch max-w-4xl mx-auto">
            {/* Stacked Side Cards */}
            <div className="flex flex-col gap-4 flex-1">
              {[
                {
                  isRange: true,
                  start: 20,
                  end: 30,
                  finalStart: 40,
                  finalEnd: 60,
                  suffix: "%",
                  label: t("results.metrics.replyRates.label"),
                  subtext: t("results.metrics.replyRates.subtext"),
                  duration: 2
                },
                {
                  metric: 25,
                  startMetric: 12,
                  suffix: "%",
                  label: t("results.metrics.leadsReactivated.label"),
                  subtext: t("results.metrics.leadsReactivated.subtext"),
                  duration: 3
                },
                {
                  metric: 40,
                  startMetric: 0,
                  suffix: "+",
                  label: t("results.metrics.hoursSaved.label"),
                  subtext: t("results.metrics.hoursSaved.subtext"),
                  duration: 4,
                  suffixAtEnd: true
                }
              ].map((result, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * i }}
                  className="bg-card p-6 rounded-2xl border border-border text-center flex flex-col justify-center flex-1 min-w-[280px]"
                >
                  <div className={`font-bold text-primary mb-1 font-heading ${result.isRange ? 'text-4xl' : 'text-[48px]'}`}>
                    {result.isRange ? (
                      <AnimatedRangeCounter 
                        start={result.start}
                        end={result.end}
                        finalStart={result.finalStart}
                        finalEnd={result.finalEnd}
                        duration={result.duration}
                        format={(v: number) => Math.round(v).toString()}
                        suffix={result.suffix}
                      />
                    ) : (
                      <AnimatedCounter 
                        start={result.startMetric ?? 0}
                        end={result.metric ?? 0} 
                        duration={result.duration}
                        format={(v: number) => Math.round(v).toString()}
                        suffix={result.suffix}
                        suffixAtEnd={result.suffixAtEnd}
                      />
                    )}
                  </div>
                  <h3 className="font-bold truncate font-heading text-[22px]">{result.label}</h3>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              animate={{ 
                backgroundColor: isFinished ? "#273887" : "#ffffff",
                color: isFinished ? "#ffffff" : "#3c50d6"
              }}
              transition={{ duration: 0.5 }}
              className="p-8 rounded-2xl border border-border text-center flex flex-col justify-center flex-[2] min-h-[550px] relative overflow-hidden bg-[#1c2973]"
            >
              <AnimatePresence>
                {isFinished && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="stars-overlay"
                  >
                    <div className="stars"></div>
                    <div className="stars stars2"></div>
                    <div className="stars stars3"></div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="relative z-10">
                <motion.div
                  animate={{ y: isFinished ? -8 : 60 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className={`text-6xl md:text-8xl font-bold mb-2 font-heading transition-colors duration-500 ${isFinished ? 'text-white' : 'text-primary'}`}
                >
                  <AnimatedCounter 
                    start={10000}
                    end={0} 
                    duration={5}
                    format={(v: number) => `$${Math.round(v).toString()}`}
                    onFinishedChange={(finished) => setIsFinished(finished)}
                  />
                </motion.div>
                <motion.h3
                  animate={{ y: isFinished ? -8 : 60 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className={`mb-2 font-heading mt-8 md:mt-12 transition-colors duration-500 text-[28px] md:text-[39px] font-bold ${isFinished ? 'text-white' : 'text-black'}`}
                >
                  {t("results.upfrontCost.title")}
                </motion.h3>
                <div className={`text-lg font-medium flex flex-col items-center text-center pt-8 ${isFinished ? '' : 'pointer-events-none'}`}>
                  <motion.span 
                    className="font-bold mb-3 text-[18px]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={isFinished ? { opacity: 0.8, y: 0 } : { opacity: 0, y: 10 }}
                    transition={{ duration: 0.8, delay: 0 }}
                  >
                    {t("results.upfrontCost.partnership")}
                  </motion.span>
                  <motion.span 
                    className="leading-relaxed mb-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={isFinished ? { opacity: 0.8, y: 0 } : { opacity: 0, y: 10 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    {t("results.upfrontCost.mission")}
                  </motion.span>
                  <motion.span 
                    className="leading-relaxed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={isFinished ? { opacity: 0.8, y: 0 } : { opacity: 0, y: 10 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                  >
                    {t("results.upfrontCost.guarantee")}
                  </motion.span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Security & AI Guardrails Section */}
      <section className="py-48">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-5xl mx-auto mb-16"
          >
            <h2 className="font-bold mt-[3px] mb-[3px] text-[58px]">
              {t("compliance.title")}
            </h2>
          </motion.div>

          <WorkflowVisualization />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="max-w-4xl mx-auto"
          >
            <div className="grid md:grid-cols-2 gap-8 text-left mt-12 p-8">
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-[18px]">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  {t("compliance.gdpr.title")}
                </h3>
                <p className="text-gray-600 text-[16px]">
                  {t("compliance.gdpr.description")}
                </p>
              </div>
              <div className="space-y-3 md:pl-8 pt-8 md:pt-0">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 text-[18px]">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  {t("compliance.brand.title")}
                </h3>
                <p className="text-gray-600 text-[16px]">
                  {t("compliance.brand.description")}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bottom Demo CTA Section */}
      <section className="py-32 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h2 className="md:text-4xl lg:text-5xl font-bold mb-4 text-white tracking-tight text-[40px] leading-tight">
              {t("bottomCta.title")}
            </h2>
            
            <div className="max-w-3xl mx-auto mb-10">
              <div className="relative pl-6 py-1 border-l-4 border-[#FEB800] text-left">
                <p className="md:text-[21px] text-[#FEB8800] font-medium opacity-90 text-justify text-[20px]">
                  {t("bottomCta.quote")}
                </p>

                <p className="mt-2 text-white/75 text-[14px] md:text-[15px] leading-snug whitespace-pre-line">
                  {t("bottomCta.meta")}
                </p>

              </div>
            </div>


            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link href={isDefaultLang ? "/book-demo" : `/${lang}/book-demo`}>
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg rounded-full shadow-xl shadow-primary/20 bg-white text-primary hover:bg-yellow-400 hover:text-black hover:shadow-yellow-400/35 transition-all font-bold"
                >
                  {t("bottomCta.button")}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
