import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export default function BookDemo() {
  const { i18n } = useTranslation("bookDemo");

  const currentLanguage = i18n.language.split('-')[0];
  const calendarUrl = `https://calendar.app.google/uvWx5JWm7SLZSCqz7?hl=${currentLanguage}`;

  return (
    <div className="min-h-screen pb-20 bg-[#F9FAFC] dark:bg-background pt-16 md:pt-24 flex items-center">
      <div className="container mx-auto px-4 md:px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-4"
        >
          <h1 className="text-2xl font-bold tracking-tight">Pick a time that works.</h1>
          <div className="relative w-full h-[500px] md:h-[650px] bg-white dark:bg-card rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-100 dark:border-border overflow-hidden">
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
  );
}
