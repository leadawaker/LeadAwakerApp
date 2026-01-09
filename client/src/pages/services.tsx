import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation, Trans } from "react-i18next";
import {
  ArrowRight,
  Briefcase,
  Dumbbell,
  Utensils,
  Sun,
  Globe,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import ChatCard2D from "@/components/ChatCard2D";

type MessageItem = {
  type: "agent" | "user" | "system";
  sender?: string;
  content: string;
  time?: string;
  id?: string;
};

type CaseConfig = {
  id: number;
  key: string;
  color: string;
  darkColor: string;
  icon: React.ReactNode;
  leadFullName: string;
};

const CASE_CONFIGS: CaseConfig[] = [
  {
    id: 1,
    key: "solarPanel",
    color: "#10B981",
    darkColor: "#047857",
    icon: <Sun className="w-6 h-6" />,
    leadFullName: "James Walker",
  },
  {
    id: 2,
    key: "gym",
    color: "#8B5CF6",
    darkColor: "#7C3AED",
    icon: <Dumbbell className="w-6 h-6" />,
    leadFullName: "Mark Evans",
  },
  {
    id: 3,
    key: "restaurant",
    color: "#F97316",
    darkColor: "#C2410C",
    icon: <Utensils className="w-6 h-6" />,
    leadFullName: "Steve Parker",
  },
  {
    id: 4,
    key: "realEstate",
    color: "#6366F1",
    darkColor: "#4338CA",
    icon: <Building2 className="w-6 h-6" />,
    leadFullName: "Liam Carter",
  },
  {
    id: 5,
    key: "healthClinic",
    color: "#E11D48",
    darkColor: "#BE123C",
    icon: <Globe className="w-6 h-6" />,
    leadFullName: "Daniel Reed",
  },
  {
    id: 6,
    key: "lawFirm",
    color: "#2563EB",
    darkColor: "#1E40AF",
    icon: <Briefcase className="w-6 h-6" />,
    leadFullName: "Oliver Harris",
  },
].sort((a, b) => a.id - b.id);

export default function Services() {
  const { t } = useTranslation("services");
  const [activeCase, setActiveCase] = useState(0);

  const CASES = CASE_CONFIGS.map((config) => ({
    ...config,
    title: t(`cases.${config.key}.title`),
    description: (
      <>
        <h2 className="text-3xl font-bold mb-6">
          <Trans
            i18nKey={`cases.${config.key}.heading`}
            ns="services"
            values={{ caseNumber: config.id }}
            components={{
              colored: <span style={{ color: config.darkColor }} />,
            }}
          />
        </h2>

        <p className="text-muted-foreground text-base mb-6 leading-relaxed">
          <Trans
            i18nKey={`cases.${config.key}.description`}
            ns="services"
            components={{ strong: <strong /> }}
          />
        </p>

        {config.key === "lawFirm" && (
          <p className="text-muted-foreground text-base mb-6 leading-relaxed">
            <Trans
              i18nKey="cases.lawFirm.descriptionExtra"
              ns="services"
              components={{ strong: <strong /> }}
            />
          </p>
        )}

        <h3 className="font-semibold text-lg mb-4">
          {t(`cases.${config.key}.metricsTitle`)}
        </h3>
        <ul className="space-y-2 mb-8">
          {(t(`cases.${config.key}.metrics`, { returnObjects: true }) as string[]).map(
            (metric, idx) => (
              <li key={idx} className="flex gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                  style={{ backgroundColor: config.darkColor }}
                />
                <span dangerouslySetInnerHTML={{ __html: metric }} />
              </li>
            )
          )}
        </ul>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-slate-700 text-[15px] leading-relaxed">
            <Trans
              i18nKey={`cases.${config.key}.additionalUseCases`}
              ns="services"
              components={{ strong: <strong /> }}
            />
          </p>
          <p className="text-slate-700 text-[15px] leading-relaxed mt-3">
            <Trans
              i18nKey={`cases.${config.key}.agentProfile`}
              ns="services"
              components={{ strong: <strong /> }}
            />
          </p>
        </div>
      </>
    ),
    messages: t(`cases.${config.key}.messages`, { returnObjects: true }) as MessageItem[],
  }));

  return (
    <div className="min-h-screen pt-24 pb-20 bg-slate-50">
      <div className="container mx-auto px-4 md:px-0">
        <div className="max-w-4xl mx-auto text-center mb-16 px-0">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-6 text-slate-900"
          >
            {t("pageTitle")}
          </motion.h1>
          <p className="text-xl text-slate-600 whitespace-nowrap">
            {t("pageSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:flex lg:flex-nowrap justify-between gap-4 px-4 md:px-0 mt-[20px] mb-[20px]">
          {CASES.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setActiveCase(index)}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 min-w-0 flex-1 relative overflow-hidden ${
                activeCase === index
                  ? "bg-white shadow-xl scale-105 z-10"
                  : "bg-white/50 border-slate-200 hover:border-slate-300 grayscale hover:grayscale-0 opacity-70 hover:opacity-100"
              }`}
              style={
                activeCase === index
                  ? { borderColor: item.color, boxShadow: `0 20px 25px -5px ${item.color}15` }
                  : {}
              }
            >
              <div
                className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
                style={{
                  background:
                    activeCase === index
                      ? `linear-gradient(to top left, ${item.color}10, transparent)`
                      : `linear-gradient(to top left, #94a3b810, transparent)`,
                  opacity: 1,
                }}
              />

              <span
                className="text-sm font-bold uppercase tracking-wider mb-2 relative z-10"
                style={{ color: activeCase === index ? item.color : "#64748b" }}
              >
                {t("caseLabel", { number: item.id })}
              </span>

              <div className="mb-3 relative z-10" style={{ color: activeCase === index ? item.color : "#94a3b8" }}>
                {item.icon}
              </div>

              <span className={`font-bold text-center leading-tight relative z-10 ${activeCase === index ? "text-slate-900" : "text-slate-500"}`}>
                {item.title}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 mx-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCase}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="grid lg:grid-cols-2 gap-12 items-start"
            >
              <div className="order-1">
                {CASES[activeCase].description}
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <p className="text-slate-500 text-sm italic">
                    {t("footnote")}
                  </p>
                </div>
              </div>

              <div className="order-2 w-full max-w-full md:max-w-md mx-auto lg:mx-0 lg:sticky lg:top-8">
                <div className="relative">
                  <div
                    className="absolute -inset-4 rounded-[2.5rem] blur-2xl -z-10"
                    style={{ backgroundColor: `${CASES[activeCase].color}10` }}
                  />
                  <ChatCard2D
                    messages={CASES[activeCase].messages}
                    themeColor={CASES[activeCase].color}
                    // @ts-ignore - implement in ChatCard2D header
                    leadFullName={CASES[activeCase].leadFullName}
                  />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-24 text-center">
          <Link href="/book-demo">
            <Button
              size="lg"
              className="h-20 px-12 text-lg rounded-2xl shadow-xl transition-transform hover:scale-105"
              style={{
                backgroundColor: CASES[activeCase].color,
                boxShadow: `0 10px 15px -3px ${CASES[activeCase].color}40`,
              }}
            >
              {t("ctaButton")}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
