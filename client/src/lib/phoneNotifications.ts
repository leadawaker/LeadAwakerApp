/**
 * Notification types the phone app leaves out (list, unread badge and toasts).
 * campaign_summary is the engine's nightly "Campaign Summary: <name>" note
 * (automations nightly_summary.py); it links to the retired Campaigns page and
 * buried the useful alerts on a phone. Desktop still shows it.
 *
 * Every reader of the shared notification queries builds its URL here, so the
 * phone's cached count and list always agree.
 */
export const PHONE_HIDDEN_TYPES = ["campaign_summary"] as const;

export function isPhoneViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches === true;
}

export function hiddenOnPhone(type: string): boolean {
  return isPhoneViewport() && (PHONE_HIDDEN_TYPES as readonly string[]).includes(type);
}

/**
 * Query-key suffix for the shared notification queries: the phone and desktop
 * fetch different rows, so their cache entries stay apart. Invalidate with the
 * bare base key (e.g. ["/api/notifications"]) to hit both.
 */
export function notificationsView(): "phone" | "desktop" {
  return isPhoneViewport() ? "phone" : "desktop";
}

/** `/api/notifications...` with `exclude=` added on a phone. */
export function notificationsUrl(path: string): string {
  if (!isPhoneViewport()) return path;
  return `${path}${path.includes("?") ? "&" : "?"}exclude=${PHONE_HIDDEN_TYPES.join(",")}`;
}
