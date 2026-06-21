import { type PointerEvent as ReactPointerEvent, useState, useCallback } from "react";
import { Bot, X, ChevronLeft, PanelRight, PanelRightClose, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import type { AiAgent, AiSession } from "../hooks/useAgentChat";
// ─── Widget Header ────────────────────────────────────────────────────────────

export interface AgentChatWidgetHeaderProps {
  isMobile: boolean;
  activeAgentId: number | null | undefined;
  activeAgent: AiAgent | null;
  activeSession: AiSession | null;
  activeStreaming?: boolean;
  activePageAwareness?: boolean;
  isCodeRunner?: boolean;
  elementPicker?: unknown;
  closeWidget: () => void;
  handleBack: () => void;
  togglePageAwareness?: () => void;
  onDragPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDragPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDragPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  dockMode: boolean;
  onToggleDock: () => void;
  onTitleRegenerated?: (title: string) => void;
}

export function AgentChatWidgetHeader({
  isMobile,
  activeAgentId,
  activeAgent,
  activeSession,
  closeWidget,
  handleBack,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  dockMode,
  onToggleDock,
  onTitleRegenerated,
}: AgentChatWidgetHeaderProps) {
  const { t } = useTranslation("crm");
  const [titleHovered, setTitleHovered] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerateTitle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeSession || regenerating) return;
    setRegenerating(true);
    try {
      const res = await apiFetch(`/api/agents/sessions/${activeSession.sessionId}/regenerate-title`, { method: "POST" });
      if (res.ok) {
        const { title } = await res.json();
        onTitleRegenerated?.(title);
      }
    } catch {
      // ignore
    } finally {
      setRegenerating(false);
    }
  }, [activeSession, regenerating, onTitleRegenerated]);
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 min-h-[52px] border-b border-border/40 bg-transparent shrink-0",
        !isMobile && "cursor-grab active:cursor-grabbing select-none",
      )}
      onPointerDown={!isMobile ? onDragPointerDown : undefined}
      onPointerMove={!isMobile ? onDragPointerMove : undefined}
      onPointerUp={!isMobile ? onDragPointerUp : undefined}
    >
      {activeAgentId && activeAgent ? (
        <>
          <button
            onClick={handleBack}
            className="h-8 w-8 max-md:h-11 max-md:w-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
            data-testid="widget-back-btn"
          >
            <ChevronLeft className="h-4 w-4 max-md:h-5 max-md:w-5" />
          </button>
          {/* Claude logo icon */}
          <div className="h-7 w-7 flex items-center justify-center shrink-0">
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg" alt="Claude" className="h-5 w-5" />
          </div>
          <div
            className="flex-1 min-w-0 cursor-default"
            onMouseEnter={() => setTitleHovered(true)}
            onMouseLeave={() => setTitleHovered(false)}
          >
            <div className="flex items-center gap-1 min-w-0">
              <div className="font-semibold text-xs truncate" title={activeSession?.title || activeAgent.name}>
                {activeSession?.title || activeAgent.name}
              </div>
              {activeSession?.title && (titleHovered || regenerating) && (
                <button
                  onClick={handleRegenerateTitle}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="shrink-0 h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                  title="Regenerate title from conversation"
                >
                  <RefreshCw className={cn("h-3 w-3", regenerating && "animate-spin")} />
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <Bot className="h-5 w-5 text-brand-indigo shrink-0 ml-1" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-xs">AI Agents</div>
            <div className="text-[9px] text-muted-foreground">Your CRM co-pilots</div>
          </div>
        </>
      )}
      {/* Dock/fold toggle — desktop only (no docking on a phone) */}
      {!isMobile && (
        <button
          onClick={onToggleDock}
          className="inline-flex h-9 w-9 rounded-full items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
          title={dockMode ? t("agentWidget.undock") : t("agentWidget.dockToSide")}
          aria-label={dockMode ? t("agentWidget.undock") : t("agentWidget.dockToSide")}
          data-testid="agent-widget-dock-toggle"
        >
          {dockMode ? <PanelRightClose className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
        </button>
      )}
      <button
        onClick={closeWidget}
        className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
        title="Close"
        data-testid="agent-widget-minimize"
        aria-label="Close AI Agent chat"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
