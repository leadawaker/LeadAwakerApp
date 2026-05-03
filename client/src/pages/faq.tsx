import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DottedSurface } from "@/components/ui/dotted-surface";
import Seo from "@/Seo";

export default function FAQ() {
  const { t, i18n } = useTranslation("about");
  const lang = i18n.language;
  const isDefaultLang = lang === "en";
  const [openFAQ, setOpenFAQ] = useState<{ catIndex: number; itemIndex: number } | null>(null);

  const faqCategories =
    (t("faq.categories", { returnObjects: true }) as Array<{
      title: string;
      items: Array<{ q: string; a: string }>;
    }>) || [];

  return (
    <>
      <Seo />

      <div className="min-h-screen pt-[126px] text-center overflow-x-hidden bg-slate-50 dark:bg-muted">

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

              <Link href={isDefaultLang ? "/book-call" : `/${lang}/book-call`}>
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
