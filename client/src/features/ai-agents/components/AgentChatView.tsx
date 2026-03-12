import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Send, Loader2, Paperclip, Mic, Square, Cpu, Zap, FileSpreadsheet, FileText, Image as ImageIcon, X, CircleStop, Download, Volume2, File as FileIcon, Sparkles, AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { AiAgent, AgentMessage, AgentFile, PendingConfirmation } from "../hooks/useAgentChat";
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

// ─── File type helpers ────────────────────────────────────────────────────────
function getFileCategory(file: AgentFile): "image" | "pdf" | "spreadsheet" | "audio" | "other" {
  const mime = file.mimeType?.toLowerCase() || "";
  const ext = file.filename.toLowerCase().split(".").pop() || "";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (["csv", "xlsx", "xls"].includes(ext) || mime.includes("spreadsheet") || mime === "text/csv") return "spreadsheet";
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "webm", "mp4", "m4a"].includes(ext)) return "audio";
  return "other";
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── File preview component ──────────────────────────────────────────────────
function FilePreview({ file, isUser }: { file: AgentFile; isUser: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const category = getFileCategory(file);
  const downloadUrl = `/api/agent-files/${file.id}/download`;
  const thumbnailUrl = `/api/agent-files/${file.id}/thumbnail`;

  const handleClick = () => {
    if (category === "image") {
      setExpanded(!expanded);
    } else {
      window.open(downloadUrl, "_blank");
    }
  };

  const baseClass = cn(
    "flex items-center gap-2 rounded-lg cursor-pointer transition-colors mt-1.5 overflow-hidden",
    isUser
      ? "bg-white/15 hover:bg-white/25 p-2"
      : "bg-muted/60 hover:bg-muted p-2",
  );

  if (category === "image") {
    return (
      <div className="mt-1.5">
        <div
          className="cursor-pointer rounded-lg overflow-hidden"
          onClick={handleClick}
          title={expanded ? "Click to collapse" : "Click to expand"}
        >
          <img
            src={thumbnailUrl}
            alt={file.filename}
            className={cn(
              "rounded-lg object-cover transition-all",
              expanded ? "max-w-full max-h-[400px]" : "max-w-[200px] max-h-[150px]",
            )}
          />
        </div>
        <div className={cn("flex items-center gap-1.5 mt-1 text-[10px]", isUser ? "text-white/70" : "text-muted-foreground")}>
          <ImageIcon className="h-3 w-3" />
          <span className="truncate max-w-[150px]">{file.filename}</span>
          {file.fileSize ? <span>· {formatFileSize(file.fileSize)}</span> : null}
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn("ml-auto", isUser ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-foreground")}
            title="Download"
          >
            <Download className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  }

  if (category === "audio") {
    return (
      <div className="mt-1.5">
        <div className={baseClass}>
          <Volume2 className={cn("h-4 w-4 shrink-0", isUser ? "text-white/80" : "text-purple-500")} />
          <div className="flex-1 min-w-0">
            <div className={cn("text-[11px] font-medium truncate", isUser ? "text-white" : "text-foreground")}>
              {file.filename}
            </div>
            {file.fileSize ? (
              <div className={cn("text-[10px]", isUser ? "text-white/60" : "text-muted-foreground")}>
                {formatFileSize(file.fileSize)}
              </div>
            ) : null}
          </div>
        </div>
        <audio
          controls
          preload="metadata"
          className="w-full mt-1 h-8"
          style={{ maxWidth: "280px" }}
        >
          <source src={downloadUrl} type={file.mimeType || "audio/webm"} />
        </audio>
      </div>
    );
  }

  // PDF, spreadsheet, other files
  const icon = category === "pdf" ? (
    <FileText className={cn("h-4 w-4 shrink-0", isUser ? "text-white/80" : "text-red-500")} />
  ) : category === "spreadsheet" ? (
    <FileSpreadsheet className={cn("h-4 w-4 shrink-0", isUser ? "text-white/80" : "text-green-600")} />
  ) : (
    <FileIcon className={cn("h-4 w-4 shrink-0", isUser ? "text-white/80" : "text-blue-500")} />
  );

  return (
    <div className={baseClass} onClick={handleClick} title="Click to view file">
      {icon}
      <div className="flex-1 min-w-0">
        <div className={cn("text-[11px] font-medium truncate", isUser ? "text-white" : "text-foreground")}>
          {file.filename}
        </div>
        <div className={cn("text-[10px]", isUser ? "text-white/60" : "text-muted-foreground")}>
          {category === "pdf" ? "PDF" : category === "spreadsheet" ? "Spreadsheet" : "File"}
          {file.fileSize ? ` · ${formatFileSize(file.fileSize)}` : ""}
        </div>
      </div>
      <Download className={cn("h-3.5 w-3.5 shrink-0", isUser ? "text-white/50" : "text-muted-foreground/50")} />
    </div>
  );
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
  const isSkill = !!(msg.metadata?.skillId);
  const isSkillError = !!(msg.metadata?.error);
  const skillName = msg.metadata?.skillName as string | undefined;
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
            "max-w-[85%] sm:max-w-[80%] px-3 pt-2 pb-1.5 text-[13px] leading-relaxed shadow-sm rounded-lg overflow-hidden",
            isUser
              ? "bg-brand-indigo text-white rounded-tr-none whitespace-pre-wrap break-words"
              : isSkillError
                ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 text-foreground rounded-tl-none"
                : "bg-white dark:bg-card text-foreground rounded-tl-none",
          )}
        >
          {/* Skill badge indicator */}
          {isSkill && skillName && (
            <div className={cn(
              "flex items-center gap-1 mb-1.5 text-[10px] font-medium",
              isUser
                ? "text-white/70"
                : isSkillError
                  ? "text-red-500 dark:text-red-400"
                  : "text-purple-600 dark:text-purple-400",
            )}>
              {isSkillError ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              <span>{isSkillError ? `Skill Failed: ${skillName}` : `Skill: ${skillName}`}</span>
            </div>
          )}
          {isUser ? (
            <span>{displayContent}</span>
          ) : (
            <div className="agent-markdown-content min-w-0 overflow-hidden">
              <MarkdownRenderer content={displayContent} />
            </div>
          )}
          {msg.files && msg.files.length > 0 && (
            <div className="flex flex-col gap-1">
              {msg.files.map((file) => (
                <FilePreview key={file.id} file={file} isUser={isUser} />
              ))}
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
      <div className="max-w-[85%] sm:max-w-[80%] px-3 pt-2 pb-1.5 text-[13px] leading-relaxed shadow-sm rounded-lg rounded-tl-none bg-white dark:bg-card text-foreground overflow-hidden">
        <div className="agent-markdown-content min-w-0 overflow-hidden">
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
  pendingConfirmation,
  onConfirmDestructive,
  onCancelDestructive,
}: {
  agent: AiAgent;
  messages: AgentMessage[];
  streaming: boolean;
  streamingText: string;
  loading: boolean;
  onSend: (text: string, attachment?: string, fileId?: number) => void;
  onNewSession: () => void;
  sessionId?: string;
  pendingConfirmation?: PendingConfirmation | null;
  onConfirmDestructive?: () => void;
  onCancelDestructive?: () => void;
}) {
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ id: number; name: string; fileType?: string; thumbnailUrl?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingVoiceFile, setPendingVoiceFile] = useState<{ id: number; name: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    const fileId = pendingFile?.id ?? pendingVoiceFile?.id;
    onSend(input.trim(), undefined, fileId);
    setInput("");
    setPendingFile(null);
    setPendingVoiceFile(null);
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

  // Format seconds as mm:ss
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Voice recording — start capturing audio
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        // Stop all tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setRecordingDuration(0);
        setRecording(false);

        // Build blob from chunks
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        if (blob.size === 0) return; // cancelled — no data

        // Transcribe via backend
        setTranscribing(true);
        try {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const dataUrl = ev.target?.result as string;
            try {
              const { apiFetch } = await import("@/lib/apiUtils");
              const res = await apiFetch("/api/agent-voice/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audio_data: dataUrl,
                  mime_type: recorder.mimeType,
                  session_id: sessionId,
                }),
              });
              if (res.ok) {
                const data = await res.json() as { transcription: string; fileId?: number; filename?: string };
                if (data.transcription) {
                  setInput(data.transcription);
                  if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
                    textareaRef.current.focus();
                  }
                }
                // Store voice file reference for sending with message
                if (data.fileId) {
                  setPendingVoiceFile({ id: data.fileId, name: data.filename || "voice-memo.webm" });
                }
              }
            } catch (err) {
              console.error("[AgentChat] Transcription error:", err);
            }
            setTranscribing(false);
          };
          reader.readAsDataURL(blob);
        } catch {
          setTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingDuration(0);
      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      /* mic permission denied — silent */
    }
  }, [sessionId]);

  // Stop recording — finish and transcribe
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  // Cancel recording — discard audio
  const cancelRecording = useCallback(() => {
    // Stop recorder without processing (clear chunks first)
    audioChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    // Stop all media tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    // Clear timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecording(false);
    setRecordingDuration(0);
  }, []);

  const isCodeRunner = agent.type === "code_runner";

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-h-0 overscroll-contain">
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
      <div className="border-t border-border/50 bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
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
        {/* Pending voice file indicator (after transcription) */}
        {pendingVoiceFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-lg text-[12px]">
            <Mic className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="truncate text-foreground/80">{pendingVoiceFile.name}</span>
            <span className="text-muted-foreground/60 text-[10px]">transcribed</span>
            <button
              onClick={() => setPendingVoiceFile(null)}
              className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
              title="Remove voice memo"
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

        {/* Recording indicator with duration timer */}
        {recording && (
          <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-xl" data-testid="recording-indicator">
            {/* Pulsing red dot */}
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-[13px] font-medium text-red-600 dark:text-red-400">Recording</span>
            <span className="text-[13px] font-mono text-red-500/80 tabular-nums" data-testid="recording-duration">
              {formatDuration(recordingDuration)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {/* Cancel button */}
              <button
                onClick={cancelRecording}
                className="h-7 px-2.5 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground bg-white/80 dark:bg-background/80 border border-border/50 hover:border-border transition-colors flex items-center gap-1"
                data-testid="recording-cancel"
                title="Cancel recording"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
              {/* Stop button */}
              <button
                onClick={stopRecording}
                className="h-7 px-2.5 rounded-full text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center gap-1"
                data-testid="recording-stop"
                title="Stop recording"
              >
                <Square className="h-2.5 w-2.5 fill-white" />
                Stop
              </button>
            </div>
          </div>
        )}

        {/* Transcribing indicator */}
        {transcribing && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-brand-indigo/5 border border-brand-indigo/20 rounded-xl text-[12px]" data-testid="transcribing-indicator">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-indigo" />
            <span className="text-brand-indigo font-medium">Transcribing voice memo…</span>
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
            placeholder={recording ? "Recording..." : isCodeRunner ? "Tell me what to change..." : "Ask about campaigns..."}
            rows={1}
            disabled={streaming || loading || recording}
            className="flex-1 resize-none bg-transparent text-[13px] placeholder:text-muted-foreground/50 focus:outline-none min-h-[28px] max-h-[120px] py-0.5"
          />

          {/* Attach file button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming || loading || uploading || recording}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-40 shrink-0 transition-colors"
            title="Attach file (PDF, image, or spreadsheet)"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Send / Mic button */}
          {input.trim() ? (
            <button
              onClick={handleSend}
              disabled={streaming || loading}
              className="h-8 w-8 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
              data-testid="send-button"
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
              data-testid="mic-stop-button"
            >
              <CircleStop className="h-4 w-4" />
              <style>{`@keyframes micPulseAgent { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }`}</style>
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={streaming || loading}
              className="h-8 w-8 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
              data-testid="mic-button"
            >
              <Mic className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Destructive Action Confirmation Dialog */}
      <AlertDialog
        open={!!pendingConfirmation && pendingConfirmation.actions.length > 0}
        onOpenChange={(open) => {
          if (!open) onCancelDestructive?.();
        }}
      >
        <AlertDialogContent data-testid="destructive-action-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Confirm Destructive Action
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  The agent wants to perform the following destructive action{(pendingConfirmation?.actions?.length ?? 0) > 1 ? "s" : ""}:
                </p>
                <div className="space-y-2">
                  {pendingConfirmation?.actions?.map((action, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50"
                    >
                      <Trash2 className="h-4 w-4 text-red-500 shrink-0" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-400">
                        {action.description}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  This action cannot be undone. Are you sure you want to proceed?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => onCancelDestructive?.()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onConfirmDestructive?.()}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="confirm-destructive-action"
            >
              Confirm &amp; Execute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
