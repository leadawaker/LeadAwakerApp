import { AudioLines, Globe, MessageCircle, MessageSquare, type LucideIcon } from "lucide-react";
import type { AttentionRow, CallOutcome, HomeChannel } from "@shared/homeTypes";

/** One icon and token colour per channel, on every Recent activity and Needs attention row. */
export const CHANNEL_ICON: Record<HomeChannel, { icon: LucideIcon; tone: string }> = {
  phone: { icon: AudioLines, tone: "var(--wine)" },
  whatsapp: { icon: MessageCircle, tone: "var(--stage-multi)" },
  sms: { icon: MessageSquare, tone: "var(--stage-new)" },
  website: { icon: Globe, tone: "var(--stage-contacted)" },
};

/** Tag colours. "answered" (questions answered) has no tag at all. */
export const OUTCOME_COLOR: Record<Exclude<CallOutcome, "answered">, string> = {
  booked: "var(--stage-booked)",
  callback: "var(--stage-contacted)",
  transferred: "var(--stage-multi)",
  hung_up: "var(--mute)",
};
export const ATTENTION_COLOR: Record<AttentionRow["kind"], string> = {
  callback: "var(--stage-contacted)",
  transfer_failed: "var(--stage-lost)",
  handoff: "var(--wine)",
};
