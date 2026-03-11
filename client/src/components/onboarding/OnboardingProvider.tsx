/**
 * Onboarding provider that wraps the subaccount layout.
 * Renders <Joyride> with dynamic steps based on current stage,
 * handles cross-page navigation, and shows welcome/completion modals.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Joyride, { type CallBackProps, ACTIONS, EVENTS, STATUS } from "react-joyride";
import { useLocation } from "wouter";
import { useOnboarding } from "@/hooks/useOnboarding";
import { ONBOARDING_STAGES, type OnboardingStepDef } from "./steps";
import { OnboardingTooltip } from "./OnboardingTooltip";
import { WelcomeModal } from "./WelcomeModal";
import { CompletionModal } from "./CompletionModal";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const {
    onboarding,
    isLoading,
    isActive,
    firstIncompleteStage,
    stageCompletion,
    nextStep,
    completeStage,
    skipTutorial,
    startTutorial,
    completeTutorial,
  } = useOnboarding();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [stageOverride, setStageOverride] = useState<number | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  // Derive the prefix from current location
  const prefix = location.startsWith("/agency") ? "/agency" : "/subaccount";

  // Determine current stage (auto-advance to first incomplete, unless user picked one)
  const currentStage = useMemo(() => {
    if (stageOverride !== null) return stageOverride;
    if (!isActive) return onboarding.currentStage;
    return firstIncompleteStage ?? onboarding.currentStage;
  }, [stageOverride, isActive, firstIncompleteStage, onboarding.currentStage]);

  // Get steps for current stage
  const steps = useMemo(() => {
    return ONBOARDING_STAGES[currentStage] || [];
  }, [currentStage]);

  // Refs for latest values inside callbacks (avoids stale closures)
  const stepsRef = useRef<OnboardingStepDef[]>([]);
  stepsRef.current = steps;
  const locationRef = useRef(location);
  locationRef.current = location;
  const prefixRef = useRef(prefix);
  prefixRef.current = prefix;

  // Show welcome modal on first visit
  useEffect(() => {
    if (
      !isLoading &&
      !onboarding.completed &&
      !onboarding.skipped &&
      !onboarding.startedAt
    ) {
      setShowWelcome(true);
    }
  }, [isLoading]);

  // Listen for restart event dispatched from Settings page
  useEffect(() => {
    const handler = () => {
      setRun(false);
      setStepIndex(0);
      setStageOverride(null);
      setShowWelcome(true);
    };
    window.addEventListener("onboarding-restart", handler);
    return () => window.removeEventListener("onboarding-restart", handler);
  }, []);

  // Show completion when all stages are done
  useEffect(() => {
    if (onboarding.completed && !showCompletion) {
      // Only show if it just completed (not on page load)
    }
  }, [onboarding.completed, showCompletion]);

  // Navigate to the correct page for the current step
  useEffect(() => {
    if (!run || steps.length === 0 || stepIndex >= steps.length) return;

    const step = steps[stepIndex];
    if (step.page) {
      const targetPath = `${prefix}${step.page}`;
      if (!location.startsWith(targetPath)) {
        setRun(false);
        setLocation(targetPath);
        // Resume after navigation + DOM mount
        const timer = setTimeout(() => setRun(true), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [run, stepIndex, steps, location, prefix, setLocation]);

  // Handle Joyride callbacks
  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type } = data;

      // User finished or skipped the tour
      if (status === STATUS.FINISHED) {
        setRun(false);
        setStageOverride(null);
        // Check if all stages are done
        if (currentStage >= 4 || (firstIncompleteStage === null)) {
          completeTutorial();
          setShowCompletion(true);
        } else {
          completeStage(currentStage);
          // Auto-start next stage after a brief pause
          setStepIndex(0);
          setTimeout(() => setRun(true), 600);
        }
        return;
      }

      if (status === STATUS.SKIPPED) {
        setRun(false);
        setStageOverride(null);
        skipTutorial();
        return;
      }

      // Step navigation
      if (type === EVENTS.STEP_AFTER) {
        const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
        setStepIndex(nextIndex);
        nextStep(currentStage, nextIndex);
      }

      // Target not found — only skip if we're already on the correct page.
      // If we're not there yet, the navigation effect handles it (don't cascade-skip).
      if (type === EVENTS.TARGET_NOT_FOUND) {
        const s = stepsRef.current[index] as OnboardingStepDef;
        if (s?.page) {
          const targetPath = `${prefixRef.current}${s.page}`;
          if (!locationRef.current.startsWith(targetPath)) return;
        }
        setStepIndex((prev) => prev + 1);
      }
    },
    [currentStage, firstIncompleteStage, nextStep, completeStage, skipTutorial, completeTutorial]
  );

  // Start tutorial handler
  const handleStart = useCallback(() => {
    setShowWelcome(false);
    setRun(false);
    setStageOverride(null);
    startTutorial(1);
    setStepIndex(0);
    // Brief delay to let the modal close
    setTimeout(() => setRun(true), 300);
  }, [startTutorial]);

  // Start tutorial at a specific stage (from welcome modal stage click)
  const handleStartAt = useCallback((stage: number) => {
    setShowWelcome(false);
    setRun(false);
    setStageOverride(stage);
    startTutorial(stage);
    setStepIndex(0);
    setTimeout(() => setRun(true), 300);
  }, [startTutorial]);

  // Skip from welcome modal
  const handleSkipWelcome = useCallback(() => {
    setShowWelcome(false);
    skipTutorial();
  }, [skipTutorial]);

  // Dismiss completion modal
  const handleDismissCompletion = useCallback(() => {
    setShowCompletion(false);
    setLocation(`${prefix}/campaigns`);
  }, [prefix, setLocation]);

  // Resume tutorial if user returns and it was in progress
  useEffect(() => {
    if (
      !isLoading &&
      isActive &&
      onboarding.startedAt &&
      !showWelcome &&
      !run
    ) {
      setStepIndex(onboarding.currentStep);
      setTimeout(() => setRun(true), 500);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  return (
    <>
      {children}

      {/* Welcome modal */}
      {showWelcome && (
        <WelcomeModal onStart={handleStart} onSkip={handleSkipWelcome} onStartAt={handleStartAt} />
      )}

      {/* Completion modal */}
      {showCompletion && (
        <CompletionModal onDismiss={handleDismissCompletion} />
      )}

      {/* Joyride walkthrough */}
      {isActive && steps.length > 0 && (
        <Joyride
          callback={handleCallback}
          continuous
          run={run}
          stepIndex={stepIndex}
          steps={steps}
          showSkipButton
          disableOverlayClose
          disableScrolling
          spotlightClicks
          styles={{
            options: {
              zIndex: 10000,
              arrowColor: "var(--background, #fff)",
            },
            overlay: {
              backgroundColor: "rgba(0, 0, 0, 0.4)",
            },
          }}
          tooltipComponent={(props) => (
            <OnboardingTooltip {...props} currentStage={currentStage} />
          )}
          locale={{
            back: "Back",
            close: "Close",
            last: "Finish",
            next: "Next",
            skip: "Skip tutorial",
          }}
        />
      )}

      {/* Progress indicator — shown when tutorial is active but Joyride is paused */}
      {isActive && !run && !showWelcome && onboarding.startedAt && (
        <button
          onClick={() => {
            setStepIndex(onboarding.currentStep);
            setRun(true);
          }}
          className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-colors flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300"
        >
          <span className="h-2 w-2 rounded-full bg-primary-foreground/60 animate-pulse" />
          Resume Tutorial ({currentStage}/4)
        </button>
      )}
    </>
  );
}
