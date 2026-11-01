import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { hapticSend } from "@/lib/haptics";
import { Loader2 } from "lucide-react";
import { type FounderMessage } from "@/hooks/useFounderChat";
import {
  DateSeparator,
  ChatBubble,
  getDateKey,
  formatDateLabel,
} from "./SupportChatHelpers";
import { SupportChatInput } from "./SupportChatInput";
import { SupportChatHeader } from "./SupportChatHeader";

// ─── Founder chat props ──────────────────────────────────────────────────────
export interface FounderChatProps {
  messages: FounderMessage[];
  sending: boolean;
  loading: boolean;
  initialize: () => void;
  sendMessage: (text: string) => void;
  closeSession: () => void;
  clearContext: () => Promise<void>;
}

// ─── Props interface ───────────────────────────────────────────────────────────
// The floating "Talk to Gabriel" chat: founder direct messages, no AI.
interface SupportChatWidgetProps {
  founderChat: FounderChatProps;
  isAdmin: boolean;
  onClose: () => void;
  /** Text to put in the input (not sent), e.g. a "Request a change" draft. */
  initialDraft?: string;
  onDraftUsed?: () => void;
}

// ─── Main widget ──────────────────────────────────────────────────────────────
export function SupportChatWidget({
  founderChat,
  isAdmin,
  onClose,
  initialDraft,
  onDraftUsed,
}: SupportChatWidgetProps) {
  const { messages, sending, loading, initialize, sendMessage } = founderChat;

  const [input, setInput] = useState("");
  useEffect(() => {
    if (!initialDraft) return;
    setInput(initialDraft);
    onDraftUsed?.();
    textareaRef.current?.focus();
  }, [initialDraft]); // eslint-disable-line react-hooks/exhaustive-deps
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Voice recording: sent as a voice memo (no transcription)
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canceledRef = useRef(false);

  const stopRecordTimer = () => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      canceledRef.current = false;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopRecordTimer();
        setRecordingSeconds(0);
        setRecording(false);
        // Discarded by the cancel (red bin) button: drop it, send nothing.
        if (canceledRef.current) { canceledRef.current = false; return; }
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (dataUrl) sendMessage(dataUrl);
        };
        reader.readAsDataURL(blob);
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

  // File attachment: sends the picked file as a data-URL message.
  const attachInputRef = useRef<HTMLInputElement>(null);
  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) sendMessage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

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
    sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Closing only hides the panel: the conversation stays open, so Gabriel still sees it
  // in his inbox and the person finds it again next time.
  const handleClose = () => {
    onClose();
  };

  // Pre-compute render items (date separators + messages)
  const renderItems: Array<
    | { type: "date"; label: string; key: string }
    | { type: "msg"; msg: FounderMessage; isFirstInGroup: boolean; key: string }
  > = [];

  let lastDateKey = "";
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const dk = getDateKey(msg.createdAt);
    if (dk && dk !== lastDateKey) {
      const label = formatDateLabel(msg.createdAt!);
      if (label) renderItems.push({ type: "date", label, key: `date-${dk}` });
      lastDateKey = dk;
    }
    const prev = i > 0 ? messages[i - 1] : null;
    const isFirstInGroup = !prev || prev.role !== msg.role;
    renderItems.push({ type: "msg", msg, isFirstInGroup, key: String(msg.id ?? `msg-${i}`) });
  }

  return (
    <section
      className={
        // Mobile: fill the screen but stop above the bottom footer bar (don't overlay it).
        // Desktop (md+): floating card anchored bottom-right.
        "flex flex-col overflow-hidden fixed z-[110] shadow-xl border border-border/40 dark:border-border/20 top-0 left-0 right-0 bottom-[var(--bottombar-h)] rounded-none md:z-[60] md:h-full md:inset-auto md:bottom-6 md:right-6 md:rounded-2xl md:w-[340px] md:max-h-[600px] md:min-h-[460px]"
      }
    >
      <div className="absolute inset-0 bg-white dark:bg-[#1c1c2e]" />

      <div className="relative flex flex-col h-full overflow-hidden">
        {/* ── Header ── */}
        <SupportChatHeader isAgencyUser={isAdmin} handleClose={handleClose} />

        {/* ── Messages area ── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col gap-1.5"
        >
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            </div>
          ) : (
            <>
              {messages.length === 0 && (
                <div className="flex flex-col items-start">
                  <div className="flex gap-1.5 justify-start">
                    <div className="max-w-[80%] px-3 pt-2 pb-2 bg-white dark:bg-card text-foreground rounded-lg rounded-bl-none text-[13px] leading-relaxed shadow-sm">
                      Hi! I'm Gabriel, the founder of Lead Awaker. Send me a message and I'll get back to you as soon as I can.
                    </div>
                  </div>
                </div>
              )}
              {renderItems.map((item) =>
                item.type === "date" ? (
                  <DateSeparator key={item.key} label={item.label} />
                ) : (
                  <ChatBubble key={item.key} msg={item.msg} isFirstInGroup={item.isFirstInGroup} />
                ),
              )}
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
          activeSending={sending}
          activeLoading={loading}
          sending={sending}
          recording={recording}
          transcribing={false}
          handleTextareaChange={handleTextareaChange}
          handleKeyDown={handleKeyDown}
          handleSend={handleSend}
          startRecording={startRecording}
          stopRecording={stopRecording}
          recordingSeconds={recordingSeconds}
          cancelRecording={cancelRecording}
          onAttachClick={() => attachInputRef.current?.click()}
          loading={loading}
          founderOnly
        />
        <input ref={attachInputRef} type="file" className="hidden" onChange={handleAttachFile} />
      </div>
    </section>
  );
}
