import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import AnimatedLogo3D from "@/components/AnimatedLogo3D";
import LeadReactivationAnimation from "@/components/LeadReactivationAnimation";
import { DottedSurface } from "@/components/ui/dotted-surface";
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
    <span className="inline-flex min-w-max">
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
  const { t, i18n } = useTranslation("about");
  const lang = i18n.language;
  const isDefaultLang = lang === "en";
  const [openFAQ, setOpenFAQ] = useState<{ catIndex: number; itemIndex: number } | null>(null);

  const cyclingWords =
    (t("intro.cyclingWords", { returnObjects: true }) as string[]) || [];

  const faqCategories =
    (t("faq.categories", { returnObjects: true }) as Array<{
      title: string;
      items: Array<{ q: string; a: string }>;
    }>) || [];

  const credentialItems =
    (t("credentials.items", { returnObjects: true }) as Array<{
      metric: string;
      label: string;
      description: string;
    }>) || [];


  return (
    <>
      <Seo />

      <div className="min-h-screen pt-[126px] text-center overflow-x-hidden bg-slate-50 dark:bg-muted">

        {/* Intro Section */}
        <div className="container mx-auto px-6 md:px-12 lg:px-16 xl:px-20 2xl:px-24 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto"
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-foreground">
              {t("intro.title")}
            </h1>

            {/* Animation — -mb-8 neutralises the component's own mb-12 */}
            <div className="w-full max-w-5xl mx-auto -mb-8">
              <LeadReactivationAnimation />
            </div>

            <div className="space-y-2 mt-2 w-full text-left">
              <p className="text-xl text-muted-foreground leading-relaxed">
                {t("intro.paragraph1")}
              </p>

              <p className="text-xl text-muted-foreground leading-relaxed">
                {t("intro.paragraph2")}
              </p>

              <p className="text-xl text-muted-foreground leading-relaxed">
                {t("intro.paragraph3")}{" "}
                <span className="inline-block">
                  {cyclingWords.length > 0 && (
                    <CyclingWord words={cyclingWords} />
                  )}
                </span>
              </p>
            </div>
          </motion.div>
        </div>

        {/* Founder + Credentials — merged section */}
        <section className="py-24 bg-gray-200 dark:bg-card/80 border-y border-border relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="container mx-auto px-6 md:px-12 lg:px-16 xl:px-20 2xl:px-24 relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="max-w-5xl mx-auto space-y-10"
            >
              {/* Big unified panel: founder + metrics + footnote */}
              <div className="bg-white/60 dark:bg-card/60 backdrop-blur-sm p-8 md:p-12 rounded-[2rem] border border-border shadow-xl space-y-10">

                {/* Section heading */}
                <h2 className="text-4xl font-bold text-center">
                  {t("credentials.title")}
                </h2>

                {/* Results tree: subtitle → "Real results." → stem → bar → cards */}
                <div className="pt-0">
                  {/* Subtitle with inline "Real results." — stem drops from it */}
                  <p className="text-lg text-muted-foreground text-center mb-8">
                    {t("credentials.subtitle")}{" "}
                    <span className="relative inline-block">
                      <span className="text-primary font-semibold underline underline-offset-4 decoration-2">
                        {t("credentials.resultsNode")}
                      </span>
                      <motion.div
                        className="absolute w-0.5 h-8 bg-primary/40"
                        style={{ transformOrigin: "top", top: "100%", left: "50%", marginLeft: "-1px" }}
                        initial={{ scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </span>
                  </p>

                  {/* Metric cards with drawing connector */}
                  <div className="relative">
                    {/* Bar grows from the stem position outward */}
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, delay: 0.6, ease: "easeOut" }}
                      style={{
                        transformOrigin: "87.5% 0",
                        left: "calc((100% - 3 * 1.25rem) / 8)",
                        right: "calc((100% - 3 * 1.25rem) / 8)",
                      }}
                      className="absolute top-0 h-0.5 bg-primary/40"
                    />
                    {/* Tick marks row — same grid as cards so each tick is auto-centered in its column */}
                    <div className="hidden lg:grid grid-cols-4 gap-5 h-8">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex justify-center">
                          <motion.div
                            className="w-px bg-primary/40"
                            initial={{ height: 0 }}
                            whileInView={{ height: 32 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: 2.0 + i * 0.16, ease: "easeOut" }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {credentialItems.map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.0, delay: 2.4 + i * 0.24, ease: "easeOut" }}
                          className="px-4 py-5 text-left bg-white/70 dark:bg-card/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <div className="text-3xl font-bold text-primary mb-1 text-center">{item.metric}</div>
                          <div className="text-sm font-semibold text-foreground mb-2">{item.label}</div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recognition footnote */}
                <motion.p
                  className="text-sm text-muted-foreground text-center italic"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.0, delay: 3.6 }}
                >
                  {t("credentials.recognition")}
                </motion.p>

                <motion.hr
                  className="border-border/50"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 3.9 }}
                />

                {/* Founder identity + quote */}
                <motion.div
                  className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-8"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 4.0 }}
                >
                  <div className="w-60 h-60 shrink-0 relative flex items-center justify-center">
                    <div className="scale-[0.80]">
                      <AnimatedLogo3D />
                    </div>
                  </div>
                  <div className="flex-grow space-y-4 text-left">
                    <h3 className="text-lg md:text-2xl font-bold text-foreground text-center md:text-left">
                      {t("founder.name")}
                    </h3>
                    <p className="text-sm font-semibold uppercase tracking-wider text-primary text-center md:text-left">
                      {t("founder.title")}
                    </p>
                    <p className="italic border-l-4 border-primary/30 pl-6 text-[19px] text-foreground/80 text-justify">
                      {t("founder.quote")}
                    </p>
                  </div>
                </motion.div>

              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <div className="container mx-auto px-6 md:px-12 lg:px-16 xl:px-20 2xl:px-24 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto"
          >
            <div className="bg-white dark:bg-card rounded-3xl p-8 md:p-12">
              <h2 className="text-4xl font-bold mb-12 text-left">
                {t("faq.title")}
              </h2>

              <div className="space-y-12">
                {faqCategories.map((category, catIndex) => (
                  <div key={category.title} className="space-y-6">
                    <h3 className="text-2xl font-bold text-left text-primary flex items-center gap-3">
                      <div className="w-2 h-8 bg-primary rounded-full" />
                      {category.title}
                    </h3>
                    <div className="space-y-4">
                      {category.items.map((faq, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="border border-border rounded-2xl bg-white dark:bg-card overflow-hidden transition-all duration-300 hover:shadow-md"
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

        {/* CTA */}
        <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
          <DottedSurface className="opacity-60" />
          <div className="container mx-auto px-6 md:px-12 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-4xl mx-auto"
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-10 text-white tracking-tight leading-tight">
                {t("cta.title")}
              </h2>

              <Link href={isDefaultLang ? "/book-demo" : `/${lang}/book-demo`}>
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg rounded-full shadow-xl shadow-primary/20 bg-white text-primary hover:bg-yellow-400 hover:text-black hover:shadow-yellow-400/35 transition-all font-bold"
                >
                  {t("cta.button")}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

      </div>
    </>
  );
}
