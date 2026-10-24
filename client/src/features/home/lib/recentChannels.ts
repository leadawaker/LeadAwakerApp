import type { HomeServices } from "@shared/homeTypes";

export type RecentChannel = "phone" | "whatsapp" | "website";

/**
 * The channels the Stats page's Recent activity column can list: calls,
 * WhatsApp, and website chat when it is on. SMS (WhatsApp's fallback) and
 * Reactivation have no recent list, so an account with only those gets none
 * and the column is left out.
 */
export function recentChannels(services: HomeServices): RecentChannel[] {
  return (["phone", "whatsapp", "website"] as RecentChannel[]).filter((c) => services[c]);
}
