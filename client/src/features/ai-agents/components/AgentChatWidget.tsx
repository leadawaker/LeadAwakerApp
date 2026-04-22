import { useEffect, useState, useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { useAgentWidget } from "@/contexts/AgentWidgetContext";
import { useElementPicker } from "../hooks/useElementPicker";
import { ElementPickerOverlay } from "./ElementPickerOverlay";
import { AgentSettingsSheet } from "./AgentSettingsSheet";
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
import type { AiAgent, AiSession } from "../hooks/useAgentChat";
import { AgentPicker } from "./AgentPicker";
import { ConversationTabs } from "./ConversationTabs";
import type { ConversationMeta } from "./ConversationTabs";
import { ConversationPanelWithEvents } from "./ConversationPanel";
import { AgentChatWidgetHeader } from "./AgentChatWidgetHeader";
import {
  loadWidgetSize,
  saveWidgetSize,
  loadWidgetPos,
  saveWidgetPos,
  clampPos,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_WIDTH,
  MAX_HEIGHT,
  DOCK_MIN_WIDTH,
  DOCK_MAX_WIDTH,
} from "./agentWidgetUtils";
import type { WidgetPos, WidgetSize } from "./agentWidgetUtils";

// ─── Main Widget Component ───────────────────────────────────────────────────

export function AgentChatWidget() {
  const {
    isOpen,
    activeAgentId,
    closeWidget,
    selectAgent,
    clearAgent,
    dockMode,
    dockWidth,
    setDockWidth,
    toggleDockMode,
    isWideViewport,
  } = useAgentWidget();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // ── Element picker ──
  const elementPicker = useElementPicker();

  // ── Resize state ──
  const [widgetSize, setWidgetSize] = useState<WidgetSize>(loadWidgetSize);
  const resizingRef = useRef(false);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number; right: number; bottom: number; corner: string } | null>(null);

  // ── Mobile detection (reactive) ──
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Drag-to-reposition state (desktop only) ──
  const [widgetPos, setWidgetPos] = useState<WidgetPos>(loadWidgetPos);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; right: number; bottom: number } | null>(null);

  const isDocked = dockMode && isWideViewport;

  const dockResizeRef = useRef(false);
  const dockResizeStartRef = useRef<{ x: number; width: number } | null>(null);

  const onDockResizePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dockResizeRef.current = true;
    dockResizeStartRef.current = { x: e.clientX, width: dockWidth };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, [dockWidth]);

  const onDockResizePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dockResizeRef.current || !dockResizeStartRef.current) return;
    const { x, width } = dockResizeStartRef.current;
    const newWidth = Math.max(DOCK_MIN_WIDTH, Math.min(DOCK_MAX_WIDTH, width - (e.clientX - x)));
    setDockWidth(newWidth);
  }, [setDockWidth]);

  const onDockResizePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dockResizeRef.current) return;
    dockResizeRef.current = false;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  }, []);

  const onDragPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (isDocked) return;
    if (window.innerWidth < 768) return;
    // Don't start drag when clicking buttons inside the header
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY, right: widgetPos.right, bottom: widgetPos.bottom };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, [widgetPos, isDocked]);

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

  // Handle message count updates — use ref to access current activeAgentId without re-creating callback
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
      if (isOpen) closeWidget();
    };
    window.history.pushState({ agentWidgetOpen: true }, "");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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
          "fixed z-[9999] flex flex-col bg-[#f5f5f5] dark:bg-[#1a1a2e] overflow-hidden",
          isMobile
            ? cn(
                "inset-0 w-full h-full rounded-none border-0 transition-[opacity,transform] duration-300 ease-out",
                isOpen
                  ? "translate-y-0 opacity-100 pointer-events-auto"
                  : "translate-y-full opacity-0 invisible pointer-events-none",
              )
            : isDocked
              ? cn(
                  "border border-border/60 rounded-3xl transition-[opacity] duration-150",
                  isOpen
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 invisible pointer-events-none",
                )
              : cn(
                  "border border-border/60 shadow-2xl rounded-2xl transition-[opacity,transform] duration-200 ease-out",
                  isOpen
                    ? "opacity-100 scale-100 pointer-events-auto"
                    : "opacity-0 scale-95 invisible pointer-events-none",
                ),
        )}
        style={
          isMobile
            ? undefined
            : isDocked
              ? { position: "fixed", right: 3, top: "calc(var(--topbar-h) + 5px)", bottom: 0, width: dockWidth - 6 }
              : {
                  right: widgetPos.right,
                  bottom: widgetPos.bottom,
                  width: widgetSize.width,
                  height: widgetSize.height,
                }
        }
        data-testid="agent-widget-panel"
      >
        {/* ── Resize handles (desktop only) ── */}
        {!isMobile && !isDocked && (
          <>
            {/* Edges */}
            <div data-corner="tl" className="absolute top-0 left-4 right-4 h-1.5 cursor-n-resize z-10" onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div data-corner="tl" className="absolute top-4 left-0 bottom-4 w-1.5 cursor-w-resize z-10" onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div data-corner="br" className="absolute bottom-0 left-4 right-4 h-1.5 cursor-s-resize z-10" onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div data-corner="tr" className="absolute top-4 right-0 bottom-4 w-1.5 cursor-e-resize z-10" onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            {/* Corners */}
            <div data-corner="tl" className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-20" onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div data-corner="tr" className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-20" onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div data-corner="bl" className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-20" onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
            <div data-corner="br" className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-20" onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} />
          </>
        )}
        {!isMobile && isDocked && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 hover:bg-brand-indigo/20"
            onPointerDown={onDockResizePointerDown}
            onPointerMove={onDockResizePointerMove}
            onPointerUp={onDockResizePointerUp}
          />
        )}

        {/* ── Widget Header ── */}
        <AgentChatWidgetHeader
          isMobile={isMobile}
          activeAgentId={activeAgentId}
          activeAgent={activeAgent}
          activeSession={activeSession}
          activeStreaming={activeStreaming}
          activePageAwareness={activePageAwareness}
          isCodeRunner={isCodeRunner}
          elementPicker={elementPicker}
          closeWidget={closeWidget}
          handleBack={handleBack}
          togglePageAwareness={togglePageAwareness}
          onDragPointerDown={onDragPointerDown}
          onDragPointerMove={onDragPointerMove}
          onDragPointerUp={onDragPointerUp}
          dockMode={isDocked}
          onToggleDock={toggleDockMode}
          onTitleRegenerated={(title) => {
            if (!activeAgentId) return;
            const meta = conversationsRef.current.get(activeAgentId);
            if (meta?.session) {
              meta.session = { ...meta.session, title };
              conversationsRef.current.set(activeAgentId, { ...meta });
              setConversationsMeta(new Map(conversationsRef.current));
            }
          }}
        />

        {/* ── Conversation Tabs (when 2+ open) ── */}
        <ConversationTabs
          conversations={conversationsMeta}
          activeAgentId={activeAgentId ?? 0}
          onSelect={(agentId) => selectAgent(agentId)}
          onClose={closeConversation}
        />

        {/* ── Widget Body ── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {!activeAgentId && (
            <AgentPicker
              onSelect={handleSelectAgent}
              onNewConversation={handleNewConversation}
            />
          )}
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
              selectionLocked={elementPicker.locked}
              onToggleSelectionLock={elementPicker.toggleLock}
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

      {/* Element picker overlay (rendered above app, below widget). Stays visible after confirmation. */}
      {(elementPicker.pickerActive || elementPicker.confirmedInfo) && (
        <ElementPickerOverlay
          hoveredInfo={elementPicker.hoveredInfo}
          selectedInfo={elementPicker.selectedInfo}
          confirmedInfo={elementPicker.confirmedInfo}
        />
      )}
    </>
  );
}
