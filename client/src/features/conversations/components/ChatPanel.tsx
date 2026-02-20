import { useEffect, useRef, useState } from "react";
import { Bot, User, UserCheck, Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import type { Thread, Interaction } from "../hooks/useConversationsData";

interface ChatPanelProps {
  selected: Thread | null;
  sending: boolean;
  onSend: (leadId: number, content: string, type?: string) => Promise<void>;
  onToggleTakeover?: (leadId: number, manualTakeover: boolean) => Promise<void>;
  className?: string;
}

export function ChatPanel({ selected, sending, onSend, onToggleTakeover, className }: ChatPanelProps) {
  const isHuman = selected?.lead.manual_takeover === true;
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    const count = selected?.msgs.length ?? 0;
    if (count !== prevMsgCount.current) {
      prevMsgCount.current = count;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [selected?.msgs.length]);

  const handleSubmit = async () => {
    if (!selected || !draft.trim() || sending) return;
    const text = draft;
    setDraft("");
    await onSend(selected.lead.id, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-full transition-all duration-250 ease-out",
        className,
      )}
      data-testid="panel-chat"
    >
      <div className="px-4 py-3 border-b border-border shrink-0" data-testid="panel-chat-head">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {selected
                ? selected.lead.full_name ||
                  `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()
                : "Select a conversation"}
            </div>
            <div className="text-xs text-muted-foreground">
              {selected ? `${selected.lead.phone ?? ""} • ${selected.lead.email ?? ""}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* AI / Human takeover toggle */}
            {selected && onToggleTakeover && (
              <button
                type="button"
                data-testid="takeover-toggle"
                onClick={() => onToggleTakeover(selected.lead.id, !isHuman)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                  isHuman
                    ? "bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/25 dark:text-amber-400"
                    : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/25 dark:text-emerald-400",
                )}
                title={isHuman ? "Switch back to AI mode" : "Take over from AI"}
              >
                {isHuman ? (
                  <>
                    <User className="h-3.5 w-3.5" />
                    <span data-testid="takeover-state-label">Human Active</span>
                  </>
                ) : (
                  <>
                    <Bot className="h-3.5 w-3.5" />
                    <span data-testid="takeover-state-label">AI Active</span>
                  </>
                )}
              </button>
            )}

            {selected && (
              <a
                href={`/app/contacts/${selected.lead.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, "", `/app/contacts/${selected.lead.id}`);
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Open contact
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef} data-testid="chat-scroll">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <DataEmptyState
              variant="conversations"
              title="Select a conversation"
              description="Pick a contact on the left to view their messages."
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
        ) : (
          selected.msgs.map((m) => <ChatBubble key={m.id} item={m} />)
        )}
      </div>

      <div className="p-4 border-t border-border shrink-0" data-testid="chat-compose">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Manual send (takeover)</label>
            <textarea
              className="mt-1 w-full min-h-[44px] max-h-40 rounded-xl bg-muted/30 border border-border p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder={selected ? "Type a message… (Enter to send, Shift+Enter for newline)" : "Select a contact first"}
              disabled={!selected || sending}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="input-compose"
            />
          </div>
          <button
            type="button"
            className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50"
            disabled={!selected || !draft.trim() || sending}
            onClick={handleSubmit}
            data-testid="button-compose-send"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </section>
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
      <span
        className="inline-flex items-center gap-0.5 ml-1"
        data-testid="status-sending"
        title="Sending…"
      >
        <Clock className="w-3 h-3 animate-pulse opacity-70" />
        <span className="text-[10px] italic opacity-70">sending…</span>
      </span>
    );
  }
  if (isFailed) {
    return (
      <span
        className="inline-flex items-center gap-0.5 ml-1 text-destructive"
        data-testid="status-failed"
        title="Message failed to send"
      >
        <AlertCircle className="w-3 h-3" />
        <span className="text-[10px] font-semibold">failed</span>
      </span>
    );
  }
  if (isRead) {
    return (
      <span
        className="inline-flex items-center ml-1 text-sky-300"
        data-testid="status-read"
        title="Read"
      >
        <CheckCheck className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (isDelivered) {
    return (
      <span
        className="inline-flex items-center ml-1 opacity-80"
        data-testid="status-delivered"
        title="Delivered"
      >
        <CheckCheck className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (isSent) {
    return (
      <span
        className="inline-flex items-center ml-1 opacity-60"
        data-testid="status-sent"
        title="Sent"
      >
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

/** Returns true if this interaction is flagged as a manual follow-up by human */
function isManualFollowUp(item: Interaction): boolean {
  return (
    item.is_manual_follow_up === true ||
    item.isManualFollowUp === true
  );
}

function ChatBubble({ item }: { item: Interaction }) {
  const outbound = item.direction === "Outbound";
  const inbound = !outbound;
  // Normalise status to lowercase so we handle "Sent", "sent", "SENT" equally
  const statusNorm = (item.status ?? "").toLowerCase();
  const isFailed = statusNorm === "failed";
  const isSending = statusNorm === "sending";
  const isSent = statusNorm === "sent";
  const isDelivered = statusNorm === "delivered";
  const isRead = statusNorm === "read";
  const aiMsg = outbound && isAiMessage(item);
  const humanAgentMsg = outbound && isHumanAgentMessage(item);
  const manualFollowUp = isManualFollowUp(item);

  return (
    <div className={cn("flex flex-col", outbound ? "items-end" : "items-start")}>
      {/* Sender label above bubble */}
      {aiMsg && (
        <div
          className="flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-semibold border border-violet-200 dark:border-violet-700/50 select-none"
          data-testid="ai-badge"
          title="AI-generated message"
        >
          <Bot className="w-3 h-3 shrink-0" />
          <span>AI</span>
          {item.Who && item.Who !== "AI" && (
            <span className="opacity-70">· {item.Who}</span>
          )}
        </div>
      )}
      {humanAgentMsg && (
        <div
          className="flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold border border-primary/20 select-none"
          data-testid="agent-badge"
          title="Human agent message"
        >
          <User className="w-3 h-3 shrink-0" />
          <span>Agent</span>
          {manualFollowUp && (
            <span
              className="flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-400/30 text-[9px] font-bold"
              data-testid="manual-follow-up-badge"
              title="Manual follow-up message"
            >
              <UserCheck className="w-2.5 h-2.5 shrink-0" />
              Manual
            </span>
          )}
        </div>
      )}
      {inbound && (
        <div
          className="flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold border border-border select-none"
          data-testid="lead-badge"
          title="Message from lead"
        >
          <User className="w-3 h-3 shrink-0" />
          <span>Lead</span>
        </div>
      )}

      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm border",
          // Inbound (lead message) — muted/neutral left-aligned bubble
          inbound && "bg-muted/40 text-foreground border-border",
          // AI-generated outbound — violet bubble with dashed border
          aiMsg &&
            "bg-violet-600/90 dark:bg-violet-700/80 text-white border-dashed border-violet-400/60 dark:border-violet-500/50",
          // Human agent outbound — primary/brand color solid bubble
          humanAgentMsg && !manualFollowUp && "bg-primary text-primary-foreground border-primary/20",
          // Manual follow-up by human agent — amber/warm tint to distinguish
          humanAgentMsg && manualFollowUp && "bg-amber-500 text-white border-amber-400/40",
          isFailed && "border-destructive/50 opacity-80",
        )}
        data-message-type={
          inbound ? "lead" : aiMsg ? "ai" : manualFollowUp ? "manual-follow-up" : "agent"
        }
      >
        <div className="whitespace-pre-wrap leading-relaxed">{item.content ?? item.Content}</div>
        <div
          className={cn(
            "mt-1 text-[11px] opacity-70 flex items-center gap-1 flex-wrap",
            outbound ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {item.created_at || item.createdAt
            ? new Date(item.created_at ?? item.createdAt).toLocaleString()
            : ""}{" "}
          • {item.type}
          {/* Message delivery status icons — outbound messages only */}
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
        </div>
      </div>
    </div>
  );
}
