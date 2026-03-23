import { useState, useRef, useEffect, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { hapticSend } from "@/lib/haptics";
import { Send, Headphones, Loader2, X, Maximize2, Camera, Pencil, Eraser, Smile, Paperclip, Wallpaper, Mic, Square, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SupportChatMessage, type SupportBotConfig } from "@/hooks/useSupportChat";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useChatDoodle, type ChatBgStyle } from "@/hooks/useChatDoodle";
import { useTheme } from "@/hooks/useTheme";
import { getDoodleStyle, CURATED_PATTERNS } from "@/components/ui/doodle-patterns";
import { useBgSlotLayers, saveSlotLayers } from "@/hooks/useBgSlots";
import { layerToStyle } from "@/components/ui/gradient-tester";

// ─── Bot Photo Crop Modal ─────────────────────────────────────────────────────
function BotPhotoCropModal({ srcUrl, onSave, onCancel }: {
  srcUrl: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const PREVIEW = 240;
  const OUTPUT = 128;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    const img = new globalThis.Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(Math.min(PREVIEW / img.width, PREVIEW / img.height));
      setOffset({ x: 0, y: 0 });
    };
    img.src = srcUrl;
  }, [srcUrl]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    const w = img.width * zoom;
    const h = img.height * zoom;
    ctx.drawImage(img, (PREVIEW - w) / 2 + offset.x, (PREVIEW - h) / 2 + offset.y, w, h);
  }, [zoom, offset]);

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = OUTPUT; out.height = OUTPUT;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const f = OUTPUT / PREVIEW;
    const w = img.width * zoom * f;
    const h = img.height * zoom * f;
    ctx.drawImage(img, (OUTPUT - w) / 2 + offset.x * f, (OUTPUT - h) / 2 + offset.y * f, w, h);
    onSave(out.toDataURL("image/jpeg", 0.85));
  };

  const onMouseDown = (e: ReactMouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: ReactMouseEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.x,
      y: dragStart.current.oy + e.clientY - dragStart.current.y,
    });
  };
  const onMouseUp = () => { dragging.current = false; };

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Crop Bot Photo</DialogTitle>
          <DialogDescription>Drag to reposition · use slider to zoom</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-full overflow-hidden ring-2 ring-brand-indigo/20" style={{ width: PREVIEW, height: PREVIEW }}>
            <canvas
              ref={canvasRef}
              width={PREVIEW}
              height={PREVIEW}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          </div>
          <div className="flex items-center gap-3 w-full px-2">
            <button type="button"
              onClick={() => setZoom((z) => Math.max(0.05, parseFloat((z - 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">−</button>
            <input type="range" min="0.05" max="8" step="0.05" value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand-indigo" />
            <button type="button"
              onClick={() => setZoom((z) => Math.min(8, parseFloat((z + 0.1).toFixed(2))))}
              className="h-6 w-6 rounded-full flex items-center justify-center text-[14px] font-bold text-muted-foreground hover:bg-muted transition-colors select-none shrink-0">+</button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave}>Save Photo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-end gap-1.5">
      <div className="h-9 w-9 shrink-0" />
      <div className="relative">
        <div className="flex items-center gap-1 px-3.5 py-2.5 bg-white dark:bg-card rounded-lg rounded-tl-none w-fit shadow-sm">
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
            @keyframes micPulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
              50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}

// ─── Time/date helpers ────────────────────────────────────────────────────────
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
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return null;
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}

// ─── Date separator pill ──────────────────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-1.5">
      <span className="text-[10px] font-medium text-white bg-black/70 rounded-full px-3 py-0.5">
        {label}
      </span>
    </div>
  );
}

// ─── Bot avatar (36px, matching EntityAvatar standard) ───────────────────────
function BotAvatarFull({ config, size = 36 }: { config: SupportBotConfig; size?: number }) {
  return (
    <div
      className="rounded-full shrink-0 overflow-hidden flex items-center justify-center bg-brand-indigo/10"
      style={{ width: size, height: size }}
    >
      {config.photoUrl ? (
        <img src={config.photoUrl} alt={config.name} className="w-full h-full object-cover" />
      ) : (
        <Headphones className="text-brand-indigo" style={{ width: size * 0.44, height: size * 0.44 }} />
      )}
    </div>
  );
}

// ─── Single message bubble ────────────────────────────────────────────────────
function FounderAvatarFull({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/founder-photo.webp"
      alt="Gabriel"
      className="rounded-full shrink-0 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function ChatBubble({
  msg,
  botConfig,
  isFirstInGroup,
  avatarSize,
  showBubbleAvatar,
  activeChannel,
}: {
  msg: SupportChatMessage;
  botConfig: SupportBotConfig;
  isFirstInGroup: boolean;
  avatarSize: number;
  showBubbleAvatar: boolean;
  activeChannel: "bot" | "founder";
}) {
  const isUser = msg.role === "user";
  const time = formatTime(msg.createdAt);

  const bubbleRadius = isUser
    ? isFirstInGroup ? "rounded-lg rounded-tr-none" : "rounded-lg"
    : isFirstInGroup ? "rounded-lg rounded-tl-none" : "rounded-lg";

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div className={cn("flex gap-1.5", isUser ? "justify-end" : "justify-start")}>
        {showBubbleAvatar && !isUser && isFirstInGroup && (
          activeChannel === "founder" ? <FounderAvatarFull size={avatarSize} /> : <BotAvatarFull config={botConfig} size={avatarSize} />
        )}
        {showBubbleAvatar && !isUser && !isFirstInGroup && <div style={{ width: avatarSize }} className="shrink-0" />}
        <div
          className={cn(
            "max-w-[80%] px-3 pt-2 pb-1 text-[13px] leading-relaxed whitespace-pre-wrap shadow-sm",
            bubbleRadius,
            isUser ? "bg-brand-indigo text-white" : "bg-white dark:bg-card text-foreground",
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

// ─── Founder chat props ──────────────────────────────────────────────────────
export interface FounderChatProps {
  messages: SupportChatMessage[];
  sending: boolean;
  loading: boolean;
  initialize: () => void;
  sendMessage: (text: string) => void;
  closeSession: () => void;
  clearContext: () => Promise<void>;
}

// ─── Props interface ───────────────────────────────────────────────────────────
interface SupportChatWidgetProps {
  messages: SupportChatMessage[];
  sending: boolean;
  loading: boolean;
  escalated: boolean;
  botConfig: SupportBotConfig;
  initialize: () => void;
  sendMessage: (text: string) => void;
  closeSession: () => void;
  clearContext: () => Promise<void>;
  updateBotConfig: (updates: Partial<SupportBotConfig>) => Promise<void>;
  isAdmin: boolean;
  onClose: () => void;
  /** "floating" = fixed bottom-right bubble (default). "inline" = fills its container. */
  mode?: "floating" | "inline";
  /** Only used in floating mode: navigates to the Chats page with the support tab active. */
  onOpenInChats?: () => void;
  /** AI agents to show in "Switch to:" footer links (agency users only) */
  aiAgents?: { id: number; name: string }[];
  /** Called when user clicks "Switch to: [Agent]" in the footer */
  onOpenAgent?: (id: number) => void;
  /** Founder direct message channel */
  founderChat?: FounderChatProps;
}

// ─── Main widget ──────────────────────────────────────────────────────────────
export function SupportChatWidget({
  messages,
  sending,
  loading,
  escalated,
  botConfig,
  initialize,
  sendMessage,
  closeSession,
  clearContext,
  updateBotConfig,
  isAdmin,
  onClose,
  mode = "floating",
  onOpenInChats,
  aiAgents,
  onOpenAgent,
  founderChat,
}: SupportChatWidgetProps) {
  const isAgencyUser = isAdmin;
  const isInline = mode === "inline";

  const [channel, setChannel] = useState<"bot" | "founder">("bot");
  const founderInitializedRef = useRef(false);

  // Listen for external channel-switch events (from InboxPanel navigation)
  useEffect(() => {
    const toFounder = () => { if (founderChat) setChannel("founder"); };
    const toBot = () => setChannel("bot");
    window.addEventListener("switch-to-founder-channel", toFounder);
    window.addEventListener("switch-to-bot-channel", toBot);
    return () => {
      window.removeEventListener("switch-to-founder-channel", toFounder);
      window.removeEventListener("switch-to-bot-channel", toBot);
    };
  }, [founderChat]);

  // When switching to founder channel, initialize it
  useEffect(() => {
    if (channel === "founder" && founderChat && !founderInitializedRef.current) {
      founderInitializedRef.current = true;
      founderChat.initialize();
    }
  }, [channel, founderChat]);

  // Active channel data
  const activeMessages = channel === "founder" && founderChat ? founderChat.messages : messages;
  const activeSending = channel === "founder" && founderChat ? founderChat.sending : sending;
  const activeLoading = channel === "founder" && founderChat ? founderChat.loading : loading;
  const activeSendMessage = channel === "founder" && founderChat ? founderChat.sendMessage : sendMessage;
  const activeClearContext = channel === "founder" && founderChat ? founderChat.clearContext : clearContext;

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Inline bot config editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const botPhotoInputRef = useRef<HTMLInputElement>(null);
  const [clearing, setClearing] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  // Background / doodle — shared with ChatPanel via localStorage
  const { isDark } = useTheme();
  const { config: doodleConfig, setConfig: setDoodleConfig } = useChatDoodle();
  const activeSlotLayers = useBgSlotLayers(doodleConfig.bgStyle !== "crm" ? doodleConfig.bgStyle : "social1", isDark);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, activeSending]);

  useEffect(() => {
    if (!loading) textareaRef.current?.focus();
  }, [loading]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    hapticSend();
    activeSendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    if (channel === "founder" && founderChat) {
      founderChat.closeSession();
    } else {
      closeSession();
    }
    onClose();
  };

  const handleClearContext = async () => {
    setClearing(true);
    try {
      await activeClearContext();
    } finally {
      setClearing(false);
    }
  };

  // Inline name editing
  const startEditName = () => {
    setNameInput(botConfig.name);
    setEditingName(true);
  };
  const saveEditName = async () => {
    const name = nameInput.trim() || "Tom";
    setEditingName(false);
    await updateBotConfig({ name });
  };
  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveEditName();
    if (e.key === "Escape") setEditingName(false);
  };

  // Photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) setCropSrc(dataUrl);
    };
    reader.readAsDataURL(file);
    if (botPhotoInputRef.current) botPhotoInputRef.current.value = "";
  };

  // Pre-compute render items (date separators + messages)
  const renderItems: Array<
    | { type: "date"; label: string; key: string }
    | { type: "msg"; msg: SupportChatMessage; isFirstInGroup: boolean; key: string }
  > = [];

  let lastDateKey = "";
  for (let i = 0; i < activeMessages.length; i++) {
    const msg = activeMessages[i];
    const dk = getDateKey(msg.createdAt);
    if (dk && dk !== lastDateKey) {
      const label = formatDateLabel(msg.createdAt!);
      if (label) renderItems.push({ type: "date", label, key: `date-${dk}` });
      lastDateKey = dk;
    }
    const prev = i > 0 ? activeMessages[i - 1] : null;
    const isFirstInGroup = !prev || prev.role !== msg.role;
    renderItems.push({ type: "msg", msg, isFirstInGroup, key: String(msg.id ?? `msg-${i}`) });
  }

  // Avatar size: 36px for inline (full chat), 28px for floating (compact)
  const avatarSize = isInline ? 36 : 28;
  // In inline mode the header already shows the bot — don't repeat avatar on every bubble
  const showBubbleAvatar = !isInline;

  return (
    <>
      {/* Crop modal (portal — renders above everything) */}
      {cropSrc && isAgencyUser && (
        <BotPhotoCropModal
          srcUrl={cropSrc}
          onSave={async (dataUrl) => {
            setCropSrc(null);
            await updateBotConfig({ photoUrl: dataUrl });
          }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <section
        className={cn(
          "flex flex-col overflow-hidden relative h-full",
          isInline
            ? "rounded-lg"
            : "fixed bottom-6 right-6 z-[60] rounded-2xl w-[340px] max-h-[600px] min-h-[460px] shadow-xl border border-black/[0.08]",
        )}
      >
        {/* ── Gradient background (inline only — floating keeps plain bg) ── */}
        {isInline && (
          <>
            {doodleConfig.bgStyle === "crm" && (
              <div className="absolute inset-0 bg-card" />
            )}
            {doodleConfig.bgStyle !== "crm" && activeSlotLayers.map(layer => {
              const style = layerToStyle(layer);
              if (!style) return null;
              return <div key={layer.id} className="absolute inset-0" style={style} />;
            })}
            {doodleConfig.enabled && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={getDoodleStyle(doodleConfig.patternId, doodleConfig.color, doodleConfig.size, isDark ? 100 : 0, isDark ? "screen" : "multiply")}
              />
            )}
          </>
        )}

        {/* Floating mode: plain bg */}
        {!isInline && <div className="absolute inset-0 bg-white" />}

        {/* ── Content above gradient ── */}
        <div className="relative flex flex-col h-full overflow-hidden">

          {/* ── Header — matches ChatPanel exactly ── */}
          <div className="shrink-0 bg-white dark:bg-card border-b border-black/[0.06]">
            {/* ── Channel tabs (floating mode only — inline uses InboxPanel for navigation) ── */}
            {founderChat && !isInline && (
              <div className="px-4 pt-3 pb-0 flex gap-1">
                <button
                  onClick={() => setChannel("bot")}
                  className={cn(
                    "flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-t-lg transition-colors",
                    channel === "bot"
                      ? "bg-white dark:bg-card text-foreground border border-b-0 border-black/[0.08]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Headphones className="h-3.5 w-3.5" />
                  {botConfig.name}
                </button>
                <button
                  onClick={() => setChannel("founder")}
                  className={cn(
                    "flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-t-lg transition-colors",
                    channel === "founder"
                      ? "bg-white dark:bg-card text-foreground border border-b-0 border-black/[0.08]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  Gabriel (Founder)
                </button>
              </div>
            )}

            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-3">

                {/* Avatar */}
                {channel === "founder" ? (
                  <img
                    src="/founder-photo.webp"
                    alt="Gabriel"
                    className="rounded-full shrink-0 object-cover"
                    style={{ width: isInline ? 45 : 36, height: isInline ? 45 : 36 }}
                  />
                ) : (
                  <div
                    className={cn("relative shrink-0", isAgencyUser && "group cursor-pointer")}
                    onClick={() => isAgencyUser && botPhotoInputRef.current?.click()}
                    title={isAgencyUser ? "Change bot photo" : undefined}
                  >
                    <BotAvatarFull config={botConfig} size={isInline ? 45 : 36} />
                    {isAgencyUser && (
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Camera className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {isAgencyUser && (
                      <input
                        ref={botPhotoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                    )}
                  </div>
                )}

                {/* Name */}
                <div className="min-w-0 flex-1">
                  {channel === "founder" ? (
                    <>
                      <p className={cn(
                        "font-semibold text-foreground leading-tight truncate",
                        isInline ? "text-[27px] font-heading" : "text-[15px]"
                      )}>
                        Gabriel Barbosa Fronza
                      </p>
                      {!isInline && (
                        <p className="text-[11px] text-muted-foreground leading-tight">Founder, Lead Awaker</p>
                      )}
                    </>
                  ) : (
                    <>
                      {editingName ? (
                        <input
                          autoFocus
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          onBlur={saveEditName}
                          onKeyDown={handleNameKeyDown}
                          className={cn(
                            "font-semibold bg-transparent border-b border-brand-indigo outline-none w-full text-foreground leading-tight",
                            isInline ? "text-[27px] font-heading" : "text-[15px]"
                          )}
                        />
                      ) : (
                        <div
                          className={cn("flex items-center gap-1", isAgencyUser && "group cursor-pointer")}
                          onClick={() => isAgencyUser && startEditName()}
                          title={isAgencyUser ? "Click to rename" : undefined}
                        >
                          <p className={cn(
                            "font-semibold text-foreground leading-tight truncate",
                            isInline ? "text-[27px] font-heading" : "text-[15px]"
                          )}>
                            {botConfig.name}
                          </p>
                          {isAgencyUser && (
                            <Pencil className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      )}
                      {!isInline && (
                        <p className="text-[11px] text-muted-foreground leading-tight">Support Assistant</p>
                      )}
                    </>
                  )}
                </div>

                {/* Action buttons cluster */}
                <div className={cn("flex items-center gap-1.5", isInline ? "ml-6" : "ml-auto")}>
                  {/* Clear context */}
                  <button
                    onClick={handleClearContext}
                    disabled={clearing || loading}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                    title="Clear conversation"
                  >
                    {clearing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eraser className="h-4 w-4" />
                    )}
                  </button>

                  {/* Wallpaper button (inline only) */}
                  {isInline && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Chat background"
                        >
                          <Wallpaper className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 p-3 space-y-3">
                        {/* Background style picker */}
                        <div className="space-y-1.5">
                          <span className="text-[12px] font-semibold">Background</span>
                          <div className="grid grid-cols-5 gap-1">
                            {(["crm", "social1", "social2", "social3", "social4"] as ChatBgStyle[]).map((style) => (
                              <button
                                key={style}
                                type="button"
                                onClick={() => setDoodleConfig({ bgStyle: style })}
                                className={cn(
                                  "h-8 rounded-md border text-[10px] font-medium transition-colors",
                                  doodleConfig.bgStyle === style || (!doodleConfig.bgStyle && style === "social1")
                                    ? "border-brand-indigo text-brand-indigo bg-brand-indigo/5"
                                    : "border-black/[0.125] text-foreground/60 hover:text-foreground hover:border-black/[0.175]"
                                )}
                              >
                                {style === "crm" ? "CRM" : `#${style.replace("social", "")}`}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-semibold">Doodle Overlay</span>
                          <Switch
                            checked={doodleConfig.enabled}
                            onCheckedChange={(enabled) => setDoodleConfig({ enabled })}
                          />
                        </div>
                        {doodleConfig.enabled && (
                          <>
                            {/* Pattern picker — slider 1–10 */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">Pattern</span>
                                <span className="text-[11px] font-semibold tabular-nums text-foreground/70">
                                  #{(CURATED_PATTERNS.findIndex(p => p.id === doodleConfig.patternId) + 1) || 1}
                                </span>
                              </div>
                              <Slider
                                value={[(CURATED_PATTERNS.findIndex(p => p.id === doodleConfig.patternId) + 1) || 1]}
                                onValueChange={([v]) => {
                                  const entry = CURATED_PATTERNS[v - 1];
                                  if (entry) setDoodleConfig({ patternId: entry.id, size: entry.size });
                                }}
                                min={1}
                                max={10}
                                step={1}
                              />
                            </div>
                            {/* Opacity slider */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">Opacity</span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">{doodleConfig.color}%</span>
                              </div>
                              <Slider
                                value={[doodleConfig.color]}
                                onValueChange={([v]) => setDoodleConfig({ color: v })}
                                min={0} max={100} step={1}
                              />
                            </div>
                          </>
                        )}
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Open in Chats (floating mode only) */}
                  {!isInline && onOpenInChats && (
                    <button
                      onClick={onOpenInChats}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                      title="Open in Chats"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  )}

                  {/* Close (floating mode only) */}
                  {!isInline && (
                    <button
                      onClick={handleClose}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                      title="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Agent switcher tabs (agency users — header row) ── */}
            {isAgencyUser && aiAgents && aiAgents.length > 0 && (
              <div className="px-4 pb-2.5 flex items-center gap-1.5 flex-wrap">
                {aiAgents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onOpenAgent?.(a.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border border-black/[0.1] text-foreground/60 hover:text-brand-indigo hover:border-brand-indigo/30 hover:bg-brand-indigo/5 transition-colors"
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Escalation banner — top of chat view (bot channel only) ── */}
          {escalated && channel === "bot" && (
            <div
              className="px-4 py-2.5 border-b border-brand-indigo/30 bg-brand-indigo/10 shrink-0 flex items-center gap-2"
              data-testid="escalation-banner"
            >
              <Headphones className="h-4 w-4 text-brand-indigo shrink-0" />
              <p className="text-[12px] text-brand-indigo font-semibold leading-tight">
                You&apos;re now chatting with a support agent
              </p>
            </div>
          )}

          {/* ── Messages area ── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col gap-1.5"
          >
            {activeLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            ) : (
              <>
                {activeMessages.length === 0 && (
                  <div className="flex flex-col items-start">
                    <div className="flex gap-1.5 justify-start">
                      {!isInline && channel === "bot" && <BotAvatarFull config={botConfig} size={avatarSize} />}
                      {!isInline && channel === "founder" && (
                        <div
                          className="rounded-full shrink-0 overflow-hidden flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30"
                          style={{ width: avatarSize, height: avatarSize }}
                        >
                          <User className="text-emerald-600 dark:text-emerald-400" style={{ width: avatarSize * 0.44, height: avatarSize * 0.44 }} />
                        </div>
                      )}
                      <div className="max-w-[80%] px-3 pt-2 pb-2 bg-white dark:bg-card text-foreground rounded-lg rounded-tl-none text-[13px] leading-relaxed shadow-sm">
                        {channel === "founder"
                          ? "Hi! I'm Gabriel, the founder of Lead Awaker. Send me a message and I'll get back to you as soon as I can."
                          : `Hi! I'm ${botConfig.name}, your Lead Awaker assistant. How can I help you today?`}
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
                      avatarSize={avatarSize}
                      showBubbleAvatar={showBubbleAvatar}
                      activeChannel={channel}
                    />
                  ),
                )}
                {activeSending && channel === "bot" && <TypingDots />}
              </>
            )}
          </div>

          {/* ── Input bar — matches ChatPanel compose area ── */}
          <div className="px-3 pb-3 shrink-0">
            <div className="flex items-end gap-1.5 bg-white dark:bg-card rounded-lg border border-black/[0.1] shadow-sm px-3 py-2">
              {/* Emoji button */}
              <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
                    title="Emoji"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2" align="start" side="top">
                  <div className="grid grid-cols-6 gap-0.5">
                    {["😀","😂","❤️","👍","🙏","🎉","🔥","✨","👏","💪","🤔","😊","😍","🙌","💯","🎯","✅","😄","🥰","😅","💡","🚀","🌟","💬","📱","💼","🎊","😎","🤝","❓"].map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          setInput((prev) => prev + e);
                          setEmojiOpen(false);
                          textareaRef.current?.focus();
                        }}
                        className="h-8 text-lg flex items-center justify-center rounded hover:bg-muted transition-colors"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                disabled={activeSending || activeLoading}
                className="flex-1 text-[13px] bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 leading-5 pl-1"
                style={{ minHeight: "32px", maxHeight: "120px" }}
              />

              {/* Attach stub */}
              <button
                type="button"
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
                title="Attach file (coming soon)"
                onClick={() => {}}
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {/* Send / Mic / Stop button */}
              {input.trim() ? (
                <button
                  onClick={handleSend}
                  disabled={activeSending || activeLoading}
                  className="h-9 w-9 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
                  title="Send message"
                >
                  {sending ? (
                    <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 text-white" />
                  )}
                </button>
              ) : transcribing ? (
                <button disabled className="h-9 w-9 rounded-full bg-brand-indigo/40 text-white flex items-center justify-center shrink-0">
                  <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                </button>
              ) : recording ? (
                <button
                  onClick={stopRecording}
                  className="h-9 w-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shrink-0 transition-colors"
                  title="Stop recording"
                  style={{ animation: "micPulse 1s ease-in-out infinite" }}
                >
                  <Square className="h-3.5 w-3.5 fill-white text-white" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={activeSending || activeLoading}
                  className="h-9 w-9 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
                  title="Record voice message"
                >
                  <Mic className="h-4 w-4 text-white" />
                </button>
              )}
            </div>
          </div>


        </div>
      </section>
    </>
  );
}
