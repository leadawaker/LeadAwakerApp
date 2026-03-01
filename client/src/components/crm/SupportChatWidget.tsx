import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Send, Headphones, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSupportChat, type SupportChatMessage, type SupportBotConfig } from "@/hooks/useSupportChat";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// ─── Typing indicator ────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-end gap-1.5">
      <div className="h-5 w-5 shrink-0" />
      <div className="relative">
        <div className="flex items-center gap-1 px-3.5 py-2.5 bg-white rounded-lg rounded-tl-none w-fit">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
              style={{
                animation: "supportDotBounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
          <style>{`
            @keyframes supportDotBounce {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
              30% { transform: translateY(-4px); opacity: 1; }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}

// ─── Bot mini avatar for assistant messages ──────────────────────────────
function BotAvatar({ config }: { config: SupportBotConfig }) {
  return (
    <Avatar className="h-5 w-5 shrink-0 mt-0.5">
      {config.photoUrl ? (
        <AvatarImage src={config.photoUrl} alt={config.name} />
      ) : null}
      <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo text-[8px] font-bold">
        {config.name.charAt(0)}
      </AvatarFallback>
    </Avatar>
  );
}

// ─── Time/date helpers ───────────────────────────────────────────────────
function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDateKey(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toDateString();
}

function formatDateLabel(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = today.getTime() - msgDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return null; // today — no label
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}

// ─── Date separator pill ─────────────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-1.5">
      <span className="text-[10px] font-medium text-white bg-black/70 rounded-full px-3 py-0.5">
        {label}
      </span>
    </div>
  );
}

// ─── Single message bubble ───────────────────────────────────────────────
function ChatBubble({
  msg,
  botConfig,
  isFirstInGroup,
}: {
  msg: SupportChatMessage;
  botConfig: SupportBotConfig;
  isFirstInGroup: boolean;
}) {
  const isUser = msg.role === "user";
  const time = formatTime(msg.createdAt);

  const bubbleRadius = isUser
    ? isFirstInGroup ? "rounded-lg rounded-tr-none" : "rounded-lg"
    : isFirstInGroup ? "rounded-lg rounded-tl-none" : "rounded-lg";

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div className={cn("flex gap-1.5", isUser ? "justify-end" : "justify-start")}>
        {!isUser && isFirstInGroup && <BotAvatar config={botConfig} />}
        {!isUser && !isFirstInGroup && <div className="w-5 shrink-0" />}
        <div
          className={cn(
            "max-w-[80%] px-3 pt-2 pb-1 text-[13px] leading-relaxed whitespace-pre-wrap",
            bubbleRadius,
            isUser
              ? "bg-brand-indigo text-white"
              : "bg-white text-foreground",
          )}
        >
          <span>{msg.content}</span>
          {time && (
            <span
              className={cn(
                "float-right text-[9px] ml-2 mt-2 leading-none select-none",
                isUser ? "text-white/50" : "text-muted-foreground/50",
              )}
            >
              {time}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main widget ─────────────────────────────────────────────────────────
export function SupportChatWidget({ onClose }: { onClose: () => void }) {
  const {
    messages,
    sending,
    loading,
    escalated,
    botConfig,
    initialize,
    sendMessage,
    closeSession,
  } = useSupportChat();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    closeSession();
    onClose();
  };

  const hasMessages = messages.length > 0;

  // Pre-compute which messages need a date separator before them
  const renderItems: Array<
    | { type: "date"; label: string; key: string }
    | { type: "msg"; msg: SupportChatMessage; isFirstInGroup: boolean; key: string }
  > = [];

  let lastDateKey = "";
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const dk = getDateKey(msg.createdAt);
    if (dk && dk !== lastDateKey) {
      const label = formatDateLabel(msg.createdAt!);
      if (label) {
        renderItems.push({ type: "date", label, key: `date-${dk}` });
      }
      lastDateKey = dk;
    }
    const prev = i > 0 ? messages[i - 1] : null;
    const isFirstInGroup = !prev || prev.role !== msg.role;
    renderItems.push({ type: "msg", msg, isFirstInGroup, key: String(msg.id ?? `msg-${i}`) });
  }

  return (
    <div className="flex flex-col w-[340px] h-[460px] bg-popover rounded-2xl overflow-hidden border border-border/30 shadow-lg">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-popover">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            {botConfig.photoUrl ? (
              <AvatarImage src={botConfig.photoUrl} alt={botConfig.name} />
            ) : null}
            <AvatarFallback className="bg-brand-indigo/10">
              <Headphones className="h-4 w-4 text-brand-indigo" />
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-[13px] font-semibold text-foreground leading-tight">{botConfig.name}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Support Assistant</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground text-[11px] font-medium transition-colors"
        >
          Close
        </button>
      </div>

      {/* ── Messages area ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-1.5 bg-muted/50"
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        ) : (
          <>
            {!hasMessages && (
              <div className="flex flex-col items-start">
                <div className="flex gap-1.5 justify-start">
                  <BotAvatar config={botConfig} />
                  <div className="max-w-[80%] px-3 pt-2 pb-1 bg-white text-foreground rounded-lg rounded-tl-none text-[13px] leading-relaxed">
                    Hi! I&apos;m {botConfig.name}, your Lead Awaker assistant. How can I help you today?
                  </div>
                </div>
              </div>
            )}
            {renderItems.map((item) =>
              item.type === "date" ? (
                <DateSeparator key={item.key} label={item.label} />
              ) : (
                <ChatBubble
                  key={item.key}
                  msg={item.msg}
                  botConfig={botConfig}
                  isFirstInGroup={item.isFirstInGroup}
                />
              ),
            )}
            {sending && <TypingDots />}
          </>
        )}
      </div>

      {/* ── Escalation notice ── */}
      {escalated && (
        <div className="px-3.5 py-2 border-t border-border/20 bg-orange-50 dark:bg-orange-950/20">
          <p className="text-[11px] text-orange-700 dark:text-orange-400 font-medium">
            An agent has been notified
          </p>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-border/20 bg-popover">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={sending || loading}
          className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending || loading}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors shrink-0",
            input.trim()
              ? "bg-brand-indigo text-white hover:bg-brand-indigo/90"
              : "bg-muted text-muted-foreground",
          )}
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
