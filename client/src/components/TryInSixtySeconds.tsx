import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="typing">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-[bounce_1.2s_infinite] [animation-delay:-0.32s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-[bounce_1.2s_infinite] [animation-delay:-0.16s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-[bounce_1.2s_infinite]" />
    </span>
  );
}

function MockChatBubbles() {
  const { t } = useTranslation("home");

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Customer bubble — far left */}
      <div className="flex justify-start">
        <div className="relative max-w-[80%] bg-white dark:bg-card text-gray-900 dark:text-foreground rounded-2xl rounded-bl-none px-4 py-2.5 bubble-shadow text-sm leading-snug">
          {t("trySixty.mockChat.customer1")}
          <span
            aria-hidden="true"
            className="absolute bottom-0 -left-[6px] w-0 h-0 border-t-[9px] border-t-transparent border-r-[8px] border-r-white dark:border-r-[#243249]"
          />
        </div>
      </div>

      {/* AI reply — right */}
      <div className="flex justify-end">
        <div className="relative max-w-[80%] bg-[#D9FDD3] dark:bg-[#1a2e1f] text-gray-900 dark:text-foreground rounded-2xl rounded-br-none px-4 py-2.5 bubble-shadow text-sm leading-snug">
          {t("trySixty.mockChat.ai1")}
          <span
            aria-hidden="true"
            className="absolute bottom-0 -right-[6px] w-0 h-0 border-t-[9px] border-t-transparent border-l-[8px] border-l-[#D9FDD3] dark:border-l-[#1a2e1f]"
          />
        </div>
      </div>

      {/* Customer follow-up — far left */}
      <div className="flex justify-start">
        <div className="relative max-w-[80%] bg-white dark:bg-card text-gray-900 dark:text-foreground rounded-2xl rounded-bl-none px-4 py-2.5 bubble-shadow text-sm leading-snug">
          {t("trySixty.mockChat.customer2")}
          <span
            aria-hidden="true"
            className="absolute bottom-0 -left-[6px] w-0 h-0 border-t-[9px] border-t-transparent border-r-[8px] border-r-white dark:border-r-[#243249]"
          />
        </div>
      </div>

      {/* Customer is typing another message — left */}
      <div className="flex justify-start">
        <div className="relative bg-white dark:bg-card rounded-2xl rounded-bl-none px-4 py-2.5 bubble-shadow text-sm leading-snug">
          <TypingDots />
          <span
            aria-hidden="true"
            className="absolute bottom-0 -left-[6px] w-0 h-0 border-t-[9px] border-t-transparent border-r-[8px] border-r-white dark:border-r-[#243249]"
          />
        </div>
      </div>
    </div>
  );
}

export default function TryInSixtySeconds() {
  const { t } = useTranslation("home");

  return (
    <section className="py-48 bg-[#F9FAFC] dark:bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center max-w-5xl mx-auto"
        >
          {/* Left: copy + CTA */}
          <div className="text-center lg:text-left">
            <h2 className="font-bold text-[32px] md:text-[40px] lg:text-[46px] leading-tight mb-4 text-foreground">
              {t("trySixty.title")}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8 max-w-md mx-auto lg:mx-0">
              {t("trySixty.subtitle")}
            </p>
            <Link href="/try">
              <Button
                size="lg"
                className="h-14 px-8 text-lg rounded-full transition-all duration-200 hover:bg-[#FEB800] hover:text-[#1a1a1a] hover:border-[#FEB800] hover:[box-shadow:0_0_40px_12px_rgba(254,184,0,0.6)]"
              >
                {t("trySixty.cta")}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>

          {/* Right: mock chat */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-6 shadow-md"
          >
            {/* Phone-style header */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-700">
              <div className="w-16 h-16 rounded-full bg-white ring-1 ring-zinc-200 dark:ring-zinc-700 flex items-center justify-center overflow-hidden">
                <img
                  src="/6.%20Favicon.svg"
                  alt="LeadAwaker"
                  className="w-12 h-12 object-contain"
                />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground leading-none">LeadAwaker AI</p>
                <p className="text-sm text-muted-foreground mt-1">online</p>
              </div>
            </div>
            <MockChatBubbles />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
