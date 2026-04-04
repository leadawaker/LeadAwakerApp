import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import LeadReactivationAnimation from "@/components/LeadReactivationAnimation";
import { DottedSurface } from "@/components/ui/dotted-surface";
import Seo from "@/Seo";
import profileImg from "@/assets/profile.webp";

export default function About() {
  const { t, i18n } = useTranslation("about");
  const lang = i18n.language;
  const isDefaultLang = lang === "en";
  const [openFAQ, setOpenFAQ] = useState<{ catIndex: number; itemIndex: number } | null>(null);

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

        {/* The Problem — now first, plain white background */}
        <div className="container mx-auto px-6 md:px-12 lg:px-16 xl:px-20 2xl:px-24 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-6xl mx-auto space-y-14"
          >
                <h2 className="text-4xl md:text-[57px] font-bold text-center">
                  {t("credentials.title")}
                </h2>

                {/* Leaking bucket illustration */}
                <div className="flex justify-center">
                  <img
                    src="/images/leaking-bucket.png?v=7"
                    alt="Leaking bucket illustration"
                    className="w-full max-w-sm system-dark-hidden"
                  />
                  <img
                    src="/images/leaking-bucket-dark.png?v=1"
                    alt="Leaking bucket illustration"
                    className="w-full max-w-sm hidden system-dark-block"
                  />
                </div>

                {/* Founder */}
                <motion.div
                  className="flex flex-col md:flex-row items-start gap-8"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                >
                  <img
                    src={profileImg}
                    alt={t("founder.name")}
                    className="w-50 h-43 shrink-0 rounded-2xl object-cover shadow-md"
                  />
                  <div className="flex-grow space-y-4 text-left">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-lg md:text-2xl font-bold text-foreground">
                        {t("founder.name")}
                      </h3>
                      <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                        {t("founder.title")}
                      </p>
                    </div>
                    <p className="italic border-l-4 border-primary/30 pl-6 text-[17px] md:text-[19px] text-foreground/80">
                      {t("founder.quote")}
                    </p>
                  </div>
                </motion.div>

                {/* Credential cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {credentialItems.map((item, i) => {
                    const TracingCard = () => {
                      const [size, setSize] = useState({ w: 0, h: 0 });
                      const ref = (el: HTMLDivElement | null) => {
                        if (el) {
                          const { width, height } = el.getBoundingClientRect();
                          if (width !== size.w || height !== size.h) {
                            setSize({ w: width, h: height });
                          }
                        }
                      };

                      return (
                        <motion.div
                          key={i}
                          ref={ref}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, delay: i * 0.3, ease: "easeOut" }}
                          className="relative px-4 py-5 text-left bg-white/70 dark:bg-card/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          {/* SVG border trace */}
                          {size.w > 0 && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ borderRadius: "1rem" }}>
                              <motion.rect
                                x="1"
                                y="1"
                                width={size.w - 2}
                                height={size.h - 2}
                                rx="16"
                                ry="16"
                                fill="none"
                                stroke="hsl(var(--primary))"
                                strokeWidth="2"
                                initial={{ pathLength: 0, opacity: 0 }}
                                whileInView={{
                                  pathLength: [0, 1],
                                  opacity: [0, 1, 1, 0],
                                }}
                                viewport={{ once: true }}
                                transition={{
                                  pathLength: { duration: 1.8, delay: i * 0.4 + 0.3, ease: "easeInOut" },
                                  opacity: { duration: 2.2, delay: i * 0.4 + 0.3, times: [0, 0.05, 0.75, 1] },
                                }}
                              />
                            </svg>
                          )}
                          <div className="relative z-10">
                            <div className="text-[28px] font-bold text-primary mb-1 text-center">{item.metric}</div>
                            <div className="text-[12px] font-semibold text-foreground mb-2 text-center">{item.label}</div>
                            <p className="text-[12px] text-muted-foreground leading-relaxed">{item.description}</p>
                          </div>
                        </motion.div>
                      );
                    };

                    return <TracingCard key={i} />;
                  })}
                </div>
          </motion.div>
        </div>

        {/* What We Care About — gray background with white card */}
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-6xl mx-auto"
            >
              <div className="bg-white/60 dark:bg-card/60 backdrop-blur-sm p-8 md:p-12 rounded-[2rem] border border-border shadow-xl space-y-10 overflow-hidden">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-foreground text-center">
                  {t("intro.title")}{" "}
                  <span className="text-primary">{t("intro.titleHighlight")}</span>
                </h1>

                <p className="text-xl text-muted-foreground leading-relaxed text-center max-w-4xl mx-auto">
                  {t("intro.paragraph1")} {t("intro.paragraph2")}
                </p>

                {/* Animation as visual payoff */}
                <div className="w-full max-w-5xl mx-auto -mb-4">
                  <LeadReactivationAnimation />
                </div>

                <p className="text-xl text-foreground font-semibold leading-relaxed text-center">
                  {t("intro.paragraph3")}
                </p>
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
            className="max-w-6xl mx-auto"
          >
            <div className="bg-white dark:bg-card rounded-3xl p-8 md:p-12 shadow-xl">
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
