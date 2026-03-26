import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import type { SessionUser } from "@/hooks/useSession";
import type { Interaction } from "../../hooks/useConversationsData";
import { AgentAvatar, BotAvatar } from "./atoms";
import { useHideAvatars } from "./types";
import type { MsgMeta } from "./types";
// ChatBubble is still defined in the parent file; import it from there until it is extracted.
import { ChatBubble } from "./ChatBubble";

/**
 * Wraps a consecutive run of human-agent outbound messages with a single
 * sticky avatar that follows the user as they scroll through a long run —
 * Telegram-style. The avatar sticks to `top-4` (first balloon) as you scroll up.
 */
export function AgentRunWrapper({
  msgs,
  metas,
  who,
  onRetry,
  leadName,
  leadAvatarColors,
  currentUser,
  isInitialLoad,
  startIdx,
  totalMsgCount,
}: {
  msgs: Interaction[];
  metas: MsgMeta[];
  who: string;
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string; statusColor: string };
  currentUser: SessionUser | null;
  isInitialLoad: boolean;
  startIdx: number;
  totalMsgCount: number;
}) {
  return (
    <div
      className={cn(
        "flex justify-end gap-1.5",
        isInitialLoad && startIdx >= totalMsgCount - 15 && "animate-bubble-right",
      )}
      style={isInitialLoad && startIdx >= totalMsgCount - 15 ? { animationDelay: `${Math.min(totalMsgCount - startIdx, 15) * 20}ms` } : undefined}
    >
      {/* Bubbles column — full width so max-w-[78%] resolves correctly */}
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <ChatBubble
            key={m.id ?? i}
            item={m}
            meta={metas[i]}
            onRetry={onRetry}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
            currentUser={currentUser}
            suppressAvatar
          />
        ))}
      </div>

      {/* Avatar column — sticky to bottom of scroll container so it stays visible while scrolling */}
      <div className="w-12 shrink-0 self-end sticky bottom-0">
        <AgentAvatar who={who} currentUser={currentUser} />
      </div>
    </div>
  );
}

/**
 * Wraps consecutive inbound (lead) messages — sticky lead avatar on the LEFT,
 * same Telegram-style behaviour as AgentRunWrapper.
 */
export function LeadRunWrapper({
  msgs,
  metas,
  onRetry,
  leadName,
  leadAvatarColors,
  currentUser,
  isInitialLoad,
  startIdx,
  totalMsgCount,
  onNavigateToLead,
}: {
  msgs: Interaction[];
  metas: MsgMeta[];
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string; statusColor: string };
  currentUser: SessionUser | null;
  isInitialLoad: boolean;
  startIdx: number;
  totalMsgCount: number;
  onNavigateToLead?: () => void;
}) {
  const hideAvatars = useHideAvatars();
  return (
    <div
      className={cn("flex justify-start gap-1.5", isInitialLoad && startIdx >= totalMsgCount - 15 && "animate-bubble-left")}
      style={isInitialLoad && startIdx >= totalMsgCount - 15 ? { animationDelay: `${Math.min(totalMsgCount - startIdx, 15) * 20}ms` } : undefined}
    >
      {/* Avatar column — sticky to bottom, left side */}
      {!hideAvatars && (
        <div className="w-12 shrink-0 self-end sticky bottom-0">
          <button type="button" onClick={onNavigateToLead} className="focus:outline-none rounded-full">
            <EntityAvatar
              name={leadName || "?"}
              bgColor={leadAvatarColors.bgColor}
              textColor={leadAvatarColors.textColor}
              size={48}
            />
          </button>
        </div>
      )}
      {/* Bubbles column */}
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <ChatBubble
            key={m.id ?? i}
            item={m}
            meta={metas[i]}
            onRetry={onRetry}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
            currentUser={currentUser}
            suppressAvatar
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Wraps consecutive AI-generated outbound messages — sticky bot avatar on the RIGHT,
 * same Telegram-style behaviour as AgentRunWrapper.
 */
export function BotRunWrapper({
  msgs,
  metas,
  onRetry,
  leadName,
  leadAvatarColors,
  currentUser,
  isInitialLoad,
  startIdx,
  totalMsgCount,
}: {
  msgs: Interaction[];
  metas: MsgMeta[];
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string; statusColor: string };
  currentUser: SessionUser | null;
  isInitialLoad: boolean;
  startIdx: number;
  totalMsgCount: number;
}) {
  const hideAvatars = useHideAvatars();
  return (
    <div
      className={cn("flex justify-end gap-1.5", isInitialLoad && startIdx >= totalMsgCount - 15 && "animate-bubble-right")}
      style={isInitialLoad && startIdx >= totalMsgCount - 15 ? { animationDelay: `${Math.min(totalMsgCount - startIdx, 15) * 20}ms` } : undefined}
    >
      {/* Bubbles column */}
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <ChatBubble
            key={m.id ?? i}
            item={m}
            meta={metas[i]}
            onRetry={onRetry}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
            currentUser={currentUser}
            suppressAvatar
          />
        ))}
      </div>
      {/* Bot avatar column — sticky to bottom, right side */}
      {!hideAvatars && (
        <div className="w-12 shrink-0 self-end sticky bottom-0">
          <BotAvatar />
        </div>
      )}
    </div>
  );
}
