import { useEffect, useCallback, useMemo, useRef } from "react";
import { useAgentChat } from "../hooks/useAgentChat";
import { usePageContext } from "../hooks/usePageContext";
import { usePageEntity } from "@/contexts/PageEntityContext";
import { AgentChatView } from "./AgentChatView";
import type { AiAgent, AiSession } from "../hooks/useAgentChat";
import type { PageContext } from "../hooks/usePageContext";

export interface ConversationPanelRef {
  agent: AiAgent | null;
  session: AiSession | null;
  streaming: boolean;
}

/**
 * Self-contained conversation panel for a single agent.
 * Each instance manages its own useAgentChat hook, so multiple
 * panels can exist simultaneously with independent streaming state.
 *
 * Hidden panels stay mounted (preserving scroll position, input draft,
 * and active SSE streams).
 */
export function ConversationPanel({
  agentId,
  isActive,
  onAgentLoaded,
  onSessionChange,
  onNewSession,
  onSettingsOpen,
}: {
  agentId: number;
  isActive: boolean;
  onAgentLoaded?: (agentId: number, agent: AiAgent) => void;
  onSessionChange?: (agentId: number, session: AiSession | null) => void;
  onNewSession?: () => void;
  onSettingsOpen?: () => void;
}) {
  const {
    agent,
    setAgent,
    session,
    messages,
    streaming,
    streamingText,
    loading,
    initialize,
    sendMessage,
    newSession,
    updateSessionModel,
    updateSessionThinking,
  } = useAgentChat();

  const routeContext = usePageContext();
  const { entityData } = usePageEntity();

  // Merge route context with on-screen entity data
  const pageContext: PageContext = useMemo(
    () => ({
      ...routeContext,
      ...(entityData
        ? {
            entityData: {
              entityType: entityData.entityType,
              entityId: entityData.entityId,
              entityName: entityData.entityName,
              summary: entityData.summary,
              filters: entityData.filters,
            },
          }
        : {}),
    }),
    [routeContext, entityData],
  );

  // Wrap sendMessage to include page context
  const sendMessageWithContext = useCallback(
    (text: string, attachment?: string, fileId?: number) => {
      return sendMessage(text, attachment, fileId, pageContext);
    },
    [sendMessage, pageContext],
  );

  // Initialize on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      initialize(agentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Notify parent when agent loads
  useEffect(() => {
    if (agent && onAgentLoaded) {
      onAgentLoaded(agentId, agent);
    }
  }, [agent, agentId, onAgentLoaded]);

  // Notify parent when session changes
  useEffect(() => {
    if (onSessionChange) {
      onSessionChange(agentId, session);
    }
  }, [session, agentId, onSessionChange]);

  // Suppress unused — these are for parent reference
  void setAgent;
  void onSettingsOpen;

  if (!agent) return null;

  return (
    <div
      className={isActive ? "flex flex-col h-full" : "hidden"}
      data-testid={`conversation-panel-${agentId}`}
    >
      <AgentChatView
        agent={agent}
        messages={messages}
        streaming={streaming}
        streamingText={streamingText}
        loading={loading}
        onSend={sendMessageWithContext}
        onNewSession={newSession}
        sessionId={session?.sessionId}
      />
    </div>
  );
}
