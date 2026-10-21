/**
 * Nav rules (pure, no imports so node:test can run them).
 * Clients get flat lists driven by what their account has. Agency users keep
 * the gated arrays in RightSidebar / MobileMorePage, plus the bottom bar here.
 */
export interface ClientNavFacts {
  voiceLive: boolean;
  hasInvoices: boolean;
  hasReactivation: boolean;
  hasReceptionist: boolean;
  /** Website chat or WhatsApp is on for the account: the Chats page has something to show. */
  hasChats: boolean;
  /** The agency switched Social on for the account (Accounts.social_enabled). */
  hasSocial: boolean;
}

export type ClientNavKey = "home" | "calls" | "chats" | "leads" | "calendar" | "social" | "myReceptionist" | "billing" | "campaigns";

/** Desktop nav bar for a client: one flat list, no section headings. */
export function clientNavItems(f: ClientNavFacts): ClientNavKey[] {
  const out: ClientNavKey[] = ["home"];
  if (f.voiceLive) out.push("calls");
  if (f.hasChats) out.push("chats");
  out.push("leads", "calendar");
  if (f.hasSocial) out.push("social");
  out.push("myReceptionist");
  if (f.hasInvoices) out.push("billing");
  if (f.hasReactivation) out.push("campaigns");
  return out;
}

/** Room for four tabs; More is the fifth. */
const CLIENT_BAR_SLOTS = 4;

/**
 * Mobile bottom bar (More is added by the bar itself). Leads takes the Chats slot when there are no chats.
 * Socials takes the free fourth slot when there is one (no voice line), else it sits on More.
 */
export function clientBottomBar(f: ClientNavFacts): ClientNavKey[] {
  const out: ClientNavKey[] = ["home"];
  if (f.voiceLive) out.push("calls");
  out.push("calendar", f.hasChats ? "chats" : "leads");
  if (f.hasSocial && out.length < CLIENT_BAR_SLOTS) out.push("social");
  return out;
}

/** The client More page, top to bottom: Socials (when not in the bar), Account, Leads (when not in the bar), Billing, Campaigns. */
export function clientMoreItems(f: ClientNavFacts): ClientNavKey[] {
  const bar = clientBottomBar(f);
  const out: ClientNavKey[] = [];
  if (f.hasSocial && !bar.includes("social")) out.push("social");
  out.push("myReceptionist");
  if (!bar.includes("leads")) out.push("leads");
  if (f.hasInvoices) out.push("billing");
  if (f.hasReactivation) out.push("campaigns");
  return out;
}

export type AgencyBarKey = "home" | "calls" | "chats" | "calendar" | "tasks" | "social";

/** Agency bottom bar: Calendar fills the Calls slot for someone without voice access. Socials is on the More page. */
export function agencyBottomBar(hasVoiceCalls: boolean): AgencyBarKey[] {
  return hasVoiceCalls ? ["home", "calls", "chats", "tasks"] : ["home", "chats", "calendar", "tasks"];
}

export function myAccountLabelKey(f: ClientNavFacts): "sidebar.myReceptionist" | "sidebar.myAccount" {
  return f.hasReceptionist ? "sidebar.myReceptionist" : "sidebar.myAccount";
}

export const CLIENT_NAV_HREF: Record<ClientNavKey, string> = {
  home: "/platform/home",
  calls: "/platform/voice-calls",
  chats: "/platform/chat",
  leads: "/platform/contacts",
  calendar: "/platform/calendar",
  social: "/platform/social",
  myReceptionist: "/platform/accounts",
  billing: "/platform/billing",
  campaigns: "/platform/campaigns",
};

/** Full label key for a client nav entry. */
export function clientNavLabelKey(k: ClientNavKey, f: ClientNavFacts): string {
  switch (k) {
    case "home": return "sidebar.home";
    case "calls": return "sidebar.calls";
    case "chats": return "sidebar.chats";
    case "leads": return "sidebar.leads";
    case "calendar": return "sidebar.calendar";
    case "social": return "sidebar.social";
    case "myReceptionist": return myAccountLabelKey(f);
    case "billing": return "sidebar.billing";
    case "campaigns": return "sidebar.reactivation";
  }
}

/**
 * True when a link points at the page already open. The More overlay only
 * closes on a route change, so such a link has to close it itself (F4).
 */
export function isSameRoute(href: string, location: string): boolean {
  const path = href.split(/[?#]/)[0];
  return location === path || location.startsWith(`${path}/`);
}
