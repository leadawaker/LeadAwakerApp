import { type RefObject, type KeyboardEvent } from "react";
import { Send, Paperclip, Mic, Trash2, MoreHorizontal, Eraser, Wallpaper, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { type ChatDoodleConfig, type ChatBgStyle } from "@/hooks/useChatDoodle";
import { DOODLE_PATTERNS } from "@/components/ui/doodle-patterns";

function fmtRec(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ─── Input bar ────────────────────────────────────────────────────────────────
export interface SupportChatInputProps {
  input: string;
  setInput: (v: string | ((prev: string) => string)) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
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
  recordingSeconds?: number;
  cancelRecording?: () => void;
  onAttachClick?: () => void;
  // Settings moved from header into the ... popover
  doodleConfig?: ChatDoodleConfig;
  setDoodleConfig?: (updates: Partial<ChatDoodleConfig>) => void;
  handleClearContext?: () => void;
  clearing?: boolean;
  loading?: boolean;
  founderOnly?: boolean;
  isInline?: boolean;
}

export function SupportChatInput({
  input,
  setInput: _setInput,
  textareaRef,
  emojiOpen: _emojiOpen,
  setEmojiOpen: _setEmojiOpen,
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
  recordingSeconds = 0,
  cancelRecording,
  onAttachClick,
  doodleConfig,
  setDoodleConfig,
  handleClearContext,
  clearing,
  loading,
  founderOnly,
  isInline,
}: SupportChatInputProps) {
  const iconBtn = cn(
    "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
    "text-muted-foreground/50 hover:text-muted-foreground"
  );

  const hasSettings = !founderOnly || isInline;

  return (
    <div className="px-3 pb-3 shrink-0">
      <div className="flex items-center gap-1 bg-white dark:bg-card rounded-lg border border-black/[0.1] dark:border-border/30 shadow-sm pl-1 pr-1.5 py-[3px] min-h-[62px]">
        {recording ? (
          /* ── Recording mode ── */
          <>
            <button
              type="button"
              onClick={cancelRecording}
              className="h-9 w-9 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10 shrink-0 transition-colors"
              title="Cancel recording"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="flex-1 flex items-center gap-2 pl-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" style={{ animation: "micPulse 1s ease-in-out infinite" }} />
              <span className="text-[15px] font-medium tabular-nums text-foreground">{fmtRec(recordingSeconds)}</span>
              <span className="text-[12px] text-muted-foreground">Recording…</span>
            </div>
            <button
              onClick={stopRecording}
              className="h-9 w-9 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 shrink-0 transition-colors"
              title="Send voice message"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </>
        ) : (
          <>
            {/* ── Left: ... settings + attach ── */}
            {hasSettings && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className={iconBtn} title="Settings">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" side="top" className="w-64 p-3 space-y-3">
                  {/* Clear context */}
                  {!founderOnly && handleClearContext && (
                    <button
                      type="button"
                      onClick={handleClearContext}
                      disabled={clearing || loading}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                    >
                      {clearing ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      ) : (
                        <Eraser className="h-4 w-4 shrink-0" />
                      )}
                      Clear conversation
                    </button>
                  )}

                  {/* Wallpaper / background (inline only) */}
                  {isInline && doodleConfig && setDoodleConfig && (
                    <>
                      {!founderOnly && handleClearContext && (
                        <div className="border-t border-border/40 pt-2" />
                      )}
                      <div className="flex items-center gap-1.5 px-1 pb-1">
                        <Wallpaper className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[12px] font-semibold">Background</span>
                      </div>
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
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold">Doodle Overlay</span>
                        <Switch
                          checked={doodleConfig.enabled}
                          onCheckedChange={(enabled) => setDoodleConfig({ enabled })}
                        />
                      </div>
                      {doodleConfig.enabled && (
                        <>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-muted-foreground">Pattern</span>
                              <span className="text-[11px] font-semibold tabular-nums text-foreground/70">
                                #{(DOODLE_PATTERNS.findIndex(p => p.id === doodleConfig.patternId) + 1) || 1}
                              </span>
                            </div>
                            <Slider
                              value={[(DOODLE_PATTERNS.findIndex(p => p.id === doodleConfig.patternId) + 1) || 1]}
                              onValueChange={([v]) => {
                                const entry = DOODLE_PATTERNS[v - 1];
                                if (entry) setDoodleConfig({ patternId: entry.id, size: entry.size });
                              }}
                              min={1}
                              max={42}
                              step={1}
                            />
                          </div>
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
                    </>
                  )}
                </PopoverContent>
              </Popover>
            )}

            {/* Attach */}
            <button
              type="button"
              className={iconBtn}
              title="Attach file"
              onClick={onAttachClick}
            >
              <Paperclip className="h-5 w-5" />
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… ✓"
              disabled={activeSending || activeLoading}
              className="flex-1 text-[17px] bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 leading-5 px-1"
              style={{ maxHeight: "120px" }}
            />

            {/* Mic — always visible, transcribes → fills textarea */}
            {transcribing ? (
              <button
                disabled
                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-muted-foreground/50"
                title="Transcribing…"
              >
                <Loader2 className="h-5 w-5 animate-spin" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={activeSending || activeLoading}
                className={cn(iconBtn, "disabled:opacity-40")}
                title="Voice message"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}

            {/* Send — always visible */}
            <button
              onClick={handleSend}
              disabled={activeSending || activeLoading || !input.trim()}
              className="h-9 w-9 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
              title="Send message"
            >
              {sending ? (
                <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
