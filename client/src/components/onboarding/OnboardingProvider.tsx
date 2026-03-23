/**
 * Onboarding provider: one continuous tour across all stages.
 * - Next: advance one step
 * - Skip: jump to the next stage's first step
 * - X / click overlay: end the tour
 */
import { useState, useCallback, useEffect, useRef, createContext } from "react";
import Joyride, { type CallBackProps, ACTIONS, EVENTS, STATUS } from "react-joyride";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useOnboarding, ONBOARDING_QUERY_KEY } from "@/hooks/useOnboarding";
import { ALL_STEPS, STAGE_START_INDEX, TOTAL_STAGES, type OnboardingStepDef } from "./steps";
import { OnboardingTooltip } from "./OnboardingTooltip";
import { CompletionModal } from "./CompletionModal";

export const OnboardingContext = createContext<{ triggerRestart: () => void }>({
  triggerRestart: () => {},
});

/** Poll DOM until a selector appears, then resolve. */
function waitForElement(selector: string, maxMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) return resolve(true);
    const interval = 100;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      if (document.querySelector(selector)) {
        clearInterval(timer);
        resolve(true);
      } else if (elapsed >= maxMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, interval);
  });
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const {
    onboarding,
    isLoading,
    isActive,
    startTutorial,
    skipTutorial,
    completeTutorial,
  } = useOnboarding();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeDismissedRef = useRef(false);

  const prefix = location.startsWith("/agency") ? "/agency" : "/subaccount";

  // Get current step's stage number
  const currentStep = ALL_STEPS[stepIndex] as OnboardingStepDef | undefined;
  const currentStage = currentStep?.stage ?? 1;

  // Refs for callbacks
  const locationRef = useRef(location);
  locationRef.current = location;
  const prefixRef = useRef(prefix);
  prefixRef.current = prefix;

  // Show welcome on first visit or after restart
  useEffect(() => {
    if (isLoading || welcomeDismissedRef.current) return;
    const pendingRestart = localStorage.getItem("onboarding-pending-restart");
    if (pendingRestart) {
      localStorage.removeItem("onboarding-pending-restart");
      setShowWelcome(true);
      return;
    }
    if (!onboarding.completed && !onboarding.skipped && !onboarding.startedAt) {
      setShowWelcome(true);
    }
  }, [isLoading]);

  // Navigate to the correct page for the current step
  useEffect(() => {
    if (!run || stepIndex >= ALL_STEPS.length) return;
    let cancelled = false;
    const step = ALL_STEPS[stepIndex];
    if (step.page) {
      const targetPath = `${prefix}${step.page}`;
      if (!location.startsWith(targetPath)) {
        // Force table view on leads page so all tour targets are in the DOM
        if (step.page === "/contacts") {
          try { localStorage.setItem("leads-view-mode", "table"); } catch {}
        }
        setRun(false);
        setLocation(targetPath);
        const selector = typeof step.target === "string" ? step.target : "";
        if (selector) {
          waitForElement(selector).then(() => { if (!cancelled) setRun(true); });
        } else {
          const t = setTimeout(() => { if (!cancelled) setRun(true); }, 800);
          return () => { cancelled = true; clearTimeout(t); };
        }
        return () => { cancelled = true; };
      }
    }
  }, [run, stepIndex, location, prefix, setLocation]);

  // Handle Joyride callbacks
  const handleCallback = useCallback((data: CallBackProps) => {
    const { action, index, status, type } = data;

    // Tour finished (last step completed) or Joyride says finished
    if (status === STATUS.FINISHED) {
      setRun(false);
      completeTutorial();
      setShowCompletion(true);
      return;
    }

    // User clicked X (close button in tooltip)
    if (action === ACTIONS.CLOSE) {
      setRun(false);
      skipTutorial();
      return;
    }

    // Next/Back step navigation
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.PREV) {
        setStepIndex(Math.max(0, index - 1));
      } else {
        const next = index + 1;
        if (next >= ALL_STEPS.length) {
          setRun(false);
          completeTutorial();
          setShowCompletion(true);
        } else {
          setStepIndex(next);
        }
      }
    }

    // Target not found: wait then skip
    if (type === EVENTS.TARGET_NOT_FOUND) {
      const s = ALL_STEPS[index];
      if (s?.page) {
        const targetPath = `${prefixRef.current}${s.page}`;
        if (!locationRef.current.startsWith(targetPath)) return;
      }
      const selector = typeof s?.target === "string" ? s.target : "";
      if (selector) {
        setRun(false);
        waitForElement(selector, 2000).then((found) => {
          if (found) {
            setRun(true);
          } else {
            setStepIndex((prev) => Math.min(prev + 1, ALL_STEPS.length - 1));
            setRun(true);
          }
        });
      } else {
        setStepIndex((prev) => Math.min(prev + 1, ALL_STEPS.length - 1));
      }
    }
  }, [completeTutorial, skipTutorial]);

  // Skip to next stage handler (used by tooltip Skip button)
  const handleSkipStage = useCallback(() => {
    const step = ALL_STEPS[stepIndex];
    if (!step) return;
    const nextStage = step.stage + 1;
    if (nextStage > TOTAL_STAGES) {
      // Last stage, complete the tour
      setRun(false);
      completeTutorial();
      setShowCompletion(true);
    } else {
      const nextIdx = STAGE_START_INDEX[nextStage];
      if (nextIdx !== undefined) {
        setStepIndex(nextIdx);
      }
    }
  }, [stepIndex, completeTutorial]);

  // Start tutorial
  const handleStart = useCallback(() => {
    welcomeDismissedRef.current = true;
    setShowWelcome(false);
    startTutorial(1);
    setStepIndex(0);
    // Wait for welcome modal to unmount, then check if first target exists
    const firstTarget = typeof ALL_STEPS[0]?.target === "string" ? ALL_STEPS[0].target : "";
    if (firstTarget) {
      waitForElement(firstTarget, 2000).then(() => setRun(true));
    } else {
      setTimeout(() => setRun(true), 400);
    }
  }, [startTutorial]);

  // Skip from welcome
  const handleSkipWelcome = useCallback(() => {
    welcomeDismissedRef.current = true;
    setShowWelcome(false);
    skipTutorial();
  }, [skipTutorial]);

  // Restart without page reload (called from Settings)
  const triggerRestart = useCallback(() => {
    welcomeDismissedRef.current = false;
    setRun(false);
    setStepIndex(0);
    setShowCompletion(false);
    queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    setShowWelcome(true);
    setLocation(`${prefix}/campaigns`);
  }, [queryClient, prefix, setLocation]);

  // Dismiss completion
  const handleDismissCompletion = useCallback(() => {
    setShowCompletion(false);
    setLocation(`${prefix}/campaigns`);
  }, [prefix, setLocation]);

  return (
    <OnboardingContext.Provider value={{ triggerRestart }}>
      {children}

      {/* Simple welcome prompt */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-border rounded-2xl shadow-xl max-w-sm w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h2 className="text-lg font-bold text-foreground">Welcome to LeadAwaker!</h2>
              <p className="text-sm text-muted-foreground mt-1.5">We'll give you a quick tour of the platform. It only takes a minute.</p>
            </div>
            <div className="px-6 py-4 bg-zinc-50 dark:bg-white/5 border-t border-border/50 flex items-center justify-between">
              <button
                onClick={handleSkipWelcome}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
              >
                Skip
              </button>
              <button
                onClick={handleStart}
                className="text-sm font-medium text-primary-foreground bg-primary px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Start Tour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion modal */}
      {showCompletion && (
        <CompletionModal onDismiss={handleDismissCompletion} />
      )}

      {/* Joyride */}
      {isActive && ALL_STEPS.length > 0 && (
        <Joyride
          callback={handleCallback}
          continuous
          run={run}
          stepIndex={stepIndex}
          steps={ALL_STEPS}
          disableOverlayClose
          disableScrolling
          spotlightClicks
          styles={{
            options: {
              zIndex: 10000,
              arrowColor: "#ffffff",
            },
            overlay: {
              backgroundColor: "rgba(0, 0, 0, 0.4)",
            },
            spotlight: {
              backgroundColor: "rgba(255, 255, 255, 0.25)",
              borderRadius: 12,
              boxShadow: "0 0 20px rgba(255, 255, 255, 0.3)",
            },
          }}
          tooltipComponent={(props) => (
            <OnboardingTooltip {...props} currentStage={currentStage} onSkipStage={handleSkipStage} />
          )}
          locale={{
            back: "Back",
            close: "Close",
            last: "Finish",
            next: "Next",
            skip: "Skip section",
          }}
        />
      )}

      {/* Resume button when tutorial is paused */}
      {isActive && !run && !showWelcome && onboarding.startedAt && (
        <button
          onClick={() => setRun(true)}
          className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-colors flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300"
        >
          <span className="h-2 w-2 rounded-full bg-primary-foreground/60 animate-pulse" />
          Resume Tutorial
        </button>
      )}
    </OnboardingContext.Provider>
  );
}
