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
import type { Thread, Interaction } from "../hooks/useConversationsData";
import { formatRelativeTime } from "../utils/conversationHelpers";

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
}: ChatPanelProps) {
  const isHuman = selected?.lead.manual_takeover === true;
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLeadId = useRef<number | null>(null);
  const prevMsgCount = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Takeover flow state
  const [hasConfirmedTakeover, setHasConfirmedTakeover] = useState(false);
  const [showTakeoverConfirm, setShowTakeoverConfirm] = useState(false);
  const [pendingDraft, setPendingDraft] = useState("");

  // AI resume flow state
  const [showAiResumeConfirm, setShowAiResumeConfirm] = useState(false);

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
        <div className="absolute inset-0 bg-[#F5F1EA]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_10%_5%,rgba(255,242,134,0.35)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_20%,rgba(255,255,255,0.5)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_90%_95%,rgba(79,70,229,0.30)_0%,rgba(105,170,255,0.15)_35%,transparent_65%)]" />

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
                  <div className="text-[15px] font-semibold font-heading truncate">
                    {selected
                      ? selected.lead.full_name ||
                        `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()
                      : "Select a conversation"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {selected ? `${selected.lead.phone ?? ""} • ${selected.lead.email ?? ""}` : ""}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-medium border border-border/30 bg-transparent text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
                  data-testid="btn-show-contact-panel"
                  title="Show lead context panel"
                >
                  <PanelRight className="h-4 w-4" />
                  View
                </button>
              )}
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
              return threadGroups.map((group, gi) => (
                <div key={group.threadId} data-testid={`thread-group-${gi}`}>
                  <ThreadDivider group={group} total={threadGroups.length} />
                  {group.msgs.map((m) => (
                    <ChatBubble key={m.id} item={m} onRetry={onRetry} />
                  ))}
                </div>
              ));
            })()}
          </div>

          {/* Scroll-to-bottom floating button — standard 34px circle */}
          {showScrollButton && (
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="absolute bottom-3 right-3 z-10 h-10 w-10 rounded-full border border-border/65 bg-card flex items-center justify-center text-foreground shadow-sm hover:bg-muted active:scale-[0.92] transition-all duration-150"
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
            className="flex-1 text-[12px] bg-muted rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/30 placeholder:text-muted-foreground/50"
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
            className="h-10 w-10 rounded-lg bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 disabled:opacity-40 shrink-0"
            disabled={!selected || !draft.trim() || sending}
            onClick={handleSubmit}
            data-testid="button-compose-send"
            title="Send message"
          >
            {sending ? (
              <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 text-white" />
            )}
          </button>
        </div>
        </div>
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
        <Clock className="w-3 h-3 animate-pulse opacity-70" />
        <span className="text-[10px] italic opacity-70">sending…</span>
      </span>
    );
  }
  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-0.5 ml-1 text-destructive" data-testid="status-failed" title="Message failed to send">
        <AlertCircle className="w-3 h-3" />
        <span className="text-[10px] font-semibold">failed</span>
      </span>
    );
  }
  if (isRead) {
    return (
      <span className="inline-flex items-center ml-1 text-sky-300" data-testid="status-read" title="Read">
        <CheckCheck className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (isDelivered) {
    return (
      <span className="inline-flex items-center ml-1 opacity-80" data-testid="status-delivered" title="Delivered">
        <CheckCheck className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (isSent) {
    return (
      <span className="inline-flex items-center ml-1 opacity-60" data-testid="status-sent" title="Sent">
        <Check className="w-3 h-3" />
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
      <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl bg-muted/80 border border-border/30">
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

function ChatBubble({ item, onRetry }: { item: Interaction; onRetry?: (failedMsg: Interaction) => Promise<void> }) {
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
    <div className={cn("flex flex-col", outbound ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm border",
          // Inbound (lead message) — clean white
          inbound && "bg-white text-foreground border-border dark:bg-muted/80 dark:text-foreground dark:border-border",
          // AI-generated outbound — brand blue
          aiMsg && "bg-primary text-white border-primary/20",
          // Human outbound — dark navy blue with white text
          humanAgentMsg && "bg-[#166534] text-white border-[#166534]/60",
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
            // Adjust timestamp color for navy bubble
            humanAgentMsg && "text-white/60",
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
        {inbound ? "Lead" : aiMsg ? (item.ai_model ? `AI (${item.ai_model})` : "AI") : "You"}
      </div>
    </div>
  );
}
