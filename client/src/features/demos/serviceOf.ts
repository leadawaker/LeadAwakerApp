// Pure (no icons, no api imports) so the row model and its tests load without the app.
import type { DemoSession } from "./api/demoSessionsApi";

/**
 * Which column a link belongs in.
 *
 * Links minted before the service tag existed carry no `service`, so they are
 * placed by the pair that actually distinguished them then: campaign plus
 * scenario. Speed and Voice share campaign 67 and were never told apart, so an
 * untagged 67 link reads as Speed, the surface it was almost always minted
 * from. Anything on a campaign that is not a service campaign stays unplaced
 * and gets its own cell at the end of the row.
 */
export function serviceOf(session: DemoSession): string {
  if (session.service) return session.service;
  if (session.campaignId === 60) return session.scenario === "deciding" ? "quote" : "dbr";
  if (session.campaignId === 67) return "speed";
  if (session.campaignId === 68) return "widget";
  if (session.campaignId === 69) return "reputation";
  if (session.campaignId === 70) return "socials";
  return "";
}
