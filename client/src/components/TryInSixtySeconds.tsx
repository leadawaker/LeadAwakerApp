import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";
import i18n from "@/i18n";

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

function HereIsHow() {
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const text = "Here is how";

  useEffect(() => {
    indexRef.current = 0;
    setDisplayText("");
    setDone(false);

    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayText(prev => {
          const newIndex = prev.length;
          if (newIndex >= text.length) {
            clearInterval(interval);
            setDone(true);
            return prev;
          }
          return prev + text[newIndex];
        });
      }, 75);

      return () => clearInterval(interval);
    }, 500);

    return () => clearTimeout(timeout);
  }, [text]);

  useEffect(() => {
    if (done) {
      let count = 0;
      const blink = setInterval(() => {
        setShowCursor(v => !v);
        if (++count > 6) { clearInterval(blink); setShowCursor(false); }
      }, 400);
      return () => clearInterval(blink);
    } else {
      const blink = setInterval(() => setShowCursor(v => !v), 530);
      return () => clearInterval(blink);
    }
  }, [done]);

  return (
    <div style={{ padding: "20px 0 8px", display: "flex", justifyContent: "center" }}>
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "#5046e5" }}>
        {displayText}
        <span style={{ opacity: showCursor ? 1 : 0, transition: "opacity 0.05s", fontWeight: 300 }}>|</span>
      </span>
    </div>
  );
}

function UniversalDemoForm() {
  const { t } = useTranslation("home");
  const lang = i18n.language.split("-")[0] as "en" | "nl" | "pt";
  const submitLang: "en" | "nl" | "pt" = (["en", "nl", "pt"] as const).includes(lang) ? lang : "en";

  const [firstName, setFirstName] = useState("");
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [focused, setFocused] = useState(false);

  const placeholders = t("hero.demoForm.nichePlaceholders", { returnObjects: true }) as string[];

  useEffect(() => {
    if (focused) return;
    const iv = setInterval(() => setPlaceholderIdx((i) => (i + 1) % placeholders.length), 4000);
    return () => clearInterval(iv);
  }, [focused, placeholders.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || niche.trim().length < 5) {
      setError(t("hero.demoForm.errors.missingFields"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/demo/create-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), niche: niche.trim(), language: submitLang }),
      });
      if (res.status === 429) { setError(t("hero.demoForm.errors.rateLimited")); setLoading(false); return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.message || t("hero.demoForm.errors.generic")); setLoading(false); return; }
      const data = await res.json();
      window.location.href = data.whatsappUrl;
    } catch {
      setError(t("hero.demoForm.errors.network"));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-lg mx-auto lg:mx-0">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder={t("hero.demoForm.firstNamePlaceholder")}
          className="flex-shrink-0 w-full sm:w-36 px-4 py-3 rounded-full border border-input bg-white dark:bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          maxLength={80}
        />
        <input
          type="text"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder={Array.isArray(placeholders) ? placeholders[placeholderIdx] ?? "" : ""}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 px-4 py-3 rounded-full border border-input bg-white dark:bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          maxLength={300}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-[#25D366] hover:bg-[#20BC5A] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-3 rounded-full transition inline-flex items-center justify-center gap-1.5"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <MessageSquare className="w-4 h-4" />
        )}
        {t("hero.demoForm.submit")}
      </button>
      {error && <p className="text-xs text-red-600 px-1">{error}</p>}
      <p className="text-xs text-muted-foreground px-1">{t("hero.demoForm.fineprint")}</p>
    </form>
  );
}

export default function TryInSixtySeconds() {
  const { t } = useTranslation("home");

  return (
    <section className="bg-[#f7f7fb] dark:bg-background pb-48 pt-16">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid gap-12 lg:grid-cols-2 lg:gap-30 items-center max-w-5xl mx-auto"
        >
          {/* Left: copy + CTA */}
          <div className="text-center lg:text-left">
            <div className="flex justify-center lg:justify-start mb-0">
              <HereIsHow />
            </div>
            <h2 className="font-bold text-4xl md:text-[47px] lg:text-[59px] leading-tight mb-4 text-foreground">
              {t("trySixty.title")}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8 max-w-md mx-auto lg:mx-0">
              {t("trySixty.subtitle")}
            </p>
            <UniversalDemoForm />
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
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-white rounded-t-2xl -mx-6 -mt-6 px-6 pt-6">
              <div className="w-16 h-16 rounded-full bg-white ring-1 ring-zinc-200 dark:ring-zinc-700 flex items-center justify-center overflow-hidden">
                <img
                  src="/6.%20Favicon.svg"
                  alt="LeadAwaker"
                  className="w-12 h-12 object-contain"
                  style={{ marginTop: "-3px" }}
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
