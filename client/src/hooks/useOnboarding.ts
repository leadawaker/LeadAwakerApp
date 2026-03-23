/**
 * Onboarding tutorial state management hook.
 * Persists progress to the user's preferences JSON via API.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { useCampaigns, useLeads } from "@/hooks/useApiData";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface OnboardingState {
  completed: boolean;
  skipped: boolean;
  currentStage: number;
  currentStep: number;
  completedStages: number[];
  startedAt: string | null;
  completedAt: string | null;
}

const DEFAULT_STATE: OnboardingState = {
  completed: false,
  skipped: false,
  currentStage: 1,
  currentStep: 0,
  completedStages: [],
  startedAt: null,
  completedAt: null,
};

export const ONBOARDING_QUERY_KEY = ["/api/onboarding/status"];
const QUERY_KEY = ONBOARDING_QUERY_KEY;

export function useOnboarding() {
  const queryClient = useQueryClient();
  const { currentAccountId, isAgencyUser } = useWorkspace();
  const { campaigns } = useCampaigns(currentAccountId);
  const { leads } = useLeads(currentAccountId);

  // Dev override: allow agency users to test onboarding (reactive via storage event)
  const [devOnboarding, setDevOnboarding] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("dev-onboarding") === "true"
  );
  useEffect(() => {
    const handler = () => setDevOnboarding(localStorage.getItem("dev-onboarding") === "true");
    window.addEventListener("dev-onboarding-changed", handler);
    return () => window.removeEventListener("dev-onboarding-changed", handler);
  }, []);

  // Fetch onboarding status
  const { data: onboarding = DEFAULT_STATE, isLoading } = useQuery<OnboardingState>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await apiFetch("/api/onboarding/status");
      if (!res.ok) return DEFAULT_STATE;
      return res.json();
    },
    staleTime: 60_000,
    enabled: !isAgencyUser || devOnboarding,
  });

  // Mutations
  const progressMutation = useMutation({
    mutationFn: async (data: Partial<OnboardingState>) => {
      const res = await apiFetch("/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update progress");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/onboarding/complete", { method: "POST" });
      if (!res.ok) throw new Error("Failed to complete onboarding");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
      localStorage.removeItem("dev-onboarding");
      window.dispatchEvent(new CustomEvent("dev-onboarding-changed"));
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/onboarding/skip", { method: "POST" });
      if (!res.ok) throw new Error("Failed to skip onboarding");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
      localStorage.removeItem("dev-onboarding");
      window.dispatchEvent(new CustomEvent("dev-onboarding-changed"));
    },
  });

  const restartMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/onboarding/restart", { method: "POST" });
      if (!res.ok) throw new Error("Failed to restart onboarding");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });

  // Stage completion detection
  // Stage 1: profile setup (tracked by completedStages)
  // Stage 2: campaigns exist for this account
  // Stage 3: leads exist for this account
  // Stage 4: conversations viewed (tracked by completedStages)
  const stageCompletion = useMemo(() => {
    const completed = onboarding.completedStages || [];
    return {
      1: completed.includes(1),
      2: campaigns.length > 0,
      3: leads.length > 0,
      4: completed.includes(4),
    };
  }, [onboarding.completedStages, campaigns, leads]);

  // Helpers
  const isActive = (!isAgencyUser || devOnboarding) && !onboarding.completed && !onboarding.skipped && !isLoading;

  const nextStep = useCallback(
    (stage: number, step: number) => {
      progressMutation.mutate({ currentStage: stage, currentStep: step });
    },
    [progressMutation]
  );

  const completeStage = useCallback(
    (stage: number) => {
      const newCompleted = [...(onboarding.completedStages || [])];
      if (!newCompleted.includes(stage)) newCompleted.push(stage);
      const nextStage = stage + 1;
      if (nextStage > 4) {
        completeMutation.mutate();
      } else {
        progressMutation.mutate({
          completedStages: newCompleted,
          currentStage: nextStage,
          currentStep: 0,
        });
      }
    },
    [onboarding.completedStages, progressMutation, completeMutation]
  );

  const skipTutorial = useCallback(() => {
    skipMutation.mutate();
  }, [skipMutation]);

  const restartTutorial = useCallback(() => {
    restartMutation.mutate();
  }, [restartMutation]);

  const startTutorial = useCallback((stage: number = 1) => {
    progressMutation.mutate({
      currentStage: stage,
      currentStep: 0,
      startedAt: new Date().toISOString(),
    });
  }, [progressMutation]);

  // Auto-advance: find first incomplete stage
  const firstIncompleteStage = useMemo(() => {
    for (let s = 1; s <= 4; s++) {
      if (!stageCompletion[s as keyof typeof stageCompletion]) return s;
    }
    return null; // all complete
  }, [stageCompletion]);

  return {
    onboarding,
    isLoading,
    isActive,
    stageCompletion,
    firstIncompleteStage,
    nextStep,
    completeStage,
    skipTutorial,
    restartTutorial,
    startTutorial,
    completeTutorial: () => completeMutation.mutate(),
  };
}
