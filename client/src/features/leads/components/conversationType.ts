// Conversation "type" for the Chats page: which surface a lead came in through.
// There is no dedicated DB field, so it is derived from the lead's channel
// prefix / source and its campaign's service type (verified against live data).
//   widget   = website chat widget   voice = AI voice receptionist
//   dbr      = DBR reactivation + speed-to-lead quotes (one bucket on purpose)
//   instagram = Instagram comment-to-DM demo
export type ConversationType = "widget" | "voice" | "dbr" | "instagram" | "other";

export const CONVERSATION_TYPES: ConversationType[] = ["widget", "voice", "dbr", "instagram", "other"];

type CampaignInfo = { campaignType?: string | null };

export function getConversationType(
  lead: Record<string, any>,
  campaignsById?: Map<number, CampaignInfo>,
): ConversationType {
  const source = String(lead.Source ?? lead.source ?? "");
  const channel = String(lead.channel_identifier ?? lead.channelIdentifier ?? "");
  if (source === "Website Chat" || /^web:/.test(channel)) return "widget";
  if (source === "voice_receptionist") return "voice";
  const cId = Number(lead.Campaigns_id ?? lead.campaigns_id ?? lead.campaignsId ?? 0);
  const campaignType = cId ? campaignsById?.get(cId)?.campaignType : null;
  if (campaignType === "social_reply") return "instagram";
  if (campaignType === "reactivation" || campaignType === "speed_to_lead") return "dbr";
  return "other";
}
