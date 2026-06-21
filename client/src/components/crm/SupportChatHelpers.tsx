import { useRef, useState, useEffect } from "react";
import { Headphones, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SupportChatMessage, type SupportBotConfig } from "@/hooks/useSupportChat";
import founderPhoto from "@/assets/founder-photo.webp";

// ─── Voice memo player (custom controls — reliable across browsers) ───────────
function fmtClock(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function VoiceMemo({ src, onDark }: { src: string; onDark: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  // MediaRecorder webm blobs often report duration=Infinity until forced to seek.
  const handleLoaded = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.duration === Infinity || isNaN(a.duration)) {
      const fix = () => {
        a.removeEventListener("timeupdate", fix);
        a.currentTime = 0;
        setDuration(a.duration === Infinity ? 0 : a.duration);
      };
      a.addEventListener("timeupdate", fix);
      a.currentTime = 1e6;
    } else {
      setDuration(a.duration);
    }
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
  };

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div className="flex items-center gap-2 my-1 w-[210px] max-w-full">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
          onDark ? "bg-white text-brand-indigo hover:bg-white/90" : "bg-brand-indigo text-white hover:bg-brand-indigo/90",
        )}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-[1px]" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={cn("h-1 rounded-full overflow-hidden", onDark ? "bg-white/30" : "bg-foreground/15")}>
          <div className={cn("h-full rounded-full", onDark ? "bg-white" : "bg-brand-indigo")} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className={cn("text-[10px] tabular-nums shrink-0", onDark ? "text-white/70" : "text-muted-foreground")}>
        {fmtClock(playing || current > 0 ? current : duration)}
      </span>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={handleLoaded}
        onDurationChange={() => { const a = audioRef.current; if (a && isFinite(a.duration)) setDuration(a.duration); }}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
      />
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
export function TypingDots() {
  return (
    <div className="flex items-end gap-1.5">
      <div className="h-9 w-9 shrink-0" />
      <div className="relative">
        <div className="flex items-center gap-1 px-3.5 py-2.5 bg-white dark:bg-card rounded-lg rounded-bl-none w-fit shadow-sm">
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
  const [src, setSrc] = useState(() => localStorage.getItem("leadawaker_user_avatar") || founderPhoto);
  useEffect(() => {
    const handler = () => setSrc(localStorage.getItem("leadawaker_user_avatar") || founderPhoto);
    window.addEventListener("leadawaker-avatar-changed", handler);
    return () => window.removeEventListener("leadawaker-avatar-changed", handler);
  }, []);
  return (
    <img
      src={src}
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
  const content = typeof msg.content === "string" ? msg.content : "";
  const isAudio = content.startsWith("data:audio");
  const isImage = content.startsWith("data:image");
  const isFile = !isAudio && !isImage && content.startsWith("data:");

  const bubbleRadius = isUser
    ? isFirstInGroup ? "rounded-lg rounded-br-none" : "rounded-lg"
    : isFirstInGroup ? "rounded-lg rounded-bl-none" : "rounded-lg";

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div className={cn("flex gap-1.5", isUser ? "justify-end" : "justify-start")}>
        {showBubbleAvatar && !isUser && isFirstInGroup && (
          activeChannel === "founder" ? <FounderAvatarFull size={avatarSize} /> : <BotAvatarFull config={botConfig} size={avatarSize} />
        )}
        {showBubbleAvatar && !isUser && !isFirstInGroup && <div style={{ width: avatarSize }} className="shrink-0" />}
        <div
          className={cn(
            "max-w-[80%] px-3 pt-2 pb-1 text-[13px] leading-relaxed whitespace-pre-wrap",
            bubbleRadius,
            isUser
              ? "bg-brand-indigo text-white shadow-sm"
              : activeChannel === "founder"
                ? "bg-white dark:bg-card text-foreground shadow-[var(--sh-inset-crisp)]"
                : "bg-white dark:bg-card text-foreground shadow-sm",
          )}
        >
          {isAudio ? (
            <VoiceMemo src={content} onDark={isUser} />
          ) : isImage ? (
            <a href={content} target="_blank" rel="noopener noreferrer">
              <img src={content} alt="attachment" className="rounded-lg max-w-[220px] my-1 block" />
            </a>
          ) : isFile ? (
            <a href={content} download className={cn("underline my-1 inline-block", isUser ? "text-white" : "text-brand-indigo")}>
              Download attachment
            </a>
          ) : (
            <span>{content}</span>
          )}
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
