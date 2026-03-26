import { type RefObject, type KeyboardEvent } from "react";
import { Send, Smile, Paperclip, Mic, Square } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ─── Input bar ────────────────────────────────────────────────────────────────
export interface SupportChatInputProps {
  input: string;
  setInput: (v: string | ((prev: string) => string)) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  emojiOpen: boolean;
  setEmojiOpen: (v: boolean) => void;
  activeSending: boolean;
  activeLoading: boolean;
  sending: boolean;
  recording: boolean;
  transcribing: boolean;
  handleTextareaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSend: () => void;
  startRecording: () => void;
  stopRecording: () => void;
}

export function SupportChatInput({
  input,
  setInput,
  textareaRef,
  emojiOpen,
  setEmojiOpen,
  activeSending,
  activeLoading,
  sending,
  recording,
  transcribing,
  handleTextareaChange,
  handleKeyDown,
  handleSend,
  startRecording,
  stopRecording,
}: SupportChatInputProps) {
  return (
    <div className="px-3 pb-3 shrink-0">
      <div className="flex items-end gap-1.5 bg-white dark:bg-card rounded-lg border border-black/[0.1] dark:border-border/30 shadow-sm px-3 py-2">
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
  );
}
