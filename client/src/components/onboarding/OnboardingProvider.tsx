/**
 * Onboarding provider: shows an intro video modal on first login.
 * Uses the same backend state as the old tour (completed/skipped flags).
 */
import { useState, useCallback, useEffect, useRef, createContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOnboarding, ONBOARDING_QUERY_KEY } from "@/hooks/useOnboarding";
import { X, Play } from "lucide-react";

export const OnboardingContext = createContext<{ triggerRestart: () => void }>({
  triggerRestart: () => {},
});

// Placeholder until a real video is ready
const INTRO_VIDEO_URL = "";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const {
    onboarding,
    isLoading,
    skipTutorial,
    completeTutorial,
  } = useOnboarding();

  const [show, setShow] = useState(false);
  const hasShownRef = useRef(false);

  // Show on first load when user hasn't dismissed it yet (works for all roles)
  useEffect(() => {
    if (isLoading || hasShownRef.current) return;
    if (!onboarding.completed && !onboarding.skipped) {
      hasShownRef.current = true;
      setShow(true);
    }
  }, [isLoading, onboarding.completed, onboarding.skipped]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    completeTutorial();
  }, [completeTutorial]);

  const handleSkip = useCallback(() => {
    setShow(false);
    skipTutorial();
  }, [skipTutorial]);

  // Called from Settings "Watch intro again" button
  const triggerRestart = useCallback(() => {
    hasShownRef.current = false;
    queryClient.setQueryData(ONBOARDING_QUERY_KEY, {
      completed: false,
      skipped: false,
      currentStage: 1,
      currentStep: 0,
      completedStages: [],
      startedAt: null,
      completedAt: null,
    });
    setShow(true);
  }, [queryClient]);

  return (
    <OnboardingContext.Provider value={{ triggerRestart }}>
      {children}

      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Welcome to LeadAwaker</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Watch this 2-minute overview to get started.</p>
              </div>
              <button
                onClick={handleSkip}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Video area */}
            <div className="mx-6 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 aspect-video flex items-center justify-center">
              {INTRO_VIDEO_URL ? (
                <iframe
                  src={INTRO_VIDEO_URL}
                  className="w-full h-full"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Play className="h-7 w-7 text-primary ml-1" />
                  </div>
                  <p className="text-sm font-medium">Intro video coming soon</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4">
              <button
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Watch later
              </button>
              <button
                onClick={handleDismiss}
                className="text-sm font-medium text-primary-foreground bg-primary px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Got it, let's go
              </button>
            </div>

          </div>
        </div>
      )}
    </OnboardingContext.Provider>
  );
}
