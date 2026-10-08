import { useEffect, useState } from "react";

/**
 * Per-user (Owner only) switches for the three service pages that are hidden by
 * default: Speed to Lead, Missed Calls and Reputation. The source of truth is
 * users.preferences (JSON); localStorage mirrors it so nav, route guards and the
 * Home hub can read it synchronously without a flash.
 */
export type ServicePageKey = "speed" | "missedcall" | "reputation";

export type ServicePageToggles = Record<ServicePageKey, boolean>;

export const SERVICE_PAGE_KEYS: ServicePageKey[] = ["speed", "reputation", "missedcall"];

/** Key inside the users.preferences JSON. */
export const SERVICE_PAGE_PREF_KEYS: Record<ServicePageKey, string> = {
  speed: "showSpeedToLeadPage",
  missedcall: "showMissedCallsPage",
  reputation: "showReputationPage",
};

const LS_KEYS: Record<ServicePageKey, string> = {
  speed: "leadawaker_show_speed_page",
  missedcall: "leadawaker_show_missed_calls_page",
  reputation: "leadawaker_show_reputation_page",
};

/** Route each toggle controls. */
export const SERVICE_PAGE_PATHS: Record<ServicePageKey, string> = {
  speed: "/platform/speed-to-lead",
  missedcall: "/platform/missed-calls",
  reputation: "/platform/reputation",
};

export const PREFS_CHANGED_EVENT = "leadawaker-prefs-changed";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Synchronous read. Always all-off unless the real user role is Owner. */
export function readServicePageToggles(): ServicePageToggles {
  const owner = safeGet("leadawaker_user_role") === "Owner";
  return {
    speed: owner && safeGet(LS_KEYS.speed) === "1",
    missedcall: owner && safeGet(LS_KEYS.missedcall) === "1",
    reputation: owner && safeGet(LS_KEYS.reputation) === "1",
  };
}

/** Mirror one toggle into localStorage (does not dispatch the change event). */
export function writeServicePageToggle(key: ServicePageKey, on: boolean): void {
  try {
    localStorage.setItem(LS_KEYS[key], on ? "1" : "0");
  } catch {
    /* storage unavailable: the in-memory UI state still works */
  }
}

/** Copy all three toggles from a parsed preferences object into localStorage. */
export function hydrateServicePageToggles(prefs: Record<string, unknown> | null | undefined): void {
  for (const key of SERVICE_PAGE_KEYS) {
    writeServicePageToggle(key, !!prefs?.[SERVICE_PAGE_PREF_KEYS[key]]);
  }
}

export function clearServicePageToggles(): void {
  try {
    for (const key of SERVICE_PAGE_KEYS) localStorage.removeItem(LS_KEYS[key]);
  } catch {
    /* ignore */
  }
}

/** Reactive view of the toggles; updates on `leadawaker-prefs-changed`. */
export function useServicePageToggles(): ServicePageToggles {
  const [toggles, setToggles] = useState<ServicePageToggles>(readServicePageToggles);
  useEffect(() => {
    const handler = () => setToggles(readServicePageToggles());
    window.addEventListener(PREFS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(PREFS_CHANGED_EVENT, handler);
  }, []);
  return toggles;
}
