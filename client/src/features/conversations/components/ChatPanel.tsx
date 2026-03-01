import { useEffect, useRef, useState, useCallback } from "react";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Music,
  Video,
  Download,
  ExternalLink,
  MessageSquare,
  ChevronDown,
  Send,
  Bot,
  PanelRight,
  ArrowUpCircle,
  RotateCcw,
  Paintbrush,
  Wallpaper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { SkeletonChatThread } from "@/components/ui/skeleton";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { Thread, Interaction } from "../hooks/useConversationsData";
import { formatRelativeTime, getStatus, PIPELINE_HEX } from "../utils/conversationHelpers";
import {
  GradientTester,
  GradientControlPoints,
  DEFAULT_LAYERS,
  layerToStyle,
  type GradientLayer,
} from "@/components/ui/gradient-tester";
import { useChatDoodle } from "@/hooks/useChatDoodle";
import { getDoodleStyle, BLEND_MODES, patternIdToNumber, numberToPatternId } from "@/components/ui/doodle-patterns";

interface ChatPanelProps {
  selected: Thread | null;
  loading?: boolean;
  sending: boolean;
  onSend: (leadId: number, content: string, type?: string) => Promise<void>;
  onToggleTakeover?: (leadId: number, manualTakeover: boolean) => Promise<void>;
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  showContactPanel?: boolean;
  onShowContactPanel?: () => void;
  className?: string;
  /** Extra toolbar actions rendered in the header (e.g. +, Search, Settings) */
  headerActions?: React.ReactNode;
}

export function ChatPanel({
  selected,
  loading = false,
  sending,
  onSend,
  onToggleTakeover,
  onRetry,
  showContactPanel,
  onShowContactPanel,
  className,
  headerActions,
}: ChatPanelProps) {
  const isHuman = selected?.lead.manual_takeover === true;
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLeadId = useRef<number | null>(null);
  const prevMsgCount = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Track whether we just switched conversations (for bubble entrance animation)
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const initialLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Takeover flow state
  const [hasConfirmedTakeover, setHasConfirmedTakeover] = useState(false);
  const [showTakeoverConfirm, setShowTakeoverConfirm] = useState(false);
  const [pendingDraft, setPendingDraft] = useState("");

  // AI resume flow state
  const [showAiResumeConfirm, setShowAiResumeConfirm] = useState(false);

  // ── Doodle overlay ─────────────────────────────────────────────────────────
  const { config: doodleConfig, setConfig: setDoodleConfig } = useChatDoodle();

  // ── Gradient tester state (dev tool) ────────────────────────────────────────
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);

  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) {
      setGradientLayers(prev => [...prev, patch as GradientLayer]);
      return;
    }
    if ((patch as any).id === -999) {
      setGradientLayers(prev => prev.filter(l => l.id !== id));
      return;
    }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const resetGradientLayers = useCallback(() => {
    setGradientLayers(DEFAULT_LAYERS);
    setGradientDragMode(false);
  }, []);

  /** Scroll the chat area to the very bottom. */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
  }, []);

  /** When a new conversation is selected, jump immediately to the bottom. */
  useEffect(() => {
    const leadId = selected?.lead.id ?? null;
    if (leadId !== prevLeadId.current) {
      prevLeadId.current = leadId;
      prevMsgCount.current = selected?.msgs.length ?? 0;
      setTimeout(() => scrollToBottom("instant"), 0);
      setShowScrollButton(false);

      // Trigger bubble entrance animation for 800ms after switching
      if (leadId !== null) {
        setIsInitialLoad(true);
        if (initialLoadTimer.current) clearTimeout(initialLoadTimer.current);
        initialLoadTimer.current = setTimeout(() => setIsInitialLoad(false), 800);
      }
    }
  }, [selected?.lead.id, scrollToBottom]);

  /** When new messages arrive, smooth-scroll if near bottom. */
  useEffect(() => {
    const count = selected?.msgs.length ?? 0;
    if (count !== prevMsgCount.current) {
      prevMsgCount.current = count;
      const el = scrollRef.current;
      if (el) {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 200) {
          scrollToBottom("smooth");
        } else {
          setShowScrollButton(true);
        }
      }
    }
  }, [selected?.msgs.length, scrollToBottom]);

  /** Track scroll position to show/hide the scroll-to-bottom button. */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollButton(distanceFromBottom > 80);
  }, []);

  const handleSubmit = async () => {
    if (!selected || !draft.trim() || sending) return;

    // If AI is still active and the user hasn't confirmed takeover this session,
    // intercept and show confirmation first
    if (!isHuman && !hasConfirmedTakeover) {
      setPendingDraft(draft);
      setDraft("");
      setShowTakeoverConfirm(true);
      return;
    }

    const text = draft;
    setDraft("");
    await onSend(selected.lead.id, text);
  };

  const handleTakeoverConfirm = async () => {
    if (!selected) return;
    setHasConfirmedTakeover(true);
    setShowTakeoverConfirm(false);
    if (onToggleTakeover) {
      await onToggleTakeover(selected.lead.id, true);
    }
    await onSend(selected.lead.id, pendingDraft);
    setPendingDraft("");
  };

  const handleTakeoverCancel = () => {
    setDraft(pendingDraft);
    setPendingDraft("");
    setShowTakeoverConfirm(false);
  };

  const handleAiResumeConfirm = async () => {
    if (!selected || !onToggleTakeover) return;
    setShowAiResumeConfirm(false);
    await onToggleTakeover(selected.lead.id, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      <section
        className={cn(
          "flex flex-col rounded-lg overflow-hidden h-full relative",
          className,
        )}
        data-testid="panel-chat"
      >
        {/* ── Gradient background ── */}
        {gradientTesterOpen ? (
          <>
            {gradientLayers.map(layer => {
              const style = layerToStyle(layer);
              if (!style) return null;
              return <div key={layer.id} className="absolute inset-0" style={style} />;
            })}
            {gradientDragMode && (
              <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
            )}
            {doodleConfig.enabled && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={getDoodleStyle(doodleConfig.patternId, doodleConfig.color, doodleConfig.size, doodleConfig.strokeColor, doodleConfig.blendMode)}
              />
            )}
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[#ffffff]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_199%_160%_at_100%_100%,rgba(255,249,82,0.4)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_112%_103%_at_9%_0%,#d3ffe4_0%,transparent_60%)]" />
            {doodleConfig.enabled && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={getDoodleStyle(doodleConfig.patternId, doodleConfig.color, doodleConfig.size, doodleConfig.strokeColor, doodleConfig.blendMode)}
              />
            )}
          </>
        )}

        {/* ── Content above gradient ── */}
        <div className="relative flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-border/20 shrink-0" data-testid="panel-chat-head">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              {loading && !selected ? (
                <div className="space-y-1.5">
                  <div className="h-4 w-40 rounded bg-foreground/10 animate-pulse" />
                  <div className="h-3 w-56 rounded bg-foreground/8 animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="text-xl font-semibold font-heading truncate">
                    {selected
                      ? selected.lead.full_name ||
                        `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()
                      : "Select a conversation"}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {selected ? `${selected.lead.phone ?? ""} • ${selected.lead.email ?? ""}` : ""}
                    </span>
                    {selected && (() => {
                      const status = getStatus(selected.lead);
                      const hex = PIPELINE_HEX[status] ?? "#6B7280";
                      return status ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ backgroundColor: `${hex}20`, color: hex }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />
                          {status}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {headerActions}
              {/* "Let AI continue" — only shown when human has taken over */}
              {selected && isHuman && onToggleTakeover && (
                <button
                  type="button"
                  data-testid="btn-ai-resume"
                  onClick={() => setShowAiResumeConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-medium border border-amber-500/30 bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400 transition-colors"
                  title="Hand back to AI"
                >
                  <Bot className="h-4 w-4" />
                  Let AI continue
                </button>
              )}

              {/* View button — reopens contact panel when closed */}
              {!showContactPanel && onShowContactPanel && (
                <button
                  type="button"
                  onClick={onShowContactPanel}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
                  data-testid="btn-show-contact-panel"
                  title="Show lead context panel"
                >
                  <PanelRight className="h-4 w-4" />
                  View
                </button>
              )}
              {/* Doodle overlay popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border transition-colors ${doodleConfig.enabled ? "bg-indigo-100 text-indigo-600 border-indigo-200" : "border-black/[0.125] bg-transparent text-foreground hover:bg-muted/50"}`}
                    title="Chat background doodle"
                  >
                    <Wallpaper className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">Doodle Overlay</span>
                    <Switch
                      checked={doodleConfig.enabled}
                      onCheckedChange={(enabled) => setDoodleConfig({ enabled })}
                    />
                  </div>
                  {doodleConfig.enabled && (
                    <>
                      {/* Pattern picker — slider 1–42 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Pattern</span>
                          <span className="text-[11px] font-semibold tabular-nums text-foreground/70">
                            #{patternIdToNumber(doodleConfig.patternId)}
                          </span>
                        </div>
                        <Slider
                          value={[patternIdToNumber(doodleConfig.patternId)]}
                          onValueChange={([v]) => setDoodleConfig({ patternId: numberToPatternId(v) })}
                          min={1}
                          max={42}
                          step={1}
                        />
                      </div>
                      {/* Stroke color slider (0=black → 100=white) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Color</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {doodleConfig.strokeColor === 0 ? "Black" : doodleConfig.strokeColor === 100 ? "White" : `${doodleConfig.strokeColor}%`}
                          </span>
                        </div>
                        <Slider
                          value={[doodleConfig.strokeColor ?? 0]}
                          onValueChange={([v]) => setDoodleConfig({ strokeColor: v })}
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                      {/* Opacity slider (0–100 → 0–80% opacity) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Opacity</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{doodleConfig.color}%</span>
                        </div>
                        <Slider
                          value={[doodleConfig.color]}
                          onValueChange={([v]) => setDoodleConfig({ color: v })}
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                      {/* Size slider */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Size</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{doodleConfig.size}px</span>
                        </div>
                        <Slider
                          value={[doodleConfig.size]}
                          onValueChange={([v]) => setDoodleConfig({ size: v })}
                          min={200}
                          max={800}
                          step={25}
                        />
                      </div>
                      {/* Blend mode selector */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] text-muted-foreground">Blend mode</span>
                        <select
                          value={doodleConfig.blendMode ?? "overlay"}
                          onChange={(e) => setDoodleConfig({ blendMode: e.target.value })}
                          className="w-full h-8 px-2 rounded-md border border-black/[0.125] bg-card text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-brand-indigo/40"
                        >
                          {BLEND_MODES.map((m) => (
                            <option key={m} value={m}>
                              {m.charAt(0).toUpperCase() + m.slice(1).replace(/-/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={() => setGradientTesterOpen(prev => !prev)}
                className={`inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border transition-colors ${gradientTesterOpen ? "bg-indigo-100 text-indigo-600 border-indigo-200" : "border-black/[0.125] bg-transparent text-foreground hover:bg-muted/50"}`}
                title="Gradient Tester"
              >
                <Paintbrush className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scroll container wrapper */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className="h-full overflow-y-auto p-4 space-y-3"
            ref={scrollRef}
            onScroll={handleScroll}
            data-testid="chat-scroll"
          >
            {loading && !selected ? (
              <SkeletonChatThread data-testid="skeleton-chat-thread" />
            ) : !selected ? (
              <div className="flex items-center justify-center h-full">
                <DataEmptyState
                  variant="conversations"
                  title="Your conversations, one click away"
                  description="Select a lead from the inbox to view their full message history with the AI."
                  compact
                />
              </div>
            ) : selected.msgs.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <DataEmptyState
                  variant="conversations"
                  title="No messages yet"
                  description="Start the conversation by sending a message below."
                  compact
                />
              </div>
            ) : (() => {
              const threadGroups = groupMessagesByThread(selected.msgs);
              let globalMsgIdx = 0;
              return threadGroups.map((group, gi) => (
                <div key={group.threadId} data-testid={`thread-group-${gi}`}>
                  <ThreadDivider group={group} total={threadGroups.length} />
                  {group.msgs.map((m) => {
                    const msgIdx = globalMsgIdx++;
                    return (
                      <ChatBubble
                        key={m.id}
                        item={m}
                        onRetry={onRetry}
                        leadName={selected.lead.full_name || `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()}
                        animateEntrance={isInitialLoad}
                        entranceDelay={msgIdx}
                      />
                    );
                  })}
                </div>
              ));
            })()}
          </div>

          {/* Scroll-to-bottom floating button — standard 34px circle */}
          {showScrollButton && (
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-3 right-3 z-10 h-10 w-10 rounded-full border border-black/[0.125] bg-card flex items-center justify-center text-foreground shadow-sm hover:bg-muted active:scale-[0.92] transition-[background-color,transform] duration-150"
              data-testid="button-scroll-to-bottom"
              title="Scroll to latest message"
              aria-label="Scroll to latest message"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Compose area — send button embedded, matching leads ConversationWidget */}
        <div className="p-3 flex items-end gap-2 shrink-0" data-testid="chat-compose">
          <textarea
            className="flex-1 text-[12px] bg-muted rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-indigo/30 placeholder:text-muted-foreground/50"
            style={{ minHeight: "36px", maxHeight: "80px" }}
            placeholder={!selected ? "Select a contact first" : isHuman ? "Taking over from AI \u2014 Enter to send" : "Type a message\u2026 (Enter to send)"}
            disabled={!selected || sending}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 80) + "px";
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            data-testid="input-compose"
          />
          <button
            type="button"
            className="h-10 w-10 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0"
            disabled={!selected || !draft.trim() || sending}
            onClick={handleSubmit}
            data-testid="button-compose-send"
            title="Send message"
          >
            {sending ? (
              <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4 text-white" />
            )}
          </button>
        </div>
        </div>

        {/* ── Gradient Tester (dev tool) ── */}
        <GradientTester
          open={gradientTesterOpen}
          onClose={() => setGradientTesterOpen(false)}
          layers={gradientLayers}
          onUpdateLayer={updateGradientLayer}
          onResetLayers={resetGradientLayers}
          dragMode={gradientDragMode}
          onToggleDragMode={() => setGradientDragMode(prev => !prev)}
        />
      </section>

      {/* Human takeover confirmation dialog */}
      <AlertDialog open={showTakeoverConfirm} onOpenChange={(open) => { if (!open) handleTakeoverCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take over this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              Sending this message will switch the conversation to human mode. The AI will stop responding and you'll be in control. You won't be asked again this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleTakeoverCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTakeoverConfirm}>
              Take over &amp; Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Let AI continue confirmation dialog */}
      <AlertDialog open={showAiResumeConfirm} onOpenChange={setShowAiResumeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hand back to AI?</AlertDialogTitle>
            <AlertDialogDescription>
              AI will resume managing this conversation from this point forward. You can always take over again by sending a message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAiResumeConfirm}>
              Let AI continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Delivery status icon for outbound messages. */
interface MessageStatusIconProps {
  status: string;
  isSending: boolean;
  isSent: boolean;
  isDelivered: boolean;
  isRead: boolean;
  isFailed: boolean;
}

function MessageStatusIcon({ isSending, isSent, isDelivered, isRead, isFailed }: MessageStatusIconProps) {
  if (isSending) {
    return (
      <span className="inline-flex items-center gap-0.5 ml-1" data-testid="status-sending" title="Sending…">
        <Clock className="w-4 h-4 animate-pulse opacity-70" />
        <span className="text-[10px] italic opacity-70">sending…</span>
      </span>
    );
  }
  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-0.5 ml-1 text-destructive" data-testid="status-failed" title="Message failed to send">
        <AlertCircle className="w-4 h-4" />
        <span className="text-[10px] font-semibold">failed</span>
      </span>
    );
  }
  if (isRead) {
    return (
      <span className="inline-flex items-center ml-1 text-sky-300" data-testid="status-read" title="Read">
        <CheckCheck className="w-4 h-4" />
      </span>
    );
  }
  if (isDelivered) {
    return (
      <span className="inline-flex items-center ml-1 opacity-80" data-testid="status-delivered" title="Delivered">
        <CheckCheck className="w-4 h-4" />
      </span>
    );
  }
  if (isSent) {
    return (
      <span className="inline-flex items-center ml-1 opacity-60" data-testid="status-sent" title="Sent">
        <Check className="w-4 h-4" />
      </span>
    );
  }
  return null;
}

/** Returns true if this interaction was generated/sent by the AI/automation system */
function isAiMessage(item: Interaction): boolean {
  if (item.ai_generated === true) return true;
  if (item.is_bump === true) return true;
  if ((item.triggered_by ?? item.triggeredBy) === "Automation") return true;
  const who = (item.Who ?? item.who ?? "").toLowerCase();
  if (who === "ai" || who === "bot" || who === "automation") return true;
  if (/^bump\s*\d/.test(who)) return true;
  if (who === "start") return true;
  return false;
}

/** Returns true if this interaction was sent manually by a human agent */
function isHumanAgentMessage(item: Interaction): boolean {
  if (item.direction !== "Outbound") return false;
  if (isAiMessage(item)) return false;
  return true;
}

// ─── Thread Grouping ──────────────────────────────────────────────────────────

interface ThreadGroup {
  threadId: string;
  threadIndex: number;
  msgs: Interaction[];
}

const THREAD_GAP_MS = 2 * 60 * 60 * 1000;

function groupMessagesByThread(msgs: Interaction[]): ThreadGroup[] {
  if (msgs.length === 0) return [];

  const groups: ThreadGroup[] = [];
  let currentGroup: ThreadGroup | null = null;
  let groupIndex = 0;

  function getThreadKey(m: Interaction): string | null {
    const tid = m.conversation_thread_id ?? m.conversationThreadId;
    if (tid) return `thread-${tid}`;
    if (m.bump_number != null) return `bump-${m.bump_number}`;
    if (m.is_bump && m.Who) return `bump-who-${m.Who.toLowerCase().replace(/\s+/g, "-")}`;
    return null;
  }

  let lastTimestamp: number | null = null;

  for (const m of msgs) {
    const key = getThreadKey(m);
    const ts = m.created_at || m.createdAt;
    const currentTimestamp = ts ? new Date(ts).getTime() : null;

    let startNew = false;

    if (!currentGroup) {
      startNew = true;
    } else if (key !== null) {
      if (key !== currentGroup.threadId) startNew = true;
    } else {
      if (
        currentTimestamp !== null &&
        lastTimestamp !== null &&
        currentTimestamp - lastTimestamp > THREAD_GAP_MS
      ) {
        startNew = true;
      }
    }

    if (startNew) {
      const tid: string = key ?? `session-${groupIndex}`;
      currentGroup = { threadId: tid, threadIndex: groupIndex++, msgs: [] };
      groups.push(currentGroup);
    }

    currentGroup!.msgs.push(m);
    if (currentTimestamp !== null) lastTimestamp = currentTimestamp;
  }

  return groups;
}

function formatThreadLabel(group: ThreadGroup, total: number): string {
  const { threadId, threadIndex } = group;
  if (threadId.startsWith("bump-who-")) {
    const who = threadId.replace("bump-who-", "").replace(/-/g, " ");
    return who.charAt(0).toUpperCase() + who.slice(1);
  }
  if (threadId.startsWith("bump-")) {
    const n = threadId.replace("bump-", "");
    return `Bump ${n}`;
  }
  if (threadId.startsWith("thread-")) {
    const id = threadId.replace("thread-", "");
    return id.length > 12 ? `Thread ${threadIndex + 1}` : `Thread ${id}`;
  }
  if (total === 1) return "Conversation";
  return `Conversation ${threadIndex + 1}`;
}

function ThreadDivider({ group, total }: { group: ThreadGroup; total: number }) {
  const label = formatThreadLabel(group, total);
  const firstMsg = group.msgs[0];
  const ts = firstMsg?.created_at || firstMsg?.createdAt;
  const dateStr = ts
    ? new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const relativeStr = ts ? formatRelativeTime(ts) : null;
  const isBump = group.threadId.startsWith("bump-");

  // Who initiated this thread?
  const initiator = firstMsg
    ? firstMsg.direction === "Inbound"
      ? "Lead replied"
      : isAiMessage(firstMsg)
        ? "AI started"
        : "You replied"
    : null;

  return (
    <div
      className="flex items-center gap-3 my-5"
      data-testid={`thread-divider-${group.threadIndex}`}
      data-thread-id={group.threadId}
    >
      <div className="flex-1 h-px bg-border/40" />
      <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl bg-white border border-border/20">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80 select-none whitespace-nowrap">
          {isBump
            ? <ArrowUpCircle className="w-3 h-3 shrink-0 text-amber-500" />
            : <MessageSquare className="w-3 h-3 shrink-0 opacity-60" />
          }
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground select-none">
          {initiator && <span>{initiator}</span>}
          {initiator && dateStr && <span>·</span>}
          {dateStr && <span>{dateStr}</span>}
          {relativeStr && <span className="opacity-60">({relativeStr})</span>}
        </div>
      </div>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

function getAttachmentType(url: string): "image" | "video" | "audio" | "document" {
  const lower = url.toLowerCase().split("?")[0];
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/.test(lower)) return "image";
  if (/\.(mp4|mov|avi|webm|mkv|ogg)$/.test(lower)) return "video";
  if (/\.(mp3|ogg|wav|m4a|aac|opus|flac)$/.test(lower)) return "audio";
  return "document";
}

function AttachmentPreview({ url, outbound }: { url: string; outbound: boolean }) {
  const [imgError, setImgError] = useState(false);
  const type = getAttachmentType(url);
  const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "attachment");

  const linkClasses = cn(
    "inline-flex items-center gap-1.5 mt-1 text-xs underline underline-offset-2 opacity-90 hover:opacity-100 break-all",
    outbound ? "text-white/90" : "text-primary",
  );

  if (type === "image" && !imgError) {
    return (
      <div className="mt-2" data-testid="attachment-image">
        <img
          src={url}
          alt="Attachment"
          className="max-w-full max-h-60 rounded-lg object-cover border border-white/20 cursor-pointer"
          onError={() => setImgError(true)}
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          title="Click to open full size"
        />
        <a href={url} target="_blank" rel="noopener noreferrer" className={linkClasses} data-testid="attachment-link">
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[200px]">{filename}</span>
        </a>
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="mt-2" data-testid="attachment-video">
        <video src={url} controls className="max-w-full max-h-48 rounded-lg border border-white/20" preload="metadata" />
        <a href={url} target="_blank" rel="noopener noreferrer" className={linkClasses} data-testid="attachment-link">
          <Video className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[200px]">{filename}</span>
        </a>
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="mt-2" data-testid="attachment-audio">
        <audio src={url} controls className="w-full max-w-xs rounded-lg" preload="metadata" />
        <a href={url} target="_blank" rel="noopener noreferrer" className={linkClasses} data-testid="attachment-link">
          <Music className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[200px]">{filename}</span>
        </a>
      </div>
    );
  }

  return (
    <div className="mt-2" data-testid="attachment-document">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium",
          outbound
            ? "bg-white/15 border-white/30 text-white hover:bg-white/25"
            : "bg-muted border-border text-foreground hover:bg-muted/70",
        )}
        data-testid="attachment-link"
        download
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[200px]">{filename}</span>
        <Download className="w-3 h-3 shrink-0 opacity-70" />
      </a>
    </div>
  );
}

/** Derive a readable sender label for the message */
function getSenderLabel(item: Interaction, inbound: boolean, aiMsg: boolean, leadName: string): string {
  if (inbound) return leadName || "Lead";
  if (aiMsg) {
    // Try to get an agent name from the Who field (e.g. "Sophie", "Maria")
    const who = (item.Who ?? item.who ?? "").trim();
    const genericWho = /^(ai|bot|automation|start|bump\s*\d*)$/i;
    if (who && !genericWho.test(who)) return `AI ${who}`;
    // Fall back to ai_model field
    if (item.ai_model) return `AI ${item.ai_model}`;
    return "AI";
  }
  // Human agent — use Who field if it's a name, otherwise "You"
  const who = (item.Who ?? item.who ?? "").trim();
  if (who && who.toLowerCase() !== "human" && who.toLowerCase() !== "agent") return who;
  return "You";
}

function ChatBubble({ item, onRetry, leadName, animateEntrance = false, entranceDelay = 0 }: { item: Interaction; onRetry?: (failedMsg: Interaction) => Promise<void>; leadName: string; animateEntrance?: boolean; entranceDelay?: number }) {
  const outbound = item.direction === "Outbound";
  const inbound = !outbound;
  const statusNorm = (item.status ?? "").toLowerCase();
  const isFailed = statusNorm === "failed";
  const isSending = statusNorm === "sending";
  const isSent = statusNorm === "sent";
  const isDelivered = statusNorm === "delivered";
  const isRead = statusNorm === "read";
  const aiMsg = outbound && isAiMessage(item);
  const humanAgentMsg = outbound && isHumanAgentMessage(item);

  return (
    <div
      className={cn(
        "flex flex-col",
        outbound ? "items-end" : "items-start",
        animateEntrance && (outbound ? "animate-bubble-right" : "animate-bubble-left")
      )}
      style={animateEntrance ? { animationDelay: `${Math.min(entranceDelay, 20) * 25}ms` } : undefined}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm border",
          // Inbound (lead message) — clean white, no visible border
          inbound && "bg-white text-foreground border-transparent dark:bg-muted/80 dark:text-foreground dark:border-transparent",
          // AI-generated outbound — brand blue
          aiMsg && "bg-primary text-white border-primary/20",
          // Human outbound — light blue with dark text (distinguishes from AI)
          humanAgentMsg && "bg-sky-100 text-foreground border-sky-200/50",
          isFailed && "border-destructive/50 opacity-80",
        )}
        data-message-type={inbound ? "lead" : aiMsg ? "ai" : "agent"}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{item.content ?? item.Content}</div>
        {(item.attachment ?? item.Attachment) && (
          <AttachmentPreview
            url={(item.attachment ?? item.Attachment) as string}
            outbound={outbound}
          />
        )}
        <div
          className={cn(
            "mt-1 text-[11px] flex items-center gap-1 flex-wrap",
            outbound ? "opacity-70" : "text-muted-foreground opacity-70 dark:opacity-90",
            // Adjust timestamp color for human messages on light bg
            humanAgentMsg && "text-foreground/50",
          )}
        >
          {item.created_at || item.createdAt
            ? new Date(item.created_at ?? item.createdAt).toLocaleString()
            : ""}{" "}
          {"\u2022"} {item.type}
          {outbound && (
            <MessageStatusIcon
              status={statusNorm}
              isSending={isSending}
              isSent={isSent}
              isDelivered={isDelivered}
              isRead={isRead}
              isFailed={isFailed}
            />
          )}
          {isFailed && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(item)}
              className="inline-flex items-center gap-0.5 ml-1 text-[10px] font-semibold text-destructive hover:text-destructive/80 underline underline-offset-2 cursor-pointer"
              data-testid="button-retry-message"
              title="Retry sending this message"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      </div>
      {/* Sender label below bubble */}
      <div className={cn(
        "mt-0.5 text-[9px] font-medium select-none",
        outbound ? "text-right" : "text-left",
        "text-muted-foreground/50"
      )}>
        {getSenderLabel(item, inbound, aiMsg, leadName)}
      </div>
    </div>
  );
}
