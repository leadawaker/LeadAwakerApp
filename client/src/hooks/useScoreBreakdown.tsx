import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";

export interface ScoreBreakdown {
  lead_score: number;
  engagement_score: number;
  activity_score: number;
  funnel_weight: number;
  engagement_max: number;
  activity_max: number;
  funnel_max: number;
  tier: string;
  signals: string[];
  trend: "up" | "down" | "stable";
  sentiment: "positive" | "negative" | "neutral" | null;
  last_updated: string | null;
}

export function useScoreBreakdown(leadId: number | null) {
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchScore = useCallback(() => {
    if (!leadId) return;
    setLoading(true);
    apiFetch(`/api/leads/${leadId}/score-breakdown`)
      .then((r) => r.json())
      .then((data) => setBreakdown(data))
      .catch(() => setBreakdown(null))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  const resetToZero = useCallback(() => {
    setBreakdown((prev) =>
      prev
        ? { ...prev, lead_score: 0, engagement_score: 0, activity_score: 0, funnel_weight: 0, tier: "Sleeping", signals: [], trend: "stable" }
        : null,
    );
  }, []);

  return { breakdown, loading, refetch: fetchScore, resetToZero };
}

export const TIER_COLORS: Record<string, string> = {
  Hot:      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  Awake:    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  Lukewarm: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  Cold:     "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  Sleeping: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  Lost:     "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500 line-through",
};

export const TIER_ARC_COLOR: Record<string, string> = {
  Hot:      "#EF4444",
  Awake:    "#10B981",
  Lukewarm: "#F59E0B",
  Cold:     "#3B82F6",
  Sleeping: "#9CA3AF",
  Lost:     "#9CA3AF",
};

export const TIER_BAR_COLOR: Record<string, string> = {
  Hot:      "#EF4444",
  Awake:    "#10B981",
  Lukewarm: "#F59E0B",
  Cold:     "#3B82F6",
  Sleeping: "#9CA3AF",
  Lost:     "#9CA3AF",
};

export function TrendIcon({ trend, upClass, downClass }: { trend: "up" | "down" | "stable"; upClass?: string; downClass?: string }) {
  if (trend === "up")   return <TrendingUp className={upClass ?? "h-4 w-4 text-green-500"} />;
  if (trend === "down") return <TrendingDown className={downClass ?? "h-4 w-4 text-red-400"} />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export interface ScoreHistoryPoint {
  date: string;
  score: number;
}

export function useScoreHistory(leadId: number | null) {
  const [history, setHistory] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    const fetch = () => {
      setLoading(true);
      apiFetch(`/api/leads/${leadId}/score-history?days=14`)
        .then((r) => r.json())
        .then((data) => setHistory(Array.isArray(data) ? data : []))
        .catch(() => setHistory([]))
        .finally(() => setLoading(false));
    };
    fetch();
  }, [leadId]);

  return { history, loading };
}
