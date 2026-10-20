import type { VoiceCallSummaryItem } from "./api/voiceCallsApi";

/**
 * The recap items of a call, grouped the way the Chats recap reads: what the
 * caller wanted, what got booked, what happens next, and anything else.
 * The intents come from the engine's recap (call_recap.py, `_SUMMARY_INTENTS`).
 */
export type SummaryGroupId = "wanted" | "booked" | "followUp" | "other";

export const SUMMARY_GROUP_ORDER: SummaryGroupId[] = ["wanted", "booked", "followUp", "other"];

const GROUP_OF: Record<string, SummaryGroupId> = {
  ask_advice: "wanted",
  request_quote: "wanted",
  existing_customer: "wanted",
  complaint_or_fault: "wanted",
  book_appointment: "booked",
  callback_now: "followUp",
  leave_message: "followUp",
  do_not_contact: "followUp",
  not_relevant: "other",
};

// A message item that is only about the channel ("confirmation on WhatsApp",
// "send it by text") says how, not what: the summary leaves it out.
const CHANNEL_WORDS = /whats\s?-?app|\bsms\b|\btext(ed)?\b|e-?mail|\bmail\b|\bapp(je|zinho)?\b/i;

export function isChannelPreference(item: VoiceCallSummaryItem): boolean {
  if (item.intent !== "leave_message") return false;
  return CHANNEL_WORDS.test(`${item.interest ?? ""} ${item.notes ?? ""}`);
}

export interface SummaryGroup {
  id: SummaryGroupId;
  items: VoiceCallSummaryItem[];
}

/** Drops channel-only items and returns the non-empty groups in reading order. */
export function groupSummaryItems(items: VoiceCallSummaryItem[]): SummaryGroup[] {
  const kept = items.filter((i) => !isChannelPreference(i) && (i.interest || i.notes));
  return SUMMARY_GROUP_ORDER
    .map((id) => ({ id, items: kept.filter((i) => (GROUP_OF[i.intent] ?? "other") === id) }))
    .filter((g) => g.items.length > 0);
}
