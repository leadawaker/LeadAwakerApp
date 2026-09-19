import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import type { VoiceCallListItem } from "./api/voiceCallsApi";

/** What a call amounted to, strongest first. */
export type VoiceCallStatus = "dnc" | "booked" | "quote" | "message" | "info" | "responded";

export const VOICE_CALL_STATUSES: VoiceCallStatus[] = ["booked", "quote", "message", "info", "responded", "dnc"];

// Borrow the Chats pipeline palettes so a colour means the same on both pages:
// Booked is yellow, DND is wine, a plain answered call is Responded teal.
const PALETTE: Record<VoiceCallStatus, string> = {
  dnc: "DND",
  booked: "Booked",
  quote: "Closed",
  message: "New",
  info: "Contacted",
  responded: "Responded",
};

export function callStatus(call: Pick<VoiceCallListItem, "bookedSlot" | "intents" | "leadStatus">): VoiceCallStatus {
  const has = (i: string) => call.intents.includes(i);
  if (call.leadStatus === "DND" || has("do_not_contact")) return "dnc";
  if (call.bookedSlot) return "booked";
  if (has("request_quote")) return "quote";
  if (has("leave_message") || has("existing_customer") || has("complaint_or_fault")) return "message";
  if (has("ask_advice")) return "info";
  return "responded";
}

export function statusColors(status: VoiceCallStatus): { bg: string; text: string } {
  return getLeadStatusAvatarColor(PALETTE[status]);
}
