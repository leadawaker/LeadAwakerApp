import { useTranslation } from "react-i18next";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Send,
  CircleDot,
} from "lucide-react";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import type { SessionUser } from "@/hooks/useSession";
import { PIPELINE_HEX } from "../../utils/conversationHelpers";
import { STAGE_ICON } from "../ContactSidebar";
import { type ThreadGroup, useTimezone } from "./types";
import { TAG_HEX, CONVERSION_STATUS_TAGS, _STATUS_LOWER } from "./constants";
import { formatBubbleTime, formatThreadLabel } from "./utils";

// ─── Date separator ───────────────────────────────────────────────────────────

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="text-[16px] font-medium text-white/95 bg-black/10 rounded-full px-4 py-1 select-none">
        {label}
      </span>
    </div>
  );
}

// ─── Tag Event Chip (inline in chat timeline) ─────────────────────────────────

export function TagEventChip({ tagName, tagColor, time }: { tagName: string; tagColor: string; time: string; eventType?: "added" | "removed" }) {
  const hex = TAG_HEX[tagColor] ?? "#6B7280";
  return (
    <div className="flex justify-center py-1.5">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-3 py-1 select-none bg-white dark:bg-gray-900 shadow-sm" style={{ color: hex }}>
        {tagName}
        {time && <><span className="opacity-50">&middot;</span><span className="opacity-50">{time}</span></>}
      </span>
    </div>
  );
}

// ─── Status Event Chip (conversion status changes in timeline) ────────────────

/** Case-insensitive lookup: returns the canonical status name or null */
export function canonicalStatus(tagName: string): string | null {
  return CONVERSION_STATUS_TAGS.has(tagName) ? tagName : (_STATUS_LOWER.get(tagName.toLowerCase()) ?? null);
}

export function StatusEventChip({ statusName, time }: { statusName: string; time: string }) {
  const StatusIcon = STAGE_ICON[statusName] ?? CircleDot;
  const hex = PIPELINE_HEX[statusName] ?? "#6B7280";
  return (
    <div className="flex justify-center py-1.5">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-3 py-1 select-none bg-white dark:bg-gray-900 shadow-sm" style={{ color: hex }}>
        <StatusIcon className="w-3.5 h-3.5" style={{ color: hex }} />
        {statusName}
        {time && <><span className="opacity-50">&middot;</span><span className="opacity-50">{time}</span></>}
      </span>
    </div>
  );
}

// ─── Agent avatar ─────────────────────────────────────────────────────────────

export function AgentAvatar({ who, currentUser }: { who: string; currentUser: SessionUser | null }) {
  const { t } = useTranslation("conversations");
  // Prefer the logged-in user's real name & photo over the raw `who` field
  const displayName = currentUser?.fullName || who || t("chat.senderLabels.you");
  const photoUrl = currentUser?.avatarUrl ?? null;
  return (
    <EntityAvatar
      name={displayName}
      photoUrl={photoUrl}
      bgColor="#4F46E5"
      textColor="#ffffff"
      size={48}
      className="shrink-0"
    />
  );
}

/** Bot avatar — Lead Awaker favicon, unclipped (no circle crop) */
export function BotAvatar() {
  return (
    <div className="h-12 w-12 shrink-0">
      <img src="/6. Favicon.svg" alt="AI" className="h-full w-full object-contain" />
    </div>
  );
}

// ─── Message status icon ──────────────────────────────────────────────────────

/** Delivery status icon for outbound messages. */
export interface MessageStatusIconProps {
  status: string;
  isSending: boolean;
  isSent: boolean;
  isDelivered: boolean;
  isRead: boolean;
  isFailed: boolean;
}

export function MessageStatusIcon({ isSending, isSent, isDelivered, isRead, isFailed }: MessageStatusIconProps) {
  const { t } = useTranslation("conversations");
  if (isSending) {
    return (
      <span className="inline-flex items-center gap-0.5" data-testid="status-sending" title={t("chat.messageStatus.sending")}>
        <Clock className="w-3 h-3 animate-pulse opacity-70" />
      </span>
    );
  }
  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-0.5 text-destructive" data-testid="status-failed" title={t("chat.messageStatus.failed")}>
        <AlertCircle className="w-3 h-3" />
      </span>
    );
  }
  if (isRead) {
    return (
      <span className="inline-flex items-center text-sky-300" data-testid="status-read" title={t("chat.messageStatus.read")}>
        <CheckCheck className="w-3 h-3" />
      </span>
    );
  }
  if (isDelivered) {
    return (
      <span className="inline-flex items-center opacity-80" data-testid="status-delivered" title={t("chat.messageStatus.delivered")}>
        <CheckCheck className="w-3 h-3" />
      </span>
    );
  }
  if (isSent) {
    return (
      <span className="inline-flex items-center opacity-60" data-testid="status-sent" title={t("chat.messageStatus.sent")}>
        <Check className="w-3 h-3" />
      </span>
    );
  }
  return null;
}

// ─── Thread divider ───────────────────────────────────────────────────────────

export function ThreadDivider({ group, total }: { group: ThreadGroup; total: number }) {
  const { t } = useTranslation("conversations");
  const timezone = useTimezone();
  const firstMsg = group.msgs[0];
  const ts = firstMsg?.created_at || firstMsg?.createdAt;
  const time = ts ? formatBubbleTime(ts, timezone) : null;
  const isBump = group.threadId.startsWith("bump-");

  if (!isBump) {
    // Non-bump threads = start of a contact attempt → render as "Contacted" status chip
    const hex = PIPELINE_HEX["Contacted"] ?? "#818CF8";
    const ContactedIcon = STAGE_ICON["Contacted"] ?? Send;
    return (
      <div className="flex justify-center my-4" data-testid={`thread-divider-${group.threadIndex}`}>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-3 py-1 select-none bg-white dark:bg-gray-900 shadow-sm" style={{ color: hex }}>
          <ContactedIcon className="w-3.5 h-3.5" style={{ color: hex }} />
          Contacted
          {time && <><span className="opacity-50"> · </span><span className="opacity-50">{time}</span></>}
        </span>
      </div>
    );
  }

  const label = formatThreadLabel(group, total, t);
  return (
    <div className="flex justify-center my-4" data-testid={`thread-divider-${group.threadIndex}`}>
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-3 py-1 select-none bg-white dark:bg-gray-900 shadow-sm text-gray-400 dark:text-gray-500">
        {label}{time && <><span className="opacity-50"> · </span><span className="opacity-50">{time}</span></>}
      </span>
    </div>
  );
}
