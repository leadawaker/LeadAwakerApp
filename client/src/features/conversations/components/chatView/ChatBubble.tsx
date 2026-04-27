import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { RotateCcw, Mic, Image as ImageIcon, Mail, MessageSquare, Linkedin, Phone } from "lucide-react";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import type { SessionUser } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import type { Interaction } from "../../hooks/useConversationsData";
import type { MsgMeta } from "./types";
import { useBubbleWidth, useHideAvatars, useTimezone } from "./types";
import { formatBubbleTime, isAiMessage, isHumanAgentMessage, getAttachmentType } from "./utils";
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
  const timezone = useTimezone();
  const outbound = item.direction?.toLowerCase() === "outbound";
  const inbound = !outbound;
  const statusNorm = (item.status ?? "").toLowerCase();
  const isFailed = statusNorm === "failed";
  const isSending = statusNorm === "sending";
  const isSent = statusNorm === "sent";
  const isDelivered = statusNorm === "delivered";
  const isRead = statusNorm === "read";
  const typeNorm = (item.type ?? "").toLowerCase();
  const isEmail = typeNorm === "email";
  const isLinkedIn = typeNorm === "linkedin";
  const isWhatsApp = typeNorm === "whatsapp" || typeNorm === "whatsapp_cloud";
  const isCall = typeNorm === "call";
  const aiMsg = outbound && !isEmail && !isLinkedIn && isAiMessage(item);
  const humanAgentMsg = outbound && !isEmail && !isLinkedIn && isHumanAgentMessage(item);
  const { isFirstInRun, isLastInRun } = meta;
  const rawTs = item.created_at ?? item.createdAt ?? (item as any).Created_At ?? (item as any).CreatedAt ?? null;
  const time = formatBubbleTime(rawTs, timezone);
  const who = (item.Who ?? item.who ?? "").trim();

  // AI cost tooltip (agency-only, hover-to-reveal on AI messages)
  const isAgency = currentUser?.accountsId === 1;
  const aiPrompt = aiMsg && isAgency ? Number(item.ai_prompt_tokens ?? item.aiPromptTokens ?? 0) : 0;
  const aiCompletion = aiMsg && isAgency ? Number(item.ai_completion_tokens ?? item.aiCompletionTokens ?? 0) : 0;
  const aiCostVal = aiMsg && isAgency ? Number(item.ai_cost ?? item.aiCost ?? 0) : 0;
  const aiCostTitle = (aiPrompt + aiCompletion) > 0
    ? `In: ${aiPrompt.toLocaleString()} / Out: ${aiCompletion.toLocaleString()}, $${aiCostVal.toFixed(4)}`
    : undefined;

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
          // Email: always white/card with border, regardless of direction
          isEmail && "bg-white dark:bg-card text-gray-900 dark:text-foreground border border-border/50 bubble-shadow",
          // LinkedIn: subtle blue tint with border
          isLinkedIn && "bg-[#f4f8ff] dark:bg-[#1a2540] text-gray-900 dark:text-foreground border border-[#0A66C2]/20 bubble-shadow",
          // Call: green tint
          isCall && "bg-[#f0fff4] dark:bg-[#0d2318] text-gray-900 dark:text-foreground border border-emerald-200/60 dark:border-emerald-900/60 bubble-shadow",
          // Inbound (lead): neutral gray glow; mobile uses --card bg explicitly
          !isEmail && inbound && "bg-white dark:bg-card max-md:bg-card max-md:dark:bg-card text-gray-900 dark:text-foreground bubble-shadow",
          // AI outbound: blue (desktop) / brand-indigo (mobile)
          aiMsg && "bg-[#f2f5ff] dark:bg-[#1e2340] text-gray-900 dark:text-foreground bubble-shadow max-md:bg-brand-indigo max-md:text-white max-md:filter-none",
          // Human agent outbound (desktop: green) / brand-indigo (mobile)
          humanAgentMsg && "bg-[#f1fff5] dark:bg-[#1a2e1f] text-gray-900 dark:text-foreground bubble-shadow max-md:bg-brand-indigo max-md:text-white max-md:filter-none",
          isFailed && "opacity-80",
        )}
        data-message-type={isEmail ? "email" : isLinkedIn ? "linkedin" : inbound ? "lead" : aiMsg ? "ai" : "agent"}
        title={aiCostTitle}
      >
        {/* Tail triangle — only on last message in a consecutive run */}
        {isLastInRun && inbound && (
          <span aria-hidden="true" className="absolute bottom-0 -left-[6px] w-0 h-0 border-t-[9px] border-t-transparent border-r-[8px] border-r-white dark:border-r-[#243249]" />
        )}
        {isLastInRun && !inbound && (
          <span aria-hidden="true" className={cn(
            "absolute bottom-0 -right-[6px] w-0 h-0 border-t-[9px] border-t-transparent border-l-[8px]",
            isEmail && "border-l-white dark:border-l-card",
            isLinkedIn && "border-l-[#f4f8ff] dark:border-l-[#1a2540]",
            aiMsg && "border-l-[#f2f5ff] dark:border-l-[#1e2340] max-md:border-l-brand-indigo",
            humanAgentMsg && "border-l-[#f1fff5] dark:border-l-[#1a2e1f] max-md:border-l-brand-indigo",
            isCall && "border-l-[#f0fff4] dark:border-l-[#0d2318]",
          )} />
        )}
        {/* Content: voice memo data URL → render player inline; otherwise plain text */}
        {(() => {
          const content = item.content ?? item.Content ?? "";
          const attachment = item.attachment ?? item.Attachment;
          const isVoiceMemo = content.startsWith("data:audio/") || item.type === "audio";
          const hasAudioAttachment = typeof attachment === "string" && attachment.length > 0 && getAttachmentType(attachment) === "audio";
          const isVoiceNote = item.type === "voice_note" || hasAudioAttachment;
          // Voice color: human agent → green, AI → amber, inbound lead → pipeline status color, outbound agent → teal
          const voiceColor = humanAgentMsg ? "#22C55E" : aiMsg ? "#2050ff" : inbound ? leadAvatarColors.statusColor : "#0ABFA3";
          const emailSubject = isEmail ? ((item.metadata as any)?.subject ?? "") : "";
          // Time + status stamp — WhatsApp-style: inline at bottom-right of bubble
          const timeStamp = (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] leading-none select-none opacity-50 mb-0.5">
              {isEmail && <Mail className="h-3 w-3" />}
              {isLinkedIn && <Linkedin className="h-3 w-3" />}
              {isWhatsApp && <MessageSquare className="h-3 w-3" />}
              {isCall && <Phone className="h-3 w-3" />}
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
            return <div className={cn("flex items-end gap-1.5", outbound && "justify-end")}><VoiceMemoPlayer url={content} outbound={outbound} color={voiceColor} />{timeStamp}</div>;
          }
          if (isVoiceNote) {
            const VOICE_PREFIX = "[Voice Note]: ";
            const transcription = content.startsWith(VOICE_PREFIX)
              ? content.slice(VOICE_PREFIX.length).trim()
              : content.trim();
            const audioUrl = typeof attachment === "string" && (attachment.startsWith("data:audio/") || getAttachmentType(attachment) === "audio") ? attachment : null;
            return (
              <div className={cn("flex flex-col gap-2", outbound && "items-end")}>
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
          if (isCall) {
            const metadata = (item.metadata ?? item.Metadata ?? {}) as any;
            const transcript = metadata?.transcript ?? null;
            return (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-[13px] font-medium flex-1 min-w-0">{content || "Call"}</span>
                  {timeStamp}
                </div>
                {transcript && (
                  <span className="text-[12px] italic opacity-70 leading-relaxed">{transcript}</span>
                )}
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
              {isEmail && emailSubject && (
                <div className="text-[11px] font-semibold text-foreground/60 pb-0.5 border-b border-border/30 mb-1">{emailSubject}</div>
              )}
              {attachment && <AttachmentPreview url={attachment as string} outbound={outbound} voiceColor={voiceColor} />}
              <div className="flex items-end gap-1.5">
                {content.includes("<") ? (
                  <span
                    className="whitespace-pre-wrap leading-relaxed break-words flex-1 min-w-0 [&_table]:text-[11px] [&_img]:max-w-[200px]"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(content, {
                        ALLOWED_TAGS: ["p", "br", "b", "strong", "i", "em", "a", "ul", "ol", "li", "div", "span", "table", "tr", "td", "th", "img", "hr"],
                        ALLOWED_ATTR: ["href", "target", "style", "src", "alt", "width", "height", "cellpadding", "cellspacing"],
                        ADD_ATTR: ["target"],
                      }),
                    }}
                  />
                ) : (
                  <span className="whitespace-pre-wrap leading-relaxed break-words flex-1 min-w-0">{content}</span>
                )}
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


