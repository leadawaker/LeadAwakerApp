import { Database, FileText, Globe, Instagram, MessageCircle, Phone, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { demoOpenUrl, type DemoSession } from "./api/demoSessionsApi";

/**
 * The services on offer, in the order they are pitched.
 *
 * One list, read by both the New demo panel (which mints links) and the Demos
 * table (which lays a column out per service). Two copies would drift, and the
 * failure is silent: a column with no button behind it, or a link minted into a
 * service the table cannot place.
 *
 * Services with no campaign behind them stay in the list rather than being
 * hidden, so the roadmap is visible on a call without pretending to work.
 */
export interface ServiceDef {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  /** The demo campaign this service runs on, or null when it isn't built. */
  campaignId: number | null;
  /** What the lead already did. Carried per service rather than picked in a
   *  dropdown: reactivation and quote follow-up ARE the two scenarios, so a
   *  separate control only ever asked the same question twice. */
  scenario: "inquired" | "deciding";
  /** Voice runs in the browser, not as a chat link: it needs a token, then a
   *  page. It has no WhatsApp side at all. */
  voice?: boolean;
}

export const SERVICES: ServiceDef[] = [
  { key: "dbr", labelKey: "services.dbr", icon: Database, campaignId: 60, scenario: "inquired" },
  // Same campaign as DBR, opposite scenario: a quote already went out, so the
  // engine resolves decision mode and the quoted opener.
  { key: "quote", labelKey: "services.quote", icon: FileText, campaignId: 60, scenario: "deciding" },
  { key: "speed", labelKey: "services.speed", icon: MessageCircle, campaignId: 67, scenario: "inquired" },
  { key: "widget", labelKey: "services.widget", icon: Globe, campaignId: 68, scenario: "inquired" },
  // Voice mints its persona on the Speed to Lead campaign (any service campaign
  // carries the same persona) and then opens the voice page with that token.
  { key: "voice", labelKey: "services.voice", icon: Phone, campaignId: 67, scenario: "inquired", voice: true },
  { key: "reputation", labelKey: "services.reputation", icon: Star, campaignId: null, scenario: "inquired" },
  { key: "socials", labelKey: "services.socials", icon: Instagram, campaignId: null, scenario: "inquired" },
];

/** The token lives in the minted path (/demo/<token>); the voice page wants it
 *  as a query parameter, so pull it back out rather than plumbing a second
 *  field through the mint API. */
export function tokenFromUrl(demoUrl: string): string {
  const m = /\/demo\/([A-Za-z0-9]{4,64})/.exec(demoUrl || "");
  return m ? m[1]! : "";
}

/** The link to hand a prospect. Always the canonical public origin the link was
 *  minted with — never the CRM host it is being copied from. */
export function serviceCopyUrl(svc: ServiceDef, session: DemoSession): string {
  if (!svc.voice) return session.demoUrl;
  let origin = "";
  try {
    origin = new URL(session.demoUrl).origin;
  } catch {
    origin = window.location.origin;
  }
  return `${origin}/voice-demo?token=${tokenFromUrl(session.demoUrl)}`;
}

/** The link WE open, which points at the host we are already on, so the Pi
 *  serves the build being edited. Same reasoning as demoOpenUrl. */
export function serviceOpenUrl(svc: ServiceDef, session: DemoSession): string {
  return svc.voice
    ? `${window.location.origin}/voice-demo?token=${tokenFromUrl(session.demoUrl)}`
    : demoOpenUrl(session.demoUrl);
}

/**
 * Which column a link belongs in.
 *
 * Links minted before the service tag existed carry no `service`, so they are
 * placed by the pair that actually distinguished them then: campaign plus
 * scenario. Speed and Voice share campaign 67 and were never told apart, so an
 * untagged 67 link reads as Speed — the surface it was almost always minted
 * from. Anything on a campaign that is not a service campaign stays unplaced
 * and gets its own cell at the end of the row.
 */
export function serviceOf(session: DemoSession): string {
  if (session.service) return session.service;
  if (session.campaignId === 60) return session.scenario === "deciding" ? "quote" : "dbr";
  if (session.campaignId === 67) return "speed";
  if (session.campaignId === 68) return "widget";
  return "";
}
