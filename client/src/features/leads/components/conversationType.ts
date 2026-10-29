// Conversation "type" for the Chats page: which surface a lead came in through.
// There is no dedicated DB field, so it is derived from the lead's channel
// prefix / source and its campaign's service type (verified against live data).
//   widget   = website chat widget   voice = AI voice receptionist
//   dbr      = DBR reactivation + speed-to-lead quotes (one bucket on purpose)
//   instagram = Instagram comment-to-DM (the demo, and live leads with an ig: channel)
// Website chats win over the campaign: receptionist and demo campaigns carry the DB's default
// campaign_type "reactivation", so the campaign alone would file a website visitor as dbr.
// Keep in step with the conv_type CASE in server/storage/leadsPage.ts.
import { Globe, Instagram, MoreHorizontal, Phone, RefreshCw, type LucideIcon } from "lucide-react";

export type ConversationType = "widget" | "voice" | "dbr" | "instagram" | "other";

export const CONVERSATION_TYPES: ConversationType[] = ["widget", "voice", "dbr", "instagram", "other"];

/** Shown beside each option of the Channel filter. */
export const CONVERSATION_TYPE_ICON: Record<ConversationType, LucideIcon> = {
  widget: Globe, voice: Phone, dbr: RefreshCw, instagram: Instagram, other: MoreHorizontal,
};

type CampaignInfo = { campaignType?: string | null; bumpMode?: string | null };

export function getConversationType(
  lead: Record<string, any>,
  campaignsById?: Map<number, CampaignInfo>,
): ConversationType {
  const source = String(lead.Source ?? lead.source ?? "");
  const channel = String(lead.channel_identifier ?? lead.channelIdentifier ?? "");
  if (source === "Website Chat" || /^web:/.test(channel)) return "widget";
  if (source === "voice_receptionist") return "voice";
  // Live comment-to-DM leads (server/storage/socialDm.ts): channel ig:<Instagram-scoped id>.
  if (/^ig:/.test(channel)) return "instagram";
  const cId = Number(lead.Campaigns_id ?? lead.campaigns_id ?? lead.campaignsId ?? 0);
  const campaignType = cId ? campaignsById?.get(cId)?.campaignType : null;
  if (campaignType === "social_reply") return "instagram";
  // The browser demo page (web-demo:<token>) is a website chat, whatever the demo campaign.
  if (/^web-demo:/.test(channel)) return "widget";
  // A receptionist campaign answers inbound chats and calls: never a reactivation run.
  if (cId && campaignsById?.get(cId)?.bumpMode === "receptionist") return "other";
  if (campaignType === "reactivation" || campaignType === "speed_to_lead") return "dbr";
  return "other";
}
