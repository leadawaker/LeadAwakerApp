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
  /** The widget demo opens its own page: the prospect's homepage screenshot
   *  with the chat widget on top (/widget-demo/<token>, specs/website-widget).
   *  Server-rendered on the Pi, so it has no Vercel copy. */
  widgetPage?: boolean;
  /** The review demo opens its own two-phone page (/review-demo?token=...,
   *  specs/review-demo). Chat runs on the web-demo path, so the page works on
   *  both the Pi and Vercel origins. */
  reviewPage?: boolean;
  /** The Instagram comment-to-DM demo opens its own page (/social-demo/<token>,
   *  specs/social-reply-demo). Rendered by the Pi; the Vercel origin proxies
   *  /social-demo/* and /social-demo-assets/* to it (vercel.json). */
  socialPage?: boolean;
}

export const SERVICES: ServiceDef[] = [
  { key: "dbr", labelKey: "services.dbr", icon: Database, campaignId: 60, scenario: "inquired" },
  // Same campaign as DBR, opposite scenario: a quote already went out, so the
  // engine resolves decision mode and the quoted opener.
  { key: "quote", labelKey: "services.quote", icon: FileText, campaignId: 60, scenario: "deciding" },
  { key: "speed", labelKey: "services.speed", icon: MessageCircle, campaignId: 67, scenario: "inquired" },
  { key: "widget", labelKey: "services.widget", icon: Globe, campaignId: 68, scenario: "inquired", widgetPage: true },
  // Voice mints its persona on the Speed to Lead campaign (any service campaign
  // carries the same persona) and then opens the voice page with that token.
  { key: "voice", labelKey: "services.voice", icon: Phone, campaignId: 67, scenario: "inquired", voice: true },
  { key: "reputation", labelKey: "services.reputation", icon: Star, campaignId: 69, scenario: "inquired", reviewPage: true },
  { key: "socials", labelKey: "services.socials", icon: Instagram, campaignId: 70, scenario: "inquired", socialPage: true },
];

/** The token lives in the minted path (/demo/<token>); the voice page wants it
 *  as a query parameter, so pull it back out rather than plumbing a second
 *  field through the mint API. */
export function tokenFromUrl(demoUrl: string): string {
  const m = /\/demo\/([A-Za-z0-9]{4,64})/.exec(demoUrl || "");
  return m ? m[1]! : "";
}

/** The screenshot-backdrop widget demo for a minted chat link. */
export function widgetDemoUrl(demoUrl: string): string {
  return `${window.location.origin}/widget-demo/${tokenFromUrl(demoUrl)}`;
}

/** The two-phone review demo for a minted link, on the given origin. */
export function reviewDemoUrl(demoUrl: string, origin: string = window.location.origin): string {
  return `${origin}/review-demo?token=${tokenFromUrl(demoUrl)}`;
}

/** The Instagram comment-to-DM feed for a minted link. */
export function socialDemoUrl(demoUrl: string): string {
  return `${window.location.origin}/social-demo/${tokenFromUrl(demoUrl)}`;
}

/** The link to hand a prospect. Always the canonical public origin the link was
 *  minted with, never the CRM host it is being copied from. */
export function serviceCopyUrl(svc: ServiceDef, session: DemoSession): string {
  // The widget page only exists on the Pi, never on the Vercel origin the chat
  // link was minted with, so it is always handed out from the CRM host.
  if (svc.widgetPage) return widgetDemoUrl(session.demoUrl);
  if (svc.socialPage) return socialDemoUrl(session.demoUrl);
  if (svc.reviewPage) {
    let origin = window.location.origin;
    try {
      origin = new URL(session.demoUrl).origin;
    } catch {
      /* keep the CRM origin */
    }
    return reviewDemoUrl(session.demoUrl, origin);
  }
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
  if (svc.widgetPage) return widgetDemoUrl(session.demoUrl);
  if (svc.socialPage) return socialDemoUrl(session.demoUrl);
  if (svc.reviewPage) return reviewDemoUrl(session.demoUrl);
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
  if (session.campaignId === 69) return "reputation";
  if (session.campaignId === 70) return "socials";
  return "";
}
