import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Rocket, Target, Code2, TrendingUp, Briefcase, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import AnimatedLogo3D from "@/components/AnimatedLogo3D";
import LeadReactivationAnimation from "@/components/LeadReactivationAnimation";

const CyclingWord = ({ words, duration = 3000 }: { words: string[], duration?: number }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, duration);
    return () => clearInterval(timer);
  }, [words, duration]);

  return (
    <span className="inline-flex min-w-[8rem]">
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="text-primary font-bold"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

export default function About() {
  const { t } = useTranslation("about");
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);



  // AFTER (fixed):
  const cyclingWords = (t("intro.cyclingWords", { returnObjects: true }) as string[]) || [];
  const faqs = (t("faqs", { returnObjects: true }) as Array<{ q: string; a: string }>) || [];


  return (
    <div className="min-h-screen pt-24 pb-20 text-center">
      <div className="container mx-auto px-4 md:px-6">

        {/* 1. Intro Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-16"
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-center text-slate-900">
            {t("intro.title")}
          </h1>

          <div className="flex justify-center mt-0 mb-0">
            <LeadReactivationAnimation />
          </div>

          <div className="space-y-2 mt-1 w-full text-center"> {/* space-y-8 for more breathing room */}
            {/* Paragraph 1 */}
            <p className="-mt-10 text-xl text-muted-foreground leading-relaxed">
              {t("intro.paragraph1")}
            </p>

            {/* Paragraph 2 */}
            <p className="text-xl text-muted-foreground leading-relaxed text-justify">
              {t("intro.paragraph2")}
            </p>

            {/* Paragraph 3 with cycling animation - SIMPLIFIED */}
            <p className="text-xl text-muted-foreground leading-relaxed">
              {t("intro.paragraph3")}{' '}
              <span className="text-primary font-bold inline-block">
                {cyclingWords.length > 0 && <CyclingWord words={cyclingWords} />}
              </span>
            </p>
          </div>
        </motion.div>

        {/* 2. Meet the Founder */}
        <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] mr-[50vw] bg-[#E5E7EB] py-24 mb-20 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="container mx-auto px-4 md:px-6 relative text-left">
            <div className="max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <div className="relative group">
                  <div className="absolute -inset-4 bg-primary/5 rounded-[2rem] blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
                  <div className="relative bg-white/40 backdrop-blur-sm p-8 md:p-12 rounded-[2rem] border border-white/50 shadow-xl flex flex-col md:flex-row items-center gap-12">
                    <div className="relative shrink-0">
                      <div className="w-56 h-56 md:w-64 md:h-64">
                        <AnimatedLogo3D />
                      </div>
                    </div>
                    <div className="flex-grow space-y-4">
                      <div className="space-y-1 text-center md:text-left mt-4 md:mt-0">
                        <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                          {t("founder.name")}
                        </h3>
                        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                          {t("founder.title")}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <p className="text-gray-800 font-medium italic border-l-4 border-primary/30 pl-6 text-[19px] leading-snug">
                          {t("founder.quote")}
                        </p>
                        <p className="text-lg text-gray-600 leading-relaxed font-light">
                          {t("founder.description")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <hr className="border-border mb-20" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto mb-24"
        >
          <div className="bg-card/50 border border-border rounded-3xl p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-10 text-left">{t("faq.title")}</h2>
            <div className="space-y-4">

              {Array.isArray(faqs) && faqs.map((faq, i) => (

                <div
                  key={i}
                  className="border border-border rounded-2xl overflow-hidden bg-background"
                >
                  <button
                    onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                    className="w-full flex items-center justify-between p-6 hover:bg-muted/50 transition-colors group"
                  >
                    <h3 className="text-lg font-medium text-left group-hover:text-primary transition-colors">
                      {faq.q}
                    </h3>
                    <ChevronDown
                      className={`w-5 h-5 text-primary transition-transform duration-300 ${
                        openFAQ === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFAQ === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-6 pb-6 text-muted-foreground border-t border-border pt-4 text-left"
                    >
                      <p className="text-base leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
