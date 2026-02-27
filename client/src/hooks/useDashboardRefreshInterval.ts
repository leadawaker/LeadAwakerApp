/**
 * Hook for reading/writing the dashboard auto-refresh interval setting.
 * Interval is stored in localStorage so it persists across sessions.
 * A value of 0 means "off" (no auto-refresh).
 */
import { useState, useCallback } from "react";

const STORAGE_KEY = "dashboard-refresh-interval";
const DEFAULT_INTERVAL = 60; // seconds

export const REFRESH_INTERVAL_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 15, label: "15 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
] as const;

export type RefreshIntervalOption = typeof REFRESH_INTERVAL_OPTIONS[number]["value"];

function readStoredInterval(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_INTERVAL;
    const parsed = parseInt(raw, 10);
    const valid = REFRESH_INTERVAL_OPTIONS.map((o) => o.value);
    return valid.includes(parsed as RefreshIntervalOption) ? parsed : DEFAULT_INTERVAL;
  } catch {
    return DEFAULT_INTERVAL;
  }
}

export function useDashboardRefreshInterval() {
  const [intervalSeconds, setIntervalSecondsState] = useState<number>(readStoredInterval);

  const setIntervalSeconds = useCallback((value: number) => {
    setIntervalSecondsState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // localStorage not available
    }
  }, []);

  const labelForInterval = REFRESH_INTERVAL_OPTIONS.find((o) => o.value === intervalSeconds)?.label ?? `${intervalSeconds}s`;

  return { intervalSeconds, setIntervalSeconds, labelForInterval };
}
