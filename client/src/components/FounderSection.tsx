import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import founderHeroImg from "@/assets/Project (20260508053902).png";

type CredentialItem = { metric: string; label: string; description: string; logoKey?: string };

function TracingCard({ item, i }: { item: CredentialItem; i: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const ref = (el: HTMLDivElement | null) => {
    if (el) {
      const { width, height } = el.getBoundingClientRect();
      if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
    }
  };
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: i * 0.12, ease: "easeOut" }}
      className="relative px-5 py-6 text-left bg-white dark:bg-card/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3"
    >
      {size.w > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ borderRadius: "1rem" }}>
          <motion.rect
            x="1" y="1"
            width={size.w - 2} height={size.h - 2}
            rx="16" ry="16"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: [0, 1], opacity: [0, 1, 1, 0] }}
            viewport={{ once: true }}
            transition={{
              pathLength: { duration: 1.8, delay: i * 0.15 + 0.3, ease: "easeInOut" },
              opacity: { duration: 2.2, delay: i * 0.15 + 0.3, times: [0, 0.05, 0.75, 1] },
            }}
          />
        </svg>
      )}
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[22px] font-bold text-primary leading-none">{item.metric}</p>
          {item.logoKey && (
            <img
              src={`/logos/credibility/${item.logoKey}.svg`}
              alt={item.label}
              className="h-5 w-auto opacity-40 grayscale shrink-0 mt-0.5"
            />
          )}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
        <div className="h-px bg-border/60" />
        <p className="text-[12px] text-foreground/65 leading-relaxed">{item.description}</p>
      </div>
    </motion.div>
  );
}

export default function FounderSection() {
  const { t } = useTranslation("about");

  const credentialItems =
    (t("credentials.items", { returnObjects: true }) as Array<CredentialItem>) || [];

  return (
    <section className="bg-slate-200 dark:bg-zinc-900 overflow-hidden relative">
      {/* Full-width primary band — extends wall-to-wall, clipped by overflow-hidden */}
      <div className="absolute inset-x-0 top-20 bottom-[70px] bg-primary" />

      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-end relative">

        {/* Photo — floats over the band */}
        <div className="relative z-10 w-full md:w-[480px] flex-shrink-0 flex justify-center items-end h-[560px]">
          <img
            src={founderHeroImg}
            alt={t("founder.name")}
            className="h-full w-auto object-contain object-bottom"
          />
        </div>

        {/* White card — narrower, taller than the band via my-8 */}
        <div className="relative z-10 w-full md:w-[380px] flex-shrink-0 bg-white dark:bg-card shadow-2xl py-14 px-10 my-6 md:my-8 text-left flex flex-col justify-center">
          <div className="space-y-1 mb-8">
            <p className="text-3xl font-light text-foreground">Hi, I'm</p>
            <h2 className="text-[40px] md:text-[44px] font-bold text-foreground leading-tight">
              {t("founder.name")}.
            </h2>
          </div>

          <div className="flex gap-5">
            <div className="w-[3px] rounded-full bg-primary flex-shrink-0 self-stretch" />
            <div className="space-y-4">
              <p className="text-[16px] font-semibold text-foreground leading-snug">
                {t("founder.tagline")}
              </p>
              <p className="text-[14px] text-muted-foreground leading-relaxed">
                {t("founder.body")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Proof cards */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 pb-16 pt-10 relative">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {credentialItems.map((item, i) => (
            <TracingCard key={i} item={item} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
