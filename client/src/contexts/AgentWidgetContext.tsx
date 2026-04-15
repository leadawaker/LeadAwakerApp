import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { usePageContext, type PageContext } from "@/features/ai-agents/hooks/usePageContext";
import {
  loadDockEnabled,
  saveDockEnabled,
  loadDockWidth,
  saveDockWidth,
  DOCK_MIN_WIDTH,
  DOCK_MAX_WIDTH,
  DOCK_BREAKPOINT_PX,
} from "@/features/ai-agents/components/agentWidgetUtils";

const LAST_AGENT_KEY = "leadawaker_last_agent_id";

export interface AgentWidgetState {
  /** Whether the widget panel is open */
  isOpen: boolean;
  /** The currently selected agent ID (null = show agent picker) */
  activeAgentId: number | null;
  /** Current page context (route, page name, params) */
  pageContext: PageContext;
  /** Open the widget, optionally selecting a specific agent */
  openWidget: (agentId?: number) => void;
  /** Close the widget (collapse to icon) */
  closeWidget: () => void;
  /** Toggle open/closed */
  toggleWidget: () => void;
  /** Select a different agent (keeps widget open) */
  selectAgent: (agentId: number) => void;
  /** Clear active agent (back to picker) */
  clearAgent: () => void;
  /** Whether dock mode is enabled (user preference, independent of viewport) */
  dockMode: boolean;
  /** Current dock width in pixels */
  dockWidth: number;
  /** Toggle the dock-mode preference */
  toggleDockMode: () => void;
  /** Set dock width (clamped to [DOCK_MIN_WIDTH, DOCK_MAX_WIDTH]) */
  setDockWidth: (px: number) => void;
  /** Reactive flag: true when viewport >= 1536px (Tailwind 2xl) */
  isWideViewport: boolean;
}

const AgentWidgetContext = createContext<AgentWidgetState | null>(null);

export function AgentWidgetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<number | null>(null);
  const pageContext = usePageContext();

  const [dockMode, setDockMode] = useState<boolean>(() => loadDockEnabled());
  const [dockWidth, setDockWidthState] = useState<number>(() => loadDockWidth());
  const [isWideViewport, setIsWideViewport] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia(`(min-width: ${DOCK_BREAKPOINT_PX}px)`).matches
      : false
  );

  useEffect(() => {
    if (activeAgentId) {
      localStorage.setItem(LAST_AGENT_KEY, String(activeAgentId));
    }
  }, [activeAgentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(min-width: ${DOCK_BREAKPOINT_PX}px)`);
    const handler = (e: MediaQueryListEvent) => setIsWideViewport(e.matches);
    setIsWideViewport(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const openWidget = useCallback((agentId?: number) => {
    setIsOpen(true);
    if (agentId !== undefined) setActiveAgentId(agentId);
  }, []);

  const closeWidget = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleWidget = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        setActiveAgentId((current) => {
          if (current) return current;
          const stored = localStorage.getItem(LAST_AGENT_KEY);
          return stored ? Number(stored) : null;
        });
      }
      return !prev;
    });
  }, []);

  const selectAgent = useCallback((agentId: number) => {
    setActiveAgentId(agentId);
  }, []);

  const clearAgent = useCallback(() => {
    setActiveAgentId(null);
  }, []);

  const toggleDockMode = useCallback(() => {
    setDockMode((prev) => {
      const next = !prev;
      saveDockEnabled(next);
      return next;
    });
  }, []);

  const setDockWidth = useCallback((px: number) => {
    const clamped = Math.max(DOCK_MIN_WIDTH, Math.min(DOCK_MAX_WIDTH, px));
    setDockWidthState(clamped);
    saveDockWidth(clamped);
  }, []);

  return (
    <AgentWidgetContext.Provider
      value={{
        isOpen,
        activeAgentId,
        pageContext,
        openWidget,
        closeWidget,
        toggleWidget,
        selectAgent,
        clearAgent,
        dockMode,
        dockWidth,
        toggleDockMode,
        setDockWidth,
        isWideViewport,
      }}
    >
      {children}
    </AgentWidgetContext.Provider>
  );
}

export function useAgentWidget(): AgentWidgetState {
  const ctx = useContext(AgentWidgetContext);
  if (!ctx) throw new Error("useAgentWidget must be used within AgentWidgetProvider");
  return ctx;
}
