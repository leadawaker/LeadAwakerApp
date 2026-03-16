import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { usePageContext, type PageContext } from "@/features/ai-agents/hooks/usePageContext";

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
}

const AgentWidgetContext = createContext<AgentWidgetState | null>(null);

export function AgentWidgetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<number | null>(null);
  const pageContext = usePageContext();

  // Persist last active agent ID to localStorage
  useEffect(() => {
    if (activeAgentId) {
      localStorage.setItem(LAST_AGENT_KEY, String(activeAgentId));
    }
  }, [activeAgentId]);

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
        // Opening: restore last agent so user goes straight to the conversation
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

  return (
    <AgentWidgetContext.Provider
      value={{ isOpen, activeAgentId, pageContext, openWidget, closeWidget, toggleWidget, selectAgent, clearAgent }}
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
