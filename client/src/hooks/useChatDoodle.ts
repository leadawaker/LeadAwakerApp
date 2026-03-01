/**
 * Persistent chat doodle overlay preferences.
 * Stored in localStorage, synced across mounted components via window event.
 */
import { useState, useCallback, useEffect } from "react";
import type { DoodlePatternId } from "@/components/ui/doodle-patterns";

export interface ChatDoodleConfig {
  enabled: boolean;
  patternId: DoodlePatternId;
  color: number;       // opacity 0–100, default 35
  size: number;        // tile width in px (200–800)
  strokeColor: number; // 0 = black strokes, 100 = white strokes, default 0
  blendMode: string;   // CSS mix-blend-mode, default "overlay"
}

const STORAGE_KEY = "leadawaker_chat_doodle";
const SYNC_EVENT = "chat-doodle-change";

const DEFAULT_CONFIG: ChatDoodleConfig = {
  enabled: false,
  patternId: "doodle-1",
  color: 35,
  size: 400,
  strokeColor: 0,
  blendMode: "overlay",
};

function readConfig(): ChatDoodleConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

export function useChatDoodle() {
  const [config, setConfigState] = useState<ChatDoodleConfig>(readConfig);

  // Listen for changes from other components
  useEffect(() => {
    const handler = () => setConfigState(readConfig());
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const setConfig = useCallback((patch: Partial<ChatDoodleConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(SYNC_EVENT));
      return next;
    });
  }, []);

  return { config, setConfig };
}
