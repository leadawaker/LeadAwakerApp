import { motion } from "framer-motion";
import { Calendar, Shield, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function BookDemo() {
  const { t, i18n } = useTranslation("bookDemo");

  // Get current language and create calendar URL with language parameter
  const currentLanguage = i18n.language.split('-')[0]; // Gets 'pt' from 'pt-BR'
  const calendarUrl = `https://calendar.app.google/uvWx5JWm7SLZSCqz7?hl=${currentLanguage}`;

  return (
    <div className="min-h-screen pb-20 bg-[#F9FAFC] dark:bg-background pt-16 md:pt-24 flex items-center">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 items-start">
          {/* Left — Value proposition */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="order-last lg:order-first"
          >
            <h1 className="text-[28px] sm:text-[36px] md:text-[52px] font-bold leading-tight tracking-tight mb-6">
              {t("hero.title")}
            </h1>
            <p className="text-xl text-muted-foreground mb-10">
              {t("hero.subtitle")}
            </p>

            <div className="space-y-5 md:space-y-7 mb-10">
              <div className="flex gap-4">
                <div className="w-11 h-11 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">{t("benefits.demo.title")}</h3>
                  <p className="text-muted-foreground text-[15px]">{t("benefits.demo.description")}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-11 h-11 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-1">{t("benefits.noCommitment.title")}</h3>
                  <p className="text-muted-foreground text-[15px]">{t("benefits.noCommitment.description")}</p>
                </div>
              </div>
            </div>

          </motion.div>

          {/* Right — Calendar embed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-col gap-3 order-first lg:order-last"
          >
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {t("calendar.title")}
            </p>
            <div className="relative w-full h-[500px] md:h-[600px] bg-white dark:bg-card rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-100 dark:border-border overflow-hidden">
              <iframe
                src={calendarUrl}
                style={{ border: 0 }}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="calendar"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
