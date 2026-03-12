import { useEffect, useState, useCallback, useRef } from "react";
import { Bot, X, ChevronLeft, Cpu, Zap, MessageSquare, Loader2, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentWidget } from "@/contexts/AgentWidgetContext";
import { useAgentChat } from "../hooks/useAgentChat";
import { usePageContext } from "../hooks/usePageContext";
import { usePageEntity } from "@/contexts/PageEntityContext";
import { AgentChatView } from "./AgentChatView";
import { AgentSettingsSheet } from "./AgentSettingsSheet";
import { ModelSwitcher } from "./ModelSwitcher";
import { ThinkingToggle } from "./ThinkingToggle";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/apiUtils";
import type { AiAgent, AiSession } from "../hooks/useAgentChat";
import type { PageContext } from "../hooks/usePageContext";

// ─── Single Conversation Panel ──────────────────────────────────────────────
// Each instance has its own useAgentChat hook → independent streaming state.
// Hidden panels stay mounted (DOM hidden), preserving scroll position + input draft.

interface ConversationPanelProps {
  agentId: number;
  isActive: boolean;
  onAgentLoaded: (agentId: number, agent: AiAgent) => void;
  onSessionUpdate: (agentId: number, session: AiSession | null, streaming: boolean) => void;
  onMessageCountUpdate: (agentId: number, count: number) => void;
}

function ConversationPanel({ agentId, isActive, onAgentLoaded, onSessionUpdate }: ConversationPanelProps) {
  const {
    agent,
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
        loading={loading}
        onSend={sendMessageWithContext}
        onNewSession={newSession}
        sessionId={session?.sessionId}
      />
    </div>
  );
}

// ─── Agent Picker ────────────────────────────────────────────────────────────

function AgentPicker({
  onSelect,
  openAgentIds,
}: {
  onSelect: (agent: AiAgent) => void;
  openAgentIds: Set<number>;
}) {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/ai-agents")
      .then((r) => r.json())
      .then((data: unknown) => setAgents(Array.isArray(data) ? (data as AiAgent[]) : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="text-sm font-semibold text-foreground mb-1">Choose an agent</div>
      {agents.map((agent) => {
        const hasActive = openAgentIds.has(agent.id);
        const tagline =
          agent.type === "code_runner"
            ? "Codebase access · Live reload"
            : agent.type === "campaign_crafter"
            ? "Campaigns · Messaging"
            : "Custom AI assistant";
        return (
          <button
            key={agent.id}
            onClick={() => onSelect(agent)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl bg-card border transition-all text-left",
              hasActive
                ? "border-brand-indigo/40 bg-brand-indigo/5 shadow-sm"
                : "border-border/50 hover:border-brand-indigo/30 hover:shadow-sm",
            )}
            data-testid={`widget-agent-${agent.id}`}
          >
            <Avatar className="h-10 w-10 shrink-0">
              {agent.photoUrl ? <AvatarImage src={agent.photoUrl} alt={agent.name} /> : null}
              <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo font-bold text-sm">
                {agent.type === "code_runner" ? (
                  <Zap className="h-5 w-5" />
                ) : agent.type === "campaign_crafter" ? (
                  <MessageSquare className="h-5 w-5" />
                ) : (
                  <Cpu className="h-5 w-5" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{agent.name}</div>
              <div className="text-[11px] text-muted-foreground">{tagline}</div>
            </div>
            {hasActive && (
              <span className="text-[10px] font-medium text-brand-indigo bg-brand-indigo/10 px-2 py-0.5 rounded-full shrink-0">
                Active
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Conversation Tabs (shown when 2+ conversations are open) ────────────────

interface ConversationMeta {
  agent: AiAgent;
  session: AiSession | null;
  streaming: boolean;
  /** Number of messages when user last viewed this conversation */
  lastSeenMessageCount: number;
  /** Total message count (user + assistant) */
  totalMessageCount: number;
}

/** Get icon for agent type */
function AgentIcon({ agent, className }: { agent: AiAgent; className?: string }) {
  if (agent.type === "code_runner") return <Zap className={className} />;
  if (agent.type === "campaign_crafter") return <MessageSquare className={className} />;
  return <Cpu className={className} />;
}

function ConversationTabs({
  conversations,
  activeAgentId,
  onSelect,
}: {
  conversations: Map<number, ConversationMeta>;
  activeAgentId: number;
  onSelect: (agentId: number) => void;
}) {
  if (conversations.size < 2) return null;

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30 bg-muted/20 overflow-x-auto shrink-0"
      data-testid="conversation-tabs"
    >
      {Array.from(conversations.entries()).map(([agentId, meta]) => {
        const isActive = agentId === activeAgentId;
        const isStreaming = meta.streaming;
        const unreadCount = Math.max(0, meta.totalMessageCount - meta.lastSeenMessageCount);
        const hasUnread = !isActive && unreadCount > 0;

        return (
          <button
            key={agentId}
            onClick={() => onSelect(agentId)}
            className={cn(
              "relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all shrink-0",
              isActive
                ? "bg-brand-indigo/10 text-brand-indigo ring-1 ring-brand-indigo/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            data-testid={`conversation-tab-${agentId}`}
            title={meta.agent.name}
          >
            {/* Agent icon */}
            <div className="relative">
              {meta.agent.photoUrl ? (
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={meta.agent.photoUrl} alt={meta.agent.name} />
                  <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo text-[9px] font-bold">
                    <AgentIcon agent={meta.agent} className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                    isActive
                      ? "bg-brand-indigo/20 text-brand-indigo"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <AgentIcon agent={meta.agent} className="h-3 w-3" />
                </div>
              )}

              {/* Streaming indicator dot */}
              {isStreaming && !isActive && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse ring-1 ring-background" />
              )}

              {/* Unread notification badge */}
              {hasUnread && (
                <span
                  className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5 ring-1 ring-background"
                  data-testid={`tab-unread-${agentId}`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>

            {/* Agent name (compact) */}
            <span className="text-[11px] font-medium truncate max-w-[70px]">
              {meta.agent.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Widget Component ───────────────────────────────────────────────────

export function AgentChatWidget() {
  const { isOpen, activeAgentId, closeWidget, toggleWidget, selectAgent, clearAgent } = useAgentWidget();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Track all open agent conversations (persisted across agent switches)
  const [openAgentIds, setOpenAgentIds] = useState<Set<number>>(new Set());
  // Metadata for each conversation (agent info, session, streaming state)
  const conversationsRef = useRef<Map<number, ConversationMeta>>(new Map());
  const [conversationsMeta, setConversationsMeta] = useState<Map<number, ConversationMeta>>(new Map());

  // When activeAgentId changes, ensure it's in the open set
  useEffect(() => {
    if (activeAgentId && activeAgentId > 0) {
      setOpenAgentIds((prev) => {
        if (prev.has(activeAgentId)) return prev;
        const next = new Set(prev);
        next.add(activeAgentId);
        return next;
      });
    }
  }, [activeAgentId]);

  // Mark current active conversation as "seen" whenever active agent changes
  useEffect(() => {
    if (activeAgentId) {
      const meta = conversationsRef.current.get(activeAgentId);
      if (meta) {
        meta.lastSeenMessageCount = meta.totalMessageCount;
        conversationsRef.current.set(activeAgentId, { ...meta });
        setConversationsMeta(new Map(conversationsRef.current));
      }
    }
  }, [activeAgentId]);

  // Callbacks from ConversationPanel children
  const handleAgentLoaded = useCallback((agentId: number, agent: AiAgent) => {
    const existing = conversationsRef.current.get(agentId);
    conversationsRef.current.set(agentId, {
      agent,
      session: existing?.session ?? null,
      streaming: existing?.streaming ?? false,
      lastSeenMessageCount: existing?.lastSeenMessageCount ?? 0,
      totalMessageCount: existing?.totalMessageCount ?? 0,
    });
    setConversationsMeta(new Map(conversationsRef.current));
  }, []);

  const handleSessionUpdate = useCallback((agentId: number, session: AiSession | null, streaming: boolean) => {
    const existing = conversationsRef.current.get(agentId);
    if (existing) {
      existing.session = session;
      existing.streaming = streaming;
      conversationsRef.current.set(agentId, { ...existing });
    } else {
      conversationsRef.current.set(agentId, {
        agent: { id: agentId, name: "Agent", type: "", systemPrompt: null, photoUrl: null, enabled: true, displayOrder: 0 },
        session,
        streaming,
        lastSeenMessageCount: 0,
        totalMessageCount: 0,
      });
    }
    setConversationsMeta(new Map(conversationsRef.current));
  }, []);

  // Handle message count updates from conversation panels
  // Use a ref to access current activeAgentId without re-creating the callback
  const activeAgentIdRef = useRef(activeAgentId);
  activeAgentIdRef.current = activeAgentId;

  const handleMessageCountUpdate = useCallback((agentId: number, count: number) => {
    const meta = conversationsRef.current.get(agentId);
    if (meta) {
      meta.totalMessageCount = count;
      // If this is the currently active (visible) agent, auto-mark as seen
      if (agentId === activeAgentIdRef.current) {
        meta.lastSeenMessageCount = count;
      }
      conversationsRef.current.set(agentId, { ...meta });
      setConversationsMeta(new Map(conversationsRef.current));
    }
  }, []);

  const handleSelectAgent = (selected: AiAgent) => {
    selectAgent(selected.id);
  };

  const handleBack = () => {
    // Go to agent picker without destroying the conversation
    clearAgent();
  };

  // Get active conversation metadata
  const activeMeta = activeAgentId ? conversationsMeta.get(activeAgentId) : null;
  const activeAgent = activeMeta?.agent ?? null;
  const activeSession = activeMeta?.session ?? null;
  const activeStreaming = activeMeta?.streaming ?? false;
  const isCodeRunner = activeAgent?.type === "code_runner";

  // Check if user is agency user (admin)
  const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const isAgency = role === "Admin" || role === "Operator";
  const isAuthed = Boolean(localStorage.getItem("leadawaker_auth"));

  if (!isAuthed || !isAgency) return null;

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={toggleWidget}
        className={cn(
          "fixed bottom-6 right-6 z-[9998] h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300",
          "bg-brand-indigo text-white hover:bg-brand-indigo/90 hover:scale-105 active:scale-95",
          isOpen && "scale-0 opacity-0 pointer-events-none",
          !isOpen && "scale-100 opacity-100",
        )}
        data-testid="agent-widget-toggle"
        aria-label="Open AI Agent chat"
      >
        <Bot className="h-6 w-6" />
        {/* Pulse ring */}
        <span
          className="absolute inset-0 rounded-full animate-ping bg-brand-indigo/30 pointer-events-none"
          style={{ animationDuration: "3s" }}
        />
      </button>

      {/* ── Chat panel ── */}
      <div
        className={cn(
          "fixed z-[9999] flex flex-col bg-background border border-border/60 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 ease-out",
          "bottom-6 right-6 w-[400px] h-[560px]",
          "max-md:bottom-0 max-md:right-0 max-md:left-0 max-md:top-0 max-md:w-full max-md:h-full max-md:rounded-none",
          isOpen
            ? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
            : "translate-y-4 opacity-0 scale-95 pointer-events-none",
        )}
        data-testid="agent-widget-panel"
      >
        {/* ── Widget Header ── */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-background shrink-0">
          {activeAgentId && activeAgent ? (
            <>
              <button
                onClick={handleBack}
                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                data-testid="widget-back-btn"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Avatar className="h-8 w-8 shrink-0">
                {activeAgent.photoUrl ? (
                  <AvatarImage src={activeAgent.photoUrl} alt={activeAgent.name} />
                ) : null}
                <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo font-bold text-xs">
                  {isCodeRunner ? <Zap className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs truncate">{activeAgent.name}</div>
                {activeSession?.title ? (
                  <div
                    className="text-[9px] text-muted-foreground truncate"
                    data-testid="conversation-title"
                  >
                    {activeSession.title}
                  </div>
                ) : isCodeRunner ? (
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-green-500" />
                    <span className="text-[9px] text-muted-foreground">Connected</span>
                  </div>
                ) : null}
              </div>
              {activeSession && (
                <>
                  <ModelSwitcher
                    currentModel={activeSession.model}
                    onModelChange={(model) => {
                      // The ConversationPanel handles this internally
                      // We trigger a re-render via a custom event
                      window.dispatchEvent(
                        new CustomEvent("agent-model-change", {
                          detail: { agentId: activeAgentId, model },
                        }),
                      );
                    }}
                    disabled={activeStreaming}
                    compact
                  />
                  <ThinkingToggle
                    currentLevel={activeSession.thinkingLevel}
                    onLevelChange={(level) => {
                      window.dispatchEvent(
                        new CustomEvent("agent-thinking-change", {
                          detail: { agentId: activeAgentId, thinkingLevel: level },
                        }),
                      );
                    }}
                    disabled={activeStreaming}
                    compact
                  />
                </>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                data-testid="widget-settings-btn"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("agent-new-session", { detail: { agentId: activeAgentId } }),
                  );
                }}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                title="New conversation"
                data-testid="widget-new-session-btn"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
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
          <button
            onClick={closeWidget}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
            data-testid="agent-widget-close"
            aria-label="Close AI Agent chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Conversation Tabs (when 2+ open) ── */}
        <ConversationTabs
          conversations={conversationsMeta}
          activeAgentId={activeAgentId ?? 0}
          onSelect={(agentId) => selectAgent(agentId)}
        />

        {/* ── Widget Body ── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Agent picker (shown when no active agent) */}
          {!activeAgentId && (
            <AgentPicker onSelect={handleSelectAgent} openAgentIds={openAgentIds} />
          )}

          {/* Render all open conversation panels — hidden ones stay mounted */}
          {Array.from(openAgentIds).map((agentId) => (
            <ConversationPanelWithEvents
              key={agentId}
              agentId={agentId}
              isActive={agentId === activeAgentId}
              onAgentLoaded={handleAgentLoaded}
              onSessionUpdate={handleSessionUpdate}
              onMessageCountUpdate={handleMessageCountUpdate}
            />
          ))}
        </div>
      </div>

      {/* ── Agent Settings Sheet ── */}
      {activeAgent && (
        <AgentSettingsSheet
          agent={activeAgent}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onAgentUpdated={(updated) => {
            handleAgentLoaded(updated.id, updated);
          }}
        />
      )}
    </>
  );
}

// ─── ConversationPanel with event listeners for model/thinking/newSession ────
// This wraps useAgentChat and listens for CustomEvents from the header buttons.

function ConversationPanelWithEvents({
  agentId,
  isActive,
  onAgentLoaded,
  onSessionUpdate,
  onMessageCountUpdate,
}: ConversationPanelProps) {
  const {
    agent,
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

  const sendMessageWithContext = useCallback(
    (text: string, attachment?: string, fileId?: number) => {
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

    window.addEventListener("agent-model-change", handleModelChange);
    window.addEventListener("agent-thinking-change", handleThinkingChange);
    window.addEventListener("agent-new-session", handleNewSession);
    return () => {
      window.removeEventListener("agent-model-change", handleModelChange);
      window.removeEventListener("agent-thinking-change", handleThinkingChange);
      window.removeEventListener("agent-new-session", handleNewSession);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, updateSessionModel, updateSessionThinking, newSession]);

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
        loading={loading}
        onSend={sendMessageWithContext}
        onNewSession={newSession}
        sessionId={session?.sessionId}
      />
    </div>
  );
}
