import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Global list-panel state — shared across Prospects / Leads / Campaigns / Chats.
 * Values: "full" | "compact" | "hidden". When "full" and the right panel is narrow,
 * pages may auto-squeeze to compact via `useCompactPanelState`.
 */
export type ListPanelState = "full" | "compact" | "hidden";
const STORAGE_KEY = "la:list-panel-state";
const EVENT_NAME = "la:list-panel-state-changed";

function read(): ListPanelState {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "full" || v === "compact" || v === "hidden") return v;
    // If value is invalid, clear it and return default
    if (v !== null) localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  return "full";
}

function write(v: ListPanelState) {
  try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function subscribe(cb: () => void) {
  const onEvt = () => cb();
  window.addEventListener(EVENT_NAME, onEvt);
  window.addEventListener("storage", onEvt);
  return () => {
    window.removeEventListener(EVENT_NAME, onEvt);
    window.removeEventListener("storage", onEvt);
  };
}

export function useListPanelState() {
  const state = useSyncExternalStore(subscribe, read, () => "full" as const);

  const setState = useCallback((v: ListPanelState) => write(v), []);

  const cycle = useCallback(() => {
    const next: ListPanelState =
      state === "full" ? "compact"
      : state === "compact" ? "hidden"
      : "full";
    write(next);
  }, [state]);

  return { state, setState, cycle } as const;
}

// Back-compat migration: one-time read from legacy per-page keys on first load.
const LEGACY_KEYS = [
  "prospects-left-panel-state",
  "leads-left-panel-state",
  "campaigns-left-panel-state",
  "chats-list-panel-state",
];

export function migrateLegacyListPanelState() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return;
    for (const k of LEGACY_KEYS) {
      const v = localStorage.getItem(k);
      if (v === "full" || v === "compact" || v === "hidden") {
        localStorage.setItem(STORAGE_KEY, v);
        return;
      }
    }
  } catch { /* ignore */ }
}

// Auto-migrate on module load (runs once per session).
if (typeof window !== "undefined") {
  migrateLegacyListPanelState();
}

// Hook for components that need to keep the key sync across tabs (noop on load).
export function useListPanelStateSync() {
  useEffect(() => { /* subscription handled by useSyncExternalStore consumers */ }, []);
}
