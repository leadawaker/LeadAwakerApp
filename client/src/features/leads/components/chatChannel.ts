// Chats page inbox tabs: which messaging channel a conversation runs on.
// Truth is Interactions.channel (same as the Home dashboard): the API adds
// `last_channel`, the channel of the lead's latest WhatsApp or website message.
// Leads with no messages yet fall back to their source / channel prefix.
export type ChatChannel = "website" | "whatsapp";
export type ChatChannelTab = "all" | ChatChannel;

export const CHAT_CHANNEL_TABS: ChatChannelTab[] = ["all", "website", "whatsapp"];

export function getChatChannel(lead: Record<string, any>): ChatChannel | null {
  const last = String(lead.last_channel ?? lead.lastChannel ?? "");
  if (last === "website" || last === "whatsapp") return last;
  const channelId = String(lead.channel_identifier ?? lead.channelIdentifier ?? "");
  const source = String(lead.Source ?? lead.source ?? "");
  if (/^web[:-]/.test(channelId) || /website/i.test(source)) return "website";
  if (/^wa[:-]/.test(channelId) || /whatsapp/i.test(source)) return "whatsapp";
  return null;
}

export function matchesChatChannel(lead: Record<string, any>, tab: ChatChannelTab): boolean {
  return tab === "all" || getChatChannel(lead) === tab;
}
