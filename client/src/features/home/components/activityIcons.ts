import {
  CalendarCheck, Hand, MessageCircle, Phone, PhoneForwarded, PhoneOff, PhoneOutgoing, Send, type LucideIcon,
} from "lucide-react";
import type { ActivityRow, AttentionRow } from "@shared/homeTypes";

/** One icon and token colour per event type, so Recent activity scans at a glance. */
export const EVENT_ICON: Record<ActivityRow["kind"] | AttentionRow["kind"], { icon: LucideIcon; tone: string }> = {
  booked: { icon: CalendarCheck, tone: "var(--stage-booked)" },
  call: { icon: Phone, tone: "var(--stage-responded)" },
  transferred: { icon: PhoneForwarded, tone: "var(--stage-multi)" },
  chat_started: { icon: MessageCircle, tone: "var(--stage-new)" },
  followup_sent: { icon: Send, tone: "var(--stage-contacted)" },
  callback: { icon: PhoneOutgoing, tone: "var(--stage-contacted)" },
  transfer_failed: { icon: PhoneOff, tone: "var(--stage-lost)" },
  handoff: { icon: Hand, tone: "var(--wine)" },
};
