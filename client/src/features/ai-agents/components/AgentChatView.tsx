import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Send, Loader2, Paperclip, Mic, Square, Zap, FileSpreadsheet, FileText, Image as ImageIcon, X, Download, Volume2, File as FileIcon, Sparkles, AlertTriangle, ShieldAlert, Trash2, Brain, Terminal, Search, FileCode, Globe, MousePointerClick, Lock, LockOpen } from "lucide-react";
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
import type { SelectedElementInfo } from "../hooks/useElementPicker";
import { SubAgentPill } from "./SubAgentPill";
import { MarkdownRenderer } from "./MarkdownRenderer";

// ─── Slash commands ──────────────────────────────────────────────────────────

interface SlashCommand {
  name: string;
  args?: string;
  description: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { name: "/new", description: "Start a new conversation" },
  { name: "/clear", description: "Clear conversation history" },
  { name: "/model", args: "sonnet | opus | haiku", description: "Switch AI model" },
  { name: "/thinking", args: "none | low | medium | high", description: "Set thinking level" },
  { name: "/page", description: "Toggle page awareness on/off" },
  { name: "/help", description: "Show available commands" },
  // Sales & prospecting
  { name: "/prospect", args: "<company or niche>", description: "Research a company, enrich prospect, save to CRM" },
  { name: "/createclient", args: "<business>", description: "Create a demo campaign from a business description" },
  { name: "/telegram-demo", args: "<prospect>", description: "Set up a complete Telegram demo bot" },
  { name: "/pitch", args: "<prospect>", description: "Prepare a tailored sales pitch" },
  { name: "/cold-call", args: "<prospect>", description: "Prep a cold call script with CRM data" },
  { name: "/outreach-email", args: "<prospect>", description: "Draft cold outreach via email/WhatsApp/LinkedIn" },
  { name: "/linkedin-jobs", args: "<niche>", description: "Find NL companies hiring sales, add as prospects" },
  { name: "/demo-prep", description: "Prepare for a prospect demo" },
  // Tasks & planning
  { name: "/task", args: "<description>", description: "Create, track, or complete a task" },
  { name: "/morning-briefing", description: "Run the morning coaching briefing" },
  { name: "/briefing", description: "Alias for morning briefing" },
  { name: "/daily-review", description: "End-of-day review + plan tomorrow" },
  { name: "/weekly-review", description: "Run the weekly review" },
  { name: "/taskend", description: "Log work done this session as tasks" },
  // Content & docs
  { name: "/copywriting", args: "<page>", description: "Write or rewrite marketing copy" },
  { name: "/dutch-lines", args: "<phrase>", description: "Natural Dutch WhatsApp variations" },
  { name: "/pdf-docs", args: "<brief>", description: "Generate a branded PDF document" },
  { name: "/logo-designer", description: "Design or iterate on an SVG logo" },
  { name: "/video-description", description: "Write a video description" },
  // Dev & CRM
  { name: "/leadawaker-dev", description: "LeadAwaker dev guidelines + conventions" },
  { name: "/i18n-audit", description: "Audit and fix i18n coverage" },
  { name: "/crm-table", description: "Build an inline-editable data table" },
  { name: "/crm-page-layout", description: "Scaffold a new CRM page" },
  { name: "/toolbar-buttons", description: "Build compact toolbar buttons" },
  { name: "/chat-bubble-ui", description: "Build WhatsApp-style chat bubbles" },
  { name: "/automation", description: "Create or debug a WAT automation" },
  { name: "/kenji-dev", description: "Kenji Telegram bot development" },
  { name: "/agent-builder", description: "Build AI agents via Claude Code" },
  { name: "/front-end-design", description: "Create production-grade UI" },
  // Ops & data
  { name: "/bot-test", args: "<campaign>", description: "Test campaign bot naturalness" },
  { name: "/invoice-expense", description: "Process invoices/expenses, BTW admin" },
  { name: "/infra-troubleshoot", description: "Diagnose Pi server issues" },
  { name: "/watchdog", description: "Check LeadAwaker server health" },
  { name: "/transcribe", args: "<audio path>", description: "Transcribe audio to text" },
  { name: "/youtube-transcript", args: "<url>", description: "Extract YouTube video transcript" },
  { name: "/csv-data-summarizer", args: "<path>", description: "Analyze a CSV with pandas" },
  { name: "/pdf", args: "<op>", description: "PDF read/merge/split/OCR/etc" },
  // Reference
  { name: "/claude-api", description: "Claude API / SDK helper" },
  { name: "/react-best-practices", description: "React/Next.js performance guidelines" },
  { name: "/supabase-postgres-best-practices", description: "Postgres optimization" },
  { name: "/improve", args: "<prompt>", description: "Sharpen a vague prompt" },
  { name: "/learn", description: "Extract reusable patterns from this chat" },
];

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="relative">
        <div className="bg-white dark:bg-card rounded-2xl rounded-bl-none px-3 py-2 shadow-[0_2px_2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_2px_rgba(255,255,255,0.04)]">
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
        <span aria-hidden="true" className="absolute bottom-0 -left-[6px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-white dark:border-r-card" />
      </div>
    </div>
  );
}

// ─── Activity indicator (shows what the AI is doing) ─────────────────────────
function ActivityIndicator({ activity }: { activity: { type: "thinking" | "tool"; tool?: string; label?: string } }) {
  const icon = activity.type === "thinking" ? (
    <Brain className="h-3 w-3 animate-pulse" />
  ) : activity.tool === "Bash" ? (
    <Terminal className="h-3 w-3" />
  ) : activity.tool === "Grep" || activity.tool === "Glob" ? (
    <Search className="h-3 w-3" />
  ) : activity.tool === "WebSearch" || activity.tool === "WebFetch" ? (
    <Globe className="h-3 w-3" />
  ) : (
    <FileCode className="h-3 w-3" />
  );

  const label = activity.type === "thinking"
    ? "Thinking..."
    : activity.label || `Using ${activity.tool || "tool"}`;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-indigo/10 text-brand-indigo text-[11px] font-medium w-fit animate-in fade-in slide-in-from-bottom-1 duration-200">
      {icon}
      <span>{label}</span>
      <span className="flex gap-0.5 ml-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-brand-indigo/60"
            style={{ animation: `agentDotBounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </span>
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
  isLastInStreak,
}: {
  msg: AgentMessage;
  agent: AiAgent;
  onApplyCampaign?: (campaignId: string, fields: Record<string, string>) => void;
  isLastInStreak?: boolean;
}) {
  const isUser = msg.role === "user";
  const isSkill = !!(msg.metadata?.skillId);
  const isSkillError = !!(msg.metadata?.error);
  const skillName = msg.metadata?.skillName as string | undefined;
  const campaignUpdate = !isUser ? extractCampaignUpdate(msg.content) : null;
  // Strip campaign_update XML from displayed content
  const displayContent = msg.content.replace(/<campaign_update[\s\S]*?<\/campaign_update>/g, "").trim();

  const time = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className="relative w-full" style={{ maxWidth: "100%" }}>
        <div
          className={cn(
            "px-3 pt-2 pb-1.5 text-[15px] relative",
            "rounded-2xl",
            isLastInStreak && isUser && "rounded-br-none",
            isLastInStreak && !isUser && "rounded-bl-none",
            isUser
              ? "bg-brand-indigo text-white shadow-[0_2px_2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_2px_rgba(255,255,255,0.04)]"
              : isSkillError
                ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 text-foreground"
                : "bg-white dark:bg-card text-gray-900 dark:text-foreground shadow-[0_2px_2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_2px_rgba(255,255,255,0.04)]",
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
          <div className="flex flex-col gap-1">
            {isUser ? (
              (() => {
                const selMatch = displayContent.match(/\n\n> 📍 \*\*(.+?)\*\*(?:\s"(.*?)")?(?:\n<sub>(.*?)<\/sub>)?\s*$/);
                const userText = selMatch ? displayContent.slice(0, selMatch.index).trimEnd() : displayContent;
                const selLabel = selMatch?.[1];
                const selSnippet = selMatch?.[2];
                return (
                  <div className="flex flex-col gap-1.5">
                    {selMatch && (
                      <div className="inline-flex items-center gap-1.5 self-start px-2 py-1 bg-violet-100/80 dark:bg-violet-900/30 border border-violet-300/60 dark:border-violet-700/60 rounded-md text-violet-900 dark:text-violet-200 max-w-full">
                        <MousePointerClick className="h-3 w-3 shrink-0" />
                        <span className="font-mono text-[10px] font-semibold shrink-0">{selLabel}</span>
                        {selSnippet && (
                          <span className="truncate text-[10px] opacity-75">"{selSnippet}"</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-end gap-1.5">
                      <span className="whitespace-pre-wrap leading-relaxed break-words flex-1 min-w-0">{userText}</span>
                      {time && (
                        <span className="shrink-0 text-[11px] leading-none select-none opacity-50 mb-0.5">{time}</span>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="agent-markdown-content min-w-0 overflow-hidden">
                <MarkdownRenderer content={displayContent} />
                {time && (
                  <div className="flex justify-end mt-0.5">
                    <span className="text-[11px] leading-none select-none opacity-50">{time}</span>
                  </div>
                )}
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
          {/* Tails — side-pointing, bottom-aligned, only on last in streak */}
          {isLastInStreak && isUser && (
            <span aria-hidden="true" className="absolute bottom-0 -right-[6px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-brand-indigo" />
          )}
          {isLastInStreak && !isUser && !isSkillError && (
            <span aria-hidden="true" className="absolute bottom-0 -left-[6px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-white dark:border-r-card" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Streaming bubble ─────────────────────────────────────────────────────────
function StreamingBubble({ text, agent }: { text: string; agent: AiAgent }) {
  // No typing dots — the ActivityIndicator ("Thinking..." pill) covers the pre-token phase.
  if (!text) return null;
  return (
    <div className="flex justify-start">
      <div className="relative w-full" style={{ maxWidth: "100%" }}>
        <div className="px-3 pt-2 pb-1.5 text-[15px] relative rounded-2xl rounded-bl-none bg-white dark:bg-card text-gray-900 dark:text-foreground shadow-[0_2px_2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_2px_rgba(255,255,255,0.04)]">
          <div className="agent-markdown-content min-w-0 overflow-hidden">
            <MarkdownRenderer content={text} />
          </div>
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-brand-indigo/70 animate-pulse align-text-bottom" />
          <span aria-hidden="true" className="absolute bottom-0 -left-[6px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-white dark:border-r-card" />
        </div>
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
  activity,
  onConfirmDestructive,
  onCancelDestructive,
  onAbort,
  fullPage,
  selectedElement,
  onClearElement,
  selectionLocked,
  onToggleSelectionLock,
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
  activity?: { type: "thinking" | "tool"; tool?: string; label?: string; timestamp: number } | null;
  onConfirmDestructive?: () => void;
  onCancelDestructive?: () => void;
  onAbort?: () => void;
  fullPage?: boolean;
  selectedElement?: SelectedElementInfo | null;
  selectionLocked?: boolean;
  onToggleSelectionLock?: () => void;
  onClearElement?: () => void;
}) {
  const [input, setInput] = useState("");
  const [isMultiline, setIsMultiline] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ id: number; name: string; fileType?: string; thumbnailUrl?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0-100
  const [pendingVoiceFile, setPendingVoiceFile] = useState<{ id: number; name: string } | null>(null);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile for camera capture button
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Scroll to bottom on new messages/streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Auto-resize textarea + step font down as input grows. Runs whenever `input` changes
  // (keystrokes, voice transcription, slash command insertions, clears).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const maxH = Math.round(window.innerHeight * 0.5);
    // First reset font to base, then measure with that font, then pick the right size and re-measure.
    ta.style.fontSize = "17px";
    ta.style.lineHeight = "21px";
    ta.style.height = "auto";
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 21;
    const lines = Math.max(1, Math.round(ta.scrollHeight / lh));
    const fontPx = lines <= 2 ? 17 : lines <= 4 ? 15 : lines <= 6 ? 13 : 11;
    ta.style.fontSize = `${fontPx}px`;
    ta.style.lineHeight = `${fontPx + 4}px`;
    ta.style.height = "auto";
    const newH = Math.min(ta.scrollHeight, maxH);
    ta.style.height = `${newH}px`;
    // Multi-line = textarea taller than a single line at base font (21px line-height + small slack)
    setIsMultiline(newH > 26);
  }, [input]);

  // Auto-dismiss command feedback
  useEffect(() => {
    if (!commandFeedback) return;
    const t = setTimeout(() => setCommandFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [commandFeedback]);

  // Filter slash commands based on current input
  const filteredCommands = slashMenuOpen
    ? SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(input.split(" ")[0].toLowerCase()))
    : [];

  // Execute a slash command — returns true if handled
  const executeSlashCommand = useCallback((text: string): boolean => {
    const trimmed = text.trim().toLowerCase();
    const [cmd, ...args] = trimmed.split(/\s+/);

    if (cmd === "/new") {
      onNewSession();
      setCommandFeedback("Starting new conversation...");
      return true;
    }
    if (cmd === "/clear") {
      window.dispatchEvent(
        new CustomEvent("agent-delete-conversation", { detail: { agentId: agent.id } }),
      );
      setCommandFeedback("Conversation cleared.");
      return true;
    }
    if (cmd === "/model") {
      const MODEL_MAP: Record<string, string> = {
        sonnet: "claude-sonnet-4-20250514",
        opus: "claude-opus-4-20250514",
        haiku: "claude-haiku-4-5-20251001",
      };
      const modelKey = args[0];
      const modelId = modelKey ? MODEL_MAP[modelKey] : null;
      if (!modelId) {
        setCommandFeedback("Usage: /model sonnet | opus | haiku");
        return true;
      }
      window.dispatchEvent(
        new CustomEvent("agent-model-change", { detail: { agentId: agent.id, model: modelId } }),
      );
      setCommandFeedback(`Switched to ${modelKey}.`);
      return true;
    }
    if (cmd === "/thinking") {
      const validLevels = ["none", "low", "medium", "high"];
      const level = args[0];
      if (!level || !validLevels.includes(level)) {
        setCommandFeedback("Usage: /thinking none | low | medium | high");
        return true;
      }
      window.dispatchEvent(
        new CustomEvent("agent-thinking-change", { detail: { agentId: agent.id, thinkingLevel: level } }),
      );
      setCommandFeedback(`Thinking set to ${level}.`);
      return true;
    }
    if (cmd === "/page") {
      // Toggle — we don't know current state here, so just dispatch
      window.dispatchEvent(
        new CustomEvent("agent-page-awareness-toggle-request", { detail: { agentId: agent.id } }),
      );
      setCommandFeedback("Page awareness toggled.");
      return true;
    }
    if (cmd === "/help") {
      setCommandFeedback(
        SLASH_COMMANDS.map((c) => `${c.name}${c.args ? ` <${c.args}>` : ""} — ${c.description}`).join("\n"),
      );
      return true;
    }
    return false;
  }, [agent.id, onNewSession]);

  const handleSend = () => {
    if (!input.trim()) return;

    // Steering: if AI is responding, abort first then send new message
    if (streaming && onAbort) {
      onAbort();
    }

    // Check for slash commands
    if (input.trim().startsWith("/")) {
      const handled = executeSlashCommand(input.trim());
      if (handled) {
        setInput("");
        setSlashMenuOpen(false);
        return;
      }
    }

    let messageText = input.trim();
    if (selectedElement) {
      const el = selectedElement;
      const label = el.componentName || `<${el.tagName}>`;
      const snippet = el.textContent ? ` "${el.textContent.slice(0, 80)}"` : "";
      const meta: string[] = [];
      if (el.testId) meta.push(`testId=${el.testId}`);
      if (el.classes.length) meta.push(`classes=${el.classes.join(" ")}`);
      const metaLine = meta.length ? `\n<sub>${meta.join(" · ")}</sub>` : "";
      messageText += `\n\n> 📍 **${label}**${snippet}${metaLine}`;
    }
    const fileId = pendingFile?.id ?? pendingVoiceFile?.id;
    onSend(messageText, undefined, fileId);
    setInput("");
    setPendingFile(null);
    setPendingVoiceFile(null);
    setSlashMenuOpen(false);
  };

  // File upload handler — supports PDF, images, spreadsheets, camera capture
  const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".csv", ".xlsx", ".xls"];
  const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

  // Compress large images for mobile uploads (reduces upload time on slow connections)
  const compressImage = useCallback(async (file: File | Blob, fileName: string, maxDim = 2048, quality = 0.85): Promise<{ blob: Blob; name: string }> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim && file.size <= 2 * 1024 * 1024) {
          resolve({ blob: file, name: fileName });
          return;
        }
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve({ blob: file, name: fileName }); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve({ blob, name: fileName }) : resolve({ blob: file, name: fileName }),
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;

    // Determine file extension; camera captures may lack one
    let ext = file.name.includes(".") ? file.name.toLowerCase().substring(file.name.lastIndexOf(".")) : "";
    const isCameraCapture = !ext && file.type.startsWith("image/");
    if (isCameraCapture) ext = ".jpg";

    if (!ALLOWED_EXTENSIONS.includes(ext) && !isCameraCapture) {
      alert("Unsupported file type. Allowed: PDF, images (JPEG, PNG, GIF, WebP), spreadsheets (CSV, XLSX, XLS)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("File too large. Maximum size is 20MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      // Compress images on mobile to speed up upload over slow connections
      let uploadFile: Blob = file;
      let uploadName = isCameraCapture ? `photo-${Date.now()}.jpg` : file.name;
      const isImage = IMAGE_EXTENSIONS.includes(ext) || isCameraCapture;
      if (isImage && file.size > 1 * 1024 * 1024) {
        try {
          setUploadProgress(5);
          const compressed = await compressImage(file, uploadName);
          uploadFile = compressed.blob;
          uploadName = compressed.name;
        } catch { /* fall back to original */ }
      }

      setUploadProgress(10);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });

      setUploadProgress(30);

      // Use XMLHttpRequest for upload progress tracking (visible on mobile)
      const uploadResult = await new Promise<{ ok: boolean; data: Record<string, unknown> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/agent-conversations/${sessionId}/files`);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.withCredentials = true;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round(30 + (event.loaded / event.total) * 60);
            setUploadProgress(pct);
          }
        };

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, data });
          } catch {
            resolve({ ok: false, data: { message: "Invalid server response" } });
          }
        };
        xhr.onerror = () => reject(new Error("Network error — check your connection and try again."));
        xhr.ontimeout = () => reject(new Error("Upload timed out. Try a smaller file or check your connection."));
        xhr.timeout = 120000; // 2 min timeout for large files on mobile

        xhr.send(JSON.stringify({
          filename: uploadName,
          mimeType: file.type || "application/octet-stream",
          data: base64,
        }));
      });

      setUploadProgress(95);

      if (uploadResult.ok) {
        const fileRecord = uploadResult.data as { id: number; filename: string; fileType?: string; thumbnailUrl?: string };
        setPendingFile({
          id: fileRecord.id,
          name: fileRecord.filename,
          fileType: fileRecord.fileType,
          thumbnailUrl: fileRecord.thumbnailUrl,
        });
        setUploadProgress(100);
      } else {
        const errMsg = (uploadResult.data as { message?: string }).message || "Failed to upload file.";
        alert(errMsg);
      }
    } catch (err) {
      console.error("[AgentChat] File upload error:", err);
      const msg = err instanceof Error ? err.message : "Failed to upload file.";
      alert(msg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash menu navigation
    if (slashMenuOpen && filteredCommands.length > 0) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenuIndex((i) => (i <= 0 ? filteredCommands.length - 1 : i - 1));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenuIndex((i) => (i >= filteredCommands.length - 1 ? 0 : i + 1));
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const selected = filteredCommands[slashMenuIndex];
        if (selected) {
          setInput(selected.name + (selected.args ? " " : ""));
          setSlashMenuOpen(false);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }
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

  // Detect best supported audio MIME type for mobile compatibility
  // iOS Safari: supports mp4/aac but not webm
  // Android Chrome: supports webm/opus
  // Desktop: supports webm/opus
  const getSupportedMimeType = useCallback((): string | undefined => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4;codecs=aac",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/aac",
    ];
    for (const mime of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return undefined; // Let browser pick default
  }, []);

  // Voice recording — start capturing audio (mobile-compatible)
  const startRecording = useCallback(async () => {
    // Check if MediaRecorder is available
    if (typeof MediaRecorder === "undefined") {
      console.warn("[AgentChat] MediaRecorder not supported in this browser");
      setCommandFeedback("Voice recording is not supported in this browser.");
      return;
    }

    // Check if we're in a secure context (HTTPS or localhost)
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCommandFeedback("Microphone requires HTTPS. Try opening the app directly in your browser.");
      return;
    }

    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCommandFeedback("Microphone not supported in this browser environment.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Create recorder with best supported codec for this browser/platform
      const mimeType = getSupportedMimeType();
      const recorderOptions: MediaRecorderOptions = {};
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      audioChunksRef.current = [];

      console.log("[Voice Recording] Starting recording with mime type:", mimeType, "Recorder mime:", recorder.mimeType);

      recorder.ondataavailable = (e) => {
        console.log("[Voice Recording] Data available:", e.data.size, "bytes");
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // Handle unexpected errors (mobile browsers can interrupt recording)
      recorder.onerror = () => {
        console.error("[AgentChat] MediaRecorder error");
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setRecording(false);
        setRecordingDuration(0);
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

        // Build blob from chunks using the actual recorder mimeType
        const actualMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: actualMime });

        console.log("[Voice Recording] Audio chunks:", audioChunksRef.current.length, "Total size:", blob.size, "bytes");

        if (blob.size === 0) {
          console.warn("[Voice Recording] No audio data captured");
          setCommandFeedback("No audio recorded. Try speaking closer to the microphone.");
          return;
        }

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
                  mime_type: actualMime,
                  session_id: sessionId,
                }),
              });
              if (res.ok) {
                const data = await res.json() as { transcription: string; fileId?: number; filename?: string };
                console.log("[Voice Recording] Transcription response:", data);

                if (data.transcription) {
                  setInput(data.transcription);
                  textareaRef.current?.focus();
                }
                // Store voice file reference — use correct extension for platform
                const defaultExt = actualMime.includes("mp4") ? "voice-memo.mp4" : "voice-memo.webm";
                if (data.fileId) {
                  setPendingVoiceFile({ id: data.fileId, name: data.filename || defaultExt });
                }
              } else {
                const errorData = await res.json().catch(() => ({ message: "Unknown error" }));
                console.error("[Voice Recording] Server error:", res.status, errorData);
                setCommandFeedback(`Recording failed: ${errorData.message || "Server error"}`);
              }
            } catch (err) {
              console.error("[AgentChat] Transcription error:", err);
              setCommandFeedback("Transcription failed. Try again.");
            }
            setTranscribing(false);
          };
          reader.readAsDataURL(blob);
        } catch {
          setTranscribing(false);
        }
      };

      // Use shorter timeslice for better compatibility with embedded browsers
      const timeslice = 500; // 500ms intervals for better capture in Simple Browser
      recorder.start(timeslice);
      console.log("[Voice Recording] Started recording with", timeslice, "ms timeslice");
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingDuration(0);
      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err: any) {
      console.warn("[AgentChat] Microphone access denied or unavailable:", err);
      const msg = err?.name === "NotAllowedError"
        ? "Microphone permission denied. Check your browser settings."
        : err?.name === "NotFoundError"
          ? "No microphone found. Connect a microphone and try again."
          : `Microphone unavailable: ${err?.message || "unknown error"}`;
      setCommandFeedback(msg);
    }
  }, [sessionId, getSupportedMimeType]);

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
    <div className="flex flex-col h-full overflow-hidden bg-[#f5f5f5] dark:bg-[#1a1a2e]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain px-4 pt-4 pb-4">
        <div className="flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {messages.length === 0 && !streaming && !isCodeRunner && (
              <div className="flex justify-start">
                <div className="relative" style={{ maxWidth: "100%" }}>
                  <div className="px-3 pt-2 pb-2 text-[15px] relative bg-white dark:bg-card text-gray-900 dark:text-foreground rounded-2xl rounded-bl-none leading-relaxed shadow-[0_2px_2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_2px_rgba(255,255,255,0.04)]">
                    {`Hi! I'm the ${agent.name}. I can help craft and improve your campaign messages. Share a campaign name or paste a URL for me to reference.`}
                    <span aria-hidden="true" className="absolute bottom-0 -left-[6px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[6px] border-r-white dark:border-r-card" />
                  </div>
                </div>
              </div>
            )}
            {(() => {
              const visibleMsgs = messages.filter((msg) => (msg.role as string) !== "tool");
              return visibleMsgs.map((msg, i) => {
              const prevMsg = i > 0 ? visibleMsgs[i - 1] : null;
              const nextMsg = i < visibleMsgs.length - 1 ? visibleMsgs[i + 1] : null;
              const sameAsPrev = prevMsg?.role === msg.role;
              const isLastInStreak = !nextMsg || nextMsg.role !== msg.role;
              // For the very last message, if streaming follows (always AI), adjust
              const isLastBeforeStreaming = streaming && i === visibleMsgs.length - 1 && msg.role === "assistant";

              return (
                <div
                  key={msg.id ?? `msg-${i}`}
                  style={{ marginTop: i === 0 ? 0 : sameAsPrev ? 3 : 8 }}
                >
                  <MessageBubble
                    msg={msg}
                    agent={agent}
                    isLastInStreak={isLastBeforeStreaming ? false : isLastInStreak}
                    onApplyCampaign={undefined}
                  />
                </div>
              );
            });
            })()}
            {streaming && (
              <div style={{ marginTop: messages.filter((m) => (m.role as string) !== "tool").slice(-1)[0]?.role === "assistant" ? 3 : 8 }}>
                <StreamingBubble text={streamingText} agent={agent} />
                {activity && (
                  <div className="mt-1.5 ml-1">
                    <ActivityIndicator activity={activity} />
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
        </div>
      </div>

      {/* Input area */}
      <div className="px-3 pb-3 shrink-0">
        <div>
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
              className="ml-auto text-muted-foreground hover:text-foreground shrink-0 h-7 w-7 max-md:h-11 max-md:w-11 rounded-full flex items-center justify-center"
              title="Remove attachment"
            >
              <X className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
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
              className="ml-auto text-muted-foreground hover:text-foreground shrink-0 h-7 w-7 max-md:h-11 max-md:w-11 rounded-full flex items-center justify-center"
              title="Remove voice memo"
            >
              <X className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
            </button>
          </div>
        )}
        {/* Selected element indicator */}
        {selectedElement && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/30 rounded-lg text-[12px]">
            <MousePointerClick className="h-3.5 w-3.5 text-violet-500 shrink-0" />
            <span className="font-mono text-[11px] text-violet-700 dark:text-violet-300 shrink-0">
              {selectedElement.componentName || `<${selectedElement.tagName}>`}
            </span>
            {onToggleSelectionLock && (
              <button
                onClick={onToggleSelectionLock}
                className={cn(
                  "shrink-0 h-5 w-5 rounded flex items-center justify-center transition-colors",
                  selectionLocked
                    ? "text-violet-700 dark:text-violet-300 bg-violet-200/60 dark:bg-violet-800/40"
                    : "text-violet-500/70 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30",
                )}
                title={selectionLocked ? "Selection locked — click to unlock and pick another" : "Live picking — click to lock this selection"}
              >
                {selectionLocked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
              </button>
            )}
            {(selectedElement.textContent || selectedElement.testId) && (
              <span className="truncate text-foreground/60 text-[10px]">
                {selectedElement.textContent || selectedElement.testId}
              </span>
            )}
            <button
              onClick={onClearElement}
              className="ml-auto text-muted-foreground hover:text-foreground shrink-0 h-7 w-7 max-md:h-11 max-md:w-11 rounded-full flex items-center justify-center"
              title="Remove element selection"
            >
              <X className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
            </button>
          </div>
        )}
        {uploading && (
          <div className="mb-2 px-3 py-1.5 text-[12px] text-muted-foreground" data-testid="upload-progress">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>{uploadProgress < 30 ? "Preparing file…" : uploadProgress < 90 ? "Uploading…" : "Processing…"}</span>
              <span className="ml-auto tabular-nums font-medium">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-indigo rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
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

        {/* Slash command autocomplete menu */}
        {slashMenuOpen && filteredCommands.length > 0 && (
          <div className="mb-1 bg-white dark:bg-card border border-border/60 rounded-xl shadow-lg overflow-hidden">
            {filteredCommands.map((cmd, i) => (
              <button
                key={cmd.name}
                onClick={() => {
                  setInput(cmd.name + (cmd.args ? " " : ""));
                  setSlashMenuOpen(false);
                  textareaRef.current?.focus();
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors",
                  i === slashMenuIndex ? "bg-brand-indigo/10 text-brand-indigo" : "hover:bg-muted/50 text-foreground",
                )}
              >
                <span className="font-mono font-semibold shrink-0">{cmd.name}</span>
                {cmd.args && <span className="text-muted-foreground/60 text-[10px]">{cmd.args}</span>}
                <span className="ml-auto text-muted-foreground text-[10px] truncate">{cmd.description}</span>
              </button>
            ))}
          </div>
        )}

        {/* Command feedback toast */}
        {commandFeedback && (
          <div className="mb-1 px-3 py-2 bg-brand-indigo/5 border border-brand-indigo/20 rounded-xl text-[11px] text-brand-indigo whitespace-pre-line">
            {commandFeedback}
          </div>
        )}

        <div className={cn(
          "bg-white dark:bg-card rounded-lg border border-black/[0.1] dark:border-border/30 shadow-sm px-3 min-h-[62px]",
          isMultiline ? "flex flex-col pt-2 pb-1.5" : "flex items-center gap-1.5 py-1.5",
        )}>
          {/* Hidden file input — file picker (documents, images from gallery) */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.csv,.xlsx,.xls,application/pdf,image/*,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Hidden camera input — direct camera capture on mobile */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              if (val.startsWith("/") && !val.includes("\n")) {
                setSlashMenuOpen(true);
                setSlashMenuIndex(0);
              } else {
                setSlashMenuOpen(false);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={recording ? "Recording..." : isCodeRunner ? "Type / for commands..." : "Ask about campaigns..."}
            rows={1}
            disabled={loading || recording}
            className="w-full bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 px-0.5"
            style={{ maxHeight: "50vh", fontSize: "17px", lineHeight: "21px" }}
          />

          <div className={cn(
            "flex items-center gap-1.5 shrink-0",
            isMultiline && "justify-end mt-1 self-end",
          )}>
            {/* Attach file button (hidden during recording to keep the bar clean) */}
            {!recording && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || loading || uploading}
                className="h-8 w-8 max-md:h-10 max-md:w-10 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-40 shrink-0 transition-colors"
                title={isMobile ? "Attach file or photo" : "Attach file (PDF, image, or spreadsheet)"}
                data-testid="attach-file-btn"
              >
                <Paperclip className="h-4 w-4 max-md:h-5 max-md:w-5" />
              </button>
            )}

            {/* Stop button — visible during streaming when no text input */}
            {streaming && !input.trim() && !recording && onAbort && (
              <button
                onClick={onAbort}
                className="h-8 w-8 max-md:h-10 max-md:w-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shrink-0 transition-colors"
                title="Stop response"
                data-testid="stop-button"
              >
                <Square className="h-3 w-3 max-md:h-4 max-md:w-4 fill-white" />
              </button>
            )}

            {/* Send / Mic / Recording group */}
            {input.trim() ? (
              <button
                onClick={handleSend}
                disabled={loading}
                className={cn(
                  "h-8 w-8 max-md:h-10 max-md:w-10 rounded-full text-white flex items-center justify-center shrink-0 transition-colors",
                  streaming ? "bg-orange-500 hover:bg-orange-600" : "bg-brand-indigo hover:bg-brand-indigo/90",
                  loading && "opacity-40",
                )}
                data-testid="send-button"
                title={streaming ? "Interrupt & send" : "Send message"}
              >
                <Send className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
              </button>
            ) : transcribing ? (
              <button
                disabled
                className="h-8 w-8 max-md:h-10 max-md:w-10 rounded-full bg-brand-indigo/40 text-white flex items-center justify-center shrink-0"
              >
                <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              </button>
            ) : recording ? (
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Discard recording */}
                <button
                  onClick={cancelRecording}
                  className="h-8 w-8 max-md:h-10 max-md:w-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0 transition-colors"
                  data-testid="recording-cancel"
                  title="Discard recording"
                >
                  <Trash2 className="h-4 w-4 max-md:h-5 max-md:w-5" />
                </button>
                {/* Expanded mic pill: timer + send-on-click */}
                <button
                  onClick={stopRecording}
                  className="h-8 max-md:h-10 px-3 rounded-full bg-red-500 text-white flex items-center gap-2 hover:bg-red-600 shrink-0 transition-colors"
                  style={{ animation: "micPulseAgent 1s ease-in-out infinite" }}
                  data-testid="mic-stop-button"
                  title="Stop recording and transcribe"
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                  <span className="text-[12px] font-mono tabular-nums" data-testid="recording-duration">
                    {formatDuration(recordingDuration)}
                  </span>
                  <style>{`@keyframes micPulseAgent { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }`}</style>
                </button>
              </div>
            ) : (
              <button
                onClick={startRecording}
                disabled={loading}
                className="h-8 w-8 max-md:h-10 max-md:w-10 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
                data-testid="mic-button"
              >
                <Mic className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
              </button>
            )}
          </div>
        </div>
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
