import { useTranslation } from "react-i18next";
import { RotateCcw, Mic, Image as ImageIcon } from "lucide-react";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import type { SessionUser } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import type { Interaction } from "../../hooks/useConversationsData";
import type { MsgMeta } from "./types";
import { useBubbleWidth, useHideAvatars } from "./types";
import { formatBubbleTime, isAiMessage, isHumanAgentMessage } from "./utils";
import { MessageStatusIcon, AgentAvatar, BotAvatar } from "./atoms";
import { VoiceMemoPlayer } from "./VoiceMemoPlayer";
import { AttachmentPreview } from "./AttachmentPreview";

export function ChatBubble({
  item,
  onRetry,
  leadName,
  leadAvatarColors,
  meta,
  animateEntrance = false,
  entranceDelay = 0,
  currentUser = null,
  suppressAvatar = false,
}: {
  item: Interaction;
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string; statusColor: string };
  meta: MsgMeta;
  animateEntrance?: boolean;
  entranceDelay?: number;
  currentUser?: SessionUser | null;
  /** When true, skip rendering avatar/spacer (handled by parent AgentRunWrapper) */
  suppressAvatar?: boolean;
}) {
  const { t } = useTranslation("conversations");
  const bubbleWidth = useBubbleWidth();
  const hideAvatars = useHideAvatars();
  const outbound = item.direction?.toLowerCase() === "outbound";
  const inbound = !outbound;
  const statusNorm = (item.status ?? "").toLowerCase();
  const isFailed = statusNorm === "failed";
  const isSending = statusNorm === "sending";
  const isSent = statusNorm === "sent";
  const isDelivered = statusNorm === "delivered";
  const isRead = statusNorm === "read";
  const aiMsg = outbound && isAiMessage(item);
  const humanAgentMsg = outbound && isHumanAgentMessage(item);
  const { isFirstInRun, isLastInRun } = meta;
  const rawTs = item.created_at ?? item.createdAt ?? (item as any).Created_At ?? (item as any).CreatedAt ?? null;
  const time = formatBubbleTime(rawTs);
  const who = (item.Who ?? item.who ?? "").trim();

  // Last in run: sharp corner where tail connects, rounded on all others
  // Not last in run: all corners rounded
  const bubbleRadius = isLastInRun
    ? inbound
      ? "rounded-2xl rounded-bl-none"
      : "rounded-2xl rounded-br-none"
    : "rounded-2xl";

  return (
    <div
      className={cn(
        "flex items-end gap-1.5 my-1",
        outbound ? "justify-end" : "justify-start",
        animateEntrance && (outbound ? "animate-bubble-right" : "animate-bubble-left"),
      )}
      style={animateEntrance ? { animationDelay: `${Math.min(entranceDelay, 20) * 25}ms` } : undefined}
    >
      {/* Lead avatar — left side, last in inbound run (omitted when wrapper handles sticky avatar) */}
      {inbound && !suppressAvatar && !hideAvatars && isLastInRun && (
        <EntityAvatar
          name={leadName || "?"}
          bgColor={leadAvatarColors.bgColor}
          textColor={leadAvatarColors.textColor}
          size={48}
        />
      )}
      {inbound && !suppressAvatar && !hideAvatars && !isLastInRun && <div className="w-12 shrink-0" />}

      {/* Bubble */}
      <div
        style={{ maxWidth: `${bubbleWidth}%` }}
        className={cn(
          "px-3 pt-2 pb-1.5 text-[15px] relative",
          bubbleRadius,
          // Inbound (lead): neutral gray glow; mobile uses --card bg explicitly
          inbound && "bg-white dark:bg-card max-md:bg-card max-md:dark:bg-card text-gray-900 dark:text-foreground bubble-shadow",
          // AI outbound: blue (desktop) / brand-indigo (mobile)
          aiMsg && "bg-[#f2f5ff] dark:bg-[#1e2340] text-gray-900 dark:text-foreground bubble-shadow max-md:bg-brand-indigo max-md:text-white max-md:filter-none",
          // Human agent outbound (desktop: green) / brand-indigo (mobile)
          humanAgentMsg && "bg-[#f1fff5] dark:bg-[#1a2e1f] text-gray-900 dark:text-foreground bubble-shadow max-md:bg-brand-indigo max-md:text-white max-md:filter-none",
          isFailed && "opacity-80",
        )}
        data-message-type={inbound ? "lead" : aiMsg ? "ai" : "agent"}
      >
        {/* Tail triangle — only on last message in a consecutive run */}
        {isLastInRun && inbound && (
          <span aria-hidden="true" className="absolute bottom-0 -left-[6px] w-0 h-0 border-t-[9px] border-t-transparent border-r-[8px] border-r-white dark:border-r-[#243249]" />
        )}
        {isLastInRun && !inbound && (
          <span aria-hidden="true" className={cn(
            "absolute bottom-0 -right-[6px] w-0 h-0 border-t-[9px] border-t-transparent border-l-[8px]",
            aiMsg && "border-l-[#f2f5ff] dark:border-l-[#1e2340] max-md:border-l-brand-indigo",
            humanAgentMsg && "border-l-[#f1fff5] dark:border-l-[#1a2e1f] max-md:border-l-brand-indigo",
          )} />
        )}
        {/* Content: voice memo data URL → render player inline; otherwise plain text */}
        {(() => {
          const content = item.content ?? item.Content ?? "";
          const attachment = item.attachment ?? item.Attachment;
          const isVoiceMemo = content.startsWith("data:audio/") || item.type === "audio";
          const isVoiceNote = item.type === "voice_note";
          // Voice color: human agent → green, AI → amber, inbound lead → pipeline status color, outbound agent → teal
          const voiceColor = humanAgentMsg ? "#22C55E" : aiMsg ? "#f59e0b" : inbound ? leadAvatarColors.statusColor : "#0ABFA3";
          // Time + status stamp — WhatsApp-style: inline at bottom-right of bubble
          const timeStamp = (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] leading-none select-none opacity-50 mb-0.5">
              {time || (rawTs ? rawTs.toString().slice(11, 16) : "")}
              {outbound && (
                <MessageStatusIcon
                  status={statusNorm}
                  isSending={isSending}
                  isSent={isSent}
                  isDelivered={isDelivered}
                  isRead={isRead}
                  isFailed={isFailed}
                />
              )}
            </span>
          );
          if (isVoiceMemo) {
            return <div className="flex items-end gap-1.5"><VoiceMemoPlayer url={content} outbound={outbound} color={voiceColor} />{timeStamp}</div>;
          }
          if (isVoiceNote) {
            const VOICE_PREFIX = "[Voice Note]: ";
            const transcription = content.startsWith(VOICE_PREFIX)
              ? content.slice(VOICE_PREFIX.length).trim()
              : content.trim();
            const audioUrl = typeof attachment === "string" && attachment.startsWith("data:audio/") ? attachment : null;
            return (
              <div className="flex flex-col gap-2">
                {audioUrl
                  ? <VoiceMemoPlayer url={audioUrl} outbound={outbound} color={voiceColor} />
                  : <div className="flex items-center gap-1.5 opacity-70">
                      <Mic className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-[11px] font-medium uppercase tracking-wide">Voice note</span>
                    </div>
                }
                <div className="flex items-end gap-1.5">
                  {transcription
                    ? <span className="whitespace-pre-wrap leading-relaxed break-words text-[13px] italic opacity-80 flex-1 min-w-0">{transcription}</span>
                    : <span className="text-[12px] opacity-50 italic flex-1 min-w-0">Transcription unavailable</span>
                  }
                  {timeStamp}
                </div>
              </div>
            );
          }
          if (item.type === "image") {
            const IMAGE_PREFIX = "[Image]: ";
            const caption = content.startsWith(IMAGE_PREFIX)
              ? content.slice(IMAGE_PREFIX.length).trim()
              : content.replace(/^\[Image\]:\s*/i, "").trim();
            const imageUrl = typeof attachment === "string" && attachment.startsWith("data:image/") ? attachment : null;
            return (
              <div className="flex flex-col gap-1.5">
                {imageUrl
                  ? <AttachmentPreview url={imageUrl} outbound={outbound} />
                  : <div className="flex items-center gap-1.5 opacity-70">
                      <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-[11px] font-medium uppercase tracking-wide">Image</span>
                    </div>
                }
                <div className="flex items-end gap-1.5">
                  {caption
                    ? <span className="whitespace-pre-wrap leading-relaxed break-words text-[12px] italic opacity-70 flex-1 min-w-0">{caption}</span>
                    : null
                  }
                  {timeStamp}
                </div>
              </div>
            );
          }
          return (
            <div className="flex flex-col gap-1">
              {attachment && <AttachmentPreview url={attachment as string} outbound={outbound} voiceColor={voiceColor} />}
              <div className="flex items-end gap-1.5">
                <span className="whitespace-pre-wrap leading-relaxed break-words flex-1 min-w-0">{content}</span>
                {timeStamp}
              </div>
            </div>
          );
        })()}
        {isFailed && onRetry && (
          <button
            type="button"
            onClick={() => onRetry(item)}
            className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] font-semibold text-destructive hover:text-destructive/80 underline underline-offset-2"
            data-testid="button-retry-message"
          >
            <RotateCcw className="w-3 h-3" />
            {t("chat.retry")}
          </button>
        )}
      </div>

      {/* AI bot avatar — right side, last in run only */}
      {aiMsg && !suppressAvatar && !hideAvatars && isLastInRun && <BotAvatar />}
      {aiMsg && !suppressAvatar && !hideAvatars && !isLastInRun && <div className="w-12 shrink-0" />}
      {/* Human agent avatar — right side, last in run only */}
      {humanAgentMsg && !suppressAvatar && !hideAvatars && isLastInRun && <AgentAvatar who={who} currentUser={currentUser} />}
      {humanAgentMsg && !suppressAvatar && !hideAvatars && !isLastInRun && <div className="w-12 shrink-0" />}
    </div>
  );
}
