import { Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SupportChatMessage, type SupportBotConfig } from "@/hooks/useSupportChat";

// ─── Typing indicator ─────────────────────────────────────────────────────────
export function TypingDots() {
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
export function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function getDateKey(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toDateString();
}

export function formatDateLabel(iso: string): string | null {
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
export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-1.5">
      <span className="text-[10px] font-medium text-white bg-black/70 rounded-full px-3 py-0.5">
        {label}
      </span>
    </div>
  );
}

// ─── Bot avatar (36px, matching EntityAvatar standard) ───────────────────────
export function BotAvatarFull({ config, size = 36 }: { config: SupportBotConfig; size?: number }) {
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
export function FounderAvatarFull({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/founder-photo.webp"
      alt="Gabriel"
      className="rounded-full shrink-0 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function ChatBubble({
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
