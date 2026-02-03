import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import AnimatedLogo3D from "@/components/AnimatedLogo3D";
import LeadReactivationAnimation from "@/components/LeadReactivationAnimation";
import Seo from "@/Seo";

const CyclingWord = ({
  words,
  duration = 3000,
}: {
  words: string[];
  duration?: number;
}) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((prev) => (prev + 1) % words.length),
      duration
    );
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
  const [openFAQ, setOpenFAQ] = useState<{ catIndex: number; itemIndex: number } | null>(null);

  const cyclingWords =
    (t("intro.cyclingWords", { returnObjects: true }) as string[]) || [];
  
  const faqCategories =
    (t("faq.categories", { returnObjects: true }) as Array<{
      title: string;
      items: Array<{ q: string; a: string }>;
    }>) || [];

  return (
    <>
      {/* SEO / hreflang hook */}
      <Seo />

      <div className="min-h-screen pt-24 pb-20 text-center overflow-x-hidden">
        <div className="container mx-auto px-6 md:px-12 lg:px-16 xl:px-20 2xl:px-24">

          {/* Intro Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="
              w-full
              max-w-none
              md:max-w-5xl
              mx-auto
              mb-16
            "
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900">
              {t("intro.title")}
            </h1>

            {/* CHATBOX — MOBILE FULL WIDTH */}
            <div className="mt-0 mb-0">
              <div className="w-full max-w-5xl mx-auto">
                <LeadReactivationAnimation />
              </div>
            </div>

            <div className="space-y-2 mt-1 w-full text-left">
              <p className="-mt-10 text-xl text-muted-foreground leading-relaxed">
                {t("intro.paragraph1")}
              </p>

              <p className="text-xl text-muted-foreground leading-relaxed">
                {t("intro.paragraph2")}
              </p>

              <p className="text-xl text-muted-foreground leading-relaxed">
                {t("intro.paragraph3")}{" "}
                <span className="text-primary font-bold inline-block">
                  {cyclingWords.length > 0 && (
                    <CyclingWord words={cyclingWords} />
                  )}
                </span>
              </p>
            </div>
          </motion.div>

          {/* Meet the Founder */}
          <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] mr-[50vw] bg-[#E5E7EB] py-24 mb-20 overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "radial-gradient(#000 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <div className="container mx-auto px-4 md:px-8 lg:px-12 xl:px-16 2xl:px-20 relative text-left">
              <div className="max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                >
                  <div className="relative bg-white/40 backdrop-blur-sm p-8 md:p-12 rounded-[2rem] border shadow-xl flex flex-col md:flex-row items-center gap-12">
                    <div
                      className="
                        w-56
                        h-72
                        md:w-64
                        md:h-64
                        shrink-0
                        relative
                        flex
                        items-center
                        justify-center
                      "
                    >
                      <div className="translate-y-6 md:translate-y-0">
                        <AnimatedLogo3D />
                      </div>
                    </div>
                    <div className="flex-grow space-y-4">
                      <h3 className="text-3xl md:text-4xl font-bold text-gray-900 text-center md:text-left">
                        {t("founder.name")}
                      </h3>
                      <p className="text-sm font-semibold uppercase tracking-wider text-primary text-center md:text-left">
                        {t("founder.title")}
                      </p>
                      <p className="italic border-l-4 border-primary/30 pl-6 text-[19px]">
                        {t("founder.quote")}
                      </p>
                      <p className="text-lg text-gray-600">
                        {t("founder.description")}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto mb-24"
          >
            <div className="bg-card/50 border rounded-3xl p-8 md:p-12">
              <h2 className="text-4xl font-bold mb-12 text-left">
                {t("faq.title")}
              </h2>

              <div className="space-y-12">
                {faqCategories.map((category, catIndex) => (
                  <div key={catIndex} className="space-y-6">
                    <h3 className="text-2xl font-bold text-left text-primary flex items-center gap-3">
                      <div className="w-2 h-8 bg-primary rounded-full" />
                      {category.title}
                    </h3>
                    <div className="space-y-4">
                      {category.items.map((faq, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="border rounded-2xl bg-background overflow-hidden transition-all duration-300 hover:shadow-md"
                        >
                          <button
                            onClick={() =>
                              setOpenFAQ(
                                openFAQ?.catIndex === catIndex &&
                                  openFAQ?.itemIndex === itemIndex
                                  ? null
                                  : { catIndex, itemIndex }
                              )
                            }
                            className="w-full flex justify-between items-center p-6 gap-4"
                          >
                            <h4 className="text-lg font-medium text-left">
                              {faq.q}
                            </h4>
                            <ChevronDown
                              className={`w-5 h-5 shrink-0 transition-transform duration-300 ${
                                openFAQ?.catIndex === catIndex &&
                                openFAQ?.itemIndex === itemIndex
                                  ? "rotate-180"
                                  : ""
                              }`}
                            />
                          </button>
                          <AnimatePresence>
                            {openFAQ?.catIndex === catIndex &&
                              openFAQ?.itemIndex === itemIndex && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <div className="px-6 pb-6 text-left text-muted-foreground leading-relaxed">
                                    {faq.a}
                                  </div>
                                </motion.div>
                              )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
