// Where the receptionist is tuned: the Settings view of the Calls page (phone)
// and of the Chats page (website chat and WhatsApp), per account. The Accounts
// page only connects things. URL contract on both pages:
//   ?view=settings            open the Settings view
//   &account=<id>             agency: the account to show (clients always get their own)
//   &section=<name>           the section to open first (Voice: overview|prompt|knowledge|call|after)
//   &focus=<card>             Voice only: the card to scroll to (a readiness item's card)
// section and focus are read once, dropped from the URL and applied to the first account shown only;
// view and account stay so a reload keeps them.

export type ReceptionistChannel = "voice" | "chat";

export const CALLS_PAGE_PATH = "/platform/voice-calls";
export const CHATS_PAGE_PATH = "/platform/chat";
export const PAGE_PATH: Record<ReceptionistChannel, string> = { voice: CALLS_PAGE_PATH, chat: CHATS_PAGE_PATH };

export interface SettingsTarget {
  accountId?: number;
  section?: string;
  focus?: string;
}

export interface SettingsParams extends SettingsTarget {
  open: boolean;
}

const KEYS = ["view", "account", "section", "focus"] as const;
const NAME = /^[A-Za-z]{1,40}$/;

/** The link that opens a channel's Settings view (optionally on one account, section and card). */
export function receptionistSettingsHref(channel: ReceptionistChannel, target: SettingsTarget = {}): string {
  const q = new URLSearchParams({ view: "settings" });
  if (target.accountId && target.accountId > 0) q.set("account", String(target.accountId));
  if (target.section && NAME.test(target.section)) q.set("section", target.section);
  if (target.focus && NAME.test(target.focus)) q.set("focus", target.focus);
  return `${PAGE_PATH[channel]}?${q.toString()}`;
}

export function readSettingsParams(search: string): SettingsParams {
  const q = new URLSearchParams(search);
  const account = Number(q.get("account"));
  const section = q.get("section") ?? "";
  const focus = q.get("focus") ?? "";
  return {
    open: q.get("view") === "settings",
    accountId: Number.isInteger(account) && account > 0 ? account : undefined,
    section: NAME.test(section) ? section : undefined,
    focus: NAME.test(focus) ? focus : undefined,
  };
}

/**
 * Keep the address bar in step with the Settings view, without a navigation:
 * open writes ?view=settings (+ the agency's account), closed removes the
 * params. Only while `path` is still the page shown, so a link that just left
 * the page keeps its own query.
 */
export function syncSettingsParams(path: string, open: boolean, accountId?: number): void {
  try {
    if (window.location.pathname !== path) return;
    const q = new URLSearchParams(window.location.search);
    KEYS.forEach((k) => q.delete(k));
    if (open) {
      q.set("view", "settings");
      if (accountId && accountId > 0) q.set("account", String(accountId));
    }
    const qs = q.toString();
    const next = `${path}${qs ? `?${qs}` : ""}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  } catch { /* no history API: the view still opens, it just is not in the URL */ }
}

/**
 * The account a link's section and focus belong to: the first account shown.
 * undefined = no account shown yet, null = used up (another account was opened,
 * so its sections come from the remembered tab, not the old link).
 */
export function nextLinkedAccount(bound: number | null | undefined, accountId: number | undefined): number | null | undefined {
  if (bound === undefined) return accountId;
  if (bound !== null && accountId !== undefined && accountId !== bound) return null;
  return bound;
}
