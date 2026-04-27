import { useEffect, useState, useCallback, useRef } from "react";
import { useAgentChat } from "../hooks/useAgentChat";
import { usePageContext } from "../hooks/usePageContext";
import { usePageEntity } from "@/contexts/PageEntityContext";
import { AgentChatView } from "./AgentChatView";
import type { AiAgent, AiSession } from "../hooks/useAgentChat";
import type { PageContext } from "../hooks/usePageContext";

// ─── Single Conversation Panel ──────────────────────────────────────────────
// Each instance has its own useAgentChat hook → independent streaming state.
// Hidden panels stay mounted (DOM hidden), preserving scroll position + input draft.

export interface ConversationPanelProps {
  agentId: number;
  isActive: boolean;
  onAgentLoaded: (agentId: number, agent: AiAgent) => void;
  onSessionUpdate: (agentId: number, session: AiSession | null, streaming: boolean) => void;
  onMessageCountUpdate: (agentId: number, count: number) => void;
  selectedElement?: import("../hooks/useElementPicker").SelectedElementInfo | null;
  onClearElement?: () => void;
  selectionLocked?: boolean;
  onToggleSelectionLock?: () => void;
}

export function ConversationPanel({ agentId, isActive, onAgentLoaded, onSessionUpdate, selectedElement, onClearElement, selectionLocked, onToggleSelectionLock }: ConversationPanelProps) {
  const {
    agent,
    session,
    messages,
    streaming,
    streamingText,
    streamingBubbles,
    loading,
    pendingConfirmation,
    activity,
    initialize,
    sendMessage,
    newSession,
    updateSessionModel,
    updateSessionThinking,
    confirmDestructiveActions,
    cancelDestructiveActions,
    abortStream,
  } = useAgentChat();

  const routeContext = usePageContext();
  const { entityData } = usePageEntity();

  // Merge route + entity context
  const pageContext: PageContext = {
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
  };

  const sendMessageWithContext = useCallback(
    (text: string, attachment?: string, fileId?: number) => {
      return sendMessage(text, attachment, fileId, pageContext);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendMessage, routeContext, entityData],
  );

  // Initialize once on mount
  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      initialize(agentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Notify parent of agent info once loaded
  useEffect(() => {
    if (agent) onAgentLoaded(agentId, agent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  // Notify parent of session/streaming changes (for header display)
  useEffect(() => {
    onSessionUpdate(agentId, session, streaming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, streaming]);

  if (!agent) return null;

  return (
    <div
      className={isActive ? "flex flex-col h-full" : "hidden"}
      data-testid={`conversation-panel-${agentId}`}
      data-agent-id={agentId}
    >
      <AgentChatView
        agent={agent}
        messages={messages}
        streaming={streaming}
        streamingText={streamingText}
        streamingBubbles={streamingBubbles}
        loading={loading}
        onSend={sendMessageWithContext}
        onNewSession={newSession}
        sessionId={session?.sessionId}
        pendingConfirmation={pendingConfirmation}
        activity={activity}
        onConfirmDestructive={confirmDestructiveActions}
        onCancelDestructive={cancelDestructiveActions}
        onAbort={abortStream}
        selectedElement={selectedElement}
        onClearElement={onClearElement}
        selectionLocked={selectionLocked}
        onToggleSelectionLock={onToggleSelectionLock}
      />
    </div>
  );
}

// ─── ConversationPanel with event listeners for model/thinking/newSession ────
// This wraps useAgentChat and listens for CustomEvents from the header buttons.

export function ConversationPanelWithEvents({
  agentId,
  isActive,
  onAgentLoaded,
  onSessionUpdate,
  onMessageCountUpdate,
  selectedElement,
  onClearElement,
  selectionLocked,
  onToggleSelectionLock,
}: ConversationPanelProps) {
  const {
    agent,
    session,
    messages,
    streaming,
    streamingText,
    streamingBubbles,
    loading,
    pendingConfirmation,
    activity,
    initialize,
    sendMessage,
    newSession,
    loadSession,
    deleteConversation,
    updateSessionModel,
    updateSessionThinking,
    confirmDestructiveActions,
    cancelDestructiveActions,
    abortStream,
  } = useAgentChat();

  const routeContext = usePageContext();
  const { entityData } = usePageEntity();

  // Per-session page awareness toggle (defaults from agent setting)
  const [pageAwarenessEnabled, setPageAwarenessEnabled] = useState(true);
  // Set default from agent once loaded
  useEffect(() => {
    if (agent) {
      setPageAwarenessEnabled(agent.pageAwarenessEnabled !== false);
    }
  }, [agent]);

  const sendMessageWithContext = useCallback(
    (text: string, attachment?: string, fileId?: number) => {
      // When page awareness is disabled, don't send page context
      if (!pageAwarenessEnabled) {
        return sendMessage(text, attachment, fileId, undefined);
      }
      const pc: PageContext = {
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
      };
      return sendMessage(text, attachment, fileId, pc);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendMessage, routeContext, entityData, pageAwarenessEnabled],
  );

  // Initialize once on mount
  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      initialize(agentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Notify parent of agent info
  useEffect(() => {
    if (agent) onAgentLoaded(agentId, agent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  // Notify parent of session/streaming state
  useEffect(() => {
    onSessionUpdate(agentId, session, streaming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, streaming]);

  // Notify parent of message count changes (for unread indicators)
  useEffect(() => {
    onMessageCountUpdate(agentId, messages.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Listen for header events (model change, thinking change, new session)
  useEffect(() => {
    const handleModelChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.agentId === agentId) updateSessionModel(detail.model);
    };
    const handleThinkingChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.agentId === agentId) updateSessionThinking(detail.thinkingLevel);
    };
    const handleNewSession = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.agentId === agentId) newSession();
    };
    const handleDeleteConversation = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.agentId === agentId) deleteConversation();
    };
    const handlePageAwarenessToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.agentId === agentId) setPageAwarenessEnabled(detail.enabled);
    };
    // Toggle request from slash command (doesn't know current state)
    const handlePageAwarenessToggleRequest = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.agentId === agentId) setPageAwarenessEnabled((prev) => !prev);
    };
    const handleLoadSession = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.agentId === agentId && detail.sessionId) loadSession(detail.sessionId);
    };

    window.addEventListener("agent-model-change", handleModelChange);
    window.addEventListener("agent-thinking-change", handleThinkingChange);
    window.addEventListener("agent-new-session", handleNewSession);
    window.addEventListener("agent-delete-conversation", handleDeleteConversation);
    window.addEventListener("agent-page-awareness-toggle", handlePageAwarenessToggle);
    window.addEventListener("agent-page-awareness-toggle-request", handlePageAwarenessToggleRequest);
    window.addEventListener("agent-load-session", handleLoadSession);
    return () => {
      window.removeEventListener("agent-model-change", handleModelChange);
      window.removeEventListener("agent-thinking-change", handleThinkingChange);
      window.removeEventListener("agent-new-session", handleNewSession);
      window.removeEventListener("agent-delete-conversation", handleDeleteConversation);
      window.removeEventListener("agent-page-awareness-toggle", handlePageAwarenessToggle);
      window.removeEventListener("agent-page-awareness-toggle-request", handlePageAwarenessToggleRequest);
      window.removeEventListener("agent-load-session", handleLoadSession);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, updateSessionModel, updateSessionThinking, newSession, deleteConversation, loadSession]);

  if (!agent) return null;

  return (
    <div
      className={isActive ? "flex flex-col h-full" : "hidden"}
      data-testid={`conversation-panel-${agentId}`}
      data-agent-id={agentId}
    >
      <AgentChatView
        agent={agent}
        messages={messages}
        streaming={streaming}
        streamingText={streamingText}
        streamingBubbles={streamingBubbles}
        loading={loading}
        onSend={sendMessageWithContext}
        onNewSession={newSession}
        sessionId={session?.sessionId}
        pendingConfirmation={pendingConfirmation}
        activity={activity}
        onConfirmDestructive={confirmDestructiveActions}
        onCancelDestructive={cancelDestructiveActions}
        onAbort={abortStream}
        selectedElement={selectedElement}
        onClearElement={onClearElement}
        selectionLocked={selectionLocked}
        onToggleSelectionLock={onToggleSelectionLock}
      />
    </div>
  );
}
