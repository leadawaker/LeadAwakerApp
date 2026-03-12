import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Send, Loader2, Paperclip, Mic, Square, Cpu, Zap, FileSpreadsheet, FileText, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { AiAgent, AgentMessage } from "../hooks/useAgentChat";
import { SubAgentPill } from "./SubAgentPill";
import { MarkdownRenderer } from "./MarkdownRenderer";

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-start gap-1.5">
      <div className="w-8 h-8 rounded-full bg-brand-indigo/10 flex items-center justify-center shrink-0">
        <Cpu className="h-4 w-4 text-brand-indigo" />
      </div>
      <div className="bg-white dark:bg-card rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-indigo/60"
              style={{ animation: `agentDotBounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
          <style>{`
            @keyframes agentDotBounce {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
              30% { transform: translateY(-4px); opacity: 1; }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign update extraction ───────────────────────────────────────────────
function extractCampaignUpdate(content: string): { campaignId: string; fields: Record<string, string> } | null {
  const match = content.match(/<campaign_update campaign_id="(\d+)">\s*([\s\S]*?)\s*<\/campaign_update>/);
  if (!match) return null;
  try {
    const fields = JSON.parse(match[2]) as Record<string, string>;
    return { campaignId: match[1], fields };
  } catch {
    return null;
  }
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  agent,
  onApplyCampaign,
}: {
  msg: AgentMessage;
  agent: AiAgent;
  onApplyCampaign?: (campaignId: string, fields: Record<string, string>) => void;
}) {
  const isUser = msg.role === "user";
  const campaignUpdate = !isUser ? extractCampaignUpdate(msg.content) : null;
  // Strip campaign_update XML from displayed content
  const displayContent = msg.content.replace(/<campaign_update[\s\S]*?<\/campaign_update>/g, "").trim();

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div className={cn("flex gap-1.5", isUser ? "justify-end" : "justify-start")}>
        {!isUser && (
          <Avatar className="h-7 w-7 shrink-0 mt-0.5">
            {agent.photoUrl ? (
              <AvatarImage src={agent.photoUrl} alt={agent.name} />
            ) : null}
            <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo text-[10px] font-bold">
              {agent.type === "code_runner" ? <Zap className="h-3.5 w-3.5" /> : agent.name[0]}
            </AvatarFallback>
          </Avatar>
        )}
        <div
          className={cn(
            "max-w-[80%] px-3 pt-2 pb-1.5 text-[13px] leading-relaxed shadow-sm rounded-lg",
            isUser
              ? "bg-brand-indigo text-white rounded-tr-none whitespace-pre-wrap"
              : "bg-white dark:bg-card text-foreground rounded-tl-none",
          )}
        >
          {isUser ? (
            <span>{displayContent}</span>
          ) : (
            <div className="agent-markdown-content">
              <MarkdownRenderer content={displayContent} />
            </div>
          )}
          {msg.subAgentBlocks && msg.subAgentBlocks.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-0.5">
              {msg.subAgentBlocks.map((block, i) => (
                <SubAgentPill key={i} block={block} />
              ))}
            </div>
          )}
          {campaignUpdate && onApplyCampaign && (
            <button
              onClick={() => onApplyCampaign(campaignUpdate.campaignId, campaignUpdate.fields)}
              className="mt-2 w-full text-[11px] font-semibold bg-brand-indigo/10 hover:bg-brand-indigo/20 text-brand-indigo rounded-md px-3 py-1.5 transition-colors"
            >
              Apply to Campaign #{campaignUpdate.campaignId}
            </button>
          )}
        </div>
      </div>
      {msg.createdAt && (
        <span className={cn("text-[10px] text-muted-foreground mt-0.5", isUser ? "mr-1" : "ml-8")}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

// ─── Streaming bubble ─────────────────────────────────────────────────────────
function StreamingBubble({ text, agent }: { text: string; agent: AiAgent }) {
  if (!text) return <TypingDots />;
  return (
    <div className="flex items-start gap-1.5">
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        {agent.photoUrl ? <AvatarImage src={agent.photoUrl} alt={agent.name} /> : null}
        <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo text-[10px] font-bold">
          {agent.type === "code_runner" ? <Zap className="h-3.5 w-3.5" /> : agent.name[0]}
        </AvatarFallback>
      </Avatar>
      <div className="max-w-[80%] px-3 pt-2 pb-1.5 text-[13px] leading-relaxed shadow-sm rounded-lg rounded-tl-none bg-white dark:bg-card text-foreground">
        <div className="agent-markdown-content">
          <MarkdownRenderer content={text} />
        </div>
        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-brand-indigo/70 animate-pulse align-text-bottom" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AgentChatView({
  agent,
  messages,
  streaming,
  streamingText,
  loading,
  onSend,
  onNewSession,
  sessionId,
}: {
  agent: AiAgent;
  messages: AgentMessage[];
  streaming: boolean;
  streamingText: string;
  loading: boolean;
  onSend: (text: string, attachment?: string, fileId?: number) => void;
  onNewSession: () => void;
  sessionId?: string;
}) {
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ id: number; name: string; fileType?: string; thumbnailUrl?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Suppress unused variable warning — onNewSession is available for parent use
  void onNewSession;

  // Scroll to bottom on new messages/streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = () => {
    if (!input.trim() || streaming) return;
    onSend(input.trim(), undefined, pendingFile?.id);
    setInput("");
    setPendingFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  // File upload handler — supports PDF, images, spreadsheets
  const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".csv", ".xlsx", ".xls"];
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;

    // Validate file extension
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert("Unsupported file type. Allowed: PDF, images (JPEG, PNG, GIF, WebP), spreadsheets (CSV, XLSX, XLS)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      alert("File too large. Maximum size is 20MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { apiFetch } = await import("@/lib/apiUtils");
      const res = await apiFetch(`/api/agent-conversations/${sessionId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          data: base64,
        }),
      });

      if (res.ok) {
        const fileRecord = await res.json() as { id: number; filename: string; fileType?: string; thumbnailUrl?: string };
        setPendingFile({
          id: fileRecord.id,
          name: fileRecord.filename,
          fileType: fileRecord.fileType,
          thumbnailUrl: fileRecord.thumbnailUrl,
        });
      } else {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        alert((err as { message: string }).message || "Failed to upload file.");
      }
    } catch (err) {
      console.error("[AgentChat] File upload error:", err);
      alert("Failed to upload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Apply campaign update via API
  const handleApplyCampaign = async (campaignId: string, fields: Record<string, string>) => {
    try {
      const { apiFetch } = await import("@/lib/apiUtils");
      const res = await apiFetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        alert(`Campaign #${campaignId} updated successfully!`);
      }
    } catch {
      alert("Failed to apply campaign update.");
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        setTranscribing(true);
        try {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const dataUrl = ev.target?.result as string;
            try {
              const { apiFetch } = await import("@/lib/apiUtils");
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
        } catch {
          setTranscribing(false);
        }
        setRecording(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch { /* mic denied */ }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const isCodeRunner = agent.type === "code_runner";

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {messages.length === 0 && !streaming && (
              <div className="flex items-start gap-1.5">
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  {agent.photoUrl ? <AvatarImage src={agent.photoUrl} alt={agent.name} /> : null}
                  <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo text-[10px] font-bold">
                    {isCodeRunner ? <Zap className="h-3.5 w-3.5" /> : agent.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="max-w-[80%] px-3 pt-2 pb-2 bg-white dark:bg-card text-foreground rounded-lg rounded-tl-none text-[13px] leading-relaxed shadow-sm">
                  {isCodeRunner
                    ? "I'm connected to the Pi. I can read and modify the LeadAwakerApp codebase and changes apply immediately via pm2. What would you like to change?"
                    : `Hi! I'm the ${agent.name}. I can help craft and improve your campaign messages. Share a campaign name or paste a URL for me to reference.`}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id ?? `msg-${i}`}
                msg={msg}
                agent={agent}
                onApplyCampaign={agent.type === "campaign_crafter" ? handleApplyCampaign : undefined}
              />
            ))}
            {streaming && <StreamingBubble text={streamingText} agent={agent} />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 bg-background p-3">
        {/* Pending file indicator */}
        {pendingFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-brand-indigo/5 border border-brand-indigo/20 rounded-lg text-[12px]">
            {pendingFile.fileType === "image" && pendingFile.thumbnailUrl ? (
              <img
                src={pendingFile.thumbnailUrl}
                alt={pendingFile.name}
                className="h-10 w-10 rounded object-cover shrink-0"
              />
            ) : pendingFile.fileType === "image" ? (
              <ImageIcon className="h-3.5 w-3.5 text-brand-indigo shrink-0" />
            ) : pendingFile.fileType === "spreadsheet" ? (
              <FileSpreadsheet className="h-3.5 w-3.5 text-green-600 shrink-0" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-brand-indigo shrink-0" />
            )}
            <span className="truncate text-foreground/80">{pendingFile.name}</span>
            <button
              onClick={() => setPendingFile(null)}
              className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
              title="Remove attachment"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {uploading && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Uploading file…</span>
          </div>
        )}
        <div className="flex items-end gap-2 bg-muted/40 rounded-2xl px-3 py-2 border border-border/40">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.csv,.xlsx,.xls,application/pdf,image/*,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileSelect}
            className="hidden"
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder={isCodeRunner ? "Tell me what to change..." : "Ask about campaigns..."}
            rows={1}
            disabled={streaming || loading}
            className="flex-1 resize-none bg-transparent text-[13px] placeholder:text-muted-foreground/50 focus:outline-none min-h-[28px] max-h-[120px] py-0.5"
          />

          {/* Attach file button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming || loading || uploading}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-40 shrink-0 transition-colors"
            title="Attach file (PDF, image, or spreadsheet)"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Send / Mic / Stop */}
          {input.trim() ? (
            <button
              onClick={handleSend}
              disabled={streaming || loading}
              className="h-8 w-8 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
            >
              {streaming ? (
                <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          ) : transcribing ? (
            <button
              disabled
              className="h-8 w-8 rounded-full bg-brand-indigo/40 text-white flex items-center justify-center shrink-0"
            >
              <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            </button>
          ) : recording ? (
            <button
              onClick={stopRecording}
              className="h-8 w-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shrink-0 transition-colors"
              style={{ animation: "micPulseAgent 1s ease-in-out infinite" }}
            >
              <Square className="h-3 w-3 fill-white text-white" />
              <style>{`@keyframes micPulseAgent { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }`}</style>
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={streaming || loading}
              className="h-8 w-8 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
            >
              <Mic className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
