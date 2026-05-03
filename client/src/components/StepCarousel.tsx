import React, { useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import excelLogo from "../assets/Microsoft_Office_Excel_(2019–2025).svg_1767283614696.webp";
import { useCarouselScrollLock } from "./useCarouselScrollLock";

interface StepData {
  number: string;
  cardTitle: string;
  cardDescription: string;
  icon: React.ReactNode;
  cardImage?: string;
  leftText?: string;
}

export const StepCarousel = ({ steps, onStepInView }: { steps: StepData[], onStepInView: () => void }) => {
  const { t } = useTranslation('salesRepSteps');
  const sectionRef = useRef<HTMLDivElement>(null);
  const { isMobile, currentStep, setCurrentStep } = useCarouselScrollLock(sectionRef, steps.length);

  const handlePrev = () => setCurrentStep((prev) => (prev - 1 + steps.length) % steps.length);
  const handleNext = () => setCurrentStep((prev) => (prev + 1) % steps.length);

  return (
    <div
      ref={sectionRef}
      className={isMobile
        ? "relative w-full flex flex-col items-center justify-center px-4"
        : "relative w-full pt-12 pb-48"
      }
      style={isMobile ? { minHeight: '100vh' } : {}}
    >
      <div className={isMobile ? "relative w-full" : "mx-auto relative z-10"}>

        <div className={isMobile ? "relative w-full" : "relative h-[850px] flex flex-col items-center justify-center"}>
          <div className={isMobile ? "relative w-full h-[65vh] flex items-center justify-center" : "relative w-full h-[650px] flex items-center justify-center"}>
            {steps.map((step, index) => {
              const position = (index - currentStep + steps.length) % steps.length;
              const isActive = position === 0;
              const isNext = position === 1;

              return (
                <motion.div
                  key={index}
                  data-testid={`card-step-${index}`}
                  initial={false}
                  animate={{
                    scale: isActive ? 1 : 0.85,
                    x: isActive ? 0 : isNext ? 200 : -200,
                    opacity: isActive ? 1 : 0.4,
                    zIndex: isActive ? 20 : 10,
                    filter: isActive ? 'blur(0px)' : 'blur(2px)',
                    pointerEvents: isActive ? 'auto' : 'none',
                  }}
                  transition={{
                    x: { type: 'spring', stiffness: 300, damping: 30 },
                    scale: { type: 'spring', stiffness: 300, damping: 30 },
                    opacity: { duration: 0.3 }
                  }}
                  className="absolute w-full max-w-7xl left-1/2 -translate-x-1/2"
                >
                  <Card className="bg-card backdrop-blur-sm border-white/10 group hover:border-primary/50 transition-colors duration-500 shadow-2xl">
                    <CardContent className="p-8">
                      <div className="relative flex items-center mb-6">
  {/* Icon (left) */}
  <div className="p-3 bg-[#fff7e0] dark:bg-yellow-900/30 rounded-xl text-gray-600 dark:text-zinc-300 flex items-center justify-center min-w-[56px] min-h-[56px]">
    {step.icon}
  </div>

  {/* Centered dots (absolute center of card) */}
  {isMobile && (
    <div className="absolute left-1/2 -translate-x-1/2 flex gap-2">
      {steps.map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === currentStep
              ? "bg-blue-500 w-10 h-4"
              : "bg-blue-500/40 w-4 h-4"
          }`}
        />
      ))}
    </div>
  )}
</div>
                      <h3 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight text-foreground" data-testid={`step-title-${step.number}`}>
                        {step.cardTitle}
                      </h3>
                      <p className="text-muted-foreground text-lg leading-relaxed mb-6" data-testid={`step-description-${step.number}`}>
                        {step.cardDescription}
                      </p>

                      <div className="border-t border-white/10">
                        {step.cardImage && step.number === "1" ? (
                          <div className="relative mb-6 rounded-lg overflow-hidden group">
                            <img src={step.cardImage} alt="Step illustration" className="w-full h-auto object-cover rounded-lg" />

                            <motion.div
                              initial={false}
                              animate={{ opacity: isActive ? 1 : 0 }}
                              transition={{ duration: 0.3 }}
                              className="absolute top-[5%] left-0 right-0 h-1/4 flex items-center px-4 pt-4 z-10"
                              style={{
                                maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
                                WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'
                              }}
                            >
                              <style>{`
                                @keyframes crmScroll {
                                  0% { transform: translateX(0); }
                                  100% { transform: translateX(-50%); }
                                }
                                .crm-carousel-track {
                                  animation: crmScroll 52.3s linear infinite;
                                  display: flex;
                                  gap: 1rem;
                                  width: max-content;
                                }
                                .crm-carousel-track:hover { animation-play-state: paused; }
                                .crm-logo-item {
                                  flex-shrink: 0;
                                  display: flex;
                                  align-items: center;
                                  gap: 0.5rem;
                                  padding: 0.375rem 0.75rem;
                                  background: rgba(255, 255, 255, 0.35);
                                  border-radius: 0.375rem;
                                  border: 1px solid rgba(226, 232, 240, 0.3);
                                  backdrop-filter: blur(4px);
                                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                                }
                              `}</style>
                              <div className="crm-carousel-track">
                                {[
                                  { name: 'Salesforce', url: 'https://www.vectorlogo.zone/logos/salesforce/salesforce-icon.svg' },
                                  { name: 'HubSpot', url: 'https://www.vectorlogo.zone/logos/hubspot/hubspot-icon.svg' },
                                  { name: 'GoHighLevel', url: 'https://www.google.com/s2/favicons?domain=gohighlevel.com&sz=128' },
                                  { name: 'Pipedrive', url: 'https://cdn.worldvectorlogo.com/logos/pipedrive.svg' },
                                  { name: 'Sheets', url: 'https://www.gstatic.com/images/branding/product/2x/sheets_2020q4_48dp.png' },
                                  { name: 'Excel', url: excelLogo },
                                  { name: 'Supabase', url: 'https://www.vectorlogo.zone/logos/supabase/supabase-icon.svg' },
                                  { name: 'Airtable', url: 'https://www.vectorlogo.zone/logos/airtable/airtable-icon.svg' },
                                  { name: 'API', url: null },
                                  { name: 'Salesforce', url: 'https://www.vectorlogo.zone/logos/salesforce/salesforce-icon.svg' },
                                  { name: 'HubSpot', url: 'https://www.vectorlogo.zone/logos/hubspot/hubspot-icon.svg' },
                                  { name: 'GoHighLevel', url: 'https://www.google.com/s2/favicons?domain=gohighlevel.com&sz=128' },
                                  { name: 'Pipedrive', url: 'https://cdn.worldvectorlogo.com/logos/pipedrive.svg' },
                                  { name: 'Sheets', url: 'https://www.gstatic.com/images/branding/product/2x/sheets_2020q4_48dp.png' },
                                  { name: 'Excel', url: excelLogo },
                                  { name: 'Supabase', url: 'https://www.vectorlogo.zone/logos/supabase/supabase-icon.svg' },
                                  { name: 'Airtable', url: 'https://www.vectorlogo.zone/logos/airtable/airtable-icon.svg' },
                                  { name: 'API', url: null }
                                ].map((crm, i) => (
                                  <div key={i} className="crm-logo-item">
                                    {crm.url ? <img src={crm.url} alt={crm.name} className="w-6 h-6 object-contain" /> : <span className="text-blue-600 font-mono font-bold text-sm">&lt;/&gt;</span>}
                                    <span className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">{crm.name}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>

                            <div className="hidden md:flex absolute bottom-4 left-0 right-0 z-20 items-center justify-center gap-4">
                              <button onClick={handlePrev} data-testid="button-prev-step-card" className="p-2 text-white hover:text-blue-500 transition-colors duration-200 flex items-center justify-center bg-black/30 rounded-full backdrop-blur-sm" aria-label={t('common.prevStep')}>
                                <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
                              </button>
                              <div className="flex gap-2">
                                {steps.map((_, i) => (
                                  <button key={i} onClick={() => setCurrentStep(i)} data-testid={`dot-step-card-${i}`} className={`rounded-full transition-all duration-300 ${i === currentStep ? 'bg-blue-500 w-8 h-3 md:w-10 md:h-4' : 'bg-blue-500/50 hover:bg-blue-500/70 w-3 h-3 md:w-4 md:h-4'}`} aria-label={t('common.goToStep', { number: i + 1 })} />
                                ))}
                              </div>
                              <button onClick={handleNext} data-testid="button-next-step-card" className="p-2 text-white hover:text-blue-500 transition-colors duration-200 flex items-center justify-center bg-black/30 rounded-full backdrop-blur-sm" aria-label={t('common.nextStep')}>
                                <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
                              </button>
                            </div>
                          </div>
                        ) : step.cardImage ? (
                          <div className="mb-4 rounded-lg overflow-hidden relative">
                            <img src={step.cardImage} alt="Step illustration" className="w-full h-auto object-cover rounded-lg" />
                            <div className="hidden md:flex absolute bottom-4 left-0 right-0 z-20 items-center justify-center gap-4">
                              <button onClick={handlePrev} data-testid="button-prev-step-card" className="p-2 text-white hover:text-blue-500 transition-colors duration-200 flex items-center justify-center bg-black/30 rounded-full backdrop-blur-sm" aria-label={t('common.prevStep')}>
                                <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
                              </button>
                              <div className="flex gap-2">
                                {steps.map((_, i) => (
                                  <button key={i} onClick={() => setCurrentStep(i)} data-testid={`dot-step-card-${i}`} className={`rounded-full transition-all duration-300 ${i === currentStep ? 'bg-blue-500 w-8 h-3 md:w-10 md:h-4' : 'bg-blue-500/50 hover:bg-blue-500/70 w-3 h-3 md:w-4 md:h-4'}`} aria-label={t('common.goToStep', { number: i + 1 })} />
                                ))}
                              </div>
                              <button onClick={handleNext} data-testid="button-next-step-card" className="p-2 text-white hover:text-blue-500 transition-colors duration-200 flex items-center justify-center bg-black/30 rounded-full backdrop-blur-sm" aria-label={t('common.nextStep')}>
                                <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <motion.div
                          animate={{
                            height: isActive ? "auto" : 0,
                            opacity: isActive ? 1 : 0
                          }}
                          transition={{ duration: 0.4 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                            {step.leftText && step.leftText.split('\n').map((line: string, i: number) => (
                              <div key={i} className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
                                <div className="font-medium text-gray-600 dark:text-zinc-400 text-[16px]">{line}</div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {isMobile && (
          <div className="flex flex-col items-center gap-3 mt-4">
            <div className="flex gap-2">
              {steps.map((_, i) => (
                <div key={i} className={`rounded-full transition-all duration-300 ${i === currentStep ? 'bg-blue-500 w-8 h-3' : 'bg-blue-500/40 w-3 h-3'}`} />
              ))}
            </div>
            <motion.p
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-zinc-500 text-xs"
            >
              swipe to continue ↓
            </motion.p>
          </div>
        )}
      </div>
    </div>
  );
};
