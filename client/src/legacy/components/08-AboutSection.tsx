import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import founderHeroImg from "../assets/founder_photos.webp";
import LeadReactivationAnimation from "./09-LeadReactivationAnimation";
import embracerLogo from "../assets/logos/credibility/embracer.svg";
import segaLogo from "../assets/logos/credibility/sega.svg";
import warnerBrosLogo from "../assets/logos/credibility/warnerbros.svg";

const CREDIBILITY_LOGOS: Record<string, string> = { embracer: embracerLogo, sega: segaLogo, warnerbros: warnerBrosLogo };

type CredentialItem = { metric: string; label: string; description: string; logoKey?: string };

function CredentialsCard({ items, t }: { items: CredentialItem[]; t: (key: string) => string }) {
  return (
    <div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground mb-3"
      >
        {t("credentials.experienceLabel")}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="flex flex-col"
      >
        <div className="flex flex-col">
          {items.map((item, i) => (
            <div key={i}>
              {i > 0 && <div className="h-px bg-border/60 my-4" />}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[18px] font-bold text-primary leading-none">{item.metric}</p>
                  {item.logoKey && (
                    <img
                      src={CREDIBILITY_LOGOS[item.logoKey!]}
                      alt={item.label}
                      className={`${item.logoKey === "warnerbros" ? "h-7" : "h-5"} w-auto opacity-40 grayscale shrink-0 mt-0.5`}
                    />
                  )}
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="text-[11px] text-foreground/65 leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default function AboutSection() {
  const { t } = useTranslation("about");

  const credentialItems =
    (t("credentials.items", { returnObjects: true }) as Array<CredentialItem>) || [];

  return (
    <section className="bg-slate-200 dark:bg-zinc-900 overflow-hidden relative pt-40 pb-40">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-stretch relative">

        {/* Left column: photo + stacked proof cards */}
        <div className="relative z-10 md:ml-10 w-full md:w-[480px] flex-shrink-0 flex flex-col">

          {/* Photo with blue band behind — band extends freely, only the photo is clipped */}
          <div className="relative flex justify-center items-end h-[500px]">
            <div className="absolute inset-x-[-10000px] top-[120px] bottom-[50px] bg-primary z-0" />
            <img
              src={founderHeroImg}
              alt={t("founder.name")}
              className="relative z-10 h-full w-auto object-contain object-bottom"
              style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 70% 100%, 58% 95%, 0% 95%)"}}
            />
          </div>

          {/* Merged credentials card */}
          <div className="pt-6 pr-4">
            <CredentialsCard items={credentialItems} t={t} />
          </div>
        </div>

        {/* Right column: wrapper stretches full height, card fills it */}
        <div className="flex flex-col pt-[30px] md:ml-20 w-full md:w-[500px] flex-shrink-0">
        <div className="relative z-10 w-full rounded-2xl shadow-sm flex-1 bg-white dark:bg-card px-10 pb-0 text-left flex flex-col overflow-hidden">

          <div className="pt-14 pb-8">
            <h2 className="text-[40px] md:text-[54px] text-foreground leading-tight mb-8">
              <span className="font-light">Hi, I'm </span>
              <br />
              <span className="font-bold whitespace-nowrap">{t("founder.name")}</span>
            </h2>

            {/* Single dash + bold tagline */}
            <div className="flex items-start gap-4 mb-6">
              <div className="h-[3px] w-10 rounded-full bg-primary flex-shrink-0 mt-[10px]" />
              <p className="text-[15px] font-bold text-foreground leading-snug">
                {t("founder.tagline")}
              </p>
            </div>

            {/* Body paragraphs */}
            <div className="space-y-4 pl-[56px]">
              <p className="text-[13px] text-muted-foreground leading-relaxed">{t("founder.body1")}</p>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{t("founder.body2")}</p>
              <p className="text-[14px] text-muted-foreground leading-relaxed">{t("founder.body3")}</p>
            </div>
          </div>

          {/* Animation centered in remaining space below paragraphs */}
          <div className="flex-1 flex items-center justify-center py-8">
            <LeadReactivationAnimation />
          </div>
        </div>
        </div>

      </div>
    </section>
  );
}
