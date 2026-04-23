import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Sparkles, Sun, Dumbbell, Smile, Briefcase, GraduationCap, ArrowRight } from "lucide-react";
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

/** Visual config per case (icon + theme color). Mirrors the old Services page. */
const CASE_VISUALS: Record<string, { color: string; darkColor: string; icon: React.ReactNode; leadFullName: string }> = {
  solarPanel: { color: "#10B981", darkColor: "#047857", icon: <Sun className="w-5 h-5" />, leadFullName: "James Walker" },
  gym: { color: "#8B5CF6", darkColor: "#7C3AED", icon: <Dumbbell className="w-5 h-5" />, leadFullName: "Mark Evans" },
  dental: { color: "#E11D48", darkColor: "#BE123C", icon: <Smile className="w-5 h-5" />, leadFullName: "Laura Brandt" },
  lawFirm: { color: "#2563EB", darkColor: "#1E40AF", icon: <Briefcase className="w-5 h-5" />, leadFullName: "Oliver Harris" },
  coaching: { color: "#0D9488", darkColor: "#0F766E", icon: <GraduationCap className="w-5 h-5" />, leadFullName: "Ellen Jansen" },
};

export default function TryDemo() {
  const { t } = useTranslation("tryDemo");
  const { t: tServices } = useTranslation("services");
  const lang = i18n.language;
  const isDefaultLang = lang === "en";

  const [firstName, setFirstName] = useState("");
  const [campaignId, setCampaignId] = useState<number>(DEMO_CAMPAIGNS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo language = current site locale. No picker.
  const currentLang = i18n.language.split("-")[0] as "en" | "nl" | "pt";
  const submitLanguage: "en" | "nl" | "pt" = (["en", "nl", "pt"] as const).includes(currentLang)
    ? currentLang
    : "en";

  const activeCampaign = useMemo(
    () => DEMO_CAMPAIGNS.find((c) => c.id === campaignId) ?? null,
    [campaignId],
  );

  const activeCaseKey = activeCampaign ? CAMPAIGN_TO_CASE_KEY[activeCampaign.key] : null;
  const activeVisual = activeCaseKey ? CASE_VISUALS[activeCaseKey] : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || campaignId == null) {
      setError(t("errors.missingFields"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/demo/create-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), language: submitLanguage, campaignId }),
      });
      if (res.status === 429) {
        setError(t("errors.rateLimited"));
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || t("errors.generic"));
        setLoading(false);
        return;
      }
      const data = await res.json();
      window.location.href = data.whatsappUrl;
    } catch {
      setError(t("errors.network"));
      setLoading(false);
    }
  }

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
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" /> {t("badge")}
          </div>
          <h1 className="text-[32px] md:text-[44px] font-bold leading-tight tracking-tight mb-4">
            {t("title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("subtitle")}</p>
        </motion.div>

        {/* UNIFIED CARD: name → picker → submit, stacked */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-card rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-border p-5 md:p-6 max-w-xl mx-auto space-y-4"
        >
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("form.firstNameLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t("form.firstNamePlaceholder")}
              className="w-full px-4 py-3 rounded-full border border-input bg-white dark:bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              required
              maxLength={80}
            />
          </div>

          {/* Demo picker — vertical stack, icon left of title */}
          <div>
            <label className="block text-sm font-medium mb-2">{t("form.demoLabel")}</label>
          <div className="flex flex-col gap-2">
            {DEMO_CAMPAIGNS.map((c) => {
              const caseKey = CAMPAIGN_TO_CASE_KEY[c.key];
              const visual = caseKey ? CASE_VISUALS[caseKey] : null;
              const isActive = campaignId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCampaignId(c.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-300 relative overflow-hidden text-left ${
                    isActive
                      ? "bg-white dark:bg-card shadow-md z-10"
                      : "bg-white/60 dark:bg-card/50 border-slate-200 dark:border-border hover:border-slate-300 dark:hover:border-border grayscale hover:grayscale-0 opacity-70 hover:opacity-100"
                  }`}
                  style={
                    isActive && visual
                      ? { borderColor: visual.color, boxShadow: `0 6px 12px -4px ${visual.color}20` }
                      : {}
                  }
                >
                  <div
                    className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background:
                        isActive && visual
                          ? `linear-gradient(to right, ${visual.color}10, transparent)`
                          : `linear-gradient(to right, #94a3b810, transparent)`,
                    }}
                  />
                  <div
                    className="flex-shrink-0 relative z-10"
                    style={{ color: isActive && visual ? visual.color : "#94a3b8" }}
                  >
                    {visual ? visual.icon : <span className="text-lg">{c.emoji}</span>}
                  </div>
                  <span
                    className={`text-sm font-bold leading-tight relative z-10 ${
                      isActive ? "text-slate-900 dark:text-foreground" : "text-slate-500 dark:text-muted-foreground"
                    }`}
                  >
                    {t(`demos.${c.key}`, c.niche)}
                  </span>
                </button>
              );
            })}
          </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#25D366] hover:bg-[#20BC5A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-full transition inline-flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            {loading ? t("form.submitting") : t("form.submit")}
          </button>
          <p className="text-xs text-center text-muted-foreground">{t("form.fineprint")}</p>
        </form>

        {/* CASE STUDY for the selected demo */}
        {activeCaseKey && activeVisual && (
          <div className="mt-32 md:mt-40">
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
                      <Link href={isDefaultLang ? "/book-demo" : `/${lang}/book-demo`}>
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
          </div>
        )}

      </div>
    </div>
  );
}
