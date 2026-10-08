import { isNavItemVisible, readNavGateContext, type NavGate, type NavGateContext } from "@/components/crm/navVisibility";

/**
 * Per-user landing page: where `/platform` (and the post-login redirect) sends
 * the user. Stored in users.preferences.landingPage as a route path, mirrored in
 * localStorage so the redirect can resolve synchronously with no flash.
 */
export const LANDING_PREF_KEY = "landingPage";
export const LANDING_LS_KEY = "leadawaker_landing_page";

export type LandingOption = NavGate & {
  href: string;
  /** Key in the `crm` namespace, reusing the nav bar labels. */
  labelKey: string;
};

/**
 * Short list of sensible landing pages. Each carries the same NavGate as its nav
 * bar entry, so the picker never offers a page the nav hides.
 */
export const LANDING_OPTIONS: LandingOption[] = [
  { href: "/platform/home", labelKey: "sidebar.home", ownerOnly: true },
  { href: "/platform/campaigns", labelKey: "sidebar.reactivation" },
  { href: "/platform/speed-to-lead", labelKey: "sidebar.speedToLead", serviceKey: "speed", agencyOnly: true },
  { href: "/platform/reputation", labelKey: "sidebar.reputation", serviceKey: "reputation" },
  { href: "/platform/missed-calls", labelKey: "sidebar.missedCalls", serviceKey: "missedcall" },
  { href: "/platform/chat", labelKey: "sidebar.conversations", agencyOnly: true },
  { href: "/platform/contacts", labelKey: "sidebar.leads" },
  { href: "/platform/calendar", labelKey: "sidebar.calendar" },
  { href: "/platform/tasks", labelKey: "sidebar.tasks", agencyOnly: true },
  { href: "/platform/accounts", labelKey: "sidebar.accounts" },
];

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Options the user can open: pass useNavGateContext() from React (impersonation aware). */
export function getAllowedLandingOptions(ctx: NavGateContext = readNavGateContext()): LandingOption[] {
  return LANDING_OPTIONS.filter((o) => isNavItemVisible(o, ctx));
}

/** Default landing: Owner gets the Home hub, everyone else Reactivation. */
export function defaultLandingPath(ctx: NavGateContext = readNavGateContext()): string {
  return ctx.isOwner ? "/platform/home" : "/platform/campaigns";
}

/** True once the session has written the preference (even an empty one). */
export function isLandingHydrated(): boolean {
  return safeGet(LANDING_LS_KEY) !== null;
}

/** The saved landing path if the user may still open it, else null. */
export function getSavedLandingPath(ctx: NavGateContext = readNavGateContext()): string | null {
  const saved = safeGet(LANDING_LS_KEY);
  if (!saved) return null;
  return getAllowedLandingOptions(ctx).some((o) => o.href === saved) ? saved : null;
}

/** Where the user lands: saved choice when still accessible, otherwise the default. */
export function resolveLandingPath(): string {
  return getSavedLandingPath() ?? defaultLandingPath();
}

export function writeLandingPage(path: string | null): void {
  try {
    localStorage.setItem(LANDING_LS_KEY, path ?? "");
  } catch {
    /* ignore */
  }
}

export function hydrateLandingPage(prefs: Record<string, unknown> | null | undefined): void {
  const v = prefs?.[LANDING_PREF_KEY];
  writeLandingPage(typeof v === "string" ? v : null);
}

export function clearLandingPage(): void {
  try {
    localStorage.removeItem(LANDING_LS_KEY);
  } catch {
    /* ignore */
  }
}
