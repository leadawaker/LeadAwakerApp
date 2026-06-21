import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { User, Send, Loader2, ChevronLeft, Mic, Trash2, Paperclip, MessageSquare } from "lucide-react";
import { hapticSend } from "@/lib/haptics";
import { VoiceMemo } from "@/components/crm/SupportChatHelpers";

interface FounderSession {
  id: number;
  sessionId: string;
  userId: number;
  userName: string;
  userEmail?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  messageCount: number;
  unreadCount: number;
  status: string;
  createdAt: string;
}

interface Message {
  id: number;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function UserAvatar({ size = 36 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "var(--r-pill)",
        flexShrink: 0,
        background: "var(--wine-tint)",
        border: "1.5px solid var(--wine-glow)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <User style={{ width: size * 0.44, height: size * 0.44, color: "var(--wine)" }} />
    </span>
  );
}

function SessionRow({
  session,
  isSelected,
  onClick,
}: {
  session: FounderSession;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "flex items-center gap-2.5 cursor-pointer transition-[box-shadow,background-color] duration-150",
        isSelected ? "neu-inset" : "neu-raised-crisp hover:bg-[var(--card-hover)]",
      )}
      style={{
        padding: "10px 12px",
        borderRadius: "var(--r-surface)",
        background: isSelected ? "var(--wine-tint)" : "var(--surface)",
        borderLeft: isSelected ? "3px solid var(--wine)" : "3px solid transparent",
      }}
    >
      <UserAvatar size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className="text-[14px] font-semibold leading-tight truncate"
            style={{ color: "var(--ink)" }}
          >
            {session.userName}
          </p>
          <span
            className="text-[10px] shrink-0 tabular-nums"
            style={{ fontFamily: "var(--mono)", color: "var(--mute-2)" }}
          >
            {formatRelativeTime(session.lastMessageAt || session.createdAt)}
          </span>
        </div>
        {session.lastMessage && (
          <p
            className="text-[12px] leading-tight truncate mt-0.5"
            style={{ color: "var(--mute)" }}
          >
            {session.lastMessage.startsWith("data:audio") ? "🎤 Voice message"
              : session.lastMessage.startsWith("data:image") ? "📷 Photo"
              : session.lastMessage.startsWith("data:") ? "📎 Attachment"
              : session.lastMessage}
          </p>
        )}
      </div>
      {session.unreadCount > 0 && (
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: "var(--r-pill)",
            background: "var(--wine-grad)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "var(--mono)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {session.unreadCount > 9 ? "9+" : session.unreadCount}
        </span>
      )}
    </div>
  );
}

function FounderChatView({
  session,
  onBack,
}: {
  session: FounderSession;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canceledRef = useRef(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const d = ev.target?.result as string; if (d) sendReply(d); };
    reader.readAsDataURL(file);
  };

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["founder-messages", session.sessionId],
    queryFn: async () => {
      const res = await apiFetch(`/api/support-chat/messages/${session.sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendReply = async (content: string) => {
    if (!content || sending) return;
    setSending(true);
    hapticSend();

    try {
      await apiFetch("/api/support-chat/founder/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, content }),
      });
      queryClient.invalidateQueries({ queryKey: ["founder-messages", session.sessionId] });
      queryClient.invalidateQueries({ queryKey: ["founder-sessions"] });
    } catch (err) {
      console.error("[FounderInbox] Reply error:", err);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendReply(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      canceledRef.current = false;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
        setRecordingSeconds(0);
        setRecording(false);
        if (canceledRef.current) { canceledRef.current = false; return; }
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        setTranscribing(true);
        try {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) await sendReply(dataUrl);
            setTranscribing(false);
          };
          reader.readAsDataURL(blob);
        } catch { setTranscribing(false); }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch { /* mic permission denied */ }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const cancelRecording = () => {
    canceledRef.current = true;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const sendBtnStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: "var(--r-pill)",
    flexShrink: 0,
    border: "none",
    cursor: "pointer",
    background: "var(--wine-grad)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "var(--sh-raised-crisp)",
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}
      >
        <button
          onClick={onBack}
          className="neu-raised-crisp active:scale-95 transition-transform"
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--r-pill)",
            flexShrink: 0,
            border: "none",
            cursor: "pointer",
            background: "var(--surface)",
            color: "var(--mute)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <UserAvatar size={36} />
        <div className="min-w-0 flex-1">
          <p
            className="text-[15px] font-semibold leading-tight truncate"
            style={{ color: "var(--ink)" }}
          >
            {session.userName}
          </p>
          {session.userEmail && (
            <p
              className="text-[11px] leading-tight truncate"
              style={{ fontFamily: "var(--mono)", color: "var(--mute-2)", fontSize: 10, letterSpacing: "0.05em" }}
            >
              {session.userEmail}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col gap-1.5"
        style={{ background: "var(--bg-main, hsl(var(--muted) / 0.4))" }}
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--wine)" }} />
          </div>
        ) : messages.length === 0 ? (
          <div
            className="flex-1 flex items-center justify-center text-[13px]"
            style={{ color: "var(--mute)" }}
          >
            No messages yet
          </div>
        ) : (
          messages.map((msg) => {
            const isFromUser = msg.role === "user";
            const content = typeof msg.content === "string" ? msg.content : "";
            const isAudio = content.startsWith("data:audio");
            const isImage = content.startsWith("data:image");
            const isFile = !isAudio && !isImage && content.startsWith("data:");
            return (
              <div key={msg.id} className={cn("flex flex-col", isFromUser ? "items-start" : "items-end")}>
                <div
                  className="max-w-[80%] text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={{
                    padding: "8px 12px 6px",
                    borderRadius: isFromUser
                      ? "var(--r-surface) var(--r-surface) var(--r-surface) var(--r-button)"
                      : "var(--r-surface) var(--r-surface) var(--r-button) var(--r-surface)",
                    background: isFromUser
                      ? "var(--surface)"
                      : "var(--wine-grad)",
                    color: isFromUser ? "var(--ink)" : "#fff",
                    boxShadow: isFromUser
                      ? "var(--sh-raised-crisp)"
                      : "0 2px 8px var(--wine-glow)",
                  }}
                >
                  {isAudio ? (
                    <VoiceMemo src={content} onDark={!isFromUser} />
                  ) : isImage ? (
                    <a href={content} target="_blank" rel="noopener noreferrer">
                      <img src={content} alt="attachment" className="rounded-lg max-w-[220px] my-1 block" />
                    </a>
                  ) : isFile ? (
                    <a
                      href={content}
                      download
                      style={{ color: isFromUser ? "var(--wine)" : "rgba(255,255,255,0.85)", textDecoration: "underline" }}
                      className="my-1 inline-block"
                    >
                      Download attachment
                    </a>
                  ) : (
                    <span>{content}</span>
                  )}
                  <span
                    className="float-right ml-2 mt-1 leading-none select-none tabular-nums"
                    style={{
                      fontSize: 9,
                      color: isFromUser ? "var(--mute-2)" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input bar */}
      <div
        className="px-3 pb-3 pt-2 shrink-0"
        style={{ background: "var(--bg)", borderTop: "1px solid var(--line)" }}
      >
        <div
          className="flex items-center gap-1.5"
          style={{
            background: "var(--surface)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--sh-inset-crisp)",
            padding: "4px 4px 4px 12px",
            minHeight: 52,
          }}
        >
          {recording ? (
            <>
              <button
                type="button"
                onClick={cancelRecording}
                style={{
                  width: 36, height: 36, borderRadius: "var(--r-pill)", flexShrink: 0,
                  border: "none", cursor: "pointer", background: "transparent",
                  color: "#C0392B", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                title="Cancel recording"
              >
                <Trash2 className="h-5 w-5" />
              </button>
              <div className="flex-1 flex items-center gap-2 pl-1">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: "#C0392B", animation: "micPulse 1s ease-in-out infinite" }}
                />
                <span
                  className="text-[15px] font-medium tabular-nums"
                  style={{ color: "var(--ink)" }}
                >
                  {`${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`}
                </span>
                <span className="text-[12px]" style={{ color: "var(--mute)" }}>Recording…</span>
              </div>
              <button
                onClick={stopRecording}
                style={sendBtnStyle}
                title="Send voice message"
              >
                <Send className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Reply as founder…"
                disabled={sending}
                className="flex-1 text-[15px] bg-transparent resize-none focus:outline-none disabled:opacity-50 leading-5 pr-2"
                style={{
                  color: "var(--ink)",
                  maxHeight: "120px",
                  fontFamily: "var(--font-sans, Manrope, sans-serif)",
                }}
              />
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                style={{
                  width: 34, height: 34, borderRadius: "var(--r-pill)", flexShrink: 0,
                  border: "none", cursor: "pointer", background: "transparent",
                  color: "var(--mute-2)", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                title="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              {input.trim() ? (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  style={{ ...sendBtnStyle, opacity: sending ? 0.4 : 1 }}
                  title="Send reply"
                >
                  {sending ? (
                    <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              ) : transcribing ? (
                <button disabled style={{ ...sendBtnStyle, opacity: 0.4 }}>
                  <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={sending}
                  style={{ ...sendBtnStyle, opacity: sending ? 0.4 : 1 }}
                  title="Record voice message"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
        <input ref={attachInputRef} type="file" className="hidden" onChange={handleAttachFile} />
      </div>
    </div>
  );
}

/** Admin founder inbox: lists all founder DM sessions, click to view and reply */
export function FounderInbox() {
  const [selectedSession, setSelectedSession] = useState<FounderSession | null>(null);

  const { data: sessions = [], isLoading } = useQuery<FounderSession[]>({
    queryKey: ["founder-sessions"],
    queryFn: async () => {
      const res = await apiFetch("/api/support-chat/founder/sessions");
      if (!res.ok) throw new Error("Failed to fetch founder sessions");
      return res.json();
    },
    refetchInterval: 10000,
  });

  if (selectedSession) {
    return (
      <FounderChatView
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div
        className="px-4 py-3 shrink-0 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--r-surface)",
            background: "var(--wine-tint)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MessageSquare style={{ width: 14, height: 14, color: "var(--wine)" }} />
        </span>
        <span
          className="font-semibold"
          style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)" }}
        >
          Inbox
        </span>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "8px 12px 24px" }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--wine)" }} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4 gap-3">
            <span
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--r-card)",
                background: "var(--wine-tint)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MessageSquare style={{ width: 22, height: 22, color: "var(--wine)" }} />
            </span>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                No messages yet
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--mute)" }}>
                When users message you, they'll appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                isSelected={false}
                onClick={() => setSelectedSession(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
