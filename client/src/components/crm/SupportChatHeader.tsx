import { type RefObject, type KeyboardEvent } from "react";
import { Headphones, Loader2, X, Maximize2, Camera, Pencil, Eraser, Wallpaper, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SupportBotConfig } from "@/hooks/useSupportChat";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { type ChatBgStyle } from "@/hooks/useChatDoodle";
import { CURATED_PATTERNS } from "@/components/ui/doodle-patterns";
import { BotAvatarFull } from "./SupportChatHelpers";

// Matches FounderChatProps in SupportChatWidget — kept local to avoid circular import
interface FounderChatRef {
  messages: unknown[];
  sending: boolean;
  loading: boolean;
  initialize: () => void;
  sendMessage: (text: string) => void;
  closeSession: () => void;
  clearContext: () => Promise<void>;
}

// ─── Header props ─────────────────────────────────────────────────────────────
export interface SupportChatHeaderProps {
  channel: "bot" | "founder";
  setChannel: (c: "bot" | "founder") => void;
  botConfig: SupportBotConfig;
  isInline: boolean;
  isAgencyUser: boolean;
  founderChat?: FounderChatRef;
  botPhotoInputRef: RefObject<HTMLInputElement>;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  editingName: boolean;
  nameInput: string;
  setNameInput: (v: string) => void;
  saveEditName: () => void;
  handleNameKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  startEditName: () => void;
  handleClearContext: () => void;
  clearing: boolean;
  loading: boolean;
  doodleConfig: {
    bgStyle: ChatBgStyle;
    enabled: boolean;
    patternId: string;
    color: number;
    size: number;
  };
  setDoodleConfig: (updates: Partial<SupportChatHeaderProps["doodleConfig"]>) => void;
  handleClose: () => void;
  onOpenInChats?: () => void;
  aiAgents?: { id: number; name: string }[];
  onOpenAgent?: (id: number) => void;
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function SupportChatHeader({
  channel,
  setChannel,
  botConfig,
  isInline,
  isAgencyUser,
  founderChat,
  botPhotoInputRef,
  handlePhotoChange,
  editingName,
  nameInput,
  setNameInput,
  saveEditName,
  handleNameKeyDown,
  startEditName,
  handleClearContext,
  clearing,
  loading,
  doodleConfig,
  setDoodleConfig,
  handleClose,
  onOpenInChats,
  aiAgents,
  onOpenAgent,
}: SupportChatHeaderProps) {
  return (
    <div className="shrink-0 bg-white dark:bg-card border-b border-black/[0.06] dark:border-border/30">
      {/* ── Channel tabs (floating mode only) ── */}
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
  );
}
