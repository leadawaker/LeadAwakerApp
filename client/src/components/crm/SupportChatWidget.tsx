import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { hapticSend } from "@/lib/haptics";
import { Headphones, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SupportChatMessage, type SupportBotConfig } from "@/hooks/useSupportChat";
import { useChatDoodle } from "@/hooks/useChatDoodle";
import { useTheme } from "@/hooks/useTheme";
import { getDoodleStyle } from "@/components/ui/doodle-patterns";
import { useBgSlotLayers, saveSlotLayers } from "@/hooks/useBgSlots";
import { layerToStyle } from "@/components/ui/gradient-tester";
import { BotPhotoCropModal } from "./BotPhotoCropModal";
import {
  TypingDots,
  DateSeparator,
  BotAvatarFull,
  ChatBubble,
  getDateKey,
  formatDateLabel,
} from "./SupportChatHelpers";
import { SupportChatInput } from "./SupportChatInput";
import { SupportChatHeader } from "./SupportChatHeader";

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
            : "fixed bottom-6 right-6 z-[60] rounded-2xl w-[340px] max-h-[600px] min-h-[460px] shadow-xl border border-border/40 dark:border-border/20",
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
        {!isInline && <div className="absolute inset-0 bg-white dark:bg-[#1c1c2e]" />}

        {/* ── Content above gradient ── */}
        <div className="relative flex flex-col h-full overflow-hidden">

          {/* ── Header ── */}
          <SupportChatHeader
            channel={channel}
            setChannel={setChannel}
            botConfig={botConfig}
            isInline={isInline}
            isAgencyUser={isAgencyUser}
            founderChat={founderChat}
            botPhotoInputRef={botPhotoInputRef}
            handlePhotoChange={handlePhotoChange}
            editingName={editingName}
            nameInput={nameInput}
            setNameInput={setNameInput}
            saveEditName={saveEditName}
            handleNameKeyDown={handleNameKeyDown}
            startEditName={startEditName}
            handleClearContext={handleClearContext}
            clearing={clearing}
            loading={loading}
            doodleConfig={doodleConfig}
            setDoodleConfig={setDoodleConfig}
            handleClose={handleClose}
            onOpenInChats={onOpenInChats}
            aiAgents={aiAgents}
            onOpenAgent={onOpenAgent}
          />

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

          {/* ── Input bar ── */}
          <SupportChatInput
            input={input}
            setInput={setInput}
            textareaRef={textareaRef}
            emojiOpen={emojiOpen}
            setEmojiOpen={setEmojiOpen}
            activeSending={activeSending}
            activeLoading={activeLoading}
            sending={sending}
            recording={recording}
            transcribing={transcribing}
            handleTextareaChange={handleTextareaChange}
            handleKeyDown={handleKeyDown}
            handleSend={handleSend}
            startRecording={startRecording}
            stopRecording={stopRecording}
          />

        </div>
      </section>
    </>
  );
}
