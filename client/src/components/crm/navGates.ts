/**
 * Client-mode nav rules (pure, no imports so node:test can run them).
 * Agency users keep the hardcoded arrays in RightSidebar / MobileMorePage.
 */
export interface ClientNavFacts {
  voiceLive: boolean;
  hasInvoices: boolean;
  hasReactivation: boolean;
  hasReceptionist: boolean;
}

export type ClientNavKey = "home" | "calls" | "leads" | "calendar" | "myReceptionist" | "billing" | "campaigns";

/** Desktop nav bar for a client: one flat list, no section headings. */
export function clientNavItems(f: ClientNavFacts): ClientNavKey[] {
  const out: ClientNavKey[] = ["home"];
  if (f.voiceLive) out.push("calls");
  out.push("leads", "calendar", "myReceptionist");
  if (f.hasInvoices) out.push("billing");
  if (f.hasReactivation) out.push("campaigns");
  return out;
}

/** Mobile bottom bar (More is added by the bar itself). */
export function clientBottomBar(_f: ClientNavFacts): ClientNavKey[] {
  return ["home", "leads", "calendar", "myReceptionist"];
}

/** Items that do not fit the bottom bar and live on the More page. */
export function clientMoreItems(f: ClientNavFacts): ClientNavKey[] {
  const bar = clientBottomBar(f);
  return clientNavItems(f).filter((k) => !bar.includes(k));
}

export function myAccountLabelKey(f: ClientNavFacts): "sidebar.myReceptionist" | "sidebar.myAccount" {
  return f.hasReceptionist ? "sidebar.myReceptionist" : "sidebar.myAccount";
}

export const CLIENT_NAV_HREF: Record<ClientNavKey, string> = {
  home: "/platform/home",
  calls: "/platform/voice-calls",
  leads: "/platform/contacts",
  calendar: "/platform/calendar",
  myReceptionist: "/platform/accounts",
  billing: "/platform/billing",
  campaigns: "/platform/campaigns",
};

/** Full label key for a client nav entry. */
export function clientNavLabelKey(k: ClientNavKey, f: ClientNavFacts): string {
  switch (k) {
    case "home": return "sidebar.home";
    case "calls": return "sidebar.calls";
    case "leads": return "sidebar.leads";
    case "calendar": return "sidebar.calendar";
    case "myReceptionist": return myAccountLabelKey(f);
    case "billing": return "sidebar.billing";
    case "campaigns": return "sidebar.reactivation";
  }
}
