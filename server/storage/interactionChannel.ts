// The dashboard channel (phone | whatsapp | sms | website | email | other) for a
// message a person types in the CRM. The engine stamps its own messages with
// tools/channels.py; this covers the one case the CRM writes: a manual reply to a
// lead. The stamp follows the rule the CRM delivers by (server/channel-sender.ts:
// the campaign channel and the lead's identifier, never the lead's resolved_channel),
// so the row names the transport the reply really went out on. Pure, so it can be
// tested without a database.

import { isWhatsAppChannel } from "../channel-sender";

export type ManualReplyChannel = "website" | "whatsapp";

const WEB_PREFIXES = ["web:", "web-demo:"];

export function manualReplyChannel(
  lead: { channelIdentifier?: string | null },
  campaignChannel?: string | null,
): ManualReplyChannel | null {
  const identifier = String(lead.channelIdentifier ?? "");
  const campaign = String(campaignChannel ?? "");
  if (WEB_PREFIXES.some((p) => identifier.startsWith(p))) return "website";
  // Telegram wins in sendToChannel before WhatsApp is considered.
  if (identifier.startsWith("tg:") || identifier.startsWith("tg-") || campaign === "telegram") return null;
  return isWhatsAppChannel(campaign, identifier) ? "whatsapp" : null;
}
