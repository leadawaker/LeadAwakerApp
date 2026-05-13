import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Dumbbell, Smile, Briefcase, GraduationCap, ArrowRight } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { Link } from "wouter";
import ChatCard2D from "@/components/ChatCard2D";
import { Button } from "@/components/ui/button";
import i18n from "@/i18n";

type Campaign = { id: number; key: string; niche: string; emoji: string };

type MessageItem = {
  type: "agent" | "user" | "system";
  sender?: string;
  content: string;
  time?: string;
  id?: string;
};

const DEMO_CAMPAIGNS: Campaign[] = [
  { id: 47, key: "solar", niche: "Solar installer follow-up", emoji: "☀️" },
  { id: 50, key: "coaching", niche: "Coaching enrollment", emoji: "🎓" },
  { id: 57, key: "gym", niche: "Gym membership reactivation", emoji: "🏋️" },
  { id: 58, key: "dental", niche: "Dental checkup reactivation", emoji: "🦷" },
  { id: 59, key: "legal", niche: "Accident claim reactivation", emoji: "⚖️" },
];

const CAMPAIGN_TO_CASE_KEY: Record<string, string> = {
  solar: "solarPanel",
  coaching: "coaching",
  gym: "gym",
  dental: "dental",
  legal: "lawFirm",
};

const CASE_VISUALS: Record<string, { color: string; darkColor: string; icon: React.ReactNode; leadFullName: string }> = {
  solarPanel: { color: "#10B981", darkColor: "#047857", icon: <Sun className="w-5 h-5" />, leadFullName: "James Walker" },
  gym: { color: "#8B5CF6", darkColor: "#7C3AED", icon: <Dumbbell className="w-5 h-5" />, leadFullName: "Mark Evans" },
  dental: { color: "#E11D48", darkColor: "#BE123C", icon: <Smile className="w-5 h-5" />, leadFullName: "Laura Brandt" },
  lawFirm: { color: "#2563EB", darkColor: "#1E40AF", icon: <Briefcase className="w-5 h-5" />, leadFullName: "Oliver Harris" },
  coaching: { color: "#0D9488", darkColor: "#0F766E", icon: <GraduationCap className="w-5 h-5" />, leadFullName: "Ellen Jansen" },
};

export default function Cases() {
  const { t } = useTranslation("tryDemo");
  const { t: tServices } = useTranslation("services");
  const lang = i18n.language;
  const isDefaultLang = lang === "en";

  const [campaignId, setCampaignId] = useState<number>(DEMO_CAMPAIGNS[0].id);

  const activeCampaign = useMemo(
    () => DEMO_CAMPAIGNS.find((c) => c.id === campaignId) ?? null,
    [campaignId],
  );

  const activeCaseKey = activeCampaign ? CAMPAIGN_TO_CASE_KEY[activeCampaign.key] : null;
  const activeVisual = activeCaseKey ? CASE_VISUALS[activeCaseKey] : null;

  const caseMessages = activeCaseKey
    ? (tServices(`cases.${activeCaseKey}.messages`, { returnObjects: true }) as MessageItem[])
    : [];

  return (
    <div className="min-h-screen bg-[#F9FAFC] dark:bg-background pt-16 md:pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">

        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-[32px] md:text-[44px] font-bold leading-tight tracking-tight mb-4">
            {t("casesTitle", "Cases")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("casesSubtitle", "Each example below shows a real niche scenario — how the AI opens the conversation and handles common objections.")}
          </p>
        </motion.div>

        {/* CASE PICKER */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {DEMO_CAMPAIGNS.map((c) => {
            const caseKey = CAMPAIGN_TO_CASE_KEY[c.key];
            const visual = caseKey ? CASE_VISUALS[caseKey] : null;
            const isActive = campaignId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCampaignId(c.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-white dark:bg-card shadow-md"
                    : "bg-white/60 dark:bg-card/50 border-slate-200 dark:border-border opacity-60 hover:opacity-100"
                }`}
                style={isActive && visual ? { borderColor: visual.color, color: visual.color } : {}}
              >
                <span>{c.emoji}</span>
                {t(`demos.${c.key}`, c.niche)}
              </button>
            );
          })}
        </div>

        {/* CASE STUDY for the selected demo */}
        {activeCaseKey && activeVisual && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCaseKey}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="grid lg:flex lg:gap-12 items-start"
            >
              <div className="order-1 w-full lg:flex-1 lg:max-w-4xl lg:pr-12 pb-8 lg:pb-0">
                <h3 className="text-3xl font-bold mb-6">
                  <Trans
                    i18nKey={`cases.${activeCaseKey}.heading`}
                    ns="services"
                    components={{ colored: <span style={{ color: activeVisual.darkColor }} /> }}
                  />
                </h3>
                <p className="text-muted-foreground text-base mb-8 leading-relaxed">
                  <Trans
                    i18nKey={`cases.${activeCaseKey}.description`}
                    ns="services"
                    components={{ strong: <strong /> }}
                  />
                </p>
                <div className="rounded-2xl border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/30 p-5">
                  <p className="text-slate-700 dark:text-muted-foreground text-[15px] leading-relaxed">
                    <Trans
                      i18nKey={`cases.${activeCaseKey}.additionalUseCases`}
                      ns="services"
                      components={{ strong: <strong /> }}
                    />
                  </p>
                  <p className="text-slate-700 dark:text-muted-foreground text-[15px] leading-relaxed mt-3">
                    <Trans
                      i18nKey={`cases.${activeCaseKey}.agentProfile`}
                      ns="services"
                      components={{ strong: <strong /> }}
                    />
                  </p>
                </div>
                <div className="mt-8 pt-8 border-t border-slate-100 dark:border-border">
                  <p className="text-slate-500 dark:text-muted-foreground text-sm italic">
                    {tServices("footnote")}
                  </p>
                </div>
                <div className="mt-16 flex justify-center">
                  <Link href={isDefaultLang ? "/book-call" : `/${lang}/book-call`}>
                    <Button
                      size="lg"
                      className="h-14 px-8 text-base rounded-2xl shadow-xl transition-transform duration-500 ease-out hover:scale-105"
                      style={{
                        backgroundColor: activeVisual.color,
                        boxShadow: `0 10px 15px -3px ${activeVisual.color}40`,
                      }}
                    >
                      {t("bookCallCta")}
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="order-2 w-full max-w-full md:max-w-md lg:flex-shrink-0 lg:min-w-[28rem] px-0 md:px-4 lg:px-0 lg:sticky lg:top-8">
                <div className="md:hidden -mx-8">
                  <ChatCard2D
                    messages={caseMessages}
                    themeColor={activeVisual.color}
                    leadFullName={activeVisual.leadFullName}
                  />
                </div>
                <div className="hidden md:block w-full max-w-full md:max-w-md mx-auto lg:mx-0">
                  <div className="relative">
                    <div
                      className="absolute -inset-4 rounded-[2.5rem] blur-2xl -z-10"
                      style={{ backgroundColor: `${activeVisual.color}10` }}
                    />
                    <ChatCard2D
                      messages={caseMessages}
                      themeColor={activeVisual.color}
                      leadFullName={activeVisual.leadFullName}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

      </div>
    </div>
  );
}
