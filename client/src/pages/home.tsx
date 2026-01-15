import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  ArrowRight
} from "lucide-react";
import Chat3D from "@/components/Chat3D";
import PipelineChart from "@/components/PipelineChart";
import AnimatedCounter from "@/components/AnimatedCounter";
import AnimatedRangeCounter from "@/components/AnimatedRangeCounter";
import SalesRepSteps from "@/components/SalesRepSteps";
import WorkflowVisualization from "@/components/WorkflowVisualization";

export default function Home() {
  const { t } = useTranslation("home");
  const [isFinished, setIsFinished] = useState(false);

  return (
    <div className="min-h-screen pt-24 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative overflow-hidden pb-20 md:pb-32">
        <div className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent blur-3xl opacity-50" />

        <div className="container mx-auto px-4 md:px-6">
          <div
            className="
              grid grid-cols-1
              lg:grid-cols-[1fr_minmax(450px,0.7fr)]
              gap-10 lg:gap-12
              items-center
              mb-20
              relative
              lg:w-11/12
            "
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1
                className="
                  text-4xl
                  sm:text-5xl
                  md:text-5xl
                  lg:text-6xl
                  font-bold
                  leading-[1.1]
                  mb-6
                  text-foreground
                "
              >
                {t("hero.title.line1")}
                <br />

                {/* Highlighted line */}
                <motion.span className="relative block">
                  {/* Desktop-only background sweep */}
                  <motion.span
                    className="absolute inset-y-0 -z-10 hidden md:block"
                    style={{
                      background:
                        "linear-gradient(to right, transparent 0%, #FEB800 15%, #FEB800 70%, rgba(255,255,255,0.6) 85%, transparent 100%)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: "120vw",
                      originX: 0.5
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      delay: 1.5,
                      duration: 0.3,
                      ease: "easeOut"
                    }}
                  />

                  <motion.span
                    className="relative inline-block font-bold py-2 z-10"
                    initial={{ color: "#000" }}
                    animate={{
                      color: "#ffffff",
                      textShadow:
                        "0 10px 20px rgba(81,112,255,0.2)"
                    }}
                    transition={{
                      delay: 1.5,
                      duration: 0
                    }}
                  >
                    {t("hero.title.highlight")}
                  </motion.span>
                </motion.span>

                <span className="block">
                  {t("hero.title.line2")}
                </span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-xl leading-relaxed">
                {t("hero.subtitle.line1")}
                <br />
                {t("hero.subtitle.line2")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/book-demo">
                  <Button
                    size="lg"
                    className="h-14 px-8 text-lg rounded-full shadow-xl bg-primary text-white hover:bg-yellow-400 hover:text-black transition-all"
                  >
                    {t("hero.cta.primary")}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>

                <Link href="/services">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 px-8 text-lg rounded-full border-2"
                  >
                    {t("hero.cta.secondary")}
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Chat3D safe wrapper */}
            <div className="w-full max-w-full overflow-hidden">
              <Chat3D />
            </div>
          </div>
        </div>
      </section>

      {/* Sales Rep Steps */}
      <SalesRepSteps />

      {/* Conversion Pipeline */}
      <section className="py-32 md:py-48 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <PipelineChart />
        </div>
      </section>

      {/* Results Section */}
      <section className="pb-32 pt-16 bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col gap-4 flex-1">
              {[{
                isRange: true,
                start: 20,
                end: 30,
                finalStart: 40,
                finalEnd: 60,
                suffix: "%",
                label: t("results.metrics.replyRates.label"),
                duration: 2
              }].map((r, i) => (
                <div
                  key={i}
                  className="bg-card p-6 rounded-2xl border text-center"
                >
                  <AnimatedRangeCounter
                    start={r.start}
                    end={r.end}
                    finalStart={r.finalStart}
                    finalEnd={r.finalEnd}
                    duration={r.duration}
                    suffix={r.suffix}
                  />
                  <h3 className="font-bold mt-2">{r.label}</h3>
                </div>
              ))}
            </div>

            <motion.div
              className="p-8 rounded-2xl border text-center flex-1 min-h-[400px] bg-[#1c2973] text-white"
            >
              <AnimatedCounter
                start={10000}
                end={0}
                duration={5}
                format={(v) => `$${Math.round(v)}`}
                onFinishedChange={setIsFinished}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-32">
        <div className="container mx-auto px-4 md:px-6">
          <WorkflowVisualization />
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 bg-primary text-white">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            {t("bottomCta.title")}
          </h2>
          <Link href="/book-demo">
            <Button
              size="lg"
              className="h-14 px-10 rounded-full bg-white text-primary font-bold hover:bg-yellow-400"
            >
              {t("bottomCta.button")}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}