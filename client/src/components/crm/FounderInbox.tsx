import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { User, Send, Loader2, ChevronLeft, Mic, Square } from "lucide-react";
import { hapticSend } from "@/lib/haptics";

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
        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors",
        isSelected ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
      )}
    >
      <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
        <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-semibold leading-tight truncate text-foreground">
            {session.userName}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatRelativeTime(session.lastMessageAt || session.createdAt)}
          </span>
        </div>
        {session.lastMessage && (
          <p className="text-[12px] text-muted-foreground leading-tight truncate mt-0.5">
            {session.lastMessage}
          </p>
        )}
      </div>
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    hapticSend();

    try {
      await apiFetch("/api/support-chat/founder/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, content: text }),
      });
      queryClient.invalidateQueries({ queryKey: ["founder-messages", session.sessionId] });
      queryClient.invalidateQueries({ queryKey: ["founder-sessions"] });
    } catch (err) {
      console.error("[FounderInbox] Reply error:", err);
    } finally {
      setSending(false);
    }
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
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        setTranscribing(true);
        try {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const dataUrl = ev.target?.result as string;
            try {
              const res = await apiFetch("/api/support-chat/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ audio_data: dataUrl, mime_type: recorder.mimeType }),
              });
              if (res.ok) {
                const { transcription } = await res.json() as { transcription: string };
                if (transcription) {
                  setInput(transcription);
                  if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
                    textareaRef.current.focus();
                  }
                }
              }
            } catch { /* silent */ }
            setTranscribing(false);
          };
          reader.readAsDataURL(blob);
        } catch { setTranscribing(false); }
        setRecording(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch { /* mic permission denied */ }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-card border-b border-black/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-foreground leading-tight truncate">
              {session.userName}
            </p>
            {session.userEmail && (
              <p className="text-[11px] text-muted-foreground leading-tight truncate">
                {session.userEmail}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col gap-1.5 bg-muted/30">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-[13px]">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => {
            const isFromUser = msg.role === "user";
            return (
              <div key={msg.id} className={cn("flex flex-col", isFromUser ? "items-start" : "items-end")}>
                <div
                  className={cn(
                    "max-w-[80%] px-3 pt-2 pb-1 text-[13px] leading-relaxed whitespace-pre-wrap shadow-sm rounded-lg",
                    isFromUser
                      ? "bg-white dark:bg-card text-foreground rounded-tl-none"
                      : "bg-emerald-600 text-white rounded-tr-none",
                  )}
                >
                  <span>{msg.content}</span>
                  <span
                    className={cn(
                      "float-right text-[9px] ml-2 mt-2 leading-none select-none",
                      isFromUser ? "text-muted-foreground/50" : "text-white/50",
                    )}
                  >
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 shrink-0 bg-white dark:bg-card border-t border-black/[0.04]">
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg border border-black/[0.08] pl-3 pr-4 py-[3px] min-h-[62px]">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Reply as founder..."
            disabled={sending}
            className="flex-1 text-[17px] bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 leading-5 pl-1 pr-2"
            style={{ maxHeight: "120px" }}
          />
          {input.trim() ? (
            <button
              onClick={handleSend}
              disabled={sending}
              className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40 shrink-0 transition-colors"
              title="Send reply"
            >
              {sending ? (
                <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </button>
          ) : transcribing ? (
            <button disabled className="h-9 w-9 rounded-full bg-emerald-600/40 text-white flex items-center justify-center shrink-0">
              <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            </button>
          ) : recording ? (
            <button
              onClick={stopRecording}
              className="h-9 w-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shrink-0 transition-colors"
              title="Stop recording"
            >
              <Square className="h-3.5 w-3.5 fill-white text-white" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={sending}
              className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40 shrink-0 transition-colors"
              title="Record voice message"
            >
              <Mic className="h-4 w-4 text-white" />
            </button>
          )}
        </div>
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
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-black/[0.04] shrink-0">
        <User className="h-3 w-3" />
        Founder Direct Messages
      </div>
      <div className="flex-1 overflow-y-auto p-[3px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
              <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-[13px] text-muted-foreground">No founder messages yet</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              When users message you directly, they will appear here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-[3px]">
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