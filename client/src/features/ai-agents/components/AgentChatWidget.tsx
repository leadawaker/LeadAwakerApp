import { useEffect, useState, useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { Bot, X, ChevronLeft, Loader2, Plus, MapPin, MapPinOff, Minimize2, ChevronRight, Clock, MoreVertical, MousePointerClick, Check } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { useAgentWidget } from "@/contexts/AgentWidgetContext";
import { useAgentChat } from "../hooks/useAgentChat";
import { usePageContext } from "../hooks/usePageContext";
import { usePageEntity } from "@/contexts/PageEntityContext";
import { AgentChatView } from "./AgentChatView";
import { AgentSettingsSheet } from "./AgentSettingsSheet";
import { useElementPicker } from "../hooks/useElementPicker";
import { ElementPickerOverlay } from "./ElementPickerOverlay";
import { MODEL_OPTIONS } from "./ModelSwitcher";
import { THINKING_OPTIONS } from "./ThinkingToggle";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  selectedElement?: import("../hooks/useElementPicker").SelectedElementInfo | null;
  onClearElement?: () => void;
}

function ConversationPanel({ agentId, isActive, onAgentLoaded, onSessionUpdate, selectedElement, onClearElement }: ConversationPanelProps) {
  const {
    agent,
    session,
    messages,
    streaming,
    streamingText,
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
      />
    </div>
  );
}

// ─── Agent Picker ────────────────────────────────────────────────────────────

interface ConversationPreview {
  id: number;
  sessionId: string;
  title: string | null;
  updatedAt: string | null;
  lastMessage: { content: string; role: string; createdAt: string | null } | null;
}

function AgentPicker({
  onSelect,
  onNewConversation,
}: {
  onSelect: (agent: AiAgent, sessionId?: string) => void;
  onNewConversation: (agent: AiAgent) => void;
}) {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [allConversations, setAllConversations] = useState<(ConversationPreview & { agent: AiAgent })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/ai-agents");
        const data = await res.json() as AiAgent[];
        const agentList = Array.isArray(data) ? data.filter((a) => a.type === "code_runner") : [];
        if (cancelled) return;
        setAgents(agentList);

        // Fetch conversations for all agents in parallel
        const allConvs: (ConversationPreview & { agent: AiAgent })[] = [];
        await Promise.all(
          agentList.map(async (agent) => {
            try {
              const cRes = await apiFetch(`/api/agents/${agent.id}/conversations`);
              const cData = await cRes.json();
              if (Array.isArray(cData)) {
                for (const c of cData.slice(0, 10) as any[]) {
                  allConvs.push({
                    id: c.id,
                    sessionId: c.sessionId,
                    title: c.title,
                    updatedAt: c.updatedAt,
                    lastMessage: c.lastMessage,
                    agent,
                  });
                }
              }
            } catch { /* skip */ }
          }),
        );

        // Sort by most recent first
        allConvs.sort((a, b) => {
          const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return tb - ta;
        });

        if (!cancelled) setAllConversations(allConvs);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-3 overflow-y-auto h-full">
      {/* New conversation buttons — one per agent */}
      {agents.map((agent) => (
        <button
          key={`new-${agent.id}`}
          onClick={() => onNewConversation(agent)}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-brand-indigo hover:bg-brand-indigo/5 transition-colors"
          data-testid={`widget-agent-${agent.id}-new`}
        >
          <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", getAgentColor(agent.id).bg)}>
            <Bot className={cn("h-3.5 w-3.5", getAgentColor(agent.id).text)} />
          </div>
          <Plus className="h-3.5 w-3.5" />
          <span>New conversation</span>
          <span className="text-[10px] text-muted-foreground font-normal">({agent.name})</span>
        </button>
      ))}

      {allConversations.length > 0 && (
        <div className="h-px bg-border/40 mx-2 my-1" />
      )}

      {/* Flat conversation list sorted by recency */}
      {allConversations.map((conv) => {
        const color = getAgentColor(conv.agent.id);

        return (
          <button
            key={conv.sessionId}
            onClick={() => onSelect(conv.agent, conv.sessionId)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-muted/50 transition-colors group"
            data-testid={`widget-conv-${conv.sessionId}`}
          >
            {/* Agent avatar with per-agent color */}
            <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", color.bg)}>
              <Bot className={cn("h-3.5 w-3.5", color.text)} />
            </div>

            {/* Title + preview */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-foreground truncate">
                  {conv.title || "Untitled"}
                </span>
              </div>
              {conv.lastMessage && (
                <div className="text-[11px] text-muted-foreground truncate">
                  {conv.lastMessage.content.slice(0, 60)}
                </div>
              )}
            </div>

            {/* Time */}
            {conv.updatedAt && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {relativeTime(conv.updatedAt)}
              </span>
            )}
          </button>
        );
      })}

      {allConversations.length === 0 && (
        <div className="text-center text-xs text-muted-foreground py-8">
          No conversations yet. Start a new one above.
        </div>
      )}
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
  /** Whether page context is sent with messages (per-session override) */
  pageAwarenessEnabled: boolean;
}

/** Per-agent color palette (cycles by agent ID) */
const AGENT_COLORS = [
  { bg: "bg-blue-500/10", text: "text-blue-500", dot: "bg-blue-500" },
  { bg: "bg-purple-500/10", text: "text-purple-500", dot: "bg-purple-500" },
  { bg: "bg-amber-500/10", text: "text-amber-500", dot: "bg-amber-500" },
  { bg: "bg-emerald-500/10", text: "text-emerald-500", dot: "bg-emerald-500" },
  { bg: "bg-rose-500/10", text: "text-rose-500", dot: "bg-rose-500" },
];
function getAgentColor(agentId: number) {
  return AGENT_COLORS[agentId % AGENT_COLORS.length];
}

/** Get icon for agent type — always Bot (robot head) with per-agent color */
function AgentIcon({ agent, className }: { agent: AiAgent; className?: string }) {
  return <Bot className={cn(className, getAgentColor(agent.id).text)} />;
}

function ConversationTabs({
  conversations,
  activeAgentId,
  onSelect,
  onClose,
}: {
  conversations: Map<number, ConversationMeta>;
  activeAgentId: number;
  onSelect: (agentId: number) => void;
  onClose: (agentId: number) => void;
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
              "group relative flex items-center gap-1.5 px-2 py-1.5 max-md:px-3 max-md:py-2.5 max-md:min-h-[44px] rounded-lg transition-all shrink-0",
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

            {/* Close tab button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(agentId);
              }}
              className="h-4 w-4 max-md:h-7 max-md:w-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors shrink-0 opacity-0 group-hover:opacity-100 max-md:opacity-100"
              title="Close conversation"
              data-testid={`close-tab-${agentId}`}
            >
              <X className="h-2.5 w-2.5 max-md:h-3.5 max-md:w-3.5" />
            </button>
          </button>
        );
      })}
    </div>
  );
}

// ─── Widget resize constants ─────────────────────────────────────────────────

const WIDGET_SIZE_KEY = "leadawaker_widget_size";
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 560;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 900;

const WIDGET_POS_KEY = "leadawaker_widget_pos";
const DEFAULT_RIGHT = 24;
const DEFAULT_BOTTOM = 24;

interface WidgetPos { right: number; bottom: number }

function loadWidgetPos(): WidgetPos {
  try {
    const raw = localStorage.getItem(WIDGET_POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetPos;
      return { right: parsed.right, bottom: parsed.bottom };
    }
  } catch { /* ignore */ }
  return { right: DEFAULT_RIGHT, bottom: DEFAULT_BOTTOM };
}

function saveWidgetPos(pos: WidgetPos) {
  localStorage.setItem(WIDGET_POS_KEY, JSON.stringify(pos));
}

function clampPos(pos: WidgetPos, widgetW: number, widgetH: number): WidgetPos {
  const maxRight = Math.max(0, window.innerWidth - widgetW);
  const maxBottom = Math.max(0, window.innerHeight - widgetH);
  return {
    right: Math.max(0, Math.min(maxRight, pos.right)),
    bottom: Math.max(0, Math.min(maxBottom, pos.bottom)),
  };
}

interface WidgetSize { width: number; height: number }

function loadWidgetSize(): WidgetSize {
  try {
    const raw = localStorage.getItem(WIDGET_SIZE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetSize;
      return {
        width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed.width)),
        height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, parsed.height)),
      };
    }
  } catch { /* ignore */ }
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
}

function saveWidgetSize(size: WidgetSize) {
  localStorage.setItem(WIDGET_SIZE_KEY, JSON.stringify(size));
}

// ─── Main Widget Component ───────────────────────────────────────────────────

export function AgentChatWidget() {
  const { isOpen, activeAgentId, closeWidget, toggleWidget, selectAgent, clearAgent } = useAgentWidget();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // ── Element picker ──
  const elementPicker = useElementPicker();

  // ── Resize state ──
  const [widgetSize, setWidgetSize] = useState<WidgetSize>(loadWidgetSize);
  const resizingRef = useRef(false);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number; right: number; bottom: number; corner: string } | null>(null);

  // ── Drag-to-reposition state (desktop only) ──
  const [widgetPos, setWidgetPos] = useState<WidgetPos>(loadWidgetPos);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; right: number; bottom: number } | null>(null);

  const onDragPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < 768) return;
    // Don't start drag when clicking buttons inside the header
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY, right: widgetPos.right, bottom: widgetPos.bottom };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, [widgetPos]);

  const onDragPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !dragStartRef.current) return;
    const { x, y, right, bottom } = dragStartRef.current;
    const newRight = right - (e.clientX - x);
    const newBottom = bottom - (e.clientY - y);
    setWidgetPos(clampPos({ right: newRight, bottom: newBottom }, widgetSize.width, widgetSize.height));
  }, [widgetSize]);

  const onDragPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    setWidgetPos((cur) => { saveWidgetPos(cur); return cur; });
  }, []);

  const onResizePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    const corner = (e.currentTarget as HTMLDivElement).dataset.corner || "tl";
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: widgetSize.width, h: widgetSize.height, right: widgetPos.right, bottom: widgetPos.bottom, corner };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, [widgetSize, widgetPos]);

  const onResizePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizingRef.current || !resizeStartRef.current) return;
    const { x, y, w, h, right, bottom, corner } = resizeStartRef.current;
    const dx = e.clientX - x;
    const dy = e.clientY - y;
    // Compute new size based on which corner is being dragged
    let newW = w, newH = h, newRight = right, newBottom = bottom;
    if (corner === "tl") {
      newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w - dx));
      newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h - dy));
    } else if (corner === "tr") {
      newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w + dx));
      newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h - dy));
      newRight = right - (newW - w);
    } else if (corner === "bl") {
      newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w - dx));
      newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h + dy));
      newBottom = bottom - (newH - h);
    } else {
      newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w + dx));
      newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h + dy));
      newRight = right - (newW - w);
      newBottom = bottom - (newH - h);
    }
    setWidgetSize({ width: newW, height: newH });
    if (newRight !== right || newBottom !== bottom) {
      setWidgetPos(clampPos({ right: newRight, bottom: newBottom }, newW, newH));
    }
  }, []);

  const onResizePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    setWidgetSize((cur) => { saveWidgetSize(cur); return cur; });
    setWidgetPos((cur) => { saveWidgetPos(cur); return cur; });
  }, []);

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
      pageAwarenessEnabled: existing?.pageAwarenessEnabled ?? (agent.pageAwarenessEnabled !== false),
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
        pageAwarenessEnabled: true,
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

  // Close a conversation: remove from open set, clean up metadata, switch to another or picker
  const closeConversation = useCallback((agentId: number) => {
    setOpenAgentIds((prev) => {
      const next = new Set(prev);
      next.delete(agentId);
      return next;
    });
    conversationsRef.current.delete(agentId);
    setConversationsMeta(new Map(conversationsRef.current));

    // If closing the active conversation, switch to another open one or go to picker
    if (activeAgentId === agentId) {
      const remaining = Array.from(openAgentIds).filter((id) => id !== agentId);
      if (remaining.length > 0) {
        selectAgent(remaining[remaining.length - 1]);
      } else {
        clearAgent();
      }
    }
  }, [activeAgentId, openAgentIds, selectAgent, clearAgent]);

  const handleSelectAgent = (selected: AiAgent, sessionId?: string) => {
    selectAgent(selected.id);
    if (sessionId) {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("agent-load-session", { detail: { agentId: selected.id, sessionId } }),
        );
      }, 100);
    }
  };

  // Create a brand new conversation for the given agent
  const handleNewConversation = useCallback((agent: AiAgent) => {
    selectAgent(agent.id);
    // Always dispatch new-session event — longer delay if panel needs to mount first
    const delay = openAgentIds.has(agent.id) ? 100 : 600;
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("agent-new-session", { detail: { agentId: agent.id } }),
      );
    }, delay);
  }, [selectAgent, openAgentIds]);

  const handleBack = () => {
    // Go to agent picker without destroying the conversation
    clearAgent();
  };

  // Get active conversation metadata
  const activeMeta = activeAgentId ? conversationsMeta.get(activeAgentId) : null;
  const activeAgent = activeMeta?.agent ?? null;
  const activeSession = activeMeta?.session ?? null;
  const activeStreaming = activeMeta?.streaming ?? false;
  const activePageAwareness = activeMeta?.pageAwarenessEnabled ?? true;
  const isCodeRunner = activeAgent?.type === "code_runner";

  // Toggle page awareness for the active conversation (per-session, doesn't change agent default)
  const togglePageAwareness = useCallback(() => {
    if (!activeAgentId) return;
    const meta = conversationsRef.current.get(activeAgentId);
    if (meta) {
      meta.pageAwarenessEnabled = !meta.pageAwarenessEnabled;
      conversationsRef.current.set(activeAgentId, { ...meta });
      setConversationsMeta(new Map(conversationsRef.current));
      // Notify the ConversationPanel via CustomEvent
      window.dispatchEvent(
        new CustomEvent("agent-page-awareness-toggle", {
          detail: { agentId: activeAgentId, enabled: meta.pageAwarenessEnabled },
        }),
      );
    }
  }, [activeAgentId]);

  // Lock body scroll on mobile when widget is open
  useEffect(() => {
    const isMobileView = window.matchMedia("(max-width: 767px)").matches;
    if (isOpen && isMobileView) {
      const prevOverflow = document.body.style.overflow;
      const prevPosition = document.body.style.position;
      const prevTop = document.body.style.top;
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.position = prevPosition;
        document.body.style.top = prevTop;
        document.body.style.width = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Close widget on browser back button (mobile UX)
  useEffect(() => {
    if (!isOpen) return;
    const handlePopState = () => {
      if (isOpen) {
        closeWidget();
      }
    };
    // Push a history entry so back button closes widget instead of navigating
    window.history.pushState({ agentWidgetOpen: true }, "");
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Check if user is agency user (admin)
  const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const isAgency = role === "Admin" || role === "Operator";
  const isAuthed = Boolean(localStorage.getItem("leadawaker_auth"));

  if (!isAuthed || !isAgency) return null;

  return (
    <>
      {/* ── Chat panel ── */}
      <div
        data-agent-widget
        className={cn(
          "fixed z-[9999] flex flex-col bg-[#f5f5f5] dark:bg-[#1a1a2e] border border-border/60 shadow-2xl overflow-hidden transition-all duration-300 ease-out",
          "rounded-2xl",
          "max-md:bottom-0 max-md:right-0 max-md:left-0 max-md:top-0 max-md:w-full max-md:h-full max-md:rounded-none max-md:border-0",
          isOpen
            ? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
            : "md:translate-y-4 md:opacity-0 md:scale-95 max-md:translate-y-full max-md:opacity-100 pointer-events-none",
        )}
        style={{
          right: widgetPos.right,
          bottom: widgetPos.bottom,
          width: `${widgetSize.width}px`,
          height: `${widgetSize.height}px`,
        }}
        data-testid="agent-widget-panel"
      >
        {/* ── Resize handles (all 4 corners, invisible) ── */}
        {(["tl", "tr", "bl", "br"] as const).map((corner) => (
          <div
            key={corner}
            data-corner={corner}
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            className={cn(
              "absolute z-10 w-5 h-5 hidden md:block touch-none",
              corner === "tl" && "top-0 left-0 cursor-nw-resize",
              corner === "tr" && "top-0 right-0 cursor-ne-resize",
              corner === "bl" && "bottom-0 left-0 cursor-sw-resize",
              corner === "br" && "bottom-0 right-0 cursor-se-resize",
            )}
          />
        ))}
        {/* ── Widget Header ── */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-white dark:bg-card shrink-0 touch-none select-none",
            draggingRef.current ? "md:cursor-grabbing" : "md:cursor-grab",
          )}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
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
              {/* Per-agent colored robot icon */}
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", getAgentColor(activeAgent.id).bg)}>
                <AgentIcon agent={activeAgent} className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0 cursor-default" title={activeSession?.title ? `${activeAgent.name} \u2014 ${activeSession.title}` : activeAgent.name}>
                <div className="font-semibold text-xs truncate">
                  {activeSession?.title || activeAgent.name}
                </div>
                {activeSession?.title ? (
                  <div className="text-[9px] text-muted-foreground truncate">
                    {activeAgent.name}
                  </div>
                ) : isCodeRunner ? (
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-green-500" />
                    <span className="text-[9px] text-muted-foreground">Connected</span>
                  </div>
                ) : null}
              </div>
              {/* Context usage % indicator in header */}
              {activeSession && ((activeSession.totalInputTokens || 0) + (activeSession.totalOutputTokens || 0)) > 0 && (() => {
                const total = (activeSession.totalInputTokens || 0) + (activeSession.totalOutputTokens || 0);
                const maxTokens = 200_000;
                const pct = Math.min(100, Math.round((total / maxTokens) * 100));
                const color = pct > 80 ? "text-red-500" : pct > 50 ? "text-amber-500" : "text-muted-foreground";
                return (
                  <div
                    className={cn("flex items-center gap-1 shrink-0 cursor-default", color)}
                    title={`Context: ${total.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${pct}%)`}
                  >
                    <div className="w-8 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-brand-indigo",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono font-medium">{pct}%</span>
                  </div>
                );
              })()}
              {/* Element picker toggle (desktop only) */}
              <div className="hidden md:flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => elementPicker.pickerActive ? elementPicker.deactivate() : elementPicker.activate()}
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center transition-colors shrink-0",
                    elementPicker.pickerActive
                      ? "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                      : elementPicker.confirmedInfo
                        ? "text-violet-500 hover:bg-muted"
                        : "text-muted-foreground hover:bg-muted",
                  )}
                  title={elementPicker.pickerActive ? "Cancel element picker" : elementPicker.confirmedInfo ? "Re-select element" : "Select a page element"}
                >
                  <MousePointerClick className="h-3.5 w-3.5" />
                </button>
                {elementPicker.pickerActive && elementPicker.selectedInfo && (
                  <button
                    onClick={() => elementPicker.confirm()}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors shrink-0"
                    title="Confirm selection"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                {elementPicker.pickerActive && (
                  <button
                    onClick={() => elementPicker.deactivate()}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {/* "..." overflow menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-7 w-7 max-md:h-11 max-md:w-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                    data-testid="widget-overflow-menu"
                  >
                    <MoreVertical className="h-4 w-4 max-md:h-5 max-md:w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl z-[10000] p-1.5 min-w-0 w-auto">
                  {activeSession && (() => {
                    const modelOpts = MODEL_OPTIONS;
                    const thinkingOpts = THINKING_OPTIONS;
                    const curModel = modelOpts.find((m) => m.id === activeSession.model) || modelOpts[0];
                    const curThinking = thinkingOpts.find((t) => t.id === activeSession.thinkingLevel) || thinkingOpts[2];
                    const ModelIcon = curModel.icon;
                    const ThinkingIcon = curThinking.icon;
                    const nextModel = modelOpts[(modelOpts.indexOf(curModel) + 1) % modelOpts.length];
                    const nextThinking = thinkingOpts[(thinkingOpts.indexOf(curThinking) + 1) % thinkingOpts.length];
                    return (
                      <div className="flex items-center gap-1">
                        {/* Model cycle */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.dispatchEvent(
                              new CustomEvent("agent-model-change", {
                                detail: { agentId: activeAgentId, model: nextModel.id },
                              }),
                            );
                          }}
                          disabled={activeStreaming}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border border-border/50 px-2.5 py-2 max-md:py-2.5 text-[10px] font-medium transition-colors",
                            "hover:bg-muted/50 hover:border-border disabled:opacity-50 disabled:cursor-not-allowed",
                          )}
                          title={`Model: ${curModel.label} — tap to switch to ${nextModel.label}`}
                        >
                          <ModelIcon className={cn("h-3.5 w-3.5 shrink-0", curModel.color)} />
                          <span>{curModel.shortLabel}</span>
                        </button>
                        {/* Thinking cycle */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.dispatchEvent(
                              new CustomEvent("agent-thinking-change", {
                                detail: { agentId: activeAgentId, thinkingLevel: nextThinking.id },
                              }),
                            );
                          }}
                          disabled={activeStreaming}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border border-border/50 px-2.5 py-2 max-md:py-2.5 text-[10px] font-medium transition-colors",
                            "hover:bg-muted/50 hover:border-border disabled:opacity-50 disabled:cursor-not-allowed",
                          )}
                          title={`Thinking: ${curThinking.label} — tap to switch to ${nextThinking.label}`}
                        >
                          <ThinkingIcon className={cn("h-3.5 w-3.5 shrink-0", curThinking.color)} />
                          <span>{curThinking.label}</span>
                        </button>
                        {/* Page awareness toggle */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePageAwareness();
                          }}
                          className={cn(
                            "flex items-center justify-center rounded-lg border px-2 py-2 max-md:py-2.5 transition-colors",
                            activePageAwareness
                              ? "border-brand-indigo/30 bg-brand-indigo/5 text-brand-indigo"
                              : "border-border/50 text-muted-foreground hover:bg-muted/50",
                          )}
                          title={activePageAwareness ? "Page awareness ON — tap to disable" : "Page awareness OFF — tap to enable"}
                        >
                          {activePageAwareness ? (
                            <MapPin className="h-3.5 w-3.5" />
                          ) : (
                            <MapPinOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {/* New conversation */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.dispatchEvent(
                              new CustomEvent("agent-new-session", { detail: { agentId: activeAgentId } }),
                            );
                          }}
                          className="flex items-center justify-center rounded-lg border border-border/50 px-2 py-2 max-md:py-2.5 text-muted-foreground hover:bg-muted/50 hover:border-border transition-colors"
                          title="New conversation"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })()}
                </DropdownMenuContent>
              </DropdownMenu>
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
            className="h-7 w-7 max-md:h-11 max-md:w-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
            title="Minimize"
            data-testid="agent-widget-minimize"
            aria-label="Minimize AI Agent chat"
          >
            <Minimize2 className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
          </button>
        </div>

        {/* ── Conversation Tabs (when 2+ open) ── */}
        <ConversationTabs
          conversations={conversationsMeta}
          activeAgentId={activeAgentId ?? 0}
          onSelect={(agentId) => selectAgent(agentId)}
          onClose={closeConversation}
        />

        {/* ── Widget Body ── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Agent picker (shown when no active agent) */}
          {!activeAgentId && (
            <AgentPicker
              onSelect={handleSelectAgent}
              onNewConversation={handleNewConversation}
            />
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
              selectedElement={agentId === activeAgentId ? elementPicker.confirmedInfo : undefined}
              onClearElement={elementPicker.clear}
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
          onAgentDeleted={(deletedId) => {
            // Remove from open conversations
            setOpenAgentIds((prev) => {
              const next = new Set(prev);
              next.delete(deletedId);
              return next;
            });
            conversationsRef.current.delete(deletedId);
            setConversationsMeta(new Map(conversationsRef.current));
            clearAgent();
          }}
        />
      )}

      {/* ── Delete Conversation Confirmation Dialog ── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear conversation history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages and uploaded files in this conversation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (activeAgentId) {
                  window.dispatchEvent(
                    new CustomEvent("agent-delete-conversation", { detail: { agentId: activeAgentId } }),
                  );
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Element picker overlay (rendered above app, below widget) */}
      {elementPicker.pickerActive && (
        <ElementPickerOverlay
          hoveredInfo={elementPicker.hoveredInfo}
          selectedInfo={elementPicker.selectedInfo}
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
  selectedElement,
  onClearElement,
}: ConversationPanelProps) {
  const {
    agent,
    session,
    messages,
    streaming,
    streamingText,
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
      />
    </div>
  );
}
