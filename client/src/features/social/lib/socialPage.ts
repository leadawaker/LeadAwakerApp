// Pure rules behind the Socials page (pages/SocialPage.tsx): which accounts an agency user can
// pick, which account the page shows, and which sections each role gets. No React, no fetch.
import { DEFAULT_TIMEZONE } from "@shared/socialPosts";

/** An account row as /api/accounts returns it (database column names). */
export interface AccountRowLike {
  id: number;
  name?: string | null;
  social_enabled?: unknown;
  timezone?: unknown;
  language?: unknown;
}

export interface SocialAccountOption { id: number; name: string; timeZone: string; language: string | null }

function option(a: AccountRowLike): SocialAccountOption {
  return {
    id: a.id,
    name: (typeof a.name === "string" && a.name.trim()) || `#${a.id}`,
    timeZone: typeof a.timezone === "string" && a.timezone ? a.timezone : DEFAULT_TIMEZONE,
    language: typeof a.language === "string" ? a.language : null,
  };
}

/** The agency picker: accounts with Social switched on, by name. */
export function socialAccountOptions(accounts: readonly AccountRowLike[]): SocialAccountOption[] {
  return accounts
    .filter((a) => a.id > 0 && a.social_enabled === true)
    .map(option)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The account the page shows. Agency: the account picked in the global switcher when it has
 * Social on, else the first one that has. Client: always their own account.
 */
export function pickSocialAccount(
  p: { isAgency: boolean; currentAccountId: number; options: readonly SocialAccountOption[]; ownAccount?: AccountRowLike | null },
): SocialAccountOption | null {
  if (!p.isAgency) {
    if (p.currentAccountId <= 0) return null;
    return option(p.ownAccount && p.ownAccount.id === p.currentAccountId ? p.ownAccount : { id: p.currentAccountId });
  }
  return p.options.find((o) => o.id === p.currentAccountId) ?? p.options[0] ?? null;
}

export type SocialSection = "home" | "posts" | "studio" | "calendar" | "about" | "settings";

/**
 * Sections in display order; the first one opens by default. Agency gets the full studio layout; a
 * client user (Manager, Viewer) opens on the phone-first home. The server checks every action again.
 */
export function socialSections(who: { isAgency: boolean; userRole: string }): SocialSection[] {
  if (who.isAgency) return ["posts", "studio", "calendar", "about", "settings"];
  return ["home", "posts", "calendar", "about"];
}

/** Old notification links pointed at the account workspace tab; they now open the Socials page. */
export const SOCIAL_PAGE_PATH = "/platform/social";

/** `?account=<id>&section=<name>` from a notification or an in-app link (shared/socialStudio.ts socialPageLink). */
export function parseSocialDeepLink(search: string): { accountId: number | null; section: string | null } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const id = Number(params.get("account"));
  const section = params.get("section");
  return {
    accountId: Number.isInteger(id) && id > 0 ? id : null,
    section: section && /^[a-z_]{1,32}$/.test(section) ? section : null,
  };
}
